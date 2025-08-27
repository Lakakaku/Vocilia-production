import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, AlertCircle, Loader2 } from 'lucide-react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';

interface QRScannerProps {
  onQRScanned: (sessionData: any) => void;
  onBack: () => void;
}

export function QRScanner({ onQRScanned, onBack }: QRScannerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>();
  const [scanAttempts, setScanAttempts] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    checkCameraPermission();
    return () => {
      // Clean up resources on unmount
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (scannerControlsRef.current) {
      scannerControlsRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const checkCameraPermission = async () => {
    try {
      // Get available video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      if (cameras.length === 0) {
        setError('Ingen kamera hittades på denna enhet');
        return;
      }

      setVideoDevices(cameras);
      
      // Prefer back camera for QR scanning
      const backCamera = cameras.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('environment')
      );
      
      setCurrentDeviceId(backCamera?.deviceId || cameras[0].deviceId);
      setHasCamera(true);
      
      // Check torch support
      await checkTorchSupport();
      
      startScanning();
    } catch (err) {
      console.error('Camera permission error:', err);
      setError('Kan inte komma åt kameran. Kontrollera behörigheter.');
    }
  };

  const checkTorchSupport = async () => {
    try {
      const constraints = navigator.mediaDevices.getSupportedConstraints();
      if (constraints.torch) {
        setHasTorch(true);
        console.log('✅ Torch support detected');
      } else {
        console.log('⚠️ Torch not supported on this device');
      }
    } catch (err) {
      console.log('Could not check torch support:', err);
    }
  };

  const getOptimizedConstraints = (deviceId?: string) => {
    // Enhanced constraints for low-light QR scanning
    const baseConstraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : { facingMode: 'environment' },
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30, min: 15 },
        // Low-light optimizations
        exposureMode: 'manual' as const,
        whiteBalanceMode: 'manual' as const,
        focusMode: 'continuous' as const,
        // Enhanced settings for better QR detection
        brightness: { ideal: 0.8 },
        contrast: { ideal: 1.2 },
        saturation: { ideal: 0.8 },
        sharpness: { ideal: 1.0 }
      } as MediaTrackConstraints
    };

    // Add torch if available and enabled
    if (hasTorch && torchEnabled) {
      (baseConstraints.video as any).torch = true;
    }

    return baseConstraints;
  };

  const startScanning = async (deviceId?: string) => {
    if (!videoRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Stop previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Get optimized media stream
      const constraints = getOptimizedConstraints(deviceId || currentDeviceId);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Apply advanced video track settings for low-light
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await applyAdvancedVideoSettings(videoTrack);
      }

      // Set video source
      videoRef.current.srcObject = stream;
      
      const codeReader = new BrowserQRCodeReader();
      
      // Enhanced scanning with multiple attempts and optimizations
      const controls = await codeReader.decodeFromVideoDevice(
        deviceId || currentDeviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const qrText = result.getText();
            console.log('✅ QR Code detected:', qrText);
            handleQRResult(qrText);
            controls.stop();
          }
          
          // Handle scanning errors more intelligently
          if (error && !(error.name === 'NotFoundException')) {
            console.log('Scan attempt failed:', error.name);
            setScanAttempts(prev => prev + 1);
            
            // After multiple failures, suggest torch or camera switch
            if (scanAttempts > 10 && scanAttempts % 15 === 0) {
              suggestLowLightOptimizations();
            }
          }
        }
      );
      
      scannerControlsRef.current = controls;
      setIsScanning(true);
      console.log('🎥 QR Scanner started with optimized settings');
    } catch (err) {
      console.error('Scanner initialization error:', err);
      setError('Kunde inte starta skannern. Försök igen.');
      
      // Fallback to basic constraints if optimized ones fail
      if (scanAttempts < 3) {
        setTimeout(() => {
          setScanAttempts(prev => prev + 1);
          startScanningBasic(deviceId);
        }, 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startScanningBasic = async (deviceId?: string) => {
    try {
      console.log('🔄 Falling back to basic camera constraints');
      const basicConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : { facingMode: 'environment' }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      streamRef.current = stream;
      videoRef.current!.srcObject = stream;

      const codeReader = new BrowserQRCodeReader();
      const controls = await codeReader.decodeFromVideoDevice(
        deviceId || currentDeviceId,
        videoRef.current!,
        (result, error) => {
          if (result) {
            handleQRResult(result.getText());
            controls.stop();
          }
        }
      );

      scannerControlsRef.current = controls;
      setIsScanning(true);
    } catch (err) {
      console.error('Basic scanner fallback failed:', err);
      setError('Kunde inte starta skannern. Kontrollera kamerabehörigheter.');
    }
  };

  const applyAdvancedVideoSettings = async (track: MediaStreamTrack) => {
    try {
      const capabilities = track.getCapabilities();
      const settings: MediaTrackConstraints = {};

      // Apply low-light optimizations if supported
      if (capabilities.exposureCompensation) {
        settings.exposureCompensation = 1.0; // Increase exposure for dark environments
      }
      
      if (capabilities.iso) {
        settings.iso = Math.min(capabilities.iso.max || 1600, 1600); // Higher ISO for low light
      }
      
      if (capabilities.brightness) {
        settings.brightness = Math.min(capabilities.brightness.max || 1, 0.8);
      }
      
      if (capabilities.contrast) {
        settings.contrast = Math.min(capabilities.contrast.max || 2, 1.3);
      }

      if (Object.keys(settings).length > 0) {
        await track.applyConstraints(settings);
        console.log('✅ Applied advanced video settings for low-light scanning');
      }
    } catch (err) {
      console.log('Could not apply advanced video settings:', err);
    }
  };

  const suggestLowLightOptimizations = () => {
    if (hasTorch && !torchEnabled) {
      setError('Dåligt ljus detekterat. Prova att aktivera ficklampa.');
    } else if (videoDevices.length > 1) {
      setError('Svårt att scanna. Prova att byta kamera.');
    } else {
      setError('Dåligt ljus. Flytta till en ljusare plats eller använd ficklampa.');
    }

    setTimeout(() => setError(null), 5000);
  };

  const toggleTorch = async () => {
    if (!hasTorch || !streamRef.current) return;

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      await videoTrack.applyConstraints({
        advanced: [{ torch: !torchEnabled }]
      });
      setTorchEnabled(!torchEnabled);
      console.log(`🔦 Torch ${!torchEnabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Could not toggle torch:', err);
      setError('Kunde inte aktivera ficklampa');
      setTimeout(() => setError(null), 3000);
    }
  };

  const switchCamera = async () => {
    if (videoDevices.length < 2) return;

    const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];

    setCurrentDeviceId(nextDevice.deviceId);
    setScanAttempts(0); // Reset scan attempts when switching cameras
    
    // Restart scanning with new camera
    if (scannerControlsRef.current) {
      scannerControlsRef.current.stop();
    }
    
    await startScanning(nextDevice.deviceId);
  };

  const handleQRResult = async (qrText: string) => {
    setIsScanning(false);
    setIsLoading(true);

    try {
      // Extract QR token from URL or direct token
      let qrToken = qrText;
      
      // If it's a URL, extract the 'q' parameter
      if (qrText.startsWith('http')) {
        const url = new URL(qrText);
        qrToken = url.searchParams.get('q') || '';
      }

      if (!qrToken) {
        throw new Error('Ogiltig QR-kod');
      }

      // Get device fingerprint
      const deviceFingerprint = getDeviceFingerprint();

      // Call API to validate QR and create session
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/qr/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrToken,
          deviceFingerprint,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Kunde inte validera QR-kod');
      }

      // Success! Pass session data to parent
      onQRScanned(data.data);
    } catch (err) {
      console.error('QR validation error:', err);
      setError(err instanceof Error ? err.message : 'Okänt fel vid skanning');
      
      // Restart scanning after error
      setTimeout(() => {
        setError(null);
        startScanning();
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceFingerprint = () => {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      touchSupport: 'ontouchstart' in window,
    };
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Header with enhanced controls */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center justify-between p-4 pt-12">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </motion.button>
          
          <h1 className="text-white font-semibold">Scanna QR-kod</h1>
          
          {/* Camera controls */}
          <div className="flex items-center space-x-2">
            {/* Torch control */}
            {hasTorch && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggleTorch}
                className={`w-10 h-10 backdrop-blur-sm rounded-full flex items-center justify-center text-white ${
                  torchEnabled ? 'bg-yellow-500/30' : 'bg-white/20'
                }`}
                data-testid="torch-toggle"
              >
                {torchEnabled ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </motion.button>
            )}

            {/* Camera switch */}
            {videoDevices.length > 1 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={switchCamera}
                className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
                data-testid="camera-switch"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Camera View */}
      <div className="relative w-full h-full">
        {hasCamera && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
            data-testid="camera-preview"
            style={{
              // Additional CSS optimizations for low-light
              filter: torchEnabled ? 'none' : 'brightness(1.1) contrast(1.1)',
            }}
          />
        )}

        {/* Enhanced scanning overlay with low-light indicators */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="w-64 h-64 border-2 border-white/30 rounded-2xl relative">
              {/* Enhanced corner brackets */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
              
              {/* Enhanced scanning line animation */}
              <AnimatePresence>
                {isScanning && (
                  <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 256, opacity: [0, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent"
                    data-testid="scanning-line"
                  />
                )}
              </AnimatePresence>

              {/* Low-light scanning indicator */}
              {scanAttempts > 5 && (
                <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-yellow-400 text-sm text-center">
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Svagt ljus</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced bottom instruction area */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent">
        <div className="p-6 text-center text-white">
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center space-x-3 mb-4"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Laddar...</span>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-lg p-4 mb-4"
            >
              <div className="flex items-center justify-center space-x-2 text-red-200">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            </motion.div>
          )}

          {!error && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <p className="text-lg">Håll QR-koden inom ramen</p>
              <div className="text-sm text-white/70 space-y-1">
                <p>• Håll enheten stadigt</p>
                <p>• Se till att QR-koden är välbelyst</p>
                {hasTorch && <p>• Använd ficklampa vid dåligt ljus</p>}
                {videoDevices.length > 1 && <p>• Byt kamera om skanning misslyckas</p>}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}