import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface TTSResult {
  audioBuffer: Buffer;
  text: string;
  duration: number;
  estimatedAudioDuration: number;
  sampleRate: number;
  channels: number;
  format: string;
  provider: string;
  voice: string;
  wordCount: number;
}

export interface TTSConfig {
  provider?: 'piper' | 'espeak' | 'system';
  voice?: string;
  language?: string;
  sampleRate?: number;
  outputFormat?: 'wav' | 'mp3';
}

/**
 * Text-to-Speech service for generating voice responses in Swedish
 * Supports multiple TTS providers with automatic fallback
 */
export class TTSService {
  private config: Required<TTSConfig>;

  constructor(config: TTSConfig = {}) {
    this.config = {
      provider: 'piper',
      voice: 'swedish_female',
      language: 'sv',
      sampleRate: 22050,
      outputFormat: 'wav',
      ...config
    };
  }

  /**
   * Convert text to speech audio
   */
  async synthesize(text: string): Promise<TTSResult> {
    if (!text || !text.trim()) {
      throw new Error('Text cannot be empty');
    }

    try {
      return await this.synthesizeWithPython(text.trim());
    } catch (error) {
      console.error('TTS synthesis failed:', error);
      throw new Error(`TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Synthesize speech using Python TTS processor
   */
  private async synthesizeWithPython(text: string): Promise<TTSResult> {
    // Get path to TTS processor script
    const ttsScript = join(__dirname, 'tts_processor.py');
    
    // Check if Python script exists
    try {
      await fs.access(ttsScript);
    } catch {
      throw new Error('TTS processor script not found');
    }

    return new Promise((resolve, reject) => {
      const args = [
        ttsScript,
        '--text', text,
        '--provider', this.config.provider,
        '--voice', this.config.voice,
        '--format', this.config.outputFormat
      ];

      const pythonProcess = spawn('python3', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let audioData: Buffer[] = [];

      pythonProcess.stdout.on('data', (data) => {
        // The Python script outputs JSON on stdout
        const output = data.toString();
        
        // Check if this is JSON or binary audio data
        try {
          JSON.parse(output);
          stdout += output;
        } catch {
          // This might be binary audio data, but we expect JSON
          stdout += output;
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`TTS process failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);

          if (result.error) {
            reject(new Error(`TTS synthesis error: ${result.error}`));
            return;
          }

          // The Python script returns base64 encoded audio data
          const audioBuffer = Buffer.from(result.audio_data, 'base64');

          resolve({
            audioBuffer,
            text: result.text,
            duration: result.duration,
            estimatedAudioDuration: result.estimated_audio_duration,
            sampleRate: result.sample_rate,
            channels: result.channels,
            format: result.format,
            provider: result.provider,
            voice: result.voice,
            wordCount: result.word_count
          });

        } catch (parseError) {
          reject(new Error(`Failed to parse TTS result: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start TTS process: ${error.message}`));
      });

      // Set timeout for synthesis (20 seconds max)
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('TTS synthesis timeout'));
      }, 20000);
    });
  }

  /**
   * Get TTS service status and capabilities
   */
  async getStatus(): Promise<{
    available: boolean;
    provider: string;
    voice: string;
    language: string;
    sampleRate: number;
    supportedFormats: string[];
    pythonTTSAvailable: boolean;
  }> {
    const pythonTTSAvailable = await this.checkPythonTTSAvailability();

    return {
      available: pythonTTSAvailable,
      provider: this.config.provider,
      voice: this.config.voice,
      language: this.config.language,
      sampleRate: this.config.sampleRate,
      supportedFormats: ['wav', 'mp3'],
      pythonTTSAvailable
    };
  }

  /**
   * Check if Python TTS processor is available
   */
  private async checkPythonTTSAvailability(): Promise<boolean> {
    try {
      const ttsScript = join(__dirname, 'tts_processor.py');
      await fs.access(ttsScript);

      // Try to get status from Python script
      return new Promise((resolve) => {
        const pythonProcess = spawn('python3', [ttsScript, '--text', 'test'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        pythonProcess.on('close', (code) => {
          resolve(code === 0);
        });

        pythonProcess.on('error', () => {
          resolve(false);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          pythonProcess.kill();
          resolve(false);
        }, 10000);
      });

    } catch {
      return false;
    }
  }

  /**
   * Generate natural Swedish conversation responses
   */
  async generateConversationAudio(
    response: string, 
    conversationContext?: {
      isFirstMessage?: boolean;
      isLastMessage?: boolean;
      customerName?: string;
    }
  ): Promise<TTSResult> {
    // Add natural speech patterns for Swedish conversation
    let naturalResponse = response;

    if (conversationContext?.isFirstMessage) {
      // Add welcoming tone for first message
      naturalResponse = `Hej! ${naturalResponse}`;
    }

    if (conversationContext?.isLastMessage) {
      // Add polite closing for last message
      if (!naturalResponse.includes('tack')) {
        naturalResponse += ' Tack för din feedback!';
      }
    }

    // Add natural pauses for better speech flow
    naturalResponse = naturalResponse.replace(/\. /g, '... ');
    naturalResponse = naturalResponse.replace(/\? /g, '?... ');
    naturalResponse = naturalResponse.replace(/! /g, '!... ');

    return this.synthesize(naturalResponse);
  }

  /**
   * Preload common Swedish phrases for faster responses
   */
  async preloadCommonPhrases(): Promise<Map<string, TTSResult>> {
    const commonPhrases = [
      'Hej! Tack för att du vill dela din feedback.',
      'Kan du berätta lite mer om det?',
      'Det låter intressant. Kan du ge ett konkret exempel?',
      'Tack för din feedback! Det var mycket användbart.',
      'Finns det något annat du skulle vilja tillägga?',
      'Tack så mycket för din tid och dina värdefulla synpunkter!'
    ];

    const preloadedPhrases = new Map<string, TTSResult>();

    try {
      const results = await Promise.allSettled(
        commonPhrases.map(phrase => this.synthesize(phrase))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          preloadedPhrases.set(commonPhrases[index], result.value);
        } else {
          console.warn(`Failed to preload phrase: ${commonPhrases[index]}`);
        }
      });

      console.log(`Preloaded ${preloadedPhrases.size}/${commonPhrases.length} TTS phrases`);
      return preloadedPhrases;

    } catch (error) {
      console.error('Failed to preload TTS phrases:', error);
      return new Map();
    }
  }

  /**
   * Estimate audio duration from text (rough calculation)
   */
  estimateAudioDuration(text: string): number {
    // Swedish speech: approximately 4-5 words per second for natural conversation
    const wordCount = text.split(/\s+/).length;
    return wordCount / 4.5; // seconds
  }

  /**
   * Validate text before TTS synthesis
   */
  validateText(text: string): { valid: boolean; error?: string } {
    if (!text || !text.trim()) {
      return { valid: false, error: 'Text is empty' };
    }

    if (text.length > 500) {
      return { valid: false, error: 'Text too long (max 500 characters)' };
    }

    // Check for Swedish characters to ensure proper pronunciation
    const swedishPattern = /[åäöÅÄÖ]/;
    if (swedishPattern.test(text)) {
      // Contains Swedish characters - good for Swedish TTS
    }

    return { valid: true };
  }
}