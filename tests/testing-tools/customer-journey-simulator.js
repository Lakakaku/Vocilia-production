/**
 * Customer Journey Simulator for End-to-End Testing
 * 
 * Simulates complete customer journeys through the AI feedback platform:
 * QR Scan → Transaction Verification → Voice Feedback → AI Scoring → Reward Payout
 */

const { v4: uuidv4 } = require('uuid');
const { MockTransactionGenerator } = require('./mock-transaction-generator');
const WebSocket = require('ws');
const axios = require('axios');
const { addSeconds, addMinutes, format } = require('date-fns');
const { sv } = require('date-fns/locale');

class CustomerJourneySimulator {
  constructor(config = {}) {
    this.config = {
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      websocketUrl: process.env.WS_URL || 'ws://localhost:3001',
      
      // Swedish customer personas with realistic behavior patterns
      customerPersonas: {
        'Måns Studenten': {
          age: '18-25',
          feedbackStyle: 'Kort och kärnfull',
          techComfort: 'Hög',
          language: 'sv-SE',
          feedbackTopics: ['pris', 'snabbhet', 'app-upplevelse', 'studentrabatt'],
          sessionDuration: { min: 45, max: 90 }, // seconds
          qualityRange: { min: 65, max: 85 }
        },
        'Anna Familjeförsörjare': {
          age: '36-45',
          feedbackStyle: 'Detaljerad och konstruktiv',
          techComfort: 'Medium',
          language: 'sv-SE',
          feedbackTopics: ['produktkvalitet', 'barnvänlighet', 'parkeringsmöjligheter', 'öppettider'],
          sessionDuration: { min: 80, max: 140 },
          qualityRange: { min: 75, max: 95 }
        },
        'Erik Pensionären': {
          age: '65+',
          feedbackStyle: 'Grundlig och refleterad',
          techComfort: 'Låg',
          language: 'sv-SE',
          feedbackTopics: ['personal-service', 'tillgänglighet', 'tydlighet', 'trygghet'],
          sessionDuration: { min: 100, max: 180 },
          qualityRange: { min: 70, max: 90 }
        },
        'Lisa Karriärkvinna': {
          age: '26-35',
          feedbackStyle: 'Effektiv och målmedveten',
          techComfort: 'Hög',
          language: 'sv-SE',
          feedbackTopics: ['effektivitet', 'digitala-lösningar', 'kvalitet', 'innovation'],
          sessionDuration: { min: 60, max: 100 },
          qualityRange: { min: 80, max: 95 }
        },
        'Ahmed Nyanländ': {
          age: '26-35',
          feedbackStyle: 'Jämförande och nyfiken',
          techComfort: 'Medium',
          language: 'sv-SE',
          feedbackTopics: ['kulturell-anpassning', 'språkstöd', 'prisrimlighet', 'community'],
          sessionDuration: { min: 90, max: 150 },
          qualityRange: { min: 70, max: 85 }
        }
      },

      // Swedish feedback templates by business type and persona
      feedbackTemplates: {
        grocery_store: {
          positive: [
            'Jag handlar här varje vecka och personalen är alltid trevlig och hjälpsam. Frukt och grönt-avdelningen har verkligen förbättrats senaste månaden.',
            'Bra urval av ekologiska produkter och priserna är rimliga. Gillar att ni har svenska produkter i fokus, speciellt köttet från lokala gårdar.',
            'Smidigt med självscanning och appen fungerar bra. Köerna går snabbt även på rusningstid. Barnvagnsparkeringen uppskattas verkligen.',
            'Utmärkt att ni är öppna till sent på vardagar. Personalen i delikatessen ger alltid bra råd och det märks att de har kunskap om produkterna.'
          ],
          constructive: [
            'Överlag nöjd men fruktavdelningen kunde vara fräschare, särskilt på vardagskvällar. Kanske bättre rutiner för påfyllning behövs.',
            'Bra butik men priserna på mejerivaror känns höga jämfört med andra kedjor. Mer transparens kring prissättning skulle uppskattas.',
            'Trevlig personal men ibland långa köer vid lunchtid. Kanske skulle en express-kassa för få varor hjälpa.',
            'Gillar konceptet men parkeringen är ofta full. Fler handikappplatser och bättre skyltning skulle förbättra tillgängligheten.'
          ]
        },
        cafe: {
          positive: [
            'Mysig atmosfär och riktigt bra kaffe! Personalen känner igen stamkunder och det skapar en hemkänsla. Kanelbullarna är fantastiska.',
            'Perfekt för arbetsmöten med bra wifi och behaglig ljudnivå. Vegetariska alternativen är kreativa och välsmakande.',
            'Bra öppettider och läget är perfekt för en snabb lunch. Gillar att ni använder återvinningsbara förpackningar.',
            'Trevlig personal som alltid ler och kommer ihåg mitt kaffepreferens. Utomhusserveringen på sommaren är underbar.'
          ],
          constructive: [
            'Trevligt ställe men blir ofta trångt på lunchtid. Kanske kunde man optimera bordsplaceringen för fler sittplatser.',
            'Bra kaffe men priserna är lite höga för studentbudget. En happy hour eller studentrabatt skulle vara uppskattat.',
            'Gillar stället men toaletten kunde vara renare och kanske bättre ventilation i lokalen skulle hjälpa.',
            'Mysigt café men servicen kan vara lite långsam när det är mycket folk. Mer personal under rusningstid skulle hjälpa.'
          ]
        },
        restaurant: {
          positive: [
            'Fantastisk middag med vänner! Maten var vällagad och personalen professionell. Vinstäckad rätter och bra vegetariska alternativ.',
            'Utmärkt service och rätterna kom i perfekt takt. Kocken kom ut och frågade hur allt smakade vilket kändes personligt.',
            'Bra atmosphere för både familjer och par. Barnmenyn var kreativ och inte bara pommes och korv som på många ställen.',
            'Imponerande lokal meny med säsongsvaror. Gillar att ni stöttar lokala leverantörer och har transparens kring ursprung.'
          ],
          constructive: [
            'God mat men lite dyr för vad man får. Portionerna kunde vara större, särskilt på huvudrätterna för priset.',
            'Trevlig lokal men lite för hög ljudnivå för konversation. Kanske akustikdämpning skulle förbättra upplevelsen.',
            'Bra konsept men servicen var lite ojämn. Förrätten kom fort men sedan väntade vi länge på huvudrätten.',
            'Gillade maten men önskar fler veganska alternativ på menyn. Dagens soppa var dock excellent och personalen kunnig.'
          ]
        }
      },

      // Journey step timings (seconds)
      stepTimings: {
        qrScan: { min: 2, max: 8 },
        transactionEntry: { min: 15, max: 45 },
        voiceSetup: { min: 5, max: 15 },
        feedbackSession: { min: 45, max: 180 },
        aiProcessing: { min: 3, max: 12 },
        rewardProcessing: { min: 2, max: 8 }
      },

      // Success rates for different steps
      successRates: {
        qrScan: 0.98,
        transactionVerification: 0.94,
        voicePermission: 0.87,
        feedbackCompletion: 0.91,
        aiProcessing: 0.96,
        paymentProcessing: 0.93
      },

      ...config
    };

    this.transactionGenerator = new MockTransactionGenerator();
    this.journeyResults = [];
    this.activeJourneys = new Map();
  }

