'use client';

import { useState } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  Zap, 
  Calendar, 
  Settings, 
  Clock,
  Shield,
  CreditCard
} from 'lucide-react';
import type { VerificationMethod } from '@ai-feedback/shared-types';

interface VerificationOption {
  method: VerificationMethod;
  title: string;
  subtitle: string;
  description: string;
  pros: string[];
  cons: string[];
  setupTime: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
}

interface VerificationMethodSelectorProps {
  selectedMethod: VerificationMethod;
  onMethodChange: (method: VerificationMethod) => void;
  onComplete: () => void;
}

const VERIFICATION_OPTIONS: VerificationOption[] = [
  {
    method: 'pos_integration',
    title: 'POS Integration',
    subtitle: 'Automatisk verifiering via kassasystem',
    description: 'Koppla samman plattformen med ditt befintliga kassasystem (Square, Shopify, Zettle) för automatisk transaktionsverifiering i realtid.',
    pros: [
      'Automatisk verifiering - ingen manuell hantering',
      'Realtidsvalidering av transaktioner',
      'Omedelbar återkoppling till kunder',
      'Minskad risk för bedrägerier',
      'Skalbar för stora volymer'
    ],
    cons: [
      'Kräver teknisk installation',
      'Måste ha kompatibelt kassasystem',
      'Kan ta längre tid att sätta upp'
    ],
    setupTime: '1-2 timmar',
    icon: Zap,
    recommended: true
  },
  {
    method: 'simple_verification',
    title: 'Enkel Verifiering',
    subtitle: 'Manuell granskning en gång per månad',
    description: 'Kunder anger transaktionsuppgifter manuellt och du granskar och godkänner feedback månadsvis. Perfekt för mindre verksamheter.',
    pros: [
      'Snabb installation - klart på minuter',
      'Ingen teknisk kunskap krävs',
      'Fungerar med alla kassasystem',
      'Du har full kontroll över alla utbetalningar',
      'Lägre teknisk komplexitet'
    ],
    cons: [
      'Kräver månadsvis manuell granskning',
      'Längre väntetid för kundutbetalningar',
      'Mer administrativt arbete',
      'Begränsad skalbarhet för stora volymer'
    ],
    setupTime: '5-10 minuter',
    icon: Calendar
  }
];

export function VerificationMethodSelector({ 
  selectedMethod, 
  onMethodChange, 
  onComplete 
}: VerificationMethodSelectorProps) {
  const [hoveredMethod, setHoveredMethod] = useState<VerificationMethod | null>(null);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Settings className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">
          Välj Verifieringsmetod
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Hur vill du verifiera kundernas köp? Du kan alltid ändra detta senare i inställningarna.
        </p>
      </div>

      {/* Method Options */}
      <div className="grid md:grid-cols-2 gap-6">
        {VERIFICATION_OPTIONS.map((option) => (
          <div
            key={option.method}
            className={`
              relative rounded-xl border-2 p-6 cursor-pointer transition-all duration-200
              ${selectedMethod === option.method 
                ? 'border-blue-500 bg-blue-50 shadow-lg' 
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              }
              ${hoveredMethod === option.method ? 'scale-105' : ''}
            `}
            onClick={() => onMethodChange(option.method)}
            onMouseEnter={() => setHoveredMethod(option.method)}
            onMouseLeave={() => setHoveredMethod(null)}
          >
            {/* Recommended Badge */}
            {option.recommended && (
              <div className="absolute -top-3 left-6">
                <span className="bg-green-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                  Rekommenderat
                </span>
              </div>
            )}

            {/* Selection Indicator */}
            <div className="absolute top-4 right-4">
              {selectedMethod === option.method ? (
                <CheckCircle className="w-6 h-6 text-blue-500" />
              ) : (
                <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
              )}
            </div>

            {/* Content */}
            <div className="space-y-4 pr-8">
              {/* Header */}
              <div className="flex items-start space-x-3">
                <div className={`
                  flex items-center justify-center w-12 h-12 rounded-lg
                  ${selectedMethod === option.method ? 'bg-blue-100' : 'bg-gray-100'}
                `}>
                  <option.icon className={`w-6 h-6 ${
                    selectedMethod === option.method ? 'text-blue-600' : 'text-gray-600'
                  }`} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {option.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {option.subtitle}
                  </p>
                </div>
              </div>

              {/* Setup Time */}
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">
                  Uppsättningstid: <strong>{option.setupTime}</strong>
                </span>
              </div>

              {/* Description */}
              <p className="text-gray-700 text-sm leading-relaxed">
                {option.description}
              </p>

              {/* Pros */}
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2">
                  ✅ Fördelar:
                </h4>
                <ul className="space-y-1">
                  {option.pros.slice(0, 3).map((pro, index) => (
                    <li key={index} className="text-xs text-green-600 flex items-start">
                      <span className="mr-2">•</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cons */}
              <div>
                <h4 className="text-sm font-medium text-orange-700 mb-2">
                  ⚠️ Att tänka på:
                </h4>
                <ul className="space-y-1">
                  {option.cons.slice(0, 2).map((con, index) => (
                    <li key={index} className="text-xs text-orange-600 flex items-start">
                      <span className="mr-2">•</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-1">
              Du kan alltid byta metod senare
            </p>
            <p className="text-blue-700">
              Börja med den metod som känns bäst för dig just nu. Du kan enkelt 
              växla mellan metoderna i dina inställningar när som helst.
            </p>
          </div>
        </div>
      </div>

      {/* Selected Method Details */}
      {selectedMethod && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Du har valt: {VERIFICATION_OPTIONS.find(o => o.method === selectedMethod)?.title}
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Nästa steg:</h4>
              {selectedMethod === 'pos_integration' ? (
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Slutför företagsregistreringen</li>
                  <li>• Koppla ditt kassasystem (Square, Shopify eller Zettle)</li>
                  <li>• Testa första transaktionsverifieringen</li>
                </ul>
              ) : (
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Slutför företagsregistreringen</li>
                  <li>• Generera din 6-siffriga butikskod</li>
                  <li>• Sätt upp månadsvis granskningsrutin</li>
                </ul>
              )}
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Support:</h4>
              <p className="text-sm text-gray-600">
                Vi hjälper dig med uppsättningen. Kontakta support om du behöver hjälp 
                eller har frågor om vilken metod som passar din verksamhet bäst.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-center">
        <button
          onClick={onComplete}
          disabled={!selectedMethod}
          className={`
            px-8 py-3 rounded-lg font-medium transition-colors
            ${selectedMethod
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Fortsätt med {selectedMethod === 'pos_integration' ? 'POS Integration' : 'Enkel Verifiering'}
        </button>
      </div>
    </div>
  );
}