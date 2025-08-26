// AI Service mocks for testing

const { TestDataFactory } = require('../utils/testHelpers');

/**
 * Mock Ollama AI Service
 */
class MockOllamaService {
  constructor() {
    this.isRunning = true;
    this.model = 'qwen2:0.5b';
    this.responses = new Map();
    
    // Pre-configured responses for common scenarios
    this.setupDefaultResponses();
  }

  setupDefaultResponses() {
    // Quality evaluation responses
    this.responses.set('quality_high', {
      authenticity: 88,
      concreteness: 85,
      depth: 90,
      total: 88,
      reasoning: 'Excellent feedback with specific details and authentic experience'
    });

    this.responses.set('quality_medium', {
      authenticity: 72,
      concreteness: 68,
      depth: 75,
      total: 72,
      reasoning: 'Good feedback with some specifics but could be more detailed'
    });

    this.responses.set('quality_low', {
      authenticity: 45,
      concreteness: 40,
      depth: 50,
      total: 45,
      reasoning: 'Generic feedback lacking specific details and authenticity'
    });

    // Conversation responses
    this.responses.set('greeting_sv', 'Hej! Tack för att du deltar i vårt feedbackprogram. Kan du berätta om din upplevelse idag?');
    this.responses.set('followup_sv', 'Kan du berätta mer specifikt om vad som var bra eller mindre bra?');
    this.responses.set('clarification_sv', 'Vilken del av servicen eller produkten skulle du vilja kommentera?');
    this.responses.set('closing_sv', 'Tack så mycket för din feedback! Den hjälper verkligen företaget att förbättra sig.');
  }

  async isAvailable() {
    return this.isRunning;
  }

  async generateResponse(prompt, options = {}) {
    // Simulate processing delay (optimized for qwen2:0.5b)
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));

    if (!this.isRunning) {
      throw new Error('Ollama service is not available');
    }

    // Analyze prompt to determine response type
    if (prompt.includes('quality') || prompt.includes('kvalitet')) {
      return this.generateQualityEvaluation(prompt);
    }

    if (prompt.includes('hej') || prompt.includes('greeting')) {
      return this.responses.get('greeting_sv');
    }

    if (prompt.includes('mer') || prompt.includes('followup')) {
      return this.responses.get('followup_sv');
    }

    if (prompt.includes('clarif') || prompt.includes('vilken')) {
      return this.responses.get('clarification_sv');
    }

    if (prompt.includes('tack') || prompt.includes('closing')) {
      return this.responses.get('closing_sv');
    }

    // Default conversational response
    return 'Tack för din kommentar. Kan du utveckla det lite mer?';
  }

  async evaluateFeedback(transcript, businessContext = {}, purchaseItems = []) {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 150));

    if (!this.isRunning) {
      throw new Error('Ollama service is not available');
    }

    // Analyze transcript to determine quality level
    const qualityLevel = this.analyzeTranscriptQuality(transcript);
    return this.responses.get(qualityLevel);
  }

  analyzeTranscriptQuality(transcript) {
    const lowQualityWords = ['bra', 'okej', 'ok', 'good', 'fine'];
    const highQualityWords = ['specifik', 'detaljerad', 'personal', 'atmosfär', 'kvalitet', 'service'];
    const mediumQualityWords = ['trevlig', 'mysig', 'snabb', 'ren', 'fräsch'];

    const words = transcript.toLowerCase().split(' ');
    
    let highScore = 0;
    let mediumScore = 0;
    let lowScore = 0;

    words.forEach(word => {
      if (highQualityWords.some(hw => word.includes(hw))) highScore++;
      if (mediumQualityWords.some(mw => word.includes(mw))) mediumScore++;
      if (lowQualityWords.some(lw => word.includes(lw))) lowScore++;
    });

    if (highScore >= 2 || (highScore >= 1 && mediumScore >= 2)) {
      return 'quality_high';
    } else if (mediumScore >= 2 || (mediumScore >= 1 && transcript.length > 50)) {
      return 'quality_medium';
    } else {
      return 'quality_low';
    }
  }

  generateQualityEvaluation(prompt) {
    // Extract transcript from prompt (simplified)
    const transcriptMatch = prompt.match(/feedback[:\s]+"([^"]+)"/i);
    const transcript = transcriptMatch ? transcriptMatch[1] : prompt;

    const qualityLevel = this.analyzeTranscriptQuality(transcript);
    const evaluation = this.responses.get(qualityLevel);

    return JSON.stringify(evaluation);
  }

  // Utility methods for testing
  setResponse(key, response) {
    this.responses.set(key, response);
  }

  simulateFailure() {
    this.isRunning = false;
  }

  restore() {
    this.isRunning = true;
  }

  getStats() {
    return {
      model: this.model,
      isRunning: this.isRunning,
      responsesConfigured: this.responses.size
    };
  }
}

/**
 * Mock conversation state manager
 */
class MockConversationStateManager {
  constructor() {
    this.states = new Map();
    this.transitions = {
      'waiting': ['greeting'],
      'greeting': ['collecting', 'clarifying'],
      'collecting': ['followup', 'clarifying', 'evaluating'],
      'clarifying': ['collecting', 'evaluating'],
      'followup': ['collecting', 'evaluating'],
      'evaluating': ['completed', 'failed'],
      'completed': [],
      'failed': ['greeting'] // Allow retry
    };
  }

  createSession(sessionId) {
    this.states.set(sessionId, {
      currentState: 'waiting',
      conversationHistory: [],
      context: {},
      startTime: Date.now(),
      lastActivity: Date.now()
    });
  }

  getState(sessionId) {
    return this.states.get(sessionId)?.currentState || null;
  }

  transition(sessionId, newState) {
    const session = this.states.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const currentState = session.currentState;
    const allowedTransitions = this.transitions[currentState] || [];

    if (!allowedTransitions.includes(newState)) {
      throw new Error(`Invalid transition from ${currentState} to ${newState}`);
    }

    session.currentState = newState;
    session.lastActivity = Date.now();

    return true;
  }

  addMessage(sessionId, message, isUser = true) {
    const session = this.states.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.conversationHistory.push({
      timestamp: Date.now(),
      message,
      isUser,
      state: session.currentState
    });

    session.lastActivity = Date.now();
  }

  getConversationHistory(sessionId) {
    const session = this.states.get(sessionId);
    return session ? session.conversationHistory : [];
  }

  cleanup(sessionId) {
    return this.states.delete(sessionId);
  }

  getSessionStats(sessionId) {
    const session = this.states.get(sessionId);
    if (!session) return null;

    return {
      duration: Date.now() - session.startTime,
      messageCount: session.conversationHistory.length,
      currentState: session.currentState,
      lastActivity: session.lastActivity
    };
  }
}

module.exports = {
  MockOllamaService,
  MockConversationStateManager
};