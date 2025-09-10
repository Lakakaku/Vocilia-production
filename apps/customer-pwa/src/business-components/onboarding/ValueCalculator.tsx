'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, Users, Crown } from 'lucide-react';

interface CalculatorResults {
  weeklyFeedbacks: number;
  averageReward: number;
  weeklyCustomerPayouts: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
}

export function ValueCalculator() {
  const [customersPerDay, setCustomersPerDay] = useState(50);
  const [feedbackRate, setFeedbackRate] = useState(10); // Percentage of customers who give feedback
  const [averageQuality, setAverageQuality] = useState(75); // Average quality score
  
  const [results, setResults] = useState<CalculatorResults>({
    weeklyFeedbacks: 0,
    averageReward: 0,
    weeklyCustomerPayouts: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    yearlyRevenue: 0
  });

  useEffect(() => {
    // Calculate based on current inputs
    const weeklyFeedbacks = Math.round((customersPerDay * 7 * feedbackRate) / 100);
    
    // Quality-based reward calculation (simplified version of actual algorithm)
    let averageReward = 0;
    if (averageQuality >= 90) averageReward = 25; // Premium quality
    else if (averageQuality >= 80) averageReward = 20; // High quality
    else if (averageQuality >= 70) averageReward = 15; // Good quality
    else if (averageQuality >= 60) averageReward = 10; // Acceptable quality
    else averageReward = 5; // Basic quality
    
    const weeklyCustomerPayouts = weeklyFeedbacks * averageReward;
    const weeklyRevenue = weeklyCustomerPayouts * 0.20; // 20% commission
    const monthlyRevenue = weeklyRevenue * 4.33; // ~4.33 weeks per month
    const yearlyRevenue = monthlyRevenue * 12;
    
    setResults({
      weeklyFeedbacks,
      averageReward,
      weeklyCustomerPayouts,
      weeklyRevenue,
      monthlyRevenue,
      yearlyRevenue
    });
  }, [customersPerDay, feedbackRate, averageQuality]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 mb-2">
          <Calculator className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Beräkna din potentiella intäkt
          </h3>
        </div>
        <p className="text-gray-600 text-sm">
          Justera värdena nedan för att se vad du kan tjäna på kundernas feedback
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Input Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Kunder per dag
              </label>
              <input
                type="range"
                min="10"
                max="500"
                value={customersPerDay}
                onChange={(e) => setCustomersPerDay(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-center text-lg font-semibold text-primary-600 mt-1">
                {customersPerDay}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Feedback-frekvens
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={feedbackRate}
                onChange={(e) => setFeedbackRate(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-center text-lg font-semibold text-primary-600 mt-1">
                {feedbackRate}%
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Crown className="w-4 h-4 inline mr-1" />
                Genomsnittlig kvalitet
              </label>
              <input
                type="range"
                min="50"
                max="95"
                value={averageQuality}
                onChange={(e) => setAverageQuality(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-center text-lg font-semibold text-primary-600 mt-1">
                {averageQuality}/100
              </div>
            </div>
          </div>

          {/* Results Display */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.weeklyFeedbacks}
              </div>
              <div className="text-sm text-blue-800">
                Feedback per vecka
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(results.averageReward)}
              </div>
              <div className="text-sm text-green-800">
                Genomsnittlig belöning
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(results.weeklyCustomerPayouts)}
              </div>
              <div className="text-sm text-purple-800">
                Kundbelöningar/vecka
              </div>
            </div>
            
            <div className="bg-primary-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary-600">
                {formatCurrency(results.weeklyRevenue)}
              </div>
              <div className="text-sm text-primary-800">
                Din intäkt/vecka
              </div>
            </div>
          </div>
        </div>

        {/* Monthly/Yearly Projections */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="font-medium text-gray-900 mb-3 text-center">
            Projektioner baserade på nuvarande inställningar
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
              <div className="text-xl font-bold text-orange-600">
                {formatCurrency(results.monthlyRevenue)}
              </div>
              <div className="text-sm text-orange-800">
                Månatlig intäkt (20% provision)
              </div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
              <div className="text-xl font-bold text-red-600">
                {formatCurrency(results.yearlyRevenue)}
              </div>
              <div className="text-sm text-red-800">
                Årlig intäkt (20% provision)
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-xs text-yellow-800">
            <strong>💡 Tips för att maximera intäkter:</strong> Uppmuntra kunder att ge detaljerad feedback, 
            placera QR-koder synligt vid kassan, och följ upp på feedback för att förbättra kvalitetspoängen.
          </div>
        </div>
      </div>
    </div>
  );
}