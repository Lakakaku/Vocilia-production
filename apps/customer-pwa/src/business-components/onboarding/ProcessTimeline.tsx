'use client';

import React from 'react';
import { 
  Smartphone, 
  MessageCircle, 
  CheckCircle2, 
  Banknote,
  ArrowRight 
} from 'lucide-react';

interface TimelineStep {
  id: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  timeframe: string;
}

const timelineSteps: TimelineStep[] = [
  {
    id: 1,
    title: 'Konfiguration',
    description: 'Ställ in ditt företag och generera QR-koder för dina butiker',
    icon: CheckCircle2,
    timeframe: '10-15 min'
  },
  {
    id: 2,
    title: 'Första feedback',
    description: 'Kunder skannar QR-kod och lämnar röstfeedback via AI-assistenten',
    icon: MessageCircle,
    timeframe: 'Vecka 1'
  },
  {
    id: 3,
    title: 'Verifiering',
    description: 'Verifiera kunders köp mot ditt kassasystem varje vecka',
    icon: Smartphone,
    timeframe: 'Varje måndag'
  },
  {
    id: 4,
    title: 'Utbetalning',
    description: 'Godkänd feedback utbetalas till kunder via Swish, du får faktura',
    icon: Banknote,
    timeframe: 'Månatligen'
  }
];

export function ProcessTimeline() {
  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">
        Din resa från setup till första utbetalning
      </h3>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute top-12 left-8 right-8 h-0.5 bg-gray-200 hidden md:block"></div>
        <div className="absolute top-12 left-8 w-1/4 h-0.5 bg-primary-500 hidden md:block"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {timelineSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === 0; // First step is active during onboarding
            
            return (
              <div key={step.id} className="relative text-center">
                {/* Mobile connector line */}
                {index < timelineSteps.length - 1 && (
                  <div className="absolute top-16 left-1/2 transform -translate-x-1/2 h-12 w-0.5 bg-gray-200 md:hidden"></div>
                )}
                
                {/* Icon circle */}
                <div className={`relative z-10 mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  isActive 
                    ? 'bg-primary-500 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <Icon className="w-7 h-7" />
                </div>
                
                {/* Content */}
                <div className="space-y-2">
                  <h4 className={`font-medium ${isActive ? 'text-primary-900' : 'text-gray-900'}`}>
                    {step.title}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    isActive 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {step.timeframe}
                  </div>
                </div>
                
                {/* Arrow for desktop */}
                {index < timelineSteps.length - 1 && (
                  <div className="absolute top-6 -right-3 hidden md:block text-gray-300">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Key benefits */}
      <div className="mt-8 p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="text-center">
          <h4 className="font-medium text-green-900 mb-2">
            💡 Varför denna process fungerar
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-green-800">
            <div>
              <span className="font-medium">Äkta feedback:</span> Endast verifierade köp ger belöningar
            </div>
            <div>
              <span className="font-medium">Kvalitet först:</span> AI belönar genomtänkta svar mer
            </div>
            <div>
              <span className="font-medium">Enkel hantering:</span> Automatiserad process efter setup
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}