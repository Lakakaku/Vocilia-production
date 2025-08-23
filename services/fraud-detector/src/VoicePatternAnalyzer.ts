import { FraudCheck } from './types';

/**
 * Voice Pattern Analysis for Fraud Detection
 * 
 * Detects synthetic/AI-generated voice attempts and automated submissions
 * Optimized for Swedish voice patterns and characteristics
 */

export interface VoiceFeatures {
  // Fundamental frequency analysis
  f0Mean: number;           // Average pitch (Hz)
  f0Std: number;            // Pitch variation (Hz)
  f0Range: number;          // Pitch range (Hz)
  
  // Spectral features
  spectralCentroid: number; // Brightness of sound
  spectralRolloff: number;  // Frequency distribution
  spectralFlux: number;     // Rate of spectral change
  
  // Temporal features
  speakingRate: number;     // Words per minute
  pauseDuration: number;    // Average pause length (ms)
  voicingRatio: number;     // Voiced vs unvoiced ratio
  
  // Energy features
  rmsEnergy: number;        // Root mean square energy
  zeroCrossingRate: number; // Zero crossing rate
  
  // Swedish-specific features
  vowelFormants: number[];  // Swedish vowel characteristics
  consonantEnergy: number;  // Swedish consonant patterns
  prosodyPattern: number;   // Swedish prosody characteristics
}

export interface VoiceFingerprint {
  sessionId: string;
  customerHash: string;
  features: VoiceFeatures;
  timestamp: Date;
  audioLength: number;      // Duration in seconds
  quality: number;          // Audio quality score (0-1)
  confidence: number;       // Feature extraction confidence
}

export interface SyntheticVoiceIndicators {
  // TTS detection indicators
  unnaturalProsody: number;     // 0-1 score
  mechanicalTiming: number;     // 0-1 score
  spectralArtifacts: number;    // 0-1 score
  
  // Common synthetic voice patterns
  constantPitch: number;        // Lack of natural pitch variation
  roboticFormants: number;      // Artificial formant patterns
  clicksAndPops: number;        // Digital artifacts
  
  // Swedish TTS specific
  swedishTTSPatterns: number;   // Known Swedish TTS signatures
  pronunciationErrors: number;  // Mispronounced Swedish words
}

export interface VoiceConsistencyAnalysis {
  sameVoiceConfidence: number;  // 0-1 confidence same speaker
  voiceSimilarity: number;      // 0-1 similarity score
  timeBetweenSessions: number;  // Minutes between sessions
  suspiciousRapidChange: boolean; // Voice change too fast
}

/**
 * Core voice pattern analysis engine
 */
export class VoicePatternAnalyzer {
  private voiceHistory: Map<string, VoiceFingerprint[]> = new Map();
  private swedishVoicePatterns: Map<string, number[]> = new Map();
  
  // Swedish language phonetic patterns
  private swedishPhonemes = {
    vowels: ['a', 'e', 'i', 'o', 'u', 'y', 'å', 'ä', 'ö'],
    consonants: ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'],
    commonPatterns: ['sk', 'stj', 'kj', 'tj', 'ng', 'nk'],
    prosodyMarkers: ['är', 'och', 'det', 'en', 'att', 'som'] // Common Swedish function words
  };

  constructor() {
    this.initializeSwedishPatterns();
  }

