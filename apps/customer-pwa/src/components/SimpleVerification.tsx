import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CreditCard, Phone, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface SimpleVerificationProps {
  sessionId: string;
  storeCode: string;
  businessName: string;
  locationName?: string;
  onVerified: (verificationData: SimpleVerificationData) => void;
  onBack: () => void;
}

interface SimpleVerificationData {
  purchaseTime: string;
  purchaseAmount: number;
  customerPhone: string;
}

interface FormData {
  date: string;
  hours: string;
  minutes: string;
  amount: string;
  phone: string;
}

export function SimpleVerification({ 
  sessionId, 
  storeCode,
  businessName, 
  locationName,
  onVerified, 
  onBack 
}: SimpleVerificationProps) {
  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().split('T')[0],
    hours: new Date().getHours().toString().padStart(2, '0'),
    minutes: new Date().getMinutes().toString().padStart(2, '0'),
    amount: '',
    phone: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'form' | 'success'>('info');

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handlePhoneChange = (value: string) => {
    // Format Swedish phone number as user types
    let cleaned = value.replace(/\D/g, '');
    
    // Add +46 prefix if starting with 0
    if (cleaned.startsWith('0')) {
      cleaned = '46' + cleaned.substring(1);
    }
    
    // Limit to reasonable phone number length
    if (cleaned.length > 11) {
      cleaned = cleaned.substring(0, 11);
    }
    
    // Format display
    let formatted = cleaned;
    if (cleaned.startsWith('46')) {
      formatted = '+46 ' + cleaned.substring(2);
    }
    
    setFormData(prev => ({ ...prev, phone: formatted }));
    setError(null);
  };

  const validateForm = (): string | null => {
    // Validate amount
    const amount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(amount) || amount <= 0) {
      return 'Ange ett giltigt köpbelopp';
    }
    if (amount < 1 || amount > 50000) {
      return 'Beloppet måste vara mellan 1-50,000 SEK';
    }

    // Validate time
    const hours = parseInt(formData.hours);
    const minutes = parseInt(formData.minutes);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return 'Ogiltig tid';
    }

    // Validate phone number
    const phoneClean = formData.phone.replace(/\D/g, '');
    if (!phoneClean || phoneClean.length < 10) {
      return 'Ange ett giltigt telefonnummer';
    }

    // Check if purchase time is reasonable (within last 24 hours or next 30 minutes)
    const purchaseDateTime = new Date(`${formData.date}T${formData.hours}:${formData.minutes}:00`);
    const now = new Date();
    const maxPastTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    const maxFutureTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
    
    if (purchaseDateTime < maxPastTime) {
      return 'Köptiden kan inte vara mer än 24 timmar sedan';
    }
    if (purchaseDateTime > maxFutureTime) {
      return 'Köptiden kan inte vara mer än 30 minuter i framtiden';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create verification
      const purchaseDateTime = new Date(`${formData.date}T${formData.hours}:${formData.minutes}:00`);
      const phoneClean = formData.phone.replace(/\D/g, '');
      const phoneFormatted = phoneClean.startsWith('46') ? '+' + phoneClean : '+46' + phoneClean.substring(1);

      const response = await fetch('/api/simple-verification/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          storeCode,
          purchaseTime: purchaseDateTime.toISOString(),
          purchaseAmount: parseFloat(formData.amount),
          customerPhone: phoneFormatted
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verifiering misslyckades');
      }

      // Show success message
      setStep('success');
      
      // Continue to feedback after short delay
      setTimeout(() => {
        onVerified({
          purchaseTime: purchaseDateTime.toISOString(),
          purchaseAmount: parseFloat(formData.amount),
          customerPhone: phoneFormatted
        });
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'info') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Enkel Verifiering</h2>
          <p className="text-gray-600">
            {businessName} {locationName && `(${locationName})`}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Hur enkel verifiering fungerar:</p>
              <ul className="space-y-1 text-xs">
                <li>• Du anger tid och belopp för ditt köp</li>
                <li>• Lämnar ditt telefonnummer för Swish-betalning</li>
                <li>• Butiken granskar din verifiering manuellt</li>
                <li>• Du får betalning via Swish efter godkännande</li>
                <li>• Din feedback blir tillgänglig för butiken efter granskning</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Viktigt att veta:</p>
              <p className="text-xs">
                Ange korrekt tid och belopp (±2 minuter, ±0.5 SEK tolerans). 
                Felaktig information kan leda till att din verifiering avvisas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Tillbaka
          </button>
          <button
            onClick={() => setStep('form')}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Fortsätt
          </button>
        </div>
      </motion.div>
    );
  }

  if (step === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Verifiering Skickad!</h2>
          <p className="text-gray-600">
            Din verifiering har skickats till butiken för granskning. 
            Du kan nu fortsätta med att lämna din feedback.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Verifiering av Köp</h2>
        <p className="text-gray-600">
          Ange uppgifter om ditt köp för verifiering
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date and Time */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <Clock className="w-4 h-4" />
            <span>När gjorde du köpet?</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Datum</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Timme</label>
              <input
                type="number"
                min="0"
                max="23"
                value={formData.hours}
                onChange={(e) => handleInputChange('hours', e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Minut</label>
              <input
                type="number"
                min="0"
                max="59"
                value={formData.minutes}
                onChange={(e) => handleInputChange('minutes', e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <CreditCard className="w-4 h-4" />
            <span>Köpbelopp (SEK)</span>
          </div>
          <input
            type="number"
            step="0.01"
            min="1"
            max="50000"
            value={formData.amount}
            onChange={(e) => handleInputChange('amount', e.target.value)}
            placeholder="499.50"
            className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right font-mono"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">
            Ange det exakta beloppet från ditt kvitto
          </p>
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <Phone className="w-4 h-4" />
            <span>Telefonnummer (för Swish-betalning)</span>
          </div>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="+46 70 123 45 67"
            className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">
            Används för att skicka din belöning via Swish
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Tillbaka
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Verifierar...</span>
              </div>
            ) : (
              'Verifiera & Fortsätt'
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}