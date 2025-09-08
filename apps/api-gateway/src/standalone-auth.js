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

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authorization token required'
      }
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }
    req.user = user;
    next();
  });
};

// Business Dashboard Data
app.get('/api/business/:businessId/dashboard', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  
  // Return fresh business dashboard data
  res.json({
    success: true,
    data: {
      stats: {
        totalFeedback: 0,
        averageQuality: 0,
        thisMonth: 0,
        pendingReview: 0
      },
      trends: [],
      qualityDistribution: {
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0
      },
      recentFeedback: []
    }
  });
});

// Feedback Management
app.get('/api/business/:businessId/feedback/released', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  
  res.json({
    success: true,
    data: {
      feedback: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0
    }
  });
});

app.get('/api/business/:businessId/feedback/pending', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  
  res.json({
    success: true,
    data: {
      feedback: [],
      total: 0
    }
  });
});

// Locations Management
app.get('/api/business/:businessId/locations', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  
  res.json({
    success: true,
    data: {
      locations: []
    }
  });
});

app.post('/api/business/:businessId/locations', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  const { name, address, description } = req.body;
  
  const newLocation = {
    id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    businessId,
    name,
    address,
    description,
    isActive: true,
    createdAt: new Date().toISOString(),
    qrCodes: []
  };
  
  res.status(201).json({
    success: true,
    data: {
      location: newLocation
    }
  });
});

app.put('/api/business/:businessId/locations/:locationId', authenticateToken, (req, res) => {
  const { businessId, locationId } = req.params;
  const updateData = req.body;
  
  res.json({
    success: true,
    data: {
      location: {
        id: locationId,
        businessId,
        ...updateData,
        updatedAt: new Date().toISOString()
      }
    }
  });
});

app.delete('/api/business/:businessId/locations/:locationId', authenticateToken, (req, res) => {
  const { businessId, locationId } = req.params;
  
  res.json({
    success: true,
    message: 'Location deleted successfully'
  });
});

// QR Code Generation
app.post('/api/business/:businessId/qr', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  const { locationId, type = 'simple' } = req.body;
  
  const qrCode = {
    id: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    businessId,
    locationId,
    type,
    code: Math.random().toString(36).substr(2, 8).toUpperCase(),
    isActive: true,
    createdAt: new Date().toISOString(),
    scans: 0
  };
  
  res.status(201).json({
    success: true,
    data: {
      qrCode,
      url: `https://vocilia.com/feedback/${qrCode.code}`
    }
  });
});

// Verification Management
app.get('/api/business/:businessId/verification', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  
  res.json({
    success: true,
    data: {
      status: 'pending_setup',
      method: null,
      documentsUploaded: false,
      verifiedAt: null,
      nextSteps: [
        'Choose verification method',
        'Upload required documents',
        'Submit for review'
      ]
    }
  });
});

app.post('/api/business/:businessId/verification/documents', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  const { documents } = req.body;
  
  res.json({
    success: true,
    data: {
      documentsUploaded: true,
      uploadedAt: new Date().toISOString(),
      status: 'documents_uploaded'
    }
  });
});

app.post('/api/business/:businessId/verification/submit', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  
  res.json({
    success: true,
    data: {
      status: 'under_review',
      submittedAt: new Date().toISOString(),
      estimatedReviewTime: '2-3 business days'
    }
  });
});

// Data Export
app.get('/api/business/:businessId/export', authenticateToken, (req, res) => {
  const { businessId } = req.params;
  const { format = 'csv' } = req.query;
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="feedback_export.csv"');
    res.send('Date,Customer,Rating,Comment,Category\n');
  } else {
    res.json({
      success: true,
      data: {
        feedback: [],
        exportedAt: new Date().toISOString(),
        totalRecords: 0
      }
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Vocilia AI Feedback Platform API - Business Management Service',
    status: 'running',
    version: '2.0.0',
    endpoints: {
      // Public endpoints
      health: 'GET /health',
      createBusiness: 'POST /api/business',
      
      // Authentication endpoints
      login: 'POST /api/auth/login',
      logout: 'POST /api/auth/logout', 
      refresh: 'POST /api/auth/refresh',
      me: 'GET /api/auth/me',
      
      // Business management endpoints (requires auth)
      dashboard: 'GET /api/business/:businessId/dashboard',
      feedback: 'GET /api/business/:businessId/feedback/released',
      pendingFeedback: 'GET /api/business/:businessId/feedback/pending',
      locations: 'GET/POST /api/business/:businessId/locations',
      locationManagement: 'PUT/DELETE /api/business/:businessId/locations/:locationId',
      generateQR: 'POST /api/business/:businessId/qr',
      verification: 'GET /api/business/:businessId/verification',
      verificationDocs: 'POST /api/business/:businessId/verification/documents',
      verificationSubmit: 'POST /api/business/:businessId/verification/submit',
      exportData: 'GET /api/business/:businessId/export'
    },
    features: [
      'JWT authentication with refresh tokens',
      'Business account management',
      'Dashboard analytics',
      'Location and QR code management',
      'Verification workflow',
      'Data export capabilities'
    ]
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