  /**
   * Main analysis entry point
   */
  async analyzeVoicePattern(
    audioData: ArrayBuffer,
    sessionId: string,
    customerHash: string,
    transcript?: string
  ): Promise<FraudCheck> {
    try {
      // Extract voice features from audio
      const voiceFeatures = await this.extractVoiceFeatures(audioData, transcript);
      
      // Create voice fingerprint
      const fingerprint: VoiceFingerprint = {
        sessionId,
        customerHash,
        features: voiceFeatures,
        timestamp: new Date(),
        audioLength: this.calculateAudioLength(audioData),
        quality: this.assessAudioQuality(audioData),
        confidence: this.calculateFeatureConfidence(voiceFeatures)
      };

      // Store fingerprint for future comparisons
      this.storeVoiceFingerprint(fingerprint);

      // Run analysis checks
      const syntheticIndicators = this.detectSyntheticVoice(voiceFeatures, transcript);
      const consistencyAnalysis = this.analyzeVoiceConsistency(fingerprint);
      
      // Calculate overall risk score
      const riskScore = this.calculateVoiceRiskScore(
        syntheticIndicators,
        consistencyAnalysis,
        fingerprint
      );

      // Generate evidence
      const evidence = {
        syntheticIndicators,
        consistencyAnalysis,
        voiceFeatures: {
          f0Mean: Math.round(voiceFeatures.f0Mean),
          speakingRate: Math.round(voiceFeatures.speakingRate),
          voicingRatio: Math.round(voiceFeatures.voicingRatio * 100) / 100
        },
        audioQuality: fingerprint.quality,
        sessionHistory: this.getSessionHistory(customerHash).length,
        confidence: fingerprint.confidence
      };

      return {
        type: riskScore > 0.7 ? 'voice_synthetic' : 'voice_pattern',
        score: riskScore,
        evidence,
        confidence: fingerprint.confidence,
        description: this.generateVoiceDescription(riskScore, syntheticIndicators),
        severity: this.determineVoiceSeverity(riskScore)
      };

    } catch (error) {
      // Fallback analysis on error
      return {
        type: 'voice_pattern',
        score: 0.2, // Conservative low risk
        evidence: {
          error: error instanceof Error ? error.message : 'Unknown error',
          fallbackApplied: true
        },
        confidence: 0.3,
        description: 'Voice analysis error - conservative assessment applied',
        severity: 'low'
      };
    }
  }

  /**
   * Extract voice features from audio data
   */
  private async extractVoiceFeatures(
    audioData: ArrayBuffer, 
    transcript?: string
  ): Promise<VoiceFeatures> {
    // Convert ArrayBuffer to audio analysis format
    const audioBuffer = await this.decodeAudioData(audioData);
    
    // Extract fundamental frequency (pitch) features
    const f0Analysis = this.analyzeFundamentalFrequency(audioBuffer);
    
    // Extract spectral features
    const spectralFeatures = this.analyzeSpectralFeatures(audioBuffer);
    
    // Extract temporal features
    const temporalFeatures = this.analyzeTemporalFeatures(audioBuffer, transcript);
    
    // Extract energy features
    const energyFeatures = this.analyzeEnergyFeatures(audioBuffer);
    
    // Extract Swedish-specific features
    const swedishFeatures = this.analyzeSwedishPatterns(audioBuffer, transcript);

    return {
      // Fundamental frequency
      f0Mean: f0Analysis.mean,
      f0Std: f0Analysis.std,
      f0Range: f0Analysis.range,
      
      // Spectral features
      spectralCentroid: spectralFeatures.centroid,
      spectralRolloff: spectralFeatures.rolloff,
      spectralFlux: spectralFeatures.flux,
      
      // Temporal features
      speakingRate: temporalFeatures.speakingRate,
      pauseDuration: temporalFeatures.pauseDuration,
      voicingRatio: temporalFeatures.voicingRatio,
      
      // Energy features
      rmsEnergy: energyFeatures.rms,
      zeroCrossingRate: energyFeatures.zcr,
      
      // Swedish-specific
      vowelFormants: swedishFeatures.vowelFormants,
      consonantEnergy: swedishFeatures.consonantEnergy,
      prosodyPattern: swedishFeatures.prosodyPattern
    };
  }

