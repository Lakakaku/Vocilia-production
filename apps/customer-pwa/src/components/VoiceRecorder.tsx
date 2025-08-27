import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square, Play, Pause, RotateCcw } from 'lucide-react';

interface VoiceRecorderProps {
  sessionId: string;
  onComplete: (audioBlob: Blob, duration: number) => void;
  onBack: () => void;
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'completed' | 'error';

export function VoiceRecorder({ sessionId, onComplete, onBack }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs for media handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioBufferRef = useRef<ArrayBuffer[]>([]);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [ttsText, setTTSText] = useState<string>('');

  // WebSocket connection for real-time streaming
  useEffect(() => {
    setupWebSocket();
    return () => {
      cleanup();
    };
  }, []);

  // Timer effect
  useEffect(() => {
    if (state === 'recording') {
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= 120) { // 2 minute max
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state]);

  // TTS Audio handling methods
  const handleTTSAudioResponse = async (message: any) => {
    try {
      console.log('🔊 Handling TTS audio response:', message);
      setTTSText(message.text || message.response || '');
      
      if (message.audioData) {
        // Handle base64 encoded audio data
        const audioData = atob(message.audioData);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        
        const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
        await playTTSAudio(audioBlob);
      } else if (message.audioUrl) {
        // Handle audio URL
        await playTTSAudioFromUrl(message.audioUrl);
      }
    } catch (err) {
      console.error('❌ TTS audio response error:', err);
      setError('Kunde inte spela upp AI-svar');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleTTSAudioChunk = (message: any) => {
    try {
      console.log('🔊 Handling TTS audio chunk:', message.chunkIndex);
      
      if (message.audioChunk) {
        // Store audio chunks for later assembly
        const audioData = atob(message.audioChunk);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        
        audioBufferRef.current[message.chunkIndex || 0] = audioArray.buffer;
      }
    } catch (err) {
      console.error('❌ TTS audio chunk error:', err);
    }
  };

  const handleTTSComplete = async (message: any) => {
    try {
      console.log('🔊 TTS complete, assembling audio chunks');
      
      if (audioBufferRef.current.length > 0) {
        // Combine all audio chunks
        const totalLength = audioBufferRef.current.reduce((sum: number, buffer: ArrayBuffer) => sum + buffer.byteLength, 0);
        const combinedArray = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const buffer of audioBufferRef.current) {
          combinedArray.set(new Uint8Array(buffer), offset);
          offset += buffer.byteLength;
        }
        
        const audioBlob = new Blob([combinedArray], { type: 'audio/wav' });
        await playTTSAudio(audioBlob);
        
        // Clear buffer
        audioBufferRef.current = [];
      }
    } catch (err) {
      console.error('❌ TTS complete error:', err);
      setError('Kunde inte spela upp komplett AI-svar');
      setTimeout(() => setError(null), 3000);
    }
  };

  const playTTSAudio = async (audioBlob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔊 Playing TTS audio blob');
        
        // Stop any currently playing TTS audio
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause();
          ttsAudioRef.current = null;
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        ttsAudioRef.current = audio;
        
        // Enhanced audio settings for iOS Safari
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        
        // iOS Safari optimizations
        const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOSSafari) {
          audio.muted = false;
          audio.volume = 1.0;
          // Prevent audio interruption on iOS
          audio.addEventListener('pause', () => {
            if (!audio.ended && isTTSPlaying) {
              console.log('🍎 iOS audio pause detected, resuming...');
              setTimeout(() => audio.play().catch(console.error), 100);
            }
          });
        }
        
        audio.onloadstart = () => console.log('🔊 TTS audio loading started');
        audio.oncanplay = () => console.log('🔊 TTS audio can play');
        
        audio.onplay = () => {
          setIsTTSPlaying(true);
          console.log('🔊 TTS audio playback started');
        };
        
        audio.onended = () => {
          setIsTTSPlaying(false);
          URL.revokeObjectURL(audioUrl);
          console.log('🔊 TTS audio playback completed');
          resolve();
        };
        
        audio.onerror = (err) => {
          setIsTTSPlaying(false);
          URL.revokeObjectURL(audioUrl);
          console.error('❌ TTS audio playback error:', err);
          reject(err);
        };
        
        // Start playback with error handling
        audio.play().catch(err => {
          console.error('❌ TTS audio play failed:', err);
          setIsTTSPlaying(false);
          reject(err);
        });
        
      } catch (err) {
        console.error('❌ TTS audio setup error:', err);
        setIsTTSPlaying(false);
        reject(err);
      }
    });
  };

  const playTTSAudioFromUrl = async (audioUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔊 Playing TTS audio from URL:', audioUrl);
        
        // Stop any currently playing TTS audio
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause();
          ttsAudioRef.current = null;
        }
        
        const audio = new Audio(audioUrl);
        ttsAudioRef.current = audio;
        
        // Enhanced audio settings
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        
        // iOS Safari optimizations
        const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOSSafari) {
          audio.muted = false;
          audio.volume = 1.0;
          audio.addEventListener('pause', () => {
            if (!audio.ended && isTTSPlaying) {
              console.log('🍎 iOS TTS audio pause detected, resuming...');
              setTimeout(() => audio.play().catch(console.error), 100);
            }
          });
        }
        
        audio.onplay = () => {
          setIsTTSPlaying(true);
          console.log('🔊 TTS URL audio playback started');
        };
        
        audio.onended = () => {
          setIsTTSPlaying(false);
          console.log('🔊 TTS URL audio playback completed');
          resolve();
        };
        
        audio.onerror = (err) => {
          setIsTTSPlaying(false);
          console.error('❌ TTS URL audio playback error:', err);
          reject(err);
        };
        
        // Start playback
        audio.play().catch(err => {
          console.error('❌ TTS URL audio play failed:', err);
          setIsTTSPlaying(false);
          reject(err);
        });
        
      } catch (err) {
        console.error('❌ TTS URL audio setup error:', err);
        setIsTTSPlaying(false);
        reject(err);
      }
    });
  };

  const setupWebSocket = () => {
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Detect iOS Safari for optimizations
      const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                         /Safari/.test(navigator.userAgent) && 
                         !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);

      ws.onopen = () => {
        console.log('WebSocket connected');
        
        if (isIOSSafari) {
          console.log('🍎 Applying iOS Safari WebSocket optimizations for voice recording');
          
          // Set up iOS Safari specific keepalive
          const keepAliveInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'keepalive', timestamp: Date.now() }));
            } else {
              clearInterval(keepAliveInterval);
            }
          }, 15000); // Every 15 seconds
          
          (ws as any).keepAliveInterval = keepAliveInterval;

          // iOS Safari visibility handling
          const visibilityHandler = () => {
            if (document.hidden) {
              console.log('🍎 Voice recording app backgrounded');
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'background_mode', sessionId }));
              }
            } else {
              console.log('🍎 Voice recording app foregrounded');
              if (ws.readyState !== WebSocket.OPEN && state === 'recording') {
                // Reconnect if we were recording
                console.log('🍎 Reconnecting WebSocket after foreground');
                setupWebSocket();
              }
            }
          };
          document.addEventListener('visibilitychange', visibilityHandler);
          (ws as any).visibilityHandler = visibilityHandler;

          // iOS Safari memory pressure handling
          if ('onmemorywarning' in window) {
            const memoryHandler = () => {
              console.log('🍎 iOS memory warning during voice recording');
              if (state === 'recording') {
                // Emergency stop recording to free memory
                stopRecording();
                setError('Inspelning stoppad på grund av minnesbrist');
              }
            };
            window.addEventListener('memorywarning', memoryHandler);
            (ws as any).memoryHandler = memoryHandler;
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message:', message);
          
          if (message.type === 'error') {
            setError(message.message);
            setState('error');
          } else if (message.type === 'partial_transcript') {
            // Surface partial transcripts in UI for real-time feedback
            console.log('Partial transcript:', message.text);
          } else if (message.type === 'processing_started') {
            // Show optimized processing started
            console.log('Optimized processing started, estimated latency:', message.estimatedLatency + 'ms');
          } else if (message.type === 'transcription_complete') {
            // Show transcription completed - fast feedback to user
            console.log('Transcription complete:', message.text);
          } else if (message.type === 'quality_evaluation_complete') {
            // Show quality evaluation results
            console.log('Quality evaluation complete:', message.qualityScore);
          } else if (message.type === 'conversation_response') {
            // Show AI conversation response with enhanced TTS handling
            console.log('AI response:', message.response);
            handleTTSAudioResponse(message);
          } else if (message.type === 'processing_complete') {
            // Show final completion with performance metrics
            console.log('Processing complete. Total time:', message.totalProcessingTimeMs + 'ms');
            console.log('Latency breakdown:', message.latencyBreakdown);
          } else if (message.type === 'ai_response') {
            // Legacy AI response handling with TTS improvements
            console.log('AI response (legacy):', message.response);
            handleTTSAudioResponse(message);
          } else if (message.type === 'tts_audio_chunk') {
            // Handle streaming TTS audio chunks to prevent cutting
            handleTTSAudioChunk(message);
          } else if (message.type === 'tts_complete') {
            // Handle TTS completion
            handleTTSComplete(message);
          } else if (message.type === 'keepalive' || message.type === 'pong') {
            // Handle keepalive responses
          }
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Don't fail completely on WebSocket errors for iOS Safari
        if (isIOSSafari) {
          console.log('🍎 iOS Safari WebSocket error, will attempt reconnect if needed');
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        // Cleanup iOS Safari handlers
        const wsAny = ws as any;
        if (wsAny.keepAliveInterval) {
          clearInterval(wsAny.keepAliveInterval);
        }
        if (wsAny.visibilityHandler) {
          document.removeEventListener('visibilitychange', wsAny.visibilityHandler);
        }
        if (wsAny.memoryHandler) {
          window.removeEventListener('memorywarning', wsAny.memoryHandler);
        }

        // Attempt reconnection if we were recording and it wasn't intentional
        if (state === 'recording' && event.code !== 1000) {
          console.log('🔄 Attempting WebSocket reconnection during recording');
          setTimeout(() => {
            if (state === 'recording') {
              setupWebSocket();
            }
          }, 2000); // Wait 2 seconds before reconnecting
        }
      };
    } catch (err) {
      console.error('WebSocket setup error:', err);
      // Continue without WebSocket for iOS Safari compatibility
    }
  };

  const startRecording = async () => {
    setState('requesting');
    if (typeof window !== 'undefined') {
      window.__VOICE_RECORDING_ACTIVE__ = true;
    }
    setError(null);
    setDuration(0);
    chunksRef.current = [];

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Check for MediaRecorder support (iOS Safari fallback)
      if (!window.MediaRecorder || !MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        // Use Web Audio API fallback for iOS Safari
        await setupWebAudioRecording(stream);
      } else {
        await setupMediaRecorderRecording(stream);
      }

      setState('recording');

      // Notify WebSocket that recording started
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'start_recording',
          sessionId,
        }));
      }

    } catch (err) {
      console.error('Recording start error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte starta inspelning';
      
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        setError('Mikrofon åtkomst nekad. Kontrollera behörigheter i webbläsaren.');
      } else {
        setError(errorMessage);
      }
      
      setState('error');
      cleanup();
    }
  };

  const setupMediaRecorderRecording = async (stream: MediaStream) => {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 16000,
    });

    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
        
        // Send chunk to WebSocket if connected
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // Convert blob to array buffer for WebSocket
          event.data.arrayBuffer().then(buffer => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(buffer);
            }
          });
        }
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setAudioBlob(blob);
      setState('completed');
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      setError('Inspelningsfel uppstod');
      setState('error');
    };

    // Start recording with 500ms chunks for real-time streaming
    mediaRecorder.start(500);
  };

  const setupWebAudioRecording = async (stream: MediaStream) => {
    // Web Audio API fallback for iOS Safari
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    const audioChunks: Float32Array[] = [];

    processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // Store audio data
      audioChunks.push(new Float32Array(inputData));

      // Send to WebSocket if connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Convert Float32Array to Int16Array for transmission
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        wsRef.current.send(int16Array.buffer);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    // Store references for cleanup
    (streamRef.current as any).audioContext = audioContext;
    (streamRef.current as any).processor = processor;
    (streamRef.current as any).audioChunks = audioChunks;
  };

  const stopRecording = useCallback(() => {
    if (state !== 'recording') return;

    try {
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      // Stop Web Audio API recording
      if (streamRef.current && (streamRef.current as any).audioContext) {
        const audioContext = (streamRef.current as any).audioContext;
        const processor = (streamRef.current as any).processor;
        const audioChunks = (streamRef.current as any).audioChunks;

        processor.disconnect();
        audioContext.close();

        // Convert audio chunks to blob
        if (audioChunks && audioChunks.length > 0) {
          const totalLength = audioChunks.reduce((acc: number, chunk: Float32Array) => acc + chunk.length, 0);
          const combinedArray = new Float32Array(totalLength);
          let offset = 0;

          for (const chunk of audioChunks) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
          }

          // Convert to WAV format
          const wavBlob = floatArrayToWavBlob(combinedArray, 16000);
          setAudioBlob(wavBlob);
          setState('completed');
        }
      }

      // Notify WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'stop_recording',
          sessionId,
        }));
      }

      // Cleanup stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }

    } catch (err) {
      console.error('Stop recording error:', err);
      setError('Kunde inte stoppa inspelningen');
      setState('error');
    }
    finally {
      if (typeof window !== 'undefined') {
        window.__VOICE_RECORDING_ACTIVE__ = false;
      }
    }
  }, [state, sessionId]);

  const floatArrayToWavBlob = (floatArray: Float32Array, sampleRate: number): Blob => {
    const length = floatArray.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, floatArray[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const playRecording = () => {
    if (!audioBlob) return;

    if (isPlaying && audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(URL.createObjectURL(audioBlob));
    audioElementRef.current = audio;

    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      setError('Kunde inte spela upp inspelningen');
    };

    audio.play();
    setIsPlaying(true);
  };

  const retryRecording = () => {
    setState('idle');
    setError(null);
    setAudioBlob(null);
    setDuration(0);
    setIsPlaying(false);
    chunksRef.current = [];
    if (typeof window !== 'undefined') {
      window.__VOICE_RECORDING_ACTIVE__ = false;
    }
  };

  const submitRecording = () => {
    if (audioBlob) {
      onComplete(audioBlob, duration);
    }
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }

    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      setIsTTSPlaying(false);
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    // Clear TTS buffer
    audioBufferRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const secsStr = secs < 10 ? `0${secs}` : `${secs}`;
    return `${mins}:${secsStr}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50" data-testid="voice-recorder">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-4 py-6">
          <button
            onClick={onBack}
            className="text-blue-600 text-sm font-medium mb-4"
          >
            ← Tillbaka
          </button>
          <h1 className="text-xl font-bold text-gray-900">Röstinspelning</h1>
          <p className="text-gray-600 text-sm mt-1">Dela dina tankar om ditt besök</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[calc(100vh-120px)]">
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <button
                  onClick={startRecording}
                  className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center mb-6 mx-auto"
                  data-testid="start-recording-button"
                >
                  <Mic className="w-12 h-12" />
                </button>
              </motion.div>

              <h2 className="text-xl font-semibold text-gray-900 mb-2">Tryck för att börja</h2>
              <p className="text-gray-600 max-w-sm">
                Berätta om din upplevelse. Var specifik och ärlig för bästa belöning.
              </p>

              <div className="mt-6 bg-blue-50 rounded-lg p-4 text-left max-w-sm">
                <p className="text-sm text-blue-800 font-medium mb-1">💡 Bra att nämna:</p>
                <ul className="text-xs text-blue-700 space-y-0.5">
                  <li>• Produktkvalitet och urval</li>
                  <li>• Personalens service</li>
                  <li>• Butikens atmosfär</li>
                  <li>• Vad som kan förbättras</li>
                </ul>
              </div>
            </motion.div>
          )}

          {state === 'requesting' && (
            <motion.div
              key="requesting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Begär åtkomst</h2>
              <p className="text-gray-600">Kontrollerar mikrofon behörigheter...</p>
            </motion.div>
          )}

          {state === 'recording' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="w-32 h-32 bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-full shadow-2xl flex items-center justify-center mb-6 mx-auto relative">
                  <Mic className="w-12 h-12" />
                  <motion.div
                    animate={{ scale: [1, 1.5] }}
                    transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
                    className="absolute inset-0 border-4 border-red-300 rounded-full opacity-50"
                  />
                </div>
              </motion.div>

              <div className="text-3xl font-mono font-bold text-gray-900 mb-2" data-testid="recording-timer">
                {formatTime(duration)}
              </div>
              <p className="text-gray-600 mb-6" data-testid="recording-status">
                {isTTSPlaying ? 'AI svarar...' : 'Inspelning pågår...'}
              </p>
              
              {/* TTS Status and Text Display */}
              {isTTSPlaying && ttsText && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4 max-w-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-blue-800">AI-assistent:</span>
                  </div>
                  <p className="text-sm text-blue-700">{ttsText}</p>
                </div>
              )}

              <button
                onClick={stopRecording}
                className="w-16 h-16 bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center"
                data-testid="stop-recording-button"
              >
                <Square className="w-6 h-6" />
              </button>

              {duration > 15 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-green-600 mt-4"
                >
                  ✓ Minimilängd uppnådd
                </motion.p>
              )}
            </motion.div>
          )}

          {state === 'completed' && audioBlob && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center max-w-sm w-full"
            >
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Square className="w-8 h-8 text-green-600" />
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-2">Inspelning klar!</h2>
              <p className="text-gray-600 mb-6">
                {formatTime(duration)} inspelat. Lyssna gärna innan du skickar.
              </p>

              <div className="space-y-4">
                <button
                  onClick={playRecording}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium"
                  data-testid="play-recording-button"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  <span>{isPlaying ? 'Pausa' : 'Spela upp'}</span>
                </button>

                <div className="flex space-x-3">
                  <button
                    onClick={retryRecording}
                    className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium"
                    data-testid="retry-recording-button"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Spela in igen</span>
                  </button>

                  <button
                    onClick={submitRecording}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg"
                    data-testid="submit-recording-button"
                  >
                    Skicka feedback
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center max-w-sm"
            >
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <MicOff className="w-8 h-8 text-red-600" />
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-2">Inspelningsfel</h2>
              <p className="text-gray-600 mb-6">{error}</p>

              <div className="space-y-3">
                <button
                  onClick={retryRecording}
                  className="w-full py-3 px-4 bg-blue-500 text-white rounded-xl font-semibold"
                >
                  Försök igen
                </button>

                <button
                  onClick={onBack}
                  className="w-full py-3 px-4 text-gray-600 font-medium"
                >
                  Tillbaka
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}