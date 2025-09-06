module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test timeout
  testTimeout: 5000,
  
  // Test patterns - just our basic test
  testMatch: [
    '<rootDir>/test-basic.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    '<rootDir>/test-basic.js'
  ],
  
  coverageDirectory: './coverage',
  coverageReporters: [
    'text',
    'text-summary'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Simple transform
  transform: {}
};