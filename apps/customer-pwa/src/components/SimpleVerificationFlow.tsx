import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StoreCodeEntry } from './StoreCodeEntry';
import { SimpleVerification } from './SimpleVerification';
import { VoiceRecorder } from './VoiceRecorder';
import { FeedbackResult } from './FeedbackResult';

interface SimpleVerificationFlowProps {
  onComplete: () => void;
  onBack: () => void;
}

interface StoreInfo {
  businessName: string;
  locationName?: string;
  verificationSettings: any;
}

interface SimpleVerificationData {
  purchaseTime: string;
  purchaseAmount: number;
  customerPhone: string;
}

type FlowStep = 'store-code' | 'verification' | 'intro' | 'recording' | 'processing' | 'result' | 'error';

export function SimpleVerificationFlow({ onComplete, onBack }: SimpleVerificationFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('store-code');
  const [storeCode, setStoreCode] = useState<string>('');
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [verificationData, setVerificationData] = useState<SimpleVerificationData | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStoreCodeEntered = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // First validate the store code
      const response = await fetch('/api/simple-verification/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeCode: code,
          purchaseTime: new Date().toISOString(),
          purchaseAmount: 100 // placeholder amount for initial validation
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ogiltig butikskod');
      }

      if (!result.data.valid) {
        throw new Error('Butikskoden är inte giltig eller aktiv');
      }

      // Create a preliminary session
      const sessionResponse = await fetch('/api/qr/create-simple-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeCode: code,
          deviceFingerprint: getDeviceFingerprint()
        }),
      });

      const sessionResult = await sessionResponse.json();

      if (!sessionResponse.ok) {
        throw new Error(sessionResult.error || 'Kunde inte skapa session');
      }

      setStoreCode(code);
      setStoreInfo({
        businessName: result.data.businessName,
        locationName: result.data.locationName,
        verificationSettings: result.data.verificationSettings
      });
      setSessionId(sessionResult.data.sessionId);
      setCurrentStep('verification');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationCompleted = (data: SimpleVerificationData) => {
    setVerificationData(data);
    setCurrentStep('intro');
  };

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setCurrentStep('processing');

    try {
      // Submit audio feedback
      const formData = new FormData();
      formData.append('audio', audioBlob, 'feedback.webm');
      formData.append('duration', duration.toString());

      const response = await fetch(`/api/feedback/submit/${sessionId}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Kunde inte skicka feedback');
      }

      // Poll for results
      pollForResults();
    } catch (err) {
      console.error('Submit feedback error:', err);
      setError(err instanceof Error ? err.message : 'Kunde inte skicka feedback');
      setCurrentStep('error');
    }
  };

  const pollForResults = async () => {
    const maxAttempts = 30; // 30 * 2s = 60s timeout
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        
        const response = await fetch(`/api/feedback/status/${sessionId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error('Kunde inte hämta resultat');
        }

        const status = data.data.status;

        if (status === 'completed') {
          setFeedbackResult(data.data);
          setCurrentStep('result');
        } else if (status === 'failed' || status === 'fraud_flagged') {
          throw new Error(data.data.errorMessage || 'Feedback bearbetningen misslyckades');
        } else if (attempts >= maxAttempts) {
          throw new Error('Timeout - ta för lång tid att bearbeta feedback');
        } else {
          // Continue polling
          setTimeout(poll, 2000);
        }
      } catch (err) {
        console.error('Polling error:', err);
        setError(err instanceof Error ? err.message : 'Kunde inte hämta resultat');
        setCurrentStep('error');
      }
    };

    poll();
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-md mx-auto p-6 pt-safe pb-safe">
        <AnimatePresence mode="wait">
          {currentStep === 'store-code' && (
            <motion.div
              key="store-code"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <StoreCodeEntry
                onCodeEntered={handleStoreCodeEntered}
                loading={isLoading}
                error={error}
              />
              <div className="mt-6 text-center">
                <button
                  onClick={onBack}
                  className="text-gray-600 hover:text-gray-800 text-sm"
                >
                  ← Tillbaka till start
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 'verification' && storeInfo && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <SimpleVerification
                sessionId={sessionId}
                storeCode={storeCode}
                businessName={storeInfo.businessName}
                locationName={storeInfo.locationName}
                onVerified={handleVerificationCompleted}
                onBack={() => setCurrentStep('store-code')}
              />
            </motion.div>
          )}

          {currentStep === 'intro' && storeInfo && verificationData && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <SimpleVerificationIntro
                businessName={storeInfo.businessName}
                locationName={storeInfo.locationName}
                purchaseAmount={verificationData.purchaseAmount}
                onStartRecording={() => setCurrentStep('recording')}
                onBack={() => setCurrentStep('verification')}
              />
            </motion.div>
          )}

          {currentStep === 'recording' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <VoiceRecorder
                sessionId={sessionId}
                onComplete={handleRecordingComplete}
                onBack={() => setCurrentStep('intro')}
              />
            </motion.div>
          )}

          {currentStep === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-16 text-center"
            >
              <ProcessingScreen />
            </motion.div>
          )}

          {currentStep === 'result' && feedbackResult && storeInfo && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <FeedbackResult
                result={feedbackResult}
                businessName={storeInfo.businessName}
                onComplete={onComplete}
                isSimpleVerification={true}
              />
            </motion.div>
          )}

          {currentStep === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-16"
            >
              <ErrorScreen error={error} onRetry={() => setCurrentStep('store-code')} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Simple verification intro component
function SimpleVerificationIntro({ 
  businessName, 
  locationName,
  purchaseAmount,
  onStartRecording, 
  onBack 
}: {
  businessName: string;
  locationName?: string;
  purchaseAmount: number;
  onStartRecording: () => void;
  onBack: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Dags för feedback!</h2>
        <p className="text-gray-600">
          {businessName} {locationName && `(${locationName})`}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Köp: {purchaseAmount} SEK
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-800">
          <strong>Viktigt:</strong> Din verifiering kommer granskas manuellt av butiken. 
          Du får din Swish-betalning efter att butiken har godkänt verifieringen.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Ge detaljerad feedback om din shoppingupplevelse. 
          Ju mer konkret och hjälpsam din feedback är, desto högre belöning kan du få!
        </p>
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Tillbaka
        </button>
        <button
          onClick={onStartRecording}
          className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
          <span>Starta feedback</span>
        </button>
      </div>
    </div>
  );
}

// Processing screen
function ProcessingScreen() {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
      <div>
        <h2 className="text-xl font-bold mb-2">Bearbetar din feedback</h2>
        <p className="text-gray-600">
          AI:n analyserar din feedback och beräknar din belöning...
        </p>
      </div>
    </div>
  );
}

// Error screen
function ErrorScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">Ett fel uppstod</h2>
        <p className="text-gray-600 text-sm">
          {error || 'Okänt fel'}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Försök igen
      </button>
    </div>
  );
}