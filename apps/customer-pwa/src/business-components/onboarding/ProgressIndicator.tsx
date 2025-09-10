'use client';

import React from 'react';
import { Check, Circle } from 'lucide-react';

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
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Steg {currentStep} av {totalSteps}
          </span>
          <span className="text-sm font-medium text-primary-600">
            {progressPercentage}% klart
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-primary-500 h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Step indicators */}
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center">
            {/* Step circle */}
            <button
              onClick={() => handleStepClick(index)}
              disabled={!step.isCompleted && !step.isActive}
              className={`relative w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-all duration-200 ${
                step.isCompleted
                  ? 'bg-green-500 text-white shadow-md hover:bg-green-600 cursor-pointer'
                  : step.isActive
                    ? 'bg-primary-500 text-white shadow-md ring-2 ring-primary-200 hover:bg-primary-600 cursor-pointer'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              } ${(step.isCompleted || step.isActive) ? 'hover:scale-105' : ''}`}
            >
              {step.isCompleted ? (
                <Check className="w-4 h-4" />
              ) : (
                <Circle className="w-3 h-3 fill-current" />
              )}
            </button>

            {/* Step title */}
            <div className={`text-xs text-center font-medium ${
              step.isActive
                ? 'text-primary-700'
                : step.isCompleted
                  ? 'text-green-700'
                  : 'text-gray-500'
            }`}>
              {step.title}
            </div>

            {/* Connector line (except for last step) */}
            {index < steps.length - 1 && (
              <div className={`absolute top-4 left-1/2 transform translate-x-4 w-full h-0.5 ${
                step.isCompleted ? 'bg-green-300' : 'bg-gray-200'
              } hidden sm:block`}></div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile connector lines */}
      <div className="sm:hidden mt-2">
        <div className="flex justify-center items-center space-x-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => handleStepClick(index)}
                disabled={!step.isCompleted && !step.isActive}
                className={`w-3 h-3 rounded-full transition-all ${
                  step.isCompleted
                    ? 'bg-green-500 hover:bg-green-600 cursor-pointer'
                    : step.isActive
                      ? 'bg-primary-500 hover:bg-primary-600 cursor-pointer'
                      : 'bg-gray-200 cursor-not-allowed'
                }`}
              ></button>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${
                  step.isCompleted ? 'bg-green-300' : 'bg-gray-200'
                }`}></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}