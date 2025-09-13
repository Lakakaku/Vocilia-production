'use client';

import React, { useState } from 'react';
import { 
  Rocket, 
  CheckCircle2, 
  ArrowRight, 
  Lightbulb,
  Clock,
  DollarSign 
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
      icon: DollarSign,
      title: 'Passiv inkomstkälla',
      description: 'Tjäna 20% provision på alla godkända kundbelöningar utan extra arbete'
    },
    {
      icon: Lightbulb,
      title: 'Värdefull feedback',
      description: 'AI-analyserad kundinsikt hjälper dig förbättra din verksamhet systematiskt'
    },
    {
      icon: CheckCircle2,
      title: 'Kvalitetsförsäkring',
      description: 'Endast verifierade köp och genomtänkt feedback genererar belöningar'
    },
    {
      icon: Clock,
      title: 'Minimal tidsåtgång',
      description: 'Efter setup krävs endast 10-15 minuter verifiering per vecka'
    }
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
          Förvandla din kundinteraktion till en värdefull inkomstkälla. Låt kunder 
          tjäna belöningar för att ge dig genomtänkt feedback som förbättrar din verksamhet.
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

      {/* Process Timeline */}
      <div className="mb-8">
        <ProcessTimeline />
      </div>

      {/* Value Calculator Toggle */}
      <div className="mb-8">
        <div className="text-center">
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            {showCalculator ? 'Dölj' : 'Visa'} intäktskalkylator
            <ArrowRight className={`w-4 h-4 transform transition-transform ${showCalculator ? 'rotate-90' : ''}`} />
          </button>
        </div>
        
        {showCalculator && (
          <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
            <ValueCalculator />
          </div>
        )}
      </div>

      {/* Success Stories / Social Proof */}
      <div className="bg-green-50 rounded-lg p-6 border border-green-200 mb-8">
        <div className="text-center">
          <h3 className="font-semibold text-green-900 mb-3">
            📈 Framgångshistorier från våra tidiga användare
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-green-800">
            <div className="bg-white bg-opacity-50 rounded-lg p-4">
              <div className="font-bold text-lg text-green-700">~3,200 SEK/mån</div>
              <div className="text-xs">Genomsnittlig månadsintäkt för kaféer med 40-60 kunder/dag</div>
            </div>
            <div className="bg-white bg-opacity-50 rounded-lg p-4">
              <div className="font-bold text-lg text-green-700">87% kvalitet</div>
              <div className="text-xs">Genomsnittlig feedbackkvalitet från verifierade köp</div>
            </div>
            <div className="bg-white bg-opacity-50 rounded-lg p-4">
              <div className="font-bold text-lg text-green-700">12 min/vecka</div>
              <div className="text-xs">Genomsnittlig tid för verifiering av veckans feedback</div>
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="text-center">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Redo att börja tjäna på kundfeedback?
          </h3>
          <p className="text-gray-600 mb-6">
            Det tar bara 10-15 minuter att konfigurera ditt konto. Du kan börja ta emot 
            feedback redan denna vecka och få din första utbetalning nästa månad.
          </p>
          
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
          >
            Börja konfiguration
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <p className="text-xs text-gray-500 mt-3">
            Ingen kostnad under de första 30 feedbacks • Avbryt när som helst
          </p>
        </div>
      </div>
    </div>
  );
}