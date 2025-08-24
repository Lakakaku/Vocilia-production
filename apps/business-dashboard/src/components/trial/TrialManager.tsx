'use client';

import { useState, useEffect } from 'react';
import { Clock, Zap, CheckCircle, AlertCircle, CreditCard, Gift } from 'lucide-react';

interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  feedbacksRemaining: number;
  totalFeedbacks: number;
  startDate: Date;
  expiryDate: Date;
  planName: string;
  limitations: {
    maxLocations: number;
    maxUsers: number;
    maxFeedbacksPerMonth: number;
    analyticsAccess: boolean;
    exportAccess: boolean;
  };
}

const mockTrialStatus: TrialStatus = {
  isActive: true,
  daysRemaining: 18,
  feedbacksRemaining: 147,
  totalFeedbacks: 200,
  startDate: new Date('2024-08-06'),
  expiryDate: new Date('2024-09-06'),
  planName: 'Gratis provperiod',
  limitations: {
    maxLocations: 2,
    maxUsers: 5,
    maxFeedbacksPerMonth: 200,
    analyticsAccess: true,
    exportAccess: false
  }
};

export function TrialManager() {
  const [trialStatus, setTrialStatus] = useState<TrialStatus>(mockTrialStatus);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const feedbacksUsed = trialStatus.totalFeedbacks - trialStatus.feedbacksRemaining;
  const feedbacksPercent = (feedbacksUsed / trialStatus.totalFeedbacks) * 100;
  const daysPercent = ((30 - trialStatus.daysRemaining) / 30) * 100;

  const isLowOnFeedbacks = trialStatus.feedbacksRemaining <= 30;
  const isLowOnTime = trialStatus.daysRemaining <= 7;
  const isCritical = trialStatus.feedbacksRemaining <= 10 || trialStatus.daysRemaining <= 3;

  const getStatusColor = () => {
    if (isCritical) return 'text-red-600';
    if (isLowOnFeedbacks || isLowOnTime) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusBg = () => {
    if (isCritical) return 'bg-red-50 border-red-200';
    if (isLowOnFeedbacks || isLowOnTime) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Gift className="w-8 h-8 text-primary-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Provperiod</h2>
            <p className="text-gray-600">Hantera din gratisprovperiod och uppgradering</p>
          </div>
        </div>
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          <span>Uppgradera nu</span>
        </button>
      </div>

      {/* Trial Status Overview */}
      <div className={`p-6 rounded-lg border-2 ${getStatusBg()}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{trialStatus.planName}</h3>
            <p className="text-sm text-gray-600">
              Startade {formatDate(trialStatus.startDate)} • Slutar {formatDate(trialStatus.expiryDate)}
            </p>
          </div>
          <div className={`flex items-center space-x-2 ${getStatusColor()}`}>
            {isCritical ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            <span className="font-medium">
              {isCritical ? 'Kritisk nivå' : isLowOnFeedbacks || isLowOnTime ? 'Låg nivå' : 'Aktiv'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Time Remaining */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Tid kvar</span>
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {trialStatus.daysRemaining} dagar
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  isCritical ? 'bg-red-500' : isLowOnTime ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.max(100 - daysPercent, 5)}%` }}
              ></div>
            </div>
          </div>

          {/* Feedbacks Remaining */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Feedback kvar</span>
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {trialStatus.feedbacksRemaining} av {trialStatus.totalFeedbacks}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  isCritical ? 'bg-red-500' : isLowOnFeedbacks ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.max((trialStatus.feedbacksRemaining / trialStatus.totalFeedbacks) * 100, 5)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {(isLowOnFeedbacks || isLowOnTime || isCritical) && (
        <div className={`p-4 rounded-lg border ${
          isCritical ? 'bg-red-50 border-red-200 text-red-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <h4 className="font-medium mb-1">
                {isCritical ? 'Din provperiod håller på att ta slut!' : 'Din provperiod närmar sig slutet'}
              </h4>
              <p className="text-sm">
                {isCritical ? (
                  'Uppgradera nu för att fortsätta använda alla funktioner utan avbrott.'
                ) : (
                  'Överväg att uppgradera snart för att fortsätta få full tillgång till plattformen.'
                )}
              </p>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className={`mt-2 text-sm font-medium underline hover:no-underline ${
                  isCritical ? 'text-red-700' : 'text-yellow-700'
                }`}
              >
                Uppgradera nu →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trial Limitations */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Provperiodsbegränsningar</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Max antal platser</span>
              <span className="text-sm text-gray-900 font-medium">{trialStatus.limitations.maxLocations}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Max antal användare</span>
              <span className="text-sm text-gray-900 font-medium">{trialStatus.limitations.maxUsers}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Feedback per månad</span>
              <span className="text-sm text-gray-900 font-medium">{trialStatus.limitations.maxFeedbacksPerMonth}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Avancerad analys</span>
              <span className={`text-sm font-medium ${
                trialStatus.limitations.analyticsAccess ? 'text-green-600' : 'text-red-600'
              }`}>
                {trialStatus.limitations.analyticsAccess ? 'Inkluderat' : 'Ej tillgängligt'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Export av data</span>
              <span className={`text-sm font-medium ${
                trialStatus.limitations.exportAccess ? 'text-green-600' : 'text-red-600'
              }`}>
                {trialStatus.limitations.exportAccess ? 'Inkluderat' : 'Ej tillgängligt'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Prioriterat stöd</span>
              <span className="text-sm font-medium text-red-600">Ej tillgängligt</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Benefits */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg p-6 border border-primary-200">
        <div className="flex items-start space-x-4">
          <Zap className="w-8 h-8 text-primary-600 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Uppgradera för full tillgång</h3>
            <ul className="text-sm text-gray-700 space-y-1 mb-4">
              <li>• Obegränsade platser och användare</li>
              <li>• Obegränsade feedback per månad</li>
              <li>• Full tillgång till export och rapporter</li>
              <li>• Avancerad analys och trender</li>
              <li>• Prioriterat stöd och onboarding</li>
              <li>• Anpassade integrationer</li>
            </ul>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Se abonnemangsplaner
            </button>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Välj ditt abonnemang</h3>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Starter Plan */}
              <div className="border rounded-lg p-6 hover:border-primary-300 transition-colors">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Starter</h4>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  2 999 SEK
                  <span className="text-sm font-normal text-gray-600">/månad</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">Perfekt för små företag</p>
                
                <ul className="text-sm text-gray-700 space-y-2 mb-6">
                  <li>• Upp till 5 platser</li>
                  <li>• Upp till 10 användare</li>
                  <li>• 1 000 feedback per månad</li>
                  <li>• Grundläggande analys</li>
                  <li>• E-postsupport</li>
                </ul>

                <button className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors">
                  Välj Starter
                </button>
              </div>

              {/* Professional Plan */}
              <div className="border-2 border-primary-600 rounded-lg p-6 bg-primary-50 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Rekommenderad
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Professional</h4>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  4 999 SEK
                  <span className="text-sm font-normal text-gray-600">/månad</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">För växande företag</p>
                
                <ul className="text-sm text-gray-700 space-y-2 mb-6">
                  <li>• Obegränsade platser</li>
                  <li>• Obegränsade användare</li>
                  <li>• Obegränsade feedback</li>
                  <li>• Avancerad analys & export</li>
                  <li>• Prioriterat stöd</li>
                  <li>• Anpassade integrationer</li>
                </ul>

                <button className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors">
                  Välj Professional
                </button>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Alla planer inkluderar 30 dagar pengarna-tillbaka-garanti
                </p>
                <p className="text-xs text-gray-500">
                  Behöver du något anpassat? <a href="#" className="text-primary-600 hover:underline">Kontakta oss</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}