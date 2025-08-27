// WebSocket client for real-time admin metrics
import { authManager } from './auth';

export interface AdminMetrics {
  timestamp: string;
  system: {
    activeVoiceSessions: number;
    activeSessionIds: string[];
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
  };
  connections: {
    totalConnections: number;
    adminConnections: number;
    voiceConnections: number;
  };
  voiceAnalytics?: any;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  timestamp: string;
  user?: any;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'authenticating';

export interface WebSocketState {
  status: ConnectionStatus;
  lastMetrics?: AdminMetrics;
  lastUpdated?: Date;
  error?: string;
  reconnectCount: number;
}

class AdminWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectCount = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 5000; // 5 seconds
  private pingInterval = 30000; // 30 seconds
  
  // State management
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private state: WebSocketState = {
    status: 'disconnected',
    reconnectCount: 0
  };

  // Get WebSocket URL from API
  private async getWebSocketUrl(): Promise<string> {
    try {
      const response = await authManager.makeAuthenticatedRequest('/api/admin/websocket/info');
      if (response.ok) {
        const data = await response.json();
        return data.data?.url || this.getFallbackWebSocketUrl();
      }
    } catch (error) {
      console.warn('Failed to get WebSocket URL from API:', error);
    }
    return this.getFallbackWebSocketUrl();
  }

