// Location-based Routing and QR Code Generation Service
// Handles geo-distributed business locations and intelligent routing

const crypto = require('crypto');
const geolib = require('geolib');
const QRCode = require('qrcode');

class LocationRoutingService {
  constructor(config) {
    this.config = config;
    this.regions = new Map();
    this.locationCache = new Map();
    this.qrCodeCache = new Map();
    this.encryptionKey = config.qrEncryptionKey;
    
    this.initializeRegions();
  }

  initializeRegions() {
    // Define Swedish regions with data centers
    this.regions.set('stockholm', {
      name: 'Stockholm',
      coordinates: { latitude: 59.3293, longitude: 18.0686 },
      datacenter: 'sto-dc1',
      endpoints: {
        api: 'stockholm-api.internal',
        dashboard: 'stockholm-dashboard.internal',
        voice: 'stockholm-voice.internal'
      },
      coverage: {
        radius: 150000, // 150km radius
        priority: 1
      }
    });

    this.regions.set('gothenburg', {
      name: 'Gothenburg', 
      coordinates: { latitude: 57.7089, longitude: 11.9746 },
      datacenter: 'got-dc1',
      endpoints: {
        api: 'gothenburg-api.internal',
        dashboard: 'gothenburg-dashboard.internal', 
        voice: 'gothenburg-voice.internal'
      },
      coverage: {
        radius: 120000, // 120km radius
        priority: 2
      }
    });

    this.regions.set('malmo', {
      name: 'Malmö',
      coordinates: { latitude: 55.6050, longitude: 13.0038 },
      datacenter: 'mmo-dc1',
      endpoints: {
        api: 'malmo-api.internal',
        dashboard: 'malmo-dashboard.internal',
        voice: 'malmo-voice.internal'
      },
      coverage: {
        radius: 100000, // 100km radius
        priority: 3
      }
    });

    // Fallback region
    this.regions.set('default', {
      name: 'Default',
      coordinates: { latitude: 59.3293, longitude: 18.0686 },
      datacenter: 'primary-dc',
      endpoints: {
        api: 'api-gateway.internal',
        dashboard: 'business-dashboard.internal',
        voice: 'voice-service.internal'
      },
      coverage: {
        radius: 1000000, // Covers all of Sweden
        priority: 999
      }
    });
  }

  // Generate location-specific QR code
  async generateLocationQR(businessId, locationId, businessLocation) {
    try {
      const cacheKey = `qr_${businessId}_${locationId}`;
      
      // Check cache first
      if (this.qrCodeCache.has(cacheKey)) {
        const cached = this.qrCodeCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
          return cached.qrData;
        }
      }

      // Determine optimal region for location
      const optimalRegion = this.determineOptimalRegion(businessLocation);
      
      // Generate QR payload with location context
      const qrPayload = {
        v: 2, // Version 2 with location routing
        b: businessId,
        l: locationId,
        r: optimalRegion.name.toLowerCase(),
        t: Date.now(),
        geo: {
          lat: businessLocation.latitude,
          lng: businessLocation.longitude,
          accuracy: businessLocation.accuracy || 100
        },
        endpoints: {
          api: optimalRegion.endpoints.api,
          ws: optimalRegion.endpoints.voice
        },
        meta: {
          region: optimalRegion.name,
          dc: optimalRegion.datacenter
        }
      };

      // Encrypt the payload
      const encryptedPayload = this.encryptQRPayload(qrPayload);
      
      // Create QR code URL with regional routing
      const qrUrl = `https://feedback.your-domain.com/scan/${encryptedPayload}?r=${optimalRegion.name.toLowerCase()}`;
      
      // Generate QR code
      const qrOptions = {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      };

      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, qrOptions);
      const qrCodeBuffer = await QRCode.toBuffer(qrUrl, qrOptions);
      
