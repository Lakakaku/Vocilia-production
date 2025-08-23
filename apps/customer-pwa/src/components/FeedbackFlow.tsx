import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceRecorder } from './VoiceRecorder';
import { FeedbackResult } from './FeedbackResult';
import { TransactionVerification } from './TransactionVerification';
import { Store, Clock, DollarSign } from 'lucide-react';

interface FeedbackFlowProps {
  qrToken?: string;
  sessionData?: any;
  onComplete: () => void;
}

type FlowStep = 'loading' | 'verification' | 'intro' | 'recording' | 'processing' | 'result' | 'error';

export function FeedbackFlow({ qrToken, sessionData, onComplete }: FeedbackFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('loading');
  const [session, setSession] = useState<any>(sessionData);
  const [error, setError] = useState<string | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<any>(null);

  useEffect(() => {
    if (sessionData) {
      // Check if transaction is already verified
      if (sessionData.status === 'transaction_verified') {
        setCurrentStep('intro');
      } else {
        setCurrentStep('verification');
      }
    } else if (qrToken) {
      validateQRToken();
    } else {
      setError('Ingen giltig QR-kod hittades');
      setCurrentStep('error');
    }
  }, [qrToken, sessionData]);

  const validateQRToken = async () => {
    try {
      const deviceFingerprint = getDeviceFingerprint();

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

      setSession(data.data);
      setCurrentStep('verification');
    } catch (err) {
      console.error('QR validation error:', err);
      setError(err instanceof Error ? err.message : 'Okänt fel');
      setCurrentStep('error');
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

  const handleTransactionVerified = (transactionData: any) => {
    // Update session data with transaction verification
    setSession(prev => ({
      ...prev,
      transactionId: transactionData.transactionId,
      transactionAmount: transactionData.amount,
      transactionVerified: true
    }));
    setCurrentStep('intro');
  };

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setCurrentStep('processing');

    try {
      // Submit audio feedback
      const formData = new FormData();
      formData.append('audio', audioBlob, 'feedback.webm');
      formData.append('duration', duration.toString());

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback/submit/${session.sessionId}`, {
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
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback/status/${session.sessionId}`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <AnimatePresence mode="wait">
        {currentStep === 'loading' && <LoadingScreen key="loading" />}
        
        {currentStep === 'verification' && (
          <TransactionVerification
            key="verification"
            sessionId={session?.sessionId}
            businessName={session?.businessName}
            onVerified={handleTransactionVerified}
            onBack={onComplete}
          />
        )}
        
        {currentStep === 'intro' && (
          <IntroScreen
            key="intro"
            session={session}
            onStartRecording={() => setCurrentStep('recording')}
            onBack={() => setCurrentStep('verification')}
          />
        )}

        {currentStep === 'recording' && (
          <VoiceRecorder
            key="recording"
            sessionId={session.sessionId}
            onComplete={handleRecordingComplete}
            onBack={() => setCurrentStep('intro')}
          />
        )}

        {currentStep === 'processing' && <ProcessingScreen key="processing" />}

        {currentStep === 'result' && (
          <FeedbackResult
            key="result"
            result={feedbackResult}
            businessName={session.businessName}
            onComplete={onComplete}
          />
        )}

        {currentStep === 'error' && (
          <ErrorScreen
            key="error"
            error={error}
            onRetry={() => {
              setError(null);
              setCurrentStep('loading');
              if (qrToken) validateQRToken();
            }}
            onBack={onComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center"
    >
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Laddar...</p>
      </div>
    </motion.div>
  );
}

function IntroScreen({ session, onStartRecording, onBack }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex flex-col"
    >
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-4 py-6">
          <button
            onClick={onBack}
            className="text-blue-600 text-sm font-medium mb-4"
          >
            ← Tillbaka
          </button>
          <h1 className="text-xl font-bold text-gray-900">Redo för feedback!</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6">
        {/* Business info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{session.businessName}</h2>
              <p className="text-sm text-gray-500">Redo för din feedback</p>
            </div>
          </div>

          {session.maxRewardAmount && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Upp till {session.maxRewardAmount}% cashback möjligt
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4 mb-8"
        >
          <h3 className="font-semibold text-gray-900 mb-3">Så här fungerar det:</h3>
          
          <div className="space-y-3">
            <div className="flex space-x-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900">30-60 sekunder röstfeedback</p>
                <p className="text-sm text-gray-600">Dela dina tankar om ditt besök</p>
              </div>
            </div>

            <div className="flex space-x-3">
              <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900">AI bedömer din feedback</p>
                <p className="text-sm text-gray-600">Kvalitet och äkthet analyseras</p>
              </div>
            </div>

            <div className="flex space-x-3">
              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900">Få din belöning</p>
                <p className="text-sm text-gray-600">Cashback baserat på feedbackkvalitet</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tips for good feedback */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8"
        >
          <h4 className="font-medium text-blue-900 mb-2">💡 Tips för bästa belöning:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Var specifik om vad du upplevde</li>
            <li>• Nämn konkreta detaljer om service/produkter</li>
            <li>• Ge konstruktiv feedback som hjälper butiken</li>
          </ul>
        </motion.div>

        {/* Time estimate */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center space-x-2 text-gray-500 mb-8"
        >
          <Clock className="w-4 h-4" />
          <span className="text-sm">Uppskattat tid: 2-3 minuter</span>
        </motion.div>
      </div>

      {/* Start button */}
      <div className="px-4 pb-8">
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStartRecording}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-4 rounded-xl shadow-lg"
        >
          Starta inspelning
        </motion.button>
      </div>
    </motion.div>
  );
}

function ProcessingScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center p-6"
    >
      <div className="text-center max-w-md">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full mx-auto mb-6"
        />
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">AI analyserar din feedback</h2>
        <p className="text-gray-600 mb-6">
          Detta tar vanligtvis 15-30 sekunder...
        </p>
        
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            🤖 AI bedömer äkthet, specificitet och djup i din feedback
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ErrorScreen({ error, onRetry, onBack }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center p-6"
    >
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">⚠️</span>
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">Något gick fel</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        
        <div className="space-y-3">
          <button
            onClick={onRetry}
            className="w-full bg-blue-500 text-white font-semibold py-3 rounded-xl"
          >
            Försök igen
          </button>
          
          <button
            onClick={onBack}
            className="w-full text-gray-600 font-medium py-3"
          >
            Tillbaka till start
          </button>
        </div>
      </div>
    </motion.div>
  );
}