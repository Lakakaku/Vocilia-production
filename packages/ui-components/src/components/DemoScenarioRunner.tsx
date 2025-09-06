import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { Badge } from './Badge';
import { Modal } from './Modal';

// Demo scenario types
interface DemoStep {
  id: string;
  title: string;
  description: string;
  duration: number; // seconds
  component?: string;
  data?: any;
  userActions?: string[];
  expectedOutcome?: string;
}

interface DemoScenario {
  id: string;
  title: string;
  description: string;
  persona: 'customer' | 'business_owner' | 'admin' | 'system';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // minutes
  steps: DemoStep[];
  learningObjectives: string[];
}

// Pre-defined demo scenarios
const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'customer-happy-path',
    title: 'Customer Journey: Perfect Experience',
    description: 'Experience the complete customer journey from QR scan to reward payout',
    persona: 'customer',
    difficulty: 'beginner',
    estimatedTime: 8,
    learningObjectives: [
      'Understand the customer experience flow',
      'See how voice feedback is processed',
      'Learn about quality scoring and rewards'
    ],
    steps: [
      {
        id: 'qr-scan',
        title: 'QR Code Discovery',
        description: 'Customer notices QR code at Café Aurora Stockholm and scans it',
        duration: 30,
        component: 'QRScanSimulator',
        data: {
          business: 'Café Aurora Stockholm',
          location: 'Drottninggatan 123, Stockholm',
          qrCode: 'https://demo.aifeedback.se/qr/cafe-aurora-main'
        },
        userActions: ['Scan QR code with mobile camera', 'Allow camera permissions'],
        expectedOutcome: 'PWA opens in browser with transaction verification screen'
      },
      {
        id: 'transaction-verification',
        title: 'Purchase Verification',
        description: 'Customer enters their transaction details to verify recent purchase',
        duration: 45,
        component: 'TransactionVerifier',
        data: {
          transactionId: 'TXN-20241026-14:23:45',
          amount: 47.50,
          items: ['Cappuccino', 'Kanelbulle'],
          timestamp: '2024-10-26T14:23:45Z'
        },
        userActions: ['Enter transaction ID', 'Confirm purchase amount'],
        expectedOutcome: 'Transaction verified, voice feedback interface appears'
      },
      {
        id: 'voice-feedback',
        title: 'Voice Feedback Session',
        description: 'Customer provides detailed voice feedback about their experience',
        duration: 90,
        component: 'VoiceFeedbackRecorder',
        data: {
          businessContext: {
            name: 'Café Aurora Stockholm',
            specialties: ['artisan coffee', 'fresh pastries'],
            knownIssues: ['crowded mornings'],
            strengths: ['excellent coffee quality', 'friendly staff']
          },
          expectedTranscript: 'Jag älskar verkligen denna plats! Anna var så vänlig och kaffet smakade fantastiskt. Atmosfären är perfekt för att arbeta.',
          language: 'sv'
        },
        userActions: ['Tap microphone button', 'Speak for 30-60 seconds', 'Review transcript'],
        expectedOutcome: 'Voice processed, AI evaluation begins'
      },
      {
        id: 'ai-evaluation',
        title: 'AI Quality Assessment',
        description: 'AI evaluates feedback quality and calculates reward tier',
        duration: 15,
        component: 'AIEvaluationDisplay',
        data: {
          scores: {
            authenticity: 92,
            concreteness: 88,
            depth: 85,
            total: 89
          },
          reasoning: 'Feedback visar hög kvalitet med specifika detaljer om personal (Anna) och konkreta observationer om kaffe och atmosfär.',
          categories: ['service', 'food_quality', 'atmosphere'],
          rewardTier: 'excellent'
        },
        userActions: ['Review quality explanation', 'Understand scoring breakdown'],
        expectedOutcome: 'Quality score displayed, reward calculation shown'
      },
      {
        id: 'reward-payout',
        title: 'Instant Reward',
        description: 'Customer receives cashback reward based on feedback quality',
        duration: 20,
        component: 'RewardDisplay',
        data: {
          rewardAmount: 5.23, // SEK
          rewardPercentage: 11,
          qualityScore: 89,
          paymentMethod: 'Swish',
          estimatedArrival: '2-5 minutes'
        },
        userActions: ['Confirm Swish number', 'Wait for payment notification'],
        expectedOutcome: '5.23 SEK sent via Swish, feedback journey complete'
      }
    ]
  },
  {
    id: 'business-owner-insights',
    title: 'Business Owner: Daily Analytics Review',
    description: 'See how business owners use the platform to gain customer insights',
    persona: 'business_owner',
    difficulty: 'intermediate',
    estimatedTime: 12,
    learningObjectives: [
      'Navigate the business dashboard effectively',
      'Interpret customer feedback analytics',
      'Identify improvement opportunities',
      'Understand ROI metrics'
    ],
    steps: [
      {
        id: 'dashboard-login',
        title: 'Business Dashboard Access',
        description: 'Login to business dashboard and view daily summary',
        duration: 30,
        component: 'BusinessDashboard',
        data: {
          business: 'Café Aurora Stockholm',
          todayStats: {
            feedbacks: 23,
            averageScore: 76.4,
            rewards: 87.50,
            categories: ['service: 18', 'food_quality: 15', 'atmosphere: 12']
          }
        },
        userActions: ['Login with demo credentials', 'Review daily summary'],
        expectedOutcome: 'Dashboard loaded with current day analytics'
      },
      {
        id: 'feedback-analysis',
        title: 'Feedback Deep Dive',
        description: 'Analyze detailed feedback trends and customer insights',
        duration: 180,
        component: 'FeedbackAnalytics',
        data: {
          weeklyTrends: [
            { date: '2024-10-21', score: 74.2, sessions: 19 },
            { date: '2024-10-22', score: 78.1, sessions: 25 },
            { date: '2024-10-23', score: 76.8, sessions: 22 },
            { date: '2024-10-24', score: 81.3, sessions: 28 },
            { date: '2024-10-25', score: 79.4, sessions: 24 }
          ],
          topIssues: [
            'Långa köer på morgonen (8 mentions)',
            'Begränsat Wi-Fi (5 mentions)',
            'Kall mat vid take-away (4 mentions)'
          ],
          topPraises: [
            'Fantastisk kaffekvalitet (15 mentions)', 
            'Vänlig personal (12 mentions)',
            'Mysig atmosfär (9 mentions)'
          ]
        },
        userActions: ['Filter by date range', 'Review category breakdown', 'Read specific feedback'],
        expectedOutcome: 'Identified improvement opportunities and strengths'
      },
      {
        id: 'roi-calculator',
        title: 'ROI Analysis',
        description: 'Calculate return on investment from customer insights',
        duration: 90,
        component: 'ROICalculator',
        data: {
          monthlySpend: 2850, // SEK on rewards
          improvements: [
            { issue: 'Queue optimization', potential_increase: '8% customer satisfaction', cost: 'Staff scheduling adjustment' },
            { issue: 'Wi-Fi upgrade', potential_increase: '15% dwell time', cost: '500 SEK/month' },
            { issue: 'Food warming solution', potential_increase: '12% take-away satisfaction', cost: '200 SEK equipment' }
          ],
          projectedBenefit: 4200 // SEK monthly from improvements
        },
        userActions: ['Review improvement suggestions', 'Calculate cost-benefit'],
        expectedOutcome: 'Clear ROI justification: 1.47x return on feedback investment'
      }
    ]
  },
  {
    id: 'admin-fraud-detection',
    title: 'Admin: Fraud Detection in Action',
    description: 'Demonstrate advanced fraud detection and system monitoring',
    persona: 'admin',
    difficulty: 'advanced',
    estimatedTime: 15,
    learningObjectives: [
      'Understand fraud detection mechanisms',
      'Learn investigation workflows',
      'Monitor system health metrics',
      'Handle suspicious activity'
    ],
    steps: [
      {
        id: 'fraud-alert',
        title: 'Fraud Alert Detection',
        description: 'System detects suspicious feedback patterns and triggers alert',
        duration: 30,
        component: 'FraudAlert',
        data: {
          alertType: 'pattern_anomaly',
          business: 'Göteborg Kaffebröd',
          riskScore: 0.87,
          triggers: [
            'Generic feedback content',
            'Multiple sessions from same device fingerprint',
            'Unnaturally high quality scores',
            'Geographic inconsistency'
          ],
          affectedSessions: 12,
          estimatedFraudValue: 134.50
        },
        userActions: ['Review alert details', 'Check system notifications'],
        expectedOutcome: 'Fraud investigation workflow initiated'
      },
      {
        id: 'investigation',
        title: 'Fraud Investigation',
        description: 'Deep dive into suspicious sessions using admin tools',
        duration: 240,
        component: 'FraudInvestigation',
        data: {
          suspiciousSessions: [
            {
              id: 'session_001',
              transcript: 'Bra service generellt sett. Allt fungerade bra.',
              scores: { authenticity: 45, concreteness: 30, depth: 25 },
              deviceFingerprint: 'device_abc123',
              customerHash: 'cust_suspicious_1',
              riskFactors: ['generic_content', 'low_detail', 'device_reuse']
            }
          ],
          patternAnalysis: {
            deviceReuse: '8 sessions from same device',
            contentSimilarity: '89% similarity across sessions',
            timingPatterns: 'All sessions within 2-hour window'
          }
        },
        userActions: ['Analyze session details', 'Review device fingerprints', 'Check customer patterns'],
        expectedOutcome: 'Clear fraud evidence documented'
      },
      {
        id: 'fraud-action',
        title: 'Fraud Response',
        description: 'Take action on confirmed fraudulent activity',
        duration: 60,
        component: 'FraudResponse',
        data: {
          actions: [
            'Flag customer hash for review',
            'Reverse fraudulent rewards (134.50 SEK)',
            'Update fraud detection models',
            'Notify business of security measures'
          ],
          businessNotification: 'Fraud detected and prevented - no impact on your account',
          systemUpdates: 'ML models updated with new fraud patterns'
        },
        userActions: ['Execute fraud response', 'Send notifications', 'Update security measures'],
        expectedOutcome: 'Fraud mitigated, system strengthened, business protected'
      }
    ]
  },
  {
    id: 'system-performance',
    title: 'System Demo: Peak Performance',
    description: 'Showcase system handling high load and optimization features',
    persona: 'system',
    difficulty: 'advanced',
    estimatedTime: 10,
    learningObjectives: [
      'Understand system architecture resilience',
      'See performance optimization in action',
      'Learn about scalability features',
      'Monitor real-time metrics'
    ],
    steps: [
      {
        id: 'load-simulation',
        title: 'High Load Simulation',
        description: 'Simulate 1000 concurrent voice feedback sessions',
        duration: 30,
        component: 'LoadSimulator',
        data: {
          concurrentSessions: 1000,
          averageResponseTime: '1.8s',
          successRate: '99.7%',
          resourceUsage: {
            cpu: '76%',
            memory: '4.2GB',
            ollamaConnections: 50
          }
        },
        userActions: ['Monitor system metrics', 'Watch performance graphs'],
        expectedOutcome: 'System maintains performance under high load'
      },
      {
        id: 'optimization-showcase',
        title: 'AI Optimization Features',
        description: 'Demonstrate qwen2:0.5b model performance vs alternatives',
        duration: 120,
        component: 'AIOptimizationDemo',
        data: {
          modelComparison: {
            'qwen2:0.5b': { responseTime: '1.8s', accuracy: '94.2%', size: '350MB' },
            'llama3.2:1b': { responseTime: '3.4s', accuracy: '96.1%', size: '740MB' },
            'openai-gpt': { responseTime: '2.1s', accuracy: '97.3%', cost: '$0.002/request' }
          },
          optimizations: [
            'Connection pooling: 85% faster',
            'Response caching: 60% CPU reduction',
            'Model quantization: 70% memory savings'
          ]
        },
        userActions: ['Compare model performance', 'Review optimization impact'],
        expectedOutcome: 'Clear understanding of performance optimizations'
      },
      {
        id: 'scalability',
        title: 'Auto-scaling Demonstration',
        description: 'Show how system automatically scales to meet demand',
        duration: 90,
        component: 'ScalabilityDemo',
        data: {
          regions: ['Stockholm', 'Göteborg', 'Malmö'],
          autoScaling: {
            current_instances: 8,
            max_instances: 50,
            scaling_trigger: '80% CPU for 2 minutes',
            scale_up_time: '45 seconds'
          },
          geographic_distribution: {
            'Stockholm': 145,
            'Göteborg': 89,
            'Malmö': 72,
            'Other': 94
          }
        },
        userActions: ['Observe auto-scaling triggers', 'Monitor regional distribution'],
        expectedOutcome: 'System automatically adapts to demand patterns'
      }
    ]
  }
];

