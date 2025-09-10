'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  Check, 
  Rocket,
  Building2, 
  Settings, 
  Target
} from 'lucide-react';

// Import step components
import { WelcomeStep } from './steps/WelcomeStep';
import { BusinessProfileStep } from './steps/BusinessProfileStep';
import { IntegrationAssessmentStep } from './steps/IntegrationAssessmentStep';
import { GoalsExpectationsStep } from './steps/GoalsExpectationsStep';
import { ProgressIndicator } from './ProgressIndicator';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isCompleted: boolean;
  isActive: boolean;
}

interface OnboardingData {
  // Step 2: Business Profile Data
  businessProfile: {
    business_type: string;
    store_count: number;
    geographic_coverage: 'single_city' | 'region' | 'national';
    avg_transaction_value_range: '50-100' | '100-500' | '500+';
    daily_customer_volume: number;
  };
  // Step 3: Integration Assessment Data
  integrationAssessment: {
    pos_system: 'square' | 'shopify' | 'zettle' | 'other' | 'none';
    tech_comfort_level: 'basic' | 'intermediate' | 'advanced';
    verification_method_preference: 'automatic' | 'simple';
  };
  // Step 4: Goals & Expectations Data
  goalsExpectations: {
    primary_goals: string[];
    improvement_areas: string[];
    expected_feedback_volume: number;
    staff_training_required: boolean;
  };
}

const INITIAL_DATA: OnboardingData = {
  businessProfile: {
    business_type: '',
    store_count: 1,
    geographic_coverage: 'single_city',
    avg_transaction_value_range: '100-500',
    daily_customer_volume: 50
  },
  integrationAssessment: {
    pos_system: 'other',
    tech_comfort_level: 'intermediate',
    verification_method_preference: 'simple'
  },
  goalsExpectations: {
    primary_goals: [],
    improvement_areas: [],
    expected_feedback_volume: 10,
    staff_training_required: false
  }
};

