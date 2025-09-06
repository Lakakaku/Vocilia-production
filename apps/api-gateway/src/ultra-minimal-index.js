// Ultra-minimal Railway deployment - pure JavaScript, no compilation required
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(express.json());

// Ultra-minimal health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'vocilia-api-gateway',
    version: '1.0.0',
    uptime: process.uptime(),
    message: 'Ultra-minimal Railway deployment health check'
  });
});

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Vocilia AI Feedback Platform API',
    status: 'running',
    endpoints: {
      health: '/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available: ['/health', '/']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Vocilia API Gateway (ultra-minimal) running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
});