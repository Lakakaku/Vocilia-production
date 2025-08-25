/**
 * Mock Transaction Generator for System Testing
 * 
 * Generates realistic Swedish retail transactions for testing the AI feedback platform.
 * Supports multiple business types, payment methods, and transaction patterns.
 */

const { v4: uuidv4 } = require('uuid');
const { addMinutes, addHours, addDays, subDays, format } = require('date-fns');
const { sv } = require('date-fns/locale');

class MockTransactionGenerator {
  constructor(config = {}) {
    this.config = {
      // Swedish business types and their typical transaction patterns
      businessTypes: {
        grocery_store: {
          avgAmount: 450,
          amountVariance: 200,
          peakHours: [17, 18, 19], // Evening rush
          commonItems: [
            'Mjölk Arla 1L', 'Bröd Pågen', 'Bananer', 'Köttfärs 500g', 'Äpplen',
            'Kaffe Gevalia', 'Ägg 12st', 'Smör Bregott', 'Yoghurt Skånemejerier',
            'Potatis 2kg', 'Pasta Barilla', 'Kött Korv', 'Ost Västerbotten'
          ],
          departments: ['Mejeri', 'Kött & Chark', 'Frukt & Grönt', 'Bageri', 'Torrvaror']
        },
        cafe: {
          avgAmount: 85,
          amountVariance: 30,
          peakHours: [8, 12, 15], // Breakfast, lunch, fika
          commonItems: [
            'Kaffe Latte', 'Cappuccino', 'Espresso', 'Te Earl Grey', 'Macchiato',
            'Kanelbulle', 'Smörgås Skinka', 'Sallad Caesar', 'Croissant', 'Muffin',
            'Smoothie Bär', 'Sandwich Club', 'Bagel Lax', 'Kaka Choklad'
          ],
          departments: ['Kaffe & Te', 'Bakverk', 'Lunchmenyn', 'Drycker']
        },
        restaurant: {
          avgAmount: 320,
          amountVariance: 150,
          peakHours: [12, 18, 19, 20], // Lunch and dinner
          commonItems: [
            'Pizza Margherita', 'Pasta Carbonara', 'Hamburgare Classic', 'Sallad Kyckling',
            'Fisk & Chips', 'Kött Köttbullar', 'Vegetarisk Pasta', 'Lax Grillad',
            'Soppa Dagens', 'Desert Cheesecake', 'Vin Rött Glas', 'Öl Lokal'
          ],
          departments: ['Huvudrätter', 'Förrätter', 'Desserter', 'Drycker']
        },
        retail: {
          avgAmount: 750,
          amountVariance: 400,
          peakHours: [11, 14, 16, 17], // Varied shopping times
          commonItems: [
            'T-shirt H&M', 'Jeans Levi\'s', 'Skor Nike', 'Väska Handväska',
            'Parfym Hugo Boss', 'Smink Maybelline', 'Bok Roman', 'Leksak LEGO',
            'Elektronik Hörlurar', 'Klocka Daniel Wellington', 'Scarf Vintage'
          ],
          departments: ['Kläder', 'Skor', 'Accessoarer', 'Skönhet', 'Elektronik']
        }
      },

      // Swedish payment methods distribution
      paymentMethods: {
        'Kort Swish': 0.35,
        'Kort Kontaktlös': 0.30,
        'Kort Chip & PIN': 0.25,
        'Kontanter': 0.08,
        'Kort Mobil': 0.02
      },

      // Swedish locations with realistic data
      locations: [
        { city: 'Stockholm', region: 'Stockholm', postalCode: '111 29' },
        { city: 'Göteborg', region: 'Västra Götaland', postalCode: '411 05' },
        { city: 'Malmö', region: 'Skåne', postalCode: '211 22' },
        { city: 'Uppsala', region: 'Uppsala', postalCode: '753 10' },
        { city: 'Linköping', region: 'Östergötland', postalCode: '582 19' },
        { city: 'Västerås', region: 'Västmanland', postalCode: '721 30' },
        { city: 'Örebro', region: 'Örebro', postalCode: '701 82' },
        { city: 'Norrköping', region: 'Östergötland', postalCode: '602 23' }
      ],

      // Time patterns for realistic transaction timing
      timePatterns: {
        weekday: { weight: 0.7, hourMultipliers: this.getWeekdayHourMultipliers() },
        weekend: { weight: 0.3, hourMultipliers: this.getWeekendHourMultipliers() }
      },

      ...config
    };
  }

