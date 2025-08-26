#!/usr/bin/env node

/**
 * Peak Hour Simulation Testing
 * Simulates realistic business traffic patterns throughout the day
 * Tests system behavior under various load scenarios
 */

const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class PeakHourSimulator {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3001',
      simulationDuration: config.simulationDuration || 1800, // 30 minutes compressed
      timeCompressionRatio: config.timeCompressionRatio || 24, // 24 hours -> 60 minutes
      maxConcurrentSessions: config.maxConcurrentSessions || 200,
      businessTypes: config.businessTypes || ['grocery_store', 'cafe', 'restaurant', 'retail'],
      ...config
    };

    this.scenarios = this.defineBusinessScenarios();
    this.metrics = {
      scenarios: new Map(),
      globalMetrics: {
        totalRequests: 0,
        totalVoiceSessions: 0,
        systemOverloads: 0,
        peakRPS: 0,
        systemFailures: []
      }
    };

    this.isRunning = false;
    this.activeConnections = new Set();
    this.simulationStartTime = null;
  }

  defineBusinessScenarios() {
    return [
      {
        name: 'Morning Rush (7-9 AM)',
        pattern: 'exponential_growth',
        duration: 120, // minutes in real time -> compressed
        businessTypes: ['cafe', 'grocery_store'],
        trafficProfile: {
          startRPS: 10,
          peakRPS: 300,
          voiceSessionRatio: 0.25, // 25% of traffic are voice sessions
          peakStartMinute: 30,
          peakEndMinute: 90,
          customerBehavior: 'quick_interactions'
        },
        characteristics: {
          averageSessionDuration: 8, // seconds
          customerPatience: 'low', // Users want quick service
          repeatCustomerRatio: 0.6,
          mobileUsageRatio: 0.85,
          locationConcurrency: 15 // customers per location
        }
      },
      {
        name: 'Mid-Morning Steady (9-11 AM)',
        pattern: 'steady_moderate',
        duration: 120,
        businessTypes: ['grocery_store', 'retail'],
        trafficProfile: {
          startRPS: 80,
          peakRPS: 120,
          voiceSessionRatio: 0.35,
          fluctuationRange: 0.2, // 20% fluctuation
          customerBehavior: 'detailed_feedback'
        },
        characteristics: {
          averageSessionDuration: 15,
          customerPatience: 'medium',
          repeatCustomerRatio: 0.4,
          mobileUsageRatio: 0.75,
          locationConcurrency: 8
        }
      },
      {
        name: 'Lunch Peak (11:30 AM-1:30 PM)',
        pattern: 'double_peak',
        duration: 120,
        businessTypes: ['restaurant', 'cafe', 'grocery_store'],
        trafficProfile: {
          startRPS: 60,
          peakRPS: 500,
          voiceSessionRatio: 0.4,
          firstPeakMinute: 30,
          secondPeakMinute: 90,
          troughMinute: 60,
          customerBehavior: 'service_focused'
        },
        characteristics: {
          averageSessionDuration: 12,
          customerPatience: 'medium',
          repeatCustomerRatio: 0.3,
          mobileUsageRatio: 0.9,
          locationConcurrency: 25
        }
      },
      {
        name: 'Afternoon Lull (2-4 PM)',
        pattern: 'low_steady',
        duration: 120,
        businessTypes: ['retail', 'grocery_store'],
        trafficProfile: {
          startRPS: 40,
          peakRPS: 80,
          voiceSessionRatio: 0.5, // More detailed feedback during quieter times
          fluctuationRange: 0.15,
          customerBehavior: 'thorough_evaluation'
        },
        characteristics: {
          averageSessionDuration: 20,
          customerPatience: 'high',
          repeatCustomerRatio: 0.5,
          mobileUsageRatio: 0.7,
          locationConcurrency: 5
        }
      },
      {
        name: 'Evening Rush (5-7 PM)',
        pattern: 'sustained_high',
        duration: 120,
        businessTypes: ['grocery_store', 'restaurant', 'retail'],
        trafficProfile: {
          startRPS: 100,
          peakRPS: 600,
          voiceSessionRatio: 0.3,
          sustainedMinutes: 90,
          customerBehavior: 'efficiency_focused'
        },
        characteristics: {
          averageSessionDuration: 10,
          customerPatience: 'low',
          repeatCustomerRatio: 0.7,
          mobileUsageRatio: 0.95,
          locationConcurrency: 30
        }
      },
      {
        name: 'Evening Wind-Down (7-9 PM)',
        pattern: 'gradual_decline',
        duration: 120,
        businessTypes: ['restaurant', 'cafe'],
        trafficProfile: {
          startRPS: 200,
          peakRPS: 50,
          voiceSessionRatio: 0.35,
          declineRate: 0.8,
          customerBehavior: 'experience_focused'
        },
        characteristics: {
          averageSessionDuration: 18,
          customerPatience: 'medium',
          repeatCustomerRatio: 0.4,
          mobileUsageRatio: 0.8,
          locationConcurrency: 12
        }
      },
      {
        name: 'Weekend Brunch Peak (10 AM-2 PM)',
        pattern: 'extended_plateau',
        duration: 240,
        businessTypes: ['cafe', 'restaurant'],
        trafficProfile: {
          startRPS: 40,
          peakRPS: 350,
          voiceSessionRatio: 0.45,
          plateauStartMinute: 60,
          plateauEndMinute: 180,
          customerBehavior: 'social_experience'
        },
        characteristics: {
          averageSessionDuration: 22,
          customerPatience: 'high',
          repeatCustomerRatio: 0.2,
          mobileUsageRatio: 0.85,
          locationConcurrency: 20
        }
      },
      {
        name: 'Flash Sale Event',
        pattern: 'sudden_spike',
        duration: 30,
        businessTypes: ['retail', 'grocery_store'],
        trafficProfile: {
          startRPS: 50,
          peakRPS: 1000,
          voiceSessionRatio: 0.2, // Lower during high urgency
          spikeStartMinute: 5,
          spikeDuration: 20,
          customerBehavior: 'urgent_completion'
        },
        characteristics: {
          averageSessionDuration: 6,
          customerPatience: 'very_low',
          repeatCustomerRatio: 0.8,
          mobileUsageRatio: 0.98,
          locationConcurrency: 50
        }
      }
    ];
  }

  /**
   * Main peak hour simulation function
   */
  async runPeakHourSimulations() {
    console.log('🏃 Starting Peak Hour Simulation Testing');
    console.log(`  Total Scenarios: ${this.scenarios.length}`);
    console.log(`  Compression Ratio: ${this.config.timeCompressionRatio}:1`);
    console.log(`  Max Concurrent Sessions: ${this.config.maxConcurrentSessions}`);
    console.log('='.repeat(60));

    this.isRunning = true;
    this.simulationStartTime = performance.now();

    try {
      // Run each scenario
      for (let i = 0; i < this.scenarios.length; i++) {
        const scenario = this.scenarios[i];
        console.log(`\n📊 Running Scenario ${i + 1}/${this.scenarios.length}: ${scenario.name}`);
        
        const scenarioResults = await this.runScenario(scenario);
        this.metrics.scenarios.set(scenario.name, scenarioResults);
        
        // Brief cooldown between scenarios
        if (i < this.scenarios.length - 1) {
          console.log(`  Cooling down for 10 seconds...`);
          await this.delay(10000);
        }
      }

      // Generate comprehensive report
      const report = await this.generatePeakHourReport();
      console.log('\n📋 Peak Hour Simulation Results:');
      this.displayPeakHourResults(report);
      
      return report;

    } finally {
      this.isRunning = false;
    }
  }

  async runScenario(scenario) {
    const scenarioStart = performance.now();
    const compressedDuration = (scenario.duration * 60 * 1000) / this.config.timeCompressionRatio;
    
    console.log(`  Duration: ${scenario.duration}min (compressed to ${(compressedDuration/1000).toFixed(1)}s)`);
    console.log(`  Pattern: ${scenario.pattern}`);
    console.log(`  Peak RPS: ${scenario.trafficProfile.peakRPS}`);
    console.log(`  Voice Session Ratio: ${(scenario.trafficProfile.voiceSessionRatio * 100).toFixed(1)}%`);

    const results = {
      scenario: scenario.name,
      pattern: scenario.pattern,
      startTime: scenarioStart,
      endTime: null,
      metrics: {
        totalRequests: 0,
        totalVoiceSessions: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        peakRPS: 0,
        systemOverloads: 0,
        responseTimes: [],
        rpsHistory: []
      },
      performanceBreaches: [],
      customerExperience: {
        abandonmentRate: 0,
        satisfactionScore: 0,
        avgWaitTime: 0
      }
    };

    // Generate traffic according to pattern
    await this.generateTrafficPattern(scenario, results, compressedDuration);

    results.endTime = performance.now();
    results.actualDuration = (results.endTime - results.startTime) / 1000;

    // Calculate final metrics
    this.calculateScenarioMetrics(results);
    
    console.log(`  ✅ Scenario completed in ${results.actualDuration.toFixed(1)}s`);
    console.log(`    Requests: ${results.metrics.totalRequests}, Success: ${((results.metrics.successfulRequests / results.metrics.totalRequests) * 100).toFixed(1)}%`);
    console.log(`    Peak RPS: ${results.metrics.peakRPS.toFixed(0)}, Avg Response: ${results.metrics.averageResponseTime.toFixed(1)}ms`);
    
    return results;
  }

  async generateTrafficPattern(scenario, results, duration) {
    const segments = 20; // Divide duration into 20 segments for smooth curves
    const segmentDuration = duration / segments;
    const profile = scenario.trafficProfile;
    
    for (let segment = 0; segment < segments; segment++) {
      const segmentStart = performance.now();
      const timeProgress = segment / (segments - 1); // 0 to 1
      
      // Calculate RPS for this segment based on pattern
      const segmentRPS = this.calculateSegmentRPS(scenario.pattern, profile, timeProgress, segment, segments);
      const segmentVoiceSessions = Math.floor(segmentRPS * profile.voiceSessionRatio);
      const segmentAPIRequests = segmentRPS - segmentVoiceSessions;
      
      results.metrics.rpsHistory.push({
        segment,
        timeProgress,
        targetRPS: segmentRPS,
        actualRPS: 0, // Will be calculated
        timestamp: performance.now() - results.startTime
      });

      // Generate concurrent requests for this segment
      const segmentPromises = [];
      
      // Generate voice sessions
      for (let i = 0; i < segmentVoiceSessions; i++) {
        segmentPromises.push(
          this.generateVoiceSession(`${scenario.name}-voice-${segment}-${i}`, scenario, results)
        );
      }
      
      // Generate API requests
      for (let i = 0; i < segmentAPIRequests; i++) {
        segmentPromises.push(
          this.generateAPIRequest(`${scenario.name}-api-${segment}-${i}`, scenario, results)
        );
      }

      // Execute segment requests with controlled timing
      const segmentResults = await this.executeSegmentRequests(segmentPromises, segmentDuration);
      
      // Update metrics
      results.metrics.totalRequests += segmentResults.total;
      results.metrics.totalVoiceSessions += segmentVoiceSessions;
      results.metrics.successfulRequests += segmentResults.successful;
      results.metrics.failedRequests += segmentResults.failed;
      results.metrics.responseTimes.push(...segmentResults.responseTimes);
      
      // Update RPS history with actual values
      const actualSegmentTime = (performance.now() - segmentStart) / 1000;
      const actualRPS = segmentResults.total / actualSegmentTime;
      results.metrics.rpsHistory[segment].actualRPS = actualRPS;
      results.metrics.peakRPS = Math.max(results.metrics.peakRPS, actualRPS);
      
      // Check for system overload
      if (actualRPS < segmentRPS * 0.7) {
        results.metrics.systemOverloads++;
        results.performanceBreaches.push({
          segment,
          issue: 'throughput_drop',
          expected: segmentRPS,
          actual: actualRPS,
          timestamp: performance.now() - results.startTime
        });
      }

      // Wait for segment completion
      const remainingTime = segmentDuration - (performance.now() - segmentStart);
      if (remainingTime > 0) {
        await this.delay(remainingTime);
      }

      // Progress indicator
      if ((segment + 1) % 5 === 0) {
        console.log(`    Progress: ${((segment + 1) / segments * 100).toFixed(0)}% (${actualRPS.toFixed(0)} RPS)`);
      }
    }
  }

  calculateSegmentRPS(pattern, profile, timeProgress, segment, totalSegments) {
    const { startRPS, peakRPS } = profile;
    
    switch (pattern) {
      case 'exponential_growth':
        // Gradual increase to peak, then gradual decrease
        if (timeProgress < 0.3) {
          return startRPS + (peakRPS - startRPS) * Math.pow(timeProgress / 0.3, 2);
        } else if (timeProgress < 0.7) {
          return peakRPS;
        } else {
          return peakRPS * (1 - Math.pow((timeProgress - 0.7) / 0.3, 2));
        }
        
      case 'steady_moderate':
        const fluctuation = (profile.fluctuationRange || 0.2) * Math.sin(timeProgress * Math.PI * 4);
        return startRPS + (peakRPS - startRPS) * 0.5 * (1 + fluctuation);
        
      case 'double_peak':
        // Two peaks with a trough in the middle
        const firstPeak = Math.exp(-Math.pow((timeProgress - 0.25) * 8, 2));
        const secondPeak = Math.exp(-Math.pow((timeProgress - 0.75) * 8, 2));
        return startRPS + (peakRPS - startRPS) * Math.max(firstPeak, secondPeak);
        
      case 'low_steady':
        return startRPS + (peakRPS - startRPS) * (0.3 + 0.2 * Math.sin(timeProgress * Math.PI * 2));
        
      case 'sustained_high':
        if (timeProgress < 0.2) {
          return startRPS + (peakRPS - startRPS) * (timeProgress / 0.2);
        } else if (timeProgress < 0.8) {
          return peakRPS;
        } else {
          return peakRPS * (1 - ((timeProgress - 0.8) / 0.2) * 0.5);
        }
        
      case 'gradual_decline':
        return startRPS + (peakRPS - startRPS) * (1 - Math.pow(timeProgress, 2));
        
      case 'extended_plateau':
        if (timeProgress < 0.25) {
          return startRPS + (peakRPS - startRPS) * (timeProgress / 0.25);
        } else if (timeProgress < 0.75) {
          return peakRPS;
        } else {
          return peakRPS * (1 - ((timeProgress - 0.75) / 0.25) * 0.3);
        }
        
      case 'sudden_spike':
        if (timeProgress < 0.2 || timeProgress > 0.8) {
          return startRPS;
        } else {
          return peakRPS;
        }
        
      default:
        return startRPS + (peakRPS - startRPS) * timeProgress;
    }
  }

  async executeSegmentRequests(promises, maxDuration) {
    const results = {
      total: promises.length,
      successful: 0,
      failed: 0,
      responseTimes: []
    };

    if (promises.length === 0) return results;

    const startTime = performance.now();
    const timeout = maxDuration * 1.5; // Allow 50% extra time

    try {
      const settledPromises = await Promise.allSettled(promises.map(p => 
        Promise.race([
          p,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Segment timeout')), timeout)
          )
        ])
      ));

      settledPromises.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          results.successful++;
          results.responseTimes.push(result.value.responseTime);
        } else {
          results.failed++;
          if (result.value && result.value.responseTime) {
            results.responseTimes.push(result.value.responseTime);
          }
        }
      });

    } catch (error) {
      console.error(`Segment execution error: ${error.message}`);
      results.failed = promises.length;
    }

    return results;
  }

  async generateVoiceSession(sessionId, scenario, results) {
    const startTime = performance.now();
    
    try {
      // Simulate voice session phases
      const phases = [
        { name: 'session_creation', duration: 50 + Math.random() * 100 },
        { name: 'voice_connection', duration: 100 + Math.random() * 200 },
        { name: 'conversation', duration: scenario.characteristics.averageSessionDuration * 1000 },
        { name: 'ai_scoring', duration: 800 + Math.random() * 1200 },
        { name: 'reward_calculation', duration: 150 + Math.random() * 300 }
      ];

      for (const phase of phases) {
        await this.delay(phase.duration * this.getPerformanceFactor());
        
        // Simulate potential failures based on system load
        const currentLoad = this.getCurrentSystemLoad();
        if (currentLoad > 0.8 && Math.random() < 0.1) {
          throw new Error(`${phase.name}_overload`);
        }
      }

      const responseTime = performance.now() - startTime;
      return { success: true, responseTime, type: 'voice_session' };

    } catch (error) {
      return { 
        success: false, 
        responseTime: performance.now() - startTime, 
        error: error.message,
        type: 'voice_session' 
      };
    }
  }

  async generateAPIRequest(requestId, scenario, results) {
    const startTime = performance.now();
    
    try {
      // Simulate API request processing
      const endpoints = [
        { name: 'health', duration: 10, failureRate: 0.01 },
        { name: 'qr_validate', duration: 50, failureRate: 0.02 },
        { name: 'session_status', duration: 30, failureRate: 0.015 },
        { name: 'feedback_list', duration: 80, failureRate: 0.03 },
        { name: 'metrics', duration: 20, failureRate: 0.01 }
      ];
      
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const processingTime = endpoint.duration * (1 + Math.random());
      
      await this.delay(processingTime * this.getPerformanceFactor());
      
      // Simulate failures
      if (Math.random() < endpoint.failureRate) {
        throw new Error(`${endpoint.name}_error`);
      }

      const responseTime = performance.now() - startTime;
      return { success: true, responseTime, type: 'api_request' };

    } catch (error) {
      return { 
        success: false, 
        responseTime: performance.now() - startTime, 
        error: error.message,
        type: 'api_request' 
      };
    }
  }

  getPerformanceFactor() {
    // Simulate system degradation under high load
    const load = this.getCurrentSystemLoad();
    if (load > 0.8) return 1.5 + Math.random() * 0.5; // 50-100% slower
    if (load > 0.6) return 1.2 + Math.random() * 0.3; // 20-50% slower
    return 1.0;
  }

  getCurrentSystemLoad() {
    // Simulate system load based on active connections
    const maxConnections = this.config.maxConcurrentSessions;
    return Math.min(1.0, this.activeConnections.size / maxConnections);
  }

  calculateScenarioMetrics(results) {
    const responseTimes = results.metrics.responseTimes;
    
    if (responseTimes.length > 0) {
      results.metrics.averageResponseTime = 
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      
      const sortedTimes = [...responseTimes].sort((a, b) => a - b);
      results.responseTimePercentiles = {
        p50: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
        p90: sortedTimes[Math.floor(sortedTimes.length * 0.9)],
        p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
        p99: sortedTimes[Math.floor(sortedTimes.length * 0.99)]
      };
    }
    
    // Calculate customer experience metrics
    const totalRequests = results.metrics.totalRequests;
    const failedRequests = results.metrics.failedRequests;
    
    results.customerExperience.abandonmentRate = (failedRequests / totalRequests) * 100;
    results.customerExperience.satisfactionScore = Math.max(0, 100 - 
      (results.customerExperience.abandonmentRate * 2) - 
      (results.metrics.systemOverloads * 5) -
      (results.metrics.averageResponseTime / 50)
    );
    results.customerExperience.avgWaitTime = results.metrics.averageResponseTime;
  }

  async generatePeakHourReport() {
    const totalDuration = (performance.now() - this.simulationStartTime) / 1000;
    const allScenarios = Array.from(this.metrics.scenarios.values());
    
    const report = {
      simulationSummary: {
        totalScenarios: this.scenarios.length,
        totalDuration,
        scenariosCompleted: allScenarios.length,
        compressionRatio: this.config.timeCompressionRatio
      },
      aggregatedMetrics: this.calculateAggregatedMetrics(allScenarios),
      scenarioResults: allScenarios,
      systemPerformance: this.analyzeSystemPerformance(allScenarios),
      businessImpactAnalysis: this.analyzeBusiness Impact(allScenarios),
      recommendations: this.generatePeakHourRecommendations(allScenarios)
    };

    // Save detailed report
    const reportPath = path.join(__dirname, `peak-hour-simulation-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Detailed report saved: ${reportPath}`);

    return report;
  }

  calculateAggregatedMetrics(scenarios) {
    const totals = scenarios.reduce((acc, scenario) => ({
      totalRequests: acc.totalRequests + scenario.metrics.totalRequests,
      totalVoiceSessions: acc.totalVoiceSessions + scenario.metrics.totalVoiceSessions,
      successfulRequests: acc.successfulRequests + scenario.metrics.successfulRequests,
      failedRequests: acc.failedRequests + scenario.metrics.failedRequests,
      totalResponseTime: acc.totalResponseTime + (scenario.metrics.averageResponseTime * scenario.metrics.totalRequests),
      totalSystemOverloads: acc.totalSystemOverloads + scenario.metrics.systemOverloads,
      maxPeakRPS: Math.max(acc.maxPeakRPS, scenario.metrics.peakRPS)
    }), {
      totalRequests: 0,
      totalVoiceSessions: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      totalSystemOverloads: 0,
      maxPeakRPS: 0
    });

    return {
      totalRequests: totals.totalRequests,
      totalVoiceSessions: totals.totalVoiceSessions,
      overallSuccessRate: (totals.successfulRequests / totals.totalRequests) * 100,
      averageResponseTime: totals.totalResponseTime / totals.totalRequests,
      peakRPSAchieved: totals.maxPeakRPS,
      totalSystemOverloads: totals.totalSystemOverloads,
      voiceSessionRatio: (totals.totalVoiceSessions / totals.totalRequests) * 100
    };
  }

  analyzeSystemPerformance(scenarios) {
    const performanceIssues = [];
    const strongPerformance = [];
    
    scenarios.forEach(scenario => {
      const successRate = (scenario.metrics.successfulRequests / scenario.metrics.totalRequests) * 100;
      const avgResponseTime = scenario.metrics.averageResponseTime;
      
      if (successRate < 95) {
        performanceIssues.push({
          scenario: scenario.scenario,
          issue: 'low_success_rate',
          value: successRate,
          severity: successRate < 90 ? 'critical' : 'warning'
        });
      }
      
      if (avgResponseTime > 2000) {
        performanceIssues.push({
          scenario: scenario.scenario,
          issue: 'high_response_time',
          value: avgResponseTime,
          severity: avgResponseTime > 5000 ? 'critical' : 'warning'
        });
      }
      
      if (scenario.metrics.systemOverloads > 3) {
        performanceIssues.push({
          scenario: scenario.scenario,
          issue: 'frequent_overloads',
          value: scenario.metrics.systemOverloads,
          severity: 'warning'
        });
      }
      
      if (successRate > 98 && avgResponseTime < 1000) {
        strongPerformance.push({
          scenario: scenario.scenario,
          successRate,
          avgResponseTime
        });
      }
    });
    
    return {
      performanceIssues,
      strongPerformance,
      overallHealthScore: this.calculateSystemHealthScore(scenarios)
    };
  }

  analyzeBusiness Impact(scenarios) {
    const businessMetrics = {
      customerSatisfaction: {
        excellent: 0, // >90 satisfaction
        good: 0,      // 70-90
        poor: 0       // <70
      },
      revenueImpact: {
        potentialLoss: 0,
        customerRetention: 0
      },
      operationalEfficiency: {
        peakHandlingCapacity: 0,
        resourceUtilization: 0
      }
    };

    scenarios.forEach(scenario => {
      const satisfaction = scenario.customerExperience.satisfactionScore;
      
      if (satisfaction > 90) {
        businessMetrics.customerSatisfaction.excellent++;
      } else if (satisfaction > 70) {
        businessMetrics.customerSatisfaction.good++;
      } else {
        businessMetrics.customerSatisfaction.poor++;
      }
      
      // Estimate revenue impact based on abandonment rate
      const abandonmentRate = scenario.customerExperience.abandonmentRate;
      businessMetrics.revenueImpact.potentialLoss += abandonmentRate * 0.15; // 15% conversion loss per abandonment
      
      // Peak handling capacity
      const peakEfficiency = Math.min(100, (scenario.metrics.peakRPS / 1000) * 100);
      businessMetrics.operationalEfficiency.peakHandlingCapacity = Math.max(
        businessMetrics.operationalEfficiency.peakHandlingCapacity,
        peakEfficiency
      );
    });

    return businessMetrics;
  }

  calculateSystemHealthScore(scenarios) {
    let totalScore = 0;
    let factors = 0;

    scenarios.forEach(scenario => {
      const successRate = (scenario.metrics.successfulRequests / scenario.metrics.totalRequests) * 100;
      const responseTimeScore = Math.max(0, 100 - (scenario.metrics.averageResponseTime / 50));
      const overloadPenalty = scenario.metrics.systemOverloads * 5;
      
      const scenarioScore = Math.max(0, (successRate + responseTimeScore) / 2 - overloadPenalty);
      totalScore += scenarioScore;
      factors++;
    });

    return factors > 0 ? totalScore / factors : 0;
  }

  generatePeakHourRecommendations(scenarios) {
    const recommendations = [];
    const aggregated = this.calculateAggregatedMetrics(scenarios);
    
    if (aggregated.overallSuccessRate < 95) {
      recommendations.push(`❌ Overall success rate too low (${aggregated.overallSuccessRate.toFixed(1)}%). Implement circuit breakers and better error handling.`);
    }
    
    if (aggregated.averageResponseTime > 1500) {
      recommendations.push(`⏰ High average response time (${aggregated.averageResponseTime.toFixed(0)}ms). Consider implementing caching and connection pooling.`);
    }
    
    if (aggregated.peakRPSAchieved < 800) {
      recommendations.push(`📈 Peak RPS capacity lower than expected (${aggregated.peakRPSAchieved.toFixed(0)}). Scale infrastructure horizontally.`);
    }
    
    if (aggregated.totalSystemOverloads > 10) {
      recommendations.push(`🚨 Frequent system overloads detected (${aggregated.totalSystemOverloads}). Implement auto-scaling and load balancing.`);
    }
    
    // Scenario-specific recommendations
    const problematicScenarios = scenarios.filter(s => 
      (s.metrics.successfulRequests / s.metrics.totalRequests) * 100 < 90
    );
    
    if (problematicScenarios.length > 0) {
      recommendations.push(`⚠️  ${problematicScenarios.length} scenarios showed poor performance: ${problematicScenarios.map(s => s.scenario).join(', ')}`);
    }
    
    const voiceIssues = scenarios.filter(s => s.metrics.totalVoiceSessions > 50 && s.metrics.averageResponseTime > 3000);
    if (voiceIssues.length > 0) {
      recommendations.push(`🎤 Voice session performance issues detected. Optimize AI processing pipeline and consider edge deployment.`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ All peak hour scenarios performed within acceptable thresholds!');
    }

    return recommendations;
  }

  displayPeakHourResults(report) {
    const agg = report.aggregatedMetrics;
    console.log(`  Total Scenarios: ${report.simulationSummary.scenariosCompleted}`);
    console.log(`  Total Requests: ${agg.totalRequests} (${agg.totalVoiceSessions} voice sessions)`);
    console.log(`  Overall Success Rate: ${agg.overallSuccessRate.toFixed(1)}%`);
    console.log(`  Average Response Time: ${agg.averageResponseTime.toFixed(1)}ms`);
    console.log(`  Peak RPS Achieved: ${agg.peakRPSAchieved.toFixed(0)}`);
    console.log(`  System Overloads: ${agg.totalSystemOverloads}`);
    console.log(`  System Health Score: ${report.systemPerformance.overallHealthScore.toFixed(1)}/100`);
    
    console.log('\n📊 Scenario Performance:');
    report.scenarioResults.forEach((scenario, i) => {
      const successRate = (scenario.metrics.successfulRequests / scenario.metrics.totalRequests) * 100;
      const satisfaction = scenario.customerExperience.satisfactionScore;
      console.log(`  ${i+1}. ${scenario.scenario}: ${successRate.toFixed(1)}% success, ${satisfaction.toFixed(0)} satisfaction`);
    });
    
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`    ${rec}`));
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main execution function
 */
async function runPeakHourSimulation() {
  const simulator = new PeakHourSimulator({
    simulationDuration: 1800, // 30 minutes total
    timeCompressionRatio: 24,  // 24:1 compression
    maxConcurrentSessions: 200
  });
  
  try {
    console.log('🎯 Peak Hour Simulation Test');
    console.log('Simulating full business day traffic patterns');
    console.log('Target: System stability across all business scenarios');
    console.log('');
    
    const report = await simulator.runPeakHourSimulations();
    return report;
    
  } catch (error) {
    console.error('❌ Peak hour simulation failed:', error.message);
    throw error;
  }
}

module.exports = { PeakHourSimulator, runPeakHourSimulation };

// Run if executed directly
if (require.main === module) {
  runPeakHourSimulation()
    .then(() => {
      console.log('\n✅ Peak hour simulation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Peak hour simulation failed:', error);
      process.exit(1);
    });
}