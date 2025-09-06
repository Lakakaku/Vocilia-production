module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
  
  // Test patterns - look for any existing tests
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,ts}',
    '<rootDir>/**/*.test.{js,ts}'
  ],
  
  // Ignore backup folders
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.claude/'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'apps/**/*.{js,ts}',
    'packages/**/*.{js,ts}',
    'tests/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.claude/**'
  ],
  
  coverageDirectory: './coverage',
  coverageReporters: [
    'text-summary'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Transform configuration - simple, no ts-jest
  transform: {},
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'ts',
    'json'
  ]
};