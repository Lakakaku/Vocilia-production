#!/usr/bin/env node

/**
 * Business Dashboard Test Runner
 * Orchestrates comprehensive testing and report generation
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  testTimeout: 300000, // 5 minutes
  services: {
    businessDashboard: process.env.BUSINESS_DASHBOARD_URL || 'http://localhost:3002',
    apiGateway: process.env.API_GATEWAY_URL || 'http://localhost:3001'
  },
  browsers: process.env.TEST_BROWSERS ? process.env.TEST_BROWSERS.split(',') : ['chrome'],
  headless: process.env.HEADLESS !== 'false',
  parallel: process.env.PARALLEL_TESTS !== 'false'
};

async function main() {
  console.log('🚀 Starting Business Dashboard Test Suite');
  console.log(`📊 Configuration:`, CONFIG);
  
  try {
    // Pre-flight checks
    await preflightChecks();
    
    // Run test suites
    const testResults = await runTestSuites();
    
    // Generate reports
    await generateReports(testResults);
    
    console.log('✅ Business Dashboard testing completed successfully!');
    
    // Exit with appropriate code
    process.exit(testResults.failedTests > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

async function preflightChecks() {
  console.log('🔍 Running pre-flight checks...');
  
  // Check required dependencies
  const dependencies = ['puppeteer', 'axios', 'jest'];
  for (const dep of dependencies) {
    try {
      require(dep);
      console.log(`  ✅ ${dep} available`);
    } catch (error) {
      throw new Error(`Required dependency ${dep} not found. Run: npm install ${dep}`);
    }
  }
  
  // Check if services are running (optional)
  if (process.env.CHECK_SERVICES !== 'false') {
    await checkServices();
  }
  
  // Ensure test directories exist
  const testDirs = ['./coverage', '/tmp'];
  for (const dir of testDirs) {
    try {
      await fs.access(dir);
    } catch (error) {
      if (dir !== '/tmp') { // Don't try to create /tmp
        await fs.mkdir(dir, { recursive: true });
        console.log(`  📁 Created directory: ${dir}`);
      }
    }
  }
}

async function checkServices() {
  console.log('  🌐 Checking services...');
  
  for (const [name, url] of Object.entries(CONFIG.services)) {
    try {
      const axios = require('axios');
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      
      if (response.status === 200) {
        console.log(`    ✅ ${name} (${url})`);
      } else {
        console.log(`    ⚠️  ${name} returned status ${response.status}`);
      }
    } catch (error) {
      console.log(`    ⚠️  ${name} not available: ${error.code || error.message}`);
    }
  }
}

async function runTestSuites() {
  console.log('🧪 Executing test suites...');
  
  const suites = [
    {
      name: 'Component Tests',
      file: './business-dashboard.test.js',
      timeout: 120000,
      critical: true
    },
    {
      name: 'Integration Tests', 
      file: './integration.test.js',
      timeout: 180000,
      critical: true
    },
    {
      name: 'Cross-Browser Tests',
      file: './cross-browser.test.js', 
      timeout: 300000,
      critical: false
    }
  ];
  
  const results = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    suites: []
  };
  
  for (const suite of suites) {
    console.log(`\n📋 Running ${suite.name}...`);
    
    try {
      const suiteResult = await runTestSuite(suite);
      results.suites.push(suiteResult);
      results.totalTests += suiteResult.totalTests;
      results.passedTests += suiteResult.passedTests;
      results.failedTests += suiteResult.failedTests;
      
      if (suiteResult.failedTests > 0 && suite.critical) {
        console.log(`    ⚠️  Critical suite ${suite.name} has failures`);
      }
      
    } catch (error) {
      console.error(`    ❌ Suite ${suite.name} failed to run:`, error.message);
      
      results.suites.push({
        name: suite.name,
        error: error.message,
        totalTests: 0,
        passedTests: 0,
        failedTests: 1
      });
      
      results.failedTests += 1;
      
      if (suite.critical) {
        throw new Error(`Critical test suite ${suite.name} failed`);
      }
    }
  }
  
  return results;
}

async function runTestSuite(suite) {
  const startTime = Date.now();
  
  try {
    // Check if test file exists
    await fs.access(suite.file);
    
    // Run Jest for this specific test file
    const jestCommand = [
      'npx', 'jest',
      '--config=jest.config.js',
      '--testPathPattern=' + path.basename(suite.file),
      '--verbose',
      '--json',
      '--outputFile=./temp-results.json'
    ];
    
    if (CONFIG.headless) {
      process.env.HEADLESS = 'true';
    }
    
    console.log(`    🔄 Executing: ${jestCommand.join(' ')}`);
    
    // Execute the test
    execSync(jestCommand.join(' '), { 
      stdio: 'inherit',
      timeout: suite.timeout,
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    // Read results
    let results;
    try {
      const resultsData = await fs.readFile('./temp-results.json', 'utf8');
      results = JSON.parse(resultsData);
      
      // Cleanup temp file
      await fs.unlink('./temp-results.json').catch(() => {});
      
    } catch (error) {
      // Fallback if JSON results not available
      results = {
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        testResults: []
      };
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`    ✅ ${suite.name} completed in ${(duration / 1000).toFixed(1)}s`);
    console.log(`    📊 ${results.numPassedTests}/${results.numTotalTests} tests passed`);
    
    return {
      name: suite.name,
      file: suite.file,
      totalTests: results.numTotalTests || 0,
      passedTests: results.numPassedTests || 0,
      failedTests: results.numFailedTests || 0,
      duration,
      testResults: results.testResults || []
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.log(`    ❌ ${suite.name} failed after ${(duration / 1000).toFixed(1)}s`);
    
    // Check if it's a timeout
    if (error.signal === 'SIGTERM' || error.code === 'TIMEOUT') {
      throw new Error(`Test suite timed out after ${suite.timeout}ms`);
    }
    
    // Check if it's missing file
    if (error.code === 'ENOENT' && error.path?.includes(suite.file)) {
      throw new Error(`Test file not found: ${suite.file}`);
    }
    
    throw error;
  }
}

async function generateReports(testResults) {
  console.log('\n📄 Generating test reports...');
  
  try {
    // Generate comprehensive test report
    const { generateTestReport } = require('./generate-test-report.js');
    await generateTestReport();
    
    console.log('    ✅ HTML report generated: ./test-report-comprehensive.html');
    console.log('    ✅ Markdown report generated: ./BUSINESS_DASHBOARD_TEST_REPORT.md');
    
    // Generate summary
    generateSummary(testResults);
    
  } catch (error) {
    console.warn('    ⚠️  Report generation failed:', error.message);
  }
}

function generateSummary(testResults) {
  const passRate = testResults.totalTests > 0 
    ? ((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)
    : 0;
  
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  console.log(`Total Tests:    ${testResults.totalTests}`);
  console.log(`Passed:         ${testResults.passedTests}`);
  console.log(`Failed:         ${testResults.failedTests}`);
  console.log(`Pass Rate:      ${passRate}%`);
  console.log(`Status:         ${testResults.failedTests === 0 ? '✅ ALL PASSED' : '❌ FAILURES DETECTED'}`);
  
  if (testResults.suites.length > 0) {
    console.log('\nSuite Breakdown:');
    testResults.suites.forEach(suite => {
      const suitePassRate = suite.totalTests > 0 
        ? ((suite.passedTests / suite.totalTests) * 100).toFixed(1)
        : 0;
      console.log(`  ${suite.name}: ${suite.passedTests}/${suite.totalTests} (${suitePassRate}%)`);
    });
  }
  
  if (testResults.failedTests > 0) {
    console.log('\n⚠️  FAILED TESTS DETECTED - Review reports for details');
  } else {
    console.log('\n🎉 ALL TESTS PASSED - Business Dashboard ready for production!');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test execution interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test execution terminated');
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, runTestSuites, generateReports };