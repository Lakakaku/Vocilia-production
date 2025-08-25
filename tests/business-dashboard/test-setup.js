/**
 * Global test setup for Business Dashboard tests
 */

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toHaveLoadedWithin(received, timeout) {
    const pass = received <= timeout;
    if (pass) {
      return {
        message: () => `expected load time ${received}ms not to be within ${timeout}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected load time ${received}ms to be within ${timeout}ms`,
        pass: false,
      };
    }
  }
});

// Global test configuration
global.TEST_CONFIG = {
  timeout: 30000,
  slowTestThreshold: 10000,
  retryFailedTests: process.env.CI ? 2 : 0
};

// Console override for cleaner test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: process.env.VERBOSE_TESTS ? originalConsole.log : () => {},
  debug: process.env.VERBOSE_TESTS ? originalConsole.debug : () => {},
  info: originalConsole.info,
  warn: originalConsole.warn,
  error: originalConsole.error
};

// Global test utilities
global.TestHelpers = {
  async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    return false;
  },
  
  async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  },
  
  async measureTime(fn) {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  },
  
  generateTestData(template, count = 1) {
    return Array.from({ length: count }, (_, i) => ({
      ...template,
      id: i + 1,
      timestamp: new Date(Date.now() - i * 1000).toISOString()
    }));
  }
};

// Setup test environment
beforeAll(() => {
  // Set timezone for consistent testing
  process.env.TZ = 'Europe/Stockholm';
  
  // Mock console.time methods for performance testing
  if (!console.time) {
    const timers = {};
    console.time = (label) => {
      timers[label] = Date.now();
    };
    console.timeEnd = (label) => {
      if (timers[label]) {
        const duration = Date.now() - timers[label];
        console.log(`${label}: ${duration}ms`);
        delete timers[label];
        return duration;
      }
    };
  }
});

// Cleanup after each test
afterEach(async () => {
  // Clear any lingering timers
  jest.clearAllTimers();
  
  // Clean up any test artifacts
  if (global.gc) {
    global.gc();
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in test environment, just log
});

// Set up test database connection if needed
if (process.env.DATABASE_URL) {
  // Database setup would go here
  console.info('Database connection configured for testing');
}

// Mock external services in test environment
if (process.env.NODE_ENV === 'test') {
  // Mock Stripe
  jest.mock('stripe', () => ({
    Stripe: jest.fn(() => ({
      charges: {
        create: jest.fn().mockResolvedValue({ id: 'charge_test' })
      },
      transfers: {
        create: jest.fn().mockResolvedValue({ id: 'transfer_test' })
      }
    }))
  }));
  
  // Mock Supabase
  jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
      auth: {
        signIn: jest.fn().mockResolvedValue({ user: { id: 'user_test' } }),
        signOut: jest.fn().mockResolvedValue({})
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      }))
    }))
  }));
}

module.exports = {};