  /**
   * Simulate a single complete customer journey
   */
  async simulateCustomerJourney(options = {}) {
    const {
      businessType = 'grocery_store',
      persona = this.getRandomPersona(),
      qrCodeId = uuidv4(),
      includeErrorScenarios = true
    } = options;

    const journeyId = uuidv4();
    const startTime = Date.now();
    
    const journey = {
      journeyId,
      persona,
      businessType,
      qrCodeId,
      startTime,
      steps: [],
      finalStatus: 'in_progress',
      totalDuration: 0,
      rewardAmount: 0,
      errors: []
    };

    this.activeJourneys.set(journeyId, journey);

    try {
      // Step 1: QR Code Scan
      await this.simulateQRScan(journey, includeErrorScenarios);
      
      // Step 2: Transaction Verification  
      await this.simulateTransactionVerification(journey, includeErrorScenarios);
      
      // Step 3: Voice Permission Setup
      await this.simulateVoicePermissionSetup(journey, includeErrorScenarios);
      
      // Step 4: Voice Feedback Session
      await this.simulateVoiceFeedbackSession(journey, includeErrorScenarios);
      
      // Step 5: AI Processing & Scoring
      await this.simulateAIProcessing(journey, includeErrorScenarios);
      
      // Step 6: Reward Processing
      await this.simulateRewardProcessing(journey, includeErrorScenarios);
      
      journey.finalStatus = 'completed';
      
    } catch (error) {
      journey.finalStatus = 'failed';
      journey.errors.push({
        step: error.step || 'unknown',
        message: error.message,
        timestamp: Date.now()
      });
    }

    journey.totalDuration = Date.now() - startTime;
    this.journeyResults.push(journey);
    this.activeJourneys.delete(journeyId);
    
    return journey;
  }

