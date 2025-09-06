/**
 * Demo Orchestrator - Advanced Demo Management System
 * Orchestrates multiple demo scenarios and provides advanced demo features
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Badge } from './Badge';
import { Modal } from './Modal';
import { ProgressBar } from './ProgressBar';
import { Select } from './Select';
import { Switch } from './Switch';
import { ENHANCED_GUIDED_TOURS, PERSONAS, EnhancedDemoConfig } from './EnhancedDemoScenarios';

// Demo session state
interface DemoSession {
  id: string;
  startTime: Date;
  currentTour: string | null;
  currentStep: number;
  completedTours: string[];
  persona: string;
  language: 'sv' | 'en';
  analytics: {
    tourViews: Record<string, number>;
    stepCompletions: Record<string, number>;
    timeSpent: Record<string, number>;
    interactions: Array<{
      type: string;
      target: string;
      timestamp: Date;
      data?: any;
    }>;
  };
  customData?: any;
}

interface DemoOrchestratorProps {
  onDemoComplete?: (session: DemoSession) => void;
  onAnalytics?: (event: string, data: any) => void;
  initialConfig?: Partial<EnhancedDemoConfig>;
  enableRecording?: boolean;
  showAdvancedControls?: boolean;
}

export const DemoOrchestrator: React.FC<DemoOrchestratorProps> = ({
  onDemoComplete,
  onAnalytics,
  initialConfig = {},
  enableRecording = false,
  showAdvancedControls = false
}) => {
  // Demo state
  const [session, setSession] = useState<DemoSession | null>(null);
  const [config, setConfig] = useState<EnhancedDemoConfig>({
    enabled: false,
    autoReset: false,
    resetInterval: 30,
    showMetrics: true,
    simulateLatency: true,
    dataMode: 'demo',
    persona: 'cafe-owner',
    language: 'sv',
    ...initialConfig
  });

  // UI state
  const [showControls, setShowControls] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [recordingSession, setRecordingSession] = useState(false);
  const [currentHighlight, setCurrentHighlight] = useState<string | null>(null);

  // Refs
  const sessionRef = useRef<DemoSession | null>(null);
  const analyticsRef = useRef<any[]>([]);

  // Initialize demo session
  const initializeDemoSession = useCallback(() => {
    const newSession: DemoSession = {
      id: `demo-${Date.now()}`,
      startTime: new Date(),
      currentTour: null,
      currentStep: 0,
      completedTours: [],
      persona: config.persona || 'cafe-owner',
      language: config.language || 'sv',
      analytics: {
        tourViews: {},
        stepCompletions: {},
        timeSpent: {},
        interactions: []
      }
    };

    setSession(newSession);
    sessionRef.current = newSession;
    
    if (onAnalytics) {
      onAnalytics('demo_session_started', {
        sessionId: newSession.id,
        persona: newSession.persona,
        language: newSession.language
      });
    }

    return newSession;
  }, [config, onAnalytics]);

  // Track analytics event
  const trackEvent = useCallback((type: string, target: string, data?: any) => {
    if (!session) return;

    const interaction = {
      type,
      target,
      timestamp: new Date(),
      data
    };

    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        analytics: {
          ...prev.analytics,
          interactions: [...prev.analytics.interactions, interaction]
        }
      };
    });

    analyticsRef.current.push(interaction);

    if (onAnalytics) {
      onAnalytics('demo_interaction', {
        sessionId: session.id,
        ...interaction
      });
    }
  }, [session, onAnalytics]);

  // Start a specific tour
  const startTour = useCallback((tourId: string) => {
    if (!session) {
      initializeDemoSession();
    }

    const tour = ENHANCED_GUIDED_TOURS[tourId as keyof typeof ENHANCED_GUIDED_TOURS];
    if (!tour) {
      console.error(`Tour not found: ${tourId}`);
      return;
    }

    setSession(prev => {
      if (!prev) return prev;
      
      const updatedSession = {
        ...prev,
        currentTour: tourId,
        currentStep: 0,
        analytics: {
          ...prev.analytics,
          tourViews: {
            ...prev.analytics.tourViews,
            [tourId]: (prev.analytics.tourViews[tourId] || 0) + 1
          }
        }
      };

      return updatedSession;
    });

    trackEvent('tour_started', tourId, { tourTitle: tour.title });
  }, [session, initializeDemoSession, trackEvent]);

  // Complete current tour
  const completeTour = useCallback((tourId: string) => {
    setSession(prev => {
      if (!prev) return prev;

      const updatedSession = {
        ...prev,
        currentTour: null,
        currentStep: 0,
        completedTours: [...prev.completedTours, tourId]
      };

      return updatedSession;
    });

    trackEvent('tour_completed', tourId);

    if (onDemoComplete && session) {
      onDemoComplete(session);
    }
  }, [session, trackEvent, onDemoComplete]);

  // Navigate to next/previous step
  const navigateStep = useCallback((direction: 'next' | 'previous') => {
    if (!session || !session.currentTour) return;

    const tour = ENHANCED_GUIDED_TOURS[session.currentTour as keyof typeof ENHANCED_GUIDED_TOURS];
    if (!tour) return;

    const currentStep = session.currentStep;
    let newStep = currentStep;

    if (direction === 'next' && currentStep < tour.steps.length - 1) {
      newStep = currentStep + 1;
    } else if (direction === 'previous' && currentStep > 0) {
      newStep = currentStep - 1;
    } else if (direction === 'next' && currentStep === tour.steps.length - 1) {
      // Tour completed
      completeTour(session.currentTour);
      return;
    }

    setSession(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        currentStep: newStep,
        analytics: {
          ...prev.analytics,
          stepCompletions: {
            ...prev.analytics.stepCompletions,
            [`${session.currentTour}-${newStep}`]: Date.now()
          }
        }
      };
    });

    trackEvent('step_navigation', `${session.currentTour}-${newStep}`, { direction });
  }, [session, trackEvent, completeTour]);

  // Highlight demo element
  const highlightElement = useCallback((selector: string) => {
    setCurrentHighlight(selector);
    
    // Add highlighting class
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('demo-highlight');
    }

    // Remove highlight after delay
    setTimeout(() => {
      setCurrentHighlight(null);
      if (element) {
        element.classList.remove('demo-highlight');
      }
    }, 3000);

    trackEvent('element_highlighted', selector);
  }, [trackEvent]);

  // Auto-progress tour
  const [autoProgress, setAutoProgress] = useState(false);
  useEffect(() => {
    if (!autoProgress || !session?.currentTour) return;

    const interval = setInterval(() => {
      navigateStep('next');
    }, 5000); // 5 seconds per step

    return () => clearInterval(interval);
  }, [autoProgress, session?.currentTour, navigateStep]);

  // Generate demo report
  const generateDemoReport = useCallback(() => {
    if (!session) return null;

    const totalInteractions = session.analytics.interactions.length;
    const completionRate = session.completedTours.length / Object.keys(ENHANCED_GUIDED_TOURS).length * 100;
    const averageTimePerStep = analyticsRef.current.length > 0 ? 
      (Date.now() - session.startTime.getTime()) / analyticsRef.current.length : 0;

    return {
      sessionId: session.id,
      startTime: session.startTime,
      duration: Date.now() - session.startTime.getTime(),
      persona: session.persona,
      language: session.language,
      completedTours: session.completedTours,
      totalInteractions,
      completionRate,
      averageTimePerStep,
      analytics: session.analytics
    };
  }, [session]);

  // Export demo data
  const exportDemoData = useCallback(async (format: 'json' | 'csv') => {
    const report = generateDemoReport();
    if (!report) return;

    if (format === 'json') {
      const dataStr = JSON.stringify(report, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `demo-report-${report.sessionId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Simple CSV export
      const csvData = [
        'Session ID,Start Time,Duration (ms),Persona,Language,Completed Tours,Total Interactions,Completion Rate',
        `${report.sessionId},${report.startTime.toISOString()},${report.duration},${report.persona},${report.language},"${report.completedTours.join(';')}",${report.totalInteractions},${report.completionRate.toFixed(1)}%`
      ].join('\n');
      
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `demo-report-${report.sessionId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }

    trackEvent('demo_exported', format);
  }, [generateDemoReport, trackEvent]);

  // Available tours for current persona
  const availableTours = Object.entries(ENHANCED_GUIDED_TOURS).filter(([id, tour]) => {
    if (!config.persona) return true;
    const persona = PERSONAS[config.persona];
    if (!persona) return true;
    
    // Filter tours based on persona interests and experience level
    if (tour.difficulty === 'expert' && persona.experienceLevel === 'beginner') return false;
    if (tour.difficulty === 'executive' && persona.experienceLevel !== 'executive') return false;
    
    return true;
  });

  // Current tour info
  const currentTour = session?.currentTour ? 
    ENHANCED_GUIDED_TOURS[session.currentTour as keyof typeof ENHANCED_GUIDED_TOURS] : null;
  const currentStep = currentTour?.steps[session?.currentStep || 0];

  return (
    <div className="demo-orchestrator">
      {/* Demo Controls */}
      {(showAdvancedControls || showControls) && (
        <Card className="demo-controls mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">🎭 Demo Kontroller</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowControls(!showControls)}
            >
              {showControls ? '▼' : '▶'} Minimera
            </Button>
          </div>

          {showControls && (
            <div className="space-y-4">
              {/* Persona Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Persona</label>
                  <Select
                    value={config.persona || 'cafe-owner'}
                    onChange={(value) => setConfig(prev => ({ ...prev, persona: value as any }))}
                    options={Object.entries(PERSONAS).map(([key, persona]) => ({
                      value: key,
                      label: persona.name
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Språk</label>
                  <Select
                    value={config.language || 'sv'}
                    onChange={(value) => setConfig(prev => ({ ...prev, language: value as any }))}
                    options={[
                      { value: 'sv', label: 'Svenska' },
                      { value: 'en', label: 'English' }
                    ]}
                  />
                </div>
              </div>

              {/* Demo Settings */}
              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center">
                  <Switch
                    checked={autoProgress}
                    onChange={setAutoProgress}
                  />
                  <span className="ml-2 text-sm">Auto-progression</span>
                </label>
                <label className="flex items-center">
                  <Switch
                    checked={config.simulateLatency}
                    onChange={(checked) => setConfig(prev => ({ ...prev, simulateLatency: checked }))}
                  />
                  <span className="ml-2 text-sm">Simulera latens</span>
                </label>
                <label className="flex items-center">
                  <Switch
                    checked={recordingSession}
                    onChange={setRecordingSession}
                  />
                  <span className="ml-2 text-sm">Spela in session</span>
                </label>
              </div>

              {/* Tour Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Tillgängliga Tours</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTours.map(([id, tour]) => (
                    <Button
                      key={id}
                      variant={session?.currentTour === id ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => startTour(id)}
                      disabled={session?.completedTours.includes(id)}
                    >
                      {tour.title}
                      {session?.completedTours.includes(id) && ' ✓'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Export & Reset */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-x-2">
                  <Button size="sm" onClick={() => exportDemoData('json')}>
                    Export JSON
                  </Button>
                  <Button size="sm" onClick={() => exportDemoData('csv')}>
                    Export CSV
                  </Button>
                </div>
                <div className="space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAnalytics(!showAnalytics)}
                  >
                    📊 Analytics
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setSession(null);
                      analyticsRef.current = [];
                    }}
                  >
                    Reset Demo
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Current Tour Display */}
      {session && currentTour && currentStep && (
        <Card className="current-tour mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg">{currentTour.title}</h3>
              <p className="text-sm text-gray-600">{currentTour.description}</p>
            </div>
            <Badge variant="primary">
              {session.currentStep + 1} / {currentTour.steps.length}
            </Badge>
          </div>

          <ProgressBar
            progress={((session.currentStep + 1) / currentTour.steps.length) * 100}
            className="mb-4"
          />

          <div className="current-step">
            <h4 className="font-bold mb-2">{currentStep.title}</h4>
            <p className="text-sm text-gray-700 mb-3">{currentStep.description}</p>
            
            {currentStep.content && (
              <div className="step-content mb-4">
                {currentStep.content}
              </div>
            )}

            <div className="step-actions flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigateStep('previous')}
                disabled={session.currentStep === 0}
              >
                ← Föregående
              </Button>

              {currentStep.target && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => highlightElement(currentStep.target)}
                >
                  💡 Markera
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={() => navigateStep('next')}
              >
                {session.currentStep === currentTour.steps.length - 1 ? 'Slutför' : 'Nästa →'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Analytics Panel */}
      {showAnalytics && session && (
        <Card className="analytics-panel">
          <h3 className="font-bold text-lg mb-4">📊 Demo Analytics</h3>
          
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 p-3 rounded text-center">
              <div className="text-2xl font-bold text-blue-600">{session.analytics.interactions.length}</div>
              <div className="text-sm">Interaktioner</div>
            </div>
            <div className="bg-green-50 p-3 rounded text-center">
              <div className="text-2xl font-bold text-green-600">{session.completedTours.length}</div>
              <div className="text-sm">Slutförda Tours</div>
            </div>
            <div className="bg-purple-50 p-3 rounded text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round((Date.now() - session.startTime.getTime()) / 1000 / 60)}
              </div>
              <div className="text-sm">Minuter</div>
            </div>
            <div className="bg-orange-50 p-3 rounded text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(session.completedTours.length / Object.keys(ENHANCED_GUIDED_TOURS).length * 100)}%
              </div>
              <div className="text-sm">Slutfört</div>
            </div>
          </div>

          <div className="recent-interactions">
            <h4 className="font-bold mb-2">Senaste Interaktioner</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {session.analytics.interactions.slice(-10).reverse().map((interaction, index) => (
                <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                  <span>{interaction.type}: {interaction.target}</span>
                  <span className="text-gray-500">
                    {interaction.timestamp.toLocaleTimeString('sv-SE')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Demo Styles */}
      <style jsx>{`
        .demo-orchestrator {
          position: relative;
          z-index: 1000;
        }

        :global(.demo-highlight) {
          animation: demo-pulse 2s infinite;
          border: 3px solid #3b82f6 !important;
          border-radius: 8px !important;
          background-color: rgba(59, 130, 246, 0.1) !important;
        }

        @keyframes demo-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
          }
        }

        .demo-controls {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border: 1px solid #cbd5e1;
        }

        .current-tour {
          background: white;
          border-left: 4px solid #3b82f6;
        }

        .analytics-panel {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
      `}</style>
    </div>
  );
};

export default DemoOrchestrator;