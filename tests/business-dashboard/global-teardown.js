/**
 * Global teardown for Business Dashboard tests
 * Runs after all tests to clean up the environment
 */

module.exports = async () => {
  console.log('🧹 Starting test environment cleanup...');
  
  try {
    // Run cleanup function if available
    if (global.TEST_CLEANUP) {
      await global.TEST_CLEANUP();
    }
    
    // Clean up any temporary files
    await cleanupTempFiles();
    
    // Clear global test data
    delete global.TEST_BUSINESS_ID;
    delete global.TEST_AUTH_TOKEN;
    delete global.MOCK_BUSINESS_DATA;
    delete global.MOCK_FEEDBACK_DATA;
    
    console.log('✅ Test environment cleanup complete');
    
  } catch (error) {
    console.error('❌ Test environment cleanup failed:', error.message);
    // Don't throw - we want tests to complete even if cleanup fails
  }
};

async function cleanupTempFiles() {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Clean up screenshot files
    const tempDir = '/tmp';
    const files = await fs.readdir(tempDir);
    
    const testFiles = files.filter(file => 
      file.startsWith('dashboard-') ||
      file.startsWith('compare-') ||
      file.startsWith('test-screenshot-')
    );
    
    for (const file of testFiles) {
      try {
        await fs.unlink(path.join(tempDir, file));
        console.log(`  🗑️  Removed ${file}`);
      } catch (error) {
        // Ignore individual file cleanup errors
      }
    }
    
    if (testFiles.length > 0) {
      console.log(`  ✅ Cleaned up ${testFiles.length} temporary files`);
    }
    
  } catch (error) {
    console.warn('  ⚠️  Could not clean up temporary files:', error.message);
  }
}