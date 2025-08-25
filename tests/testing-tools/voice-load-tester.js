/**
 * Voice Load Testing Tools for Session Capacity Validation
 * 
 * Tests system capacity under heavy voice session load:
 * - Concurrent WebSocket connections
 * - Audio streaming capacity
 * - AI processing under load
 * - Memory and CPU usage monitoring
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const os = require('os');
const { performance } = require('perf_hooks');

class VoiceLoadTester extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Test configuration
      websocketUrl: process.env.WS_URL || 'ws://localhost:3001',
      apiUrl: process.env.API_URL || 'http://localhost:3000',
      
      // Load test parameters
      maxConcurrentSessions: 1000,
      rampUpDuration: 60000, // 1 minute ramp up
      testDuration: 300000,   // 5 minutes sustained load
      rampDownDuration: 30000, // 30 seconds ramp down
      
      // Voice simulation parameters
      audioChunkSize: 1024,
      audioChunkInterval: 100, // ms between chunks
      sessionDuration: { min: 30000, max: 180000 }, // 30s - 3min
      
      // Swedish voice patterns
      voicePatterns: {
        'Stockholm': { pitch: 'medium', speed: 'fast', accent: 'standard' },
        'Göteborg': { pitch: 'high', speed: 'medium', accent: 'göteborgska' },
        'Malmö': { pitch: 'medium', speed: 'medium', accent: 'skånska' },
        'Norrland': { pitch: 'low', speed: 'slow', accent: 'norrländska' }
      },
      
      // Performance thresholds
      thresholds: {
        maxResponseTime: 5000,      // 5s max response time
        maxCpuUsage: 80,           // 80% max CPU
        maxMemoryUsage: 85,        // 85% max memory
        minSuccessRate: 95,        // 95% min success rate
        maxAudioLatency: 2000      // 2s max audio processing latency
      },
      
      // Monitoring intervals
      monitoringInterval: 1000,    // 1s monitoring interval
      reportingInterval: 10000,    // 10s reporting interval
      
      ...config
    };

    // Test state
    this.activeSessions = new Map();
    this.completedSessions = [];
    this.metrics = {
      sessionsStarted: 0,
      sessionsCompleted: 0,
      sessionsFailed: 0,
      totalAudioChunks: 0,
      totalResponseTime: 0,
      peakConcurrency: 0,
      errors: [],
      performance: {
        cpu: [],
        memory: [],
        responseTime: [],
        throughput: []
      }
    };

    // Monitoring
    this.monitoringTimer = null;
    this.reportingTimer = null;
    this.testStartTime = null;
  }

  /**
   * Run comprehensive voice load test
   */
  async runLoadTest(testConfig = {}) {
    const config = { ...this.config, ...testConfig };
    
    console.log('🎙️ Starting Voice Session Load Test');
    console.log('===================================');
    console.log(`Target Sessions: ${config.maxConcurrentSessions}`);
    console.log(`Test Duration: ${config.testDuration / 1000}s`);
    console.log(`Ramp Up: ${config.rampUpDuration / 1000}s`);
    console.log('-----------------------------------\n');

    this.testStartTime = Date.now();
    
    // Start monitoring
    this.startMonitoring();
    this.startReporting();
    
    try {
      // Phase 1: Ramp up
      console.log('📈 Phase 1: Ramping up sessions...');
      await this.rampUpSessions(config);
      
      // Phase 2: Sustained load
      console.log('⚡ Phase 2: Sustained load testing...');
      await this.sustainedLoadTest(config);
      
      // Phase 3: Ramp down
      console.log('📉 Phase 3: Ramping down sessions...');
      await this.rampDownSessions(config);
      
    } catch (error) {
      console.error('❌ Load test failed:', error.message);
      this.metrics.errors.push({
        timestamp: Date.now(),
        error: error.message,
        phase: 'test_execution'
      });
    } finally {
      // Cleanup
      this.stopMonitoring();
      this.stopReporting();
      await this.closeAllSessions();
    }
    
    // Generate comprehensive report
    const report = this.generateLoadTestReport();
    
    console.log('\n📊 Load Test Complete');
    console.log('====================');
    console.log(`Sessions Completed: ${this.metrics.sessionsCompleted}`);
    console.log(`Success Rate: ${Math.round((this.metrics.sessionsCompleted / this.metrics.sessionsStarted) * 100)}%`);
    console.log(`Peak Concurrency: ${this.metrics.peakConcurrency}`);
    console.log(`Average Response Time: ${Math.round(this.metrics.totalResponseTime / this.metrics.sessionsCompleted)}ms`);
    
    return report;
  }

  /**
   * Ramp up sessions gradually to avoid overwhelming the system
   */
  async rampUpSessions(config) {
    const { maxConcurrentSessions, rampUpDuration } = config;
    const sessionInterval = rampUpDuration / maxConcurrentSessions;
    
    for (let i = 0; i < maxConcurrentSessions; i++) {
      // Check if we should stop ramping
      if (this.shouldStopRamping()) {
        console.log(`⚠️  Stopping ramp up at ${i} sessions due to system limits`);
        break;
      }
      
      // Create new voice session
      this.createVoiceSession(i);
      
      // Wait before next session
      if (i < maxConcurrentSessions - 1) {
        await this.delay(sessionInterval);
      }
      
      // Update peak concurrency
      this.metrics.peakConcurrency = Math.max(this.metrics.peakConcurrency, this.activeSessions.size);
    }
    
    console.log(`✅ Ramp up complete: ${this.activeSessions.size} active sessions`);
  }

  /**
   * Maintain sustained load for specified duration
   */
  async sustainedLoadTest(config) {
    const startTime = Date.now();
    const { testDuration } = config;
    
    while (Date.now() - startTime < testDuration) {
      // Replace completed sessions to maintain load
      const targetSessions = Math.min(config.maxConcurrentSessions, this.getCurrentTargetSessions());
      
      while (this.activeSessions.size < targetSessions) {
        if (this.shouldStopRamping()) break;
        this.createVoiceSession(this.metrics.sessionsStarted);
      }
      
      await this.delay(1000); // Check every second
    }
    
    console.log(`✅ Sustained load complete: maintained ~${this.activeSessions.size} sessions`);
  }

  /**
   * Gradually reduce load
   */
  async rampDownSessions(config) {
    console.log('🔄 Gracefully shutting down sessions...');
    
    // Stop creating new sessions
    const sessionsToClose = Array.from(this.activeSessions.keys());
    const closeInterval = config.rampDownDuration / sessionsToClose.length;
    
    for (const sessionId of sessionsToClose) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        await this.closeVoiceSession(sessionId);
        await this.delay(closeInterval);
      }
    }
    
    console.log('✅ Ramp down complete');
  }

  /**
   * Create and manage a single voice session
   */
  createVoiceSession(sessionId) {
    const sessionData = {
      id: sessionId,
      startTime: Date.now(),
      websocket: null,
      status: 'connecting',
      audioChunksSent: 0,
      responseTime: null,
      region: this.getRandomRegion(),
      errors: []
    };

    try {
      // Create WebSocket connection
      const ws = new WebSocket(this.config.websocketUrl);
      sessionData.websocket = ws;
      
      // Connection opened
      ws.on('open', () => {
        sessionData.status = 'connected';
        sessionData.connectTime = Date.now();
        
        // Start sending audio chunks
        this.startAudioSimulation(sessionData);
        
        this.emit('sessionConnected', sessionData);
      });

      // Handle messages
      ws.on('message', (data) => {
        this.handleVoiceResponse(sessionData, data);
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        this.handleSessionClose(sessionData, code, reason);
      });

      // Handle errors
      ws.on('error', (error) => {
        sessionData.errors.push({
          timestamp: Date.now(),
          error: error.message
        });
        this.metrics.errors.push({
          sessionId,
          timestamp: Date.now(),
          error: error.message,
          phase: 'websocket_connection'
        });
      });

      this.activeSessions.set(sessionId, sessionData);
      this.metrics.sessionsStarted++;
      
    } catch (error) {
      console.error(`Failed to create session ${sessionId}:`, error.message);
      this.metrics.sessionsFailed++;
      this.metrics.errors.push({
        sessionId,
        timestamp: Date.now(),
        error: error.message,
        phase: 'session_creation'
      });
    }
  }

  /**
   * Simulate audio streaming for a voice session
   */
  startAudioSimulation(sessionData) {
    if (sessionData.status !== 'connected') return;
    
    const { audioChunkSize, audioChunkInterval } = this.config;
    const sessionDuration = this.getRandomSessionDuration();
    const voicePattern = this.config.voicePatterns[sessionData.region];
    
    // Simulate Swedish voice data with regional characteristics
    const audioSimulation = setInterval(() => {
      if (sessionData.websocket.readyState !== WebSocket.OPEN) {
        clearInterval(audioSimulation);
        return;
      }
      
      // Generate mock audio chunk
      const audioChunk = this.generateSwedishAudioChunk(voicePattern, audioChunkSize);
      
      try {
        sessionData.websocket.send(audioChunk);
        sessionData.audioChunksSent++;
        this.metrics.totalAudioChunks++;
      } catch (error) {
        sessionData.errors.push({
          timestamp: Date.now(),
          error: `Audio send failed: ${error.message}`
        });
        clearInterval(audioSimulation);
      }
      
      // End session after duration
      if (Date.now() - sessionData.startTime > sessionDuration) {
        clearInterval(audioSimulation);
        this.endVoiceSession(sessionData.id);
      }
      
    }, audioChunkInterval);
    
    sessionData.audioSimulation = audioSimulation;
  }

  /**
   * Handle voice processing response
   */
  handleVoiceResponse(sessionData, data) {
    try {
      const response = JSON.parse(data);
      
      // Calculate response time
      if (response.type === 'transcription' || response.type === 'ai_response') {
        const responseTime = Date.now() - sessionData.connectTime;
        sessionData.responseTime = responseTime;
        this.metrics.totalResponseTime += responseTime;
        this.metrics.performance.responseTime.push(responseTime);
        
        // Check if response time exceeds threshold
        if (responseTime > this.config.thresholds.maxResponseTime) {
          sessionData.errors.push({
            timestamp: Date.now(),
            error: `Response time exceeded threshold: ${responseTime}ms`
          });
        }
      }
      
      this.emit('voiceResponse', sessionData, response);
      
    } catch (error) {
      sessionData.errors.push({
        timestamp: Date.now(),
        error: `Response parsing failed: ${error.message}`
      });
    }
  }

  /**
   * Handle session close
   */
  handleSessionClose(sessionData, code, reason) {
    if (sessionData.audioSimulation) {
      clearInterval(sessionData.audioSimulation);
    }
    
    sessionData.status = 'closed';
    sessionData.endTime = Date.now();
    sessionData.totalDuration = sessionData.endTime - sessionData.startTime;
    
    // Move to completed sessions
    this.completedSessions.push(sessionData);
    this.activeSessions.delete(sessionData.id);
    
    if (sessionData.errors.length === 0 && sessionData.responseTime) {
      this.metrics.sessionsCompleted++;
    } else {
      this.metrics.sessionsFailed++;
    }
    
    this.emit('sessionClosed', sessionData);
  }

  /**
   * Manually end a voice session
   */
  async endVoiceSession(sessionId) {
    const sessionData = this.activeSessions.get(sessionId);
    if (sessionData && sessionData.websocket) {
      try {
        // Send end-of-session message
        sessionData.websocket.send(JSON.stringify({
          type: 'end_session',
          sessionId,
          timestamp: Date.now()
        }));
        
        await this.delay(100); // Give time for graceful close
        sessionData.websocket.close(1000, 'Session completed');
      } catch (error) {
        console.error(`Error ending session ${sessionId}:`, error.message);
      }
    }
  }

  /**
   * Close a specific voice session
   */
  async closeVoiceSession(sessionId) {
    const sessionData = this.activeSessions.get(sessionId);
    if (sessionData) {
      if (sessionData.audioSimulation) {
        clearInterval(sessionData.audioSimulation);
      }
      if (sessionData.websocket) {
        sessionData.websocket.close(1000, 'Load test cleanup');
      }
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Close all active sessions
   */
  async closeAllSessions() {
    const sessionIds = Array.from(this.activeSessions.keys());
    console.log(`🧹 Closing ${sessionIds.length} remaining sessions...`);
    
    for (const sessionId of sessionIds) {
      await this.closeVoiceSession(sessionId);
    }
    
    console.log('✅ All sessions closed');
  }

  /**
   * Start system monitoring
   */
  startMonitoring() {
    this.monitoringTimer = setInterval(() => {
      const cpuUsage = this.getCPUUsage();
      const memoryUsage = this.getMemoryUsage();
      
      this.metrics.performance.cpu.push(cpuUsage);
      this.metrics.performance.memory.push(memoryUsage);
      
      // Calculate throughput (sessions/second)
      const currentTime = Date.now();
      const elapsedSeconds = (currentTime - this.testStartTime) / 1000;
      const throughput = this.metrics.sessionsStarted / elapsedSeconds;
      this.metrics.performance.throughput.push(throughput);
      
      this.emit('metrics', {
        timestamp: currentTime,
        activeSessions: this.activeSessions.size,
        cpuUsage,
        memoryUsage,
        throughput
      });
      
    }, this.config.monitoringInterval);
  }

  /**
   * Start periodic reporting
   */
  startReporting() {
    this.reportingTimer = setInterval(() => {
      const currentMetrics = this.getCurrentMetrics();
      
      console.log('📊 Load Test Status:');
      console.log(`   Active Sessions: ${currentMetrics.activeSessions}`);
      console.log(`   Completed Sessions: ${currentMetrics.completed}`);
      console.log(`   Success Rate: ${currentMetrics.successRate}%`);
      console.log(`   Average Response Time: ${currentMetrics.avgResponseTime}ms`);
      console.log(`   CPU Usage: ${currentMetrics.cpuUsage}%`);
      console.log(`   Memory Usage: ${currentMetrics.memoryUsage}%`);
      console.log('---');
      
    }, this.config.reportingInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  /**
   * Stop reporting
   */
  stopReporting() {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }
  }

  // Helper methods

  shouldStopRamping() {
    const metrics = this.getCurrentMetrics();
    
    // Stop if system resources are too high
    if (metrics.cpuUsage > this.config.thresholds.maxCpuUsage) return true;
    if (metrics.memoryUsage > this.config.thresholds.maxMemoryUsage) return true;
    if (metrics.successRate < this.config.thresholds.minSuccessRate && this.metrics.sessionsStarted > 50) return true;
    
    return false;
  }

  getCurrentTargetSessions() {
    // Adjust target based on system performance
    const metrics = this.getCurrentMetrics();
    let targetSessions = this.config.maxConcurrentSessions;
    
    if (metrics.cpuUsage > 70) targetSessions *= 0.8;
    if (metrics.memoryUsage > 75) targetSessions *= 0.9;
    if (metrics.avgResponseTime > 3000) targetSessions *= 0.85;
    
    return Math.floor(targetSessions);
  }

  getCurrentMetrics() {
    const activeSessions = this.activeSessions.size;
    const totalSessions = this.metrics.sessionsStarted;
    const completed = this.metrics.sessionsCompleted;
    const failed = this.metrics.sessionsFailed;
    
    return {
      activeSessions,
      totalSessions,
      completed,
      failed,
      successRate: totalSessions > 0 ? Math.round((completed / totalSessions) * 100) : 0,
      avgResponseTime: completed > 0 ? Math.round(this.metrics.totalResponseTime / completed) : 0,
      cpuUsage: this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage()
    };
  }

  getRandomRegion() {
    const regions = Object.keys(this.config.voicePatterns);
    return regions[Math.floor(Math.random() * regions.length)];
  }

  getRandomSessionDuration() {
    const { min, max } = this.config.sessionDuration;
    return Math.random() * (max - min) + min;
  }

  generateSwedishAudioChunk(voicePattern, size) {
    // Generate mock audio data that simulates Swedish voice characteristics
    const buffer = Buffer.alloc(size);
    
    // Fill with pseudo-random data that simulates voice patterns
    for (let i = 0; i < size; i++) {
      // Simulate different voice characteristics based on region
      let amplitude = 128;
      
      switch (voicePattern.accent) {
        case 'göteborgska':
          amplitude += Math.sin(i * 0.1) * 30; // Higher pitch variation
          break;
        case 'skånska':
          amplitude += Math.sin(i * 0.05) * 20; // Softer tones
          break;
        case 'norrländska':
          amplitude += Math.cos(i * 0.08) * 25; // Lower, more measured
          break;
        default: // Standard Swedish
          amplitude += Math.sin(i * 0.07) * 15;
      }
      
      buffer[i] = Math.floor(amplitude) & 0xFF;
    }
    
    return buffer;
  }

  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    return Math.round(100 - (totalIdle / totalTick) * 100);
  }

  getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    return Math.round((usedMemory / totalMemory) * 100);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate comprehensive load test report
   */
  generateLoadTestReport() {
    const testDuration = Date.now() - this.testStartTime;
    const metrics = this.getCurrentMetrics();
    
    // Performance analysis
    const avgCPU = this.metrics.performance.cpu.reduce((a, b) => a + b, 0) / this.metrics.performance.cpu.length;
    const maxCPU = Math.max(...this.metrics.performance.cpu);
    
    const avgMemory = this.metrics.performance.memory.reduce((a, b) => a + b, 0) / this.metrics.performance.memory.length;
    const maxMemory = Math.max(...this.metrics.performance.memory);
    
    const avgResponseTime = this.metrics.performance.responseTime.reduce((a, b) => a + b, 0) / this.metrics.performance.responseTime.length;
    const maxResponseTime = Math.max(...this.metrics.performance.responseTime);
    
    // Error analysis
    const errorsByType = {};
    this.metrics.errors.forEach(error => {
      const key = error.phase || 'unknown';
      errorsByType[key] = (errorsByType[key] || 0) + 1;
    });
    
    return {
      testSummary: {
        duration: `${Math.round(testDuration / 1000)}s`,
        sessionsStarted: this.metrics.sessionsStarted,
        sessionsCompleted: this.metrics.sessionsCompleted,
        sessionsFailed: this.metrics.sessionsFailed,
        successRate: `${metrics.successRate}%`,
        peakConcurrency: this.metrics.peakConcurrency,
        totalAudioChunks: this.metrics.totalAudioChunks
      },
      
      performance: {
        responseTime: {
          average: `${Math.round(avgResponseTime)}ms`,
          maximum: `${maxResponseTime}ms`,
          threshold: `${this.config.thresholds.maxResponseTime}ms`,
          withinThreshold: maxResponseTime <= this.config.thresholds.maxResponseTime
        },
        systemResources: {
          cpu: {
            average: `${Math.round(avgCPU)}%`,
            maximum: `${maxCPU}%`,
            threshold: `${this.config.thresholds.maxCpuUsage}%`,
            withinThreshold: maxCPU <= this.config.thresholds.maxCpuUsage
          },
          memory: {
            average: `${Math.round(avgMemory)}%`,
            maximum: `${maxMemory}%`,
            threshold: `${this.config.thresholds.maxMemoryUsage}%`,
            withinThreshold: maxMemory <= this.config.thresholds.maxMemoryUsage
          }
        }
      },
      
      errorAnalysis: {
        totalErrors: this.metrics.errors.length,
        errorRate: `${Math.round((this.metrics.errors.length / this.metrics.sessionsStarted) * 100)}%`,
        errorsByType
      },
      
      capacityAssessment: {
        recommendedMaxSessions: this.calculateRecommendedCapacity(),
        bottlenecks: this.identifyBottlenecks(),
        scalingRecommendations: this.generateScalingRecommendations()
      },
      
      swedishPilotReadiness: {
        canHandlePilotLoad: this.assessPilotReadiness(),
        estimatedPilotCapacity: this.estimatePilotCapacity(),
        criticalIssues: this.identifyCriticalIssues()
      }
    };
  }

  calculateRecommendedCapacity() {
    const metrics = this.getCurrentMetrics();
    let capacity = this.metrics.peakConcurrency;
    
    // Reduce capacity based on resource usage
    if (this.metrics.performance.cpu.some(cpu => cpu > 80)) capacity *= 0.7;
    if (this.metrics.performance.memory.some(mem => mem > 85)) capacity *= 0.8;
    if (this.metrics.performance.responseTime.some(rt => rt > 3000)) capacity *= 0.6;
    
    return Math.floor(capacity);
  }

  identifyBottlenecks() {
    const bottlenecks = [];
    
    const avgCPU = this.metrics.performance.cpu.reduce((a, b) => a + b, 0) / this.metrics.performance.cpu.length;
    const avgMemory = this.metrics.performance.memory.reduce((a, b) => a + b, 0) / this.metrics.performance.memory.length;
    const avgResponseTime = this.metrics.performance.responseTime.reduce((a, b) => a + b, 0) / this.metrics.performance.responseTime.length;
    
    if (avgCPU > 75) bottlenecks.push('CPU processing - AI voice analysis');
    if (avgMemory > 80) bottlenecks.push('Memory usage - WebSocket connections');
    if (avgResponseTime > 2500) bottlenecks.push('Response time - Voice processing pipeline');
    
    return bottlenecks;
  }

  generateScalingRecommendations() {
    const recommendations = [];
    const bottlenecks = this.identifyBottlenecks();
    
    if (bottlenecks.includes('CPU processing')) {
      recommendations.push('Optimize AI model performance or add more CPU cores');
    }
    if (bottlenecks.includes('Memory usage')) {
      recommendations.push('Implement WebSocket connection pooling and memory optimization');
    }
    if (bottlenecks.includes('Response time')) {
      recommendations.push('Add caching layer and optimize voice processing pipeline');
    }
    
    return recommendations;
  }

  assessPilotReadiness() {
    const metrics = this.getCurrentMetrics();
    
    // Swedish pilot needs to handle ~100 concurrent sessions reliably
    const canHandlePilot = metrics.successRate >= 95 && 
                          this.metrics.peakConcurrency >= 100 &&
                          this.identifyBottlenecks().length === 0;
    
    return canHandlePilot;
  }

  estimatePilotCapacity() {
    const recommendedCapacity = this.calculateRecommendedCapacity();
    
    // Pilot will have organic growth, estimate realistic concurrent users
    return {
      conservative: Math.floor(recommendedCapacity * 0.6), // 60% of capacity
      realistic: Math.floor(recommendedCapacity * 0.8),    // 80% of capacity
      maximum: recommendedCapacity                         // 100% tested capacity
    };
  }

  identifyCriticalIssues() {
    const issues = [];
    const metrics = this.getCurrentMetrics();
    
    if (metrics.successRate < 90) {
      issues.push('Low success rate - system unreliable under load');
    }
    
    if (this.metrics.performance.responseTime.some(rt => rt > 5000)) {
      issues.push('Response times exceed 5 seconds - poor user experience');
    }
    
    if (this.metrics.errors.length > this.metrics.sessionsStarted * 0.1) {
      issues.push('High error rate - system stability concerns');
    }
    
    return issues;
  }
}

module.exports = { VoiceLoadTester };

// CLI usage
if (require.main === module) {
  const loadTester = new VoiceLoadTester({
    maxConcurrentSessions: 100, // Start with smaller test for demo
    testDuration: 60000,        // 1 minute test
    rampUpDuration: 20000       // 20 second ramp up
  });
  
  // Event listeners for real-time monitoring
  loadTester.on('sessionConnected', (sessionData) => {
    console.log(`✅ Session ${sessionData.id} connected (${sessionData.region})`);
  });
  
  loadTester.on('sessionClosed', (sessionData) => {
    const duration = Math.round(sessionData.totalDuration / 1000);
    const status = sessionData.errors.length === 0 ? '✅' : '❌';
    console.log(`${status} Session ${sessionData.id} closed after ${duration}s (${sessionData.audioChunksSent} chunks)`);
  });
  
  loadTester.on('metrics', (metrics) => {
    // Real-time metrics can be logged or sent to monitoring system
    if (metrics.timestamp % 10000 < 1000) { // Log every 10 seconds
      console.log(`📊 Active: ${metrics.activeSessions}, CPU: ${metrics.cpuUsage}%, Mem: ${metrics.memoryUsage}%`);
    }
  });
  
  async function runTest() {
    console.log('🇸🇪 Voice Load Tester - Swedish AI Feedback Platform');
    console.log('===================================================\n');
    
    try {
      const report = await loadTester.runLoadTest();
      
      console.log('\n📋 Final Load Test Report:');
      console.log('==========================');
      console.log(`Sessions: ${report.testSummary.sessionsCompleted}/${report.testSummary.sessionsStarted} (${report.testSummary.successRate})`);
      console.log(`Peak Concurrency: ${report.testSummary.peakConcurrency} sessions`);
      console.log(`Average Response Time: ${report.performance.responseTime.average}`);
      console.log(`System CPU: ${report.performance.systemResources.cpu.average} (max: ${report.performance.systemResources.cpu.maximum})`);
      console.log(`System Memory: ${report.performance.systemResources.memory.average} (max: ${report.performance.systemResources.memory.maximum})`);
      
      console.log('\n🎯 Capacity Assessment:');
      console.log(`Recommended Max Sessions: ${report.capacityAssessment.recommendedMaxSessions}`);
      
      if (report.capacityAssessment.bottlenecks.length > 0) {
        console.log('\n⚠️  Bottlenecks Identified:');
        report.capacityAssessment.bottlenecks.forEach(bottleneck => 
          console.log(`   - ${bottleneck}`)
        );
      }
      
      console.log('\n🇸🇪 Swedish Pilot Assessment:');
      console.log(`Ready for Pilot: ${report.swedishPilotReadiness.canHandlePilotLoad ? '✅ Yes' : '❌ No'}`);
      console.log(`Conservative Capacity: ${report.swedishPilotReadiness.estimatedPilotCapacity.conservative} sessions`);
      console.log(`Realistic Capacity: ${report.swedishPilotReadiness.estimatedPilotCapacity.realistic} sessions`);
      
      if (report.swedishPilotReadiness.criticalIssues.length > 0) {
        console.log('\n🚨 Critical Issues:');
        report.swedishPilotReadiness.criticalIssues.forEach(issue => 
          console.log(`   - ${issue}`)
        );
      }
      
    } catch (error) {
      console.error('❌ Load test failed:', error.message);
    }
  }
  
  runTest();
}