import { useState, useEffect } from 'react';
import { WidgetConfig } from './Widget';
import SwedishCafePerformance from './widgets/SwedishCafePerformance';
import SwedishRegionalAnalytics from './widgets/SwedishRegionalAnalytics';

// Available widget types
type WidgetType = 'swedish_cafe_performance' | 'swedish_regional_analytics' | 'system_metrics' | 'fraud_alerts' | 'business_approvals';

interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  defaultConfig: Omit<WidgetConfig, 'id'>;
  component: React.ComponentType<any>;
}

// Widget registry
const WIDGET_DEFINITIONS: Record<WidgetType, WidgetDefinition> = {
  swedish_cafe_performance: {
    type: 'swedish_cafe_performance',
    name: 'Svensk Café Prestanda',
    description: 'Prestanda för svenska caféer med betyg och kundnöjdhet',
    defaultConfig: {
      title: 'Svensk Café Prestanda',
      description: 'Topprestanda för svenska caféer och regional analys',
      size: 'large',
      order: 1,
      visible: true,
      refreshable: true,
      configurable: true
    },
    component: SwedishCafePerformance
  },
  swedish_regional_analytics: {
    type: 'swedish_regional_analytics',
    name: 'Regional Analys',
    description: 'Svensk regional prestanda och marknadspenetration',
    defaultConfig: {
      title: 'Svensk Regional Analys',
      description: 'Regional prestanda och marknadspenetration över svenska städer',
      size: 'large',
      order: 2,
      visible: true,
      refreshable: true,
      configurable: true
    },
    component: SwedishRegionalAnalytics
  },
  system_metrics: {
    type: 'system_metrics',
    name: 'System Mätvärden',
    description: 'Realtids systemprestanda och anslutningar',
    defaultConfig: {
      title: 'System Mätvärden',
      description: 'Realtids systemprestanda och WebSocket anslutningar',
      size: 'medium',
      order: 3,
      visible: true,
      refreshable: true,
      configurable: true
    },
    component: ({ config, onConfigChange }: any) => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: '#64748b',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '2px dashed #cbd5e1'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>📊</div>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>System Mätvärden Widget</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Kommer snart...</div>
        </div>
      </div>
    )
  },
  fraud_alerts: {
    type: 'fraud_alerts',
    name: 'Bedrägerivarningar',
    description: 'Realtids bedrägeridetektering och varningar',
    defaultConfig: {
      title: 'Bedrägerivarningar',
      description: 'Senaste bedrägerivarningar och riskbedömningar',
      size: 'medium',
      order: 4,
      visible: true,
      refreshable: true,
      configurable: true
    },
    component: ({ config, onConfigChange }: any) => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: '#64748b',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '2px dashed #cbd5e1'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🚨</div>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>Bedrägeri Widget</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Kommer snart...</div>
        </div>
      </div>
    )
  },
  business_approvals: {
    type: 'business_approvals',
    name: 'Företagsansökningar',
    description: 'Väntande företagsansökningar för godkännande',
    defaultConfig: {
      title: 'Företagsansökningar',
      description: 'Väntande ansökningar från svenska företag',
      size: 'medium',
      order: 5,
      visible: false, // Hidden by default
      refreshable: true,
      configurable: true
    },
    component: ({ config, onConfigChange }: any) => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: '#64748b',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '2px dashed #cbd5e1'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>Ansökningar Widget</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Kommer snart...</div>
        </div>
      </div>
    )
  }
};

interface WidgetDashboardProps {
  className?: string;
}