  private getFallbackWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '') || window.location.host;
    return `${protocol}//${host}/admin-ws`;
  }

  // Connect to WebSocket
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.updateState({ status: 'connecting' });
      const wsUrl = await this.getWebSocketUrl();
      
      console.log('Connecting to admin WebSocket:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.updateState({ 
        status: 'error', 
        error: 'Kunde inte ansluta till WebSocket' // Swedish: Could not connect to WebSocket
      });
      this.scheduleReconnect();
    }
  }

  // Setup WebSocket event handlers
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('✅ Admin WebSocket connected');
      this.updateState({ status: 'authenticating' });
      this.reconnectCount = 0;
      this.authenticate();
      
      // Apply iOS Safari optimizations after connection
      this.setupIOSSafariOptimizations();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('🔌 Admin WebSocket disconnected:', event.code, event.reason);
      this.updateState({ status: 'disconnected' });
      this.clearTimers();
      this.cleanupIOSSafariHandlers();
      
      // Attempt to reconnect if not a clean close
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ Admin WebSocket error:', error);
      this.updateState({ 
        status: 'error', 
        error: 'WebSocket anslutningsfel' // Swedish: WebSocket connection error
      });
    };
  }

  // iOS Safari specific WebSocket optimization
  private setupIOSSafariOptimizations(): void {
    if (!this.ws) return;

    // Detect iOS Safari
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       /Safari/.test(navigator.userAgent) && 
                       !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);

    if (isIOSSafari) {
      console.log('🍎 Applying iOS Safari WebSocket optimizations');

      // iOS Safari specific ping interval (more frequent)
      this.pingInterval = 15000; // 15 seconds instead of 30

      // iOS Safari connection state monitoring
      const connectionMonitor = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Send keepalive ping
          this.send({ type: 'keepalive', timestamp: Date.now() });
        } else if (this.ws && this.ws.readyState === WebSocket.CLOSED) {
          clearInterval(connectionMonitor);
          // Trigger reconnection if not intentional
          if (this.state.status === 'connected') {
            console.log('🍎 iOS Safari connection lost, attempting reconnect');
            this.scheduleReconnect();
          }
        }
      }, 10000); // Check every 10 seconds

      // Store monitor reference for cleanup
      (this.ws as any).iosConnectionMonitor = connectionMonitor;

      // iOS Safari memory pressure handling
      if ('onmemorywarning' in window) {
        const memoryHandler = () => {
          console.log('🍎 iOS memory warning - preparing WebSocket for background');
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({ type: 'prepare_background' });
          }
        };
        window.addEventListener('memorywarning', memoryHandler);
        (this.ws as any).memoryHandler = memoryHandler;
      }

      // iOS Safari visibility change handling
      const visibilityHandler = () => {
        if (document.hidden) {
          console.log('🍎 App backgrounded - reducing WebSocket activity');
          this.pingInterval = 30000; // Reduce ping frequency
        } else {
          console.log('🍎 App foregrounded - resuming normal WebSocket activity');
          this.pingInterval = 15000; // Resume normal ping frequency
          // Check connection and reconnect if needed
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.reconnect();
          }
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
      (this.ws as any).visibilityHandler = visibilityHandler;

      // iOS Safari page unload handling
      const beforeUnloadHandler = () => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Clean close before page unload
          this.ws.close(1000, 'Page unload');
        }
      };
      window.addEventListener('beforeunload', beforeUnloadHandler);
      (this.ws as any).beforeUnloadHandler = beforeUnloadHandler;
    }
  }

  // Cleanup iOS Safari specific handlers
  private cleanupIOSSafariHandlers(): void {
    if (!this.ws) return;

    const ws = this.ws as any;

    // Clear connection monitor
    if (ws.iosConnectionMonitor) {
      clearInterval(ws.iosConnectionMonitor);
      ws.iosConnectionMonitor = null;
    }

    // Remove memory warning handler
    if (ws.memoryHandler) {
      window.removeEventListener('memorywarning', ws.memoryHandler);
      ws.memoryHandler = null;
    }

    // Remove visibility change handler
    if (ws.visibilityHandler) {
      document.removeEventListener('visibilitychange', ws.visibilityHandler);
      ws.visibilityHandler = null;
    }

    // Remove beforeunload handler
    if (ws.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', ws.beforeUnloadHandler);
      ws.beforeUnloadHandler = null;
    }
  }

  // Authenticate with WebSocket server
  private authenticate(): void {
    const token = authManager.getAccessToken();
    if (!token) {
      console.error('No access token available for WebSocket authentication');
      this.updateState({ 
        status: 'error', 
        error: 'Ingen åtkomsttoken tillgänglig' // Swedish: No access token available
      });
      this.disconnect();
      return;
    }

    this.send({
      type: 'authenticate',
      token
    });
  }

  // Handle incoming WebSocket messages
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'handshake':
        console.log('📝 WebSocket handshake received');
        break;

      case 'auth_success':
        console.log('🔑 WebSocket authentication successful');
        this.updateState({ status: 'connected' });
        this.startPingTimer();
        this.emit('auth_success', message.user);
        break;

      case 'auth_error':
        console.error('🚫 WebSocket authentication failed:', message.message);
        this.updateState({ 
          status: 'error', 
          error: message.message || 'Autentisering misslyckades' // Swedish: Authentication failed
        });
        this.disconnect();
        break;

      case 'metrics_update':
        if (message.data) {
          this.updateState({ 
            lastMetrics: message.data,
            lastUpdated: new Date()
          });
          this.emit('metrics', message.data);
        }
        break;

      case 'pong':
        // Handle ping response
        break;

      case 'server_shutdown':
        console.log('🛑 Server shutdown notification');
        this.updateState({ 
          status: 'disconnected',
          error: 'Servern stängs av' // Swedish: Server shutting down
        });
        break;

      case 'error':
        console.error('WebSocket error message:', message.message);
        this.emit('error', message.message);
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  // Send message to WebSocket server
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message, WebSocket not connected');
    }
  }

  // Start ping timer to keep connection alive
  private startPingTimer(): void {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping', timestamp: new Date().toISOString() });
    }, this.pingInterval);
  }

  // Schedule reconnection attempt
  private scheduleReconnect(): void {
    if (this.reconnectCount >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.updateState({ 
        status: 'error', 
        error: 'Maximalt antal återanslutningsförsök nått' // Swedish: Max reconnection attempts reached
      });
      return;
    }

    this.reconnectCount++;
    const delay = Math.min(this.reconnectInterval * this.reconnectCount, 30000); // Max 30s delay
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectCount}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);

    this.updateState({ reconnectCount: this.reconnectCount });
  }

  // Clear all timers
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  // Update internal state and notify listeners
  private updateState(updates: Partial<WebSocketState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('state_change', this.state);
  }

  // Event listener management
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  // Public getters
  getState(): WebSocketState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.status === 'connected';
  }

  getLastMetrics(): AdminMetrics | undefined {
    return this.state.lastMetrics;
  }

  // Disconnect WebSocket
  disconnect(): void {
    console.log('🔌 Disconnecting admin WebSocket');
    this.clearTimers();
    this.cleanupIOSSafariHandlers();
    
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    
    this.updateState({ status: 'disconnected' });
  }

  // Manual reconnect
  reconnect(): void {
    this.disconnect();
    this.reconnectCount = 0;
    this.connect();
  }
}

// Create singleton instance
export const adminWebSocket = new AdminWebSocketClient();

// Helper function to get WebSocket URL (exported for testing)
export async function getWebSocketUrl(): Promise<string> {
  const client = adminWebSocket as any;
  return client.getWebSocketUrl();
}

// Swedish error messages helper
export function getWebSocketErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  
  const messages: Record<string, string> = {
    'CONNECTION_FAILED': 'Anslutning misslyckades',
    'AUTH_FAILED': 'Autentisering misslyckades',
    'SERVER_ERROR': 'Serverfel',
    'NETWORK_ERROR': 'Nätverksfel'
  };

  return messages[error?.code] || error?.message || 'Okänt WebSocket-fel';
}