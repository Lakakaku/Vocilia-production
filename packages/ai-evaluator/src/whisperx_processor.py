#!/usr/bin/env python3
"""
WhisperX Speech-to-Text processor for AI Feedback Platform
Optimized for Swedish language transcription with high accuracy
"""

import os
import sys
import json
import tempfile
import logging
import time
from pathlib import Path
import argparse

try:
    import whisper
    import torch
    import librosa
    import numpy as np
    from faster_whisper import WhisperModel
except ImportError as e:
    print(f"Error: Missing required packages. Install with:")
    print("pip install openai-whisper faster-whisper librosa torch")
    sys.exit(1)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WhisperXProcessor:
    """High-performance multi-language speech-to-text processor using WhisperX with language detection"""
    
    def __init__(self, model_size="base", language="sv", device="auto"):
        """
        Initialize WhisperX processor with multi-language support
        
        Args:
            model_size: Whisper model size (tiny, base, small, medium, large)
            language: Default language code (sv for Swedish)
            device: Processing device (auto, cpu, cuda)
        """
        self.model_size = model_size
        self.default_language = language
        
        # Supported languages (Nordic + English + common European)
        self.supported_languages = {
            'sv': 'Swedish',
            'en': 'English', 
            'da': 'Danish',
            'no': 'Norwegian',
            'fi': 'Finnish',
            'de': 'German',
            'fr': 'French',
            'es': 'Spanish',
            'it': 'Italian',
            'nl': 'Dutch'
        }
        
        # Determine device
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
            
        logger.info(f"Initializing WhisperX with model={model_size}, language={language}, device={self.device}")
        
        # Initialize faster-whisper model for better performance
        self.model = WhisperModel(
            model_size, 
            device=self.device,
            compute_type="float16" if self.device == "cuda" else "int8"
        )
        
        # Audio preprocessing settings optimized for voice feedback
        self.target_sample_rate = 16000
        self.min_duration = 0.5  # 500ms minimum
        self.max_duration = 120  # 2 minutes maximum
        
        logger.info("WhisperX processor initialized successfully")
    
    def detect_language(self, audio_buffer, audio_format="wav", supported_languages=None):
        """
        Detect language from audio buffer
        
        Args:
            audio_buffer: Raw audio data as bytes
            audio_format: Audio format (wav, webm, mp3, etc.)
            supported_languages: List of language codes to consider
            
        Returns:
            dict: Language detection result with detected language, confidence, and alternatives
        """
        start_time = time.time()
        
        try:
            # Validate input
            if not audio_buffer or len(audio_buffer) < 1024:
                raise ValueError("Audio buffer is empty or too small")
            
            # Filter supported languages
            if supported_languages:
                detection_languages = [lang for lang in supported_languages if lang in self.supported_languages]
            else:
                detection_languages = list(self.supported_languages.keys())
            
            # Create temporary file for processing
            with tempfile.NamedTemporaryFile(suffix=f".{audio_format}", delete=False) as temp_file:
                temp_file.write(audio_buffer)
                temp_path = temp_file.name
            
            try:
                # Preprocess audio (shorter sample for language detection)
                audio_array = self._preprocess_audio(temp_path, max_duration=10.0)  # 10 seconds max for detection
                
                # Perform language detection using Whisper's built-in capabilities
                # We transcribe without specifying language to let model detect it
                segments, info = self.model.transcribe(
                    audio_array,
                    beam_size=1,  # Lower beam size for faster detection
                    best_of=1,
                    temperature=0.0,
                    condition_on_previous_text=False,
                    vad_filter=True,
                    vad_parameters=dict(
                        min_silence_duration_ms=500,
                        min_speech_duration_ms=250
                    )
                )
                
                # Extract detected language information
                detected_language = info.language if hasattr(info, 'language') else self.default_language
                language_probability = info.language_probability if hasattr(info, 'language_probability') else 0.5
                
                # Validate detected language is in our supported set
                if detected_language not in detection_languages:
                    logger.warning(f"Detected language {detected_language} not in supported languages, using default")
                    detected_language = self.default_language
                    language_probability = 0.5
                
                # Create alternative language scores (simplified)
                all_languages = []
                for lang in detection_languages:
                    if lang == detected_language:
                        all_languages.append({"language": lang, "confidence": language_probability})
                    else:
                        # Assign lower confidence to other languages
                        confidence = max(0.1, (1.0 - language_probability) / (len(detection_languages) - 1))
                        all_languages.append({"language": lang, "confidence": confidence})
                
                # Sort by confidence
                all_languages.sort(key=lambda x: x['confidence'], reverse=True)
                
                processing_duration = time.time() - start_time
                
                result = {
                    "detected_language": detected_language,
                    "language_confidence": language_probability,
                    "all_languages": all_languages,
                    "supported_languages": detection_languages,
                    "detection_duration": processing_duration,
                    "audio_duration": len(audio_array) / self.target_sample_rate
                }
                
                logger.info(f"Language detection completed in {processing_duration:.2f}s: {detected_language} ({language_probability:.2f})")
                return result
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    
        except Exception as e:
            logger.error(f"Language detection failed: {str(e)}")
            return {
                "detected_language": self.default_language,
                "language_confidence": 0.5,
                "all_languages": [{"language": self.default_language, "confidence": 0.5}],
                "supported_languages": detection_languages if 'detection_languages' in locals() else list(self.supported_languages.keys()),
                "detection_duration": time.time() - start_time,
                "error": str(e)
            }

    def transcribe_buffer(self, audio_buffer, audio_format="wav", target_language=None):
        """
        Transcribe audio buffer to text with optional target language
        
        Args:
            audio_buffer: Raw audio data as bytes
            audio_format: Audio format (wav, webm, mp3, etc.)
            target_language: Specific language to use (if None, uses default)
            
        Returns:
            dict: Transcription result with text, confidence, language, duration
        """
        start_time = time.time()
        language_to_use = target_language or self.default_language
        
        try:
            # Validate input
            if not audio_buffer or len(audio_buffer) < 1024:
                raise ValueError("Audio buffer is empty or too small")
            
            # Create temporary file for processing
            with tempfile.NamedTemporaryFile(suffix=f".{audio_format}", delete=False) as temp_file:
                temp_file.write(audio_buffer)
                temp_path = temp_file.name
            
            try:
                # Preprocess audio
                audio_array = self._preprocess_audio(temp_path)
                
                # Perform transcription with specified language
                segments, info = self.model.transcribe(
                    audio_array,
                    language=language_to_use,
                    beam_size=5,
                    best_of=5,
                    temperature=0.0,
                    condition_on_previous_text=False,
                    vad_filter=True,  # Voice Activity Detection
                    vad_parameters=dict(
                        min_silence_duration_ms=500,
                        min_speech_duration_ms=250
                    )
                )
                
                # Extract transcription text
                transcription_text = ""
                total_confidence = 0
                segment_count = 0
                
                for segment in segments:
                    transcription_text += segment.text
                    if hasattr(segment, 'avg_logprob'):
                        # Convert log probability to confidence score
                        confidence = min(1.0, max(0.0, np.exp(segment.avg_logprob)))
                        total_confidence += confidence
                        segment_count += 1
                
                # Calculate average confidence
                avg_confidence = total_confidence / segment_count if segment_count > 0 else 0.0
                
                # Clean up transcription
                transcription_text = self._clean_transcription(transcription_text)
                
                # Validate transcription quality
                quality_score = self._assess_transcription_quality(
                    transcription_text, 
                    avg_confidence,
                    len(audio_buffer)
                )
                
                processing_duration = time.time() - start_time
                
                result = {
                    "text": transcription_text,
                    "language": info.language if hasattr(info, 'language') else self.language,
                    "confidence": avg_confidence,
                    "quality_score": quality_score,
                    "duration": processing_duration,
                    "audio_duration": len(audio_array) / self.target_sample_rate,
                    "detected_language_probability": info.language_probability if hasattr(info, 'language_probability') else 1.0,
                    "model_used": self.model_size,
                    "segments_count": segment_count
                }
                
                logger.info(f"Transcription completed in {processing_duration:.2f}s: '{transcription_text[:50]}...'")
                return result
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    
        except Exception as e:
            logger.error(f"Transcription failed: {str(e)}")
            return {
                "text": "",
                "language": self.language,
                "confidence": 0.0,
                "quality_score": 0.0,
                "duration": time.time() - start_time,
                "error": str(e),
                "model_used": self.model_size
            }
    
    def _preprocess_audio(self, audio_path, max_duration=None):
        """
        Preprocess audio file for optimal transcription
        
        Args:
            audio_path: Path to audio file
            max_duration: Maximum duration to process (None for default)
            
        Returns:
            np.ndarray: Processed audio array
        """
        try:
            # Load audio with librosa for better quality
            audio_array, sample_rate = librosa.load(
                audio_path,
                sr=self.target_sample_rate,
                mono=True,
                dtype=np.float32
            )
            
            # Validate duration
            duration = len(audio_array) / sample_rate
            max_dur = max_duration or self.max_duration
            
            if duration < self.min_duration:
                logger.warning(f"Audio duration {duration:.2f}s is below minimum {self.min_duration}s")
            elif duration > max_dur:
                logger.warning(f"Audio duration {duration:.2f}s exceeds maximum {max_dur}s, truncating")
                max_samples = int(max_dur * sample_rate)
                audio_array = audio_array[:max_samples]
            
            # Apply noise reduction and normalization
            audio_array = self._normalize_audio(audio_array)
            
            return audio_array
            
        except Exception as e:
            logger.error(f"Audio preprocessing failed: {str(e)}")
            raise
    
    def _normalize_audio(self, audio_array):
        """
        Normalize audio for consistent processing
        
        Args:
            audio_array: Raw audio array
            
        Returns:
            np.ndarray: Normalized audio array
        """
        # Remove DC bias
        audio_array = audio_array - np.mean(audio_array)
        
        # Normalize to [-1, 1] range
        max_val = np.max(np.abs(audio_array))
        if max_val > 0:
            audio_array = audio_array / max_val
            
        # Apply gentle high-pass filter to remove low-frequency noise
        # This is beneficial for speech recognition
        from scipy import signal
        try:
            # 80 Hz high-pass filter for speech
            sos = signal.butter(3, 80, btype='high', fs=self.target_sample_rate, output='sos')
            audio_array = signal.sosfilt(sos, audio_array)
        except:
            # If scipy not available, skip filtering
            pass
            
        return audio_array.astype(np.float32)
    
    def _clean_transcription(self, text):
        """
        Clean and normalize transcription text
        
        Args:
            text: Raw transcription text
            
        Returns:
            str: Cleaned text
        """
        if not text:
            return ""
            
        # Remove extra whitespace
        text = " ".join(text.split())
        
        # Capitalize first letter
        text = text.strip()
        if text and not text[0].isupper():
            text = text[0].upper() + text[1:]
        
        # Ensure proper sentence ending
        if text and text[-1] not in '.!?':
            text += '.'
            
        return text
    
    def _assess_transcription_quality(self, text, confidence, audio_size):
        """
        Assess transcription quality based on multiple factors
        
        Args:
            text: Transcribed text
            confidence: Model confidence
            audio_size: Size of audio buffer
            
        Returns:
            float: Quality score 0-1
        """
        if not text:
            return 0.0
        
        quality_score = confidence
        
        # Adjust for text length appropriateness
        word_count = len(text.split())
        
        # Penalize very short transcriptions from large audio files
        expected_words = max(1, audio_size // 10000)  # Rough estimate
        if word_count < expected_words * 0.3:
            quality_score *= 0.7
        
        # Bonus for reasonable length
        if 5 <= word_count <= 100:
            quality_score *= 1.1
        
        # Check for Swedish characteristics
        swedish_indicators = ['är', 'och', 'att', 'jag', 'det', 'som', 'en', 'på', 'med', 'för']
        swedish_count = sum(1 for word in swedish_indicators if word in text.lower())
        if swedish_count > 0:
            quality_score *= (1.0 + swedish_count * 0.02)
        
        return min(1.0, quality_score)
    
    def get_status(self):
        """
        Get processor status information
        
        Returns:
            dict: Status information
        """
        return {
            "available": True,
            "model_size": self.model_size,
            "default_language": self.default_language,
            "supported_languages": list(self.supported_languages.keys()),
            "language_names": self.supported_languages,
            "device": self.device,
            "cuda_available": torch.cuda.is_available(),
            "target_sample_rate": self.target_sample_rate,
            "language_detection_enabled": True,
            "version": "2.0.0"  # Updated version with language detection
        }

def main():
    """Command line interface for testing"""
    parser = argparse.ArgumentParser(description="WhisperX Speech-to-Text Processor with Language Detection")
    parser.add_argument("--audio", required=True, help="Path to audio file")
    parser.add_argument("--model", default="base", help="Model size (tiny, base, small, medium, large)")
    parser.add_argument("--language", default="sv", help="Default language code")
    parser.add_argument("--device", default="auto", help="Processing device (auto, cpu, cuda)")
    parser.add_argument("--detect-language-only", action="store_true", help="Only detect language, don't transcribe")
    parser.add_argument("--supported-languages", help="Comma-separated list of supported languages")
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = WhisperXProcessor(
        model_size=args.model,
        language=args.language,
        device=args.device
    )
    
    # Read audio file
    with open(args.audio, 'rb') as f:
        audio_buffer = f.read()
    
    # Get file extension
    audio_format = Path(args.audio).suffix[1:]  # Remove dot
    
    # Parse supported languages if provided
    supported_languages = None
    if args.supported_languages:
        supported_languages = [lang.strip() for lang in args.supported_languages.split(',')]
    
    if args.detect_language_only:
        # Only detect language
        result = processor.detect_language(audio_buffer, audio_format, supported_languages)
    else:
        # Full transcription
        result = processor.transcribe_buffer(audio_buffer, audio_format)
    
    # Output result
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()