      const qrData = {
        url: qrUrl,
        dataUrl: qrCodeDataUrl,
        buffer: qrCodeBuffer,
        payload: qrPayload,
        region: optimalRegion.name.toLowerCase(),
        expiresAt: Date.now() + (7 * 24 * 3600 * 1000), // 1 week
        generatedAt: Date.now()
      };

      // Cache the result
      this.qrCodeCache.set(cacheKey, {
        qrData,
        timestamp: Date.now()
      });

      return qrData;
      
    } catch (error) {
      console.error('Error generating location QR code:', error);
      throw new Error('Failed to generate location-specific QR code');
    }
  }

  // Determine optimal region based on location
  determineOptimalRegion(location) {
    if (!location || !location.latitude || !location.longitude) {
      return this.regions.get('default');
    }

    let closestRegion = null;
    let closestDistance = Infinity;

    for (const [regionId, region] of this.regions) {
      if (regionId === 'default') continue;

      const distance = geolib.getDistance(
        { latitude: location.latitude, longitude: location.longitude },
        region.coordinates
      );

      if (distance <= region.coverage.radius && distance < closestDistance) {
        closestDistance = distance;
        closestRegion = region;
      }
    }

    return closestRegion || this.regions.get('default');
  }

  // Route request to optimal region
  routeRequest(location, requestType = 'api') {
    const region = this.determineOptimalRegion(location);
    
    const routing = {
      region: region.name.toLowerCase(),
      datacenter: region.datacenter,
      endpoint: region.endpoints[requestType],
      latency: this.calculateEstimatedLatency(location, region),
      priority: region.coverage.priority
    };

    // Add failover regions
    routing.failoverRegions = this.getFailoverRegions(region);

    return routing;
  }

  // Get failover regions in priority order
  getFailoverRegions(primaryRegion) {
    const failovers = [];
    
    for (const [regionId, region] of this.regions) {
      if (region.name !== primaryRegion.name) {
        failovers.push({
          region: region.name.toLowerCase(),
          endpoint: region.endpoints,
          priority: region.coverage.priority
        });
      }
    }

    // Sort by priority (lower number = higher priority)
    return failovers.sort((a, b) => a.priority - b.priority);
  }

  // Calculate estimated latency based on distance
  calculateEstimatedLatency(location, region) {
    if (!location || !location.latitude || !location.longitude) {
      return 50; // Default 50ms
    }

    const distance = geolib.getDistance(
      { latitude: location.latitude, longitude: location.longitude },
      region.coordinates
    );

    // Rough estimation: 1ms per 10km + base latency
    const baseLatency = 10;
    const distanceLatency = Math.round(distance / 10000);
    
    return baseLatency + distanceLatency;
  }

  // Encrypt QR code payload
  encryptQRPayload(payload) {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      
      // Base64 encode for URL safety
      return Buffer.from(combined).toString('base64url');
      
    } catch (error) {
      console.error('Error encrypting QR payload:', error);
      throw new Error('Failed to encrypt QR code payload');
    }
  }

  // Decrypt QR code payload
  decryptQRPayload(encryptedData) {
    try {
      const algorithm = 'aes-256-gcm';
      const combined = Buffer.from(encryptedData, 'base64url').toString('utf8');
      const parts = combined.split(':');
      
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
      
    } catch (error) {
      console.error('Error decrypting QR payload:', error);
      throw new Error('Invalid or corrupted QR code');
    }
  }

  // Validate QR code and location
  validateLocationQR(encryptedPayload, clientLocation) {
    try {
      const payload = this.decryptQRPayload(encryptedPayload);
      
      // Check expiration
      const age = Date.now() - payload.t;
      const maxAge = 7 * 24 * 3600 * 1000; // 1 week
      
      if (age > maxAge) {
        return { valid: false, reason: 'QR code expired' };
      }

      // Validate location proximity (within 500m)
      if (clientLocation && payload.geo) {
        const distance = geolib.getDistance(
          { latitude: clientLocation.latitude, longitude: clientLocation.longitude },
          { latitude: payload.geo.lat, longitude: payload.geo.lng }
        );

        if (distance > 500) { // 500 meters
          return { 
            valid: false, 
            reason: 'Location too far from business',
            distance 
          };
        }
      }

      // Determine current optimal region
      const currentOptimalRegion = this.determineOptimalRegion(payload.geo);
      
      return {
        valid: true,
        payload,
        routing: this.routeRequest(payload.geo),
        regionMatch: currentOptimalRegion.name.toLowerCase() === payload.r,
        locationDistance: clientLocation && payload.geo ? 
          geolib.getDistance(
            { latitude: clientLocation.latitude, longitude: clientLocation.longitude },
            { latitude: payload.geo.lat, longitude: payload.geo.lng }
          ) : null
      };

    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  // Generate location-specific routing rules
  generateRoutingRules(businessId, locations) {
    const rules = {
      businessId,
      locations: [],
      regions: {},
      loadBalancing: {
        strategy: 'proximity',
        failoverEnabled: true,
        healthCheckEnabled: true
      },
      generatedAt: Date.now()
    };

    // Process each location
    for (const location of locations) {
      const optimalRegion = this.determineOptimalRegion(location);
      const routing = this.routeRequest(location);
      
      rules.locations.push({
        locationId: location.id,
        name: location.name,
        coordinates: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        region: optimalRegion.name.toLowerCase(),
        routing,
        qrCodeUrl: `/api/locations/${location.id}/qr`
      });

      // Track regions used
      if (!rules.regions[optimalRegion.name.toLowerCase()]) {
        rules.regions[optimalRegion.name.toLowerCase()] = {
          name: optimalRegion.name,
          datacenter: optimalRegion.datacenter,
          endpoints: optimalRegion.endpoints,
          locations: []
        };
      }
      
      rules.regions[optimalRegion.name.toLowerCase()].locations.push(location.id);
    }

    return rules;
  }

  // Health check for regional endpoints
  async checkRegionalHealth() {
    const healthStatus = {
      timestamp: Date.now(),
      regions: {},
      overall: 'healthy'
    };

    for (const [regionId, region] of this.regions) {
      if (regionId === 'default') continue;

      const regionHealth = {
        region: regionId,
        datacenter: region.datacenter,
        endpoints: {},
        latency: 0,
        status: 'healthy'
      };

      // Check each endpoint
      for (const [endpointType, endpoint] of Object.entries(region.endpoints)) {
        try {
          const startTime = Date.now();
          
          // Simulate health check (replace with actual HTTP check)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
          
          const latency = Date.now() - startTime;
          
          regionHealth.endpoints[endpointType] = {
            endpoint,
            status: 'healthy',
            latency,
            lastCheck: Date.now()
          };
          
          regionHealth.latency += latency;
          
        } catch (error) {
          regionHealth.endpoints[endpointType] = {
            endpoint,
            status: 'unhealthy',
            error: error.message,
            lastCheck: Date.now()
          };
          
          regionHealth.status = 'degraded';
        }
      }

      regionHealth.latency = Math.round(regionHealth.latency / Object.keys(region.endpoints).length);
      healthStatus.regions[regionId] = regionHealth;

      if (regionHealth.status !== 'healthy') {
        healthStatus.overall = 'degraded';
      }
    }

    return healthStatus;
  }

  // Clear caches
  clearCache() {
    this.locationCache.clear();
    this.qrCodeCache.clear();
  }

  // Get region statistics
  getRegionStatistics() {
    const stats = {
      totalRegions: this.regions.size - 1, // Exclude default
      cacheSize: {
        locations: this.locationCache.size,
        qrCodes: this.qrCodeCache.size
      },
      regions: {}
    };

    for (const [regionId, region] of this.regions) {
      if (regionId === 'default') continue;
      
      stats.regions[regionId] = {
        name: region.name,
        datacenter: region.datacenter,
        coverage: region.coverage,
        coordinates: region.coordinates
      };
    }

    return stats;
  }
}

module.exports = LocationRoutingService;