import { ReactNode, useState } from 'react';

export interface WidgetConfig {
  id: string;
  title: string;
  description?: string;
  size: 'small' | 'medium' | 'large';
  order: number;
  visible: boolean;
  refreshable?: boolean;
  configurable?: boolean;
}

export interface WidgetProps {
  config: WidgetConfig;
  onConfigChange?: (config: WidgetConfig) => void;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string;
  children: ReactNode;
}

export default function Widget({ 
  config, 
  onConfigChange, 
  onRefresh, 
  loading = false, 
  error, 
  children 
}: WidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const getSizeStyles = () => {
    switch (config.size) {
      case 'small':
        return { gridColumn: 'span 1', minHeight: '200px' };
      case 'medium':
        return { gridColumn: 'span 2', minHeight: '250px' };
      case 'large':
        return { gridColumn: 'span 3', minHeight: '350px' };
      default:
        return { gridColumn: 'span 2', minHeight: '250px' };
    }
  };

  const handleSizeChange = (newSize: 'small' | 'medium' | 'large') => {
    if (onConfigChange) {
      onConfigChange({ ...config, size: newSize });
    }
  };

  const toggleVisible = () => {
    if (onConfigChange) {
      onConfigChange({ ...config, visible: !config.visible });
    }
  };

  if (!config.visible) {
    return null;
  }

  return (
    <div 
      style={{
        ...getSizeStyles(),
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        position: 'relative'
      }}
    >
      {/* Widget Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fafbfc'
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b',
            margin: 0,
            marginBottom: config.description ? '4px' : 0
          }}>
            {config.title}
          </h3>
          {config.description && (
            <p style={{
              fontSize: '12px',
              color: '#64748b',
              margin: 0
            }}>
              {config.description}
            </p>
          )}
        </div>

        {/* Widget Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Loading indicator */}
          {loading && (
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #e2e8f0',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}

          {/* Refresh button */}
          {config.refreshable && onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}
              title="Uppdatera widget"
            >
              🔄
            </button>
          )}

          {/* Expand/Collapse button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px'
            }}
            title={isExpanded ? 'Minimera' : 'Expandera'}
          >
            {isExpanded ? '−' : '+'}
          </button>

          {/* Configuration button */}
          {config.configurable && (
            <button
              onClick={() => setShowConfig(!showConfig)}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                backgroundColor: showConfig ? '#f1f5f9' : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}
              title="Konfigurera widget"
            >
              ⚙️
            </button>
          )}
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && config.configurable && (
        <div style={{
          padding: '12px 20px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', color: '#374151', minWidth: '40px' }}>
              Storlek:
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['small', 'medium', 'large'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => handleSizeChange(size)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    backgroundColor: config.size === size ? '#3b82f6' : 'white',
                    color: config.size === size ? 'white' : '#374151',
                    cursor: 'pointer'
                  }}
                >
                  {size === 'small' ? 'Liten' : size === 'medium' ? 'Medium' : 'Stor'}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '12px', color: '#374151' }}>
              <input
                type="checkbox"
                checked={config.visible}
                onChange={toggleVisible}
                style={{ marginRight: '6px' }}
              />
              Synlig
            </label>
          </div>
        </div>
      )}

      {/* Widget Content */}
      <div style={{
        padding: isExpanded ? '20px' : '0',
        height: isExpanded ? 'auto' : '0',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}>
        {error ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#dc2626',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            margin: '10px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Widget-fel</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>{error}</div>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Widget resize handle */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        width: '12px',
        height: '12px',
        background: 'linear-gradient(-45deg, transparent 0%, transparent 40%, #cbd5e1 40%, #cbd5e1 60%, transparent 60%, transparent 100%)',
        cursor: 'se-resize',
        opacity: 0.5
      }} />

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}