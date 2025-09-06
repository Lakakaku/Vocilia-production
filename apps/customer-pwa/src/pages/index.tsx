import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { QrCode, Mic, Gift, Sparkles, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { QRScanner } from '../components/QRScanner';
import { FeedbackFlow } from '../components/FeedbackFlow';
import { SimpleVerificationFlow } from '../components/SimpleVerificationFlow';
import { NetworkStatus } from '../components/NetworkStatus';

export default function HomePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<'welcome' | 'scan' | 'simple' | 'feedback'>('welcome');
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    // Check if we have a QR token in the URL
    const { q: qrToken } = router.query;
    if (qrToken && typeof qrToken === 'string') {
      setCurrentStep('feedback');
      // We'll handle the QR validation in the FeedbackFlow component
    }
  }, [router.query]);

  const handleQRScanned = (sessionData: any) => {
    setSessionData(sessionData);
    setCurrentStep('feedback');
  };

  return (
    <>
      <Head>
        <title>AI Feedback - Earn Cashback for Your Voice</title>
        <meta name="description" content="Scan QR, share feedback, earn up to 12% cashback" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50" data-testid="app-container">
        {/* Network status indicator for testing */}
        <NetworkStatus />
        
        {currentStep === 'welcome' && (
          <WelcomeScreen 
            onStartScan={() => setCurrentStep('scan')} 
            onStartSimple={() => setCurrentStep('simple')}
          />
        )}

        {currentStep === 'scan' && (
          <QRScanner onQRScanned={handleQRScanned} onBack={() => setCurrentStep('welcome')} />
        )}

        {currentStep === 'simple' && (
          <SimpleVerificationFlow 
            onComplete={() => setCurrentStep('welcome')}
            onBack={() => setCurrentStep('welcome')}
          />
        )}

        {currentStep === 'feedback' && (
          <FeedbackFlow 
            qrToken={router.query.q as string} 
            sessionData={sessionData}
            onComplete={() => setCurrentStep('welcome')}
          />
        )}
      </div>
    </>
  );
}

function WelcomeScreen({ onStartScan, onStartSimple }: { 
  onStartScan: () => void; 
  onStartSimple: () => void; 
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" data-testid="welcome-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md mx-auto"
      >
        {/* Logo/Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
          className="mb-8"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-3xl font-bold text-gray-900 mb-4"
          data-testid="welcome-headline"
        >
          Få betalt för din åsikt
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-lg text-gray-600 mb-8 leading-relaxed"
        >
          Scanna QR-kod eller ange butikskod, dela din feedback med AI, och få upp till{' '}
          <span className="font-semibold text-green-600">12% cashback</span>
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="space-y-4 mb-8"
        >
          <div className="flex items-center space-x-3 text-left">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <QrCode className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-gray-700">Scanna QR-kod eller ange butikskod</span>
          </div>

          <div className="flex items-center space-x-3 text-left">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <Mic className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-gray-700">30-60 sekunder röstfeedback</span>
          </div>

          <div className="flex items-center space-x-3 text-left">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Gift className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-gray-700">Få cashback baserat på kvalitet</span>
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="space-y-3 w-full"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartScan}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-3"
            data-testid="start-scan-button"
          >
            <QrCode className="w-5 h-5" />
            <span>Scanna QR-kod (Snabbt)</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartSimple}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-3"
            data-testid="start-simple-button"
          >
            <CreditCard className="w-5 h-5" />
            <span>Ange butikskod (Enkel verifiering)</span>
          </motion.button>
        </motion.div>

        {/* Privacy note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-xs text-gray-500 mt-6"
        >
          🔒 Anonymt & GDPR-kompatibelt. Inga personuppgifter sparas.
        </motion.p>
      </motion.div>

      {/* Bottom decoration */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
      />
    </div>
  );
}