  /**
   * Generate a single mock transaction
   */
  generateTransaction(businessType = 'grocery_store', customTime = null) {
    const business = this.config.businessTypes[businessType];
    const transactionId = this.generateTransactionId(businessType);
    const timestamp = customTime || this.generateRealisticTimestamp();
    const location = this.getRandomLocation();
    
    // Generate amount based on business type patterns
    const amount = this.generateAmount(business.avgAmount, business.amountVariance);
    
    // Generate items based on business type
    const items = this.generateItems(business);
    
    // Select payment method based on Swedish preferences
    const paymentMethod = this.selectPaymentMethod();
    
    return {
      transactionId,
      businessType,
      timestamp,
      amount,
      currency: 'SEK',
      paymentMethod,
      location,
      items,
      metadata: {
        posSystem: this.selectPOSSystem(),
        receiptNumber: this.generateReceiptNumber(),
        cashierNumber: this.generateCashierNumber(),
        terminalId: this.generateTerminalId(),
        moms: this.calculateVAT(amount, items)
      },
      customerData: {
        loyaltyCard: Math.random() < 0.6, // 60% have loyalty cards
        age: this.generateCustomerAge(),
        paymentPreference: paymentMethod,
        visitFrequency: this.generateVisitFrequency()
      }
    };
  }

