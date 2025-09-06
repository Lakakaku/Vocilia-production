module.exports = {
  // Projects configuration for monorepo
  projects: [
    '<rootDir>/apps/api-gateway/jest.config.js',
    '<rootDir>/apps/customer-pwa/jest.config.js'
  ],
  
  // Global test environment
  testEnvironment: 'node',
  
  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
  
  // Coverage configuration
  collectCoverageFrom: [
    'apps/*/src/**/*.{js,jsx,ts,tsx}',
    'packages/*/src/**/*.{js,jsx,ts,tsx}',
    'services/*/src/**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.d.ts',
    '!**/index.ts', // Often just re-exports
    '!**/*.config.{js,ts}',
    '!**/*.setup.{js,ts}'
  ],
  
  coverageDirectory: './coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],
  
  // Coverage thresholds (80% target)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Test reporters
  reporters: [
    'default'
  ],
  
  // Module paths and aliases (global)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@database/(.*)$': '<rootDir>/packages/database/src/$1'
  },
  
  // Transform configuration
  transform: {},
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Global setup/teardown
  globalSetup: '<rootDir>/jest.global-setup.js',
  globalTeardown: '<rootDir>/jest.global-teardown.js',
  
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Maximum worker processes (performance)
  maxWorkers: process.env.CI ? 2 : '50%',
  
  // Test sequence (removed runInBand as it's not a valid Jest config option in newer versions)
  
  // Error handling
  bail: process.env.CI ? 1 : false,
  
  // Test patterns to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '\\.d\\.ts$'
  ],
  
  // Watch mode ignore patterns
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/test-report.html'
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ]
};