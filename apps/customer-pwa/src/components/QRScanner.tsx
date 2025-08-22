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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    checkCameraPermission();
    return () => {
      // Clean up scanner on unmount
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop();
      }
    };
  }, []);

  const checkCameraPermission = async () => {
    try {
      // Check if camera is available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        setError('Ingen kamera hittades på denna enhet');
        return;
      }

      setHasCamera(true);
      startScanning();
    } catch (err) {
      console.error('Camera permission error:', err);
      setError('Kan inte komma åt kameran. Kontrollera behörigheter.');
    }
  };

  const startScanning = async () => {
    if (!videoRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const codeReader = new BrowserQRCodeReader();
      
      // Start scanning with the first video device
      const controls = await codeReader.decodeFromVideoDevice(
        undefined, // Use default device
        videoRef.current,
        (result, error) => {
          if (result) {
            const qrText = result.getText();
            console.log('QR Code scanned:', qrText);
            handleQRResult(qrText);
            controls.stop();
          }
          
          if (error && !(error.name === 'NotFoundException')) {
            console.error('Scan error:', error);
          }
        }
      );
      
      scannerControlsRef.current = controls;
      setIsScanning(true);
    } catch (err) {
      console.error('Scanner initialization error:', err);
      setError('Kunde inte starta skannern. Försök igen.');
    } finally {
      setIsLoading(false);
    }
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
      {/* Header */}
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
          
          <div className="w-10 h-10" /> {/* Spacer */}
        </div>
      </div>

      {/* Camera View */}
      <div className="relative w-full h-full">
        {hasCamera && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
        )}

        {/* Scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Scanning frame */}
          <div className="relative">
            <div className="w-64 h-64 border-2 border-white/30 rounded-2xl relative">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
              
              {/* Scanning line animation */}
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
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom instruction area */}
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
              className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-4 mb-4"
            >
              <div className="flex items-center justify-center space-x-2 text-red-200">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </motion.div>
          )}

          {!error && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Camera className="w-5 h-5" />
                <span className="font-medium">Rikta kameran mot QR-koden</span>
              </div>
              <p className="text-sm text-white/70">
                QR-koden skannas automatiskt när den hittas
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}