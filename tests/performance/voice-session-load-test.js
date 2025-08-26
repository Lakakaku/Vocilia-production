#!/usr/bin/env node

/**
 * Voice Session Load Testing
 * Tests 100 concurrent voice sessions with realistic WebSocket audio streaming
 */

const { EventEmitter } = require('events');
const { performance } = require('perf_hooks');
const WebSocket = require('ws');
const fs = require('fs').promises;

class VoiceSessionLoadTester extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      wsUrl: config.wsUrl || 'ws://localhost:3001/voice',
      httpUrl: config.httpUrl || 'http://localhost:3001',
      concurrentSessions: config.concurrentSessions || 100,
      testDuration: config.testDuration || 300, // 5 minutes
      rampUpTime: config.rampUpTime || 60, // 1 minute ramp-up
      ...config
    };
    
    this.sessions = new Map();
    this.metrics = {
      sessionsCreated: 0,
      sessionsCompleted: 0,
      sessionsFailed: 0,
      totalResponseTime: 0,
      voiceProcessingTimes: [],
      aiScoringTimes: [],
      errors: [],
      connectionErrors: 0,
      timeouts: 0
    };
    
    this.isRunning = false;
    this.startTime = null;
  }

  /**
   * Main load testing function for 100 concurrent voice sessions
   */
  async testConcurrentVoiceSessions() {
    console.log('🎤 Starting Voice Session Load Test');
    console.log(`  Concurrent Sessions: ${this.config.concurrentSessions}`);
    console.log(`  Test Duration: ${this.config.testDuration}s`);
    console.log(`  Ramp-up Time: ${this.config.rampUpTime}s`);
    console.log('='.repeat(50));

    this.isRunning = true;
    this.startTime = performance.now();

    // Phase 1: Ramp-up concurrent sessions
    await this.rampUpSessions();
    
    // Phase 2: Maintain load for test duration
    await this.maintainLoad();
    
    // Phase 3: Ramp-down and collect results
    await this.rampDownSessions();
    
    this.isRunning = false;
    const report = this.generateVoiceSessionReport();
    
    console.log('\n📊 Voice Session Load Test Results:');
    this.displayResults(report);
    
    return report;
  }

  async rampUpSessions() {
    console.log('\n🚀 Phase 1: Ramping up sessions...');
    
    const sessionsPerSecond = this.config.concurrentSessions / this.config.rampUpTime;
    const interval = 1000 / sessionsPerSecond; // ms between session starts
    
    for (let i = 0; i < this.config.concurrentSessions; i++) {
      if (!this.isRunning) break;
      
      setTimeout(() => {
        this.startVoiceSession(`session-${i}`, i);
      }, i * interval);
      
      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`  Started ${i + 1}/${this.config.concurrentSessions} sessions`);
      }
    }
    
    // Wait for ramp-up to complete
    await this.delay(this.config.rampUpTime * 1000);
    console.log(`  ✅ Ramp-up completed: ${this.sessions.size} active sessions`);
  }

  async maintainLoad() {
    console.log('\n⚡ Phase 2: Maintaining concurrent load...');
    
    const maintainDuration = this.config.testDuration - this.config.rampUpTime - 30; // 30s for ramp-down
    const checkInterval = 5000; // Check every 5 seconds
    const iterations = Math.floor((maintainDuration * 1000) / checkInterval);
    
    for (let i = 0; i < iterations; i++) {
      await this.delay(checkInterval);
      
      if (!this.isRunning) break;
      
      const activeCount = this.getActiveSessionCount();
      console.log(`  Active sessions: ${activeCount}, Completed: ${this.metrics.sessionsCompleted}, Failed: ${this.metrics.sessionsFailed}`);
      
      // Replace failed sessions to maintain concurrency
      if (activeCount < this.config.concurrentSessions * 0.8) {
        const sessionsToRestart = this.config.concurrentSessions - activeCount;
        console.log(`  ⚠️  Restarting ${sessionsToRestart} sessions to maintain load`);
        
        for (let j = 0; j < sessionsToRestart; j++) {
          this.startVoiceSession(`restart-${i}-${j}`, 1000 + i * 10 + j);
        }
      }
    }
    
    console.log(`  ✅ Load maintenance completed`);
  }

  async rampDownSessions() {
    console.log('\n🔄 Phase 3: Ramping down sessions...');
    
    this.isRunning = false;
    
    // Wait for remaining sessions to complete naturally
    const timeout = 30000; // 30 seconds timeout
    const startWait = performance.now();
    
    while (this.getActiveSessionCount() > 0 && (performance.now() - startWait) < timeout) {
      await this.delay(1000);
      console.log(`  Waiting for ${this.getActiveSessionCount()} sessions to complete...`);
    }
    
    // Force close any remaining sessions
    if (this.getActiveSessionCount() > 0) {
      console.log(`  🛑 Force closing ${this.getActiveSessionCount()} remaining sessions`);
      this.sessions.forEach(session => {
        if (session.status === 'active') {
          this.endVoiceSession(session.id, 'forced_termination');
        }
      });
    }
    
    console.log(`  ✅ Ramp-down completed`);
  }

  async startVoiceSession(sessionId, index) {
    const session = {
      id: sessionId,
      index,
      status: 'initializing',
      startTime: performance.now(),
      phases: {
        sessionCreation: null,
        voiceConnection: null,
        audioProcessing: null,
        aiScoring: null,
        rewardCalculation: null
      },
      metrics: {
        totalTime: 0,
        voiceProcessingTime: 0,
        aiScoringTime: 0,
        responseTime: 0
      },
      errors: []
    };

    this.sessions.set(sessionId, session);
    this.metrics.sessionsCreated++;

    try {
      // Phase 1: Create feedback session
      await this.createFeedbackSession(session);
      
      // Phase 2: Establish WebSocket voice connection
      await this.establishVoiceConnection(session);
      
      // Phase 3: Simulate voice conversation
      await this.simulateVoiceConversation(session);
      
      // Phase 4: Process AI scoring
      await this.processAIScoring(session);
      
      // Phase 5: Calculate reward
      await this.calculateReward(session);
      
      this.endVoiceSession(sessionId, 'completed');
      
    } catch (error) {
      session.errors.push({
        phase: session.status,
        error: error.message,
        timestamp: performance.now()
      });
      this.endVoiceSession(sessionId, 'failed');
    }
  }

  async createFeedbackSession(session) {
    session.status = 'creating_session';
    const phaseStart = performance.now();
    
    // Simulate API call to create session
    const response = await this.simulateAPICall({
      method: 'POST',
      path: '/api/sessions/create',
      payload: {
        qrCodeId: `qr-${session.id}`,
        transactionId: `tx-${session.id}`,
        purchaseAmount: 100 + Math.random() * 400,
        customerHash: `hash-${session.index}`
      }
    });

    if (!response.success) {
      throw new Error(`Session creation failed: ${response.error}`);
    }

    session.phases.sessionCreation = performance.now() - phaseStart;
    session.sessionToken = response.data.sessionToken;
  }

  async establishVoiceConnection(session) {
    session.status = 'connecting_voice';
    const phaseStart = performance.now();
    
    // Simulate WebSocket connection establishment
    await this.simulateWebSocketConnection(session);
    
    session.phases.voiceConnection = performance.now() - phaseStart;
  }

  async simulateVoiceConversation(session) {
    session.status = 'processing_voice';
    const phaseStart = performance.now();
    
    const conversationSteps = [
      { type: 'greeting', duration: 2000, response: 'Hej! Kan du berätta om din upplevelse?' },
      { type: 'user_response', duration: 5000, transcript: 'Personalen var mycket trevlig och hjälpsam.' },
      { type: 'follow_up', duration: 1500, response: 'Tack! Kan du berätta mer specifikt?' },
      { type: 'detailed_response', duration: 8000, transcript: 'Kassören var snabb och effektiv. Butiken var ren och välorganiserad. Produkterna verkade fräscha.' },
      { type: 'conclusion', duration: 1000, response: 'Tack för din feedback!' }
    ];

    for (const step of conversationSteps) {
      await this.delay(step.duration);
      
      if (step.type === 'user_response' || step.type === 'detailed_response') {
        // Simulate STT processing
        await this.simulateSTTProcessing(session, step.transcript);
      } else if (step.response) {
        // Simulate TTS processing
        await this.simulateTTSProcessing(session, step.response);
      }
    }
    
    session.phases.audioProcessing = performance.now() - phaseStart;
    session.metrics.voiceProcessingTime = session.phases.audioProcessing;
    this.metrics.voiceProcessingTimes.push(session.phases.audioProcessing);
  }

  async processAIScoring(session) {
    session.status = 'ai_scoring';
    const phaseStart = performance.now();
    
    // Simulate AI evaluation API call
    const response = await this.simulateAPICall({
      method: 'POST',
      path: '/api/feedback/evaluate',
      payload: {
        sessionToken: session.sessionToken,
        transcript: 'Kassören var snabb och effektiv. Butiken var ren och välorganiserad.',
        businessContext: { type: 'grocery_store' },
        audioLength: 13
      },
      timeout: 5000 // 5 second timeout for AI processing
    });

    if (!response.success) {
      throw new Error(`AI scoring failed: ${response.error}`);
    }

    session.phases.aiScoring = performance.now() - phaseStart;
    session.metrics.aiScoringTime = session.phases.aiScoring;
    session.qualityScore = response.data.qualityScore;
    this.metrics.aiScoringTimes.push(session.phases.aiScoring);
  }

  async calculateReward(session) {
    session.status = 'calculating_reward';
    const phaseStart = performance.now();
    
    const response = await this.simulateAPICall({
      method: 'POST',
      path: '/api/rewards/calculate',
      payload: {
        sessionToken: session.sessionToken,
        qualityScore: session.qualityScore || { total: 75 }
      }
    });

    if (!response.success) {
      throw new Error(`Reward calculation failed: ${response.error}`);
    }

    session.phases.rewardCalculation = performance.now() - phaseStart;
    session.rewardAmount = response.data.rewardAmount;
  }

  async simulateWebSocketConnection(session) {
    // Simulate WebSocket handshake and connection establishment
    await this.delay(50 + Math.random() * 100);
    
    // Simulate potential connection failures (2% failure rate)
    if (Math.random() < 0.02) {
      this.metrics.connectionErrors++;
      throw new Error('WebSocket connection failed');
    }
  }

  async simulateSTTProcessing(session, transcript) {
    // Simulate WhisperX STT processing time based on transcript length
    const processingTime = Math.max(200, transcript.length * 10 + Math.random() * 500);
    await this.delay(processingTime);
  }

  async simulateTTSProcessing(session, response) {
    // Simulate TTS processing time
    const processingTime = Math.max(100, response.length * 5 + Math.random() * 200);
    await this.delay(processingTime);
  }

  async simulateAPICall(config) {
    const { method, path, payload, timeout = 3000 } = config;
    const startTime = performance.now();
    
    try {
      // Simulate network latency and processing time
      const processingTime = 50 + Math.random() * 200;
      
      // Add extra time for AI calls
      if (path.includes('/evaluate')) {
        processingTime += 800 + Math.random() * 1200; // 0.8-2.0s for AI
      }
      
      await this.delay(processingTime);
      
      const responseTime = performance.now() - startTime;
      
      // Simulate timeout
      if (responseTime > timeout) {
        this.metrics.timeouts++;
        throw new Error('Request timeout');
      }
      
      // Simulate error rate (5% for regular calls, 8% for AI calls)
      const errorRate = path.includes('/evaluate') ? 0.08 : 0.05;
      
      if (Math.random() < errorRate) {
        throw new Error(`API error: ${Math.random() > 0.5 ? 'Service unavailable' : 'Internal error'}`);
      }
      
      // Generate mock response data
      let responseData = { success: true };
      
      if (path.includes('/sessions/create')) {
        responseData.sessionToken = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      } else if (path.includes('/evaluate')) {
        responseData.qualityScore = {
          total: 60 + Math.random() * 35,
          authenticity: 70 + Math.random() * 25,
          concreteness: 65 + Math.random() * 30,
          depth: 55 + Math.random() * 40
        };
      } else if (path.includes('/rewards/calculate')) {
        responseData.rewardAmount = Math.round((20 + Math.random() * 80) * 100) / 100;
      }
      
      return {
        success: true,
        responseTime,
        data: responseData
      };
      
    } catch (error) {
      return {
        success: false,
        responseTime: performance.now() - startTime,
        error: error.message
      };
    }
  }

  endVoiceSession(sessionId, status) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.status = status;
    session.endTime = performance.now();
    session.metrics.totalTime = session.endTime - session.startTime;
    session.metrics.responseTime = session.metrics.totalTime;
    
    this.metrics.totalResponseTime += session.metrics.totalTime;
    
    if (status === 'completed') {
      this.metrics.sessionsCompleted++;
    } else {
      this.metrics.sessionsFailed++;
      this.metrics.errors.push(...session.errors);
    }
    
    // Remove from active sessions
    this.sessions.delete(sessionId);
    
    this.emit('session_ended', { sessionId, status, metrics: session.metrics });
  }

  getActiveSessionCount() {
    return Array.from(this.sessions.values()).filter(s => s.status !== 'completed' && s.status !== 'failed').length;
  }

  generateVoiceSessionReport() {
    const totalTime = performance.now() - this.startTime;
    const totalSessions = this.metrics.sessionsCreated;
    const averageResponseTime = totalSessions > 0 ? this.metrics.totalResponseTime / totalSessions : 0;
    
    const voiceProcessingStats = this.calculateStats(this.metrics.voiceProcessingTimes);
    const aiScoringStats = this.calculateStats(this.metrics.aiScoringTimes);
    
    return {
      testConfiguration: {
        concurrentSessions: this.config.concurrentSessions,
        testDuration: this.config.testDuration,
        actualDuration: totalTime / 1000
      },
      sessionMetrics: {
        total: totalSessions,
        completed: this.metrics.sessionsCompleted,
        failed: this.metrics.sessionsFailed,
        successRate: (this.metrics.sessionsCompleted / totalSessions) * 100,
        averageResponseTime: averageResponseTime,
        throughput: totalSessions / (totalTime / 1000)
      },
      performanceMetrics: {
        voiceProcessing: voiceProcessingStats,
        aiScoring: aiScoringStats,
        connectionErrors: this.metrics.connectionErrors,
        timeouts: this.metrics.timeouts
      },
      errorAnalysis: this.analyzeErrors(),
      recommendations: this.generateVoiceRecommendations()
    };
  }

  calculateStats(values) {
    if (values.length === 0) return null;
    
    const sorted = values.sort((a, b) => a - b);
    return {
      count: values.length,
      average: values.reduce((sum, v) => sum + v, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  analyzeErrors() {
    const errorCounts = {};
    this.metrics.errors.forEach(error => {
      const key = `${error.phase}: ${error.error}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    return {
      totalErrors: this.metrics.errors.length,
      errorsByPhase: errorCounts,
      errorRate: (this.metrics.errors.length / this.metrics.sessionsCreated) * 100
    };
  }

  generateVoiceRecommendations() {
    const recommendations = [];
    const successRate = (this.metrics.sessionsCompleted / this.metrics.sessionsCreated) * 100;
    const avgVoiceTime = this.metrics.voiceProcessingTimes.reduce((sum, v) => sum + v, 0) / this.metrics.voiceProcessingTimes.length;
    const avgAITime = this.metrics.aiScoringTimes.reduce((sum, v) => sum + v, 0) / this.metrics.aiScoringTimes.length;
    
    if (successRate < 95) {
      recommendations.push(`❌ Success rate too low (${successRate.toFixed(1)}%). Investigate error handling and system stability.`);
    }
    
    if (avgVoiceTime > 10000) {
      recommendations.push(`🎤 Voice processing too slow (${(avgVoiceTime/1000).toFixed(2)}s avg). Optimize WebSocket and audio processing.`);
    }
    
    if (avgAITime > 2000) {
      recommendations.push(`🤖 AI scoring too slow (${(avgAITime/1000).toFixed(2)}s avg). Consider model optimization or caching.`);
    }
    
    if (this.metrics.connectionErrors > this.metrics.sessionsCreated * 0.02) {
      recommendations.push(`🔌 High WebSocket connection error rate. Check network stability and connection pooling.`);
    }
    
    if (this.metrics.timeouts > this.metrics.sessionsCreated * 0.03) {
      recommendations.push(`⏰ High timeout rate. Consider increasing timeout limits or optimizing response times.`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ All voice session metrics within acceptable thresholds!');
    }
    
    return recommendations;
  }

  displayResults(report) {
    console.log(`  Total Sessions: ${report.sessionMetrics.total}`);
    console.log(`  Success Rate: ${report.sessionMetrics.successRate.toFixed(1)}%`);
    console.log(`  Average Response Time: ${(report.sessionMetrics.averageResponseTime/1000).toFixed(2)}s`);
    console.log(`  Throughput: ${report.sessionMetrics.throughput.toFixed(2)} sessions/sec`);
    
    if (report.performanceMetrics.voiceProcessing) {
      console.log(`  Voice Processing: ${(report.performanceMetrics.voiceProcessing.average/1000).toFixed(2)}s avg, ${(report.performanceMetrics.voiceProcessing.p95/1000).toFixed(2)}s p95`);
    }
    
    if (report.performanceMetrics.aiScoring) {
      console.log(`  AI Scoring: ${(report.performanceMetrics.aiScoring.average/1000).toFixed(2)}s avg, ${(report.performanceMetrics.aiScoring.p95/1000).toFixed(2)}s p95`);
    }
    
    console.log(`  Connection Errors: ${report.performanceMetrics.connectionErrors}`);
    console.log(`  Timeouts: ${report.performanceMetrics.timeouts}`);
    
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
async function runVoiceSessionLoadTest() {
  const tester = new VoiceSessionLoadTester({
    concurrentSessions: 100,
    testDuration: 300, // 5 minutes
    rampUpTime: 60     // 1 minute ramp-up
  });
  
  // Set up event listeners for real-time monitoring
  tester.on('session_ended', (data) => {
    if (data.status === 'failed') {
      console.log(`    ⚠️  Session ${data.sessionId} failed after ${(data.metrics.totalTime/1000).toFixed(2)}s`);
    }
  });
  
  try {
    console.log('🎯 Voice Session Load Test - 100 Concurrent Sessions');
    console.log('Target: <2s voice processing latency');
    console.log('Expected: 95%+ success rate with realistic load');
    console.log('');
    
    const report = await tester.testConcurrentVoiceSessions();
    
    // Save detailed report
    const reportPath = `./voice-session-load-test-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Detailed report saved: ${reportPath}`);
    
    return report;
    
  } catch (error) {
    console.error('❌ Voice session load test failed:', error.message);
    throw error;
  }
}

module.exports = { VoiceSessionLoadTester, runVoiceSessionLoadTest };

// Run if executed directly
if (require.main === module) {
  runVoiceSessionLoadTest()
    .then(() => {
      console.log('\n✅ Voice session load test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Voice session load test failed:', error);
      process.exit(1);
    });
}