import { useState } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Clock, DollarSign, AlertCircle } from 'lucide-react';

interface TransactionVerificationProps {
  sessionId: string;
  businessName: string;
  onVerified: (transactionData: TransactionData) => void;
  onBack: () => void;
}

interface TransactionData {
  transactionId: string;
  amount: number;
  time: string;
}

interface TransactionFormData {
  transactionId: string;
  amount: string;
  hours: string;
  minutes: string;
}

export function TransactionVerification({ 
  sessionId, 
  businessName, 
  onVerified, 
  onBack 
}: TransactionVerificationProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    transactionId: '',
    amount: '',
    hours: '',
    minutes: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTime = new Date();
  
  const handleInputChange = (field: keyof TransactionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.transactionId.trim()) {
      return 'Transaktions-ID krävs';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      return 'Giltigt belopp krävs';
    }

    const amount = parseFloat(formData.amount);
    if (amount < 10 || amount > 100000) {
      return 'Beloppet måste vara mellan 10-100,000 SEK';
    }

    if (!formData.hours || !formData.minutes) {
      return 'Tid för köp krävs';
    }

    const hours = parseInt(formData.hours);
    const minutes = parseInt(formData.minutes);
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return 'Ogiltig tid';
    }

    // Check if transaction time is within reasonable range (within last 15 minutes)
    const transactionTime = new Date();
    transactionTime.setHours(hours, minutes, 0, 0);
    
    const timeDiff = currentTime.getTime() - transactionTime.getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    
    if (timeDiff > fifteenMinutes) {
      return 'Transaktionen är äldre än 15 minuter. Feedback måste ges inom 15 minuter efter köp.';
    }

    if (timeDiff < 0) {
      return 'Transaktionen kan inte vara i framtiden';
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
      const transactionTime = new Date();
      transactionTime.setHours(parseInt(formData.hours), parseInt(formData.minutes), 0, 0);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback/verify-transaction/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: formData.transactionId.trim(),
          amount: parseFloat(formData.amount),
          timestamp: transactionTime.toISOString(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Kunde inte verifiera transaktion');
      }

      // Transaction verified successfully
      onVerified({
        transactionId: formData.transactionId.trim(),
        amount: parseFloat(formData.amount),
        time: transactionTime.toISOString()
      });

    } catch (err) {
      console.error('Transaction verification error:', err);
      setError(err instanceof Error ? err.message : 'Kunde inte verifiera transaktion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50"
    >
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-4 py-6">
          <button
            onClick={onBack}
            className="text-blue-600 text-sm font-medium mb-4"
            disabled={isLoading}
          >
            ← Tillbaka
          </button>
          <h1 className="text-xl font-bold text-gray-900">Verifiera ditt köp</h1>
          <p className="text-sm text-gray-600 mt-1">{businessName}</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {/* Info box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6"
        >
          <div className="flex space-x-3">
            <Receipt className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">Varför behöver vi detta?</h3>
              <p className="text-sm text-blue-800">
                Vi verifierar ditt köp för att säkerställa autentisk feedback och förhindra missbruk.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Transaction ID */}
          <div>
            <label htmlFor="transactionId" className="block text-sm font-medium text-gray-700 mb-2">
              Transaktions-ID eller Kvitto-nummer
            </label>
            <input
              type="text"
              id="transactionId"
              value={formData.transactionId}
              onChange={(e) => handleInputChange('transactionId', e.target.value)}
              placeholder="T123456 eller kvittonummer"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Hittas längst ner på ditt kvitto
            </p>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Totalt belopp (SEK)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                id="amount"
                step="0.01"
                min="10"
                max="100000"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="250.00"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tid för köp (ungefär)
            </label>
            <div className="flex space-x-3">
              <div className="flex-1">
                <select
                  value={formData.hours}
                  onChange={(e) => handleInputChange('hours', e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  disabled={isLoading}
                >
                  <option value="">Timme</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i.toString().padStart(2, '0')}>
                      {i.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <span className="text-lg font-medium text-gray-500">:</span>
              </div>
              <div className="flex-1">
                <select
                  value={formData.minutes}
                  onChange={(e) => handleInputChange('minutes', e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  disabled={isLoading}
                >
                  <option value="">Minut</option>
                  {Array.from({ length: 60 }, (_, i) => (
                    <option key={i} value={i.toString().padStart(2, '0')}>
                      {i.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center mt-2">
              <Clock className="w-4 h-4 text-gray-400 mr-2" />
              <p className="text-xs text-gray-500">
                Nuvarande tid: {currentTime.toLocaleTimeString('sv-SE', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-lg p-4 flex space-x-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Verifiering misslyckades</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Submit button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-4 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Verifierar...</span>
              </div>
            ) : (
              'Verifiera och fortsätt'
            )}
          </motion.button>
        </motion.form>

        {/* Help text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center"
        >
          <p className="text-xs text-gray-500">
            🔒 Dina transaktionsuppgifter används endast för verifiering och raderas efter 90 dagar
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}