  /**
   * Simulate multiple concurrent customer journeys
   */
  async simulateMultipleJourneys(config = {}) {
    const {
      count = 50,
      concurrency = 10,
      businessTypes = ['grocery_store', 'cafe', 'restaurant'],
      errorRate = 0.15,
      reportProgress = true
    } = config;

    console.log(`🚀 Simulating ${count} customer journeys with ${concurrency} concurrent sessions`);
    
    const journeyPromises = [];
    const results = {
      total: count,
      completed: 0,
      failed: 0,
      byPersona: {},
      byBusinessType: {},
      averageDuration: 0,
      totalRewards: 0,
      errors: []
    };

    // Create journey promises in batches to control concurrency
    for (let i = 0; i < count; i += concurrency) {
      const batchSize = Math.min(concurrency, count - i);
      const batch = [];
      
      for (let j = 0; j < batchSize; j++) {
        const businessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
        const includeErrors = Math.random() < errorRate;
        
        batch.push(this.simulateCustomerJourney({
          businessType,
          includeErrorScenarios: includeErrors
        }));
      }
      
      // Wait for batch to complete before starting next batch
      const batchResults = await Promise.all(batch);
      
      // Update results
      batchResults.forEach(journey => {
        if (journey.finalStatus === 'completed') {
          results.completed++;
          results.totalRewards += journey.rewardAmount;
        } else {
          results.failed++;
          results.errors.push(...journey.errors);
        }
        
        // Track by persona
        if (!results.byPersona[journey.persona.name]) {
          results.byPersona[journey.persona.name] = { count: 0, avgDuration: 0, totalReward: 0 };
        }
        results.byPersona[journey.persona.name].count++;
        results.byPersona[journey.persona.name].totalReward += journey.rewardAmount;
        
        // Track by business type
        if (!results.byBusinessType[journey.businessType]) {
          results.byBusinessType[journey.businessType] = { count: 0, avgDuration: 0, successRate: 0 };
        }
        results.byBusinessType[journey.businessType].count++;
      });
      
      if (reportProgress) {
        const completed = results.completed + results.failed;
        console.log(`Progress: ${completed}/${count} journeys completed (${Math.round(completed/count*100)}%)`);
      }
    }

    // Calculate averages
    results.averageDuration = this.journeyResults
      .slice(-count)
      .reduce((sum, j) => sum + j.totalDuration, 0) / count;
      
    // Update persona averages
    Object.keys(results.byPersona).forEach(persona => {
      const personaJourneys = this.journeyResults
        .slice(-count)
        .filter(j => j.persona.name === persona);
      
      if (personaJourneys.length > 0) {
        results.byPersona[persona].avgDuration = 
          personaJourneys.reduce((sum, j) => sum + j.totalDuration, 0) / personaJourneys.length;
      }
    });

    return results;
  }

  // Individual journey step simulations

