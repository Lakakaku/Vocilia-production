import { WebSocketServer, WebSocket } from 'ws';
import { db } from '@ai-feedback/database';
import { UniversalAIService } from '@feedback-platform/ai-evaluator';
import { VoiceProcessor, BusinessContext, ContextManager } from '@feedback-platform/ai-evaluator';
import { ConversationStateManager, ConversationState, ConversationEvent } from './ConversationStateManager';
import { ConversationHandler, AdvancedVoiceSession } from './ConversationHandler';

interface VoiceSession {
  sessionId: string;
  businessId: string;
  chunks: Buffer[];
  startTime: number;
  lastChunkTime: number;
  isComplete: boolean;
  state: ConversationStateManager;
  bytesReceived: number;
}

// Store active voice sessions in memory (in production, use Redis)
const activeSessions = new Map<string, VoiceSession>();
const advancedSessions = new Map<string, AdvancedVoiceSession>();
const sessionClients = new Map<string, WebSocket>();

// In-memory voice/WebSocket analytics (privacy-safe, process-local)
type RecentEvent = { ts: number; type: 'open' | 'close' | 'error'; code?: number };
type DurationSample = { ts: number; ms: number };
type BytesSample = { ts: number; bytes: number };

const MAX_RECENT_EVENTS = 1000;
const SIXTY_MINUTES_MS = 60 * 60 * 1000;

const voiceAnalytics = {
  counters: {
    opened: 0,
    closed: 0,
    errors: 0,
    reconnects: 0
  },
  closeCodes: new Map<number, number>(),
  recentEvents: [] as RecentEvent[],
  sessionDurations: [] as DurationSample[],
  sessionBytes: [] as BytesSample[]
};

function recordEvent(event: RecentEvent): void {
  voiceAnalytics.recentEvents.push(event);
  if (voiceAnalytics.recentEvents.length > MAX_RECENT_EVENTS) {
    voiceAnalytics.recentEvents.shift();
  }
}

function incrementCloseCode(code: number): void {
  voiceAnalytics.closeCodes.set(code, (voiceAnalytics.closeCodes.get(code) || 0) + 1);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function getVoiceAnalytics() {
  const now = Date.now();
  const cutoff = now - SIXTY_MINUTES_MS;

  const recentDurations = voiceAnalytics.sessionDurations.filter(s => s.ts >= cutoff).map(s => s.ms);
  const recentBytes = voiceAnalytics.sessionBytes.filter(s => s.ts >= cutoff).map(s => s.bytes);

  const p50 = percentile(recentDurations, 50);
  const p90 = percentile(recentDurations, 90);
  const p99 = percentile(recentDurations, 99);
  const avgBytes = recentBytes.length > 0 ? Math.round(recentBytes.reduce((acc, v) => acc + v, 0) / recentBytes.length) : 0;

  const closeCodes: Record<string, number> = {};
  for (const [code, count] of voiceAnalytics.closeCodes.entries()) {
    closeCodes[String(code)] = count;
  }

  return {
    counters: { ...voiceAnalytics.counters },
    close_codes: closeCodes,
    histograms: {
      session_duration_ms: {
        p50,
        p90,
        p99
      },
      bytes_received_total: {
        avg: avgBytes
      }
    },
    recent_events: voiceAnalytics.recentEvents.slice(-100) // sample of most recent events
  };
}

// Initialize AI services
const aiService = new UniversalAIService({
  provider: 'ollama',
  model: 'llama3.2',
  endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
  temperature: 0.7
});

const voiceProcessor = new VoiceProcessor({
  sampleRate: 16000,
  language: 'sv' // Swedish
});

// Initialize context manager and conversation handler
const contextManager = new ContextManager();
const conversationHandler = new ConversationHandler(aiService, voiceProcessor, contextManager);

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    console.log('🎤 New WebSocket connection established');
    voiceAnalytics.counters.opened += 1;
    recordEvent({ ts: Date.now(), type: 'open' });

    ws.on('message', async (message: Buffer) => {
      try {
        // Parse message - could be JSON control message or binary audio data
        let parsedMessage;
        try {
          parsedMessage = JSON.parse(message.toString());
        } catch {
          // If parsing fails, treat as binary audio data
          parsedMessage = null;
        }

        if (parsedMessage) {
          // Handle control messages
          await handleControlMessage(ws, parsedMessage);
        } else {
          // Handle binary audio data
          await handleAudioChunk(ws, message);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        voiceAnalytics.counters.errors += 1;
        recordEvent({ ts: Date.now(), type: 'error' });
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message'
        }));
      }
    });

    ws.on('close', (code) => {
      console.log('🎤 WebSocket connection closed');
      voiceAnalytics.counters.closed += 1;
      incrementCloseCode(typeof code === 'number' ? code : 0);
      recordEvent({ ts: Date.now(), type: 'close', code: typeof code === 'number' ? code : undefined });
      // Clean up any active sessions for this connection
      cleanupConnectionSessions(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      voiceAnalytics.counters.errors += 1;
      recordEvent({ ts: Date.now(), type: 'error' });
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Voice WebSocket ready'
    }));
  });
}