  /**
   * Generate multiple transactions for batch testing
   */
  generateTransactionBatch(count = 100, businessType = 'grocery_store', timeRange = 'today') {
    const transactions = [];
    const timeGenerator = this.getTimeGenerator(timeRange);
    
    for (let i = 0; i < count; i++) {
      const timestamp = timeGenerator();
      const transaction = this.generateTransaction(businessType, timestamp);
      transactions.push(transaction);
    }
    
    // Sort by timestamp for realistic ordering
    return transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Generate transactions for Swedish pilot simulation
   */
  generateSwedishPilotData(config = {}) {
    const {
      businessCount = 20,
      transactionsPerBusiness = 50,
      timeSpan = 7, // days
      businessTypes = ['grocery_store', 'cafe', 'restaurant', 'retail']
    } = config;

    const pilotData = {
      businesses: [],
      transactions: [],
      summary: {
        totalBusinesses: businessCount,
        totalTransactions: businessCount * transactionsPerBusiness,
        timeSpan: `${timeSpan} dagar`,
        dateRange: {
          start: subDays(new Date(), timeSpan),
          end: new Date()
        }
      }
    };

    // Generate Swedish businesses
    for (let i = 0; i < businessCount; i++) {
      const businessType = businessTypes[i % businessTypes.length];
      const business = this.generateSwedishBusiness(businessType, i);
      pilotData.businesses.push(business);

      // Generate transactions for this business
      const businessTransactions = this.generateTransactionBatch(
        transactionsPerBusiness,
        businessType,
        `last_${timeSpan}_days`
      ).map(transaction => ({
        ...transaction,
        businessId: business.id,
        businessName: business.name,
        businessOrgNumber: business.orgNumber
      }));

      pilotData.transactions.push(...businessTransactions);
    }

    return pilotData;
  }

  /**
   * Generate realistic Swedish business data
   */
  generateSwedishBusiness(businessType, index) {
    const location = this.getRandomLocation();
    const businessNames = {
      grocery_store: ['ICA Maxi', 'Coop Extra', 'Willys', 'City Gross', 'ICA Kvantum'],
      cafe: ['Espresso House', 'Wayne\'s Coffee', 'Café Linnea', 'Bageri Petrus', 'Café Mokka'],
      restaurant: ['Max Burgers', 'Pizzeria Milano', 'Restaurang Hjärtat', 'Kött & Kockar', 'Thai Garden'],
      retail: ['H&M', 'Lindex', 'KappAhl', 'Ellos', 'Åhléns']
    };
    
    const names = businessNames[businessType];
    const name = `${names[index % names.length]} ${location.city}`;
    
    return {
      id: uuidv4(),
      name,
      businessType,
      orgNumber: this.generateSwedishOrgNumber(),
      location,
      contact: {
        email: `${name.toLowerCase().replace(/\s+/g, '').replace(/[åäö]/g, 'a')}@example.se`,
        phone: this.generateSwedishPhoneNumber(),
        address: `${this.generateSwedishAddress()} ${location.postalCode} ${location.city}`
      },
      tier: Math.floor(Math.random() * 3) + 1, // 1-3 tier system
      monthlyVolume: Math.floor(Math.random() * 10000) + 1000,
      established: subDays(new Date(), Math.floor(Math.random() * 365 * 10)) // Up to 10 years ago
    };
  }

  // Helper Methods

  generateTransactionId(businessType) {
    const prefix = {
      grocery_store: 'GRC',
      cafe: 'CAF', 
      restaurant: 'RST',
      retail: 'RTL'
    }[businessType] || 'TXN';
    
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }

  generateAmount(avgAmount, variance) {
    const baseAmount = avgAmount + (Math.random() - 0.5) * variance * 2;
    // Ensure minimum amount and round to nearest krona
    return Math.max(10, Math.round(baseAmount));
  }

  generateItems(business) {
    const itemCount = Math.floor(Math.random() * 8) + 1; // 1-8 items
    const items = [];
    const availableItems = [...business.commonItems];
    
    for (let i = 0; i < itemCount; i++) {
      if (availableItems.length === 0) break;
      
      const randomIndex = Math.floor(Math.random() * availableItems.length);
      const item = availableItems.splice(randomIndex, 1)[0];
      
      items.push({
        name: item,
        quantity: Math.floor(Math.random() * 3) + 1,
        price: Math.floor(Math.random() * 150) + 10, // 10-160 SEK per item
        department: business.departments[Math.floor(Math.random() * business.departments.length)]
      });
    }
    
    return items;
  }

  selectPaymentMethod() {
    const random = Math.random();
    let cumulative = 0;
    
    for (const [method, probability] of Object.entries(this.config.paymentMethods)) {
      cumulative += probability;
      if (random <= cumulative) {
        return method;
      }
    }
    
    return 'Kort Swish'; // Fallback
  }

  generateRealisticTimestamp() {
    const now = new Date();
    const daysBack = Math.floor(Math.random() * 30); // Last 30 days
    const baseDate = subDays(now, daysBack);
    
    // Determine if weekday or weekend
    const dayOfWeek = baseDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const pattern = isWeekend ? this.config.timePatterns.weekend : this.config.timePatterns.weekday;
    const hour = this.selectHourByWeight(pattern.hourMultipliers);
    const minute = Math.floor(Math.random() * 60);
    
    baseDate.setHours(hour, minute, Math.floor(Math.random() * 60));
    
    return baseDate;
  }

  selectHourByWeight(hourMultipliers) {
    const random = Math.random();
    const totalWeight = Object.values(hourMultipliers).reduce((sum, weight) => sum + weight, 0);
    let cumulative = 0;
    
    for (const [hour, weight] of Object.entries(hourMultipliers)) {
      cumulative += weight / totalWeight;
      if (random <= cumulative) {
        return parseInt(hour);
      }
    }
    
    return 12; // Fallback to noon
  }

  getWeekdayHourMultipliers() {
    // Higher weights during business hours and evening rush
    const multipliers = {};
    for (let hour = 0; hour < 24; hour++) {
      if (hour >= 7 && hour <= 9) multipliers[hour] = 2.5; // Morning rush
      else if (hour >= 11 && hour <= 13) multipliers[hour] = 2.0; // Lunch
      else if (hour >= 17 && hour <= 19) multipliers[hour] = 3.0; // Evening rush
      else if (hour >= 10 && hour <= 21) multipliers[hour] = 1.5; // Normal business hours
      else multipliers[hour] = 0.2; // Off hours
    }
    return multipliers;
  }

  getWeekendHourMultipliers() {
    // More spread out shopping on weekends
    const multipliers = {};
    for (let hour = 0; hour < 24; hour++) {
      if (hour >= 10 && hour <= 18) multipliers[hour] = 2.0; // Peak weekend shopping
      else if (hour >= 8 && hour <= 21) multipliers[hour] = 1.2; // Extended hours
      else multipliers[hour] = 0.3; // Off hours
    }
    return multipliers;
  }

  getTimeGenerator(timeRange) {
    const now = new Date();
    
    switch (timeRange) {
      case 'today':
        return () => {
          const today = new Date(now);
          today.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
          return today;
        };
      
      case 'this_week':
        return () => addDays(subDays(now, 7), Math.floor(Math.random() * 7));
      
      case 'last_7_days':
        return () => addDays(subDays(now, 7), Math.floor(Math.random() * 7));
      
      default:
        const match = timeRange.match(/last_(\d+)_days/);
        if (match) {
          const days = parseInt(match[1]);
          return () => addDays(subDays(now, days), Math.floor(Math.random() * days));
        }
        return () => this.generateRealisticTimestamp();
    }
  }

  getRandomLocation() {
    return this.config.locations[Math.floor(Math.random() * this.config.locations.length)];
  }

  selectPOSSystem() {
    const systems = ['Visma Retail', 'Litium', 'Voyado', 'Sitoo', 'StoreHub'];
    return systems[Math.floor(Math.random() * systems.length)];
  }

  generateReceiptNumber() {
    return Math.floor(Math.random() * 999999) + 100000; // 6-digit receipt number
  }

  generateCashierNumber() {
    return Math.floor(Math.random() * 50) + 1; // Cashier 1-50
  }

  generateTerminalId() {
    return `TERM-${Math.floor(Math.random() * 20) + 1}`;
  }

  calculateVAT(amount, items) {
    // Swedish VAT rates: 25% (standard), 12% (food), 6% (books, transport)
    const vatRates = { 25: 0.8, 12: 0.15, 6: 0.05 }; // Distribution of rates
    const random = Math.random();
    let selectedRate = 25; // Default
    
    let cumulative = 0;
    for (const [rate, probability] of Object.entries(vatRates)) {
      cumulative += probability;
      if (random <= cumulative) {
        selectedRate = parseInt(rate);
        break;
      }
    }
    
    const vatAmount = (amount * selectedRate) / (100 + selectedRate);
    return {
      rate: `${selectedRate}%`,
      amount: Math.round(vatAmount * 100) / 100,
      included: true
    };
  }

  generateCustomerAge() {
    // Weighted age distribution typical for Swedish retail
    const ageRanges = {
      '18-25': 0.15,
      '26-35': 0.25,
      '36-45': 0.25,
      '46-55': 0.20,
      '56-65': 0.10,
      '65+': 0.05
    };
    
    const random = Math.random();
    let cumulative = 0;
    
    for (const [range, probability] of Object.entries(ageRanges)) {
      cumulative += probability;
      if (random <= cumulative) {
        return range;
      }
    }
    
    return '26-35'; // Fallback
  }

  generateVisitFrequency() {
    const frequencies = ['Första gången', 'Sällan', 'Månadsvis', 'Veckovis', 'Flera gånger/vecka', 'Dagligen'];
    const weights = [0.05, 0.15, 0.20, 0.35, 0.20, 0.05];
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < frequencies.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return frequencies[i];
      }
    }
    