export function OnboardingWizard() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Load existing progress on mount
  useEffect(() => {
    loadExistingProgress();
  }, []);

  const loadExistingProgress = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/business/onboarding/status');
      if (response.ok) {
        const { progress } = await response.json();
        if (progress) {
          setCurrentStepIndex(progress.current_step - 1); // Convert to 0-based index
          
          // Load draft data if available
          if (progress.step_2_draft_data) {
            setData(prev => ({
              ...prev,
              businessProfile: { ...prev.businessProfile, ...progress.step_2_draft_data }
            }));
          }
          if (progress.step_3_draft_data) {
            setData(prev => ({
              ...prev,
              integrationAssessment: { ...prev.integrationAssessment, ...progress.step_3_draft_data }
            }));
          }
          if (progress.step_4_draft_data) {
            setData(prev => ({
              ...prev,
              goalsExpectations: { ...prev.goalsExpectations, ...progress.step_4_draft_data }
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProgress = async (step: number, stepData: any, completed: boolean = false) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/business/onboarding/save-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          stepData,
          completed,
          currentStep: step
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save progress');
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving progress:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Välkommen',
      description: 'Översikt & värdeproposition',
      icon: Rocket,
      isCompleted: currentStepIndex > 0,
      isActive: currentStepIndex === 0
    },
    {
      id: 2,
      title: 'Företagsprofil',
      description: 'Verksamhetsdetaljer',
      icon: Building2,
      isCompleted: isBusinessProfileComplete(),
      isActive: currentStepIndex === 1
    },
    {
      id: 3,
      title: 'Integration',
      description: 'Teknisk bedömning',
      icon: Settings,
      isCompleted: isIntegrationAssessmentComplete(),
      isActive: currentStepIndex === 2
    },
    {
      id: 4,
      title: 'Mål & förväntningar',
      description: 'Anpassning av systemet',
      icon: Target,
      isCompleted: isGoalsExpectationsComplete(),
      isActive: currentStepIndex === 3
    }
  ];

  function isBusinessProfileComplete(): boolean {
    const { businessProfile } = data;
    return !!(
      businessProfile.business_type && 
      businessProfile.store_count > 0 &&
      businessProfile.geographic_coverage &&
      businessProfile.avg_transaction_value_range &&
      businessProfile.daily_customer_volume > 0
    );
  }

  function isIntegrationAssessmentComplete(): boolean {
    const { integrationAssessment } = data;
    return !!(
      integrationAssessment.pos_system &&
      integrationAssessment.tech_comfort_level &&
      integrationAssessment.verification_method_preference
    );
  }

  function isGoalsExpectationsComplete(): boolean {
    const { goalsExpectations } = data;
    return !!(
      goalsExpectations.primary_goals.length > 0 &&
      goalsExpectations.improvement_areas.length > 0 &&
      goalsExpectations.expected_feedback_volume > 0
    );
  }

  const handleStepNavigation = async (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStepIndex(stepIndex);
    }
  };

  const handleNext = async (stepData?: any) => {
    try {
      // Save current step data if provided
      if (stepData && currentStepIndex > 0) {
        await saveProgress(currentStepIndex + 1, stepData, true);
      } else if (currentStepIndex === 0) {
        // Welcome step completed, mark as done
        await saveProgress(1, {}, true);
      }

      // Move to next step
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        await saveProgress(currentStepIndex + 2, {}, false); // Update current step
      }
    } catch (error) {
      console.error('Error proceeding to next step:', error);
      alert('Ett fel uppstod. Försök igen.');
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = async () => {
    if (!isGoalsExpectationsComplete()) return;
    
    setIsCompleting(true);
    
    try {
      // Save final step data
      await saveProgress(4, data.goalsExpectations, true);

      // Complete onboarding
      const response = await fetch('/api/business/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingData: data })
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      const result = await response.json();
      
      if (result.success) {
        // Use the redirect URL from the API response
        const redirectTo = result.redirectTo || '/business/dashboard?onboarding=completed';
        router.push(redirectTo);
      } else {
        throw new Error(result.error || 'Failed to complete onboarding');
      }
      
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      alert('Ett fel uppstod vid slutförandet. Försök igen.');
    } finally {
      setIsCompleting(false);
    }
  };

  const updateBusinessProfile = (profileData: typeof data.businessProfile) => {
    setData(prev => ({ ...prev, businessProfile: profileData }));
    // Auto-save draft
    saveProgress(2, profileData, false).catch(console.error);
  };

  const updateIntegrationAssessment = (assessmentData: typeof data.integrationAssessment) => {
    setData(prev => ({ ...prev, integrationAssessment: assessmentData }));
    // Auto-save draft
    saveProgress(3, assessmentData, false).catch(console.error);
  };

  const updateGoalsExpectations = (goalsData: typeof data.goalsExpectations) => {
    setData(prev => ({ ...prev, goalsExpectations: goalsData }));
    // Auto-save draft
    saveProgress(4, goalsData, false).catch(console.error);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Laddar din konfiguration...</h2>
          <p className="text-gray-600">Förbereder onboarding-guide</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Feedback Platform</h1>
              <p className="text-gray-600">Konfiguration av ditt företagskonto</p>
            </div>
            {isSaving && (
              <div className="flex items-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                Sparar...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <ProgressIndicator 
            steps={steps.map(step => ({
              id: step.id,
              title: step.title,
              isCompleted: step.isCompleted,
              isActive: step.isActive
            }))}
            currentStep={currentStepIndex + 1}
            totalSteps={steps.length}
            onStepClick={handleStepNavigation}
          />
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {currentStepIndex === 0 && (
            <WelcomeStep onNext={() => handleNext()} />
          )}
          
          {currentStepIndex === 1 && (
            <BusinessProfileStep
              data={data.businessProfile}
              onChange={updateBusinessProfile}
              onNext={() => handleNext(data.businessProfile)}
              onBack={handleBack}
            />
          )}
          
          {currentStepIndex === 2 && (
            <IntegrationAssessmentStep
              data={data.integrationAssessment}
              onChange={updateIntegrationAssessment}
              onNext={() => handleNext(data.integrationAssessment)}
              onBack={handleBack}
            />
          )}
          
          {currentStepIndex === 3 && (
            <GoalsExpectationsStep
              data={data.goalsExpectations}
              onChange={updateGoalsExpectations}
              onNext={handleComplete}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
      
      {/* Completion Loading Overlay */}
      {isCompleting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Slutför konfiguration...
            </h3>
            <p className="text-gray-600 text-sm">
              Skapar ditt anpassade system och genererar QR-koder
            </p>
          </div>
        </div>
      )}
    </div>
  );
}