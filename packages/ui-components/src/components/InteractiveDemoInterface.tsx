import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Badge } from './Badge';
import { Modal } from './Modal';
import { Switch } from './Switch';
import { ProgressBar } from './ProgressBar';

// Tour step interface
interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector for element to highlight
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'hover' | 'type' | 'wait';
  duration?: number; // seconds to wait
  content?: React.ReactNode;
  skipable?: boolean;
}

// Guided tour definitions
const GUIDED_TOURS = {
  'customer-pwa': {
    id: 'customer-pwa',
    title: 'Customer Mobile Experience',
    description: 'Learn how customers use the mobile PWA to provide feedback',
    steps: [
      {
        id: 'qr-scan-intro',
        title: 'QR Code Scanning',
        description: 'Customers start by scanning QR codes placed at business locations',
        target: '[data-tour="qr-scanner"]',
        position: 'bottom',
        content: (
          <div>
            <p className="mb-2">The QR scanner automatically detects business QR codes and validates them in real-time.</p>
            <ul className="text-sm list-disc list-inside">
              <li>No app download required</li>
              <li>Works on all modern mobile browsers</li>
              <li>Secure token-based validation</li>
            </ul>
          </div>
        )
      },
      {
        id: 'transaction-verify',
        title: 'Transaction Verification',
        description: 'Customers verify their recent purchase to prevent fraud',
        target: '[data-tour="transaction-form"]',
        position: 'top',
        action: 'click',
        content: (
          <div>
            <p className="mb-2">Anti-fraud measure requiring customers to prove they made a purchase.</p>
            <div className="bg-green-50 p-3 rounded text-sm">
              <strong>Try entering:</strong> Transaction ID "TXN-123" and amount "47.50"
            </div>
          </div>
        )
      },
      {
        id: 'voice-recording',
        title: 'Voice Feedback',
        description: 'The core feature - natural voice feedback recording',
        target: '[data-tour="voice-recorder"]',
        position: 'right',
        action: 'click',
        duration: 5,
        content: (
          <div>
            <p className="mb-2">Customers speak naturally about their experience. The AI processes:</p>
            <ul className="text-sm list-disc list-inside">
              <li>Swedish voice-to-text (WhisperX)</li>
              <li>Quality scoring (authenticity, concreteness, depth)</li>
              <li>Sentiment analysis</li>
              <li>Fraud detection</li>
            </ul>
          </div>
        )
      },
      {
        id: 'results-display',
        title: 'Quality Results',
        description: 'Transparent display of AI evaluation and reward calculation',
        target: '[data-tour="results"]',
        position: 'left',
        content: (
          <div>
            <p className="mb-2">Customers see exactly how their feedback was evaluated:</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Authenticity:</span><span className="font-mono">92%</span></div>
              <div className="flex justify-between"><span>Concreteness:</span><span className="font-mono">88%</span></div>
              <div className="flex justify-between"><span>Depth:</span><span className="font-mono">85%</span></div>
              <div className="flex justify-between font-bold"><span>Total:</span><span className="font-mono">89%</span></div>
            </div>
          </div>
        )
      },
      {
        id: 'reward-payout',
        title: 'Instant Reward',
        description: 'Immediate cashback via Swish or other payment methods',
        target: '[data-tour="reward-display"]',
        position: 'top',
        content: (
          <div>
            <p className="mb-2">Quality feedback = instant rewards. This session earned:</p>
            <div className="bg-green-100 p-3 rounded text-center">
              <div className="text-2xl font-bold text-green-700">5.23 SEK</div>
              <div className="text-sm text-green-600">11% of purchase amount</div>
            </div>
          </div>
        )
      }
    ]
  },
  'business-dashboard': {
    id: 'business-dashboard',
    title: 'Business Owner Dashboard',
    description: 'Explore how businesses gain insights from customer feedback',
    steps: [
      {
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        description: 'Key metrics at a glance for business decision making',
        target: '[data-tour="stats-overview"]',
        position: 'bottom',
        content: (
          <div>
            <p className="mb-2">Today\'s performance snapshot:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-blue-50 p-2 rounded"><strong>23</strong> feedbacks</div>
              <div className="bg-green-50 p-2 rounded"><strong>76.4</strong> avg score</div>
              <div className="bg-yellow-50 p-2 rounded"><strong>87.50 SEK</strong> rewards</div>
              <div className="bg-purple-50 p-2 rounded"><strong>3</strong> categories</div>
            </div>
          </div>
        )
      },
      {
        id: 'feedback-analysis',
        title: 'Feedback Deep Dive',
        description: 'Analyze customer insights and identify improvement opportunities',
        target: '[data-tour="feedback-list"]',
        position: 'right',
        action: 'click',
        content: (
          <div>
            <p className="mb-2">Each feedback provides actionable insights:</p>
            <ul className="text-sm list-disc list-inside">
              <li>Categorized by topic (service, food, atmosphere)</li>
              <li>Sentiment analysis (positive/negative/neutral)</li>
              <li>Specific mentions of staff, items, issues</li>
              <li>Improvement suggestions</li>
            </ul>
          </div>
        )
      },
      {
        id: 'analytics-charts',
        title: 'Trend Analytics',
        description: 'Track performance over time and identify patterns',
        target: '[data-tour="analytics-charts"]',
        position: 'left',
        content: (
          <div>
            <p className="mb-2">Visual analytics help spot trends:</p>
            <div className="space-y-2 text-sm">
              <div>📈 <strong>Quality trends</strong> over time</div>
              <div>📊 <strong>Category breakdown</strong> analysis</div>
              <div>💰 <strong>ROI tracking</strong> for improvements</div>
              <div>🎯 <strong>Goal setting</strong> and monitoring</div>
            </div>
          </div>
        )
      },
      {
        id: 'roi-calculator',
        title: 'ROI Analysis',
        description: 'Calculate return on investment from customer insights',
        target: '[data-tour="roi-calculator"]',
        position: 'top',
        content: (
          <div>
            <p className="mb-2">Prove the value of feedback investment:</p>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-lg font-bold text-green-700">1.47x ROI</div>
              <div className="text-sm text-green-600">Every 100 SEK spent on rewards generates 147 SEK in business value</div>
            </div>
          </div>
        )
      }
    ]
  },
  'admin-panel': {
    id: 'admin-panel',
    title: 'Admin System Management',
    description: 'Discover advanced admin features for platform management',
    steps: [
      {
        id: 'system-metrics',
        title: 'System Health',
        description: 'Monitor platform performance and resource usage',
        target: '[data-tour="system-metrics"]',
        position: 'bottom',
        content: (
          <div>
            <p className="mb-2">Real-time system monitoring:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>🖥️ <strong>CPU:</strong> 76% usage</div>
              <div>💾 <strong>Memory:</strong> 4.2GB</div>
              <div>🤖 <strong>AI Model:</strong> qwen2:0.5b</div>
              <div>⚡ <strong>Response:</strong> 1.8s avg</div>
            </div>
          </div>
        )
      },
      {
        id: 'fraud-monitoring',
        title: 'Fraud Detection',
        description: 'Advanced fraud prevention and investigation tools',
        target: '[data-tour="fraud-alerts"]',
        position: 'right',
        action: 'hover',
        content: (
          <div>
            <p className="mb-2">Multi-layered fraud protection:</p>
            <ul className="text-sm list-disc list-inside">
              <li>Device fingerprinting</li>
              <li>Content analysis (authenticity scoring)</li>
              <li>Pattern recognition</li>
              <li>Geographic validation</li>
            </ul>
            <div className="mt-2 text-xs text-red-600">Current fraud rate: 0.3% (industry average: 2-5%)</div>
          </div>
        )
      },
      {
        id: 'business-approvals',
        title: 'Business Management',
        description: 'Approve new businesses and manage platform access',
        target: '[data-tour="business-approvals"]',
        position: 'left',
        content: (
          <div>
            <p className="mb-2">Streamlined business onboarding:</p>
            <div className="space-y-1 text-sm">
              <div>✅ Automatic org number validation</div>
              <div>✅ Stripe Connect integration</div>
              <div>✅ POS system verification</div>
              <div>✅ Compliance checking</div>
            </div>
          </div>
        )
      },
      {
        id: 'live-monitoring',
        title: 'Live Session Monitoring',
        description: 'Real-time view of active feedback sessions',
        target: '[data-tour="live-sessions"]',
        position: 'top',
        content: (
          <div>
            <p className="mb-2">Monitor sessions in real-time:</p>
            <div className="bg-blue-50 p-3 rounded text-sm">
              <div><strong>145 active sessions</strong> across Sweden</div>
              <div>Stockholm: 67 | Göteborg: 34 | Malmö: 23 | Other: 21</div>
            </div>
          </div>
        )
      }
    ]
  }
};

