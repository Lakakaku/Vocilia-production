'use client';

import { useState, useEffect } from 'react';
import { Copy, Download, Share2, QrCode } from 'lucide-react';
import { useBusinessContext } from '@/contexts/BusinessContext';

interface StoreCode {
  id: string;
  code: string;
  name: string;
  active: boolean;
  created_at: string;
}

export function StoreCodeDisplay() {
  const { businessId } = useBusinessContext();
  const [storeCode, setStoreCode] = useState<StoreCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (businessId) {
      fetchStoreCode();
    }
  }, [businessId]);

  const fetchStoreCode = async () => {
    try {
      if (!businessId) {
        console.error('No business ID found');
        return;
      }

      const response = await fetch(`/api/business/${businessId}/store-codes`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.storeCodes.length > 0) {
          setStoreCode(data.data.storeCodes[0]); // Get the main store code
        }
      }
    } catch (error) {
      console.error('Failed to fetch store code:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!storeCode) return;
    
    try {
      await navigator.clipboard.writeText(storeCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy store code:', error);
    }
  };

  const handleCopyUrl = async () => {
    if (!storeCode) return;
    
    const feedbackUrl = `https://vocilia.com?code=${storeCode.code}`;
    try {
      await navigator.clipboard.writeText(feedbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleGenerateQR = async () => {
    if (!storeCode || !businessId) return;

    try {

      const response = await fetch(`/api/business/${businessId}/store-codes/${storeCode.code}/qr`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Create a modal or new window to show the QR code
          showQRCodeModal(data.data);
        } else {
          console.error('QR generation failed:', data.error);
        }
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  const showQRCodeModal = (qrData: any) => {
    // Create a new window/tab with the QR code for easy printing
    const qrWindow = window.open('', '_blank', 'width=600,height=700');
    if (qrWindow) {
      qrWindow.document.write(`
        <html>
          <head>
            <title>QR-kod för butikskod ${qrData.storeCode}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px;
                margin: 0;
              }
              .qr-container { 
                border: 2px solid #000; 
                display: inline-block; 
                padding: 20px;
                margin: 20px 0;
                background: white;
              }
              .store-code { 
                font-size: 24px; 
                font-weight: bold; 
                margin: 10px 0;
                font-family: monospace;
                letter-spacing: 4px;
              }
              .instructions {
                max-width: 400px;
                margin: 20px auto;
                font-size: 14px;
                line-height: 1.6;
              }
              @media print {
                body { padding: 10px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <h1>Vocilia Feedback</h1>
            <div class="qr-container">
              <img src="${qrData.qrUrl}" alt="QR kod för butikskod ${qrData.storeCode}" />
              <div class="store-code">KOD: ${qrData.storeCode}</div>
            </div>
            <div class="instructions">
              <p><strong>För kunder:</strong></p>
              <p>1. Gå till <strong>vocilia.com</strong></p>
              <p>2. Ange kod: <strong>${qrData.storeCode}</strong></p>
              <p>3. Lämna feedback och få belöning!</p>
            </div>
            <div class="no-print">
              <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; margin: 10px;">
                🖨️ Skriv ut
              </button>
              <br>
              <a href="${qrData.downloadUrl}" download="qr-kod-${qrData.storeCode}.png" 
                 style="padding: 10px 20px; background: #007cba; color: white; text-decoration: none; margin: 10px; display: inline-block;">
                💾 Ladda ner PNG
              </a>
            </div>
          </body>
        </html>
      `);
      qrWindow.document.close();
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!storeCode) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Din butikskod</h3>
        <div className="text-center py-8">
          <p className="text-gray-500">Ingen butikskod hittad</p>
          <p className="text-sm text-gray-400 mt-2">Kontakta support för att få en kod</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Din butikskod</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          storeCode.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {storeCode.active ? 'Aktiv' : 'Inaktiv'}
        </span>
      </div>

      {/* Store Code Display */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-4">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Kunder anger denna kod på vocilia.com</p>
          <div className="text-4xl font-mono font-bold text-gray-900 tracking-widest mb-4">
            {storeCode.code}
          </div>
          <p className="text-xs text-gray-500">
            Kod skapad: {new Date(storeCode.created_at).toLocaleDateString('sv-SE')}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleCopyCode}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Kopierat!' : 'Kopiera kod'}
        </button>

        <button
          onClick={handleCopyUrl}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Kopiera länk
        </button>

        <button
          onClick={handleGenerateQR}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors col-span-2"
        >
          <QrCode className="w-4 h-4" />
          Skapa QR-kod för utskrift
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h4 className="font-medium text-yellow-800 mb-2">Så här använder du koden:</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Skriv ut QR-koden eller skriv upp koden på en skylt</li>
          <li>• Placera skylten synligt i butiken</li>
          <li>• Kunder går till <strong>vocilia.com</strong> och anger koden</li>
          <li>• De lämnar feedback och får belöning</li>
        </ul>
      </div>
    </div>
  );
}