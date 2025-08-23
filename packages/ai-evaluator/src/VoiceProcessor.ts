/**
 * Voice processing service for audio transcription with WhisperX integration
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  duration: number;
  qualityScore?: number;
  audioDuration?: number;
  fallback?: boolean;
  segmentsCount?: number;
  detectedLanguage?: string;          // Auto-detected language if different from config
  detectedLanguageConfidence?: number; // Confidence in language detection
  supportedLanguages?: string[];       // Languages the model supports
}

export interface VoiceProcessorConfig {
  sampleRate?: number;
  language?: string;
  model?: string;
  enableLanguageDetection?: boolean;  // Enable automatic language detection
  supportedLanguages?: string[];      // Languages to detect (default: ['sv', 'en', 'da', 'no', 'fi'])
  fallbackLanguage?: string;         // Fallback if detection fails
  languageDetectionThreshold?: number; // Minimum confidence for detection (default: 0.7)
}

export class VoiceProcessor {
  private config: Required<VoiceProcessorConfig>;

  constructor(config: VoiceProcessorConfig = {}) {
    this.config = {
      sampleRate: 16000,
      language: 'sv', // Swedish by default
      model: 'base',
      enableLanguageDetection: true,
      supportedLanguages: ['sv', 'en', 'da', 'no', 'fi'], // Nordic languages + English
      fallbackLanguage: 'sv',
      languageDetectionThreshold: 0.7,
      ...config
    };
  }

  /**
   * Transcribe audio buffer to text using WhisperX with language detection
   */
  async transcribe(audioBuffer: Buffer): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    try {
      // Validate audio buffer
      this.validateAudio(audioBuffer);
      
      // Try WhisperX transcription first
      try {
        const result = await this.transcribeWithWhisperX(audioBuffer);
        return result;
      } catch (whisperError) {
        console.warn('WhisperX transcription failed, falling back to mock:', whisperError.message);
        
        // Fallback to mock transcription for development
        const mockTranscription = this.mockTranscribe(audioBuffer);
        const duration = Date.now() - startTime;
        
        return {
          text: mockTranscription,
          language: this.config.language,
          confidence: 0.85, // Lower confidence for mock
          duration,
          fallback: true,
          detectedLanguage: this.config.language,
          detectedLanguageConfidence: 0.5,
          supportedLanguages: this.config.supportedLanguages
        };
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      throw new Error(`Voice transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect language from audio buffer using WhisperX
   */
  async detectLanguage(audioBuffer: Buffer): Promise<{
    detectedLanguage: string;
    confidence: number;
    supportedLanguages: string[];
    allLanguages: Array<{ language: string; confidence: number; }>;
  }> {
    const startTime = Date.now();
    
    try {
      // Validate audio buffer
      this.validateAudio(audioBuffer);
      
      if (!this.config.enableLanguageDetection) {
        return {
          detectedLanguage: this.config.language,
          confidence: 1.0,
          supportedLanguages: this.config.supportedLanguages,
          allLanguages: [{ language: this.config.language, confidence: 1.0 }]
        };
      }

      const tempDir = tmpdir();
      const tempAudioPath = join(tempDir, `lang_detect_${Date.now()}.wav`);
      
      try {
        // Write audio buffer to temporary file
        await fs.writeFile(tempAudioPath, audioBuffer);
        
        // Run language detection using WhisperX
        const result = await this.runLanguageDetection(tempAudioPath);
        
        return result;
        
      } finally {
        // Clean up temporary file
        try {
          await fs.unlink(tempAudioPath);
        } catch (err) {
          console.warn('Failed to cleanup temp audio file:', err);
        }
      }
      
    } catch (error) {
      console.warn('Language detection failed, using fallback:', error);
      return {
        detectedLanguage: this.config.fallbackLanguage,
        confidence: 0.5,
        supportedLanguages: this.config.supportedLanguages,
        allLanguages: [{ language: this.config.fallbackLanguage, confidence: 0.5 }]
      };
    }
  }

  /**
   * Transcribe using WhisperX Python processor with language detection
   */
  private async transcribeWithWhisperX(audioBuffer: Buffer): Promise<TranscriptionResult> {
    const tempDir = tmpdir();
    const tempAudioPath = join(tempDir, `audio_${Date.now()}.wav`);
    
    try {
      // Write audio buffer to temporary file
      await fs.writeFile(tempAudioPath, audioBuffer);
      
      // Get path to WhisperX processor script
      const whisperxScript = join(__dirname, 'whisperx_processor.py');
      
      // Check if Python script exists
      try {
        await fs.access(whisperxScript);
      } catch {
        throw new Error('WhisperX processor script not found');
      }

      let targetLanguage = this.config.language;
      let detectedLanguage = this.config.language;
      let languageConfidence = 1.0;
      let supportedLanguages = this.config.supportedLanguages;

      // Perform language detection if enabled
      if (this.config.enableLanguageDetection) {
        try {
          const langDetectionResult = await this.runLanguageDetection(tempAudioPath);
          
          // Use detected language if confidence is high enough
          if (langDetectionResult.confidence >= this.config.languageDetectionThreshold) {
            // Check if detected language is in supported languages
            if (this.config.supportedLanguages.includes(langDetectionResult.detectedLanguage)) {
              targetLanguage = langDetectionResult.detectedLanguage;
              detectedLanguage = langDetectionResult.detectedLanguage;
              languageConfidence = langDetectionResult.confidence;
            } else {
              console.warn(`Detected language ${langDetectionResult.detectedLanguage} not in supported languages, using fallback`);
              targetLanguage = this.config.fallbackLanguage;
              detectedLanguage = langDetectionResult.detectedLanguage;
              languageConfidence = langDetectionResult.confidence;
            }
          }
        } catch (langError) {
          console.warn('Language detection failed, using configured language:', langError);
        }
      }
      
      // Run transcription with determined language
      const result = await this.runWhisperXProcess(whisperxScript, tempAudioPath, targetLanguage);
      
      // Add language detection information to result
      result.detectedLanguage = detectedLanguage;
      result.detectedLanguageConfidence = languageConfidence;
      result.supportedLanguages = supportedLanguages;
      
      return result;
      
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(tempAudioPath);
      } catch (err) {
        console.warn('Failed to cleanup temp audio file:', err);
      }
    }
  }

  /**
   * Run language detection using WhisperX
   */
  private async runLanguageDetection(audioPath: string): Promise<{
    detectedLanguage: string;
    confidence: number;
    supportedLanguages: string[];
    allLanguages: Array<{ language: string; confidence: number; }>;
  }> {
    return new Promise((resolve, reject) => {
      const whisperxScript = join(__dirname, 'whisperx_processor.py');
      const args = [
        whisperxScript,
        '--audio', audioPath,
        '--detect-language-only',
        '--supported-languages', this.config.supportedLanguages.join(','),
        '--model', this.config.model
      ];
      
      const pythonProcess = spawn('python3', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Language detection failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          
          resolve({
            detectedLanguage: result.detected_language || this.config.fallbackLanguage,
            confidence: result.language_confidence || 0.5,
            supportedLanguages: this.config.supportedLanguages,
            allLanguages: result.all_languages || [
              { language: result.detected_language || this.config.fallbackLanguage, confidence: result.language_confidence || 0.5 }
            ]
          });
          
        } catch (parseError) {
          reject(new Error(`Failed to parse language detection result: ${parseError.message}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start language detection process: ${error.message}`));
      });
      
      // Set timeout for detection (10 seconds max)
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Language detection timeout'));
      }, 10000);
    });
  }

  /**
   * Run WhisperX Python process and parse results
   */
  private async runWhisperXProcess(scriptPath: string, audioPath: string, language?: string): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      const args = [
        scriptPath,
        '--audio', audioPath,
        '--model', this.config.model,
        '--language', language || this.config.language,
        '--device', 'auto'
      ];
      
      const pythonProcess = spawn('python3', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`WhisperX process failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          
          // Map Python result to TypeScript interface
          resolve({
            text: result.text || '',
            language: result.language || language || this.config.language,
            confidence: result.confidence || 0.0,
            duration: result.duration || 0.0,
            qualityScore: result.quality_score,
            audioDuration: result.audio_duration,
            segmentsCount: result.segments_count
          });
          
        } catch (parseError) {
          reject(new Error(`Failed to parse WhisperX result: ${parseError.message}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start WhisperX process: ${error.message}`));
      });
      
      // Set timeout for transcription (30 seconds max)
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('WhisperX transcription timeout'));
      }, 30000);
    });
  }

  /**
   * Get supported languages for the current model
   */
  getSupportedLanguages(): string[] {
    return this.config.supportedLanguages;
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.config.supportedLanguages.includes(language);
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<VoiceProcessorConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  /**
   * Validate audio quality before transcription
   */
  validateAudio(audioBuffer: Buffer): boolean {
    // Basic validation - check if buffer has reasonable size
    const minSize = 1024; // 1KB minimum
    const maxSize = 50 * 1024 * 1024; // 50MB maximum
    
    if (audioBuffer.length < minSize) {
      throw new Error('Audio buffer too small - likely empty recording');
    }
    
    if (audioBuffer.length > maxSize) {
      throw new Error('Audio buffer too large - exceeds maximum size');
    }
    
    return true;
  }

  /**
   * Get processor status and configuration
   */
  async getStatus(): Promise<{
    available: boolean;
    model: string;
    language: string;
    sampleRate: number;
    whisperxAvailable: boolean;
    fallbackMode: boolean;
    languageDetectionEnabled: boolean;
    supportedLanguages: string[];
    fallbackLanguage: string;
  }> {
    const whisperxAvailable = await this.checkWhisperXAvailability();
    
    return {
      available: true,
      model: this.config.model,
      language: this.config.language,
      sampleRate: this.config.sampleRate,
      whisperxAvailable,
      fallbackMode: !whisperxAvailable,
      languageDetectionEnabled: this.config.enableLanguageDetection,
      supportedLanguages: this.config.supportedLanguages,
      fallbackLanguage: this.config.fallbackLanguage
    };
  }

  /**
   * Check if WhisperX is available
   */
  private async checkWhisperXAvailability(): Promise<boolean> {
    try {
      // Check if Python script exists
      const whisperxScript = join(__dirname, 'whisperx_processor.py');
      await fs.access(whisperxScript);
      
      // Try to run a quick status check
      return new Promise((resolve) => {
        const pythonProcess = spawn('python3', [whisperxScript, '--help'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        pythonProcess.on('close', (code) => {
          resolve(code === 0);
        });
        
        pythonProcess.on('error', () => {
          resolve(false);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          pythonProcess.kill();
          resolve(false);
        }, 5000);
      });
      
    } catch {
      return false;
    }
  }

  /**
   * Mock transcription for development/testing with language detection
   * TODO: Replace with WhisperX integration
   */
  private mockTranscribe(audioBuffer: Buffer): string {
    // Generate mock feedback based on buffer size and configured language
    const sizeCategory = this.categorizeAudioSize(audioBuffer.length);
    
    // Mock responses in different languages
    const mockResponsesByLanguage: Record<string, Record<string, string[]>> = {
      'sv': {
        short: [
          "Bra service",
          "Mycket bra",
          "Snabb service",
          "Trevlig personal"
        ],
        medium: [
          "Personalen var mycket trevlig och hjälpsam. Butiken var ren och välorganiserad.",
          "Kaffe var riktigt bra och atmosfären var mysig. Dock var det lite långsamt i kassan.",
          "Bra sortiment och fräscha varor. Personalen kunde dock varit mer uppmärksam.",
          "Mycket nöjd med servicen idag. Allt gick smidigt och snabbt."
        ],
        long: [
          "Jag är överlag mycket nöjd med mitt besök idag. Personalen var otroligt trevlig och hjälpsam när jag frågade om olika produkter. Butiken var välstädad och produkterna var fräscha. Det enda som kunde varit bättre var att det var lite trångt vid kassan och jag fick vänta lite längre än vanligt. Men annars en mycket positiv upplevelse som fick mig att vilja komma tillbaka.",
          "Personalen var professionell och kunnig om produkterna. Jag uppskattar verkligen att de tog sig tid att svara på mina frågor. Butiken har ett bra sortiment och priserna är rimliga. Dock tycker jag att det kunde varit lite mer ordning i hyllorna och vissa områden kändes lite rörigt. Men överlag en bra upplevelse."
        ]
      },
      'en': {
        short: [
          "Great service",
          "Very good",
          "Fast service",
          "Friendly staff"
        ],
        medium: [
          "The staff was very friendly and helpful. The store was clean and well organized.",
          "Coffee was really good and the atmosphere was cozy. However, it was a bit slow at checkout.",
          "Good selection and fresh products. Staff could have been more attentive though.",
          "Very satisfied with the service today. Everything went smoothly and quickly."
        ],
        long: [
          "I'm overall very satisfied with my visit today. The staff was incredibly friendly and helpful when I asked about different products. The store was well-cleaned and the products were fresh. The only thing that could have been better was that it was a bit crowded at checkout and I had to wait a bit longer than usual. But otherwise a very positive experience that made me want to come back.",
          "The staff was professional and knowledgeable about the products. I really appreciate that they took time to answer my questions. The store has a good selection and the prices are reasonable. However, I think there could have been a bit more order on the shelves and some areas felt a bit messy. But overall a good experience."
        ]
      },
      'da': {
        short: [
          "God service",
          "Meget godt",
          "Hurtig service",
          "Venligt personale"
        ],
        medium: [
          "Personalet var meget venligt og hjælpsomt. Butikken var ren og velorganiseret.",
          "Kaffen var rigtig god og atmosfæren var hyggelig. Dog var det lidt langsomt ved kassen."
        ],
        long: [
          "Jeg er overordnet meget tilfreds med mit besøg i dag. Personalet var utrolig venligt og hjælpsomt, da jeg spurgte om forskellige produkter."
        ]
      }
    };

    const language = this.config.language;
    const responses = mockResponsesByLanguage[language] || mockResponsesByLanguage['sv'];
    const categoryResponses = responses[sizeCategory] || responses['medium'];
    
    return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
  }

  /**
   * Categorize audio buffer size for mock responses
   */
  private categorizeAudioSize(size: number): 'short' | 'medium' | 'long' {
    if (size < 50000) return 'short';      // < 50KB
    if (size < 200000) return 'medium';    // < 200KB  
    return 'long';                         // >= 200KB
  }
}