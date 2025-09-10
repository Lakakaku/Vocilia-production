'use client';

import React, { useState } from 'react';
import { 
  Rocket, 
  CheckCircle2, 
  ArrowRight, 
  Lightbulb,
  Clock,
  Users,
  TrendingUp,
  Shield
} from 'lucide-react';
import { ProcessTimeline } from '../ProcessTimeline';
import { ValueCalculator } from '../ValueCalculator';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const [showCalculator, setShowCalculator] = useState(false);
  
  const benefits = [
    {
      icon: Lightbulb,
      title: 'Värdefull kundinsikt',
      description: 'AI-analyserad feedback ger dig konkreta förbättringsområden och kundperspektiv som verkligen hjälper din verksamhet'
    },
    {
      icon: Users,
      title: 'Motiverade kunder',
      description: 'Kunder blir mer engagerade när de får belöningar för genomtänkt feedback - de kommer tillbaka oftare'
    },
    {
      icon: Shield,
      title: 'Kvalitetsförsäkring',
      description: 'Endast verifierade köp och genomtänkt feedback genererar belöningar. Systemet filtrerar bort spam automatiskt'
    },
    {
      icon: Clock,
      title: 'Minimal tidsåtgång',
      description: 'Efter initial setup behöver du bara 10-15 minuter per vecka för att hantera feedback och utbetalningar'
    }
  ];

  const keyFeatures = [
    'AI-driven kvalitetsbedömning av feedback',
    'Automatisk kategorisering av förbättringsområden', 
    'Integrerar med ditt befintliga kassasystem',
    'Flexibel verifieringsprocess anpassad efter dina behov',
    'Detaljerade rapporter och trendanalys',
    'Kundengagemang genom belöningssystem'
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
          <Rocket className="w-8 h-8 text-primary-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Välkommen till AI Feedback Platform
        </h1>
        
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Förvandla kundinteraktion till värdefull affärsinsikt. Låt kunder tjäna belöningar 
          för att ge dig genomtänkt feedback som konkret förbättrar din verksamhet.
        </p>
      </div>

      {/* Key Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {benefits.map((benefit, index) => {
          const Icon = benefit.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-lg border border-gray-200 hover:border-primary-200 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* How It Works */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">
          Så fungerar systemet
        </h2>
        <ProcessTimeline />
      </div>

      {/* Key Features */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 mb-8">
        <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Vad du får tillgång till
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {keyFeatures.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-blue-800">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              {feature}
            </div>
          ))}
        </div>
      </div>

      {/* Value Calculator Toggle */}
      <div className="mb-8">
        <div className="text-center">
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border border-green-200 transition-colors"
          >
            <TrendingUp className="w-5 h-5" />
            {showCalculator ? 'Dölj' : 'Visa'} potentiell affärsnytta
            <ArrowRight className={`w-4 h-4 transform transition-transform ${showCalculator ? 'rotate-90' : ''}`} />
          </button>
        </div>
        
        {showCalculator && (
          <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
            <ValueCalculator />
          </div>
        )}
      </div>

      {/* Investment Information */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
        <div className="text-center">
          <h3 className="font-semibold text-gray-900 mb-3">
            💰 Transparent prissättning
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-800">
            <div className="bg-white rounded-lg p-4">
              <div className="font-bold text-lg text-gray-900">Gratis trial</div>
              <div className="text-xs text-gray-600">De första 30 feedbacks kostar ingenting</div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="font-bold text-lg text-gray-900">20% plattformsavgift</div>
              <div className="text-xs text-gray-600">Vi tar 20% av utbetalningarna till kunder</div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="font-bold text-lg text-gray-900">Ingen fast kostnad</div>
              <div className="text-xs text-gray-600">Du betalar bara när kunder får belöningar</div>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Exempel: Om en kund får 50 SEK i belöning betalar du totalt 60 SEK (50 SEK till kund + 10 SEK plattformsavgift)
          </p>
        </div>
      </div>

      {/* Getting Started */}
      <div className="text-center">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Redo att börja samla värdefull kundfeedback?
          </h3>
          <p className="text-gray-600 mb-6">
            Konfigurationen tar 10-15 minuter. Du kan börja ta emot feedback redan denna vecka 
            och se första resultaten inom några dagar.
          </p>
          
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
          >
            Börja konfiguration
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <p className="text-xs text-gray-500 mt-3">
            Gratis trial för de första 30 feedbacks • Avbryt när som helst
          </p>
        </div>
      </div>
    </div>
  );
}