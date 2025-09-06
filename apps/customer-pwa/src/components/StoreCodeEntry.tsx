import React, { useState, useEffect } from 'react';
import { QRScanner } from './QRScanner';

interface StoreCodeEntryProps {
  onCodeEntered: (code: string) => void;
  loading?: boolean;
  error?: string;
}

export const StoreCodeEntry: React.FC<StoreCodeEntryProps> = ({
  onCodeEntered,
  loading = false,
  error
}) => {
  const [manualCode, setManualCode] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [inputError, setInputError] = useState<string>('');

  const handleManualCodeChange = (value: string) => {
    // Only allow digits and limit to 6 characters
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setManualCode(cleaned);
    
    // Clear error when user starts typing
    if (inputError) {
      setInputError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (manualCode.length !== 6) {
      setInputError('Butikskoden måste vara 6 siffror');
      return;
    }

    onCodeEntered(manualCode);
  };

  const handleQRScanSuccess = (data: string) => {
    // Extract store code from QR data
    // Could be a URL like /verify?code=123456 or just the code
    const codeMatch = data.match(/code=(\d{6})/);
    if (codeMatch) {
      onCodeEntered(codeMatch[1]);
    } else if (/^\d{6}$/.test(data)) {
      onCodeEntered(data);
    } else {
      setInputError('Ogiltig QR-kod. Kontakta butiken för hjälp.');
    }
    setShowQRScanner(false);
  };

  const handleQRScanError = (error: string) => {
    setInputError(`QR-skanning misslyckades: ${error}`);
    setShowQRScanner(false);
  };

  if (showQRScanner) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Scanna QR-kod</h2>
          <p className="text-gray-600 text-sm mb-4">
            Rikta kameran mot butikens QR-kod
          </p>
        </div>
        
        <QRScanner
          onScanSuccess={handleQRScanSuccess}
          onScanError={handleQRScanError}
          onCancel={() => setShowQRScanner(false)}
        />
        
        <button
          onClick={() => setShowQRScanner(false)}
          className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Avbryt
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Välkommen!</h2>
        <p className="text-gray-600">
          Scanna butikens QR-kod eller ange butikskoden för att börja
        </p>
      </div>

      {/* QR Code Scanner Option */}
      <button
        onClick={() => setShowQRScanner(true)}
        disabled={loading}
        className="w-full py-4 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 4h4m12 0h2M4 20h4m6-16v4m0 0H8m4 0V8" />
        </svg>
        <span>Scanna QR-kod</span>
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">eller</span>
        </div>
      </div>

      {/* Manual Code Entry */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="storeCode" className="block text-sm font-medium text-gray-700 mb-2">
            Ange butikskod (6 siffror)
          </label>
          <input
            id="storeCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={manualCode}
            onChange={(e) => handleManualCodeChange(e.target.value)}
            placeholder="123456"
            className="w-full py-3 px-4 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={6}
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Hittar du butikskoden på butikens skylt eller fråga personalen
          </p>
        </div>

        {(inputError || error) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{inputError || error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={manualCode.length !== 6 || loading}
          className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Verifierar...</span>
            </div>
          ) : (
            'Fortsätt'
          )}
        </button>
      </form>

      <div className="text-center text-xs text-gray-500">
        <p>
          Genom att fortsätta accepterar du våra{' '}
          <a href="/terms" className="text-blue-600 hover:underline">användarvillkor</a>
          {' '}och{' '}
          <a href="/privacy" className="text-blue-600 hover:underline">integritetspolicy</a>
        </p>
      </div>
    </div>
  );
};