  /**
   * Detect synthetic/AI-generated voice patterns
   */
  private detectSyntheticVoice(
    features: VoiceFeatures, 
    transcript?: string
  ): SyntheticVoiceIndicators {
    const indicators: SyntheticVoiceIndicators = {
      unnaturalProsody: 0,
      mechanicalTiming: 0,
      spectralArtifacts: 0,
      constantPitch: 0,
      roboticFormants: 0,
      clicksAndPops: 0,
      swedishTTSPatterns: 0,
      pronunciationErrors: 0
    };

    // Check for unnatural prosody
    if (features.f0Std < 10) { // Very low pitch variation
      indicators.unnaturalProsody += 0.4;
    }
    if (features.prosodyPattern < 0.3) { // Poor Swedish prosody
      indicators.unnaturalProsody += 0.3;
    }

    // Check for mechanical timing
    if (features.pauseDuration > 500 || features.pauseDuration < 50) {
      indicators.mechanicalTiming += 0.3;
    }
    if (features.speakingRate < 80 || features.speakingRate > 250) {
      indicators.mechanicalTiming += 0.4;
    }

    // Check for spectral artifacts
    if (features.spectralFlux < 0.1) { // Low spectral variation
      indicators.spectralArtifacts += 0.3;
    }
    if (features.zeroCrossingRate > 0.8 || features.zeroCrossingRate < 0.1) {
      indicators.spectralArtifacts += 0.2;
    }

    // Check for constant pitch (TTS characteristic)
    if (features.f0Std / features.f0Mean < 0.1) { // Low pitch variation ratio
      indicators.constantPitch += 0.5;
    }

    // Check for robotic formants
    const formantVariation = this.calculateFormantVariation(features.vowelFormants);
    if (formantVariation < 0.2) {
      indicators.roboticFormants += 0.4;
    }

    // Check for Swedish TTS patterns
    indicators.swedishTTSPatterns = this.detectSwedishTTSPatterns(features, transcript);

    // Check for pronunciation errors (common in TTS)
    if (transcript) {
      indicators.pronunciationErrors = this.detectPronunciationErrors(transcript);
    }

    return indicators;
  }

  /**
   * Analyze voice consistency across sessions
   */
  private analyzeVoiceConsistency(fingerprint: VoiceFingerprint): VoiceConsistencyAnalysis {
    const history = this.getSessionHistory(fingerprint.customerHash);
    
    if (history.length === 0) {
      return {
        sameVoiceConfidence: 0.5, // Neutral for first session
        voiceSimilarity: 0,
        timeBetweenSessions: 0,
        suspiciousRapidChange: false
      };
    }

    const lastSession = history[history.length - 1];
    const timeDiff = fingerprint.timestamp.getTime() - lastSession.timestamp.getTime();
    const minutesBetween = timeDiff / (1000 * 60);

    // Calculate voice similarity
    const similarity = this.calculateVoiceSimilarity(fingerprint.features, lastSession.features);
    
    // Determine if voice change is suspicious
    const suspiciousRapidChange = similarity < 0.6 && minutesBetween < 30;

    return {
      sameVoiceConfidence: similarity,
      voiceSimilarity: similarity,
      timeBetweenSessions: minutesBetween,
      suspiciousRapidChange
    };
  }

  /**
   * Calculate overall voice pattern risk score
   */
  private calculateVoiceRiskScore(
    synthetic: SyntheticVoiceIndicators,
    consistency: VoiceConsistencyAnalysis,
    fingerprint: VoiceFingerprint
  ): number {
    let riskScore = 0;

    // Synthetic voice indicators (weighted)
    const syntheticScore = (
      synthetic.unnaturalProsody * 0.25 +
      synthetic.mechanicalTiming * 0.20 +
      synthetic.spectralArtifacts * 0.15 +
      synthetic.constantPitch * 0.20 +
      synthetic.roboticFormants * 0.10 +
      synthetic.swedishTTSPatterns * 0.10
    );

    riskScore += syntheticScore * 0.7; // High weight for synthetic detection

    // Voice consistency issues
    if (consistency.suspiciousRapidChange) {
      riskScore += 0.3;
    }
    if (consistency.sameVoiceConfidence < 0.4) {
      riskScore += 0.2;
    }

    // Audio quality issues (potential manipulation)
    if (fingerprint.quality < 0.5) {
      riskScore += 0.1;
    }

    // Feature extraction confidence
    if (fingerprint.confidence < 0.6) {
      riskScore += 0.1;
    }

    return Math.min(1, riskScore);
  }

