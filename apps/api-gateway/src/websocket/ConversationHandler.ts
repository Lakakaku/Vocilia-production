import { WebSocket } from 'ws';
import { ConversationStateManager, ConversationState, ConversationEvent } from './ConversationStateManager';
import { ContextManager, UniversalAIService, VoiceProcessor } from '@feedback-platform/ai-evaluator';

export interface AdvancedVoiceSession {
  sessionId: string;
  businessId: string;
  stateManager: ConversationStateManager;
  contextManager: ContextManager;
  chunks: Buffer[];
  startTime: number;
  lastChunkTime: number;
  lastSpeechTime: number;
  isComplete: boolean;
  silenceCount: number;
  interruptionCount: number;
  bytesReceived: number;
  processingAudio: boolean;
  pendingResponse: boolean;
  consecutiveSilence: number;
  voiceActivityDetected: boolean;
  responseTimeout?: NodeJS.Timeout;
  processingTimeout?: NodeJS.Timeout;
  silenceTimeout?: NodeJS.Timeout;
}

export class ConversationHandler {
  private aiService: UniversalAIService;
  private voiceProcessor: VoiceProcessor;
  private contextManager: ContextManager;
  
  // Timeout configurations
  private readonly SILENCE_WARNING_MS = 10000; // 10 seconds
  private readonly HARD_TIMEOUT_MS = 30000; // 30 seconds
  private readonly PROCESSING_TIMEOUT_MS = 5000; // 5 seconds
  private readonly RESPONSE_TIMEOUT_MS = 20000; // 20 seconds
  private readonly INTERRUPT_THRESHOLD = 3; // Max interruptions before guidance
  private readonly MAX_CONSECUTIVE_SILENCE = 2; // Max silence warnings before completion
  
  constructor(
    aiService: UniversalAIService,
    voiceProcessor: VoiceProcessor,
    contextManager: ContextManager
  ) {
    this.aiService = aiService;
    this.voiceProcessor = voiceProcessor;
    this.contextManager = contextManager;
  }

  public async initializeConversation(
    sessionId: string, 
    businessId: string, 
    ws: WebSocket
  ): Promise<AdvancedVoiceSession> {
    const stateManager = new ConversationStateManager(sessionId, businessId);
    
    const session: AdvancedVoiceSession = {
      sessionId,
      businessId,
      stateManager,
      contextManager: this.contextManager,
      chunks: [],
      startTime: Date.now(),
      lastChunkTime: Date.now(),
      lastSpeechTime: Date.now(),
      isComplete: false,
      silenceCount: 0,
      interruptionCount: 0,
      bytesReceived: 0,
      processingAudio: false,
      pendingResponse: false,
      consecutiveSilence: 0,
      voiceActivityDetected: false
    };

    // Set up state manager event listeners for advanced handling
    this.setupStateManagerListeners(session, ws);
    
    // Initialize conversation with greeting
    await this.startConversation(session, ws);
    
    return session;
  }

  public async handleAudioChunk(
    session: AdvancedVoiceSession, 
    audioData: Buffer, 
    ws: WebSocket
  ): Promise<void> {
    try {
      // Update timing information
      const now = Date.now();
      session.lastChunkTime = now;
      session.chunks.push(audioData);
      session.bytesReceived += audioData.length;

      // Check for voice activity (basic amplitude detection)
      const voiceActivity = this.detectVoiceActivity(audioData);
      
      if (voiceActivity) {
        session.lastSpeechTime = now;
        session.voiceActivityDetected = true;
        session.consecutiveSilence = 0;
        
        // Clear silence warnings if voice is detected
        this.clearSilenceTimeouts(session);
        
        // Notify state manager about voice activity
        if (session.stateManager.getCurrentState() === ConversationState.LISTENING) {
          await session.stateManager.transitionState(ConversationEvent.AUDIO_RECEIVED, { 
            chunkSize: audioData.length 
          });
        }
        
        // Handle potential interruption
        if (session.pendingResponse && session.stateManager.getCurrentState() === ConversationState.RESPONDING) {
          await this.handleInterruption(session, ws);
        }
      } else {
        // Handle silence
        await this.handleSilence(session, ws, now);
      }

      // Real-time transcription for longer chunks
      if (session.chunks.length % 4 === 0 && voiceActivity) {
        await this.processPartialTranscription(session, ws);
      }

      // Send acknowledgment with enhanced metadata
      ws.send(JSON.stringify({
        type: 'chunk_received',
        sessionId: session.sessionId,
        chunkSize: audioData.length,
        totalChunks: session.chunks.length,
        duration: Math.round((now - session.startTime) / 1000),
        voiceActivity,
        conversationState: session.stateManager.getCurrentState(),
        silenceCount: session.silenceCount
      }));

    } catch (error) {
      console.error('Audio chunk handling error:', error);
      await session.stateManager.handleError(
        error as Error, 
        'Audio chunk processing failed'
      );
      this.sendErrorToClient(ws, 'Failed to process audio chunk');
    }
  }

