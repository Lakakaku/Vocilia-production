'use client';

import { useState, useRef } from 'react';
import { Download, Share, X, Copy } from 'lucide-react';

interface QRCodeDisplayProps {
  locationId: string;
  locationName: string;
  qrCodeUrl?: string;
  onClose: () => void;
}

export function QRCodeDisplay({ locationId, locationName, qrCodeUrl, onClose }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Generate the feedback URL for this location
  const feedbackUrl = `${window.location.origin}/feedback?location=${locationId}`;

  const handleDownloadQR = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `qr-code-${locationName.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Feedback för ${locationName}`,
          text: 'Lämna feedback och få belöning!',
          url: feedbackUrl,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">QR-kod för {locationName}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-6">
          {/* QR Code display */}
          <div className="flex justify-center">
            <div ref={qrRef} className="bg-white p-4 border rounded-lg">
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt={`QR kod för ${locationName}`}
                  className="w-48 h-48"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-300 rounded-lg mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Genererar QR-kod...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Feedback URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Feedback-länk:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={feedbackUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={handleCopyUrl}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                title="Kopiera länk"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {copied && (
              <p className="text-sm text-green-600">Länk kopierad!</p>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Så här använder du QR-koden:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Skriv ut QR-koden och placera den på synlig plats</li>
              <li>• Kunder scannar koden med sin telefon</li>
              <li>• De lämnar feedback och får belöning</li>
              <li>• Du får värdefull feedback i realtid</li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDownloadQR}
              disabled={!qrCodeUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md"
            >
              <Download className="w-4 h-4" />
              Ladda ner
            </button>
            
            {navigator.share && (
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md"
              >
                <Share className="w-4 h-4" />
                Dela
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}