export function getActiveVoiceSessionStats() {
  return {
    activeCount: activeSessions.size,
    activeSessionIds: Array.from(activeSessions.keys())
  };
}

async function handleControlMessage(ws: WebSocket, message: any) {
  const { type, sessionId, data } = message;

  switch (type) {
    case 'start_recording':
      await startRecording(ws, sessionId);
      break;

    case 'stop_recording':
      await stopRecording(ws, sessionId);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${type}`
      }));
  }
}

async function startRecording(ws: WebSocket, sessionId: string) {
  try {
    // Validate session exists and is in correct state
    const session = await db.getFeedbackSession(sessionId);
    if (!session) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Session not found'
      }));
      return;
    }

    if (session.status !== 'qr_scanned' && session.status !== 'recording') {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Session is not ready for recording'
      }));
      return;
    }

    // Heuristic: reconnect if a session with same ID already exists
    if (activeSessions.has(sessionId)) {
      voiceAnalytics.counters.reconnects += 1;
      // Replace existing mapping to new socket
      sessionClients.set(sessionId, ws);
    }

    // Create voice session
    const voiceSession: VoiceSession = {
      sessionId,
      businessId: session.business_id,
      chunks: [],
      startTime: Date.now(),
      lastChunkTime: Date.now(),
      isComplete: false,
      state: new ConversationStateManager(),
      bytesReceived: 0
    };

    activeSessions.set(sessionId, voiceSession);

    // Update database session status
    await db.updateFeedbackSession(sessionId, {
      status: 'recording'
    });

    // Store reference to websocket for this session
    (ws as any).sessionId = sessionId;
    sessionClients.set(sessionId, ws);

    ws.send(JSON.stringify({
      type: 'recording_started',
      sessionId,
      message: 'Recording started successfully'
    }));

    console.log(`🎤 Recording started for session ${sessionId}`);
  } catch (error) {
    console.error('Start recording error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to start recording'
    }));
  }
}

async function stopRecording(ws: WebSocket, sessionId: string) {
  try {
    const voiceSession = activeSessions.get(sessionId);
    if (!voiceSession) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'No active recording session found'
      }));
      return;
    }

    voiceSession.isComplete = true;
    voiceSession.state.commitUserUtterance();
    const durationMs = Date.now() - voiceSession.startTime;
    const totalDuration = Math.round(durationMs / 1000);

    // Combine all audio chunks
    const totalAudioData = Buffer.concat(voiceSession.chunks);

    // TODO: Save audio file (to Supabase Storage, AWS S3, etc.)
    // For now, we'll simulate this
    const audioUrl = `temp://${sessionId}-${Date.now()}.webm`;

    // Update session with audio data
    await db.updateFeedbackSession(sessionId, {
      audioDurationSeconds: totalDuration,
      audioUrl,
      status: 'processing'
    });

    // Record analytics samples (duration and total bytes)
    voiceAnalytics.sessionDurations.push({ ts: Date.now(), ms: durationMs });
    voiceAnalytics.sessionBytes.push({ ts: Date.now(), bytes: voiceSession.bytesReceived > 0 ? voiceSession.bytesReceived : totalAudioData.length });

    // Clean up session state; keep client mapping for response streaming
    activeSessions.delete(sessionId);

    ws.send(JSON.stringify({
      type: 'recording_stopped',
      sessionId,
      duration: totalDuration,
      audioSize: totalAudioData.length,
      message: 'Recording completed, processing started'
    }));

    // Trigger real AI processing pipeline
    console.log(`🎤 Recording completed for session ${sessionId}, ${totalDuration}s, ${totalAudioData.length} bytes`);

    // Process audio with real AI services
    const history = voiceSession.state.getHistoryStrings();
    processAudioWithAI(sessionId, totalAudioData, history).catch(error => {
      console.error('AI processing failed:', error);
    });

  } catch (error) {
    console.error('Stop recording error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to stop recording'
    }));
  }
}