  public async completeConversation(
    session: AdvancedVoiceSession, 
    ws: WebSocket,
    reason: string = 'Natural completion'
  ): Promise<void> {
    try {
      console.log(`🏁 Completing conversation for session ${session.sessionId}: ${reason}`);
      
      // Clear all timeouts
      this.clearAllTimeouts(session);
      
      // Force state transition to completion
      await session.stateManager.forceComplete(reason);
      
      // Mark session as complete
      session.isComplete = true;
      
      // Process final audio if available
      if (session.chunks.length > 0 && !session.processingAudio) {
        await this.processFinalAudio(session, ws);
      }
      
      // Send completion notification
      ws.send(JSON.stringify({
        type: 'conversation_completed',
        sessionId: session.sessionId,
        reason,
        metrics: session.stateManager.getMetrics()
      }));

    } catch (error) {
      console.error('Conversation completion error:', error);
      await session.stateManager.handleError(
        error as Error, 
        'Conversation completion failed'
      );
    }
  }

  public async handleInterruption(session: AdvancedVoiceSession, ws: WebSocket): Promise<void> {
    session.interruptionCount++;
    console.log(`👋 Interruption detected for session ${session.sessionId} (count: ${session.interruptionCount})`);
    
    // Clear any pending response timeouts
    if (session.responseTimeout) {
      clearTimeout(session.responseTimeout);
      session.responseTimeout = undefined;
    }
    
    // Transition back to listening state
    await session.stateManager.transitionState(ConversationEvent.USER_SPOKE);
    session.pendingResponse = false;
    
    // Send interruption acknowledgment
    ws.send(JSON.stringify({
      type: 'interruption_detected',
      sessionId: session.sessionId,
      interruptionCount: session.interruptionCount,
      message: 'Lyssnar på dig...'
    }));
    
    // Provide guidance if too many interruptions
    if (session.interruptionCount >= this.INTERRUPT_THRESHOLD) {
      await this.sendGuidanceMessage(session, ws, 'interrupt');
    }
  }

  // Private helper methods

  private setupStateManagerListeners(session: AdvancedVoiceSession, ws: WebSocket): void {
    const stateManager = session.stateManager;

    // Listen for silence warnings
    stateManager.on('silenceWarning', async () => {
      await this.handleSilenceWarning(session, ws);
    });

    // Listen for hard timeouts
    stateManager.on('hardTimeout', async () => {
      await this.completeConversation(session, ws, 'Hard timeout reached');
    });

    // Listen for state changes
    stateManager.on('stateChanged', async ({ currentState, previousState, event }) => {
      console.log(`🔄 Conversation state: ${previousState} -> ${currentState} (${event})`);
      
      // Set up appropriate timeouts for new state
      await this.setupStateTimeouts(session, currentState, ws);
      
      // Notify client of state change
      ws.send(JSON.stringify({
        type: 'state_changed',
        sessionId: session.sessionId,
        state: currentState,
        previousState,
        event
      }));
    });

    // Listen for errors
    stateManager.on('error', async ({ error, context }) => {
      console.error(`❌ Conversation error: ${error.message} (${context})`);
      this.sendErrorToClient(ws, `Conversation error: ${context}`);
    });
  }

  private async startConversation(session: AdvancedVoiceSession, ws: WebSocket): Promise<void> {
    try {
      // Initialize the conversation
      await session.stateManager.transitionState(ConversationEvent.INITIALIZE);
      
      // Load business context
      const businessContext = await session.contextManager.loadBusinessContext(session.businessId);
      
      // Generate personalized greeting
      const greeting = session.contextManager.generateConversationStarter(businessContext);
      
      // Send greeting to client
      await this.sendAIResponse(session, ws, greeting);
      
      // Transition to listening state
      await session.stateManager.transitionState(ConversationEvent.GREETING_SENT);
      
      console.log(`🤖 Conversation started for session ${session.sessionId}`);
    } catch (error) {
      console.error('Conversation start error:', error);
      await session.stateManager.handleError(error as Error, 'Failed to start conversation');
    }
  }

