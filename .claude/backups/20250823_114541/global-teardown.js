/**
 * Global teardown for iOS Safari testing
 */

const fs = require('fs');
const path = require('path');

async function globalTeardown() {
  console.log('🧹 Cleaning up iOS Safari testing environment...');

  try {
    // Generate test summary report
    const testResultsDir = path.join(__dirname, '../../test-results/ios-safari');
    const resultsFile = path.join(testResultsDir, 'results.json');
    
    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      
      // Generate summary
      const summary = {
        totalTests: results.stats?.total || 0,
        passed: results.stats?.passed || 0,
        failed: results.stats?.failed || 0,
        skipped: results.stats?.skipped || 0,
        duration: results.stats?.duration || 0,
        devices: {},
        deviceCompatibility: {}
      };

      // Analyze results by device
      if (results.suites) {
        results.suites.forEach(suite => {
          if (suite.title?.includes('iPhone') || suite.title?.includes('iPad')) {
            const deviceName = suite.title.replace('iOS Safari Tests - ', '');
            summary.devices[deviceName] = {
              tests: suite.tests?.length || 0,
              passed: suite.tests?.filter(t => t.status === 'passed').length || 0,
              failed: suite.tests?.filter(t => t.status === 'failed').length || 0
            };

            // Check for key compatibility features
            const compatibilityTests = suite.tests?.filter(t => 
              t.title?.includes('MediaRecorder') || 
              t.title?.includes('Web Audio') ||
              t.title?.includes('WebSocket') ||
              t.title?.includes('microphone')
            ) || [];

            summary.deviceCompatibility[deviceName] = {
              mediaRecorderSupport: compatibilityTests.some(t => 
                t.title?.includes('MediaRecorder') && t.status === 'passed'
              ),
              webAudioFallback: compatibilityTests.some(t => 
                t.title?.includes('Web Audio') && t.status === 'passed'
              ),
              webSocketStability: compatibilityTests.some(t => 
                t.title?.includes('WebSocket') && t.status === 'passed'
              ),
              microphoneAccess: compatibilityTests.some(t => 
                t.title?.includes('microphone') && t.status === 'passed'
              )
            };
          }
        });
      }

      // Write summary report
      const summaryFile = path.join(testResultsDir, 'ios-compatibility-summary.json');
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

      // Generate readable report
      const readableReport = generateReadableReport(summary);
      fs.writeFileSync(
        path.join(testResultsDir, 'ios-compatibility-report.md'),
        readableReport
      );

      console.log('📊 Test Summary:');
      console.log(`   Total Tests: ${summary.totalTests}`);
      console.log(`   Passed: ${summary.passed}`);
      console.log(`   Failed: ${summary.failed}`);
      console.log(`   Duration: ${Math.round(summary.duration / 1000)}s`);
      
      if (Object.keys(summary.devices).length > 0) {
        console.log('\n📱 Device Compatibility:');
        Object.entries(summary.deviceCompatibility).forEach(([device, compat]) => {
          const score = Object.values(compat).filter(Boolean).length / 4 * 100;
          console.log(`   ${device}: ${Math.round(score)}% compatible`);
        });
      }

      console.log(`\n📋 Detailed report: ${summaryFile}`);
    }

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

function generateReadableReport(summary) {
  const timestamp = new Date().toISOString();
  
  return `# iOS Safari Compatibility Test Report

**Generated:** ${timestamp}

## Test Summary

- **Total Tests:** ${summary.totalTests}
- **Passed:** ${summary.passed} ✅
- **Failed:** ${summary.failed} ❌
- **Skipped:** ${summary.skipped} ⏭️
- **Duration:** ${Math.round(summary.duration / 1000)}s

## Device Compatibility Matrix

| Device | Tests | Pass Rate | MediaRecorder | WebAudio | WebSocket | Microphone |
|--------|--------|-----------|---------------|----------|-----------|------------|
${Object.entries(summary.deviceCompatibility).map(([device, compat]) => {
  const deviceStats = summary.devices[device] || { tests: 0, passed: 0 };
  const passRate = deviceStats.tests > 0 ? Math.round((deviceStats.passed / deviceStats.tests) * 100) : 0;
  
  return `| ${device} | ${deviceStats.tests} | ${passRate}% | ${compat.mediaRecorderSupport ? '✅' : '❌'} | ${compat.webAudioFallback ? '✅' : '❌'} | ${compat.webSocketStability ? '✅' : '❌'} | ${compat.microphoneAccess ? '✅' : '❌'} |`;
}).join('\n')}

## Compatibility Insights

### MediaRecorder Support
${Object.entries(summary.deviceCompatibility)
  .filter(([_, compat]) => compat.mediaRecorderSupport)
  .map(([device]) => `- ✅ ${device}`)
  .join('\n') || '- ❌ No devices support MediaRecorder natively'}

### Web Audio API Fallback
${Object.entries(summary.deviceCompatibility)
  .filter(([_, compat]) => compat.webAudioFallback)
  .map(([device]) => `- ✅ ${device}`)
  .join('\n') || '- ❌ Web Audio API fallback not working on any device'}

### WebSocket Stability
${Object.entries(summary.deviceCompatibility)
  .filter(([_, compat]) => compat.webSocketStability)
  .map(([device]) => `- ✅ ${device}`)
  .join('\n') || '- ❌ WebSocket connections unstable on all devices'}

### Microphone Access
${Object.entries(summary.deviceCompatibility)
  .filter(([_, compat]) => compat.microphoneAccess)
  .map(([device]) => `- ✅ ${device}`)
  .join('\n') || '- ❌ Microphone access issues on all devices'}

## Recommendations

${summary.failed > 0 ? `
### Critical Issues (${summary.failed} failures)
- Review failed tests in the detailed results
- Focus on device-specific compatibility issues
- Consider additional fallback mechanisms
` : ''}

${Object.values(summary.deviceCompatibility).some(c => !c.mediaRecorderSupport) ? `
### MediaRecorder Limitations
- Implement robust Web Audio API fallback
- Test audio quality with fallback mechanism
- Consider progressive enhancement approach
` : ''}

${Object.values(summary.deviceCompatibility).some(c => !c.webSocketStability) ? `
### WebSocket Reliability
- Implement retry logic for connection failures
- Add connection state monitoring
- Consider HTTP polling fallback for critical features
` : ''}

## Next Steps

1. Address any failing tests
2. Optimize fallback mechanisms
3. Performance test on physical devices
4. User acceptance testing with real iOS devices
5. Monitor real-world usage metrics

---
*Report generated by AI Feedback Platform iOS Safari Testing Suite*
`;
}

module.exports = globalTeardown;