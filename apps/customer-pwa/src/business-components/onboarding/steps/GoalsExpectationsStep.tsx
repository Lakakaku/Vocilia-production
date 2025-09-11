'use client';

import React, { useState } from 'react';
import { 
  Target, 
  TrendingUp, 
  Users, 
  GraduationCap,
  CheckCircle2,
  Star,
  MessageSquare,
  BarChart3,
  Clock,
  Award,
  Lightbulb,
  AlertTriangle
} from 'lucide-react';

interface GoalsExpectationsData {
  primary_goals: string[];
  improvement_areas: string[];
  expected_feedback_volume: number;
  staff_training_required: boolean;
}

interface GoalsExpectationsStepProps {
  data: GoalsExpectationsData;
  onChange: (data: GoalsExpectationsData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GoalsExpectationsStep({ data, onChange, onNext, onBack }: GoalsExpectationsStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const primaryGoalOptions = [
    {
      value: 'increase_revenue',
      label: 'Öka intäkter',
      description: 'Skapa en ny inkomstkälla genom kundfeedback-provision',
      icon: TrendingUp
    },
    {
      value: 'improve_service',
      label: 'Förbättra service',
      description: 'Få regelbunden feedback för att höja servicekvaliteten',
      icon: Star
    },
    {
      value: 'understand_customers',
      label: 'Förstå kunder bättre',
      description: 'Få djupare insikter om kundernas behov och preferenser',
      icon: MessageSquare
    },
    {
      value: 'track_performance',
      label: 'Spåra prestanda',
      description: 'Mät och följa utvecklingen av kundnöjdheten över tid',
      icon: BarChart3
    },
    {
      value: 'competitive_advantage',
      label: 'Konkurrensfördel',
      description: 'Differentiera genom AI-driven kundinsikt och belöningssystem',
      icon: Award
    },
    {
      value: 'staff_development',
      label: 'Personalutveckling',
      description: 'Identifiera utvecklingsområden för personal baserat på feedback',
      icon: Users
    }
  ];

  const improvementAreaOptions = [
    {
      value: 'customer_service',
      label: 'Kundservice',
      description: 'Bemötande, hjälpsamhet, och kundbemöt',
      icon: Users
    },
    {
      value: 'product_quality',
      label: 'Produktkvalitet',
      description: 'Kvalitet, urval, och tillgänglighet av produkter',
      icon: Star
    },
    {
      value: 'store_environment',
      label: 'Butiksmiljö',
      description: 'Renlighet, ordning, och atmosfär i butiken',
      icon: Lightbulb
    },
    {
      value: 'checkout_experience',
      label: 'Kassaupplevelse',
      description: 'Kötider, betalningsprocess, och kassafunktioner',
      icon: Clock
    },
    {
      value: 'pricing_value',
      label: 'Prissättning',
      description: 'Prisuppfattning och värde för pengarna',
      icon: TrendingUp
    },
    {
      value: 'store_layout',
      label: 'Butikslayout',
      description: 'Navigation, skyltning, och produktplacering',
      icon: BarChart3
    }
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.primary_goals || data.primary_goals.length === 0) {
      newErrors.primary_goals = 'Välj minst ett huvudsakligt mål';
    }

    if (!data.improvement_areas || data.improvement_areas.length === 0) {
      newErrors.improvement_areas = 'Välj minst ett förbättringsområde';
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext();
    }
  };

  const updateData = (field: keyof GoalsExpectationsData, value: any) => {
    onChange({
      ...data,
      [field]: value
    });
    
    // Clear error when user makes changes
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const toggleGoal = (goalValue: string) => {
    const currentGoals = data.primary_goals || [];
    const newGoals = currentGoals.includes(goalValue)
      ? currentGoals.filter(g => g !== goalValue)
      : [...currentGoals, goalValue];
    
    updateData('primary_goals', newGoals);
  };

  const toggleImprovementArea = (areaValue: string) => {
    const currentAreas = data.improvement_areas || [];
    const newAreas = currentAreas.includes(areaValue)
      ? currentAreas.filter(a => a !== areaValue)
      : [...currentAreas, areaValue];
    
    updateData('improvement_areas', newAreas);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-4">
          <Target className="w-6 h-6 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Mål & förväntningar
        </h2>
        <p className="text-gray-600">
          Berätta om dina mål så vi kan anpassa systemet för att ge dig bästa möjliga resultat
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="space-y-8">
          {/* Primary Goals */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Huvudsakliga mål *
            </h3>
            <p className="text-gray-600 mb-4">
              Vad vill du uppnå med AI Feedback Platform? (Välj alla som stämmer)
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {primaryGoalOptions.map(goal => {
                const Icon = goal.icon;
                const isSelected = data.primary_goals?.includes(goal.value) || false;
                
                return (
                  <label 
                    key={goal.value}
                    className={`relative flex items-start p-6 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleGoal(goal.value)}
                      className="sr-only"
                    />
                    
                    <Icon className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                      isSelected ? 'text-primary-600' : 'text-gray-400'
                    }`} />
                    
                    <div className="flex-1">
                      <div className={`font-medium mb-1 ${
                        isSelected ? 'text-primary-900' : 'text-gray-900'
                      }`}>
                        {goal.label}
                      </div>
                      <p className="text-gray-600 text-sm">
                        {goal.description}
                      </p>
                    </div>
                    
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-primary-600 ml-2" />
                    )}
                  </label>
                );
              })}
            </div>
            {errors.primary_goals && (
              <p className="mt-2 text-sm text-red-600">{errors.primary_goals}</p>
            )}
          </div>

          {/* Improvement Areas */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Förbättringsområden *
            </h3>
            <p className="text-gray-600 mb-4">
              Vilka områden vill du fokusera på att förbättra? (Välj alla som är relevanta)
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {improvementAreaOptions.map(area => {
                const Icon = area.icon;
                const isSelected = data.improvement_areas?.includes(area.value) || false;
                
                return (
                  <label 
                    key={area.value}
                    className={`relative flex items-start p-6 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleImprovementArea(area.value)}
                      className="sr-only"
                    />
                    
                    <Icon className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                      isSelected ? 'text-primary-600' : 'text-gray-400'
                    }`} />
                    
                    <div className="flex-1">
                      <div className={`font-medium mb-1 ${
                        isSelected ? 'text-primary-900' : 'text-gray-900'
                      }`}>
                        {area.label}
                      </div>
                      <p className="text-gray-600 text-sm">
                        {area.description}
                      </p>
                    </div>
                    
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-primary-600 ml-2" />
                    )}
                  </label>
                );
              })}
            </div>
            {errors.improvement_areas && (
              <p className="mt-2 text-sm text-red-600">{errors.improvement_areas}</p>
            )}
          </div>


          {/* Staff Training */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <GraduationCap className="w-5 h-5 mr-2" />
              Personalutbildning
            </h3>
            <p className="text-gray-600 mb-4">
              Vill du att vi tillhandahåller utbildningsmaterial för din personal?
            </p>
            
            <div className="space-y-4">
              <label className="flex items-start gap-4 p-6 rounded-lg border border-gray-200 cursor-pointer hover:border-primary-200 transition-colors">
                <input
                  type="checkbox"
                  checked={data.staff_training_required}
                  onChange={(e) => updateData('staff_training_required', e.target.checked)}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-1">
                    Ja, jag vill ha personalutbildning
                  </div>
                  <p className="text-gray-600 text-sm">
                    Vi skickar utbildningsmaterial om hur systemet fungerar, hur personal kan uppmuntra 
                    kunder att lämna feedback, och hur man hanterar frågor om belöningssystemet.
                  </p>
                </div>
              </label>
              
              {data.staff_training_required && (
                <div className="ml-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">
                    Utbildningsmaterial inkluderar:
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Systemöversikt och hur feedback-processen fungerar
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Tips för att uppmuntra kunder att delta
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Vanliga frågor och svar om belöningssystemet
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Felsökning av vanliga tekniska problem
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Setup Summary */}
          {data.primary_goals?.length > 0 && data.improvement_areas?.length > 0 && (
            <div className="bg-primary-50 rounded-lg p-6 border border-primary-200">
              <h4 className="font-medium text-primary-900 mb-3 flex items-center">
                <Award className="w-5 h-5 mr-2" />
                Din anpassade konfiguration
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-primary-800 mb-2">Valda mål:</div>
                  <ul className="space-y-1 text-primary-700">
                    {data.primary_goals.map(goalValue => {
                      const goal = primaryGoalOptions.find(g => g.value === goalValue);
                      return goal ? (
                        <li key={goalValue} className="flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-2" />
                          {goal.label}
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
                
                <div>
                  <div className="font-medium text-primary-800 mb-2">Förbättringsområden:</div>
                  <ul className="space-y-1 text-primary-700">
                    {data.improvement_areas.map(areaValue => {
                      const area = improvementAreaOptions.find(a => a.value === areaValue);
                      return area ? (
                        <li key={areaValue} className="flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-2" />
                          {area.label}
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-primary-200">
                <p className="text-primary-800 text-sm">
                  <strong>AI-systemet kommer att anpassas</strong> för att fokusera på dessa områden 
                  och ge dig relevanta insikter baserat på dina mål.
                </p>
              </div>
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
            Slutför konfiguration
          </button>
        </div>
      </div>
    </div>
  );
}