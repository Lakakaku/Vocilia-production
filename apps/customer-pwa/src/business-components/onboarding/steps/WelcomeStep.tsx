'use client';

import React from 'react';
import { 
  Rocket, 
  CheckCircle2, 
  ArrowRight, 
  Lightbulb,
  Users,
  Shield
} from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  
  const keyBenefits = [
    {
      icon: Lightbulb,
      title: 'Värdefull kundinsikt',
      description: 'AI-analyserad feedback ger konkreta förbättringsområden'
    },
    {
      icon: Users,
      title: 'Motiverade kunder',
      description: 'Kunder återvänder oftare när de får belöningar för bra feedback'
    },
    {
      icon: Shield,
      title: 'Kvalitetsförsäkring',
      description: 'Endast verifierade köp och genomtänkt feedback genererar belöningar'
    }
  ];

  return (
    <div className="max-w-3xl mx-auto text-center">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-6">
          <Rocket className="w-8 h-8 text-primary-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Välkommen till AI Feedback Platform
        </h1>
        
        <p className="text-lg text-gray-600 leading-relaxed">
          Förvandla kundinteraktion till värdefull affärsinsikt. Vi hjälper dig samla 
          kvalitetsfeedback genom att belöna kunder för genomtänkta svar.
        </p>
      </div>

      {/* Key Benefits - Compact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {keyBenefits.map((benefit, index) => {
          const Icon = benefit.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {benefit.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Simple Pricing Info */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-gray-900">Transparent prissättning</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-bold text-gray-900">Gratis trial</div>
            <div className="text-gray-600">De första 30 feedbacks</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-gray-900">20% plattformsavgift</div>
            <div className="text-gray-600">Vi tar 20% av utbetalningarna</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-gray-900">Ingen fast kostnad</div>
            <div className="text-gray-600">Betala bara för resultat</div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Exempel: Kund får 50 SEK → Du betalar 60 SEK totalt (50 + 10 avgift)
        </p>
      </div>

      {/* Next Step */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-3">
          Kom igång på 10 minuter
        </h3>
        <p className="text-gray-600 mb-6">
          Vi guidar dig genom 4 enkla steg för att konfigurera ditt system och börja 
          ta emot värdefull feedback från dina kunder.
        </p>
        
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
        >
          Börja konfiguration
          <ArrowRight className="w-5 h-5" />
        </button>
        
        <p className="text-xs text-gray-500 mt-3">
          Steg 1 av 4 • Gratis trial • Avbryt när som helst
        </p>
      </div>
    </div>
  );
}