async function handleAudioChunk(ws: WebSocket, audioData: Buffer) {
  const sessionId = (ws as any).sessionId;
  if (!sessionId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'No active recording session'
    }));
    return;
  }

  const voiceSession = activeSessions.get(sessionId);
  if (!voiceSession || voiceSession.isComplete) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Recording session not active'
    }));
    return;
  }

  // Store audio chunk
  voiceSession.chunks.push(audioData);
  voiceSession.lastChunkTime = Date.now();
  voiceSession.bytesReceived += audioData.length;

  // Check for recording timeout (max 2 minutes)
  const recordingDuration = Date.now() - voiceSession.startTime;
  if (recordingDuration > 2 * 60 * 1000) {
    await stopRecording(ws, sessionId);
    ws.send(JSON.stringify({
      type: 'warning',
      message: 'Recording automatically stopped due to time limit'
    }));
    return;
  }

  // Send acknowledgment for chunk received
  ws.send(JSON.stringify({
    type: 'chunk_received',
    chunkSize: audioData.length,
    totalChunks: voiceSession.chunks.length,
    duration: Math.round(recordingDuration / 1000)
  }));

  // Lightweight near-real-time transcription sampling every ~2s
  if (voiceSession.chunks.length % 4 === 0) {
    try {
      const sample = Buffer.concat(voiceSession.chunks.slice(-4));
      voiceProcessor.validateAudio(sample);
      const partial = await voiceProcessor.transcribe(sample);
      const partialText = (partial.text || '').trim();
      if (partialText.length > 0) {
        voiceSession.state.appendUserTranscript(partialText);
        ws.send(JSON.stringify({
          type: 'partial_transcript',
          text: partialText,
          confidence: partial.confidence,
          durationMs: partial.duration
        }));
      }
    } catch {
      // ignore partial transcription errors to keep stream resilient
    }
  }
}

function cleanupConnectionSessions(ws: WebSocket) {
  const sessionId = (ws as any).sessionId;
  if (sessionId && activeSessions.has(sessionId)) {
    console.log(`🧹 Cleaning up abandoned session ${sessionId}`);
    activeSessions.delete(sessionId);
    sessionClients.delete(sessionId);

    // Update session status in database
    db.updateFeedbackSession(sessionId, {
      status: 'failed',
      errorMessage: 'Connection lost during recording'
    }).catch(error => {
      console.error('Failed to update abandoned session:', error);
    });
  }
}