interface DemoScenarioRunnerProps {
  scenario?: DemoScenario;
  onComplete?: (scenarioId: string, results: any) => void;
  onExit?: () => void;
}

export const DemoScenarioRunner: React.FC<DemoScenarioRunnerProps> = ({
  scenario: initialScenario,
  onComplete,
  onExit
}) => {
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario | null>(initialScenario || null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [scenarioResults, setScenarioResults] = useState<any>({});

  const currentStep = selectedScenario?.steps[currentStepIndex];

  useEffect(() => {
    if (isRunning && currentStep) {
      const interval = setInterval(() => {
        setStepProgress(prev => {
          const newProgress = prev + (100 / currentStep.duration);
          if (newProgress >= 100) {
            clearInterval(interval);
            completeCurrentStep();
            return 100;
          }
          return newProgress;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isRunning, currentStep]);

  const startScenario = (scenario: DemoScenario) => {
    setSelectedScenario(scenario);
    setCurrentStepIndex(0);
    setIsRunning(true);
    setStepProgress(0);
    setCompletedSteps(new Set());
    setScenarioResults({});
  };

  const completeCurrentStep = () => {
    if (!currentStep || !selectedScenario) return;

    const newCompletedSteps = new Set(completedSteps);
    newCompletedSteps.add(currentStep.id);
    setCompletedSteps(newCompletedSteps);

    // Store step results
    const stepResult = {
      stepId: currentStep.id,
      completedAt: new Date().toISOString(),
      expectedOutcome: currentStep.expectedOutcome,
      data: currentStep.data
    };

    const newResults = {
      ...scenarioResults,
      [currentStep.id]: stepResult
    };
    setScenarioResults(newResults);

    // Move to next step or complete scenario
    if (currentStepIndex < selectedScenario.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setStepProgress(0);
    } else {
      // Scenario complete
      setIsRunning(false);
      onComplete?.(selectedScenario.id, {
        scenario: selectedScenario,
        completedAt: new Date().toISOString(),
        results: newResults,
        totalSteps: selectedScenario.steps.length
      });
    }
  };

  const resetScenario = () => {
    setSelectedScenario(null);
    setCurrentStepIndex(0);
    setIsRunning(false);
    setStepProgress(0);
    setCompletedSteps(new Set());
    setScenarioResults({});
  };

  if (!selectedScenario) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🎬 AI Feedback Platform Demo Scenarios
          </h1>
          <p className="text-lg text-gray-600">
            Experience the platform from different perspectives with realistic, guided scenarios.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DEMO_SCENARIOS.map((scenario) => (
            <Card key={scenario.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{scenario.title}</h3>
                  <p className="text-gray-600 mb-3">{scenario.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={
                    scenario.persona === 'customer' ? 'success' :
                    scenario.persona === 'business_owner' ? 'info' :
                    scenario.persona === 'admin' ? 'warning' : 'secondary'
                  }>
                    {scenario.persona.replace('_', ' ')}
                  </Badge>
                  <Badge variant={
                    scenario.difficulty === 'beginner' ? 'success' :
                    scenario.difficulty === 'intermediate' ? 'warning' : 'error'
                  }>
                    {scenario.difficulty}
                  </Badge>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                  <span>⏱️ {scenario.estimatedTime} minutes</span>
                  <span>📋 {scenario.steps.length} steps</span>
                </div>
                
                <div className="mb-3">
                  <h4 className="font-medium text-gray-700 mb-1">Learning Objectives:</h4>
                  <ul className="text-sm text-gray-600 list-disc list-inside">
                    {scenario.learningObjectives.slice(0, 2).map((objective, index) => (
                      <li key={index}>{objective}</li>
                    ))}
                    {scenario.learningObjectives.length > 2 && (
                      <li>+ {scenario.learningObjectives.length - 2} more...</li>
                    )}
                  </ul>
                </div>
              </div>

              <Button 
                onClick={() => startScenario(scenario)}
                className="w-full"
                variant="primary"
              >
                Start Demo Scenario 🚀
              </Button>
            </Card>
          ))}
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">💡 How to Use Demo Scenarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="font-medium mb-2">🎯 Choose Your Perspective</h3>
              <p className="text-sm text-gray-600">
                Select scenarios based on your role: Customer, Business Owner, or Admin.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">🎮 Interactive Experience</h3>
              <p className="text-sm text-gray-600">
                Each step shows realistic UI components and expected user actions.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">📊 Learn by Doing</h3>
              <p className="text-sm text-gray-600">
                See actual data, metrics, and outcomes for each scenario step.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Scenario Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{selectedScenario.title}</h1>
            <p className="text-gray-600">{selectedScenario.description}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={resetScenario} variant="outline" size="sm">
              ← Back to Scenarios
            </Button>
            {onExit && (
              <Button onClick={onExit} variant="outline" size="sm">
                Exit Demo
              </Button>
            )}
          </div>
        </div>

        {/* Progress Overview */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Step {currentStepIndex + 1} of {selectedScenario.steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {completedSteps.size}/{selectedScenario.steps.length} completed
            </span>
          </div>
          <ProgressBar 
            value={(completedSteps.size / selectedScenario.steps.length) * 100} 
            className="mb-2"
          />
          <div className="flex gap-1">
            {selectedScenario.steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 h-2 rounded ${
                  completedSteps.has(step.id) ? 'bg-green-500' :
                  index === currentStepIndex ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Current Step */}
      {currentStep && (
        <Card className="p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">{currentStep.title}</h2>
            <p className="text-gray-600 mb-4">{currentStep.description}</p>
            
            {/* Step Progress */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Step Progress</span>
                <span className="text-sm text-gray-500">
                  {Math.round(stepProgress)}% complete
                </span>
              </div>
              <ProgressBar value={stepProgress} />
            </div>
          </div>

          {/* Demo Component Placeholder */}
          <div className="bg-gray-50 p-6 rounded-lg mb-4">
            <div className="text-center">
              <div className="text-4xl mb-2">
                {currentStep.component === 'QRScanSimulator' ? '📱' :
                 currentStep.component === 'TransactionVerifier' ? '💳' :
                 currentStep.component === 'VoiceFeedbackRecorder' ? '🎙️' :
                 currentStep.component === 'AIEvaluationDisplay' ? '🤖' :
                 currentStep.component === 'RewardDisplay' ? '💰' :
                 currentStep.component === 'BusinessDashboard' ? '📊' :
                 currentStep.component === 'FraudAlert' ? '🚨' : '⚙️'}
              </div>
              <h3 className="font-semibold mb-2">{currentStep.component} Component</h3>
              <p className="text-sm text-gray-600 mb-4">
                Interactive demo component would render here in production
              </p>
              
              {/* Show step data */}
              {currentStep.data && (
                <div className="bg-white p-4 rounded border">
                  <h4 className="font-medium mb-2">Demo Data:</h4>
                  <pre className="text-xs text-left overflow-auto">
                    {JSON.stringify(currentStep.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* User Actions */}
          {currentStep.userActions && (
            <div className="mb-4">
              <h4 className="font-medium mb-2">Expected User Actions:</h4>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {currentStep.userActions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Expected Outcome */}
          {currentStep.expectedOutcome && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
              <h4 className="font-medium text-green-800 mb-1">Expected Outcome:</h4>
              <p className="text-sm text-green-700">{currentStep.expectedOutcome}</p>
            </div>
          )}

          {/* Step Controls */}
          <div className="flex justify-between items-center">
            <Button 
              onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              variant="outline"
              size="sm"
            >
              ← Previous Step
            </Button>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setIsRunning(!isRunning)}
                variant={isRunning ? "secondary" : "primary"}
              >
                {isRunning ? '⏸️ Pause' : '▶️ Resume'}
              </Button>
              
              <Button 
                onClick={completeCurrentStep}
                variant="success"
              >
                Complete Step ✓
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Completed Steps Summary */}
      {completedSteps.size > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Completed Steps ({completedSteps.size})</h3>
          <div className="space-y-2">
            {selectedScenario.steps.filter(step => completedSteps.has(step.id)).map(step => (
              <div key={step.id} className="flex items-center text-sm">
                <span className="text-green-500 mr-2">✅</span>
                <span className="font-medium mr-2">{step.title}</span>
                <span className="text-gray-500">- {step.expectedOutcome}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// Scenario selector component for embedding in other dashboards
export const DemoScenarioSelector: React.FC<{
  onScenarioSelect: (scenario: DemoScenario) => void;
  filter?: 'customer' | 'business_owner' | 'admin' | 'system';
}> = ({ onScenarioSelect, filter }) => {
  const filteredScenarios = filter 
    ? DEMO_SCENARIOS.filter(s => s.persona === filter)
    : DEMO_SCENARIOS;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredScenarios.map((scenario) => (
        <Card key={scenario.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onScenarioSelect(scenario)}>
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold">{scenario.title}</h3>
            <Badge variant="outline">{scenario.estimatedTime}m</Badge>
          </div>
          <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{scenario.steps.length} steps</span>
            <span>{scenario.difficulty}</span>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default DemoScenarioRunner;