  // Audio processing helper methods
  private async decodeAudioData(audioData: ArrayBuffer): Promise<Float32Array> {
    // Simplified audio decoding - in production would use proper audio decoding
    // For now, return mock data for development
    const samples = new Float32Array(audioData.byteLength / 4);
    const view = new Int32Array(audioData);
    
    for (let i = 0; i < view.length && i < samples.length; i++) {
      samples[i] = view[i] / 2147483648; // Normalize to [-1, 1]
    }
    
    return samples;
  }

  private analyzeFundamentalFrequency(audioBuffer: Float32Array): {
    mean: number; std: number; range: number;
  } {
    // Simplified pitch analysis - in production would use YIN algorithm or similar
    const sampleRate = 16000; // Assuming 16kHz sample rate
    const windowSize = 1024;
    const pitchValues: number[] = [];

    for (let i = 0; i < audioBuffer.length - windowSize; i += windowSize / 2) {
      const window = audioBuffer.slice(i, i + windowSize);
      const pitch = this.estimatePitch(window, sampleRate);
      if (pitch > 50 && pitch < 800) { // Valid human speech range
        pitchValues.push(pitch);
      }
    }

    if (pitchValues.length === 0) {
      return { mean: 0, std: 0, range: 0 };
    }

    const mean = pitchValues.reduce((sum, p) => sum + p, 0) / pitchValues.length;
    const variance = pitchValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pitchValues.length;
    const std = Math.sqrt(variance);
    const range = Math.max(...pitchValues) - Math.min(...pitchValues);

    return { mean, std, range };
  }

  private estimatePitch(window: Float32Array, sampleRate: number): number {
    // Simplified autocorrelation-based pitch estimation
    const minPeriod = Math.floor(sampleRate / 800); // 800 Hz max
    const maxPeriod = Math.floor(sampleRate / 50);  // 50 Hz min
    
    let maxCorrelation = 0;
    let bestPeriod = 0;

    for (let period = minPeriod; period <= maxPeriod && period < window.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < window.length - period; i++) {
        correlation += window[i] * window[i + period];
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }

    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  }

  private analyzeSpectralFeatures(audioBuffer: Float32Array): {
    centroid: number; rolloff: number; flux: number;
  } {
    // Simplified spectral analysis - in production would use FFT
    const windowSize = 1024;
    const features = [];

    for (let i = 0; i < audioBuffer.length - windowSize; i += windowSize / 2) {
      const window = audioBuffer.slice(i, i + windowSize);
      const spectrum = this.simpleFFT(window);
      
      features.push({
        centroid: this.calculateSpectralCentroid(spectrum),
        rolloff: this.calculateSpectralRolloff(spectrum),
        flux: this.calculateSpectralFlux(spectrum, features[features.length - 1]?.spectrum)
      });
    }

    // Average the features
    const avgCentroid = features.reduce((sum, f) => sum + f.centroid, 0) / features.length;
    const avgRolloff = features.reduce((sum, f) => sum + f.rolloff, 0) / features.length;
    const avgFlux = features.reduce((sum, f) => sum + f.flux, 0) / features.length;

    return {
      centroid: avgCentroid || 0,
      rolloff: avgRolloff || 0,
      flux: avgFlux || 0
    };
  }

  private analyzeTemporalFeatures(audioBuffer: Float32Array, transcript?: string): {
    speakingRate: number; pauseDuration: number; voicingRatio: number;
  } {
    const sampleRate = 16000;
    const frameSize = 512;
    const hopSize = 256;
    
    // Voice activity detection
    const voicedFrames = [];
    const pauseSegments = [];
    
    for (let i = 0; i < audioBuffer.length - frameSize; i += hopSize) {
      const frame = audioBuffer.slice(i, i + frameSize);
      const energy = this.calculateFrameEnergy(frame);
      const isVoiced = energy > 0.01; // Simple energy-based VAD
      
      voicedFrames.push(isVoiced);
    }
    
    // Calculate voicing ratio
    const voicingRatio = voicedFrames.filter(v => v).length / voicedFrames.length;
    
    // Calculate speaking rate
    const words = transcript?.split(/\s+/).length || 0;
    const durationSeconds = audioBuffer.length / sampleRate;
    const speakingRate = words > 0 ? (words / durationSeconds) * 60 : 0; // WPM
    
    // Calculate average pause duration (simplified)
    const pauseDuration = this.calculateAveragePauseDuration(voicedFrames, hopSize, sampleRate);

    return { speakingRate, pauseDuration, voicingRatio };
  }