export default function WidgetDashboard({ className }: WidgetDashboardProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [customizationMode, setCustomizationMode] = useState(false);
  const [availableWidgets, setAvailableWidgets] = useState<WidgetType[]>([]);

  // Load widget configuration from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('admin_widget_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setWidgets(parsed);
      } catch (error) {
        console.error('Failed to parse saved widget config:', error);
        initializeDefaultWidgets();
      }
    } else {
      initializeDefaultWidgets();
    }
  }, []);

  // Initialize default widgets
  const initializeDefaultWidgets = () => {
    const defaultWidgets: WidgetConfig[] = Object.entries(WIDGET_DEFINITIONS).map(([type, def]) => ({
      id: `widget_${type}_${Date.now()}`,
      ...def.defaultConfig
    }));
    
    setWidgets(defaultWidgets);
    setAvailableWidgets(Object.keys(WIDGET_DEFINITIONS) as WidgetType[]);
  };

  // Save widget configuration to localStorage
  const saveWidgetConfig = (newWidgets: WidgetConfig[]) => {
    localStorage.setItem('admin_widget_config', JSON.stringify(newWidgets));
  };

  // Handle widget configuration changes
  const handleWidgetConfigChange = (widgetId: string, newConfig: WidgetConfig) => {
    const updatedWidgets = widgets.map(widget => 
      widget.id === widgetId ? newConfig : widget
    );
    setWidgets(updatedWidgets);
    saveWidgetConfig(updatedWidgets);
  };

  // Add new widget
  const addWidget = (type: WidgetType) => {
    const definition = WIDGET_DEFINITIONS[type];
    if (!definition) return;

    const newWidget: WidgetConfig = {
      id: `widget_${type}_${Date.now()}`,
      ...definition.defaultConfig
    };

    const updatedWidgets = [...widgets, newWidget];
    setWidgets(updatedWidgets);
    saveWidgetConfig(updatedWidgets);
  };

  // Remove widget
  const removeWidget = (widgetId: string) => {
    const updatedWidgets = widgets.filter(widget => widget.id !== widgetId);
    setWidgets(updatedWidgets);
    saveWidgetConfig(updatedWidgets);
  };

  // Reset to default configuration
  const resetToDefault = () => {
    localStorage.removeItem('admin_widget_config');
    initializeDefaultWidgets();
  };

  // Get visible widgets sorted by order
  const visibleWidgets = widgets
    .filter(widget => widget.visible)
    .sort((a, b) => a.order - b.order);

  // Get widget type from widget config (based on title matching)
  const getWidgetType = (widget: WidgetConfig): WidgetType => {
    const found = Object.entries(WIDGET_DEFINITIONS).find(([type, def]) => 
      def.defaultConfig.title === widget.title
    );
    return found ? found[0] as WidgetType : 'system_metrics';
  };

  return (
    <div className={className}>
      {/* Dashboard Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b',
            margin: 0,
            marginBottom: '4px'
          }}>
            Svenska Företag Dashboard
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            margin: 0
          }}>
            Anpassningsbara widgets för svensk affärsanalys
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setCustomizationMode(!customizationMode)}
            style={{
              padding: '8px 16px',
              backgroundColor: customizationMode ? '#ef4444' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {customizationMode ? 'Avsluta Anpassning' : 'Anpassa Dashboard'}
          </button>
          
          <button
            onClick={resetToDefault}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Återställ Standard
          </button>
        </div>
      </div>

      {/* Customization Panel */}
      {customizationMode && (
        <div style={{
          marginBottom: '24px',
          padding: '20px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '2px dashed #cbd5e1'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151',
            margin: '0 0 16px 0'
          }}>
            Lägg Till Widget
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px'
          }}>
            {Object.entries(WIDGET_DEFINITIONS).map(([type, def]) => {
              const isAlreadyAdded = widgets.some(w => getWidgetType(w) === type);
              
              return (
                <div
                  key={type}
                  style={{
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    cursor: isAlreadyAdded ? 'not-allowed' : 'pointer',
                    opacity: isAlreadyAdded ? 0.6 : 1
                  }}
                  onClick={() => !isAlreadyAdded && addWidget(type as WidgetType)}
                >
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '4px'
                  }}>
                    {def.name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b',
                    marginBottom: '8px'
                  }}>
                    {def.description}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    backgroundColor: isAlreadyAdded ? '#f1f5f9' : '#dbeafe',
                    color: isAlreadyAdded ? '#64748b' : '#1e40af',
                    borderRadius: '12px',
                    display: 'inline-block'
                  }}>
                    {isAlreadyAdded ? 'Redan tillagd' : 'Klicka för att lägga till'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Widget Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        gridAutoRows: 'min-content'
      }}>
        {visibleWidgets.map(widget => {
          const widgetType = getWidgetType(widget);
          const definition = WIDGET_DEFINITIONS[widgetType];
          const WidgetComponent = definition?.component;

          if (!WidgetComponent) {
            return (
              <div key={widget.id} style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                color: '#dc2626'
              }}>
                Widget typ "{widgetType}" hittades inte
              </div>
            );
          }

          return (
            <div key={widget.id} style={{ position: 'relative' }}>
              {customizationMode && (
                <button
                  onClick={() => removeWidget(widget.id)}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    zIndex: 10,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Ta bort widget"
                >
                  ×
                </button>
              )}
              
              <WidgetComponent
                config={widget}
                onConfigChange={(newConfig: WidgetConfig) => 
                  handleWidgetConfigChange(widget.id, newConfig)
                }
              />
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {visibleWidgets.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#64748b'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📊</div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Inga widgets att visa
          </h3>
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>
            Aktivera anpassningsläge för att lägga till widgets till din dashboard
          </p>
          <button
            onClick={() => setCustomizationMode(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Anpassa Dashboard
          </button>
        </div>
      )}
    </div>
  );
}