import React from 'react';
import { cn } from '../utils/cn';
import { QualityScoreProps } from '../types';

export const QualityScoreDisplay: React.FC<QualityScoreProps> = ({
  score,
  showBreakdown = false,
  size = 'md',
  className
}) => {
  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-green-600 bg-green-100';
    if (value >= 60) return 'text-yellow-600 bg-yellow-100';
    if (value >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreBarColor = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    if (value >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const ScoreBar = ({ label, value, weight }: { label: string; value: number; weight: string }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span>{value}/100 ({weight})</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={cn('h-2 rounded-full transition-all duration-300', getScoreBarColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-4', sizeClasses[size], className)}>
      {/* Total Score */}
      <div className="text-center">
        <div className={cn(
          'inline-flex items-center justify-center rounded-full font-bold',
          size === 'sm' ? 'w-16 h-16 text-xl' : size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-20 h-20 text-2xl',
          getScoreColor(score.total)
        )}>
          {score.total}
        </div>
        <p className="mt-2 text-gray-600 font-medium">Totala kvalitetspoäng</p>
      </div>

      {/* Score Breakdown */}
      {showBreakdown && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900">Poängfördelning</h4>
          
          <ScoreBar
            label="Äkthet"
            value={score.authenticity}
            weight="40%"
          />
          
          <ScoreBar
            label="Konkrethet"
            value={score.concreteness}
            weight="30%"
          />
          
          <ScoreBar
            label="Djup"
            value={score.depth}
            weight="30%"
          />
        </div>
      )}
    </div>
  );
};