  private analyzeEnergyFeatures(audioBuffer: Float32Array): {
    rms: number; zcr: number;
  } {
    // RMS Energy
    const sumSquares = audioBuffer.reduce((sum, sample) => sum + sample * sample, 0);
    const rms = Math.sqrt(sumSquares / audioBuffer.length);

    // Zero Crossing Rate
    let crossings = 0;
    for (let i = 1; i < audioBuffer.length; i++) {
      if ((audioBuffer[i] >= 0) !== (audioBuffer[i - 1] >= 0)) {
        crossings++;
      }
    }
    const zcr = crossings / audioBuffer.length;

    return { rms, zcr };
  }

  private analyzeSwedishPatterns(audioBuffer: Float32Array, transcript?: string): {
    vowelFormants: number[]; consonantEnergy: number; prosodyPattern: number;
  } {
    // Simplified Swedish pattern analysis
    const vowelFormants = this.estimateSwedishVowelFormants(audioBuffer);
    const consonantEnergy = this.calculateConsonantEnergy(audioBuffer);
    const prosodyPattern = this.analyzeSwedishProsody(audioBuffer, transcript);

    return { vowelFormants, consonantEnergy, prosodyPattern };
  }

  // Swedish-specific analysis methods
  private estimateSwedishVowelFormants(audioBuffer: Float32Array): number[] {
    // Simplified formant estimation for Swedish vowels
    // In production, would use proper formant tracking algorithms
    const f1 = 500 + Math.random() * 300; // First formant
    const f2 = 1200 + Math.random() * 800; // Second formant
    const f3 = 2500 + Math.random() * 500; // Third formant
    
    return [f1, f2, f3];
  }

  private calculateConsonantEnergy(audioBuffer: Float32Array): number {
    // Simplified consonant energy calculation
    // High-frequency energy typically indicates consonants
    const highFreqEnergy = this.calculateHighFrequencyEnergy(audioBuffer);
    return highFreqEnergy;
  }

  private analyzeSwedishProsody(audioBuffer: Float32Array, transcript?: string): number {
    // Simplified Swedish prosody analysis
    // Check for typical Swedish sentence-level intonation patterns
    if (!transcript) return 0.5;

    let prosodyScore = 0.5;

    // Check for Swedish function words (prosodically weak)
    const functionWords = ['är', 'och', 'det', 'en', 'att', 'som', 'på', 'av'];
    const words = transcript.toLowerCase().split(/\s+/);
    const functionWordRatio = words.filter(w => functionWords.includes(w)).length / words.length;
    
    if (functionWordRatio > 0.2 && functionWordRatio < 0.5) {
      prosodyScore += 0.3; // Good Swedish function word distribution
    }

    return Math.min(1, prosodyScore);
  }

  private detectSwedishTTSPatterns(features: VoiceFeatures, transcript?: string): number {
    let ttsScore = 0;

    // Common Swedish TTS characteristics
    if (features.f0Mean > 100 && features.f0Mean < 200 && features.f0Std < 15) {
      ttsScore += 0.3; // Typical TTS pitch characteristics
    }

    if (features.speakingRate > 140 && features.speakingRate < 180) {
      ttsScore += 0.2; // Typical TTS speaking rate
    }

    if (transcript && this.hasSwedishTTSPronunciationPatterns(transcript)) {
      ttsScore += 0.4; // TTS pronunciation patterns
    }

    return Math.min(1, ttsScore);
  }

