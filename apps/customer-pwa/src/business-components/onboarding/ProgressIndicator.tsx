'use client';

import React from 'react';
import { Check, Circle, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProgressStep {
  id: number;
  title: string;
  isCompleted: boolean;
  isActive: boolean;
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  currentStep: number;
  totalSteps: number;
  onStepClick?: (stepIndex: number) => void;
}

export function ProgressIndicator({ steps, currentStep, totalSteps, onStepClick }: ProgressIndicatorProps) {
  const progressPercentage = Math.round((currentStep / totalSteps) * 100);

  const handleStepClick = (stepIndex: number) => {
    if (onStepClick) {
      // Only allow clicking on completed steps or the current step
      const step = steps[stepIndex];
      if (step.isCompleted || step.isActive) {
        onStepClick(stepIndex);
      }
    }
  };

  return (
    <div className="w-full">
      {/* Progress bar with wave pattern */}
      <div className="mb-8">
        <div className="flex justify-center items-center mb-4">
          <span className="text-lg font-medium text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            Steg {currentStep} av {totalSteps}
          </span>
        </div>
        
        {/* Audio waveform progress bar */}
        <div className="relative w-full h-8 overflow-hidden">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 200 40">
            {/* Audio wave pattern */}
            <path 
              d="M0,20 L5,15 L10,25 L15,10 L20,30 L25,8 L30,32 L35,12 L40,28 L45,6 L50,34 L55,14 L60,26 L65,4 L70,36 L75,16 L80,24 L85,2 L90,38 L95,18 L100,22 L105,7 L110,33 L115,11 L120,29 L125,5 L130,35 L135,13 L140,27 L145,3 L150,37 L155,17 L160,23 L165,9 L170,31 L175,15 L180,25 L185,8 L190,32 L195,12 L200,28" 
              stroke="#9ca3af" 
              strokeWidth="1.5" 
              fill="none"
              className="transition-all duration-300"
            />
            {/* Progress overlay - navy blue fill */}
            <defs>
              <clipPath id={`progressClip-${currentStep}`}>
                <rect x="0" y="0" width={`${(progressPercentage / 100) * 200}`} height="40" />
              </clipPath>
            </defs>
            <path 
              d="M0,20 L5,15 L10,25 L15,10 L20,30 L25,8 L30,32 L35,12 L40,28 L45,6 L50,34 L55,14 L60,26 L65,4 L70,36 L75,16 L80,24 L85,2 L90,38 L95,18 L100,22 L105,7 L110,33 L115,11 L120,29 L125,5 L130,35 L135,13 L140,27 L145,3 L150,37 L155,17 L160,23 L165,9 L170,31 L175,15 L180,25 L185,8 L190,32 L195,12 L200,28" 
              stroke="#1e3a8a" 
              strokeWidth="2" 
              fill="none"
              clipPath={`url(#progressClip-${currentStep})`}
              className="transition-all duration-500 ease-out"
            />
          </svg>
        </div>
      </div>

      {/* Step navigation with arrows */}
      <div className="relative">
        {/* Desktop layout */}
        <div className="hidden md:flex md:items-center md:justify-between">
          {/* Previous button */}
          <button
            onClick={() => onStepClick && currentStep > 1 && onStepClick(currentStep - 2)}
            disabled={currentStep <= 1}
            className={`p-3 rounded-full transition-all duration-300 ${
              currentStep > 1
                ? 'bg-white/20 hover:bg-white/30 text-white cursor-pointer hover:scale-110'
                : 'bg-gray-200/20 text-gray-400 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Step indicators */}
          <div className="flex items-center space-x-4 px-8">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center relative">
                {/* Wave connector */}
                {index < steps.length - 1 && (
                  <div className="absolute top-6 left-1/2 w-16 h-1 z-0" style={{ marginLeft: '2rem' }}>
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 10">
                      <path 
                        d="M0,5 Q50,1 100,5" 
                        stroke={step.isCompleted ? 'url(#completedWave)' : 'url(#pendingWave)'} 
                        strokeWidth="2" 
                        fill="none"
                        className={step.isCompleted ? 'animate-pulse' : ''}
                      />
                      <defs>
                        <linearGradient id="completedWave" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="pendingWave" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#e5e7eb" />
                          <stop offset="100%" stopColor="#d1d5db" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                )}

                {/* Step circle */}
                <button
                  onClick={() => handleStepClick(index)}
                  disabled={!step.isCompleted && !step.isActive}
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-all duration-300 transform ${
                    step.isCompleted
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg cursor-pointer'
                      : step.isActive
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg ring-4 ring-indigo-200/50 cursor-pointer animate-pulse'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {step.isActive && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 animate-ping opacity-30"></div>
                  )}
                  
                  {step.isCompleted ? (
                    <Check className="w-4 h-4 relative z-10" />
                  ) : (
                    <Circle className="w-3 h-3 fill-current relative z-10" />
                  )}
                </button>

                {/* Step title */}
                <div className={`text-center font-medium transition-colors duration-200 ${
                  step.isActive
                    ? 'text-white'
                    : step.isCompleted
                      ? 'text-white'
                      : 'text-white opacity-70'
                }`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                  <div className="text-xs font-semibold">{step.title}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Next button */}
          <button
            onClick={() => onStepClick && currentStep < totalSteps && onStepClick(currentStep)}
            disabled={currentStep >= totalSteps}
            className={`p-3 rounded-full transition-all duration-300 ${
              currentStep < totalSteps
                ? 'bg-white/20 hover:bg-white/30 text-white cursor-pointer hover:scale-110'
                : 'bg-gray-200/20 text-gray-400 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile layout with arrows */}
        <div className="md:hidden">
          <div className="flex justify-between items-center mb-6">
            {/* Previous button */}
            <button
              onClick={() => onStepClick && currentStep > 1 && onStepClick(currentStep - 2)}
              disabled={currentStep <= 1}
              className={`p-2 rounded-full transition-all duration-300 ${
                currentStep > 1
                  ? 'bg-white/20 hover:bg-white/30 text-white cursor-pointer'
                  : 'bg-gray-200/20 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Current step indicator */}
            <div className="flex items-center space-x-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    step.isCompleted
                      ? 'bg-green-500'
                      : step.isActive
                        ? 'bg-indigo-500 animate-pulse'
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Next button */}
            <button
              onClick={() => onStepClick && currentStep < totalSteps && onStepClick(currentStep)}
              disabled={currentStep >= totalSteps}
              className={`p-2 rounded-full transition-all duration-300 ${
                currentStep < totalSteps
                  ? 'bg-white/20 hover:bg-white/30 text-white cursor-pointer'
                  : 'bg-gray-200/20 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* Mobile step labels */}
          <div className="text-center">
            <div className="font-semibold text-white mb-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
              {steps[currentStep - 1]?.title || 'Loading...'}
            </div>
            <div className="text-sm text-white opacity-90" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
              {steps.filter(s => s.isCompleted).length} av {totalSteps} steg slutförda
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}