  async simulateQRScan(journey, includeErrors) {
    const stepStart = Date.now();
    const timing = this.getRandomTiming('qrScan');
    
    await this.delay(timing * 1000);
    
    // Simulate QR scan failures
    if (includeErrors && Math.random() > this.config.successRates.qrScan) {
      throw { step: 'qr_scan', message: 'QR-kod kunde inte läsas - dålig belysning eller skadad kod' };
    }
    
    journey.steps.push({
      step: 'qr_scan',
      duration: Date.now() - stepStart,
      status: 'success',
      data: {
        qrCodeId: journey.qrCodeId,
        businessType: journey.businessType,
        scannedAt: new Date().toISOString()
      }
    });
  }

  async simulateTransactionVerification(journey, includeErrors) {
    const stepStart = Date.now();
    const timing = this.getRandomTiming('transactionEntry');
    
    // Generate mock transaction
    const transaction = this.transactionGenerator.generateTransaction(journey.businessType);
    
    await this.delay(timing * 1000);
    
    // Simulate transaction verification failures
    if (includeErrors && Math.random() > this.config.successRates.transactionVerification) {
      throw { step: 'transaction_verification', message: 'Transaktionen kunde inte verifieras - kontrollera kvittodetaljer' };
    }
    
    journey.transaction = transaction;
    journey.steps.push({
      step: 'transaction_verification',
      duration: Date.now() - stepStart,
      status: 'success',
      data: {
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        timestamp: transaction.timestamp,
        verified: true
      }
    });
  }

  async simulateVoicePermissionSetup(journey, includeErrors) {
    const stepStart = Date.now();
    const timing = this.getRandomTiming('voiceSetup');
    
    await this.delay(timing * 1000);
    
    // Simulate voice permission failures (common on mobile)
    if (includeErrors && Math.random() > this.config.successRates.voicePermission) {
      throw { step: 'voice_permission', message: 'Mikrofonbehörighet nekades eller blockerades av webbläsaren' };
    }
    
    journey.steps.push({
      step: 'voice_permission_setup',
      duration: Date.now() - stepStart,
      status: 'success',
      data: {
        deviceType: this.getRandomDeviceType(),
        browser: this.getRandomBrowser(),
        permissionGranted: true
      }
    });
  }

  async simulateVoiceFeedbackSession(journey, includeErrors) {
    const stepStart = Date.now();
    const persona = journey.persona;
    const sessionDuration = this.getRandomRange(persona.sessionDuration);
    
    // Generate contextual feedback based on persona and business
    const feedbackText = this.generateFeedback(journey.businessType, persona);
    
    await this.delay(sessionDuration * 1000);
    
    // Simulate feedback completion failures
    if (includeErrors && Math.random() > this.config.successRates.feedbackCompletion) {
      throw { step: 'feedback_session', message: 'Röstsessionen avbröts - för mycket bakgrundsljud eller tekniskt problem' };
    }
    
    journey.feedbackText = feedbackText;
    journey.steps.push({
      step: 'voice_feedback_session',
      duration: Date.now() - stepStart,
      status: 'success',
      data: {
        transcript: feedbackText,
        duration: sessionDuration,
        language: persona.language,
        audioQuality: this.getRandomRange({ min: 0.7, max: 0.95 })
      }
    });
  }

  async simulateAIProcessing(journey, includeErrors) {
    const stepStart = Date.now();
    const timing = this.getRandomTiming('aiProcessing');
    const persona = journey.persona;
    
    await this.delay(timing * 1000);
    
    // Simulate AI processing failures
    if (includeErrors && Math.random() > this.config.successRates.aiProcessing) {
      throw { step: 'ai_processing', message: 'AI-utvärdering misslyckades - systemfel eller otillräcklig feedbackkvalitet' };
    }
    
    // Generate quality score based on persona characteristics
    const qualityScore = this.generateQualityScore(journey.feedbackText, persona);
    
    journey.qualityScore = qualityScore;
    journey.steps.push({
      step: 'ai_processing',
      duration: Date.now() - stepStart,
      status: 'success',
      data: {
        qualityScore,
        reasoning: this.generateAIReasoning(qualityScore, persona),
        categories: this.detectFeedbackCategories(journey.feedbackText),
        confidence: this.getRandomRange({ min: 0.82, max: 0.97 })
      }
    });
  }

