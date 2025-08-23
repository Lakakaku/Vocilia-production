import React from 'react';
import { cn } from '../utils/cn';
import { formatCurrency, formatRewardPercentage } from '../utils/formatCurrency';
import { RewardDisplayProps } from '../types';

export const RewardDisplay: React.FC<RewardDisplayProps> = ({
  amount,
  percentage,
  currency = 'SEK',
  status = 'pending',
  tier = 'basic',
  className
}) => {
  const statusConfig = {
    pending: { color: 'text-yellow-600 bg-yellow-100', icon: '⏳', label: 'Väntande' },
    processing: { color: 'text-blue-600 bg-blue-100', icon: '⚡', label: 'Behandlas' },
    completed: { color: 'text-green-600 bg-green-100', icon: '✅', label: 'Slutförd' },
    failed: { color: 'text-red-600 bg-red-100', icon: '❌', label: 'Misslyckades' }
  };

  const tierConfig = {
    basic: { color: 'border-gray-300 bg-gray-50', badge: 'Basic', icon: '🥉' },
    good: { color: 'border-blue-300 bg-blue-50', badge: 'Bra', icon: '🥈' },
    excellent: { color: 'border-green-300 bg-green-50', badge: 'Utmärkt', icon: '🥇' },
    premium: { color: 'border-purple-300 bg-purple-50', badge: 'Premium', icon: '💎' }
  };

  const currentStatus = statusConfig[status];
  const currentTier = tierConfig[tier];

  return (
    <div className={cn(
      'rounded-lg border-2 p-4 transition-all duration-200',
      currentTier.color,
      className
    )}>
      {/* Header with tier and status */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{currentTier.icon}</span>
          <span className="font-medium text-gray-700">{currentTier.badge}</span>
        </div>
        <div className={cn(
          'px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1',
          currentStatus.color
        )}>
          <span>{currentStatus.icon}</span>
          {currentStatus.label}
        </div>
      </div>

      {/* Reward Amount */}
      <div className="text-center py-4">
        <div className="text-3xl font-bold text-gray-900 mb-1">
          {formatCurrency(amount, currency)}
        </div>
        <div className="text-lg text-gray-600">
          {formatRewardPercentage(percentage)} cashback
        </div>
      </div>

      {/* Additional Info */}
      {status === 'completed' && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700 text-center font-medium">
            💰 Belöningen har skickats till ditt konto!
          </p>
        </div>
      )}

      {status === 'processing' && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700 text-center">
            Din belöning behandlas och kommer att skickas inom kort.
          </p>
        </div>
      )}

      {status === 'failed' && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700 text-center">
            Något gick fel. Kontakta support för hjälp.
          </p>
        </div>
      )}
    </div>
  );
};