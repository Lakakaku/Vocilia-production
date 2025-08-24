'use client';

import { useState, useEffect } from 'react';
import { Calculator, TrendingUp, DollarSign, BarChart3, Info } from 'lucide-react';

interface ROIInputs {
  monthlyRevenue: number;
  monthlySubscriptionFee: number;
  setupCosts: number;
  staffTimeHours: number;
  staffHourlyRate: number;
  expectedSalesIncrease: number;
  expectedEfficiencyGains: number;
  feedbacksPerMonth: number;
}

interface ROIResults {
  monthlyBenefits: number;
  monthlyCosts: number;
  monthlyNetBenefit: number;
  roiPercentage: number;
  paybackMonths: number;
  yearlyROI: number;
  breakEvenPoint: number;
}

const defaultInputs: ROIInputs = {
  monthlyRevenue: 500000, // 500k SEK
  monthlySubscriptionFee: 4999, // ~5k SEK
  setupCosts: 15000, // 15k SEK one-time
  staffTimeHours: 20, // 20 hours saved per month
  staffHourlyRate: 250, // 250 SEK/hour
  expectedSalesIncrease: 3, // 3% increase
  expectedEfficiencyGains: 15, // 15% efficiency improvement
  feedbacksPerMonth: 200
};

export function ROICalculator() {
  const [inputs, setInputs] = useState<ROIInputs>(defaultInputs);
  const [results, setResults] = useState<ROIResults | null>(null);
  const [timeframe, setTimeframe] = useState(12); // months

  useEffect(() => {
    calculateROI();
  }, [inputs, timeframe]);

  const calculateROI = () => {
    const {
      monthlyRevenue,
      monthlySubscriptionFee,
      setupCosts,
      staffTimeHours,
      staffHourlyRate,
      expectedSalesIncrease,
      expectedEfficiencyGains,
      feedbacksPerMonth
    } = inputs;

    // Calculate monthly benefits
    const salesIncreaseValue = monthlyRevenue * (expectedSalesIncrease / 100);
    const staffTimeSavings = staffTimeHours * staffHourlyRate;
    const operationalEfficiency = monthlyRevenue * 0.1 * (expectedEfficiencyGains / 100); // Assume 10% of revenue is operational costs
    const customerRetentionValue = feedbacksPerMonth * 25; // Assume 25 SEK value per feedback for retention
    
    const monthlyBenefits = salesIncreaseValue + staffTimeSavings + operationalEfficiency + customerRetentionValue;
    const monthlyCosts = monthlySubscriptionFee;
    const monthlyNetBenefit = monthlyBenefits - monthlyCosts;
    
    // Include setup costs in first year calculation
    const totalFirstYearCosts = (monthlyCosts * 12) + setupCosts;
    const totalFirstYearBenefits = monthlyBenefits * 12;
    const yearlyROI = ((totalFirstYearBenefits - totalFirstYearCosts) / totalFirstYearCosts) * 100;
    
    const roiPercentage = (monthlyNetBenefit / monthlyCosts) * 100;
    const paybackMonths = setupCosts / monthlyNetBenefit;
    const breakEvenPoint = setupCosts / monthlyNetBenefit;

    setResults({
      monthlyBenefits,
      monthlyCosts,
      monthlyNetBenefit,
      roiPercentage,
      paybackMonths,
      yearlyROI,
      breakEvenPoint
    });
  };

  const updateInput = (key: keyof ROIInputs, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Calculator className="w-8 h-8 text-primary-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ROI-kalkylator</h2>
          <p className="text-gray-600">Beräkna avkastning på din investering i AI Feedback-plattformen</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inställningar</h3>
          
          <div className="space-y-4">
            {/* Business Metrics */}
            <div className="border-b pb-4">
              <h4 className="font-medium text-gray-900 mb-3">Företagsdata</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Månadsomsättning (SEK)
                  </label>
                  <input
                    type="number"
                    value={inputs.monthlyRevenue}
                    onChange={(e) => updateInput('monthlyRevenue', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Förväntade feedback per månad
                  </label>
                  <input
                    type="number"
                    value={inputs.feedbacksPerMonth}
                    onChange={(e) => updateInput('feedbacksPerMonth', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Costs */}
            <div className="border-b pb-4">
              <h4 className="font-medium text-gray-900 mb-3">Kostnader</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Månadsprenumeration (SEK)
                  </label>
                  <input
                    type="number"
                    value={inputs.monthlySubscriptionFee}
                    onChange={(e) => updateInput('monthlySubscriptionFee', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Uppsättningskostnader (SEK)
                  </label>
                  <input
                    type="number"
                    value={inputs.setupCosts}
                    onChange={(e) => updateInput('setupCosts', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Fördelar</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Förväntad försäljningsökning (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputs.expectedSalesIncrease}
                    onChange={(e) => updateInput('expectedSalesIncrease', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sparade arbetstimmar per månad
                  </label>
                  <input
                    type="number"
                    value={inputs.staffTimeHours}
                    onChange={(e) => updateInput('staffTimeHours', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timkostnad personal (SEK)
                  </label>
                  <input
                    type="number"
                    value={inputs.staffHourlyRate}
                    onChange={(e) => updateInput('staffHourlyRate', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effektivitetsförbättring (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputs.expectedEfficiencyGains}
                    onChange={(e) => updateInput('expectedEfficiencyGains', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {results && (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-700">Månatlig ROI</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatPercentage(results.roiPercentage)}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">Årlig ROI</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatPercentage(results.yearlyROI)}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-gray-700">Månatlig nettovinst</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(results.monthlyNetBenefit)}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calculator className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-gray-700">Återbetalningstid</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {results.paybackMonths.toFixed(1)} mån
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detaljerad uppdelning</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="font-medium text-green-800">Månadsfördelar totalt</span>
                    <span className="font-bold text-green-800">{formatCurrency(results.monthlyBenefits)}</span>
                  </div>
                  
                  <div className="ml-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Försäljningsökning ({inputs.expectedSalesIncrease}%)</span>
                      <span>{formatCurrency(inputs.monthlyRevenue * (inputs.expectedSalesIncrease / 100))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Personalbesparingar</span>
                      <span>{formatCurrency(inputs.staffTimeHours * inputs.staffHourlyRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Operationell effektivitet</span>
                      <span>{formatCurrency(inputs.monthlyRevenue * 0.1 * (inputs.expectedEfficiencyGains / 100))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Kundlojalitet & retention</span>
                      <span>{formatCurrency(inputs.feedbacksPerMonth * 25)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="font-medium text-red-800">Månadskostnader totalt</span>
                    <span className="font-bold text-red-800">{formatCurrency(results.monthlyCosts)}</span>
                  </div>

                  <div className="ml-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Plattformsprenumeration</span>
                      <span>{formatCurrency(inputs.monthlySubscriptionFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Uppsättning (över {results.paybackMonths.toFixed(1)} mån)</span>
                      <span>{formatCurrency(inputs.setupCosts / results.paybackMonths)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Projection Chart */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">12-månaders prognos</h3>
                
                <div className="space-y-3">
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = i + 1;
                    const cumulativeBenefits = results.monthlyBenefits * month;
                    const cumulativeCosts = (results.monthlyCosts * month) + inputs.setupCosts;
                    const cumulativeProfit = cumulativeBenefits - cumulativeCosts;
                    const isPositive = cumulativeProfit > 0;
                    
                    return (
                      <div key={month} className="flex items-center justify-between p-2 rounded">
                        <span className="text-sm text-gray-600">Månad {month}</span>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-500 w-24 text-right">
                            {formatCurrency(cumulativeBenefits)}
                          </span>
                          <span className="text-sm text-gray-500 w-24 text-right">
                            -{formatCurrency(cumulativeCosts)}
                          </span>
                          <span className={`text-sm font-medium w-24 text-right ${
                            isPositive ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(Math.abs(cumulativeProfit))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 text-gray-500 mt-0.5" />
                    <div className="text-xs text-gray-600">
                      <p><strong>Observera:</strong> Denna kalkyl baseras på uppskattningar och kan variera beroende på faktisk användning.</p>
                      <p className="mt-1">Kolumnerna visar: Kumulativa fördelar | Kumulativa kostnader | Nettovinst/förlust</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}