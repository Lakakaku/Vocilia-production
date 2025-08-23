#!/usr/bin/env node
/**
 * iOS Safari Testing Runner
 * Orchestrates manual and automated testing for iOS Safari compatibility
 */

const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

class iOSTestRunner {
  constructor() {
    this.testResultsDir = path.join(__dirname, '../../test-results/ios-safari');
    this.ensureTestResultsDir();
  }

  ensureTestResultsDir() {
    if (!fs.existsSync(this.testResultsDir)) {
      fs.mkdirSync(this.testResultsDir, { recursive: true });
    }
  }

  log(message, color = RESET) {
    console.log(`${color}${message}${RESET}`);
  }

  async runTests() {
    this.log('\n🧪 iOS Safari Compatibility Testing Suite', BLUE);
    this.log('='.repeat(50), BLUE);

    // Check if development servers are running
    await this.checkDevServers();
    
    // Provide testing options
    this.showTestingOptions();
    
    // Generate test report template
    this.generateTestReportTemplate();
    
    this.log('\n✅ iOS Safari testing framework is ready!', GREEN);
  }

  async checkDevServers() {
    this.log('\n📡 Checking development servers...', YELLOW);
    
    const servers = [
      { name: 'Customer PWA', url: 'http://localhost:3000', port: 3000 },
      { name: 'API Gateway', url: 'http://localhost:3001', port: 3001 }
    ];

    for (const server of servers) {
      try {
        // Simple check - in a real implementation you might use fetch or ping
        this.log(`   ${server.name}: ${server.url} (not verified in this test)`, RESET);
      } catch (error) {
        this.log(`   ❌ ${server.name}: Not running on ${server.url}`, RED);
      }
    }

    this.log('\n💡 Make sure to start development servers:', BLUE);
    this.log('   npm run dev:web    # Customer PWA', RESET);
    this.log('   npm run dev:api    # API Gateway', RESET);
  }

  showTestingOptions() {
    this.log('\n🎯 Available Testing Methods:', BLUE);
    this.log('='.repeat(30), BLUE);

    this.log('\n1. Manual Testing (Recommended for iOS):', YELLOW);
    this.log('   📖 Follow: tests/ios-safari/manual-testing-guide.md');
    this.log('   📱 Test on physical iOS devices');
    this.log('   🔍 Use browser dev tools for debugging');

    this.log('\n2. Browser-based Testing Utilities:', YELLOW);
    this.log('   🌐 Load test-utils.js in iOS Safari');
    this.log('   🚀 Run: const tester = new iOSTestUtils()');
    this.log('   🧪 Run: await tester.runAllTests()');

    this.log('\n3. Automated Testing (Future):', YELLOW);
    this.log('   🤖 Playwright iOS config ready');
    this.log('   🔧 npm run test:ios (requires dependency fixes)');
    this.log('   ☁️  BrowserStack integration planned');

    this.log('\n📋 Testing Checklist:', BLUE);
    this.log('   □ PWA installation and offline mode');
    this.log('   □ QR code scanning with camera access');
    this.log('   □ Voice recording (MediaRecorder + Web Audio fallback)');
    this.log('   □ WebSocket real-time streaming');
    this.log('   □ Touch interactions and mobile UX');
    this.log('   □ Performance metrics and memory usage');
    this.log('   □ Network interruption handling');
    this.log('   □ App backgrounding behavior');
  }

  generateTestReportTemplate() {
    const templatePath = path.join(this.testResultsDir, 'test-report-template.json');
    
    const template = {
      metadata: {
        testDate: new Date().toISOString().split('T')[0],
        tester: '[Your Name]',
        environment: {
          customerPWA: 'http://localhost:3000',
          apiGateway: 'http://localhost:3001'
        }
      },
      devices: [
        {
          name: 'iPhone 15 Pro',
          iOSVersion: '',
          safariVersion: '',
          tests: {
            pwaInstallation: { status: 'not_tested', notes: '' },
            qrScanning: { status: 'not_tested', notes: '' },
            voiceRecording: { status: 'not_tested', notes: '' },
            webSocketConnection: { status: 'not_tested', notes: '' },
            touchInteractions: { status: 'not_tested', notes: '' },
            performance: { status: 'not_tested', notes: '' }
          }
        },
        {
          name: 'iPhone 14',
          iOSVersion: '',
          safariVersion: '',
          tests: {
            pwaInstallation: { status: 'not_tested', notes: '' },
            qrScanning: { status: 'not_tested', notes: '' },
            voiceRecording: { status: 'not_tested', notes: '' },
            webSocketConnection: { status: 'not_tested', notes: '' },
            touchInteractions: { status: 'not_tested', notes: '' },
            performance: { status: 'not_tested', notes: '' }
          }
        }
      ],
      summary: {
        overallCompatibility: '',
        criticalIssues: [],
        recommendations: []
      }
    };

    fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
    this.log(`\n📋 Test report template created: ${templatePath}`, GREEN);
  }

  generateDeviceTestScript() {
    const scriptContent = `
// iOS Safari Device Testing Script
// Copy and paste this into iOS Safari console

console.log('🧪 Starting iOS Safari Compatibility Tests...');

// Load test utilities if not already loaded
if (typeof iOSTestUtils === 'undefined') {
  console.log('❌ Test utilities not loaded. Please load test-utils.js first.');
} else {
  console.log('✅ Test utilities loaded successfully');
  
  // Run comprehensive test suite
  (async () => {
    const tester = new iOSTestUtils();
    console.log('📱 Device Info:', tester.deviceInfo);
    
    const report = await tester.runAllTests();
    console.log('📊 Test Results:', report);
    
    // Display summary
    console.log(\`
📋 Test Summary:
- Device: \${report.device.deviceType} (iOS \${report.device.iOSVersion})
- Tests: \${report.summary.total} total, \${report.summary.passed} passed, \${report.summary.failed} failed
- Pass Rate: \${report.summary.passRate}%
- MediaRecorder Support: \${report.device.capabilities.mediaRecorder ? '✅' : '❌'}
- Web Audio Support: \${report.device.capabilities.webAudio ? '✅' : '❌'}
- WebSocket Support: \${report.device.capabilities.webSocket ? '✅' : '❌'}

\${report.recommendations.length > 0 ? '🔧 Recommendations:\\n' + report.recommendations.map(r => '- ' + r).join('\\n') : ''}
    \`);
    
    // Save results to localStorage for later retrieval
    localStorage.setItem('iOSTestResults_' + Date.now(), JSON.stringify(report));
    console.log('💾 Results saved to localStorage');
  })();
}
    `.trim();

    const scriptPath = path.join(this.testResultsDir, 'device-test-script.js');
    fs.writeFileSync(scriptPath, scriptContent);
    this.log(`\n🖥️  Device test script created: ${scriptPath}`, GREEN);
  }
}

// Run the test runner
const runner = new iOSTestRunner();
runner.runTests().catch(console.error);