import { SwedishMockData } from './types';

/**
 * Swedish Mock Data Generator for Square Testing
 * 
 * Provides realistic Swedish business and transaction data for:
 * - Sandbox testing and development
 * - Demo environments
 * - Integration testing
 * - Swedish pilot program simulation
 */
export class SquareMockData {
  private swedishBusinesses: SwedishMockData['businesses'] = [
    {
      name: 'Aurora Café Stockholm',
      orgNumber: '556123-4567',
      location: 'Stockholm, Gamla Stan',
      merchantId: 'AURORA_STOCKHOLM_MERCHANT',
      locationId: 'AURORA_STOCKHOLM_LOC'
    },
    {
      name: 'Fika Kaffebar Göteborg',
      orgNumber: '556234-5678',
      location: 'Göteborg, Avenyn',
      merchantId: 'FIKA_GOTEBORG_MERCHANT',
      locationId: 'FIKA_GOTEBORG_LOC'
    },
    {
      name: 'Malmö Bageri & Café',
      orgNumber: '556345-6789',
      location: 'Malmö, Gamla Väster',
      merchantId: 'MALMO_BAGERI_MERCHANT',
      locationId: 'MALMO_BAGERI_LOC'
    },
    {
      name: 'ICA Supermarket Vasastan',
      orgNumber: '556456-7890',
      location: 'Stockholm, Vasastan',
      merchantId: 'ICA_VASASTAN_MERCHANT',
      locationId: 'ICA_VASASTAN_LOC'
    },
    {
      name: 'Coop Konsum Lund',
      orgNumber: '556567-8901',
      location: 'Lund, Centrum',
      merchantId: 'COOP_LUND_MERCHANT',
      locationId: 'COOP_LUND_LOC'
    },
    {
      name: 'Restaurang Sjöbris',
      orgNumber: '556678-9012',
      location: 'Stockholm, Östermalm',
      merchantId: 'SJOBRIS_MERCHANT',
      locationId: 'SJOBRIS_LOC'
    }
  ];

  private swedishProducts = [
    // Café items
    'Kaffe', 'Cappuccino', 'Latte', 'Espresso', 'Chai Latte',
    'Kanelbulle', 'Kardemummabulle', 'Prinsesstårta', 'Kladdkaka',
    'Smörgås med avokado', 'Smörgås med räkor', 'Sallad',
    
    // Grocery items
    'Mjölk', 'Bröd', 'Smör', 'Ost', 'Äpplen', 'Bananer',
    'Kött', 'Kyckling', 'Fisk', 'Potatis', 'Lök', 'Morötter',
    'Pasta', 'Ris', 'Tomat', 'Gurka', 'Yoghurt', 'Ägg',
    
    // Restaurant items
    'Köttbullar med potatis', 'Lax med dillsås', 'Vegetarisk pasta',
    'Husmanskost', 'Fisk och skaldjur', 'Grillad kyckling',
    'Soppa av dagen', 'Dagens lunch', 'Barnmeny'
  ];

  /**
   * Generate realistic Swedish transactions for testing
   */
  generateSwedishTransactions(count: number = 50, locationId?: string): SwedishMockData['transactions'] {
    const transactions: SwedishMockData['transactions'] = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      // Generate transaction time within last 30 days
      const daysBack = Math.floor(Math.random() * 30);
      const hoursBack = Math.floor(Math.random() * 24);
      const minutesBack = Math.floor(Math.random() * 60);
      
      const transactionTime = new Date(now);
      transactionTime.setDate(transactionTime.getDate() - daysBack);
      transactionTime.setHours(transactionTime.getHours() - hoursBack);
      transactionTime.setMinutes(transactionTime.getMinutes() - minutesBack);

      // Determine business type and generate appropriate transaction
      const business = locationId 
        ? this.swedishBusinesses.find(b => b.locationId === locationId)
        : this.swedishBusinesses[Math.floor(Math.random() * this.swedishBusinesses.length)];
      
      if (!business) continue;

      const transaction = this.generateTransactionForBusiness(business, transactionTime);
      transactions.push(transaction);
    }

