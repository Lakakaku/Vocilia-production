import { EventEmitter } from 'events';

export enum ConversationState {
  INITIALIZING = 'initializing',
  GREETING = 'greeting',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  RESPONDING = 'responding',
  WAITING_FOR_RESPONSE = 'waiting_for_response',
  COMPLETING = 'completing',
  COMPLETED = 'completed',
  ERROR = 'error',
  TIMEOUT = 'timeout'
}

export enum ConversationEvent {
  INITIALIZE = 'initialize',
  START_GREETING = 'start_greeting',
  GREETING_SENT = 'greeting_sent',
  AUDIO_RECEIVED = 'audio_received',
  TRANSCRIPTION_READY = 'transcription_ready',
  AI_RESPONSE_READY = 'ai_response_ready',
  RESPONSE_SENT = 'response_sent',
  USER_SPOKE = 'user_spoke',
  SILENCE_DETECTED = 'silence_detected',
  TIMEOUT_REACHED = 'timeout_reached',
  CONVERSATION_COMPLETE = 'conversation_complete',
  ERROR_OCCURRED = 'error_occurred',
  RECOVERY_ATTEMPTED = 'recovery_attempted'
}

interface ConversationTurn {
  timestamp: Date;
  type: 'user' | 'ai' | 'system';
  content: string;
  audioData?: Buffer;
  processingTime?: number;
  confidence?: number;
  state?: ConversationState;
}

interface StateTransition {
  from: ConversationState;
  to: ConversationState;
  event: ConversationEvent;
  condition?: () => boolean;
  action?: () => Promise<void> | void;
}

interface ConversationMetrics {
  startTime: Date;
  stateTransitions: Array<{ from: ConversationState; to: ConversationState; timestamp: Date; event: ConversationEvent }>;
  totalTurns: number;
  averageResponseTime: number;
  silencePeriods: Array<{ start: Date; duration: number }>;
  errors: Array<{ timestamp: Date; error: string; state: ConversationState }>;
}

export class ConversationStateManager extends EventEmitter {
  private currentState: ConversationState = ConversationState.INITIALIZING;
  private conversationHistory: ConversationTurn[] = [];
  private lastFinalTranscript: string = '';
  private sessionId: string;
  private businessId: string;
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private metrics: ConversationMetrics;
  private readonly maxHistoryLength: number = 20; // Sliding window size
  private readonly stateTransitionTimeout: number = 100; // Max time for state transitions
  
  // State transition table
  private readonly transitions: StateTransition[] = [
    // Initialization flow
    { from: ConversationState.INITIALIZING, to: ConversationState.GREETING, event: ConversationEvent.INITIALIZE },
    { from: ConversationState.GREETING, to: ConversationState.LISTENING, event: ConversationEvent.GREETING_SENT },
    
    // Main conversation flow
    { from: ConversationState.LISTENING, to: ConversationState.PROCESSING, event: ConversationEvent.AUDIO_RECEIVED },
    { from: ConversationState.PROCESSING, to: ConversationState.RESPONDING, event: ConversationEvent.TRANSCRIPTION_READY },
    { from: ConversationState.RESPONDING, to: ConversationState.WAITING_FOR_RESPONSE, event: ConversationEvent.RESPONSE_SENT },
    { from: ConversationState.WAITING_FOR_RESPONSE, to: ConversationState.LISTENING, event: ConversationEvent.USER_SPOKE },
    
    // Completion flow
    { from: ConversationState.LISTENING, to: ConversationState.COMPLETING, event: ConversationEvent.CONVERSATION_COMPLETE },
    { from: ConversationState.WAITING_FOR_RESPONSE, to: ConversationState.COMPLETING, event: ConversationEvent.CONVERSATION_COMPLETE },
    { from: ConversationState.COMPLETING, to: ConversationState.COMPLETED, event: ConversationEvent.AI_RESPONSE_READY },
    
    // Timeout handling
    { from: ConversationState.LISTENING, to: ConversationState.TIMEOUT, event: ConversationEvent.SILENCE_DETECTED },
    { from: ConversationState.WAITING_FOR_RESPONSE, to: ConversationState.TIMEOUT, event: ConversationEvent.TIMEOUT_REACHED },
    { from: ConversationState.TIMEOUT, to: ConversationState.LISTENING, event: ConversationEvent.RECOVERY_ATTEMPTED },
    { from: ConversationState.TIMEOUT, to: ConversationState.COMPLETING, event: ConversationEvent.CONVERSATION_COMPLETE },
    
    // Error handling - any state can transition to error
    { from: ConversationState.GREETING, to: ConversationState.ERROR, event: ConversationEvent.ERROR_OCCURRED },
    { from: ConversationState.LISTENING, to: ConversationState.ERROR, event: ConversationEvent.ERROR_OCCURRED },
    { from: ConversationState.PROCESSING, to: ConversationState.ERROR, event: ConversationEvent.ERROR_OCCURRED },
    { from: ConversationState.RESPONDING, to: ConversationState.ERROR, event: ConversationEvent.ERROR_OCCURRED },
    { from: ConversationState.WAITING_FOR_RESPONSE, to: ConversationState.ERROR, event: ConversationEvent.ERROR_OCCURRED },
    
    // Error recovery
    { from: ConversationState.ERROR, to: ConversationState.LISTENING, event: ConversationEvent.RECOVERY_ATTEMPTED },
    { from: ConversationState.ERROR, to: ConversationState.COMPLETING, event: ConversationEvent.CONVERSATION_COMPLETE }
  ];

