// Global teardown for Jest tests
// Runs once after all test suites complete

module.exports = async () => {
  console.log('🧹 Starting Jest global teardown...');
  
  // Clean up any global test resources
  delete global.testData;
  delete global.mockOllamaService;
  delete global.mockStripeService;
  delete global.mockPOSAdapters;
  delete global.mockVoiceServices;
  
  // Close any open connections
  // For example, database connections, Redis connections, etc.
  
  // Clean up temporary test files if any were created
  
  console.log('✅ Jest global teardown complete');
};