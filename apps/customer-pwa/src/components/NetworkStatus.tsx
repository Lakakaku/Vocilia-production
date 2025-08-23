import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader } from 'lucide-react';

interface NetworkStatusProps {
  showAlways?: boolean;
}

export function NetworkStatus({ showAlways = false }: NetworkStatusProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setReconnecting(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setReconnecting(true);
    };

    // Update connection info if available
    const updateConnectionInfo = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          setConnectionType(connection.effectiveType || 'unknown');
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen for connection changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', updateConnectionInfo);
        updateConnectionInfo(); // Initial check
      }
    }

    // Periodic connectivity check for testing
    const connectivityCheck = setInterval(() => {
      if (!navigator.onLine && isOnline) {
        setIsOnline(false);
        setReconnecting(true);
      } else if (navigator.onLine && !isOnline) {
        setIsOnline(true);
        setReconnecting(false);
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          connection.removeEventListener('change', updateConnectionInfo);
        }
      }
      clearInterval(connectivityCheck);
    };
  }, [isOnline]);

  // Only show if offline or showAlways is true
  if (!showAlways && isOnline && !reconnecting) {
    return null;
  }

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 p-2 text-center text-sm font-medium transition-all duration-300 ${
        isOnline 
          ? 'bg-green-500 text-white' 
          : 'bg-red-500 text-white'
      }`}
      data-testid="network-status"
    >
      <div className="flex items-center justify-center space-x-2">
        {reconnecting ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            <span data-testid="reconnecting-status">Återansluter...</span>
          </>
        ) : isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span data-testid="online-status">
              Online {connectionType !== 'unknown' && `(${connectionType})`}
            </span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span data-testid="offline-status">Ingen internetanslutning</span>
          </>
        )}
      </div>
      
      {/* Debug info for testing (only in development) */}
      {process.env.NODE_ENV === 'development' && showAlways && (
        <div className="text-xs mt-1 opacity-75" data-testid="connection-debug">
          Navigator Online: {navigator.onLine ? 'Yes' : 'No'} | 
          Type: {connectionType} | 
          Status: {isOnline ? 'Connected' : 'Disconnected'}
        </div>
      )}
    </div>
  );
}