    return 'Veckovis'; // Fallback
  }

  generateSwedishOrgNumber() {
    // Generate valid Swedish organization number format: XXXXXX-XXXX
    const firstPart = Math.floor(Math.random() * 900000) + 100000;
    const secondPart = Math.floor(Math.random() * 9000) + 1000;
    return `${firstPart}-${secondPart}`;
  }

  generateSwedishPhoneNumber() {
    // Swedish mobile number format: +46 7X XXX XX XX
    const area = Math.floor(Math.random() * 9) + 1; // 1-9
    const number = Math.floor(Math.random() * 9000000) + 1000000;
    return `+46 7${area} ${number.toString().slice(0,3)} ${number.toString().slice(3,5)} ${number.toString().slice(5,7)}`;
  }

  generateSwedishAddress() {
    const streetNames = [
      'Storgatan', 'Västergatan', 'Östergatan', 'Järnvägsgatan', 'Kungsgatan',
      'Hamngatan', 'Biblioteksgatan', 'Drottninggatan', 'Nygatan', 'Torggatan'
    ];
    const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
    const number = Math.floor(Math.random() * 200) + 1;
    const suffix = Math.random() < 0.3 ? String.fromCharCode(65 + Math.floor(Math.random() * 26)) : '';
    
    return `${streetName} ${number}${suffix}`;
  }

  /**
   * Export transaction data in various formats for testing
   */
  exportTransactions(transactions, format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(transactions, null, 2);
      
      case 'csv':
        const headers = ['transactionId', 'businessType', 'timestamp', 'amount', 'paymentMethod', 'location'];
        const csvRows = transactions.map(t => [
          t.transactionId,
          t.businessType,
          t.timestamp,
          t.amount,
          t.paymentMethod,
          `${t.location.city}, ${t.location.region}`
        ].join(','));
        
        return [headers.join(','), ...csvRows].join('\n');
      
      case 'sql':
        const insertStatements = transactions.map(t => 
          `INSERT INTO transactions (id, business_type, timestamp, amount, payment_method, location) VALUES ('${t.transactionId}', '${t.businessType}', '${t.timestamp}', ${t.amount}, '${t.paymentMethod}', '${t.location.city}');`
        );
        return insertStatements.join('\n');
      
      default:
        return transactions;
    }
  }
}

