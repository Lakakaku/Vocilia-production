/**
 * Custom Playwright Reporter for Swedish Pilot Program
 * Generates pilot-specific reports and metrics
 */

const fs = require('fs').promises;
const path = require('path');

class PilotReporter {
  constructor() {
    this.results = {
      startTime: null,
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      customerJourneyTests: 0,
      customerJourneyPassed: 0,
      businessDashboardTests: 0,
      businessDashboardPassed: 0,
      adminSystemTests: 0,
      adminSystemPassed: 0,
      iosCompatibilityTests: 0,
      iosCompatibilityPassed: 0,
      performanceTests: 0,
      performanceTestsPassed: 0,
      swedishLocalizationTests: 0,
      swedishLocalizationPassed: 0,
      criticalFailures: [],
      performanceMetrics: [],
      swedishSpecificIssues: []
    };
  }

  onBegin(config, suite) {
    this.results.startTime = new Date();
    console.log('🇸🇪 Starting Swedish Pilot E2E Test Suite...');
    console.log(`Running ${suite.allTests().length} tests across ${config.projects.length} browsers`);
  }

  onTestBegin(test, result) {
    this.results.totalTests++;
    
    // Categorize tests
    if (test.title.toLowerCase().includes('customer journey')) {
      this.results.customerJourneyTests++;
    } else if (test.title.toLowerCase().includes('business dashboard')) {
      this.results.businessDashboardTests++;
    } else if (test.title.toLowerCase().includes('admin system')) {
      this.results.adminSystemTests++;
    } else if (test.title.toLowerCase().includes('ios') || test.title.toLowerCase().includes('mobile')) {
      this.results.iosCompatibilityTests++;
    } else if (test.title.toLowerCase().includes('performance')) {
      this.results.performanceTests++;
    }
    
    if (this.containsSwedishContent(test)) {
      this.results.swedishLocalizationTests++;
    }
  }

  onTestEnd(test, result) {
    const testCategory = this.categorizeTest(test);
    
    if (result.status === 'passed') {
      this.results.passedTests++;
      this.incrementCategoryPassed(testCategory);
    } else if (result.status === 'failed') {
      this.results.failedTests++;
      
      // Track critical failures
      if (this.isCriticalFailure(test)) {
        this.results.criticalFailures.push({
          testTitle: test.title,
          error: result.error?.message || 'Unknown error',
          category: testCategory,
          browser: test.parent.project()?.name || 'unknown'
        });
      }
      
      // Track Swedish-specific issues
      if (this.containsSwedishContent(test)) {
        this.results.swedishSpecificIssues.push({
          testTitle: test.title,
          error: result.error?.message || 'Unknown error',
          category: testCategory
        });
      }
    } else if (result.status === 'skipped') {
      this.results.skippedTests++;
    }
    
    // Track performance metrics
    if (testCategory === 'performance') {
      this.extractPerformanceMetrics(test, result);
    }
  }

  onEnd(result) {
    this.results.endTime = new Date();
    this.generatePilotReport();
    this.printSummary();
  }

  categorizeTest(test) {
    const title = test.title.toLowerCase();
    
    if (title.includes('customer journey')) return 'customerJourney';
    if (title.includes('business dashboard')) return 'businessDashboard';
    if (title.includes('admin system')) return 'adminSystem';
    if (title.includes('ios') || title.includes('mobile')) return 'iosCompatibility';
    if (title.includes('performance')) return 'performance';
    
    return 'other';
  }

  incrementCategoryPassed(category) {
    switch (category) {
      case 'customerJourney':
        this.results.customerJourneyPassed++;
        break;
      case 'businessDashboard':
        this.results.businessDashboardPassed++;
        break;
      case 'adminSystem':
        this.results.adminSystemPassed++;
        break;
      case 'iosCompatibility':
        this.results.iosCompatibilityPassed++;
        break;
      case 'performance':
        this.results.performanceTestsPassed++;
        break;
    }
    
    if (this.containsSwedishContent({ title: category })) {
      this.results.swedishLocalizationPassed++;
    }
  }

  containsSwedishContent(test) {
    const title = test.title.toLowerCase();
    const swedishKeywords = ['swedish', 'sverige', 'sek', 'swish', 'bankgiro', 'café', 'kaffehus'];
    return swedishKeywords.some(keyword => title.includes(keyword));
  }

