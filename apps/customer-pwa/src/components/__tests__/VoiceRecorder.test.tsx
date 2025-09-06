// VoiceRecorder component tests

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VoiceRecorder from '../VoiceRecorder';

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: WebSocket.OPEN,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock WebSocket constructor
global.WebSocket = jest.fn(() => mockWebSocket) as any;

// Mock MediaRecorder
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  state: 'inactive' as RecordingState,
  stream: null as MediaStream | null,
  ondataavailable: null,
  onstart: null,
  onstop: null,
  onerror: null
};

global.MediaRecorder = jest.fn(() => mockMediaRecorder) as any;

// Mock getUserMedia
const mockGetUserMedia = jest.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  configurable: true
});

describe('VoiceRecorder Component', () => {
  const mockProps = {
    sessionToken: 'test-session-token',
    onConversationStart: jest.fn(),
    onConversationEnd: jest.fn(),
    onError: jest.fn(),
    businessContext: {
      name: 'Test Café Stockholm',
      type: 'cafe'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful media access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
      getAudioTracks: () => [{ stop: jest.fn() }]
    });

    // Reset MediaRecorder state
    mockMediaRecorder.state = 'inactive';
  });

  afterEach(() => {
    // Clean up any active recordings
    if (mockMediaRecorder.state === 'recording') {
      mockMediaRecorder.state = 'inactive';
    }
  });

  describe('Initial Rendering', () => {
    it('renders correctly with default state', () => {
      render(<VoiceRecorder {...mockProps} />);
      
      expect(screen.getByText(/starta röstsamtal/i)).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('shows connection status', () => {
      render(<VoiceRecorder {...mockProps} />);
      
      // Should show connecting initially
      expect(screen.getByText(/ansluter/i)).toBeInTheDocument();
    });

    it('displays business context', () => {
      render(<VoiceRecorder {...mockProps} />);
      
      expect(screen.getByText(/test café stockholm/i)).toBeInTheDocument();
    });
  });

  describe('Permission Handling', () => {
    it('requests microphone permission on start', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
    });

    it('handles microphone permission denied', async () => {
      const user = userEvent.setup();
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith(
          expect.stringContaining('mikrofon')
        );
      });
    });

    it('shows permission request UI', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      // Should show permission request state
      await waitFor(() => {
        expect(screen.getByText(/tillåtelse/i)).toBeInTheDocument();
      });
    });
  });

  describe('Recording States', () => {
    it('transitions through recording states correctly', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      
      // Start recording
      await user.click(startButton);
      
      await waitFor(() => {
        expect(mockMediaRecorder.start).toHaveBeenCalled();
        expect(screen.getByText(/lyssnar/i)).toBeInTheDocument();
      });

      // Simulate recording state change
      mockMediaRecorder.state = 'recording';
      fireEvent(mockMediaRecorder, new Event('start'));

      await waitFor(() => {
        expect(screen.getByText(/stoppa/i)).toBeInTheDocument();
      });
    });

    it('handles stop recording correctly', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      // Start recording first
      const startButton = screen.getByRole('button');
      await user.click(startButton);
      
      await waitFor(() => {
        mockMediaRecorder.state = 'recording';
        fireEvent(mockMediaRecorder, new Event('start'));
      });

      // Stop recording
      const stopButton = screen.getByRole('button');
      await user.click(stopButton);

      expect(mockMediaRecorder.stop).toHaveBeenCalled();
    });

    it('shows audio level visualization during recording', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      await waitFor(() => {
        mockMediaRecorder.state = 'recording';
        fireEvent(mockMediaRecorder, new Event('start'));
      });

      // Should show audio visualization
      expect(screen.getByTestId('audio-visualizer')).toBeInTheDocument();
    });
  });

  describe('WebSocket Communication', () => {
    it('establishes WebSocket connection', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('/voice'),
          expect.any(Array)
        );
      });
    });

    it('sends session token in WebSocket headers', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['session-token', mockProps.sessionToken])
        );
      });
    });

    it('handles WebSocket messages', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      // Simulate receiving AI response
      const mockMessage = {
        data: JSON.stringify({
          type: 'ai_response',
          text: 'Tack för din feedback!',
          audioData: 'base64-audio-data'
        })
      };

      fireEvent(mockWebSocket, new MessageEvent('message', mockMessage));

      await waitFor(() => {
        expect(screen.getByText(/tack för din feedback/i)).toBeInTheDocument();
      });
    });

    it('handles WebSocket connection errors', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      // Simulate connection error
      fireEvent(mockWebSocket, new Event('error'));

      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith(
          expect.stringContaining('anslutning')
        );
      });
    });
  });

  describe('Audio Processing', () => {
    it('processes audio chunks correctly', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      await waitFor(() => {
        mockMediaRecorder.state = 'recording';
        fireEvent(mockMediaRecorder, new Event('start'));
      });

      // Simulate audio data available
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const dataEvent = new Event('dataavailable') as any;
      dataEvent.data = mockAudioBlob;

      fireEvent(mockMediaRecorder, dataEvent);

      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(mockAudioBlob);
      });
    });

    it('handles iOS Safari audio fallback', async () => {
      // Simulate iOS Safari (no MediaRecorder support)
      global.MediaRecorder = undefined as any;
      
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      await waitFor(() => {
        // Should fall back to Web Audio API
        expect(screen.getByText(/webb audio/i)).toBeInTheDocument();
      });

      // Restore MediaRecorder
      global.MediaRecorder = jest.fn(() => mockMediaRecorder) as any;
    });

    it('shows audio quality warnings', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      // Simulate low audio quality
      const mockMessage = {
        data: JSON.stringify({
          type: 'audio_quality_warning',
          message: 'Ljudkvaliteten är låg. Kom närmare mikrofonen.'
        })
      };

      fireEvent(mockWebSocket, new MessageEvent('message', mockMessage));

      await waitFor(() => {
        expect(screen.getByText(/ljudkvaliteten är låg/i)).toBeInTheDocument();
      });
    });
  });

  describe('Conversation Management', () => {
    it('tracks conversation state', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      // Simulate conversation start
      const startMessage = {
        data: JSON.stringify({
          type: 'conversation_started',
          state: 'greeting'
        })
      };

      fireEvent(mockWebSocket, new MessageEvent('message', startMessage));

      await waitFor(() => {
        expect(mockProps.onConversationStart).toHaveBeenCalled();
        expect(screen.getByTestId('conversation-state')).toHaveTextContent('greeting');
      });
    });

    it('handles conversation timeout', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      // Simulate conversation timeout
      const timeoutMessage = {
        data: JSON.stringify({
          type: 'conversation_timeout',
          message: 'Samtalet avbröts på grund av tystnad.'
        })
      };

      fireEvent(mockWebSocket, new MessageEvent('message', timeoutMessage));

      await waitFor(() => {
        expect(screen.getByText(/samtalet avbröts/i)).toBeInTheDocument();
        expect(mockProps.onConversationEnd).toHaveBeenCalledWith('timeout');
      });
    });

    it('completes conversation successfully', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      // Simulate conversation completion
      const completionMessage = {
        data: JSON.stringify({
          type: 'conversation_completed',
          qualityScore: {
            authenticity: 85,
            concreteness: 78,
            depth: 82,
            total: 82
          },
          rewardAmount: 20.50
        })
      };

      fireEvent(mockWebSocket, new MessageEvent('message', completionMessage));

      await waitFor(() => {
        expect(mockProps.onConversationEnd).toHaveBeenCalledWith('completed', {
          qualityScore: expect.objectContaining({ total: 82 }),
          rewardAmount: 20.50
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('handles recording errors gracefully', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      // Simulate recording error
      const errorEvent = new Event('error') as any;
      errorEvent.error = new Error('Recording failed');
      fireEvent(mockMediaRecorder, errorEvent);

      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith(
          expect.stringContaining('inspelning')
        );
      });
    });

    it('shows retry option on errors', async () => {
      const user = userEvent.setup();
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/försök igen/i)).toBeInTheDocument();
      });

      // Test retry functionality
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: jest.fn() }],
        getAudioTracks: () => [{ stop: jest.fn() }]
      });

      const retryButton = screen.getByText(/försök igen/i);
      await user.click(retryButton);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance Requirements', () => {
    it('initializes within 500ms', async () => {
      const startTime = Date.now();
      render(<VoiceRecorder {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const initTime = Date.now() - startTime;
      expect(initTime).toBeLessThanOrEqual(500);
    });

    it('starts recording within 100ms of button press', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      
      const startTime = Date.now();
      await user.click(startButton);
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThanOrEqual(100);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<VoiceRecorder {...mockProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label');
      expect(button.getAttribute('aria-label')).toContain('röst');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const button = screen.getByRole('button');
      
      // Focus with tab
      await user.tab();
      expect(button).toHaveFocus();

      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    it('provides screen reader feedback', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent(/inspelning påbörjad/i);
      });
    });
  });

  describe('Swedish Language Support', () => {
    it('displays Swedish UI text correctly', () => {
      render(<VoiceRecorder {...mockProps} />);
      
      expect(screen.getByText(/starta röstsamtal/i)).toBeInTheDocument();
    });

    it('handles Swedish voice commands', async () => {
      const user = userEvent.setup();
      render(<VoiceRecorder {...mockProps} />);
      
      const startButton = screen.getByRole('button');
      await user.click(startButton);

      // Simulate Swedish voice command recognition
      const commandMessage = {
        data: JSON.stringify({
          type: 'voice_command',
          command: 'avsluta',
          language: 'sv'
        })
      };

      fireEvent(mockWebSocket, new MessageEvent('message', commandMessage));

      await waitFor(() => {
        expect(mockMediaRecorder.stop).toHaveBeenCalled();
      });
    });
  });
});