  private async handleSilence(
    session: AdvancedVoiceSession, 
    ws: WebSocket, 
    currentTime: number
  ): Promise<void> {
    const silenceDuration = currentTime - session.lastSpeechTime;
    
    if (silenceDuration > this.SILENCE_WARNING_MS && !session.silenceTimeout) {
      // Set up silence warning timeout
      session.silenceTimeout = setTimeout(async () => {
        await this.handleSilenceWarning(session, ws);
      }, this.SILENCE_WARNING_MS - silenceDuration);
    }
  }

  private async handleSilenceWarning(session: AdvancedVoiceSession, ws: WebSocket): Promise<void> {
    session.silenceCount++;
    session.consecutiveSilence++;
    
    console.log(`🔇 Silence warning for session ${session.sessionId} (count: ${session.silenceCount})`);
    
    // Send progressive silence prompts
    let silenceMessage = '';
    if (session.consecutiveSilence === 1) {
      silenceMessage = 'Är du fortfarande där? Jag lyssnar på din feedback...';
    } else if (session.consecutiveSilence === 2) {
      silenceMessage = 'Säg till när du är redo att fortsätta, eller så avslutar vi snart...';
    } else {
      // Too many silence warnings, complete conversation
      await this.completeConversation(session, ws, 'Excessive silence');
      return;
    }
    
    // Transition to timeout state
    await session.stateManager.transitionState(ConversationEvent.SILENCE_DETECTED);
    
    // Send silence warning message
    await this.sendAIResponse(session, ws, silenceMessage);
    
    // Set up recovery timeout
    session.responseTimeout = setTimeout(async () => {
      if (session.consecutiveSilence >= this.MAX_CONSECUTIVE_SILENCE) {
        await this.completeConversation(session, ws, 'No response after warnings');
      } else {
        await session.stateManager.transitionState(ConversationEvent.RECOVERY_ATTEMPTED);
      }
    }, this.RESPONSE_TIMEOUT_MS);
  }

  private async processPartialTranscription(session: AdvancedVoiceSession, ws: WebSocket): Promise<void> {
    try {
      // Combine recent chunks for transcription
      const recentChunks = session.chunks.slice(-4);
      const audioSample = Buffer.concat(recentChunks);
      
      // Validate and transcribe
      this.voiceProcessor.validateAudio(audioSample);
      const partialResult = await this.voiceProcessor.transcribe(audioSample);
      
      if (partialResult.text && partialResult.text.trim().length > 0) {
        // Update conversation state
        session.stateManager.appendUserTranscript(partialResult.text, partialResult.confidence);
        
        // Send partial transcript to client
        ws.send(JSON.stringify({
          type: 'partial_transcript',
          sessionId: session.sessionId,
          text: partialResult.text.trim(),
          confidence: partialResult.confidence,
          isPartial: true
        }));
        
        // Transition to processing if we have substantial text
        if (partialResult.text.trim().length > 20 && partialResult.confidence > 0.7) {
          await session.stateManager.transitionState(ConversationEvent.TRANSCRIPTION_READY);
        }
      }
    } catch (error) {
      // Ignore partial transcription errors to keep stream resilient
      console.debug('Partial transcription error (ignored):', error);
    }
  }

  private async processFinalAudio(session: AdvancedVoiceSession, ws: WebSocket): Promise<void> {
    if (session.processingAudio) return; // Prevent duplicate processing
    
    session.processingAudio = true;
    const startTime = Date.now();
    
    try {
      console.log(`🎤 Processing final audio for session ${session.sessionId}...`);
      
      // Combine all audio chunks
      const totalAudioData = Buffer.concat(session.chunks);
      
      // Transcribe complete audio
      this.voiceProcessor.validateAudio(totalAudioData);
      const transcriptionResult = await this.voiceProcessor.transcribe(totalAudioData);
      
      // Commit final transcript
      session.stateManager.appendUserTranscript(
        transcriptionResult.text, 
        transcriptionResult.confidence
      );
      session.stateManager.commitUserUtterance();
      
      // Load business context for evaluation
      const businessContext = await session.contextManager.loadBusinessContext(session.businessId);
      
      // Evaluate feedback quality
      const qualityScore = await this.aiService.evaluateFeedback(
        transcriptionResult.text,
        businessContext,
        [] // Purchase items would come from POS integration
      );
      
      const processingTime = Date.now() - startTime;
      
      // Send final results
      ws.send(JSON.stringify({
        type: 'processing_complete',
        sessionId: session.sessionId,
        transcript: transcriptionResult.text,
        confidence: transcriptionResult.confidence,
        qualityScore,
        processingTimeMs: processingTime
      }));
      
      console.log(`✅ Audio processing complete for session ${session.sessionId} (${processingTime}ms)`);
      
    } catch (error) {
      console.error('Final audio processing error:', error);
      await session.stateManager.handleError(error as Error, 'Final audio processing failed');
    } finally {
      session.processingAudio = false;
    }
  }