// Real AI processing with Ollama and voice transcription
async function processAudioWithAI(sessionId: string, audioBuffer: Buffer, history?: string[]) {
  const startTime = Date.now();
  
  try {
    console.log(`🤖 Starting real AI processing for session ${sessionId}...`);

    // Step 1: Get session details
    const session = await db.getFeedbackSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Step 2: Validate and transcribe audio
    console.log(`🎤 Transcribing audio (${audioBuffer.length} bytes)...`);
    voiceProcessor.validateAudio(audioBuffer);
    const transcriptionResult = await voiceProcessor.transcribe(audioBuffer);
    
    console.log(`📝 Transcription complete: "${transcriptionResult.text.substring(0, 100)}..."`);

    // Step 3: Get business context for AI evaluation
    const businessContext = await getBusinessContext(session.business_id);

    // Step 4: Get purchase items (mock for now - should come from POS integration)
    const purchaseItems = ['kaffe', 'smörgås']; // Mock items

    // Step 5: Evaluate feedback with AI
    console.log(`🧠 Evaluating feedback quality with Llama 3.2...`);
    const qualityScore = await aiService.evaluateFeedback(
      transcriptionResult.text,
      businessContext,
      purchaseItems
    );

    // Step 6: Calculate rewards
    const { rewardTier, rewardPercentage, rewardAmount } = calculateReward(
      qualityScore.total,
      session.purchase_amount || 150 // Default amount if not available
    );

    // Step 7: Update session with results
    const processingTime = Date.now() - startTime;
    
    await db.updateFeedbackSession(sessionId, {
      transcript: transcriptionResult.text,
      transcriptLanguage: transcriptionResult.language,
      aiEvaluation: {
        ...qualityScore,
        processingTimeMs: processingTime,
        modelUsed: 'llama3.2',
        transcriptionConfidence: transcriptionResult.confidence
      },
      qualityScore: qualityScore.total,
      authenticityScore: qualityScore.authenticity,
      concretenessScore: qualityScore.concreteness,
      depthScore: qualityScore.depth,
      sentimentScore: qualityScore.sentiment,
      feedbackCategories: qualityScore.categories,
      rewardTier,
      rewardAmount,
      rewardPercentage,
      fraudRiskScore: 0.1, // TODO: Implement proper fraud detection
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    console.log(`✅ AI processing completed for session ${sessionId}: ${qualityScore.total}/100 score, ${rewardAmount} SEK reward (${processingTime}ms)`);

    // Step 8: Generate conversational response for user follow-up
    const ws = findWebSocketBySessionId(sessionId);
    if (ws && (ws as any).readyState === WebSocket.OPEN) {
      const response = await aiService.generateResponse(
        transcriptionResult.text,
        history && history.length > 0 ? history : voiceSessionStateHistory(sessionId),
        businessContext
      );
      ws.send(JSON.stringify({ type: 'ai_response', response: response.response, continue: response.shouldContinue }));
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('AI processing error:', error);
    
    await db.updateFeedbackSession(sessionId, {
      status: 'failed',
      errorMessage: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      aiEvaluation: {
        processingTimeMs: processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

function findWebSocketBySessionId(sessionId: string): WebSocket | null {
  return sessionClients.get(sessionId) || null;
}

function voiceSessionStateHistory(sessionId: string): string[] {
  const s = activeSessions.get(sessionId);
  if (!s) return [];
  return s.state.getHistoryStrings();
}

// Get business context for AI evaluation
async function getBusinessContext(businessId: string): Promise<BusinessContext> {
  try {
    const business = await db.getBusiness(businessId);
    
    // Default context - in production this would come from the business profile
    return {
      type: 'cafe', // Default type
      layout: {
        departments: ['kaffe', 'bakverk', 'drycker'],
        checkouts: 2,
        selfCheckout: false
      },
      currentPromotions: ['Sommarlunch 89kr'],
      knownIssues: [],
      strengths: ['Färska råvaror', 'Vänlig personal']
    };
  } catch (error) {
    console.error('Failed to get business context:', error);
    
    // Return default context
    return {
      type: 'cafe',
      layout: {
        departments: ['service'],
        checkouts: 1,
        selfCheckout: false
      }
    };
  }
}

// Calculate reward tier and amount based on quality score
function calculateReward(qualityScore: number, transactionAmount: number) {
  let rewardTier = 'insufficient';
  let rewardPercentage = 0;

  if (qualityScore >= 90) {
    rewardTier = 'exceptional';
    rewardPercentage = 0.10; // 10%
  } else if (qualityScore >= 75) {
    rewardTier = 'very_good';
    rewardPercentage = 0.055; // 5.5%
  } else if (qualityScore >= 60) {
    rewardTier = 'acceptable';
    rewardPercentage = 0.02; // 2%
  }

  const rewardAmount = Math.round(transactionAmount * rewardPercentage * 100) / 100;

  return { rewardTier, rewardPercentage, rewardAmount };
}