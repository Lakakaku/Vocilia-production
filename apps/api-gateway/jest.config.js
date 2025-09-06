module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.js'],
  
  // Test patterns
  testMatch: [
    '<rootDir>/src/**/*.test.{js,ts}',
    '<rootDir>/tests/**/*.test.{js,ts}',
    '<rootDir>/__tests__/**/*.{js,ts}'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/docs/**',
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
  
  // Transform configuration
  preset: 'ts-jest',
  
  // Module paths and aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@database/(.*)$': '<rootDir>/../../packages/database/src/$1'
  },
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'ts',
    'json'
  ],
  
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3001'
  },
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ]
};