  private hasSwedishTTSPronunciationPatterns(transcript: string): boolean {
    // Check for common Swedish TTS mispronunciations or patterns
    const ttsPatterns = [
      /\bsju\b/, // Often mispronounced by TTS
      /\bskju\b/, // Complex Swedish sound
      /\bstjärn\b/, // Another complex sound
      /\bkött\b/, // Swedish ö sound
    ];

    return ttsPatterns.some(pattern => pattern.test(transcript.toLowerCase()));
  }

  private detectPronunciationErrors(transcript: string): number {
    // Simple pronunciation error detection based on transcript
    // In production, would compare with expected Swedish pronunciation
    const commonErrors = [
      'sjuu', 'kott', 'har', 'vill', // Common TTS errors for Swedish
    ];

    const errors = commonErrors.filter(error => 
      transcript.toLowerCase().includes(error)
    );

    return Math.min(1, errors.length * 0.3);
  }

  // Utility methods
  private calculateVoiceSimilarity(features1: VoiceFeatures, features2: VoiceFeatures): number {
    // Simplified voice similarity calculation using feature distance
    const pitchSim = 1 - Math.abs(features1.f0Mean - features2.f0Mean) / 200;
    const spectralSim = 1 - Math.abs(features1.spectralCentroid - features2.spectralCentroid) / 1000;
    const rateSim = 1 - Math.abs(features1.speakingRate - features2.speakingRate) / 100;
    
    return Math.max(0, (pitchSim + spectralSim + rateSim) / 3);
  }

  private calculateFormantVariation(formants: number[]): number {
    if (formants.length < 2) return 0;
    
    const mean = formants.reduce((sum, f) => sum + f, 0) / formants.length;
    const variance = formants.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / formants.length;
    
    return variance / (mean || 1); // Coefficient of variation
  }

  private storeVoiceFingerprint(fingerprint: VoiceFingerprint): void {
    if (!this.voiceHistory.has(fingerprint.customerHash)) {
      this.voiceHistory.set(fingerprint.customerHash, []);
    }
    
    const history = this.voiceHistory.get(fingerprint.customerHash)!;
    history.push(fingerprint);
    
    // Keep only last 10 sessions per customer
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  private getSessionHistory(customerHash: string): VoiceFingerprint[] {
    return this.voiceHistory.get(customerHash) || [];
  }

  private generateVoiceDescription(
    riskScore: number, 
    indicators: SyntheticVoiceIndicators
  ): string {
    if (riskScore >= 0.8) {
      if (indicators.swedishTTSPatterns > 0.5) {
        return 'Swedish TTS/synthetic voice patterns detected';
      }
      if (indicators.unnaturalProsody > 0.5) {
        return 'Unnatural voice prosody suggests synthetic generation';
      }
      return 'High confidence synthetic voice detection';
    }
    
    if (riskScore >= 0.5) {
      return 'Suspicious voice patterns detected - possible automation';
    }
    
    return 'Voice patterns appear natural';
  }

  private determineVoiceSeverity(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore >= 0.8) return 'high';
    if (riskScore >= 0.5) return 'medium';
    return 'low';
  }

  // Helper methods for audio processing
  private calculateAudioLength(audioData: ArrayBuffer): number {
    // Simplified calculation - assumes 16kHz, 16-bit mono
    return audioData.byteLength / (16000 * 2); // seconds
  }

  private assessAudioQuality(audioData: ArrayBuffer): number {
    // Simplified quality assessment
    if (audioData.byteLength < 8000) return 0.2; // Too short
    if (audioData.byteLength > 1600000) return 0.8; // Good length
    return 0.6; // Reasonable quality
  }

  private calculateFeatureConfidence(features: VoiceFeatures): number {
    let confidence = 0.5;

    if (features.f0Mean > 50 && features.f0Mean < 500) confidence += 0.2;
    if (features.voicingRatio > 0.3 && features.voicingRatio < 0.9) confidence += 0.2;
    if (features.rmsEnergy > 0.01) confidence += 0.1;

    return Math.min(1, confidence);
  }