// Demo mode configuration
interface DemoConfig {
  enabled: boolean;
  autoReset: boolean;
  resetInterval: number; // minutes
  showMetrics: boolean;
  simulateLatency: boolean;
  dataMode: 'live' | 'demo' | 'mixed';
}

interface InteractiveDemoInterfaceProps {
  children: React.ReactNode;
  tourId?: keyof typeof GUIDED_TOURS;
  demoConfig?: Partial<DemoConfig>;
  onDemoModeChange?: (enabled: boolean) => void;
  onTourComplete?: (tourId: string) => void;
  onDataReset?: () => void;
}

export const InteractiveDemoInterface: React.FC<InteractiveDemoInterfaceProps> = ({
  children,
  tourId = 'customer-pwa',
  demoConfig = {},
  onDemoModeChange,
  onTourComplete,
  onDataReset
}) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourProgress, setTourProgress] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [tourTooltipPosition, setTourTooltipPosition] = useState({ 
    top: 0, 
    left: 0, 
    actualPosition: 'bottom' as 'top' | 'bottom' | 'left' | 'right'
  });
  const [demoMetrics, setDemoMetrics] = useState({
    sessionsCompleted: 0,
    toursStarted: 0,
    resetCount: 0,
    totalTimeSpent: 0
  });

  const config: DemoConfig = {
    enabled: false,
    autoReset: false,
    resetInterval: 30,
    showMetrics: true,
    simulateLatency: true,
    dataMode: 'demo',
    ...demoConfig
  };

  const intervalRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    if (isDemoMode && config.autoReset) {
      intervalRef.current = setInterval(() => {
        handleDataReset();
      }, config.resetInterval * 60 * 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isDemoMode, config.autoReset, config.resetInterval]);

  useEffect(() => {
    if (isDemoMode) {
      startTimeRef.current = Date.now();
    } else if (startTimeRef.current) {
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      setDemoMetrics(prev => ({
        ...prev,
        totalTimeSpent: prev.totalTimeSpent + timeSpent
      }));
    }
  }, [isDemoMode]);

  // Handle window resize to reposition tooltip
  useEffect(() => {
    const handleResize = () => {
      if (activeTour && highlightedElement) {
        // Recalculate tooltip position after resize
        const tour = GUIDED_TOURS[activeTour as keyof typeof GUIDED_TOURS];
        const step = tour.steps[currentTourStep];
        if (step) {
          const optimalPosition = calculateOptimalTooltipPosition(highlightedElement, step.position);
          setTourTooltipPosition({ 
            top: optimalPosition.top, 
            left: optimalPosition.left,
            actualPosition: optimalPosition.position
          });
        }
      }
    };

    // Add resize listener with debounce
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    window.addEventListener('orientationchange', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('orientationchange', debouncedResize);
      clearTimeout(resizeTimeout);
    };
  }, [activeTour, highlightedElement, currentTourStep]);

  const toggleDemoMode = () => {
    const newMode = !isDemoMode;
    setIsDemoMode(newMode);
    onDemoModeChange?.(newMode);
    
    if (newMode) {
      // Reset any active tour when entering demo mode
      setActiveTour(null);
      setCurrentTourStep(0);
    }
  };

  const startTour = (tourKey: string) => {
    if (!GUIDED_TOURS[tourKey as keyof typeof GUIDED_TOURS]) return;
    
    setActiveTour(tourKey);
    setCurrentTourStep(0);
    setTourProgress(0);
    setShowTourModal(true);
    setDemoMetrics(prev => ({ ...prev, toursStarted: prev.toursStarted + 1 }));
    
    // Highlight first element
    setTimeout(() => highlightTourElement(0), 500);
  };

  const calculateOptimalTooltipPosition = (
    element: HTMLElement, 
    preferredPosition: 'top' | 'bottom' | 'left' | 'right',
    tooltipWidth: number = 320,  // Default tooltip width
    tooltipHeight: number = 200  // Estimated tooltip height
  ) => {
    // Adjust dimensions for mobile devices
    const isMobile = window.innerWidth < 768;
    const adjustedTooltipWidth = isMobile ? Math.min(tooltipWidth, window.innerWidth - 32) : tooltipWidth;
    const adjustedTooltipHeight = isMobile ? Math.min(tooltipHeight, window.innerHeight * 0.6) : tooltipHeight;
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Add some padding from viewport edges (more on mobile)
    const padding = isMobile ? 8 : 16;
    
    // On mobile, prefer top/bottom positions for better usability
    const mobilePreferredOrder = ['bottom', 'top', 'left', 'right'];
    
    // Calculate positions for each direction
    const positions = {
      top: {
        top: rect.top + scrollTop - adjustedTooltipHeight - 12,
        left: rect.left + scrollLeft + rect.width / 2 - adjustedTooltipWidth / 2,
        position: 'top' as const
      },
      bottom: {
        top: rect.bottom + scrollTop + 12,
        left: rect.left + scrollLeft + rect.width / 2 - adjustedTooltipWidth / 2,
        position: 'bottom' as const
      },
      left: {
        top: rect.top + scrollTop + rect.height / 2 - adjustedTooltipHeight / 2,
        left: rect.left + scrollLeft - adjustedTooltipWidth - 12,
        position: 'left' as const
      },
      right: {
        top: rect.top + scrollTop + rect.height / 2 - adjustedTooltipHeight / 2,
        left: rect.right + scrollLeft + 12,
        position: 'right' as const
      }
    };
    
    // Check if preferred position fits within viewport
    const checkPosition = (pos: typeof positions.top) => {
      return (
        pos.top >= scrollTop + padding &&
        pos.top + adjustedTooltipHeight <= scrollTop + viewportHeight - padding &&
        pos.left >= scrollLeft + padding &&
        pos.left + adjustedTooltipWidth <= scrollLeft + viewportWidth - padding
      );
    };
    
    // On mobile, prioritize positions that work better for touch
    let currentPreferredPosition = preferredPosition;
    if (isMobile) {
      // On mobile, if trying to use left/right, prefer bottom/top instead
      if (preferredPosition === 'left' || preferredPosition === 'right') {
        currentPreferredPosition = 'bottom';
      }
    }
    
    // Try preferred position first
    if (checkPosition(positions[currentPreferredPosition])) {
      return positions[currentPreferredPosition];
    }
    
    // Try other positions in order of preference
    const fallbackOrder = isMobile ? {
      top: ['bottom', 'top', 'right', 'left'],
      bottom: ['bottom', 'top', 'right', 'left'],
      left: ['bottom', 'top', 'right', 'left'],
      right: ['bottom', 'top', 'right', 'left']
    } : {
      top: ['bottom', 'right', 'left'],
      bottom: ['top', 'right', 'left'],
      left: ['right', 'bottom', 'top'],
      right: ['left', 'bottom', 'top']
    };
    
    for (const fallback of fallbackOrder[currentPreferredPosition]) {
      if (checkPosition(positions[fallback as keyof typeof positions])) {
        return positions[fallback as keyof typeof positions];
      }
    }
    
    // If no position fits perfectly, use the preferred position but adjust it to stay in viewport
    let adjustedPosition = { ...positions[currentPreferredPosition] };
    
    // Adjust horizontal position
    if (adjustedPosition.left < scrollLeft + padding) {
      adjustedPosition.left = scrollLeft + padding;
    } else if (adjustedPosition.left + adjustedTooltipWidth > scrollLeft + viewportWidth - padding) {
      adjustedPosition.left = scrollLeft + viewportWidth - adjustedTooltipWidth - padding;
    }
    
    // Adjust vertical position
    if (adjustedPosition.top < scrollTop + padding) {
      adjustedPosition.top = scrollTop + padding;
    } else if (adjustedPosition.top + adjustedTooltipHeight > scrollTop + viewportHeight - padding) {
      adjustedPosition.top = scrollTop + viewportHeight - adjustedTooltipHeight - padding;
    }
    
    return adjustedPosition;
  };

  const highlightTourElement = (stepIndex: number) => {
    if (!activeTour) return;
    
    const tour = GUIDED_TOURS[activeTour as keyof typeof GUIDED_TOURS];
    const step = tour.steps[stepIndex];
    if (!step) return;

    const element = document.querySelector(step.target) as HTMLElement;
    if (!element) {
      console.warn(`Tour element not found: ${step.target}`);
      return;
    }

    setHighlightedElement(element);
    
    // Calculate optimal tooltip position with viewport boundary checking
    const optimalPosition = calculateOptimalTooltipPosition(element, step.position);
    setTourTooltipPosition({ 
      top: optimalPosition.top, 
      left: optimalPosition.left,
      actualPosition: optimalPosition.position // Store actual position for arrow placement
    });

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Add highlight styles
    element.style.position = 'relative';
    element.style.zIndex = '9999';
    element.style.boxShadow = '0 0 0 4px #3b82f6, 0 0 0 8px rgba(59, 130, 246, 0.2)';
    element.style.borderRadius = '4px';
    element.style.transition = 'all 0.3s ease';
  };

  const removeHighlight = () => {
    if (highlightedElement) {
      highlightedElement.style.boxShadow = '';
      highlightedElement.style.zIndex = '';
      highlightedElement.style.borderRadius = '';
      setHighlightedElement(null);
    }
  };

  const nextTourStep = () => {
    if (!activeTour) return;
    
    const tour = GUIDED_TOURS[activeTour as keyof typeof GUIDED_TOURS];
    const nextStep = currentTourStep + 1;
    
    removeHighlight();
    
    if (nextStep >= tour.steps.length) {
      // Tour complete
      completeTour();
      return;
    }
    
    setCurrentTourStep(nextStep);
    setTourProgress((nextStep / tour.steps.length) * 100);
    
    setTimeout(() => highlightTourElement(nextStep), 300);
  };

  const previousTourStep = () => {
    if (currentTourStep <= 0) return;
    
    const prevStep = currentTourStep - 1;
    removeHighlight();
    
    setCurrentTourStep(prevStep);
    setTourProgress((prevStep / GUIDED_TOURS[activeTour as keyof typeof GUIDED_TOURS].steps.length) * 100);
    
    setTimeout(() => highlightTourElement(prevStep), 300);
  };

  const completeTour = () => {
    removeHighlight();
    setActiveTour(null);
    setCurrentTourStep(0);
    setTourProgress(0);
    setShowTourModal(false);
    
    if (activeTour) {
      onTourComplete?.(activeTour);
      setDemoMetrics(prev => ({ ...prev, sessionsCompleted: prev.sessionsCompleted + 1 }));
    }
  };

  const skipTour = () => {
    removeHighlight();
    setActiveTour(null);
    setCurrentTourStep(0);
    setTourProgress(0);
    setShowTourModal(false);
  };

  const handleDataReset = () => {
    onDataReset?.();
    setDemoMetrics(prev => ({ ...prev, resetCount: prev.resetCount + 1 }));
    
    // Show reset notification
    if (window.confirm('Demo data has been reset. All test data and progress have been cleared.')) {
      // Reset completed
    }
  };

  const currentTour = activeTour ? GUIDED_TOURS[activeTour as keyof typeof GUIDED_TOURS] : null;
  const currentStep = currentTour?.steps[currentTourStep];

  return (
    <div className="relative">
      {/* Demo Control Panel */}
      {isDemoMode && (
        <div className="fixed top-4 right-4 z-50">
          <Card className="p-4 bg-white shadow-lg border-2 border-blue-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-blue-700">🎬 Demo Mode</h3>
              <Switch 
                checked={isDemoMode}
                onChange={toggleDemoMode}
                size="sm"
              />
            </div>
            
            <div className="space-y-3">
              {/* Tour Selection */}
              <div>
                <label className="block text-xs font-medium mb-1">Guided Tours</label>
                <div className="space-y-1">
                  {Object.values(GUIDED_TOURS).map((tour) => (
                    <Button
                      key={tour.id}
                      onClick={() => startTour(tour.id)}
                      disabled={activeTour !== null}
                      size="sm"
                      variant="outline"
                      className="w-full text-left justify-start"
                    >
                      {tour.title}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Demo Controls */}
              <div className="border-t pt-3">
                <div className="flex gap-2">
                  <Button
                    onClick={handleDataReset}
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                  >
                    🔄 Reset Data
                  </Button>
                </div>
              </div>

              {/* Demo Metrics */}
              {config.showMetrics && (
                <div className="border-t pt-3">
                  <h4 className="text-xs font-medium mb-2">Session Metrics</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Tours: {demoMetrics.toursStarted}</div>
                    <div>Completed: {demoMetrics.sessionsCompleted}</div>
                    <div>Resets: {demoMetrics.resetCount}</div>
                    <div>Time: {Math.round(demoMetrics.totalTimeSpent / 60)}m</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Demo Toggle Button (when not in demo mode) */}
      {!isDemoMode && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={toggleDemoMode}
            variant="primary"
            size="lg"
            className="rounded-full shadow-lg"
          >
            🎬 Demo Mode
          </Button>
        </div>
      )}

      {/* Tour Tooltip */}
      {activeTour && currentStep && (
        <div
          className="fixed z-50 bg-white border-2 border-blue-500 rounded-lg shadow-xl p-4 max-w-sm animate-fadeIn"
          style={{
            top: tourTooltipPosition.top,
            left: tourTooltipPosition.left,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-sm">{currentStep.title}</h4>
              <Badge variant="outline" size="sm">
                {currentTourStep + 1}/{currentTour?.steps.length}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-2">{currentStep.description}</p>
            
            {/* Step Content */}
            {currentStep.content && (
              <div className="bg-gray-50 p-3 rounded text-sm mb-3">
                {currentStep.content}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button
              onClick={previousTourStep}
              disabled={currentTourStep === 0}
              size="sm"
              variant="outline"
            >
              ← Previous
            </Button>
            
            <div className="flex gap-1">
              {currentStep.skipable !== false && (
                <Button onClick={skipTour} size="sm" variant="ghost">
                  Skip Tour
                </Button>
              )}
              
              <Button
                onClick={nextTourStep}
                size="sm"
                variant="primary"
              >
                {currentTourStep === (currentTour?.steps.length || 1) - 1 ? 'Finish' : 'Next →'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tour Progress Modal */}
      {showTourModal && currentTour && (
        <Modal
          isOpen={showTourModal}
          onClose={() => setShowTourModal(false)}
          title={`${currentTour.title} - Interactive Tour`}
          size="lg"
        >
          <div className="p-6">
            <div className="mb-4">
              <p className="text-gray-600 mb-3">{currentTour.description}</p>
              <ProgressBar value={tourProgress} className="mb-2" />
              <div className="text-sm text-gray-500">
                Step {currentTourStep + 1} of {currentTour.steps.length}
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-2">Current Step: {currentStep?.title}</h4>
              <p className="text-sm">{currentStep?.description}</p>
              
              {currentStep?.action && (
                <div className="mt-2 text-xs text-blue-600">
                  💡 Try to {currentStep.action} the highlighted element
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button onClick={skipTour} variant="outline">
                Exit Tour
              </Button>
              <Button onClick={() => setShowTourModal(false)} variant="primary">
                Continue Tour
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Demo Mode Overlay */}
      {isDemoMode && (
        <div className="fixed top-0 left-0 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 z-40">
          <span className="text-sm font-medium">
            🎬 Demo Mode Active | Data Mode: {config.dataMode} 
            {config.autoReset && ` | Auto-reset: ${config.resetInterval}m`}
          </span>
        </div>
      )}

      {/* Main Content */}
      <div className={isDemoMode ? 'pt-10' : ''}>
        {children}
      </div>
    </div>
  );
};

// Utility hook for demo mode awareness
export const useDemoMode = () => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  return {
    isDemoMode,
    setDemoMode: setIsDemoMode,
    demoData: isDemoMode ? 'demo' : 'live'
  };
};

// Demo mode provider for app-wide state
export const DemoModeContext = React.createContext({
  isDemoMode: false,
  toggleDemo: () => {},
  resetDemo: () => {},
  demoConfig: {} as DemoConfig
});

export const DemoModeProvider: React.FC<{
  children: React.ReactNode;
  initialConfig?: Partial<DemoConfig>;
}> = ({ children, initialConfig = {} }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [config] = useState<DemoConfig>({
    enabled: false,
    autoReset: false,
    resetInterval: 30,
    showMetrics: true,
    simulateLatency: true,
    dataMode: 'demo',
    ...initialConfig
  });

  const toggleDemo = () => setIsDemoMode(!isDemoMode);
  const resetDemo = () => {
    // Reset demo state logic here
    console.log('Demo reset triggered');
  };

  return (
    <DemoModeContext.Provider value={{
      isDemoMode,
      toggleDemo,
      resetDemo,
      demoConfig: config
    }}>
      {children}
    </DemoModeContext.Provider>
  );
};

export default InteractiveDemoInterface;