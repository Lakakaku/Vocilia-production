import { WebSocketServer, WebSocket } from 'ws';
import { db } from '@ai-feedback/database';
import type { VoiceChunk } from '@ai-feedback/shared-types';

interface VoiceSession {
  sessionId: string;
  businessId: string;
  chunks: Buffer[];
  startTime: number;
  lastChunkTime: number;
  isComplete: boolean;
}

// Store active voice sessions in memory (in production, use Redis)
const activeSessions = new Map<string, VoiceSession>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    console.log('🎤 New WebSocket connection established');

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
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message'
        }));
      }
    });

    ws.on('close', () => {
      console.log('🎤 WebSocket connection closed');
      // Clean up any active sessions for this connection
      cleanupConnectionSessions(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Voice WebSocket ready'
    }));
  });
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

    // Create voice session
    const voiceSession: VoiceSession = {
      sessionId,
      businessId: session.business_id,
      chunks: [],
      startTime: Date.now(),
      lastChunkTime: Date.now(),
      isComplete: false
    };

    activeSessions.set(sessionId, voiceSession);

    // Update database session status
    await db.updateFeedbackSession(sessionId, {
      status: 'recording'
    });

    // Store reference to websocket for this session
    (ws as any).sessionId = sessionId;

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
    const totalDuration = Math.round((Date.now() - voiceSession.startTime) / 1000);

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

    // Clean up session
    activeSessions.delete(sessionId);

    ws.send(JSON.stringify({
      type: 'recording_stopped',
      sessionId,
      duration: totalDuration,
      audioSize: totalAudioData.length,
      message: 'Recording completed, processing started'
    }));

    // TODO: Trigger AI processing pipeline
    console.log(`🎤 Recording completed for session ${sessionId}, ${totalDuration}s, ${totalAudioData.length} bytes`);

    // Simulate AI processing (in real implementation, this would be queued)
    setTimeout(() => simulateAIProcessing(sessionId), 2000);

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
}

function cleanupConnectionSessions(ws: WebSocket) {
  const sessionId = (ws as any).sessionId;
  if (sessionId && activeSessions.has(sessionId)) {
    console.log(`🧹 Cleaning up abandoned session ${sessionId}`);
    activeSessions.delete(sessionId);

    // Update session status in database
    db.updateFeedbackSession(sessionId, {
      status: 'failed',
      errorMessage: 'Connection lost during recording'
    }).catch(error => {
      console.error('Failed to update abandoned session:', error);
    });
  }
}

// Simulate AI processing (replace with real AI service call)
async function simulateAIProcessing(sessionId: string) {
  try {
    console.log(`🤖 Starting AI processing for session ${sessionId}...`);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Simulate AI evaluation results
    const mockEvaluation = {
      authenticity: Math.floor(Math.random() * 40) + 60, // 60-100
      concreteness: Math.floor(Math.random() * 40) + 50, // 50-90
      depth: Math.floor(Math.random() * 50) + 40, // 40-90
      totalScore: 0,
      reasoning: "Mock AI evaluation - customer provided specific feedback about service quality and store cleanliness with authentic details.",
      categories: ["service", "cleanliness", "staff"],
      sentiment: Math.random() * 0.8 + 0.1, // 0.1 to 0.9
      processingTimeMs: 5000,
      modelUsed: "mock-llama-3.2"
    };

    mockEvaluation.totalScore = Math.round(
      mockEvaluation.authenticity * 0.4 +
      mockEvaluation.concreteness * 0.3 +
      mockEvaluation.depth * 0.3
    );

    // Determine reward tier
    let rewardTier = 'insufficient';
    let rewardPercentage = 0;

    if (mockEvaluation.totalScore >= 90) {
      rewardTier = 'exceptional';
      rewardPercentage = 0.10; // 10%
    } else if (mockEvaluation.totalScore >= 75) {
      rewardTier = 'very_good';
      rewardPercentage = 0.055; // 5.5%
    } else if (mockEvaluation.totalScore >= 60) {
      rewardTier = 'acceptable';
      rewardPercentage = 0.02; // 2%
    }

    // Mock transaction amount for reward calculation
    const mockTransactionAmount = 150; // SEK
    const rewardAmount = mockTransactionAmount * rewardPercentage;

    // Update session with AI results
    await db.updateFeedbackSession(sessionId, {
      transcript: "Mock transcript: Customer mentioned that the store was very clean and staff was helpful, but checkout was slow.",
      aiEvaluation: mockEvaluation,
      qualityScore: mockEvaluation.totalScore,
      authenticityScore: mockEvaluation.authenticity,
      concretenessScore: mockEvaluation.concreteness,
      depthScore: mockEvaluation.depth,
      sentimentScore: mockEvaluation.sentiment,
      feedbackCategories: mockEvaluation.categories,
      rewardTier,
      rewardAmount,
      rewardPercentage,
      fraudRiskScore: Math.random() * 0.1, // Low fraud risk for mock
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    console.log(`✅ AI processing completed for session ${sessionId}: ${mockEvaluation.totalScore}/100, ${rewardAmount} SEK reward`);

  } catch (error) {
    console.error('AI processing error:', error);
    await db.updateFeedbackSession(sessionId, {
      status: 'failed',
      errorMessage: 'AI processing failed'
    });
  }
}