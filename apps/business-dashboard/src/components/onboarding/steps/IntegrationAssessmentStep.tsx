'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  Zap, 
  Clock, 
  Shield, 
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Smartphone,
  Monitor,
  HelpCircle,
  Info
} from 'lucide-react';

interface IntegrationAssessmentData {
  pos_system: 'square' | 'shopify' | 'zettle' | 'other' | 'none';
  tech_comfort_level: 'basic' | 'intermediate' | 'advanced';
  verification_method_preference: 'automatic' | 'simple';
}

interface IntegrationAssessmentStepProps {
  data: IntegrationAssessmentData;
  onChange: (data: IntegrationAssessmentData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function IntegrationAssessmentStep({ data, onChange, onNext, onBack }: IntegrationAssessmentStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const posSystemOptions = [
    { 
      value: 'square', 
      label: 'Square', 
      description: 'Square Point of Sale eller Square Register',
      icon: CreditCard,
      integrationLevel: 'automatic'
    },
    { 
      value: 'shopify', 
      label: 'Shopify POS', 
      description: 'Shopify Point of Sale system',
      icon: Monitor,
      integrationLevel: 'automatic'
    },
    { 
      value: 'zettle', 
      label: 'Zettle (PayPal)', 
      description: 'Zettle by PayPal kassasystem',
      icon: CreditCard,
      integrationLevel: 'automatic'
    },
    { 
      value: 'other', 
      label: 'Annat kassasystem', 
      description: 'Visma, Extenda, Sitoo, eller annat system',
      icon: Monitor,
      integrationLevel: 'simple'
    },
    { 
      value: 'none', 
      label: 'Ingen digitalt kassasystem', 
      description: 'Kassalåda, papperskvitton, eller manuell försäljning',
      icon: AlertTriangle,
      integrationLevel: 'simple'
    }
  ];

  const techComfortLevels = [
    {
      value: 'basic',
      label: 'Grundläggande',
      description: 'Jag föredrar enkla lösningar utan teknisk komplexitet',
      characteristics: ['Enkel installation', 'Minimal konfiguration', 'Grundläggande funktioner']
    },
    {
      value: 'intermediate',
      label: 'Medel',
      description: 'Jag kan hantera vissa tekniska inställningar med vägledning',
      characteristics: ['Följer instruktioner väl', 'Bekväm med grundläggande integrations', 'Lär sig gärna nya verktyg']
    },
    {
      value: 'advanced',
      label: 'Avancerad',
      description: 'Jag är tekniskt kunnig och gillar att anpassa system',
      characteristics: ['API-integrations', 'Anpassade inställningar', 'Teknisk felsökning']
    }
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.pos_system) {
      newErrors.pos_system = 'Välj ditt kassasystem';
    }

    if (!data.tech_comfort_level) {
      newErrors.tech_comfort_level = 'Välj din tekniska komfortnivå';
    }

    if (!data.verification_method_preference) {
      newErrors.verification_method_preference = 'Välj verifieringsmetod';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext();
    }
  };

  const updateData = (field: keyof IntegrationAssessmentData, value: any) => {
    const newData = {
      ...data,
      [field]: value
    };

    // Auto-set verification method based on POS system
    if (field === 'pos_system') {
      const selectedPOS = posSystemOptions.find(pos => pos.value === value);
      if (selectedPOS) {
        newData.verification_method_preference = selectedPOS.integrationLevel as 'automatic' | 'simple';
      }
    }

    onChange(newData);
    
    // Clear error when user makes selection
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const selectedPOS = posSystemOptions.find(pos => pos.value === data.pos_system);
  const canUseAutomatic = selectedPOS?.integrationLevel === 'automatic';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-4">
          <Settings className="w-6 h-6 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Teknisk integration
        </h2>
        <p className="text-gray-600">
          Låt oss anpassa systemet efter din tekniska miljö och komfortnivå
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="space-y-8">
          {/* POS System Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Monitor className="w-5 h-5 mr-2" />
              Kassasystem *
            </h3>
            <p className="text-gray-600 mb-4">
              Vilket kassasystem använder du för att registrera försäljning?
            </p>
            
            <div className="space-y-3">
              {posSystemOptions.map(option => {
                const Icon = option.icon;
                const isSelected = data.pos_system === option.value;
                
                return (
                  <label 
                    key={option.value}
                    className={`relative flex items-start p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pos_system"
                      value={option.value}
                      checked={isSelected}
                      onChange={(e) => updateData('pos_system', e.target.value as any)}
                      className="sr-only"
                    />
                    
                    <Icon className={`w-6 h-6 mr-4 mt-1 flex-shrink-0 ${
                      isSelected ? 'text-primary-600' : 'text-gray-400'
                    }`} />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`font-medium ${
                          isSelected ? 'text-primary-900' : 'text-gray-900'
                        }`}>
                          {option.label}
                        </div>
                        {option.integrationLevel === 'automatic' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                            <Zap className="w-3 h-3 mr-1" />
                            Automatisk
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm">
                        {option.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.pos_system && (
              <p className="mt-2 text-sm text-red-600">{errors.pos_system}</p>
            )}
          </div>

          {/* Tech Comfort Level */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              Teknisk komfortnivå *
            </h3>
            <p className="text-gray-600 mb-4">
              Hur bekväm känner du dig med tekniska lösningar och inställningar?
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {techComfortLevels.map(level => {
                const isSelected = data.tech_comfort_level === level.value;
                
                return (
                  <label 
                    key={level.value}
                    className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tech_comfort_level"
                      value={level.value}
                      checked={isSelected}
                      onChange={(e) => updateData('tech_comfort_level', e.target.value as any)}
                      className="sr-only"
                    />
                    
                    <div className="text-center mb-3">
                      <div className={`font-semibold mb-2 ${
                        isSelected ? 'text-primary-900' : 'text-gray-900'
                      }`}>
                        {level.label}
                      </div>
                      <p className="text-gray-600 text-sm mb-3">
                        {level.description}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      {level.characteristics.map((char, index) => (
                        <div key={index} className="flex items-center text-xs text-gray-500">
                          <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                          {char}
                        </div>
                      ))}
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.tech_comfort_level && (
              <p className="mt-2 text-sm text-red-600">{errors.tech_comfort_level}</p>
            )}
          </div>

          {/* Verification Method */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Verifieringsmetod *
            </h3>
            <p className="text-gray-600 mb-4">
              Hur vill du verifiera att kundernas feedback kommer från äkta köp?
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Automatic Verification */}
              <div 
                className={`relative p-6 rounded-lg border-2 transition-colors ${
                  data.verification_method_preference === 'automatic'
                    ? 'border-primary-500 bg-primary-50'
                    : canUseAutomatic
                      ? 'border-gray-200 hover:border-gray-300 cursor-pointer'
                      : 'border-gray-200 bg-gray-50 opacity-50'
                }`}
              >
                {canUseAutomatic && (
                  <input
                    type="radio"
                    name="verification_method"
                    value="automatic"
                    checked={data.verification_method_preference === 'automatic'}
                    onChange={(e) => updateData('verification_method_preference', e.target.value as any)}
                    className="sr-only"
                  />
                )}
                
                <div className="text-center">
                  <div className="flex items-center justify-center mb-4">
                    <div className={`p-3 rounded-full ${
                      canUseAutomatic ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Zap className={`w-6 h-6 ${
                        canUseAutomatic ? 'text-green-600' : 'text-gray-400'
                      }`} />
                    </div>
                  </div>
                  
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Automatisk verifiering
                  </h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Kassasystemet verifierar köp automatiskt. Belöningar utbetalas direkt efter godkänd feedback.
                  </p>
                  
                  <div className="space-y-2 text-xs text-gray-500">
                    <div className="flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                      Ingen manuell hantering
                    </div>
                    <div className="flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                      Direktutbetalning
                    </div>
                    <div className="flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                      Realtidsanalyser
                    </div>
                  </div>
                  
                  {!canUseAutomatic && (
                    <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      <Info className="w-3 h-3 inline mr-1" />
                      Kräver kompatibelt kassasystem
                    </div>
                  )}
                </div>
                
                {canUseAutomatic && (
                  <label 
                    htmlFor="verification_method_automatic"
                    className="absolute inset-0 cursor-pointer"
                  />
                )}
              </div>

              {/* Simple Verification */}
              <label 
                className={`relative p-6 rounded-lg border-2 cursor-pointer transition-colors ${
                  data.verification_method_preference === 'simple'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="verification_method"
                  value="simple"
                  checked={data.verification_method_preference === 'simple'}
                  onChange={(e) => updateData('verification_method_preference', e.target.value as any)}
                  className="sr-only"
                />
                
                <div className="text-center">
                  <div className="flex items-center justify-center mb-4">
                    <div className="p-3 rounded-full bg-blue-100">
                      <Smartphone className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Enkel verifiering
                  </h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Du verifierar köp manuellt varje vecka. Belöningar utbetalas månatligen via Swish.
                  </p>
                  
                  <div className="space-y-2 text-xs text-gray-500">
                    <div className="flex items-center justify-center">
                      <Clock className="w-3 h-3 mr-1 text-blue-500" />
                      10-15 min/vecka
                    </div>
                    <div className="flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                      Fungerar med alla kassasystem
                    </div>
                    <div className="flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                      Månatlig sammanställning
                    </div>
                  </div>
                </div>
              </label>
            </div>
            {errors.verification_method_preference && (
              <p className="mt-2 text-sm text-red-600">{errors.verification_method_preference}</p>
            )}
          </div>

          {/* Integration Complexity Indicator */}
          {data.pos_system && data.tech_comfort_level && data.verification_method_preference && (
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                <Info className="w-4 h-4 mr-2" />
                Rekommenderad implementation
              </h4>
              
              {data.verification_method_preference === 'automatic' ? (
                <div className="space-y-2">
                  <p className="text-blue-800 text-sm">
                    ✅ <strong>Automatisk verifiering</strong> rekommenderas baserat på ditt kassasystem ({selectedPOS?.label}).
                  </p>
                  <p className="text-blue-700 text-sm">
                    <strong>Nästa steg:</strong> Vi kommer guida dig genom att koppla ditt {selectedPOS?.label}-konto 
                    för automatisk transaktionsverifiering.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-blue-800 text-sm">
                    ✅ <strong>Enkel verifiering</strong> passar bra för ditt kassasystem och tekniska nivå.
                  </p>
                  <p className="text-blue-700 text-sm">
                    <strong>Nästa steg:</strong> Vi kommer skapa lokala QR-koder och visa dig hur du verifierar 
                    kundköp mot dina kassarapporter varje vecka.
                  </p>
                </div>
              )}
            </div>
          )}
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