    // Sort by timestamp (newest first)
    return transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Generate a specific transaction for verification testing
   */
  generateVerificationTransaction(
    locationId: string,
    amount: number,
    timestamp: Date,
    items?: string[]
  ): SwedishMockData['transactions'][0] {
    const business = this.swedishBusinesses.find(b => b.locationId === locationId);
    
    return {
      id: `VERIFY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      currency: 'SEK',
      timestamp: timestamp.toISOString(),
      items: items || this.generateItemsForAmount(amount, this.getBusinessType(business?.name || ''))
    };
  }

  /**
   * Get mock business by location ID
   */
  getBusinessByLocation(locationId: string): SwedishMockData['businesses'][0] | undefined {
    return this.swedishBusinesses.find(b => b.locationId === locationId);
  }

  /**
   * Get all mock businesses
   */
  getAllBusinesses(): SwedishMockData['businesses'] {
    return [...this.swedishBusinesses];
  }

  /**
   * Generate mock location data for Square API
   */
  generateSquareLocation(business: SwedishMockData['businesses'][0]) {
    const addresses = {
      'Stockholm': {
        street: ['Kungsgatan 12', 'Drottninggatan 88', 'Sveavägen 45', 'Östermalmsatan 15'],
        postalCodes: ['111 43', '111 21', '113 60', '114 42']
      },
      'Göteborg': {
        street: ['Avenyn 22', 'Nordstan 8', 'Haga Nygata 15', 'Kungsgatan 55'],
        postalCodes: ['411 36', '411 05', '413 01', '411 19']
      },
      'Malmö': {
        street: ['Södergatan 30', 'Stortorget 5', 'Västergatan 18', 'Stora Nygatan 42'],
        postalCodes: ['211 34', '211 25', '211 37', '211 37']
      },
      'Lund': {
        street: ['Stora Södergatan 8', 'Klostergatan 15', 'Sankt Petri Kyrkogata 3'],
        postalCodes: ['222 23', '223 50', '222 21']
      }
    };

    const city = this.extractCityFromLocation(business.location);
    const cityAddresses = addresses[city as keyof typeof addresses] || addresses.Stockholm;
    const streetIndex = Math.floor(Math.random() * cityAddresses.street.length);

    return {
      id: business.locationId,
      name: business.name,
      address: {
        address_line_1: cityAddresses.street[streetIndex],
        locality: city,
        administrative_district_level_1: this.getCounty(city),
        postal_code: cityAddresses.postalCodes[streetIndex] || '111 11',
        country: 'SE'
      },
      timezone: 'Europe/Stockholm',
      merchant_id: business.merchantId,
      phone_number: this.generateSwedishPhoneNumber(),
      business_name: business.name,
      status: 'ACTIVE' as const,
      created_at: this.generateRandomPastDate().toISOString(),
      capabilities: ['CREDIT_CARD_PROCESSING', 'AUTOMATIC_TRANSFERS', 'DIGITAL_RECEIPTS']
    };
  }

  // Private helper methods
  private generateTransactionForBusiness(
    business: SwedishMockData['businesses'][0],
    timestamp: Date
  ): SwedishMockData['transactions'][0] {
    const businessType = this.getBusinessType(business.name);
    const amount = this.generateRealisticAmount(businessType);
    const items = this.generateItemsForAmount(amount, businessType);

    return {
      id: `TXN_${business.locationId}_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      currency: 'SEK',
      timestamp: timestamp.toISOString(),
      items
    };
  }

  private getBusinessType(businessName: string): 'cafe' | 'grocery' | 'restaurant' {
    if (businessName.toLowerCase().includes('café') || businessName.toLowerCase().includes('fika')) {
      return 'cafe';
    }
    if (businessName.toLowerCase().includes('ica') || businessName.toLowerCase().includes('coop')) {
      return 'grocery';
    }
    return 'restaurant';
  }

  private generateRealisticAmount(businessType: 'cafe' | 'grocery' | 'restaurant'): number {
    let min: number, max: number;
    
    switch (businessType) {
      case 'cafe':
        min = 35; max = 150; // 35-150 SEK for café items
        break;
      case 'grocery':
        min = 50; max = 800; // 50-800 SEK for grocery shopping
        break;
      case 'restaurant':
        min = 120; max = 450; // 120-450 SEK for restaurant meals
        break;
    }

    // Generate amount with realistic distribution (more common amounts)
    const random = Math.random();
    if (random < 0.6) {
      // 60% of transactions in lower range
      return Math.floor(min + (max - min) * 0.4 * Math.random());
    } else {
      // 40% of transactions in higher range
      return Math.floor(min + (max - min) * 0.4 + (max - min) * 0.6 * Math.random());
    }
  }

  private generateItemsForAmount(amount: number, businessType: 'cafe' | 'grocery' | 'restaurant'): string[] {
    const items: string[] = [];
    let remainingAmount = amount;
    
    let availableItems: string[];
    switch (businessType) {
      case 'cafe':
        availableItems = this.swedishProducts.slice(0, 12); // Café items
        break;
      case 'grocery':
        availableItems = this.swedishProducts.slice(12, 24); // Grocery items
        break;
      case 'restaurant':
        availableItems = this.swedishProducts.slice(24); // Restaurant items
        break;
    }

    // Generate 1-5 items
    const itemCount = Math.min(Math.floor(Math.random() * 5) + 1, 5);
    
    for (let i = 0; i < itemCount && remainingAmount > 0; i++) {
      const item = availableItems[Math.floor(Math.random() * availableItems.length)];
      items.push(item);
    }

    return items.length > 0 ? items : ['Diverse varor'];
  }

  private extractCityFromLocation(location: string): string {
    return location.split(',')[0].trim();
  }

  private getCounty(city: string): string {
    const countyMap: Record<string, string> = {
      'Stockholm': 'Stockholm',
      'Göteborg': 'Västra Götaland',
      'Malmö': 'Skåne',
      'Lund': 'Skåne'
    };
    return countyMap[city] || 'Stockholm';
  }

  private generateSwedishPhoneNumber(): string {
    const areaCodes = ['08', '031', '040', '046', '0470', '0480'];
    const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
    const number = Math.floor(Math.random() * 9000000) + 1000000;
    return `+46 ${areaCode.substring(1)} ${number.toString().replace(/(\d{3})(\d{2})(\d{2})/, '$1 $2 $3')}`;
  }

  private generateRandomPastDate(): Date {
    const now = new Date();
    const pastDate = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000); // Up to 1 year ago
    return pastDate;
  }

  /**
   * Create a complete mock dataset for testing
   */
  createMockDataset(): SwedishMockData {
    return {
      businesses: this.getAllBusinesses(),
      transactions: this.generateSwedishTransactions(100)
    };
  }

  /**
   * Generate transactions for a specific time window (useful for verification testing)
   */
  generateTransactionsForTimeWindow(
    locationId: string,
    startTime: Date,
    endTime: Date,
    count: number = 10
  ): SwedishMockData['transactions'] {
    const business = this.getBusinessByLocation(locationId);
    if (!business) return [];

    const transactions: SwedishMockData['transactions'] = [];
    const timeWindow = endTime.getTime() - startTime.getTime();

    for (let i = 0; i < count; i++) {
      const randomTime = new Date(startTime.getTime() + Math.random() * timeWindow);
      const transaction = this.generateTransactionForBusiness(business, randomTime);
      transactions.push(transaction);
    }

    return transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}