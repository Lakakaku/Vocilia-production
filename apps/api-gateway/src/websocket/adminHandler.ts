import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { getActiveVoiceSessionStats, getVoiceAnalytics } from './voiceHandler';
import { AdminUser } from '../middleware/adminAuth';

// Admin WebSocket connection interface
interface AdminWebSocketConnection extends WebSocket {
  isAlive: boolean;
  adminUser?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  lastPing: number;
}

// Connected admin clients
const adminConnections = new Set<AdminWebSocketConnection>();
let metricsUpdateInterval: NodeJS.Timeout | null = null;

// JWT secret (same as in adminAuth middleware)
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-change-in-production';

// Admin metrics data structure
interface AdminMetrics {
  timestamp: string;
  system: {
    activeVoiceSessions: number;
    activeSessionIds: string[];
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
  connections: {
    totalConnections: number;
    adminConnections: number;
    voiceConnections: number;
  };
  voiceAnalytics?: any;
}

// Generate real-time admin metrics
function generateAdminMetrics(): AdminMetrics {
  const voiceStats = getActiveVoiceSessionStats();
  
  return {
    timestamp: new Date().toISOString(),
    system: {
      activeVoiceSessions: voiceStats.activeCount,
      activeSessionIds: voiceStats.activeSessionIds,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    },
    connections: {
      totalConnections: adminConnections.size + voiceStats.activeCount,
      adminConnections: adminConnections.size,
      voiceConnections: voiceStats.activeCount
    },
    voiceAnalytics: getVoiceAnalytics()
  };
}

// Authenticate WebSocket connection using JWT
function authenticateWebSocket(token: string): AdminUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== 'access') {
      return null;
    }

    // In production, query database for user details
    // For now, return basic info from token
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      active: true,
      createdAt: new Date().toISOString(),
      passwordHash: '' // Not needed for WS auth
    };
  } catch (error) {
    console.error('WebSocket auth error:', error);
    return null;
  }
}

// Broadcast metrics to all connected admin clients
function broadcastMetrics() {
  if (adminConnections.size === 0) return;

  const metrics = generateAdminMetrics();
  const message = JSON.stringify({
    type: 'metrics_update',
    data: metrics,
    timestamp: new Date().toISOString()
  });

  // Send to all connected admin clients
  const deadConnections: AdminWebSocketConnection[] = [];
  
  adminConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Error sending metrics to admin client:', error);
        deadConnections.push(ws);
      }
    } else {
      deadConnections.push(ws);
    }
  });

  // Clean up dead connections
  deadConnections.forEach(ws => {
    adminConnections.delete(ws);
  });

  console.log(`📊 Broadcasted metrics to ${adminConnections.size} admin clients`);
}

// Setup WebSocket handler for admin connections
export function setupAdminWebSocket(wss: WebSocketServer) {
  // Handle new WebSocket connections
  wss.on('connection', (ws: AdminWebSocketConnection, request) => {
    // Only handle admin WebSocket connections (check URL path)
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    
    if (!url.pathname.startsWith('/admin-ws')) {
      return; // Let other handlers manage this connection
    }

    console.log('🔗 New admin WebSocket connection attempt');

    // Initialize connection properties
    ws.isAlive = true;
    ws.lastPing = Date.now();

    // Handle authentication message
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'authenticate') {
          const token = message.token;
          if (!token) {
            ws.send(JSON.stringify({
              type: 'auth_error',
              message: 'Token krävs för admin WebSocket' // Swedish: Token required for admin WebSocket
            }));
            ws.close(4001, 'Authentication required');
            return;
          }

          const user = authenticateWebSocket(token);
          if (!user) {
            ws.send(JSON.stringify({
              type: 'auth_error',
              message: 'Ogiltig eller utgången token' // Swedish: Invalid or expired token
            }));
            ws.close(4001, 'Authentication failed');
            return;
          }

          // Store admin user info
          ws.adminUser = {
            id: user.id,
            email: user.email,
            role: user.role,
            permissions: [] // Could load from role permissions
          };

          // Add to admin connections
          adminConnections.add(ws);

          // Send authentication success
          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'Autentisering lyckades', // Swedish: Authentication successful
            user: {
              id: user.id,
              email: user.email,
              role: user.role
            }
          }));

          // Send initial metrics
          const initialMetrics = generateAdminMetrics();
          ws.send(JSON.stringify({
            type: 'metrics_update',
            data: initialMetrics,
            timestamp: new Date().toISOString()
          }));

          console.log(`✅ Admin WebSocket authenticated: ${user.email} (${user.role})`);

          // Start metrics broadcasting if this is the first admin connection
          if (adminConnections.size === 1 && !metricsUpdateInterval) {
            startMetricsBroadcasting();
          }
        } else if (message.type === 'ping') {
          ws.lastPing = Date.now();
          ws.isAlive = true;
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        console.error('Admin WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Ogiltigt meddelande format' // Swedish: Invalid message format
        }));
      }
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
      console.log(`🔌 Admin WebSocket disconnected: ${code} ${reason.toString()}`);
      adminConnections.delete(ws);

      // Stop metrics broadcasting if no admin connections remain
      if (adminConnections.size === 0 && metricsUpdateInterval) {
        stopMetricsBroadcasting();
      }
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error('Admin WebSocket error:', error);
      adminConnections.delete(ws);
    });

    // Send initial handshake
    ws.send(JSON.stringify({
      type: 'handshake',
      message: 'Ansluten till admin WebSocket. Vänligen autentisera.', // Swedish: Connected to admin WebSocket. Please authenticate.
      timestamp: new Date().toISOString()
    }));
  });

  console.log('🔧 Admin WebSocket handler configured');
}

// Start broadcasting metrics to admin clients
function startMetricsBroadcasting() {
  if (metricsUpdateInterval) return;

  console.log('🚀 Starting admin metrics broadcasting');
  
  // Broadcast every 5 seconds for real-time updates
  metricsUpdateInterval = setInterval(() => {
    broadcastMetrics();
  }, 5000);
}

// Stop broadcasting metrics
function stopMetricsBroadcasting() {
  if (metricsUpdateInterval) {
    console.log('⏹️ Stopping admin metrics broadcasting');
    clearInterval(metricsUpdateInterval);
    metricsUpdateInterval = null;
  }
}

// Cleanup function for graceful shutdown
export function cleanupAdminWebSocket() {
  stopMetricsBroadcasting();
  
  // Close all admin connections
  adminConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'server_shutdown',
        message: 'Server stängs av' // Swedish: Server shutting down
      }));
      ws.close(1001, 'Server shutdown');
    }
  });
  
  adminConnections.clear();
}

// Health check for admin WebSocket connections
export function getAdminWebSocketStats() {
  const connections = Array.from(adminConnections).map(ws => ({
    user: ws.adminUser,
    isAlive: ws.isAlive,
    lastPing: ws.lastPing,
    readyState: ws.readyState
  }));

  return {
    totalConnections: adminConnections.size,
    connections,
    isBroadcasting: !!metricsUpdateInterval
  };
}

// Manual metrics broadcast (for testing)
export function triggerMetricsBroadcast() {
  broadcastMetrics();
}