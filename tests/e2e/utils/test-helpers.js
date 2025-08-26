/**
 * E2E Test Helper Utilities
 * Common functions for Swedish AI Feedback Platform testing
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Swedish test data generators and helpers
 */
class SwedishTestHelpers {
  
  static generateSwedishBusinessData() {
    return {
      name: this.randomCafeName(),
      orgNumber: this.generateOrgNumber(),
      address: this.randomSwedishAddress(),
      contactEmail: this.randomEmail(),
      phone: this.randomSwedishPhone()
    };
  }

  static randomCafeName() {
    const prefixes = ['Café', 'Kaffehus', 'Espresso', 'Brasserie'];
    const names = ['Aurora', 'Stella', 'Hemma', 'Mysigt', 'Södermalm', 'Gamla Stan'];
    const cities = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås'];
    
    return `${this.randomFrom(prefixes)} ${this.randomFrom(names)} ${this.randomFrom(cities)}`;
  }

  static generateOrgNumber() {
    // Generate valid Swedish organization number (556-format)
    const base = '556' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return base + this.calculateLuhnChecksum(base);
  }

  static randomSwedishAddress() {
    const streets = ['Sveavägen', 'Drottninggatan', 'Götgatan', 'Ringvägen', 'Upplandsgatan'];
    const number = Math.floor(Math.random() * 200) + 1;
    const cities = ['Stockholm', 'Göteborg', 'Malmö'];
    const postalCodes = ['11134', '41136', '21134'];
    
    const street = this.randomFrom(streets);
    const city = this.randomFrom(cities);
    const postal = this.randomFrom(postalCodes);
    
    return `${street} ${number}, ${postal} ${city}`;
  }

  static randomEmail() {
    const domains = ['example.se', 'test.se', 'feedbackai.se'];
    const names = ['info', 'kontakt', 'hej', 'test'];
    return `${this.randomFrom(names)}@${this.randomFrom(domains)}`;
  }

  static randomSwedishPhone() {
    // Generate Swedish mobile number format
    const prefixes = ['070', '072', '073', '076'];
    const number = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    return `${this.randomFrom(prefixes)}${number}`;
  }

  static generateSwedishTransaction() {
    const items = [
      ['kaffe latte', 'kanelbulle'],
      ['cappuccino', 'smörgås'],
      ['americano', 'muffin'],
      ['macchiato', 'croissant'],
      ['lunch sallad', 'mineralvatten'],
      ['veckans soppa', 'surdegsbröd']
    ];

    const selectedItems = this.randomFrom(items);
    const baseAmount = Math.random() * 200 + 30; // 30-230 SEK
    const amount = Math.round(baseAmount * 100) / 100; // Round to 2 decimals

    return {
      id: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      amount: amount,
      items: selectedItems,
      timestamp: new Date().toISOString(),
      paymentMethod: this.randomFrom(['card', 'swish', 'cash'])
    };
  }

  static generateSwedishFeedbackText() {
    const templates = [
      'Jag besökte caféet idag och beställde {ITEMS}. Servicen var {SERVICE_QUALITY}, personalen var {STAFF_QUALITY} och maten var {FOOD_QUALITY}. Lokalen var {ATMOSPHERE_QUALITY}.',
      'Mitt besök på {CAFE_NAME} var {OVERALL_QUALITY}. {ITEMS} smakade {FOOD_QUALITY} och personalen var {STAFF_QUALITY}. {IMPROVEMENT_SUGGESTION}.',
      'Trevligt café med {ATMOSPHERE_QUALITY} atmosfär. Beställde {ITEMS} som var {FOOD_QUALITY}. Servicen kunde vara {SERVICE_IMPROVEMENT}.'
    ];

    const replacements = {
      SERVICE_QUALITY: ['mycket bra', 'bra', 'okej', 'långsam', 'utmärkt'],
      STAFF_QUALITY: ['vänlig', 'hjälpsam', 'professionell', 'trevlig', 'kunnig'],
      FOOD_QUALITY: ['färsk', 'vällagad', 'god', 'kall', 'perfekt'],
      ATMOSPHERE_QUALITY: ['mysig', 'ren', 'modern', 'hemtrevlig', 'lugn'],
      OVERALL_QUALITY: ['mycket positivt', 'bra', 'tillfredsställande'],
      IMPROVEMENT_SUGGESTION: ['Kunde vara snabbare service', 'Mer variation på menyn vore bra', 'Trevligt ställe att återkomma till']
    };

    let feedback = this.randomFrom(templates);
    
    // Replace placeholders
    Object.keys(replacements).forEach(key => {
      if (feedback.includes(`{${key}}`)) {
        feedback = feedback.replace(`{${key}}`, this.randomFrom(replacements[key]));
      }
    });

    // Replace items placeholder
    const items = ['en latte och kanelbulle', 'cappuccino och smörgås', 'lunch och kaffe'];
    feedback = feedback.replace('{ITEMS}', this.randomFrom(items));

    return feedback;
  }

