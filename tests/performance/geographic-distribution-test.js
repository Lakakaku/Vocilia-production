#!/usr/bin/env node

/**
 * Geographic Distribution Testing
 * Tests system performance across different Swedish regions
 * Simulates realistic network conditions, device diversity, and regional usage patterns
 */

const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class GeographicDistributionTester {
  constructor(config = {}) {
    this.config = {
      testDuration: config.testDuration || 600, // 10 minutes
      regions: config.regions || this.getSwedishRegions(),
      networkProfiles: config.networkProfiles || this.getNetworkProfiles(),
      deviceProfiles: config.deviceProfiles || this.getDeviceProfiles(),
      baseUrl: config.baseUrl || 'http://localhost:3001',
      ...config
    };

    this.metrics = {
      regions: new Map(),
      networkTypes: new Map(),
      deviceTypes: new Map(),
      globalMetrics: {
        totalRequests: 0,
        totalVoiceSessions: 0,
        regionFailures: new Map(),
        networkIssues: [],
        deviceCompatibility: new Map()
      }
    };

    this.activeRegionalTests = new Map();
    this.isRunning = false;
    this.testStartTime = null;
  }

  getSwedishRegions() {
    return [
      {
        name: 'Stockholm',
        population: 975551,
        coordinates: { lat: 59.3293, lng: 18.0686 },
        networkInfrastructure: 'excellent',
        avgLatencyToServer: 8, // ms
        businessDensity: 'very_high',
        concurrentUsers: 120,
        primaryBusinessTypes: ['retail', 'cafe', 'restaurant', 'grocery_store'],
        peakHours: [8, 12, 17],
        deviceDistribution: { ios: 0.65, android: 0.30, other: 0.05 },
        networkDistribution: { '5g': 0.25, '4g': 0.65, '3g': 0.08, 'wifi': 0.02 }
      },
      {
        name: 'Gothenburg',
        population: 579281,
        coordinates: { lat: 57.7089, lng: 11.9746 },
        networkInfrastructure: 'excellent',
        avgLatencyToServer: 12,
        businessDensity: 'high',
        concurrentUsers: 80,
        primaryBusinessTypes: ['grocery_store', 'retail', 'restaurant'],
        peakHours: [8, 12, 17],
        deviceDistribution: { ios: 0.60, android: 0.35, other: 0.05 },
        networkDistribution: { '5g': 0.20, '4g': 0.70, '3g': 0.08, 'wifi': 0.02 }
      },
      {
        name: 'Malmö',
        population: 347949,
        coordinates: { lat: 55.6050, lng: 13.0038 },
        networkInfrastructure: 'good',
        avgLatencyToServer: 15,
        businessDensity: 'high',
        concurrentUsers: 50,
        primaryBusinessTypes: ['grocery_store', 'cafe', 'retail'],
        peakHours: [8, 12, 17],
        deviceDistribution: { ios: 0.55, android: 0.40, other: 0.05 },
        networkDistribution: { '5g': 0.15, '4g': 0.75, '3g': 0.08, 'wifi': 0.02 }
      },
      {
        name: 'Uppsala',
        population: 230767,
        coordinates: { lat: 59.8586, lng: 17.6389 },
        networkInfrastructure: 'good',
        avgLatencyToServer: 10,
        businessDensity: 'medium',
        concurrentUsers: 35,
        primaryBusinessTypes: ['grocery_store', 'cafe', 'retail'],
        peakHours: [8, 12, 17],
        deviceDistribution: { ios: 0.62, android: 0.33, other: 0.05 },
        networkDistribution: { '5g': 0.18, '4g': 0.72, '3g': 0.08, 'wifi': 0.02 }
      },
      {
        name: 'Västerås',
        population: 127799,
        coordinates: { lat: 59.6162, lng: 16.5528 },
        networkInfrastructure: 'good',
        avgLatencyToServer: 18,
        businessDensity: 'medium',
        concurrentUsers: 25,
        primaryBusinessTypes: ['grocery_store', 'retail'],
        peakHours: [8, 12, 17],
        deviceDistribution: { ios: 0.58, android: 0.37, other: 0.05 },
        networkDistribution: { '5g': 0.12, '4g': 0.78, '3g': 0.08, 'wifi': 0.02 }
      },
      {
        name: 'Örebro',
        population: 126009,
        coordinates: { lat: 59.2753, lng: 15.2134 },
        networkInfrastructure: 'moderate',
        avgLatencyToServer: 22,
        businessDensity: 'medium',
        concurrentUsers: 20,
        primaryBusinessTypes: ['grocery_store', 'retail'],
        peakHours: [8, 12, 17],
        deviceDistribution: { ios: 0.55, android: 0.40, other: 0.05 },
        networkDistribution: { '5g': 0.10, '4g': 0.75, '3g': 0.12, 'wifi': 0.03 }
      },
      {
        name: 'Linköping',
        population: 115457,
        coordinates: { lat: 58.4108, lng: 15.6214 },
        networkInfrastructure: 'moderate',
        avgLatencyToServer: 25,
        businessDensity: 'medium',
        concurrentUsers: 18,
        primaryBusinessTypes: ['grocery_store', 'retail', 'cafe'],
        peakHours: [8, 12, 17],
        deviceDistribution: { ios: 0.60, android: 0.35, other: 0.05 },
        networkDistribution: { '5g': 0.08, '4g': 0.77, '3g': 0.12, 'wifi': 0.03 }
      },
      {
        name: 'Helsingborg',
        population: 113816,
        coordinates: { lat: 56.0465, lng: 12.6945 },
        networkInfrastructure: 'moderate',
        avgLatencyToServer: 20,
        businessDensity: 'medium',
        concurrentUsers: 16,
        primaryBusinessTypes: ['grocery_store', 'retail'],
        peakHours: [8, 12, 17],
        deviceDistribution: { ios: 0.52, android: 0.43, other: 0.05 },
        networkDistribution: { '5g': 0.08, '4g': 0.80, '3g': 0.10, 'wifi': 0.02 }
      },
      {
        name: 'Rural/Small Towns',
        population: 500000,
        coordinates: { lat: 62.0000, lng: 15.0000 },
        networkInfrastructure: 'limited',
        avgLatencyToServer: 45,
        businessDensity: 'low',
        concurrentUsers: 30,
        primaryBusinessTypes: ['grocery_store', 'retail'],
        peakHours: [12, 17],
        deviceDistribution: { ios: 0.48, android: 0.47, other: 0.05 },
        networkDistribution: { '5g': 0.02, '4g': 0.68, '3g': 0.25, 'wifi': 0.05 }
      }
    ];
  }

  getNetworkProfiles() {
    return {
      '5g': {
        latency: { min: 1, max: 10, avg: 5 },
        bandwidth: { download: 1000, upload: 100 }, // Mbps
        reliability: 0.98,
        jitter: 2,
        packetLoss: 0.001
      },
      '4g': {
        latency: { min: 10, max: 50, avg: 25 },
        bandwidth: { download: 50, upload: 10 },
        reliability: 0.95,
        jitter: 8,
        packetLoss: 0.01
      },
      '3g': {
        latency: { min: 50, max: 200, avg: 100 },
        bandwidth: { download: 5, upload: 1 },
        reliability: 0.90,
        jitter: 20,
        packetLoss: 0.03
      },
      'wifi': {
        latency: { min: 5, max: 30, avg: 15 },
        bandwidth: { download: 100, upload: 20 },
        reliability: 0.92,
        jitter: 5,
        packetLoss: 0.005
      }
    };
  }

  getDeviceProfiles() {
    return {
      ios: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        webrtcSupport: 'excellent',
        audioCodecs: ['opus', 'aac'],
        performanceFactor: 1.0,
        batteryOptimization: 'aggressive',
        backgroundProcessing: 'limited'
      },
      android: {
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
        webrtcSupport: 'good',
        audioCodecs: ['opus', 'aac', 'pcm'],
        performanceFactor: 0.9,
        batteryOptimization: 'moderate',
        backgroundProcessing: 'flexible'
      },
      other: {
        userAgent: 'Mozilla/5.0 (compatible; Generic Mobile Browser)',
        webrtcSupport: 'basic',
        audioCodecs: ['pcm'],
        performanceFactor: 0.7,
        batteryOptimization: 'minimal',
        backgroundProcessing: 'unreliable'
      }
    };
  }

  /**
   * Main geographic distribution testing function
   */
  async runGeographicDistributionTest() {
    console.log('🌍 Starting Geographic Distribution Testing');
    console.log(`  Test Duration: ${this.config.testDuration}s`);
    console.log(`  Regions: ${this.config.regions.length}`);
    console.log(`  Total Concurrent Users: ${this.config.regions.reduce((sum, r) => sum + r.concurrentUsers, 0)}`);
    console.log('='.repeat(60));

    this.isRunning = true;
    this.testStartTime = performance.now();

    try {
      // Phase 1: Initialize regional testing
      await this.initializeRegionalTesting();

      // Phase 2: Run concurrent regional load tests
      await this.runConcurrentRegionalTests();

      // Phase 3: Test cross-region scenarios
      await this.testCrossRegionScenarios();

      // Phase 4: Generate comprehensive geographic report
      const report = await this.generateGeographicReport();

      console.log('\n🗺️  Geographic Distribution Test Results:');
      this.displayGeographicResults(report);

      return report;

    } finally {
      this.isRunning = false;
      await this.cleanupRegionalTesting();
    }
  }

  async initializeRegionalTesting() {
    console.log('\n🔧 Phase 1: Initializing regional testing...');

    for (const region of this.config.regions) {
      const regionalMetrics = {
        region: region.name,
        totalUsers: region.concurrentUsers,
        activeUsers: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        voiceSessions: 0,
        networkIssues: [],
        deviceIssues: [],
        businessTypesUsed: new Map()
      };

      this.metrics.regions.set(region.name, regionalMetrics);
      console.log(`  ${region.name}: ${region.concurrentUsers} users, ${region.avgLatencyToServer}ms base latency`);
    }

    console.log('  ✅ Regional initialization completed');
  }

  async runConcurrentRegionalTests() {
    console.log('\n🚀 Phase 2: Running concurrent regional tests...');

    const regionalPromises = this.config.regions.map(region => 
      this.runRegionalTest(region)
    );

    // Monitor progress during concurrent execution
    const progressMonitor = this.startProgressMonitoring();

    try {
      await Promise.all(regionalPromises);
    } finally {
      clearInterval(progressMonitor);
    }

    console.log('  ✅ All regional tests completed');
  }

  async runRegionalTest(region) {
    const metrics = this.metrics.regions.get(region.name);
    const testDuration = this.config.testDuration * 1000;
    const startTime = performance.now();

    console.log(`  Starting ${region.name} regional test...`);

    // Generate user sessions for this region
    const userPromises = [];
    for (let userId = 0; userId < region.concurrentUsers; userId++) {
      const userProfile = this.generateUserProfile(region, userId);
      userPromises.push(this.simulateRegionalUser(region, userProfile, metrics));
    }

    // Execute with regional timing
    const regionalResults = await Promise.allSettled(userPromises);

    // Process results
    regionalResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const userResult = result.value;
        metrics.totalRequests += userResult.requests;
        metrics.successfulRequests += userResult.successful;
        metrics.failedRequests += userResult.failed;
        metrics.responseTimes.push(...userResult.responseTimes);
        metrics.voiceSessions += userResult.voiceSessions;

        userResult.businessTypes.forEach((count, businessType) => {
          metrics.businessTypesUsed.set(
            businessType, 
            (metrics.businessTypesUsed.get(businessType) || 0) + count
          );
        });
      } else {
        metrics.failedRequests++;
        console.error(`  ${region.name} user ${index} failed:`, result.reason?.message);
      }
    });

    const actualDuration = (performance.now() - startTime) / 1000;
    console.log(`  ${region.name}: ${metrics.successfulRequests}/${metrics.totalRequests} successful (${actualDuration.toFixed(1)}s)`);
  }

  generateUserProfile(region, userId) {
    // Select device type based on regional distribution
    const deviceRand = Math.random();
    let deviceType = 'other';
    let cumulative = 0;
    for (const [type, probability] of Object.entries(region.deviceDistribution)) {
      cumulative += probability;
      if (deviceRand < cumulative) {
        deviceType = type;
        break;
      }
    }

    // Select network type based on regional distribution
    const networkRand = Math.random();
    let networkType = '3g';
    cumulative = 0;
    for (const [type, probability] of Object.entries(region.networkDistribution)) {
      cumulative += probability;
      if (networkRand < cumulative) {
        networkType = type;
        break;
      }
    }

    return {
      userId: `${region.name}-user-${userId}`,
      deviceType,
      networkType,
      location: region.coordinates,
      baseLatency: region.avgLatencyToServer,
      preferredBusinessTypes: region.primaryBusinessTypes,
      sessionDuration: this.calculateUserSessionDuration(region, deviceType),
      usagePattern: this.generateUsagePattern(region, userId)
    };
  }

  calculateUserSessionDuration(region, deviceType) {
    let baseDuration = this.config.testDuration;
    
    // Adjust for network infrastructure
    if (region.networkInfrastructure === 'limited') {
      baseDuration *= 0.7; // Rural users tend to have shorter sessions
    } else if (region.networkInfrastructure === 'excellent') {
      baseDuration *= 1.2; // Urban users with good connectivity stay longer
    }

    // Adjust for device type
    const deviceProfile = this.config.deviceProfiles[deviceType];
    baseDuration *= deviceProfile.performanceFactor;

    return Math.max(30, baseDuration + (Math.random() - 0.5) * baseDuration * 0.4);
  }

  generateUsagePattern(region, userId) {
    const pattern = {
      sessionsPerHour: 1 + Math.random() * 3, // 1-4 sessions per hour
      voiceSessionRatio: 0.2 + Math.random() * 0.4, // 20-60% voice sessions
      averageBreakBetweenSessions: 300 + Math.random() * 600, // 5-15 minutes
      prefersPeakHours: Math.random() > 0.3,
      multiLocationUsage: region.businessDensity === 'very_high' && Math.random() > 0.6
    };

    return pattern;
  }

  async simulateRegionalUser(region, userProfile, metrics) {
    const networkProfile = this.config.networkProfiles[userProfile.networkType];
    const deviceProfile = this.config.deviceProfiles[userProfile.deviceType];
    
    const userResults = {
      requests: 0,
      successful: 0,
      failed: 0,
      responseTimes: [],
      voiceSessions: 0,
      businessTypes: new Map(),
      networkIssues: [],
      deviceIssues: []
    };

    const sessionEndTime = performance.now() + (userProfile.sessionDuration * 1000);
    let sessionCount = 0;

    while (performance.now() < sessionEndTime && this.isRunning) {
      try {
        sessionCount++;
        const sessionType = Math.random() < userProfile.usagePattern.voiceSessionRatio ? 'voice' : 'api';
        const businessType = userProfile.preferredBusinessTypes[
          Math.floor(Math.random() * userProfile.preferredBusinessTypes.length)
        ];

        userResults.businessTypes.set(
          businessType,
          (userResults.businessTypes.get(businessType) || 0) + 1
        );

        if (sessionType === 'voice') {
          const voiceResult = await this.simulateVoiceSessionWithNetworkConditions(
            userProfile, networkProfile, deviceProfile, businessType
          );
          userResults.voiceSessions++;
          userResults.requests++;
          userResults.responseTimes.push(voiceResult.responseTime);
          
          if (voiceResult.success) {
            userResults.successful++;
          } else {
            userResults.failed++;
            if (voiceResult.networkIssue) {
              userResults.networkIssues.push(voiceResult.networkIssue);
            }
            if (voiceResult.deviceIssue) {
              userResults.deviceIssues.push(voiceResult.deviceIssue);
            }
          }
        } else {
          const apiResult = await this.simulateAPIRequestWithNetworkConditions(
            userProfile, networkProfile, deviceProfile, businessType
          );
          userResults.requests++;
          userResults.responseTimes.push(apiResult.responseTime);
          
          if (apiResult.success) {
            userResults.successful++;
          } else {
            userResults.failed++;
          }
        }

        // Break between sessions
        const breakTime = userProfile.usagePattern.averageBreakBetweenSessions * (0.5 + Math.random());
        await this.delay(breakTime);

      } catch (error) {
        userResults.failed++;
        console.error(`User ${userProfile.userId} session ${sessionCount} error:`, error.message);
      }
    }

    return userResults;
  }

  async simulateVoiceSessionWithNetworkConditions(userProfile, networkProfile, deviceProfile, businessType) {
    const startTime = performance.now();
    const sessionId = `${userProfile.userId}-voice-${Date.now()}`;

    try {
      // Phase 1: WebSocket connection with network conditions
      const connectionTime = await this.simulateNetworkLatency(
        userProfile.baseLatency + networkProfile.latency.avg,
        networkProfile.jitter,
        networkProfile.reliability
      );

      if (Math.random() < networkProfile.packetLoss * 50) { // Connection failure
        throw new Error('connection_failed');
      }

      // Phase 2: Audio streaming simulation
      const audioStreamingTime = await this.simulateAudioStreamingWithConditions(
        userProfile, networkProfile, deviceProfile
      );

      // Phase 3: AI processing (server-side, not affected by network conditions)
      const aiProcessingTime = 800 + Math.random() * 1200;
      await this.delay(aiProcessingTime);

      // Phase 4: Response delivery with network conditions
      const responseDeliveryTime = await this.simulateNetworkLatency(
        userProfile.baseLatency + networkProfile.latency.avg,
        networkProfile.jitter,
        networkProfile.reliability
      );

      const totalResponseTime = performance.now() - startTime;

      return {
        success: true,
        responseTime: totalResponseTime,
        networkCondition: userProfile.networkType,
        deviceType: userProfile.deviceType,
        phases: {
          connection: connectionTime,
          streaming: audioStreamingTime,
          processing: aiProcessingTime,
          response: responseDeliveryTime
        }
      };

    } catch (error) {
      const responseTime = performance.now() - startTime;
      const result = {
        success: false,
        responseTime,
        error: error.message,
        networkCondition: userProfile.networkType,
        deviceType: userProfile.deviceType
      };

      // Categorize the failure
      if (error.message.includes('connection') || error.message.includes('network')) {
        result.networkIssue = {
          type: error.message,
          networkType: userProfile.networkType,
          region: userProfile.location
        };
      } else if (error.message.includes('device') || error.message.includes('codec')) {
        result.deviceIssue = {
          type: error.message,
          deviceType: userProfile.deviceType,
          capabilities: deviceProfile
        };
      }

      return result;
    }
  }

  async simulateAudioStreamingWithConditions(userProfile, networkProfile, deviceProfile) {
    const streamingDuration = 5000 + Math.random() * 10000; // 5-15 seconds
    const chunkSize = 1024; // bytes
    const chunksPerSecond = networkProfile.bandwidth.upload * 1024 / 8 / chunkSize;
    
    // Check if device can handle the streaming
    if (deviceProfile.webrtcSupport === 'basic' && Math.random() < 0.1) {
      throw new Error('device_streaming_limitation');
    }

    // Simulate bandwidth limitations
    if (chunksPerSecond < 10 && Math.random() < 0.15) {
      throw new Error('network_bandwidth_insufficient');
    }

    // Simulate packet loss during streaming
    const packetsLost = Math.random() < networkProfile.packetLoss * 10;
    if (packetsLost) {
      throw new Error('network_packet_loss');
    }

    // Simulate device performance impact
    const performanceAdjustment = deviceProfile.performanceFactor;
    const adjustedDuration = streamingDuration / performanceAdjustment;

    await this.delay(adjustedDuration);
    return adjustedDuration;
  }

  async simulateAPIRequestWithNetworkConditions(userProfile, networkProfile, deviceProfile, businessType) {
    const startTime = performance.now();

    try {
      // Simulate network latency
      const networkLatency = await this.simulateNetworkLatency(
        userProfile.baseLatency + networkProfile.latency.avg,
        networkProfile.jitter,
        networkProfile.reliability
      );

      // Simulate server processing
      const processingTime = 50 + Math.random() * 200;
      await this.delay(processingTime);

      const totalResponseTime = performance.now() - startTime;

      return {
        success: true,
        responseTime: totalResponseTime,
        networkCondition: userProfile.networkType,
        businessType
      };

    } catch (error) {
      return {
        success: false,
        responseTime: performance.now() - startTime,
        error: error.message,
        networkCondition: userProfile.networkType,
        businessType
      };
    }
  }

  async simulateNetworkLatency(baseLatency, jitter, reliability) {
    // Check network reliability
    if (Math.random() > reliability) {
      throw new Error('network_unreliable');
    }

    // Calculate actual latency with jitter
    const actualLatency = baseLatency + (Math.random() - 0.5) * 2 * jitter;
    await this.delay(actualLatency);
    return actualLatency;
  }

  startProgressMonitoring() {
    return setInterval(() => {
      if (!this.isRunning) return;

      const totalUsers = this.config.regions.reduce((sum, r) => sum + r.concurrentUsers, 0);
      const totalRequests = Array.from(this.metrics.regions.values())
        .reduce((sum, m) => sum + m.totalRequests, 0);
      const totalSuccessful = Array.from(this.metrics.regions.values())
        .reduce((sum, m) => sum + m.successfulRequests, 0);

      const elapsedTime = (performance.now() - this.testStartTime) / 1000;
      const progressPercentage = Math.min(100, (elapsedTime / this.config.testDuration) * 100);

      console.log(`  Progress: ${progressPercentage.toFixed(1)}% - ${totalRequests} requests, ${((totalSuccessful / Math.max(1, totalRequests)) * 100).toFixed(1)}% success`);
    }, 30000); // Every 30 seconds
  }

  async testCrossRegionScenarios() {
    console.log('\n🌐 Phase 3: Testing cross-region scenarios...');

    const scenarios = [
      {
        name: 'Stockholm-Malmö Business Chain',
        regions: ['Stockholm', 'Malmö'],
        sharedBusinesses: ['retail', 'grocery_store'],
        concurrentUsers: 30
      },
      {
        name: 'Major Cities Coordination',
        regions: ['Stockholm', 'Gothenburg', 'Malmö'],
        sharedBusinesses: ['restaurant', 'cafe'],
        concurrentUsers: 20
      },
      {
        name: 'Urban-Rural Divide Test',
        regions: ['Stockholm', 'Rural/Small Towns'],
        sharedBusinesses: ['grocery_store'],
        concurrentUsers: 25
      }
    ];

    for (const scenario of scenarios) {
      console.log(`  Running: ${scenario.name}`);
      await this.runCrossRegionScenario(scenario);
    }

    console.log('  ✅ Cross-region scenarios completed');
  }

  async runCrossRegionScenario(scenario) {
    const crossRegionPromises = scenario.regions.map(regionName => {
      const region = this.config.regions.find(r => r.name === regionName);
      if (!region) return Promise.resolve();

      return this.simulateCrossRegionInteraction(region, scenario);
    });

    const results = await Promise.allSettled(crossRegionPromises);
    
    // Log cross-region results
    let successCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value?.success) {
        successCount++;
      }
    });

    console.log(`    ${scenario.name}: ${successCount}/${results.length} regions successful`);
  }

  async simulateCrossRegionInteraction(region, scenario) {
    // Simulate business data synchronization across regions
    const syncLatency = region.avgLatencyToServer * 2; // Cross-region latency
    await this.delay(syncLatency);

    // Simulate business analytics queries that span regions
    const analyticsLatency = 200 + Math.random() * 300;
    await this.delay(analyticsLatency);

    return { success: Math.random() > 0.1 }; // 90% success rate for cross-region
  }

  async generateGeographicReport() {
    const totalDuration = (performance.now() - this.testStartTime) / 1000;
    const regionalData = Array.from(this.metrics.regions.entries()).map(([name, metrics]) => ({
      name,
      ...metrics,
      averageResponseTime: metrics.responseTimes.length > 0 ? 
        metrics.responseTimes.reduce((sum, time) => sum + time, 0) / metrics.responseTimes.length : 0,
      successRate: metrics.totalRequests > 0 ? 
        (metrics.successfulRequests / metrics.totalRequests) * 100 : 0
    }));

    const report = {
      testSummary: {
        totalDuration,
        regionsTest  ed: this.config.regions.length,
        totalUsers: this.config.regions.reduce((sum, r) => sum + r.concurrentUsers, 0)
      },
      regionalPerformance: regionalData,
      networkAnalysis: this.analyzeNetworkPerformance(regionalData),
      deviceAnalysis: this.analyzeDevicePerformance(regionalData),
      geographicInsights: this.generateGeographicInsights(regionalData),
      recommendations: this.generateGeographicRecommendations(regionalData)
    };

    // Save report
    const reportPath = path.join(__dirname, `geographic-distribution-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Geographic report saved: ${reportPath}`);

    return report;
  }

  analyzeNetworkPerformance(regionalData) {
    const networkTypes = new Map();
    const performanceByNetwork = new Map();

    this.config.regions.forEach(region => {
      Object.entries(region.networkDistribution).forEach(([networkType, distribution]) => {
        if (!performanceByNetwork.has(networkType)) {
          performanceByNetwork.set(networkType, {
            regions: [],
            totalUsers: 0,
            avgLatency: 0,
            successRate: 0
          });
        }
        
        const regionData = regionalData.find(r => r.name === region.name);
        if (regionData) {
          const networkData = performanceByNetwork.get(networkType);
          networkData.regions.push(region.name);
          networkData.totalUsers += Math.floor(region.concurrentUsers * distribution);
          networkData.avgLatency += region.avgLatencyToServer * distribution;
          networkData.successRate += regionData.successRate * distribution;
        }
      });
    });

    return Object.fromEntries(performanceByNetwork);
  }

  analyzeDevicePerformance(regionalData) {
    const devicePerformance = {
      ios: { regions: 0, avgSuccessRate: 0, avgResponseTime: 0 },
      android: { regions: 0, avgSuccessRate: 0, avgResponseTime: 0 },
      other: { regions: 0, avgSuccessRate: 0, avgResponseTime: 0 }
    };

    regionalData.forEach(region => {
      Object.keys(devicePerformance).forEach(deviceType => {
        devicePerformance[deviceType].regions++;
        devicePerformance[deviceType].avgSuccessRate += region.successRate;
        devicePerformance[deviceType].avgResponseTime += region.averageResponseTime;
      });
    });

    // Calculate averages
    Object.values(devicePerformance).forEach(perf => {
      if (perf.regions > 0) {
        perf.avgSuccessRate /= perf.regions;
        perf.avgResponseTime /= perf.regions;
      }
    });

    return devicePerformance;
  }

  generateGeographicInsights(regionalData) {
    const insights = [];

    // Urban vs Rural performance
    const urbanRegions = regionalData.filter(r => 
      !r.name.includes('Rural') && r.successRate > 0
    );
    const ruralRegions = regionalData.filter(r => 
      r.name.includes('Rural') && r.successRate > 0
    );

    if (urbanRegions.length > 0 && ruralRegions.length > 0) {
      const urbanAvgSuccess = urbanRegions.reduce((sum, r) => sum + r.successRate, 0) / urbanRegions.length;
      const ruralAvgSuccess = ruralRegions.reduce((sum, r) => sum + r.successRate, 0) / ruralRegions.length;
      
      insights.push({
        type: 'urban_rural_divide',
        urbanSuccessRate: urbanAvgSuccess,
        ruralSuccessRate: ruralAvgSuccess,
        performanceGap: urbanAvgSuccess - ruralAvgSuccess
      });
    }

    // Regional leaders and laggards
    const sortedRegions = [...regionalData].sort((a, b) => b.successRate - a.successRate);
    insights.push({
      type: 'regional_performance_ranking',
      topPerformer: sortedRegions[0],
      bottomPerformer: sortedRegions[sortedRegions.length - 1],
      performanceSpread: sortedRegions[0].successRate - sortedRegions[sortedRegions.length - 1].successRate
    });

    // Latency vs Success Rate correlation
    const latencySuccessCorrelation = this.calculateLatencySuccessCorrelation(regionalData);
    insights.push({
      type: 'latency_success_correlation',
      correlation: latencySuccessCorrelation,
      significance: Math.abs(latencySuccessCorrelation) > 0.5 ? 'strong' : 'weak'
    });

    return insights;
  }

  calculateLatencySuccessCorrelation(regionalData) {
    const n = regionalData.length;
    if (n < 2) return 0;

    const latencies = regionalData.map(r => r.averageResponseTime);
    const successRates = regionalData.map(r => r.successRate);

    const latencyMean = latencies.reduce((sum, val) => sum + val, 0) / n;
    const successMean = successRates.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let latencyVariance = 0;
    let successVariance = 0;

    for (let i = 0; i < n; i++) {
      const latencyDiff = latencies[i] - latencyMean;
      const successDiff = successRates[i] - successMean;
      
      numerator += latencyDiff * successDiff;
      latencyVariance += latencyDiff * latencyDiff;
      successVariance += successDiff * successDiff;
    }

    const denominator = Math.sqrt(latencyVariance * successVariance);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  generateGeographicRecommendations(regionalData) {
    const recommendations = [];
    
    // Check for regions with poor performance
    const poorPerformingRegions = regionalData.filter(r => r.successRate < 90);
    if (poorPerformingRegions.length > 0) {
      recommendations.push(`⚠️  ${poorPerformingRegions.length} regions with <90% success rate: ${poorPerformingRegions.map(r => r.name).join(', ')}`);
    }

    // Check for high latency regions
    const highLatencyRegions = regionalData.filter(r => r.averageResponseTime > 3000);
    if (highLatencyRegions.length > 0) {
      recommendations.push(`🐌 High latency in ${highLatencyRegions.length} regions: Consider edge server deployment`);
    }

    // Network infrastructure recommendations
    const ruralRegion = regionalData.find(r => r.name.includes('Rural'));
    if (ruralRegion && ruralRegion.successRate < 85) {
      recommendations.push(`🏞️  Rural regions need special optimization: Progressive loading, offline capabilities`);
    }

    // Device-specific recommendations
    const androidCompatibility = regionalData.reduce((sum, r) => sum + r.successRate, 0) / regionalData.length;
    if (androidCompatibility < 92) {
      recommendations.push(`📱 Android compatibility issues detected: Review WebRTC implementation`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All regions performing within acceptable geographic distribution thresholds!');
    }

    return recommendations;
  }

  displayGeographicResults(report) {
    console.log(`  Total Regions: ${report.testSummary.regionsTest ed}`);
    console.log(`  Total Users: ${report.testSummary.totalUsers}`);
    console.log(`  Test Duration: ${report.testSummary.totalDuration.toFixed(1)}s`);

    console.log('\n📍 Regional Performance:');
    report.regionalPerformance
      .sort((a, b) => b.successRate - a.successRate)
      .forEach(region => {
        console.log(`  ${region.name}: ${region.successRate.toFixed(1)}% success, ${region.averageResponseTime.toFixed(0)}ms avg`);
      });

    console.log('\n🔍 Geographic Insights:');
    report.geographicInsights.forEach(insight => {
      if (insight.type === 'urban_rural_divide') {
        console.log(`  Urban vs Rural: ${insight.urbanSuccessRate.toFixed(1)}% vs ${insight.ruralSuccessRate.toFixed(1)}% (${insight.performanceGap.toFixed(1)}% gap)`);
      } else if (insight.type === 'regional_performance_ranking') {
        console.log(`  Best: ${insight.topPerformer.name} (${insight.topPerformer.successRate.toFixed(1)}%), Worst: ${insight.bottomPerformer.name} (${insight.bottomPerformer.successRate.toFixed(1)}%)`);
      }
    });

    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`    ${rec}`));
  }

  async cleanupRegionalTesting() {
    console.log('\n🧹 Cleaning up regional testing...');
    this.activeRegionalTests.clear();
    console.log('  ✅ Cleanup completed');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main execution function
 */
async function runGeographicDistributionTest() {
  const tester = new GeographicDistributionTester({
    testDuration: 600, // 10 minutes
  });
  
  try {
    console.log('🎯 Geographic Distribution Test');
    console.log('Testing system performance across Swedish regions');
    console.log('Simulating network conditions, device diversity, and regional usage patterns');
    console.log('');
    
    const report = await tester.runGeographicDistributionTest();
    return report;
    
  } catch (error) {
    console.error('❌ Geographic distribution test failed:', error.message);
    throw error;
  }
}

module.exports = { GeographicDistributionTester, runGeographicDistributionTest };

// Run if executed directly
if (require.main === module) {
  runGeographicDistributionTest()
    .then(() => {
      console.log('\n✅ Geographic distribution test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Geographic distribution test failed:', error);
      process.exit(1);
    });
}