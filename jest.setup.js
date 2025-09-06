// Jest setup file for AI Feedback Platform
// This file is executed before each test file

// Import jest-dom for additional matchers
require('@testing-library/jest-dom');

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/ai_feedback_test';
process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use DB 1 for tests
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
process.env.OLLAMA_ENDPOINT = 'http://localhost:11434';

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Suppress console.log in tests (unless debug mode)
  log: process.env.DEBUG ? console.log : jest.fn(),
  warn: process.env.DEBUG ? console.warn : jest.fn(),
  error: console.error, // Always show errors
  info: process.env.DEBUG ? console.info : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
};

// Mock WebSocket for tests
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock crypto for Node.js compatibility
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => require('crypto').randomUUID(),
    getRandomValues: (arr) => require('crypto').randomFillSync(arr)
  };
}

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      ok: true,
      status: 200,
      statusText: 'OK'
    })
  );
}

// Mock localStorage
if (!global.localStorage) {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn()
  };
}

// Mock sessionStorage
if (!global.sessionStorage) {
  global.sessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn()
  };
}

// Mock MediaDevices for voice testing
global.navigator = {
  ...global.navigator,
  mediaDevices: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [],
      getVideoTracks: () => [],
      getAudioTracks: () => []
    }))
  }
};

// Mock MediaRecorder for voice testing
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  requestData: jest.fn(),
  ondataavailable: null,
  onstart: null,
  onstop: null,
  onerror: null,
  state: 'inactive',
  mimeType: 'audio/webm'
}));

// Set up global test timeouts
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Clear any timers
  jest.clearAllTimers();
  
  // Clear localStorage/sessionStorage mocks
  if (global.localStorage) {
    global.localStorage.clear.mockClear();
  }
  if (global.sessionStorage) {
    global.sessionStorage.clear.mockClear();
  }
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Add custom matchers for better testing experience
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  toBeValidSEKAmount(received) {
    const pass = typeof received === 'number' && received >= 0 && Number.isFinite(received);
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid SEK amount`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid SEK amount (positive number)`,
        pass: false,
      };
    }
  },
  
  toBeValidQualityScore(received) {
    const pass = typeof received === 'number' && received >= 0 && received <= 100;
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid quality score`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid quality score (0-100)`,
        pass: false,
      };
    }
  }
});

console.log('🧪 Jest setup complete - AI Feedback Platform test environment ready');