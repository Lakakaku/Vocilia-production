module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
  
  // Test patterns - focus on our created tests
  testMatch: [
    '<rootDir>/apps/api-gateway/src/**/*.test.{js,ts}',
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'apps/api-gateway/src/**/*.{js,ts}',
    '!apps/api-gateway/src/**/*.d.ts',
    '!apps/api-gateway/src/index.ts',
    '!**/node_modules/**'
  ],
  
  coverageDirectory: './coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html'
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
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Transform configuration - simple, no ts-jest
  transform: {},
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'ts',
    'json'
  ]
};