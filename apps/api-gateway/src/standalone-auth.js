// Standalone authentication server - no workspace dependencies
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// Environment variables with defaults for testing
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-do-not-use-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Basic middleware
app.use(cors({
  origin: (origin, callback) => {
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    const allowlist = [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_BUSINESS_DASHBOARD_URL,
      'https://business.vocilia.com',
      'https://vocilia.com'
    ].filter(Boolean);
    
    const isVercelDomain = origin && (
      origin.includes('.vercel.app') || 
      allowlist.includes(origin)
    );
    
    if (!origin || isVercelDomain) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Mock database - in real implementation this would be Supabase
const mockUsers = [
  {
    id: 'test-business-123',
    email: 'test@business.com',
    name: 'Test Business',
    password_hash: '$2a$12$LQv3c1yqBWVHxkd0LQ4YCOuLQkGLkG/5wKqN3rwrxQvDSc7EDVW7S', // password: 'testpass123'
    created_at: new Date().toISOString(),
    last_login_at: null
  }
];

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        }
      });
    }

    // Find user (in real app, this would be a database query)
    const user = mockUsers.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Generate tokens
    const tokenPayload = {
      businessId: user.id,
      email: user.email,
      name: user.name,
      type: 'business'
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'vocilia-platform',
      subject: user.id
    });

    const refreshToken = jwt.sign({ businessId: user.id }, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'vocilia-platform',
      subject: user.id
    });

    // Update last login (in real app, this would update the database)
    user.last_login_at = new Date().toISOString();

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
          last_login_at: user.last_login_at
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: '24h'
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong during login'
      }
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Refresh token is required'
        }
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const user = mockUsers.find(u => u.id === decoded.businessId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid refresh token'
        }
      });
    }

    // Generate new access token
    const tokenPayload = {
      businessId: user.id,
      email: user.email,
      name: user.name,
      type: 'business'
    };

    const newAccessToken = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'vocilia-platform',
      subject: user.id
    });

    res.json({
      success: true,
      data: {
        access_token: newAccessToken,
        expires_in: '24h'
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired refresh token'
      }
    });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token required'
        }
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = mockUsers.find(u => u.id === decoded.businessId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
          last_login_at: user.last_login_at
        }
      }
    });

  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'vocilia-api-gateway-auth',
    version: '1.0.0',
    uptime: process.uptime(),
    message: 'Standalone authentication service'
  });
});

// Basic business creation endpoint for testing
app.post('/api/business', async (req, res) => {
  try {
    const { name, email, password, orgNumber } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Name, email, and password are required'
        }
      });
    }

    // Check if user already exists
    const existingUser = mockUsers.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'A business with this email already exists'
        }
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create new business
    const newBusiness = {
      id: `bus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      email,
      password_hash: passwordHash,
      org_number: orgNumber || null,
      created_at: new Date().toISOString(),
      last_login_at: null
    };

    mockUsers.push(newBusiness);

    res.status(201).json({
      success: true,
      data: {
        business: {
          id: newBusiness.id,
          name: newBusiness.name,
          email: newBusiness.email,
          org_number: newBusiness.org_number,
          created_at: newBusiness.created_at
        }
      }
    });

  } catch (error) {
    console.error('Business creation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong during business creation'
      }
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Vocilia AI Feedback Platform API - Authentication Service',
    status: 'running',
    endpoints: {
      health: '/health',
      login: 'POST /api/auth/login',
      logout: 'POST /api/auth/logout', 
      refresh: 'POST /api/auth/refresh',
      me: 'GET /api/auth/me',
      createBusiness: 'POST /api/business'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available: ['/', '/health', '/api/auth/login', '/api/auth/logout', '/api/auth/refresh', '/api/auth/me', '/api/business']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Vocilia Authentication API running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Test login: POST /api/auth/login with email: test@business.com, password: testpass123`);
});