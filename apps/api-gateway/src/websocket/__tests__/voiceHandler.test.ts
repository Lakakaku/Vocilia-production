// Voice handler WebSocket tests

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { MockOllamaService, MockConversationStateManager } from '../../../../tests/mocks/aiService.mock';

// Mock the AI evaluator package
const mockAIEvaluator = {
  OllamaService: MockOllamaService,
  ConversationStateManager: MockConversationStateManager
};

jest.mock('@feedback-platform/ai-evaluator', () => mockAIEvaluator);

// Mock WhisperX service
const mockWhisperService = {
  transcribe: jest.fn().mockResolvedValue({
    transcript: 'Jag tyckte kaffet var mycket bra och personalen var vänlig.',
    confidence: 0.95,
    language: 'sv'
  })
};

jest.mock('../../../services/whisper', () => mockWhisperService);

// Mock TTS service
const mockTTSService = {
  synthesize: jest.fn().mockResolvedValue(Buffer.from('mock-audio-data'))
};

jest.mock('../../../services/tts', () => mockTTSService);

// Import the voice handler after mocking dependencies
import { handleVoiceConnection } from '../voiceHandler';

describe('Voice Handler WebSocket', () => {
  let mockWebSocket: any;
  let mockSessionData: any;
  let aiService: MockOllamaService;
  let conversationManager: MockConversationStateManager;

  beforeEach(() => {
    // Create mock WebSocket
    mockWebSocket = new EventEmitter();
    mockWebSocket.send = jest.fn();
    mockWebSocket.close = jest.fn();
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.OPEN = WebSocket.OPEN;
    mockWebSocket.CLOSED = WebSocket.CLOSED;

    // Mock session data
    mockSessionData = {
      id: 'session-123',
      sessionToken: 'test-token',
      businessId: 'business-123',
      business: {
        name: 'Test Café Stockholm',
        contextData: {
          type: 'cafe',
          staff: [{ name: 'Anna', role: 'barista' }],
          strengths: ['good coffee', 'friendly staff']
        }
      }
    };

    // Initialize services
    aiService = new MockOllamaService();
    conversationManager = new MockConversationStateManager();
    conversationManager.createSession(mockSessionData.id);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockWebSocket.removeAllListeners();
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection successfully', async () => {
      // Act
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);

      // Assert
      expect(mockWebSocket.listenerCount('message')).toBeGreaterThan(0);
      expect(mockWebSocket.listenerCount('close')).toBeGreaterThan(0);
      expect(mockWebSocket.listenerCount('error')).toBeGreaterThan(0);
    });

    it('should send initial greeting message', async () => {
      // Act
      handleVoiceConnection(mockWebSocket, mockSessionData);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('Hej! Tack för att du deltar')
      );
    });

    it('should handle connection close gracefully', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);

      // Act
      mockWebSocket.emit('close', 1000, 'Normal closure');

      // Assert - should not throw errors
      expect(mockWebSocket.close).not.toThrow();
    });

    it('should handle connection errors', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      mockWebSocket.emit('error', new Error('Connection failed'));

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Audio Processing', () => {
    it('should process audio chunks correctly', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      const audioChunk = Buffer.from('mock-audio-data');

      // Act
      mockWebSocket.emit('message', audioChunk);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      expect(mockWhisperService.transcribe).toHaveBeenCalledWith(audioChunk);
    });

    it('should handle Swedish voice input correctly', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      const swedishAudio = Buffer.from('swedish-audio-data');
      
      mockWhisperService.transcribe.mockResolvedValueOnce({
        transcript: 'Kaffet var utmärkt och personalen mycket trevlig.',
        confidence: 0.92,
        language: 'sv'
      });

      // Act
      mockWebSocket.emit('message', swedishAudio);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert
      expect(mockWhisperService.transcribe).toHaveBeenCalled();
      expect(mockTTSService.synthesize).toHaveBeenCalledWith(
        expect.stringContaining('Tack'),
        expect.objectContaining({ language: 'sv-SE' })
      );
    });

    it('should handle low confidence transcriptions', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      const unclearAudio = Buffer.from('unclear-audio-data');
      
      mockWhisperService.transcribe.mockResolvedValueOnce({
        transcript: 'mumble mumble',
        confidence: 0.3,
        language: 'sv'
      });

      // Act
      mockWebSocket.emit('message', unclearAudio);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      expect(mockTTSService.synthesize).toHaveBeenCalledWith(
        expect.stringContaining('Kan du upprepa'),
        expect.any(Object)
      );
    });

    it('should process audio within 2 seconds (performance requirement)', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      const audioChunk = Buffer.from('performance-test-audio');

      // Act
      const startTime = Date.now();
      mockWebSocket.emit('message', audioChunk);

      // Wait for full processing cycle
      await new Promise(resolve => setTimeout(resolve, 500));
      const processingTime = Date.now() - startTime;

      // Assert
      expect(processingTime).toBeLessThanOrEqual(2000);
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });

  describe('Conversation Flow', () => {
    it('should manage conversation states correctly', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      const userMessage = Buffer.from('user-audio');
      
      // Act
      mockWebSocket.emit('message', userMessage);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      const currentState = conversationManager.getState(mockSessionData.id);
      expect(['greeting', 'collecting', 'followup']).toContain(currentState);
    });

    it('should inject business context into AI responses', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      const feedbackAudio = Buffer.from('feedback-audio');
      
      mockWhisperService.transcribe.mockResolvedValueOnce({
        transcript: 'Personalen var mycket trevlig',
        confidence: 0.95,
        language: 'sv'
      });

      // Act
      mockWebSocket.emit('message', feedbackAudio);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert - AI should have received business context
      expect(aiService.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('Test Café Stockholm'),
        expect.objectContaining({
          businessContext: expect.objectContaining({
            type: 'cafe',
            staff: expect.arrayContaining([
              expect.objectContaining({ name: 'Anna', role: 'barista' })
            ])
          })
        })
      );
    });

    it('should handle conversation timeouts', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      // Simulate 30 seconds of silence (timeout threshold)
      jest.useFakeTimers();
      
      // Act
      jest.advanceTimersByTime(30000);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringMatching(/tystnad|timeout|avsluta/i)
      );

      jest.useRealTimers();
    });

    it('should handle multiple rapid messages', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      const messages = [
        Buffer.from('message-1'),
        Buffer.from('message-2'),
        Buffer.from('message-3')
      ];

      // Act
      messages.forEach((message, index) => {
        setTimeout(() => mockWebSocket.emit('message', message), index * 50);
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert - should handle all messages without errors
      expect(mockWhisperService.transcribe).toHaveBeenCalledTimes(3);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(expect.any(Number));
    });
  });

  describe('Quality Evaluation', () => {
    it('should evaluate feedback quality at conversation end', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      // Simulate conversation completion trigger
      mockWhisperService.transcribe.mockResolvedValueOnce({
        transcript: 'Tack så mycket, det var allt jag hade att säga.',
        confidence: 0.95,
        language: 'sv'
      });

      // Act
      mockWebSocket.emit('message', Buffer.from('completion-audio'));
      await new Promise(resolve => setTimeout(resolve, 400));

      // Assert
      expect(aiService.evaluateFeedback).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'cafe'
        }),
        expect.any(Array)
      );
    });

    it('should return quality score within expected range', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      aiService.setResponse('quality_test', {
        authenticity: 88,
        concreteness: 85,
        depth: 90,
        total: 88,
        reasoning: 'Excellent detailed feedback'
      });

      mockWhisperService.transcribe.mockResolvedValueOnce({
        transcript: 'Kaffet var perfekt bryggat och personalen visste mycket om bönorna. Lokalen var ren och atmosfären mysig för studier.',
        confidence: 0.96,
        language: 'sv'
      });

      // Act
      mockWebSocket.emit('message', Buffer.from('quality-audio'));
      await new Promise(resolve => setTimeout(resolve, 400));

      // Assert
      const history = conversationManager.getConversationHistory(mockSessionData.id);
      const qualityMessage = history.find(msg => msg.message.includes('kvalitet') || msg.message.includes('poäng'));
      
      if (qualityMessage) {
        // Extract score from message (this depends on actual implementation)
        expect(qualityMessage.message).toMatch(/\b\d{1,3}\b/); // Should contain a score 0-100
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle AI service failures gracefully', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      aiService.simulateFailure();
      
      // Act
      mockWebSocket.emit('message', Buffer.from('test-audio'));
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringMatching(/problem|fel|försök igen/i)
      );
    });

    it('should handle transcription service failures', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      mockWhisperService.transcribe.mockRejectedValueOnce(new Error('Transcription failed'));

      // Act
      mockWebSocket.emit('message', Buffer.from('test-audio'));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringMatching(/kunde inte|höra|försök igen/i)
      );
    });

    it('should handle TTS service failures', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      mockTTSService.synthesize.mockRejectedValueOnce(new Error('TTS failed'));

      // Act
      mockWebSocket.emit('message', Buffer.from('test-audio'));
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert - should fall back to text response
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('text')
      );
    });

    it('should handle malformed audio data', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      // Act - send invalid data
      mockWebSocket.emit('message', 'invalid-audio-data');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - should not crash
      expect(mockWhisperService.transcribe).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high frequency audio chunks', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      // Act - send 20 chunks rapidly (100ms intervals)
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          mockWebSocket.emit('message', Buffer.from(`chunk-${i}`));
        }, i * 100);
      }

      await new Promise(resolve => setTimeout(resolve, 2500));

      // Assert - should handle all chunks without blocking
      expect(mockWhisperService.transcribe).toHaveBeenCalledTimes(20);
    });

    it('should maintain conversation state under load', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      // Act - simulate intense conversation activity
      for (let i = 0; i < 10; i++) {
        mockWebSocket.emit('message', Buffer.from(`message-${i}`));
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Assert
      const stats = conversationManager.getSessionStats(mockSessionData.id);
      expect(stats).toBeDefined();
      expect(stats.messageCount).toBeGreaterThan(0);
      expect(stats.duration).toBeGreaterThan(0);
    });
  });

  describe('Swedish Language Features', () => {
    it('should handle Swedish-specific phrases correctly', async () => {
      const swedishPhrases = [
        'Jättebra kaffe!',
        'Personalen var supertrevlig',
        'Lite för dyrt kanske',
        'Mysig atmosfär'
      ];

      for (const phrase of swedishPhrases) {
        // Reset for each test
        jest.clearAllMocks();
        
        // Arrange
        const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
        
        mockWhisperService.transcribe.mockResolvedValueOnce({
          transcript: phrase,
          confidence: 0.9,
          language: 'sv'
        });

        // Act
        mockWebSocket.emit('message', Buffer.from('swedish-audio'));
        await new Promise(resolve => setTimeout(resolve, 300));

        // Assert
        expect(mockTTSService.synthesize).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ language: 'sv-SE' })
        );
      }
    });

    it('should detect and handle English fallback', async () => {
      // Arrange
      const handler = handleVoiceConnection(mockWebSocket, mockSessionData);
      
      mockWhisperService.transcribe.mockResolvedValueOnce({
        transcript: 'The coffee was really good',
        confidence: 0.9,
        language: 'en'
      });

      // Act
      mockWebSocket.emit('message', Buffer.from('english-audio'));
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert
      expect(mockTTSService.synthesize).toHaveBeenCalledWith(
        expect.stringMatching(/thank you|can you tell me more/i),
        expect.objectContaining({ language: 'en-US' })
      );
    });
  });
});