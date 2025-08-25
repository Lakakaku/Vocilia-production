// Geo-Distributed Caching Service for Location Data
// Provides intelligent caching across Swedish regions with automatic failover

const Redis = require('ioredis');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class GeoDistributedCache extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      regions: ['stockholm', 'gothenburg', 'malmo'],
      defaultTTL: 3600, // 1 hour
      maxRetries: 3,
      retryDelay: 1000,
      compressionThreshold: 1024, // 1KB
      ...config
    };

    this.clients = new Map();
    this.healthStatus = new Map();
    this.replicationQueue = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      replications: 0
    };

    this.initializeClients();
    this.startHealthChecks();
    this.startReplicationWorker();
  }

  // Initialize Redis clients for each region
  initializeClients() {
    const regions = {
      stockholm: {
        host: 'redis-stockholm.internal',
        port: 6379,
        priority: 1,
        coordinates: { lat: 59.3293, lng: 18.0686 }
      },
      gothenburg: {
        host: 'redis-gothenburg.internal',
        port: 6379,
        priority: 2,
        coordinates: { lat: 57.7089, lng: 11.9746 }
      },
      malmo: {
        host: 'redis-malmo.internal',
        port: 6379,
        priority: 3,
        coordinates: { lat: 55.6050, lng: 13.0038 }
      }
    };

    for (const [region, config] of Object.entries(regions)) {
      const client = new Redis({
        host: config.host,
        port: config.port,
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 5000,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        keyPrefix: `geo:${region}:`,
        db: 0
      });

      client.on('connect', () => {
        console.log(`Connected to Redis in ${region}`);
        this.healthStatus.set(region, { status: 'healthy', lastCheck: Date.now() });
        this.emit('regionConnected', region);
      });

      client.on('error', (err) => {
        console.error(`Redis error in ${region}:`, err);
        this.healthStatus.set(region, { status: 'unhealthy', lastCheck: Date.now(), error: err.message });
        this.emit('regionError', region, err);
      });

      client.on('reconnecting', () => {
        console.log(`Reconnecting to Redis in ${region}`);
        this.healthStatus.set(region, { status: 'reconnecting', lastCheck: Date.now() });
      });

      this.clients.set(region, {
        client,
        config,
        stats: {
          requests: 0,
          errors: 0,
          latency: 0
        }
      });
    }
  }

  // Get optimal region based on user location or preference
  getOptimalRegion(userLocation = null, preferredRegion = null) {
    // If specific region requested and healthy, use it
    if (preferredRegion && this.isRegionHealthy(preferredRegion)) {
      return preferredRegion;
    }

    // If user location provided, find closest healthy region
    if (userLocation && userLocation.lat && userLocation.lng) {
      return this.findClosestHealthyRegion(userLocation);
    }

    // Fallback to first healthy region by priority
    for (const region of this.config.regions) {
      if (this.isRegionHealthy(region)) {
        return region;
      }
    }

    // Last resort - return stockholm even if unhealthy
    return 'stockholm';
  }

  // Find closest healthy region based on coordinates
  findClosestHealthyRegion(userLocation) {
    let closestRegion = null;
    let minDistance = Infinity;

    for (const [region, data] of this.clients) {
      if (!this.isRegionHealthy(region)) continue;

      const distance = this.calculateDistance(
        userLocation,
        data.config.coordinates
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestRegion = region;
      }
    }

    return closestRegion || 'stockholm';
  }

  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Check if region is healthy
  isRegionHealthy(region) {
    const health = this.healthStatus.get(region);
    return health && health.status === 'healthy';
  }

  // Get value from cache with geo-optimization
  async get(key, options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        userLocation,
        preferredRegion,
        allowStale = false,
        timeout = 5000
      } = options;

      // Determine optimal region
      const primaryRegion = this.getOptimalRegion(userLocation, preferredRegion);
      
      // Try primary region first
      let result = await this.getFromRegion(key, primaryRegion, { timeout });
      
      if (result !== null) {
        this.metrics.hits++;
        this.updateRegionStats(primaryRegion, Date.now() - startTime);
        return this.deserializeValue(result);
      }

      // Try other regions as fallback
      const fallbackRegions = this.config.regions.filter(r => r !== primaryRegion);
      
      for (const region of fallbackRegions) {
        if (!this.isRegionHealthy(region)) continue;
        
        result = await this.getFromRegion(key, region, { timeout });
        
        if (result !== null) {
          this.metrics.hits++;
          this.updateRegionStats(region, Date.now() - startTime);
          
          // Replicate to primary region for future requests
          this.scheduleReplication(key, result, primaryRegion);
          
          return this.deserializeValue(result);
        }
      }

      this.metrics.misses++;
      return null;
      
    } catch (error) {
      this.metrics.errors++;
      console.error('Error getting from geo cache:', error);
      
      if (options.throwOnError) {
        throw error;
      }
      
      return null;
    }
  }

  // Get value from specific region
  async getFromRegion(key, region, options = {}) {
    const clientData = this.clients.get(region);
    if (!clientData || !this.isRegionHealthy(region)) {
      return null;
    }

    const { timeout = 5000 } = options;
    
    try {
      clientData.stats.requests++;
      
      const result = await Promise.race([
        clientData.client.get(key),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);

      return result;
      
    } catch (error) {
      clientData.stats.errors++;
      console.error(`Error getting from ${region}:`, error);
      
      // Mark region as unhealthy on repeated errors
      if (clientData.stats.errors > 5) {
        this.healthStatus.set(region, { 
          status: 'unhealthy', 
          lastCheck: Date.now(),
          error: 'Too many errors'
        });
      }
      
      return null;
    }
  }

  // Set value in cache with geo-replication
  async set(key, value, options = {}) {
    const {
      ttl = this.config.defaultTTL,
      userLocation,
      preferredRegion,
      replicateToAll = true,
      consistency = 'eventual' // 'immediate' or 'eventual'
    } = options;

    const serializedValue = this.serializeValue(value);
    const primaryRegion = this.getOptimalRegion(userLocation, preferredRegion);
    
    try {
      // Set in primary region first
      const success = await this.setInRegion(key, serializedValue, ttl, primaryRegion);
      
      if (!success) {
        throw new Error(`Failed to set in primary region ${primaryRegion}`);
      }

      if (replicateToAll) {
        if (consistency === 'immediate') {
          // Wait for all replications to complete
          await this.replicateToAllRegions(key, serializedValue, ttl, primaryRegion);
        } else {
          // Schedule async replication
          this.scheduleAsyncReplication(key, serializedValue, ttl, primaryRegion);
        }
      }

      return true;
      
    } catch (error) {
      console.error('Error setting in geo cache:', error);
      throw error;
    }
  }

  // Set value in specific region
  async setInRegion(key, value, ttl, region) {
    const clientData = this.clients.get(region);
    if (!clientData || !this.isRegionHealthy(region)) {
      return false;
    }

    try {
      if (ttl > 0) {
        await clientData.client.setex(key, ttl, value);
      } else {
        await clientData.client.set(key, value);
      }
      
      return true;
      
    } catch (error) {
      console.error(`Error setting in ${region}:`, error);
      return false;
    }
  }

  // Replicate to all regions immediately
  async replicateToAllRegions(key, value, ttl, excludeRegion) {
    const promises = [];
    
    for (const region of this.config.regions) {
      if (region !== excludeRegion && this.isRegionHealthy(region)) {
        promises.push(this.setInRegion(key, value, ttl, region));
      }
    }

    const results = await Promise.allSettled(promises);
    const failures = results.filter(r => r.status === 'rejected' || !r.value);
    
    if (failures.length > 0) {
      console.warn(`Failed to replicate to ${failures.length} regions`);
    }

    this.metrics.replications += results.length;
  }

  // Schedule async replication
  scheduleAsyncReplication(key, value, ttl, excludeRegion) {
    const replicationJob = {
      key,
      value,
      ttl,
      excludeRegion,
      timestamp: Date.now(),
      retries: 0
    };

    if (!this.replicationQueue.has(key)) {
      this.replicationQueue.set(key, []);
    }
    
    this.replicationQueue.get(key).push(replicationJob);
  }

  // Schedule replication for cache miss
  scheduleReplication(key, value, targetRegion) {
    const replicationJob = {
      key,
      value,
      ttl: this.config.defaultTTL,
      targetRegion,
      timestamp: Date.now(),
      retries: 0
    };

    this.replicationQueue.set(`${key}:${targetRegion}`, [replicationJob]);
  }

  // Delete from all regions
  async delete(key, options = {}) {
    const { consistency = 'eventual' } = options;
    const promises = [];

    for (const [region, clientData] of this.clients) {
      if (this.isRegionHealthy(region)) {
        promises.push(
          clientData.client.del(key).catch(err => {
            console.error(`Error deleting from ${region}:`, err);
            return false;
          })
        );
      }
    }

    if (consistency === 'immediate') {
      const results = await Promise.allSettled(promises);
      return results.some(r => r.status === 'fulfilled' && r.value > 0);
    } else {
      // Fire and forget
      Promise.allSettled(promises);
      return true;
    }
  }

  // Get multiple keys efficiently
  async mget(keys, options = {}) {
    const { userLocation, preferredRegion } = options;
    const primaryRegion = this.getOptimalRegion(userLocation, preferredRegion);
    
    const results = new Map();
    const missingKeys = [];

    // Try to get all from primary region
    const primaryResults = await this.mgetFromRegion(keys, primaryRegion);
    
    for (let i = 0; i < keys.length; i++) {
      if (primaryResults[i] !== null) {
        results.set(keys[i], this.deserializeValue(primaryResults[i]));
      } else {
        missingKeys.push(keys[i]);
      }
    }

    // Try fallback regions for missing keys
    if (missingKeys.length > 0) {
      const fallbackRegions = this.config.regions.filter(r => r !== primaryRegion);
      
      for (const region of fallbackRegions) {
        if (!this.isRegionHealthy(region) || missingKeys.length === 0) continue;
        
        const fallbackResults = await this.mgetFromRegion(missingKeys, region);
        const foundKeys = [];
        
        for (let i = 0; i < missingKeys.length; i++) {
          if (fallbackResults[i] !== null) {
            results.set(missingKeys[i], this.deserializeValue(fallbackResults[i]));
            foundKeys.push(missingKeys[i]);
            
            // Schedule replication to primary
            this.scheduleReplication(missingKeys[i], fallbackResults[i], primaryRegion);
          }
        }
        
        // Remove found keys from missing list
        foundKeys.forEach(key => {
          const index = missingKeys.indexOf(key);
          if (index > -1) missingKeys.splice(index, 1);
        });
      }
    }

    return results;
  }

  // Get multiple keys from specific region
  async mgetFromRegion(keys, region) {
    const clientData = this.clients.get(region);
    if (!clientData || !this.isRegionHealthy(region)) {
      return keys.map(() => null);
    }

    try {
      return await clientData.client.mget(...keys);
    } catch (error) {
      console.error(`Error mget from ${region}:`, error);
      return keys.map(() => null);
    }
  }

  // Serialize value for storage
  serializeValue(value) {
    const serialized = JSON.stringify({
      data: value,
      timestamp: Date.now(),
      type: typeof value
    });

    // Compress if above threshold
    if (serialized.length > this.config.compressionThreshold) {
      return this.compress(serialized);
    }

    return serialized;
  }

  // Deserialize value from storage
  deserializeValue(serializedValue) {
    try {
      // Try decompression if needed
      const decompressed = this.isCompressed(serializedValue) 
        ? this.decompress(serializedValue)
        : serializedValue;
        
      const parsed = JSON.parse(decompressed);
      return parsed.data;
      
    } catch (error) {
      console.error('Error deserializing value:', error);
      return null;
    }
  }

  // Simple compression using gzip
  compress(data) {
    const zlib = require('zlib');
    return zlib.gzipSync(Buffer.from(data)).toString('base64');
  }

  decompress(compressedData) {
    const zlib = require('zlib');
    return zlib.gunzipSync(Buffer.from(compressedData, 'base64')).toString();
  }

  isCompressed(data) {
    // Simple heuristic - compressed data is usually base64
    return /^[A-Za-z0-9+/]+=*$/.test(data) && data.length > 100;
  }

  // Update region statistics
  updateRegionStats(region, latency) {
    const clientData = this.clients.get(region);
    if (clientData) {
      const stats = clientData.stats;
      stats.latency = (stats.latency + latency) / 2; // Moving average
    }
  }

  // Start health check worker
  startHealthChecks() {
    setInterval(async () => {
      for (const [region, clientData] of this.clients) {
        try {
          const startTime = Date.now();
          await clientData.client.ping();
          const latency = Date.now() - startTime;
          
          this.healthStatus.set(region, {
            status: 'healthy',
            lastCheck: Date.now(),
            latency
          });
          
          this.updateRegionStats(region, latency);
          
        } catch (error) {
          this.healthStatus.set(region, {
            status: 'unhealthy',
            lastCheck: Date.now(),
            error: error.message
          });
        }
      }
    }, 30000); // Every 30 seconds
  }

  // Start replication worker
  startReplicationWorker() {
    setInterval(async () => {
      const jobsToProcess = Array.from(this.replicationQueue.entries());
      this.replicationQueue.clear();

      for (const [jobKey, jobs] of jobsToProcess) {
        for (const job of jobs) {
          try {
            if (job.targetRegion) {
              // Single region replication
              await this.setInRegion(job.key, job.value, job.ttl, job.targetRegion);
            } else {
              // Multi-region replication
              await this.replicateToAllRegions(job.key, job.value, job.ttl, job.excludeRegion);
            }
            
            this.metrics.replications++;
            
          } catch (error) {
            console.error('Replication job failed:', error);
            
            // Retry logic
            if (job.retries < this.config.maxRetries) {
              job.retries++;
              if (!this.replicationQueue.has(jobKey)) {
                this.replicationQueue.set(jobKey, []);
              }
              this.replicationQueue.get(jobKey).push(job);
            }
          }
        }
      }
    }, 5000); // Every 5 seconds
  }

  // Get cache statistics
  getStats() {
    return {
      ...this.metrics,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses),
      regions: Object.fromEntries(
        Array.from(this.clients.entries()).map(([region, data]) => [
          region,
          {
            health: this.healthStatus.get(region),
            stats: data.stats
          }
        ])
      )
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('Shutting down geo-distributed cache...');
    
    for (const [region, clientData] of this.clients) {
      try {
        await clientData.client.quit();
        console.log(`Disconnected from ${region}`);
      } catch (error) {
        console.error(`Error disconnecting from ${region}:`, error);
      }
    }
  }
}

module.exports = GeoDistributedCache;