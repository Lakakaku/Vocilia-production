module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test timeout (60 seconds for slow operations)
  testTimeout: 60000,
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test-setup.js'],
  
  // Test patterns
  testMatch: [
    '<rootDir>/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    '../../../apps/business-dashboard/src/**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.d.ts'
  ],
  
  coverageDirectory: './coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],
  
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Test reporters
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'Business Dashboard Test Report',
      outputPath: './test-report.html',
      includeFailureMsg: true,
      includeSuiteFailure: true,
      includeConsoleLog: true,
      theme: 'lightTheme'
    }]
  ],
  
  // Module paths and aliases
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../../apps/business-dashboard/src/$1',
    '^@components/(.*)$': '<rootDir>/../../../apps/business-dashboard/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/../../../apps/business-dashboard/src/utils/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json'
  ],
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  
  // Global test setup
  globalSetup: '<rootDir>/global-setup.js',
  globalTeardown: '<rootDir>/global-teardown.js',
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Maximum worker processes
  maxWorkers: process.env.CI ? 2 : '50%',
  
  // Test sequence
  runInBand: false,
  
  // Error handling
  bail: process.env.CI ? true : false,
  
  // Watch mode ignore patterns
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/test-report.html'
  ]
};