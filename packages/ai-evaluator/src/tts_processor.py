#!/usr/bin/env python3
"""
Text-to-Speech processor for AI Feedback Platform
Supports multiple TTS engines with Swedish language optimization
"""

import os
import sys
import json
import tempfile
import logging
import time
import argparse
from pathlib import Path
import subprocess
from typing import Optional, Dict, Any

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TTSProcessor:
    """Multi-provider TTS processor optimized for Swedish conversation"""
    
    def __init__(self, provider="piper", voice="swedish_female", device="auto"):
        """
        Initialize TTS processor
        
        Args:
            provider: TTS provider (piper, espeak, system)
            voice: Voice identifier
            device: Processing device
        """
        self.provider = provider
        self.voice = voice
        self.device = device
        
        # Audio settings optimized for web delivery
        self.sample_rate = 22050  # Good quality for web
        self.channels = 1         # Mono
        self.bit_depth = 16       # 16-bit PCM
        
        logger.info(f"Initializing TTS with provider={provider}, voice={voice}")
        
        # Initialize the selected provider
        self._initialize_provider()
        
    def _initialize_provider(self):
        """Initialize the selected TTS provider"""
        if self.provider == "piper":
            self._initialize_piper()
        elif self.provider == "espeak":
            self._initialize_espeak()
        elif self.provider == "system":
            self._initialize_system()
        else:
            raise ValueError(f"Unsupported TTS provider: {self.provider}")
    
    def _initialize_piper(self):
        """Initialize Piper TTS"""
        try:
            # Check if piper-tts is available
            result = subprocess.run(['piper', '--help'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                self.piper_available = True
                logger.info("Piper TTS initialized successfully")
            else:
                raise RuntimeError("Piper TTS not working properly")
        except (subprocess.TimeoutExpired, FileNotFoundError, RuntimeError):
            logger.warning("Piper TTS not available, falling back to espeak")
            self.provider = "espeak"
            self._initialize_espeak()
    
    def _initialize_espeak(self):
        """Initialize espeak TTS"""
        try:
            # Check if espeak is available
            result = subprocess.run(['espeak', '--version'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                self.espeak_available = True
                logger.info("eSpeak TTS initialized successfully")
            else:
                raise RuntimeError("eSpeak TTS not working properly")
        except (subprocess.TimeoutExpired, FileNotFoundError, RuntimeError):
            logger.warning("eSpeak TTS not available, falling back to system")
            self.provider = "system"
            self._initialize_system()
    
    def _initialize_system(self):
        """Initialize system TTS (macOS 'say' command)"""
        try:
            # Check if system TTS is available (macOS)
            result = subprocess.run(['say', '--version'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                self.system_available = True
                logger.info("System TTS (macOS say) initialized successfully")
            else:
                raise RuntimeError("System TTS not available")
        except (subprocess.TimeoutExpired, FileNotFoundError, RuntimeError):
            logger.error("No TTS providers available!")
            raise RuntimeError("No TTS providers available")
    
    def synthesize(self, text: str, output_format: str = "wav") -> Dict[str, Any]:
        """
        Convert text to speech
        
        Args:
            text: Text to synthesize
            output_format: Output audio format (wav, mp3)
            
        Returns:
            dict: Synthesis result with audio_data, duration, etc.
        """
        start_time = time.time()
        
        try:
            # Validate input
            if not text or not text.strip():
                raise ValueError("Text is empty")
            
            # Clean and prepare text for Swedish TTS
            cleaned_text = self._prepare_text_for_swedish(text.strip())
            
            # Generate audio based on provider
            if self.provider == "piper":
                audio_data = self._synthesize_with_piper(cleaned_text, output_format)
            elif self.provider == "espeak":
                audio_data = self._synthesize_with_espeak(cleaned_text, output_format)
            elif self.provider == "system":
                audio_data = self._synthesize_with_system(cleaned_text, output_format)
            else:
                raise ValueError(f"Unknown provider: {self.provider}")
            
            processing_duration = time.time() - start_time
            
            # Estimate audio duration (rough calculation)
            # Swedish speech: approximately 4-5 words per second
            word_count = len(cleaned_text.split())
            estimated_duration = word_count / 4.5
            
            result = {
                "audio_data": audio_data,
                "text": cleaned_text,
                "duration": processing_duration,
                "estimated_audio_duration": estimated_duration,
                "sample_rate": self.sample_rate,
                "channels": self.channels,
                "format": output_format,
                "provider": self.provider,
                "voice": self.voice,
                "text_length": len(cleaned_text),
                "word_count": word_count
            }
            
            logger.info(f"TTS synthesis completed in {processing_duration:.2f}s for {word_count} words")
            return result
            
        except Exception as e:
            logger.error(f"TTS synthesis failed: {str(e)}")
            return {
                "audio_data": b"",
                "text": text,
                "duration": time.time() - start_time,
                "error": str(e),
                "provider": self.provider
            }
    
    def _prepare_text_for_swedish(self, text: str) -> str:
        """
        Prepare text for optimal Swedish TTS
        
        Args:
            text: Input text
            
        Returns:
            str: Prepared text
        """
        # Ensure proper punctuation for natural speech
        if not text.endswith(('.', '!', '?')):
            text += '.'
        
        # Replace some common abbreviations for better pronunciation
        replacements = {
            'kr': 'kronor',
            'st': 'stycken',
            'osv': 'och så vidare',
            't.ex': 'till exempel',
            'ca': 'cirka'
        }
        
        for abbr, full in replacements.items():
            text = text.replace(f' {abbr} ', f' {full} ')
            text = text.replace(f' {abbr}.', f' {full}.')
        
        return text
    
    def _synthesize_with_piper(self, text: str, output_format: str) -> bytes:
        """Synthesize speech using Piper TTS"""
        with tempfile.NamedTemporaryFile(suffix=f".{output_format}", delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Piper command for Swedish
            cmd = [
                'piper',
                '--model', 'sv_SE-nst-medium',  # Swedish model
                '--output_file', temp_path
            ]
            
            # Run piper with text input
            process = subprocess.run(
                cmd,
                input=text,
                text=True,
                capture_output=True,
                timeout=30
            )
            
            if process.returncode != 0:
                raise RuntimeError(f"Piper TTS failed: {process.stderr}")
            
            # Read the generated audio
            with open(temp_path, 'rb') as f:
                audio_data = f.read()
                
            return audio_data
            
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def _synthesize_with_espeak(self, text: str, output_format: str) -> bytes:
        """Synthesize speech using eSpeak"""
        with tempfile.NamedTemporaryFile(suffix=f".{output_format}", delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # eSpeak command for Swedish
            cmd = [
                'espeak',
                '-v', 'sv',           # Swedish voice
                '-s', '160',          # Speed (words per minute)
                '-p', '50',           # Pitch
                '-a', '100',          # Amplitude
                '-w', temp_path,      # Write to file
                text
            ]
            
            process = subprocess.run(cmd, capture_output=True, timeout=30)
            
            if process.returncode != 0:
                raise RuntimeError(f"eSpeak TTS failed: {process.stderr.decode()}")
            
            # Read the generated audio
            with open(temp_path, 'rb') as f:
                audio_data = f.read()
                
            return audio_data
            
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def _synthesize_with_system(self, text: str, output_format: str) -> bytes:
        """Synthesize speech using system TTS (macOS say)"""
        with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # macOS say command
            cmd = [
                'say',
                '-v', 'Alva',         # Swedish voice on macOS
                '-o', temp_path,      # Output file
                '--data-format=LEI16@22050',  # 16-bit little-endian, 22050 Hz
                text
            ]
            
            process = subprocess.run(cmd, capture_output=True, timeout=30)
            
            if process.returncode != 0:
                raise RuntimeError(f"System TTS failed: {process.stderr.decode()}")
            
            # Convert AIFF to WAV if needed
            if output_format == "wav":
                wav_path = temp_path.replace('.aiff', '.wav')
                
                # Use ffmpeg or sox if available, otherwise keep as is
                try:
                    subprocess.run([
                        'ffmpeg', '-i', temp_path, '-y', wav_path
                    ], capture_output=True, timeout=10)
                    
                    with open(wav_path, 'rb') as f:
                        audio_data = f.read()
                    
                    os.unlink(wav_path)
                except:
                    # If conversion fails, return original
                    with open(temp_path, 'rb') as f:
                        audio_data = f.read()
            else:
                with open(temp_path, 'rb') as f:
                    audio_data = f.read()
                
            return audio_data
            
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get TTS processor status
        
        Returns:
            dict: Status information
        """
        return {
            "available": True,
            "provider": self.provider,
            "voice": self.voice,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "supported_formats": ["wav", "mp3"],
            "version": "1.0.0"
        }

def main():
    """Command line interface for testing"""
    parser = argparse.ArgumentParser(description="TTS Speech Synthesis Processor")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--output", help="Output audio file path")
    parser.add_argument("--provider", default="piper", 
                       choices=["piper", "espeak", "system"],
                       help="TTS provider")
    parser.add_argument("--voice", default="swedish_female", help="Voice identifier")
    parser.add_argument("--format", default="wav", choices=["wav", "mp3"],
                       help="Output format")
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = TTSProcessor(
        provider=args.provider,
        voice=args.voice
    )
    
    # Synthesize
    result = processor.synthesize(args.text, args.format)
    
    if args.output:
        # Save to file
        with open(args.output, 'wb') as f:
            f.write(result['audio_data'])
        print(f"Audio saved to {args.output}")
    
    # Output result info
    result_info = {k: v for k, v in result.items() if k != 'audio_data'}
    result_info['audio_size'] = len(result['audio_data'])
    print(json.dumps(result_info, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()