  isCriticalFailure(test) {
    const criticalPatterns = [
      'complete full journey',
      'should login',
      'should display dashboard',
      'payment processing',
      'voice recording',
      'qr scan'
    ];
    
    const title = test.title.toLowerCase();
    return criticalPatterns.some(pattern => title.includes(pattern));
  }

  extractPerformanceMetrics(test, result) {
    // Extract performance data from test attachments or result data
    if (result.attachments) {
      result.attachments.forEach(attachment => {
        if (attachment.name.includes('performance')) {
          try {
            const data = JSON.parse(attachment.body.toString());
            this.results.performanceMetrics.push({
              testTitle: test.title,
              ...data
            });
          } catch (error) {
            // Ignore parsing errors
          }
        }
      });
    }
  }

  async generatePilotReport() {
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        testSuite: 'Swedish Pilot E2E Tests',
        version: '1.0.0',
        environment: 'test'
      },
      summary: {
        totalTests: this.results.totalTests,
        passed: this.results.passedTests,
        failed: this.results.failedTests,
        skipped: this.results.skippedTests,
        passRate: Math.round((this.results.passedTests / this.results.totalTests) * 100),
        duration: this.results.endTime - this.results.startTime
      },
      categoryResults: {
        customerJourney: {
          total: this.results.customerJourneyTests,
          passed: this.results.customerJourneyPassed,
          passRate: this.calculatePassRate(this.results.customerJourneyPassed, this.results.customerJourneyTests)
        },
        businessDashboard: {
          total: this.results.businessDashboardTests,
          passed: this.results.businessDashboardPassed,
          passRate: this.calculatePassRate(this.results.businessDashboardPassed, this.results.businessDashboardTests)
        },
        adminSystem: {
          total: this.results.adminSystemTests,
          passed: this.results.adminSystemPassed,
          passRate: this.calculatePassRate(this.results.adminSystemPassed, this.results.adminSystemTests)
        },
        iosCompatibility: {
          total: this.results.iosCompatibilityTests,
          passed: this.results.iosCompatibilityPassed,
          passRate: this.calculatePassRate(this.results.iosCompatibilityPassed, this.results.iosCompatibilityTests)
        },
        performance: {
          total: this.results.performanceTests,
          passed: this.results.performanceTestsPassed,
          passRate: this.calculatePassRate(this.results.performanceTestsPassed, this.results.performanceTests)
        },
        swedishLocalization: {
          total: this.results.swedishLocalizationTests,
          passed: this.results.swedishLocalizationPassed,
          passRate: this.calculatePassRate(this.results.swedishLocalizationPassed, this.results.swedishLocalizationTests)
        }
      },
      pilotReadiness: {
        overallScore: this.calculatePilotReadinessScore(),
        criticalIssues: this.results.criticalFailures.length,
        swedishSpecificIssues: this.results.swedishSpecificIssues.length,
        recommendation: this.generateRecommendation()
      },
      issues: {
        criticalFailures: this.results.criticalFailures,
        swedishSpecificIssues: this.results.swedishSpecificIssues
      },
      performanceMetrics: this.results.performanceMetrics
    };

    // Save report to file
    try {
      const reportPath = path.join(__dirname, '../../../test-results/pilot-readiness-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      // Also generate a human-readable summary
      await this.generateHumanReadableReport(report);
      
    } catch (error) {
      console.error('Failed to save pilot report:', error);
    }
  }

  async generateHumanReadableReport(report) {
    const summary = `
# 🇸🇪 Swedish Pilot Program - Test Results Summary

Generated: ${new Date().toLocaleString('sv-SE')}

## Overall Results
- **Total Tests**: ${report.summary.totalTests}
- **Passed**: ${report.summary.passed} (${report.summary.passRate}%)
- **Failed**: ${report.summary.failed}
- **Skipped**: ${report.summary.skipped}
- **Duration**: ${Math.round(report.summary.duration / 1000)}s

## Category Breakdown

### Customer Journey Tests
- Passed: ${report.categoryResults.customerJourney.passed}/${report.categoryResults.customerJourney.total} (${report.categoryResults.customerJourney.passRate}%)

### Business Dashboard Tests  
- Passed: ${report.categoryResults.businessDashboard.passed}/${report.categoryResults.businessDashboard.total} (${report.categoryResults.businessDashboard.passRate}%)

### Admin System Tests
- Passed: ${report.categoryResults.adminSystem.passed}/${report.categoryResults.adminSystem.total} (${report.categoryResults.adminSystem.passRate}%)

### iOS Compatibility Tests
- Passed: ${report.categoryResults.iosCompatibility.passed}/${report.categoryResults.iosCompatibility.total} (${report.categoryResults.iosCompatibility.passRate}%)

### Swedish Localization Tests
- Passed: ${report.categoryResults.swedishLocalization.passed}/${report.categoryResults.swedishLocalization.total} (${report.categoryResults.swedishLocalization.passRate}%)

## Pilot Readiness Score: ${report.pilotReadiness.overallScore}/100

${report.pilotReadiness.recommendation}

## Critical Issues (${report.issues.criticalFailures.length})
${report.issues.criticalFailures.map(issue => `- ${issue.testTitle}: ${issue.error}`).join('\n')}

## Swedish-Specific Issues (${report.issues.swedishSpecificIssues.length})
${report.issues.swedishSpecificIssues.map(issue => `- ${issue.testTitle}: ${issue.error}`).join('\n')}

---
Generated by Swedish Pilot E2E Test Suite
`;

    const summaryPath = path.join(__dirname, '../../../test-results/pilot-summary.md');
    await fs.writeFile(summaryPath, summary);
  }

  calculatePassRate(passed, total) {
    return total > 0 ? Math.round((passed / total) * 100) : 0;
  }

  calculatePilotReadinessScore() {
    const weights = {
      customerJourney: 30,
      businessDashboard: 20,
      adminSystem: 15,
      iosCompatibility: 20,
      swedishLocalization: 15
    };

    let weightedScore = 0;
    let totalWeight = 0;

    Object.keys(weights).forEach(category => {
      const categoryData = this.results.categoryResults?.[category] || 
                          { passed: this.results[`${category}Passed`] || 0, 
                            total: this.results[`${category}Tests`] || 0 };
      
      if (categoryData.total > 0) {
        const passRate = categoryData.passed / categoryData.total;
        weightedScore += passRate * weights[category];
        totalWeight += weights[category];
      }
    });

    const baseScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
    
    // Deduct points for critical failures
    const criticalPenalty = this.results.criticalFailures.length * 10;
    const swedishPenalty = this.results.swedishSpecificIssues.length * 5;
    
    return Math.max(0, Math.round(baseScore - criticalPenalty - swedishPenalty));
  }

  generateRecommendation() {
    const score = this.calculatePilotReadinessScore();
    
    if (score >= 90) {
      return '🎉 READY FOR PILOT! All systems are operational and Swedish localization is complete.';
    } else if (score >= 75) {
      return '⚠️ MOSTLY READY - Address critical issues before pilot launch.';
    } else if (score >= 50) {
      return '🔧 NEEDS WORK - Significant issues need resolution before pilot.';
    } else {
      return '❌ NOT READY - Major system failures prevent pilot deployment.';
    }
  }

  printSummary() {
    const duration = Math.round((this.results.endTime - this.results.startTime) / 1000);
    const passRate = Math.round((this.results.passedTests / this.results.totalTests) * 100);
    
    console.log('\n🇸🇪 Swedish Pilot E2E Test Results Summary:');
    console.log('═══════════════════════════════════════════');
    console.log(`📊 Tests: ${this.results.totalTests} | ✅ Passed: ${this.results.passedTests} | ❌ Failed: ${this.results.failedTests} | ⏭️ Skipped: ${this.results.skippedTests}`);
    console.log(`📈 Pass Rate: ${passRate}% | ⏱️ Duration: ${duration}s`);
    console.log(`🎯 Pilot Readiness Score: ${this.calculatePilotReadinessScore()}/100`);
    
    if (this.results.criticalFailures.length > 0) {
      console.log(`🚨 Critical Failures: ${this.results.criticalFailures.length}`);
    }
    
    if (this.results.swedishSpecificIssues.length > 0) {
      console.log(`🇸🇪 Swedish-specific Issues: ${this.results.swedishSpecificIssues.length}`);
    }
    
    console.log(`\n${this.generateRecommendation()}`);
    console.log('\nDetailed report saved to: test-results/pilot-readiness-report.json');
    console.log('Human-readable summary: test-results/pilot-summary.md');
  }
}

module.exports = PilotReporter;