module.exports = { MockTransactionGenerator };

// Usage examples for testing
if (require.main === module) {
  const generator = new MockTransactionGenerator();
  
  console.log('🇸🇪 Mock Transaction Generator - Swedish Retail Testing');
  console.log('======================================================\n');
  
  // Single transaction example
  console.log('Single Transaction Example:');
  console.log(JSON.stringify(generator.generateTransaction('grocery_store'), null, 2));
  console.log('\n---\n');
  
  // Batch generation example
  console.log('Batch Generation (10 café transactions):');
  const batch = generator.generateTransactionBatch(10, 'cafe', 'today');
  batch.forEach(t => console.log(`${t.transactionId}: ${t.amount} SEK at ${format(new Date(t.timestamp), 'HH:mm', { locale: sv })}`));
  console.log('\n---\n');
  
  // Swedish pilot data example
  console.log('Swedish Pilot Data Summary:');
  const pilotData = generator.generateSwedishPilotData({ businessCount: 5, transactionsPerBusiness: 20 });
  console.log(`Generated ${pilotData.businesses.length} businesses with ${pilotData.transactions.length} total transactions`);
  console.log(`Time span: ${format(pilotData.summary.dateRange.start, 'yyyy-MM-dd')} to ${format(pilotData.summary.dateRange.end, 'yyyy-MM-dd')}`);
  
  pilotData.businesses.forEach(b => {
    const businessTransactions = pilotData.transactions.filter(t => t.businessId === b.id);
    const totalRevenue = businessTransactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(`- ${b.name} (${b.businessType}): ${businessTransactions.length} transactions, ${totalRevenue} SEK total`);
  });
}