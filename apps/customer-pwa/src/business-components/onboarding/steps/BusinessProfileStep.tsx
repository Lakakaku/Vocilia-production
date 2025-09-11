'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
 
  Store,
  Globe,
  DollarSign,
  Info
} from 'lucide-react';

interface BusinessProfileData {
  business_type: string;
  store_count: number;
  geographic_coverage: 'single_city' | 'region' | 'national';
  avg_transaction_value_range: '50-100' | '100-500' | '500+';
  daily_customer_volume: number;
}

interface BusinessProfileStepProps {
  data: BusinessProfileData;
  onChange: (data: BusinessProfileData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BusinessProfileStep({ data, onChange, onNext, onBack }: BusinessProfileStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const businessTypes = [
    { value: '', label: 'Välj verksamhetstyp...', disabled: true },
    { value: 'cafe', label: 'Kafé', description: 'Kafé, bageri, eller kaffebar' },
    { value: 'restaurant', label: 'Restaurang', description: 'Restaurang, pizzeria, eller eatery' },
    { value: 'retail', label: 'Detaljhandel', description: 'Klädaffär, elektronik, eller specialbutik' },
    { value: 'grocery', label: 'Livsmedelsbutik', description: 'Matvarubutik, ICA, eller närbutik' },
    { value: 'pharmacy', label: 'Apotek', description: 'Apotek eller hälsokostaffär' },
    { value: 'beauty', label: 'Skönhet & Hälsa', description: 'Frisör, spa, eller skönhetssalong' },
    { value: 'automotive', label: 'Bil & Motor', description: 'Bilverkstad, biltvätt, eller reservdelar' },
    { value: 'other', label: 'Annat', description: 'Annan typ av verksamhet' }
  ];

  const geographicOptions = [
    { value: 'single_city', label: 'En stad', description: 'All verksamhet i samma stad eller kommun' },
    { value: 'region', label: 'Regional', description: 'Flera städer inom samma län eller region' },
    { value: 'national', label: 'Nationell', description: 'Butiker i flera län eller rikstäckande' }
  ];

  const transactionRanges = [
    { value: '50-100', label: '50-100 SEK', description: 'Kafé, snabbmat, mindre inköp' },
    { value: '100-500', label: '100-500 SEK', description: 'Restaurang, kläder, vardagsinköp' },
    { value: '500+', label: '500+ SEK', description: 'Elektronik, större inköp, lyxvaror' }
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.business_type) {
      newErrors.business_type = 'Välj verksamhetstyp';
    }

    if (!data.store_count || data.store_count < 1) {
      newErrors.store_count = 'Ange antal butiker (minst 1)';
    }

    if (!data.geographic_coverage) {
      newErrors.geographic_coverage = 'Välj geografisk täckning';
    }

    if (!data.avg_transaction_value_range) {
      newErrors.avg_transaction_value_range = 'Välj genomsnittligt transaktionsvärde';
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext();
    }
  };

  const updateData = (field: keyof BusinessProfileData, value: any) => {
    onChange({
      ...data,
      [field]: value
    });
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-4">
          <Building2 className="w-6 h-6 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Företagsprofil
        </h2>
        <p className="text-gray-600">
          Berätta om din verksamhet så vi kan anpassa systemet efter dina behov
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="space-y-20">
          {/* Business Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-5">
              <Store className="w-4 h-4 inline mr-2" />
              Verksamhetstyp *
            </label>
            <select
              value={data.business_type}
              onChange={(e) => updateData('business_type', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                errors.business_type ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            >
              {businessTypes.map(type => (
                <option key={type.value} value={type.value} disabled={type.disabled}>
                  {type.label}
                </option>
              ))}
            </select>
            {data.business_type && businessTypes.find(t => t.value === data.business_type)?.description && (
              <p className="mt-2 text-sm text-gray-500">
                <Info className="w-4 h-4 inline mr-1" />
                {businessTypes.find(t => t.value === data.business_type)?.description}
              </p>
            )}
            {errors.business_type && (
              <p className="mt-2 text-sm text-red-600">{errors.business_type}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {/* Store Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-5">
                <Building2 className="w-4 h-4 inline mr-2" />
                Antal butiker/platser *
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={data.store_count || ''}
                onChange={(e) => updateData('store_count', parseInt(e.target.value) || 0)}
                placeholder="t.ex. 2"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  errors.store_count ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.store_count && (
                <p className="mt-2 text-sm text-red-600">{errors.store_count}</p>
              )}
            </div>

            {/* Geographic Coverage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-5">
                <Globe className="w-4 h-4 inline mr-2" />
                Geografisk täckning *
              </label>
              <select
                value={data.geographic_coverage || ''}
                onChange={(e) => updateData('geographic_coverage', e.target.value as any)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  errors.geographic_coverage ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              >
                <option value="" disabled>Välj täckning...</option>
                {geographicOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {data.geographic_coverage && geographicOptions.find(o => o.value === data.geographic_coverage)?.description && (
                <p className="mt-2 text-sm text-gray-500">
                  <Info className="w-4 h-4 inline mr-1" />
                  {geographicOptions.find(o => o.value === data.geographic_coverage)?.description}
                </p>
              )}
              {errors.geographic_coverage && (
                <p className="mt-2 text-sm text-red-600">{errors.geographic_coverage}</p>
              )}
            </div>
          </div>

          {/* Transaction Value Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-5">
              <DollarSign className="w-4 h-4 inline mr-2" />
              Genomsnittligt transaktionsvärde *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {transactionRanges.map(range => (
                <label 
                  key={range.value}
                  className={`relative flex flex-col p-6 rounded-lg border-2 cursor-pointer transition-colors ${
                    data.avg_transaction_value_range === range.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="transaction_range"
                    value={range.value}
                    checked={data.avg_transaction_value_range === range.value}
                    onChange={(e) => updateData('avg_transaction_value_range', e.target.value as any)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <div className={`font-semibold mb-1 ${
                      data.avg_transaction_value_range === range.value ? 'text-primary-700' : 'text-gray-900'
                    }`}>
                      {range.label}
                    </div>
                    <div className="text-sm text-gray-600">
                      {range.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {errors.avg_transaction_value_range && (
              <p className="mt-2 text-sm text-red-600">{errors.avg_transaction_value_range}</p>
            )}
          </div>


        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={onBack}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            Tillbaka
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
          >
            Fortsätt
          </button>
        </div>
      </div>
    </div>
  );
}