  private initializeSwedishPatterns(): void {
    // Initialize Swedish phonetic patterns for recognition
    this.swedishVoicePatterns.set('vowel_patterns', [500, 1200, 2500]);
    this.swedishVoicePatterns.set('consonant_patterns', [1500, 3000, 4500]);
  }

  // Simplified audio processing helpers
  private simpleFFT(window: Float32Array): Float32Array {
    // Simplified FFT placeholder - in production use proper FFT library
    const spectrum = new Float32Array(window.length / 2);
    for (let i = 0; i < spectrum.length; i++) {
      spectrum[i] = Math.abs(window[i] || 0);
    }
    return spectrum;
  }

  private calculateSpectralCentroid(spectrum: Float32Array): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      weightedSum += i * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateSpectralRolloff(spectrum: Float32Array): number {
    const totalEnergy = spectrum.reduce((sum, mag) => sum + mag, 0);
    const threshold = totalEnergy * 0.85;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i];
      if (cumulativeEnergy >= threshold) {
        return i;
      }
    }
    
    return spectrum.length - 1;
  }

  private calculateSpectralFlux(spectrum: Float32Array, prevSpectrum?: Float32Array): number {
    if (!prevSpectrum) return 0;
    
    let flux = 0;
    for (let i = 0; i < Math.min(spectrum.length, prevSpectrum.length); i++) {
      const diff = spectrum[i] - prevSpectrum[i];
      flux += diff * diff;
    }
    
    return Math.sqrt(flux);
  }

  private calculateFrameEnergy(frame: Float32Array): number {
    return frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length;
  }

  private calculateAveragePauseDuration(
    voicedFrames: boolean[], 
    hopSize: number, 
    sampleRate: number
  ): number {
    const pauseSegments = [];
    let currentPauseLength = 0;
    
    for (const isVoiced of voicedFrames) {
      if (!isVoiced) {
        currentPauseLength++;
      } else {
        if (currentPauseLength > 0) {
          pauseSegments.push(currentPauseLength);
          currentPauseLength = 0;
        }
      }
    }
    
    if (pauseSegments.length === 0) return 0;
    
    const avgPauseFrames = pauseSegments.reduce((sum, len) => sum + len, 0) / pauseSegments.length;
    return (avgPauseFrames * hopSize / sampleRate) * 1000; // Convert to milliseconds
  }

  private calculateHighFrequencyEnergy(audioBuffer: Float32Array): number {
    // Simplified high-frequency energy estimation
    const windowSize = 1024;
    let highFreqEnergy = 0;
    let windowCount = 0;
    
    for (let i = 0; i < audioBuffer.length - windowSize; i += windowSize) {
      const window = audioBuffer.slice(i, i + windowSize);
      const spectrum = this.simpleFFT(window);
      
      // Sum energy in high frequency bins (rough approximation)
      for (let j = spectrum.length * 0.6; j < spectrum.length; j++) {
        highFreqEnergy += spectrum[j];
      }
      windowCount++;
    }
    
    return windowCount > 0 ? highFreqEnergy / windowCount : 0;
  }

  /**
   * Clean up old voice history to prevent memory leaks
   */
  public cleanupHistory(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [customerHash, fingerprints] of this.voiceHistory) {
      const filtered = fingerprints.filter(fp => fp.timestamp >= cutoff);
      
      if (filtered.length === 0) {
        this.voiceHistory.delete(customerHash);
      } else {
        this.voiceHistory.set(customerHash, filtered);
      }
    }
  }

  /**
   * Get voice analysis statistics
   */
  public getStats(): {
    totalCustomers: number;
    totalFingerprints: number;
    avgFingerprintsPerCustomer: number;
  } {
    const totalCustomers = this.voiceHistory.size;
    const totalFingerprints = Array.from(this.voiceHistory.values())
      .reduce((sum, fps) => sum + fps.length, 0);
    
    return {
      totalCustomers,
      totalFingerprints,
      avgFingerprintsPerCustomer: totalCustomers > 0 ? totalFingerprints / totalCustomers : 0
    };
  }
}