  // Utility methods
  static randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  static calculateLuhnChecksum(number) {
    let sum = 0;
    let alternate = false;
    
    for (let i = number.length - 1; i >= 0; i--) {
      let digit = parseInt(number.charAt(i));
      
      if (alternate) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      alternate = !alternate;
    }
    
    return (10 - (sum % 10)) % 10;
  }
}

/**
 * Page interaction helpers
 */
class PageHelpers {
  
  static async waitForSwedishText(page, selector, expectedText, timeout = 10000) {
    await page.waitForSelector(selector, { timeout });
    await page.waitForFunction(
      (sel, text) => {
        const element = document.querySelector(sel);
        return element && element.textContent.includes(text);
      },
      [selector, expectedText],
      { timeout }
    );
  }

  static async fillSwedishForm(page, formData) {
    for (const [field, value] of Object.entries(formData)) {
      const selector = `[data-testid="${field}"]`;
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.fill(selector, value.toString());
    }
  }

  static async mockSwedishVoiceInput(page, transcript, confidence = 0.9) {
    await page.evaluate((text, conf) => {
      window.mockVoiceInput = {
        transcript: text,
        confidence: conf,
        language: 'sv-SE'
      };
      
      // Trigger voice input event if handler exists
      if (window.onMockVoiceInput) {
        window.onMockVoiceInput(window.mockVoiceInput);
      }
    }, transcript, confidence);
  }

  static async mockWebSocketMessage(page, message) {
    await page.evaluate((msg) => {
      if (window.mockWebSocketMessage) {
        window.mockWebSocketMessage(msg);
      }
    }, message);
  }

  static async takeScreenshotWithTimestamp(page, baseName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${baseName}-${timestamp}.png`;
    const filepath = path.join(__dirname, '../../../test-results/screenshots', filename);
    
    await page.screenshot({ path: filepath, fullPage: true });
    return filename;
  }

  static async verifySwedishCurrency(page, selector) {
    const element = await page.locator(selector);
    const text = await element.textContent();
    
    // Verify Swedish currency format (amount + SEK)
    const swedishCurrencyRegex = /\d+([,.]?\d{0,2})?\s*(SEK|kr)/i;
    return swedishCurrencyRegex.test(text);
  }
}

/**
 * Test data persistence helpers
 */
class TestDataManager {
  
  static async saveTestSession(sessionData) {
    const timestamp = new Date().toISOString();
    const sessionFile = path.join(__dirname, '../fixtures/test-sessions.json');
    
    let sessions = [];
    try {
      const existing = await fs.readFile(sessionFile, 'utf8');
      sessions = JSON.parse(existing);
    } catch (error) {
      // File doesn't exist, start with empty array
    }
    
    sessions.push({
      timestamp,
      ...sessionData
    });
    
    await fs.writeFile(sessionFile, JSON.stringify(sessions, null, 2));
    return sessionData;
  }

  static async loadTestSessions() {
    try {
      const sessionFile = path.join(__dirname, '../fixtures/test-sessions.json');
      const data = await fs.readFile(sessionFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  static async cleanupTestData(olderThanDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const sessions = await this.loadTestSessions();
    const filteredSessions = sessions.filter(session => 
      new Date(session.timestamp) > cutoffDate
    );
    
    const sessionFile = path.join(__dirname, '../fixtures/test-sessions.json');
    await fs.writeFile(sessionFile, JSON.stringify(filteredSessions, null, 2));
    
    return sessions.length - filteredSessions.length; // Return count of cleaned records
  }
}

/**
 * Performance measurement helpers
 */
class PerformanceHelpers {
  
  static startTimer() {
    return Date.now();
  }

  static endTimer(startTime) {
    return Date.now() - startTime;
  }

  static async measurePageLoad(page, url) {
    const startTime = this.startTimer();
    
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    
    const loadTime = this.endTimer(startTime);
    
    // Get additional performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    return {
      totalLoadTime: loadTime,
      ...performanceMetrics
    };
  }

  static async measureActionTime(page, actionFn) {
    const startTime = this.startTimer();
    await actionFn();
    return this.endTimer(startTime);
  }
}

module.exports = {
  SwedishTestHelpers,
  PageHelpers,
  TestDataManager,
  PerformanceHelpers
};