  constructor(sessionId: string, businessId: string) {
    super();
    this.sessionId = sessionId;
    this.businessId = businessId;
    this.metrics = {
      startTime: new Date(),
      stateTransitions: [],
      totalTurns: 0,
      averageResponseTime: 0,
      silencePeriods: [],
      errors: []
    };

    // Set up automatic timeout handling
    this.setupTimeoutHandlers();
    
    console.log(`🤖 ConversationStateManager initialized for session ${sessionId}`);
  }

  /**
   * Transition to a new state based on an event
   */
  public async transitionState(event: ConversationEvent, data?: any): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const validTransition = this.transitions.find(t => 
        t.from === this.currentState && 
        t.event === event &&
        (t.condition ? t.condition() : true)
      );

      if (!validTransition) {
        console.warn(`⚠️  Invalid state transition: ${this.currentState} -> ${event}`);
        this.emit('warning', {
          type: 'invalid_transition',
          currentState: this.currentState,
          event,
          data
        });
        return false;
      }

      const previousState = this.currentState;
      this.currentState = validTransition.to;

      // Record transition in metrics
      this.metrics.stateTransitions.push({
        from: previousState,
        to: this.currentState,
        timestamp: new Date(),
        event
      });

      // Execute transition action if defined
      if (validTransition.action) {
        await validTransition.action();
      }

      // Clear any existing timeouts for the previous state
      this.clearTimeoutsForState(previousState);

      // Set up timeouts for the new state
      this.setupTimeoutsForState(this.currentState);

      const transitionTime = Date.now() - startTime;
      if (transitionTime > this.stateTransitionTimeout) {
        console.warn(`⚠️  Slow state transition: ${transitionTime}ms (${previousState} -> ${this.currentState})`);
      }

      console.log(`🔄 State transition: ${previousState} -> ${this.currentState} (${event})`);
      
      // Emit state change event
      this.emit('stateChanged', {
        previousState,
        currentState: this.currentState,
        event,
        transitionTime,
        data
      });