  async simulateRewardProcessing(journey, includeErrors) {
    const stepStart = Date.now();
    const timing = this.getRandomTiming('rewardProcessing');
    
    await this.delay(timing * 1000);
    
    // Simulate payment processing failures
    if (includeErrors && Math.random() > this.config.successRates.paymentProcessing) {
      throw { step: 'reward_processing', message: 'Belöningsutbetalning misslyckades - bankfel eller ogiltigt konto' };
    }
    
    // Calculate reward based on quality score and transaction amount
    const rewardPercentage = this.calculateRewardPercentage(journey.qualityScore);
    const rewardAmount = Math.round((journey.transaction.amount * rewardPercentage / 100) * 100) / 100;
    
    journey.rewardAmount = rewardAmount;
    journey.steps.push({
      step: 'reward_processing',
      duration: Date.now() - stepStart,
      status: 'success',
      data: {
        rewardAmount,
        rewardPercentage,
        qualityScore: journey.qualityScore.total,
        paymentMethod: 'Swish',
        paymentStatus: 'completed'
      }
    });
  }

  // Helper methods

  getRandomPersona() {
    const personas = Object.keys(this.config.customerPersonas);
    const personaName = personas[Math.floor(Math.random() * personas.length)];
    return {
      name: personaName,
      ...this.config.customerPersonas[personaName]
    };
  }

  getRandomTiming(stepName) {
    const timing = this.config.stepTimings[stepName];
    return Math.random() * (timing.max - timing.min) + timing.min;
  }

  getRandomRange(range) {
    return Math.random() * (range.max - range.min) + range.min;
  }

  getRandomDeviceType() {
    const devices = ['iPhone 14', 'iPhone 13', 'Samsung Galaxy S23', 'Google Pixel 7', 'OnePlus 11'];
    return devices[Math.floor(Math.random() * devices.length)];
  }

  getRandomBrowser() {
    const browsers = ['Safari Mobile', 'Chrome Mobile', 'Samsung Internet', 'Firefox Mobile'];
    const weights = [0.65, 0.25, 0.07, 0.03]; // iOS Safari dominance in Sweden
    
    let random = Math.random();
    for (let i = 0; i < browsers.length; i++) {
      random -= weights[i];
      if (random <= 0) return browsers[i];
    }
    return 'Safari Mobile';
  }

  generateFeedback(businessType, persona) {
    const templates = this.config.feedbackTemplates[businessType];
    if (!templates) return 'Bra service och trevlig personal. Kommer tillbaka snart.';
    
    // Choose between positive and constructive feedback based on persona
    const isPositive = Math.random() < 0.7; // 70% positive feedback
    const feedbackArray = isPositive ? templates.positive : templates.constructive;
    
    let feedback = feedbackArray[Math.floor(Math.random() * feedbackArray.length)];
    
    // Add persona-specific touches
    if (persona.feedbackTopics) {
      const topic = persona.feedbackTopics[Math.floor(Math.random() * persona.feedbackTopics.length)];
      if (Math.random() < 0.3) { // 30% chance to add persona-specific comment
        feedback += ` Särskilt viktigt för mig är ${topic.replace('-', ' ')}.`;
      }
    }
    
    return feedback;
  }

  generateQualityScore(feedbackText, persona) {
    const baseRange = persona.qualityRange;
    const total = Math.floor(Math.random() * (baseRange.max - baseRange.min) + baseRange.min);
    
    // Generate component scores that add up to total
    const authenticity = Math.floor(total * 0.4 + Math.random() * 10 - 5);
    const concreteness = Math.floor(total * 0.3 + Math.random() * 10 - 5);
    const depth = total - authenticity - concreteness + Math.floor(total * 0.3);
    
    return {
      authenticity: Math.max(0, Math.min(100, authenticity)),
      concreteness: Math.max(0, Math.min(100, concreteness)),
      depth: Math.max(0, Math.min(100, depth)),
      total: total
    };
  }

