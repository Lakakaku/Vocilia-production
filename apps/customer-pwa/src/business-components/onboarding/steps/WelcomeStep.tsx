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
      <div className="mb-12">
        <div className="relative inline-flex items-center justify-center w-20 h-20 mb-8">
          {/* Pulsing wave rings */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 animate-pulse opacity-20"></div>
          <div className="absolute inset-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 animate-pulse opacity-30 animation-delay-150"></div>
          <div className="absolute inset-4 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 animate-pulse opacity-40 animation-delay-300"></div>
          
          {/* Icon container with sonic gradient */}
          <div className="relative w-12 h-12 bg-gradient-to-br from-sky-500 via-blue-600 to-sky-600 rounded-full flex items-center justify-center shadow-lg">
            <Rocket className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
          Välkommen till AI Feedback Platform
        </h1>
        
        <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
          Förvandla kundinteraktion till värdefull affärsinsikt. Vi hjälper dig samla 
          kvalitetsfeedback genom att belöna kunder för genomtänkta svar.
        </p>
      </div>

      {/* Key Benefits with acoustic surfaces */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {keyBenefits.map((benefit, index) => {
          const Icon = benefit.icon;
          return (
            <div 
              key={index} 
              className="group relative bg-white p-8 rounded-2xl border border-blue-200 transition-all duration-300 hover:shadow-xl hover:shadow-blue-200/25 hover:border-blue-300"
              style={{ 
                animationDelay: `${index * 150}ms`,
                animation: 'fadeInUp 0.6s ease-out forwards'
              }}
            >
              {/* Subtle wave pattern background */}
              
              <div className="relative flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pricing with wave visualization - HIGH CONTRAST */}
      <div className="relative bg-white rounded-2xl p-8 mb-12 border border-gray-200 shadow-lg">
        
        <div className="relative">
          <div className="flex items-center justify-center gap-3 mb-6">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            <span className="text-xl font-semibold text-gray-900">Transparent prissättning</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center bg-white rounded-xl p-6 border border-blue-200 shadow-md">
              <div className="text-lg font-bold text-gray-900 mb-2">Gratis trial</div>
              <div className="text-gray-700 font-medium">De första 30 feedbacks</div>
            </div>
            <div className="text-center bg-white rounded-xl p-6 border border-blue-200 shadow-md">
              <div className="text-lg font-bold text-gray-900 mb-2">Ingen fast kostnad</div>
              <div className="text-gray-700 font-medium">Betala bara för resultat</div>
            </div>
          </div>
          
        </div>
      </div>

      {/* CTA with wave interaction */}
      <div className="relative bg-white border border-gray-200 rounded-2xl p-8 overflow-hidden">
        
        <div className="relative">
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            Kom igång på 10 minuter
          </h3>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Vi guidar dig genom 4 enkla steg för att konfigurera ditt system och börja 
            ta emot värdefull feedback från dina kunder.
          </p>
          
          <button
            onClick={onNext}
            className="group relative inline-flex items-center justify-center px-16 py-7 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white rounded-2xl text-lg font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-105"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-900 to-blue-800 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-300"></div>
            <span className="relative flex items-center">
              Börja konfiguration
              <ArrowRight className="ml-3 w-6 h-6 transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110" />
            </span>
          </button>
          
          <p className="text-sm text-gray-500 mt-4">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Steg 1 av 4 • Gratis trial • Avbryt när som helst
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}