      return true;
    } catch (error) {
      console.error('State transition error:', error);
      this.recordError(error as Error, `State transition failed: ${this.currentState} -> ${event}`);
      await this.transitionState(ConversationEvent.ERROR_OCCURRED, { error });
      return false;
    }
  }

  /**
   * Get current conversation state
   */
  public getCurrentState(): ConversationState {
    return this.currentState;
  }

  /**
   * Check if conversation is in a terminal state
   */
  public isComplete(): boolean {
    return this.currentState === ConversationState.COMPLETED || 
           this.currentState === ConversationState.ERROR;
  }

  /**
   * Check if conversation is actively processing
   */
  public isProcessing(): boolean {
    return this.currentState === ConversationState.PROCESSING || 
           this.currentState === ConversationState.RESPONDING;
  }

  /**
   * Check if conversation is waiting for user input
   */
  public isWaitingForUser(): boolean {
    return this.currentState === ConversationState.LISTENING || 
           this.currentState === ConversationState.WAITING_FOR_RESPONSE;
  }

  /**
   * Add user transcript to conversation history
   */
  public appendUserTranscript(transcript: string, confidence?: number): void {
    this.lastFinalTranscript = transcript;
    this.emit('transcriptReceived', { transcript, confidence });
  }

  /**
   * Commit user utterance to history
   */
  public commitUserUtterance(): void {
    if (this.lastFinalTranscript && this.lastFinalTranscript.trim().length > 0) {
      const turn: ConversationTurn = {
        timestamp: new Date(),
        type: 'user',
        content: this.lastFinalTranscript.trim(),
        state: this.currentState
      };
      
      this.addToHistory(turn);
      this.lastFinalTranscript = '';
      this.metrics.totalTurns++;
    }
  }

  /**
   * Add AI response to conversation history
   */
  public addSystemResponse(response: string, processingTime?: number): void {
    const turn: ConversationTurn = {
      timestamp: new Date(),
      type: 'ai',
      content: response.trim(),
      processingTime,
      state: this.currentState
    };
    
    this.addToHistory(turn);
    this.updateAverageResponseTime(processingTime || 0);
    this.emit('responseAdded', { response, processingTime });
  }

  /**
   * Get conversation history as strings (backward compatibility)
   */
  public getHistoryStrings(): string[] {
    return this.conversationHistory.map(turn => turn.content);
  }

  /**
   * Get full conversation history with metadata
   */
  public getFullHistory(): ConversationTurn[] {
    return [...this.conversationHistory];
  }

  /**
   * Get conversation context for AI (last N turns)
   */
  public getConversationContext(maxTurns: number = 10): string {
    const recentTurns = this.conversationHistory.slice(-maxTurns);
    return recentTurns
      .map(turn => `${turn.type === 'user' ? 'Kund' : 'AI'}: ${turn.content}`)
      .join('\n');
  }

  /**
   * Get conversation metrics
   */
  public getMetrics(): ConversationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset conversation state
   */
  public reset(): void {
    this.clearAllTimeouts();
    this.currentState = ConversationState.INITIALIZING;
    this.conversationHistory = [];
    this.lastFinalTranscript = '';
    this.metrics = {
      startTime: new Date(),
      stateTransitions: [],
      totalTurns: 0,
      averageResponseTime: 0,
      silencePeriods: [],
      errors: []
    };
    
    console.log(`🔄 ConversationStateManager reset for session ${this.sessionId}`);
    this.emit('reset');
  }

  /**
   * Force transition to completion state
   */
  public async forceComplete(reason: string = 'Manual completion'): Promise<void> {
    console.log(`🏁 Forcing conversation completion: ${reason}`);
    await this.transitionState(ConversationEvent.CONVERSATION_COMPLETE, { reason });
  }

  /**
   * Handle errors with recovery attempts
   */
  public async handleError(error: Error, context: string): Promise<void> {
    this.recordError(error, context);
    await this.transitionState(ConversationEvent.ERROR_OCCURRED, { error, context });
    
    // Attempt automatic recovery after a short delay
    setTimeout(async () => {
      if (this.currentState === ConversationState.ERROR) {
        console.log('🔧 Attempting automatic error recovery...');
        await this.transitionState(ConversationEvent.RECOVERY_ATTEMPTED);
      }
    }, 2000);
  }

  // Private helper methods

  private addToHistory(turn: ConversationTurn): void {
    this.conversationHistory.push(turn);
    
    // Maintain sliding window
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory.shift();
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalResponses = this.conversationHistory.filter(t => t.type === 'ai').length;
    if (totalResponses > 0) {
      this.metrics.averageResponseTime = 
        ((this.metrics.averageResponseTime * (totalResponses - 1)) + responseTime) / totalResponses;
    }
  }

  private recordError(error: Error, context: string): void {
    this.metrics.errors.push({
      timestamp: new Date(),
      error: `${error.message} - ${context}`,
      state: this.currentState
    });
    
    console.error(`❌ Conversation error in state ${this.currentState}:`, error.message, context);
    this.emit('error', { error, context, state: this.currentState });
  }

  private setupTimeoutHandlers(): void {
    // Set up basic timeout monitoring
    this.on('stateChanged', ({ currentState }) => {
      this.setupTimeoutsForState(currentState);
    });
  }

  private setupTimeoutsForState(state: ConversationState): void {
    // Clear existing timeouts
    this.clearTimeoutsForState(state);

    switch (state) {
      case ConversationState.LISTENING:
        // 10 second silence warning, 30 second hard timeout
        this.setStateTimeout('silence_warning', 10000, async () => {
          this.emit('silenceWarning');
          await this.transitionState(ConversationEvent.SILENCE_DETECTED);
        });
        
        this.setStateTimeout('hard_timeout', 30000, async () => {
          this.emit('hardTimeout');
          await this.forceComplete('Hard timeout reached');
        });
        break;

      case ConversationState.PROCESSING:
        // AI processing should not take longer than 5 seconds
        this.setStateTimeout('processing_timeout', 5000, async () => {
          await this.handleError(new Error('AI processing timeout'), 'Processing took too long');
        });
        break;

      case ConversationState.WAITING_FOR_RESPONSE:
        // User should respond within 20 seconds
        this.setStateTimeout('response_timeout', 20000, async () => {
          await this.transitionState(ConversationEvent.TIMEOUT_REACHED);
        });
        break;
    }
  }

  private setStateTimeout(name: string, delay: number, callback: () => void): void {
    const timeoutId = setTimeout(callback, delay);
    this.timeouts.set(name, timeoutId);
  }

  private clearTimeoutsForState(state: ConversationState): void {
    // Clear all timeouts when transitioning from a state
    for (const [name, timeoutId] of this.timeouts.entries()) {
      clearTimeout(timeoutId);
      this.timeouts.delete(name);
    }
  }

  private clearAllTimeouts(): void {
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
  }
}