  generateAIReasoning(qualityScore, persona) {
    const reasons = [];
    
    if (qualityScore.authenticity > 80) {
      reasons.push('Autentisk feedback med specifika observationer från verklig kundupplevelse');
    }
    if (qualityScore.concreteness > 75) {
      reasons.push('Konkret och handlingsbar information som företaget kan använda för förbättringar');
    }
    if (qualityScore.depth > 70) {
      reasons.push('Djupgående analys som visar reflektion och genomtanke');
    }
    
    if (reasons.length === 0) {
      reasons.push('Grundläggande feedback som ger viss värde men kunde varit mer detaljerad');
    }
    
    return reasons.join('. ') + '.';
  }

  detectFeedbackCategories(feedbackText) {
    const categoryKeywords = {
      'Service': ['personal', 'service', 'hjälpsam', 'trevlig', 'kunnig'],
      'Produkt': ['kvalitet', 'fräsch', 'urval', 'produkter', 'varor'],
      'Miljö': ['atmosfär', 'mysig', 'ren', 'ljus', 'musik'],
      'Pris': ['pris', 'billig', 'dyr', 'rimlig', 'kostnad'],
      'Tillgänglighet': ['tillgänglig', 'parkering', 'öppettider', 'lätt', 'svår']
    };
    
    const categories = [];
    const lowerText = feedbackText.toLowerCase();
    
    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        categories.push(category);
      }
    });
    
    return categories.length > 0 ? categories : ['Allmänt'];
  }

  calculateRewardPercentage(qualityScore) {
    // 1-12% reward range based on quality score
    const minReward = 1;
    const maxReward = 12;
    const normalizedScore = qualityScore.total / 100;
    
    return minReward + (normalizedScore * (maxReward - minReward));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport(results) {
    const report = {
      testSummary: {
        totalJourneys: results.total,
        successRate: `${Math.round((results.completed / results.total) * 100)}%`,
        averageDuration: `${Math.round(results.averageDuration / 1000)}s`,
        totalRewardsDistributed: `${results.totalRewards.toFixed(2)} SEK`,
        averageRewardPerJourney: `${(results.totalRewards / results.completed).toFixed(2)} SEK`
      },
      
      performanceMetrics: {
        byPersona: results.byPersona,
        byBusinessType: results.byBusinessType,
        stepPerformance: this.analyzeStepPerformance()
      },
      
      errorAnalysis: {
        totalErrors: results.errors.length,
        errorsByStep: this.groupErrorsByStep(results.errors),
        mostCommonErrors: this.getMostCommonErrors(results.errors)
      },
      
      recommendations: this.generateRecommendations(results),
      
      swedishPilotReadiness: {
        score: this.calculatePilotReadiness(results),
        criticalIssues: this.identifyCriticalIssues(results),
        strengths: this.identifySystemStrengths(results)
      }
    };
    
    return report;
  }

  analyzeStepPerformance() {
    const stepAnalysis = {};
    
    this.journeyResults.forEach(journey => {
      journey.steps.forEach(step => {
        if (!stepAnalysis[step.step]) {
          stepAnalysis[step.step] = {
            totalExecutions: 0,
            totalDuration: 0,
            successCount: 0,
            averageDuration: 0,
            successRate: 0
          };
        }
        
        stepAnalysis[step.step].totalExecutions++;
        stepAnalysis[step.step].totalDuration += step.duration;
        if (step.status === 'success') {
          stepAnalysis[step.step].successCount++;
        }
      });
    });
    
    // Calculate averages
    Object.keys(stepAnalysis).forEach(step => {
      const analysis = stepAnalysis[step];
      analysis.averageDuration = Math.round(analysis.totalDuration / analysis.totalExecutions);
      analysis.successRate = Math.round((analysis.successCount / analysis.totalExecutions) * 100);
    });
    
    return stepAnalysis;
  }

  groupErrorsByStep(errors) {
    const grouped = {};
    errors.forEach(error => {
      if (!grouped[error.step]) {
        grouped[error.step] = [];
      }
      grouped[error.step].push(error.message);
    });
    return grouped;
  }

  getMostCommonErrors(errors) {
    const errorCounts = {};
    errors.forEach(error => {
      const key = `${error.step}: ${error.message}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    if (results.completed / results.total < 0.9) {
      recommendations.push('Förbättra systemstabilitet - mindre än 90% framgångsrate');
    }
    
    if (results.averageDuration > 180000) { // > 3 minutes
      recommendations.push('Optimera prestanda - genomsnittstid över 3 minuter');
    }
    
    if (results.totalRewards / results.completed < 15) {
      recommendations.push('Granska belöningsalgoritm - låg genomsnittlig belöning');
    }
    
    return recommendations;
  }

  calculatePilotReadiness(results) {
    let score = 100;
    
    // Deduct points for issues
    const successRate = results.completed / results.total;
    if (successRate < 0.95) score -= (0.95 - successRate) * 100;
    
    if (results.averageDuration > 120000) score -= 10; // Slow performance
    if (results.errors.length > results.total * 0.1) score -= 15; // Too many errors
    
    return Math.max(0, Math.round(score));
  }

  identifyCriticalIssues(results) {
    const issues = [];
    
    if (results.completed / results.total < 0.85) {
      issues.push('Låg framgångsrate - kritiskt för användarupplevelse');
    }
    
    const voiceErrors = results.errors.filter(e => e.step === 'voice_permission').length;
    if (voiceErrors > results.total * 0.15) {
      issues.push('För många rösttillståndsproblem - påverkar mobil UX');
    }
    
    return issues;
  }

  identifySystemStrengths(results) {
    const strengths = [];
    
    if (results.completed / results.total > 0.92) {
      strengths.push('Hög systemstabilitet och tillförlitlighet');
    }
    
    if (results.totalRewards / results.completed > 20) {
      strengths.push('Attraktiv belöningsnivå för kunder');
    }
    
    if (results.averageDuration < 90000) {
      strengths.push('Snabb och effektiv användarupplevelse');
    }
    
    return strengths;
  }
}

module.exports = { CustomerJourneySimulator };

// CLI usage example
if (require.main === module) {
  const simulator = new CustomerJourneySimulator();
  
  async function runSimulation() {
    console.log('🇸🇪 Customer Journey Simulator - AI Feedback Platform Testing');
    console.log('============================================================\n');
    
    // Single journey test
    console.log('Testing single customer journey...');
    const singleJourney = await simulator.simulateCustomerJourney({
      businessType: 'grocery_store',
      includeErrorScenarios: false
    });
    
    console.log(`✅ Journey completed in ${Math.round(singleJourney.totalDuration/1000)}s`);
    console.log(`   Persona: ${singleJourney.persona.name}`);
    console.log(`   Quality Score: ${singleJourney.qualityScore?.total || 'N/A'}`);
    console.log(`   Reward: ${singleJourney.rewardAmount} SEK\n`);
    
    // Multiple journeys test
    console.log('Running batch simulation (20 journeys)...');
    const results = await simulator.simulateMultipleJourneys({
      count: 20,
      concurrency: 5,
      errorRate: 0.1
    });
    
    const report = simulator.generateTestReport(results);
    
    console.log('\n📊 Test Results Summary:');
    console.log(`   Success Rate: ${report.testSummary.successRate}`);
    console.log(`   Average Duration: ${report.testSummary.averageDuration}`);
    console.log(`   Total Rewards: ${report.testSummary.totalRewardsDistributed}`);
    console.log(`   Pilot Readiness: ${report.swedishPilotReadiness.score}/100`);
    
    if (report.swedishPilotReadiness.criticalIssues.length > 0) {
      console.log('\n⚠️  Critical Issues:');
      report.swedishPilotReadiness.criticalIssues.forEach(issue => 
        console.log(`   - ${issue}`)
      );
    }
    
    if (report.swedishPilotReadiness.strengths.length > 0) {
      console.log('\n💪 System Strengths:');
      report.swedishPilotReadiness.strengths.forEach(strength => 
        console.log(`   - ${strength}`)
      );
    }
  }
  
  runSimulation().catch(console.error);
}