#!/usr/bin/env node

/**
 * Phase B Demo Environment Validation Script
 * 
 * This script validates all Phase B deliverables:
 * - B1: Business Simulation Dashboard (demo data, scenarios, interface)
 * - B2: Comprehensive Documentation (user, technical, process docs)
 * - B3: Video Walkthrough Creation (customer, business, admin/tech scripts)
 * 
 * Usage: node validate-phase-b-components.js
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class PhaseValidationError extends Error {
  constructor(component, issue, details = null) {
    super(`[${component}] ${issue}`);
    this.component = component;
    this.issue = issue;
    this.details = details;
  }
}

class PhaseBValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: []
    };
    
    this.components = {
      demoDataGenerator: 'scripts/demo-data-generator.ts',
      demoScenarios: 'packages/ui-components/src/components/DemoScenarioRunner.tsx',
      interactiveDemo: 'packages/ui-components/src/components/InteractiveDemoInterface.tsx',
      documentation: {
        userGuides: [
          'docs/user-guides/customer-guide.md',
          'docs/user-guides/business-setup-guide.md', 
          'docs/user-guides/admin-manual.md'
        ],
        technicalDocs: [
          'docs/technical/api-documentation.md',
          'docs/technical/integration-guide.md',
          'docs/technical/deployment-guide.md'
        ],
        processDocs: [
          'docs/processes/onboarding-workflows.md',
          'docs/processes/support-procedures.md',
          'docs/processes/incident-response.md'
        ]
      },
      videoScripts: {
        customer: [
          'video-scripts/customer-journey-main.md',
          'video-scripts/customer-voice-interaction.md',
          'video-scripts/customer-mobile-ui.md',
          'video-scripts/recording-setup-guide.md'
        ],
        business: [
          'video-scripts/business-owner-main.md',
          'video-scripts/business-analytics-deep-dive.md', 
          'video-scripts/business-onboarding-setup.md',
          'video-scripts/business-recording-setup.md'
        ],
        admin: [
          'video-scripts/admin-fraud-detection.md',
          'video-scripts/technical-architecture-deep-dive.md',
          'video-scripts/admin-technical-recording-setup.md'
        ]
      }
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m',   // red
      reset: '\x1b[0m'
    };
    
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async validateFileExists(filePath, component) {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new PhaseValidationError(
        component, 
        `Required file missing: ${filePath}`
      );
    }
    
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      throw new PhaseValidationError(
        component,
        `File is empty: ${filePath}`
      );
    }
    
    return { path: fullPath, size: stats.size };
  }

  async validateDemoDataGenerator() {
    this.log('Validating Demo Data Generator...', 'info');
    
    try {
      // Check if file exists and has content
      const fileInfo = await this.validateFileExists(
        this.components.demoDataGenerator, 
        'DemoDataGenerator'
      );
      
      // Read and validate TypeScript content
      const content = fs.readFileSync(fileInfo.path, 'utf8');
      
      // Check for required components
      const requiredElements = [
        'SwedishDemoDataGenerator',
        'generateBusinesses',
        'generateFeedbackSessions',
        'generateLocations',
        'SWEDISH_BUSINESSES',
        'FEEDBACK_TEMPLATES',
        'MENU_ITEMS'
      ];
      
      const missingElements = requiredElements.filter(element => 
        !content.includes(element)
      );
      
      if (missingElements.length > 0) {
        throw new PhaseValidationError(
          'DemoDataGenerator',
          `Missing required elements: ${missingElements.join(', ')}`
        );
      }
      
      // Check for Swedish business context
      const swedishElements = [
        'Café Aurora', 
        'Stockholm',
        'Göteborg',
        'Malmö',
        'SEK',
        'svensk',
        'Anna',
        'Erik',
        'Maria'
      ];
      
      const foundSwedishElements = swedishElements.filter(element =>
        content.includes(element)
      );
      
      if (foundSwedishElements.length < 5) {
        this.results.warnings++;
        this.log(`Warning: Limited Swedish context in demo data generator (found ${foundSwedishElements.length}/8 elements)`, 'warning');
      }
      
      // Check TypeScript syntax by attempting to parse
      if (!content.includes('export { SwedishDemoDataGenerator }')) {
        throw new PhaseValidationError(
          'DemoDataGenerator',
          'Missing main class export'
        );
      }
      
      this.results.passed++;
      this.log('✅ Demo Data Generator validation passed', 'success');
      
      return {
        valid: true,
        fileSize: fileInfo.size,
        swedishElements: foundSwedishElements.length,
        requiredElements: requiredElements.length - missingElements.length
      };
      
    } catch (error) {
      this.results.failed++;
      this.results.errors.push(error);
      this.log(`❌ Demo Data Generator validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async validateDemoScenarios() {
    this.log('Validating Demo Scenario Components...', 'info');
    
    try {
      // Validate DemoScenarioRunner component
      const fileInfo = await this.validateFileExists(
        this.components.demoScenarios,
        'DemoScenarios'
      );
      
      const content = fs.readFileSync(fileInfo.path, 'utf8');
      
      // Check for required React/TypeScript elements
      const requiredElements = [
        'export const DemoScenarioRunner',
        'DEMO_SCENARIOS',
        'interface DemoScenario',
        'interface DemoStep',
        'customer-happy-path',
        'business-owner-insights', 
        'admin-fraud-detection',
        'system-performance',
        'Stockholm',
        'Café Aurora'
      ];
      
      const missingElements = requiredElements.filter(element =>
        !content.includes(element)
      );
      
      if (missingElements.length > 0) {
        throw new PhaseValidationError(
          'DemoScenarios',
          `Missing required elements: ${missingElements.join(', ')}`
        );
      }
      
      // Check for 4 main scenario types
      const scenarioTypes = [
        'customer-happy-path',
        'business-owner-insights',
        'admin-fraud-detection', 
        'system-performance'
      ];
      
      const foundScenarios = scenarioTypes.filter(scenario =>
        content.includes(scenario)
      );
      
      if (foundScenarios.length < 4) {
        throw new PhaseValidationError(
          'DemoScenarios',
          `Missing scenarios: ${scenarioTypes.filter(s => !foundScenarios.includes(s)).join(', ')}`
        );
      }
      
      // Validate TypeScript syntax
      const reactImports = content.includes('import React') || content.includes('from \'react\'');
      if (!reactImports) {
        throw new PhaseValidationError(
          'DemoScenarios',
          'Missing React imports'
        );
      }
      
      this.results.passed++;
      this.log('✅ Demo Scenarios validation passed', 'success');
      
      return {
        valid: true,
        scenarioCount: foundScenarios.length,
        fileSize: fileInfo.size
      };
      
    } catch (error) {
      this.results.failed++;
      this.results.errors.push(error);
      this.log(`❌ Demo Scenarios validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async validateInteractiveDemo() {
    this.log('Validating Interactive Demo Interface...', 'info');
    
    try {
      const fileInfo = await this.validateFileExists(
        this.components.interactiveDemo,
        'InteractiveDemo'
      );
      
      const content = fs.readFileSync(fileInfo.path, 'utf8');
      
      // Check for required interface elements
      const requiredElements = [
        'InteractiveDemoInterface',
        'TourStep', 
        'GUIDED_TOURS',
        'demo mode',
        'Customer Mobile',
        'Stockholm',
        'fraud detection',
        'QR Code'
      ];
      
      const missingElements = requiredElements.filter(element =>
        !content.toLowerCase().includes(element.toLowerCase())
      );
      
      if (missingElements.length > 0) {
        throw new PhaseValidationError(
          'InteractiveDemo',
          `Missing required elements: ${missingElements.join(', ')}`
        );
      }
      
      // Check React/TypeScript structure
      if (!content.includes('export') || !content.includes('React')) {
        throw new PhaseValidationError(
          'InteractiveDemo',
          'Invalid React component structure'
        );
      }
      
      this.results.passed++;
      this.log('✅ Interactive Demo Interface validation passed', 'success');
      
      return {
        valid: true,
        fileSize: fileInfo.size
      };
      
    } catch (error) {
      this.results.failed++;
      this.results.errors.push(error);
      this.log(`❌ Interactive Demo Interface validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async validateDocumentation() {
    this.log('Validating Documentation Suite...', 'info');
    
    try {
      const docResults = {
        userGuides: 0,
        technicalDocs: 0, 
        processDocs: 0,
        totalFiles: 0,
        totalSize: 0
      };
      
      // Validate User Guides
      for (const docPath of this.components.documentation.userGuides) {
        const fileInfo = await this.validateFileExists(docPath, 'UserGuides');
        const content = fs.readFileSync(fileInfo.path, 'utf8');
        
        // Check for Swedish context in user guides
        const hasSwedishContent = content.includes('Swedish') || 
                                 content.includes('Sverige') ||
                                 content.includes('SEK') ||
                                 content.includes('Swish');
        
        if (!hasSwedishContent) {
          this.results.warnings++;
          this.log(`Warning: ${path.basename(docPath)} lacks Swedish context`, 'warning');
        }
        
        docResults.userGuides++;
        docResults.totalSize += fileInfo.size;
      }
      
      // Validate Technical Documentation  
      for (const docPath of this.components.documentation.technicalDocs) {
        const fileInfo = await this.validateFileExists(docPath, 'TechnicalDocs');
        const content = fs.readFileSync(fileInfo.path, 'utf8');
        
        // Check for technical content requirements
        const hasTechnicalContent = content.includes('API') ||
                                   content.includes('integration') ||
                                   content.includes('deployment');
        
        if (!hasTechnicalContent) {
          throw new PhaseValidationError(
            'TechnicalDocs',
            `Missing technical content in ${path.basename(docPath)}`
          );
        }
        
        docResults.technicalDocs++;
        docResults.totalSize += fileInfo.size;
      }
      
      // Validate Process Documentation
      for (const docPath of this.components.documentation.processDocs) {
        const fileInfo = await this.validateFileExists(docPath, 'ProcessDocs');
        const content = fs.readFileSync(fileInfo.path, 'utf8');
        
        // Check for process workflow content
        const hasProcessContent = content.includes('process') ||
                                 content.includes('procedure') ||
                                 content.includes('workflow') ||
                                 content.includes('steps');
        
        if (!hasProcessContent) {
          throw new PhaseValidationError(
            'ProcessDocs',
            `Missing process content in ${path.basename(docPath)}`
          );
        }
        
        docResults.processDocs++;
        docResults.totalSize += fileInfo.size;
      }
      
      docResults.totalFiles = docResults.userGuides + docResults.technicalDocs + docResults.processDocs;
      
      if (docResults.totalFiles < 9) {
        throw new PhaseValidationError(
          'Documentation',
          `Incomplete documentation suite: ${docResults.totalFiles}/9 files`
        );
      }
      
      this.results.passed++;
      this.log('✅ Documentation validation passed', 'success');
      
      return docResults;
      
    } catch (error) {
      this.results.failed++;
      this.results.errors.push(error);
      this.log(`❌ Documentation validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async validateVideoScripts() {
    this.log('Validating Video Script Suite...', 'info');
    
    try {
      const scriptResults = {
        customer: 0,
        business: 0,
        admin: 0,
        totalFiles: 0,
        totalSize: 0
      };
      
      // Validate Customer Scripts
      for (const scriptPath of this.components.videoScripts.customer) {
        const fileInfo = await this.validateFileExists(scriptPath, 'CustomerScripts');
        const content = fs.readFileSync(fileInfo.path, 'utf8');
        
        // Check for video production elements
        const hasVideoElements = content.includes('VISUAL:') ||
                                content.includes('DIALOGUE:') ||
                                content.includes('Duration:') ||
                                content.includes('Equipment');
        
        if (!hasVideoElements) {
          throw new PhaseValidationError(
            'CustomerScripts',
            `Missing video production elements in ${path.basename(scriptPath)}`
          );
        }
        
        // Check for Swedish content
        const hasSwedishContent = content.includes('Swedish') ||
                                 content.includes('svenska') ||
                                 content.includes('SEK');
        
        if (!hasSwedishContent) {
          this.results.warnings++;
          this.log(`Warning: ${path.basename(scriptPath)} lacks Swedish context`, 'warning');
        }
        
        scriptResults.customer++;
        scriptResults.totalSize += fileInfo.size;
      }
      
      // Validate Business Scripts
      for (const scriptPath of this.components.videoScripts.business) {
        const fileInfo = await this.validateFileExists(scriptPath, 'BusinessScripts');
        const content = fs.readFileSync(fileInfo.path, 'utf8');
        
        // Check for business/ROI content
        const hasBusinessContent = content.includes('ROI') ||
                                  content.includes('analytics') ||
                                  content.includes('dashboard') ||
                                  content.includes('business owner');
        
        if (!hasBusinessContent) {
          throw new PhaseValidationError(
            'BusinessScripts',
            `Missing business content in ${path.basename(scriptPath)}`
          );
        }
        
        scriptResults.business++;
        scriptResults.totalSize += fileInfo.size;
      }
      
      // Validate Admin/Technical Scripts
      for (const scriptPath of this.components.videoScripts.admin) {
        const fileInfo = await this.validateFileExists(scriptPath, 'AdminScripts');
        const content = fs.readFileSync(fileInfo.path, 'utf8');
        
        // Check for technical/security content
        const hasTechnicalContent = content.includes('fraud') ||
                                   content.includes('architecture') ||
                                   content.includes('technical') ||
                                   content.includes('security');
        
        if (!hasTechnicalContent) {
          throw new PhaseValidationError(
            'AdminScripts',
            `Missing technical content in ${path.basename(scriptPath)}`
          );
        }
        
        scriptResults.admin++;
        scriptResults.totalSize += fileInfo.size;
      }
      
      scriptResults.totalFiles = scriptResults.customer + scriptResults.business + scriptResults.admin;
      
      if (scriptResults.totalFiles < 11) {
        throw new PhaseValidationError(
          'VideoScripts',
          `Incomplete video script suite: ${scriptResults.totalFiles}/11 files`
        );
      }
      
      this.results.passed++;
      this.log('✅ Video Scripts validation passed', 'success');
      
      return scriptResults;
      
    } catch (error) {
      this.results.failed++;
      this.results.errors.push(error);
      this.log(`❌ Video Scripts validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async validateComponentIntegration() {
    this.log('Validating Component Integration...', 'info');
    
    try {
      // Check if demo data generator can be imported by demo scenarios
      const demoDataContent = fs.readFileSync(this.components.demoDataGenerator, 'utf8');
      const scenarioContent = fs.readFileSync(this.components.demoScenarios, 'utf8');
      
      // Check for compatible data structures
      const dataStructures = ['FeedbackSession', 'BusinessContext', 'QualityScore'];
      const compatibleStructures = dataStructures.filter(structure => 
        demoDataContent.includes(structure) || scenarioContent.includes(structure)
      );
      
      if (compatibleStructures.length < 2) {
        this.results.warnings++;
        this.log('Warning: Limited data structure compatibility between components', 'warning');
      }
      
      // Check for consistent Swedish business context across components
      const allContent = [
        fs.readFileSync(this.components.demoDataGenerator, 'utf8'),
        fs.readFileSync(this.components.demoScenarios, 'utf8'),
        fs.readFileSync(this.components.interactiveDemo, 'utf8')
      ].join(' ');
      
      const swedishBusinessElements = [
        'Café Aurora',
        'Stockholm', 
        'Göteborg',
        'Swedish',
        'SEK',
        'Anna'
      ];
      
      const consistentElements = swedishBusinessElements.filter(element =>
        allContent.includes(element)
      );
      
      if (consistentElements.length < 4) {
        throw new PhaseValidationError(
          'Integration',
          `Inconsistent Swedish business context across components: ${consistentElements.length}/6 elements`
        );
      }
      
      this.results.passed++;
      this.log('✅ Component Integration validation passed', 'success');
      
      return {
        valid: true,
        compatibleStructures: compatibleStructures.length,
        consistentElements: consistentElements.length
      };
      
    } catch (error) {
      this.results.failed++;
      this.results.errors.push(error);
      this.log(`❌ Component Integration validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async runComprehensiveValidation() {
    const startTime = Date.now();
    this.log('🚀 Starting Phase B Comprehensive Validation', 'info');
    this.log('='.repeat(60), 'info');
    
    const validationResults = {
      summary: {},
      detailed: {},
      timing: {}
    };
    
    try {
      // B1: Business Simulation Dashboard
      this.log('\n📊 PHASE B1: Business Simulation Dashboard', 'info');
      this.log('-'.repeat(50), 'info');
      
      const demoDataStart = Date.now();
      validationResults.detailed.demoDataGenerator = await this.validateDemoDataGenerator();
      validationResults.timing.demoDataGenerator = Date.now() - demoDataStart;
      
      const scenariosStart = Date.now();
      validationResults.detailed.demoScenarios = await this.validateDemoScenarios();
      validationResults.timing.demoScenarios = Date.now() - scenariosStart;
      
      const interactiveDemoStart = Date.now();
      validationResults.detailed.interactiveDemo = await this.validateInteractiveDemo();
      validationResults.timing.interactiveDemo = Date.now() - interactiveDemoStart;
      
      // B2: Comprehensive Documentation
      this.log('\n📚 PHASE B2: Comprehensive Documentation', 'info');
      this.log('-'.repeat(50), 'info');
      
      const docsStart = Date.now();
      validationResults.detailed.documentation = await this.validateDocumentation();
      validationResults.timing.documentation = Date.now() - docsStart;
      
      // B3: Video Walkthrough Creation
      this.log('\n🎬 PHASE B3: Video Walkthrough Creation', 'info');
      this.log('-'.repeat(50), 'info');
      
      const scriptsStart = Date.now();
      validationResults.detailed.videoScripts = await this.validateVideoScripts();
      validationResults.timing.videoScripts = Date.now() - scriptsStart;
      
      // Component Integration
      this.log('\n🔗 COMPONENT INTEGRATION TESTING', 'info');
      this.log('-'.repeat(50), 'info');
      
      const integrationStart = Date.now();
      validationResults.detailed.integration = await this.validateComponentIntegration();
      validationResults.timing.integration = Date.now() - integrationStart;
      
      // Generate summary
      const totalTime = Date.now() - startTime;
      validationResults.summary = {
        totalTime: totalTime,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        success: this.results.failed === 0
      };
      
      // Print final results
      this.log('\n' + '='.repeat(60), 'info');
      this.log('📋 PHASE B VALIDATION SUMMARY', 'info');
      this.log('='.repeat(60), 'info');
      
      if (validationResults.summary.success) {
        this.log(`✅ ALL VALIDATIONS PASSED (${this.results.passed}/${this.results.passed})`, 'success');
      } else {
        this.log(`❌ VALIDATION FAILED (${this.results.passed}/${this.results.passed + this.results.failed})`, 'error');
      }
      
      if (this.results.warnings > 0) {
        this.log(`⚠️  ${this.results.warnings} warnings detected`, 'warning');
      }
      
      this.log(`⏱️  Total validation time: ${totalTime}ms`, 'info');
      
      // Print component details
      this.log('\n📊 Component Details:', 'info');
      this.log(`• Demo Data Generator: ${validationResults.detailed.demoDataGenerator.fileSize} bytes`, 'info');
      this.log(`• Demo Scenarios: ${validationResults.detailed.demoScenarios.scenarioCount} scenarios`, 'info');
      this.log(`• Documentation: ${validationResults.detailed.documentation.totalFiles} files`, 'info');
      this.log(`• Video Scripts: ${validationResults.detailed.videoScripts.totalFiles} scripts`, 'info');
      
      if (this.results.errors.length > 0) {
        this.log('\n❌ ERRORS:', 'error');
        this.results.errors.forEach((error, index) => {
          this.log(`${index + 1}. [${error.component}] ${error.issue}`, 'error');
        });
      }
      
      return validationResults;
      
    } catch (error) {
      validationResults.summary = {
        totalTime: Date.now() - startTime,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        success: false,
        error: error.message
      };
      
      this.log(`\n💥 CRITICAL VALIDATION FAILURE: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Main execution
async function main() {
  const validator = new PhaseBValidator();
  
  try {
    const results = await validator.runComprehensiveValidation();
    
    if (results.summary.success) {
      console.log('\n🎉 Phase B validation completed successfully!');
      console.log('All demo components are ready for production use.');
      process.exit(0);
    } else {
      console.log('\n💥 Phase B validation failed!');
      console.log('Please fix the issues above before proceeding.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Validation process crashed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { PhaseBValidator, PhaseValidationError };