  private detectVoiceActivity(audioData: Buffer): boolean {
    // Simple voice activity detection based on amplitude
    // In production, this could be more sophisticated
    let sum = 0;
    for (let i = 0; i < audioData.length; i += 2) {
      const sample = audioData.readInt16LE(i);
      sum += Math.abs(sample);
    }
    
    const averageAmplitude = sum / (audioData.length / 2);
    const threshold = 1000; // Adjust based on testing
    
    return averageAmplitude > threshold;
  }

  private async setupStateTimeouts(
    session: AdvancedVoiceSession, 
    state: ConversationState, 
    ws: WebSocket
  ): Promise<void> {
    // Clear existing timeouts
    this.clearAllTimeouts(session);
    
    switch (state) {
      case ConversationState.PROCESSING:
        session.processingTimeout = setTimeout(async () => {
          await session.stateManager.handleError(
            new Error('Processing timeout'), 
            'AI processing took too long'
          );
        }, this.PROCESSING_TIMEOUT_MS);
        break;
        
      case ConversationState.WAITING_FOR_RESPONSE:
        session.responseTimeout = setTimeout(async () => {
          await session.stateManager.transitionState(ConversationEvent.TIMEOUT_REACHED);
        }, this.RESPONSE_TIMEOUT_MS);
        break;
    }
  }

  private async sendAIResponse(session: AdvancedVoiceSession, ws: WebSocket, message: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Add response to conversation history
      session.stateManager.addSystemResponse(message, Date.now() - startTime);
      
      // Send to client
      ws.send(JSON.stringify({
        type: 'ai_response',
        sessionId: session.sessionId,
        message,
        timestamp: new Date().toISOString()
      }));
      
      // Transition state
      await session.stateManager.transitionState(ConversationEvent.RESPONSE_SENT);
      session.pendingResponse = true;
      
    } catch (error) {
      console.error('AI response sending error:', error);
      await session.stateManager.handleError(error as Error, 'Failed to send AI response');
    }
  }

  private async sendGuidanceMessage(
    session: AdvancedVoiceSession, 
    ws: WebSocket, 
    type: 'interrupt' | 'silence'
  ): Promise<void> {
    let guidanceMessage = '';
    
    switch (type) {
      case 'interrupt':
        guidanceMessage = 'Jag märker att du avbryter ofta. Låt mig prata färdigt först, så lyssnar jag sedan på dig.';
        break;
      case 'silence':
        guidanceMessage = 'Det verkar vara tyst där. Berätta gärna vad du tänker om ditt besök idag.';
        break;
    }
    
    await this.sendAIResponse(session, ws, guidanceMessage);
  }

  private clearAllTimeouts(session: AdvancedVoiceSession): void {
    if (session.responseTimeout) {
      clearTimeout(session.responseTimeout);
      session.responseTimeout = undefined;
    }
    
    if (session.processingTimeout) {
      clearTimeout(session.processingTimeout);
      session.processingTimeout = undefined;
    }
    
    if (session.silenceTimeout) {
      clearTimeout(session.silenceTimeout);
      session.silenceTimeout = undefined;
    }
  }

  private clearSilenceTimeouts(session: AdvancedVoiceSession): void {
    if (session.silenceTimeout) {
      clearTimeout(session.silenceTimeout);
      session.silenceTimeout = undefined;
    }
  }

  private sendErrorToClient(ws: WebSocket, message: string): void {
    ws.send(JSON.stringify({
      type: 'error',
      message,
      timestamp: new Date().toISOString()
    }));
  }
}