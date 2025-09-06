import crypto from 'crypto';

interface BankAccount {
  clearingNumber: string;
  accountNumber: string;
  bankName?: string;
  accountType?: string;
}

interface SwishPayment {
  phoneNumber: string;
  amount: number;
  message?: string;
  payeeAlias?: string;
}

interface BankgiroPayment {
  bankgiroNumber: string;
  amount: number;
  reference: string;
  dueDate?: Date;
}

interface BankValidationResult {
  valid: boolean;
  bankName?: string;
  accountType?: string;
  error?: string;
}

export class SwedishBankingService {
  private static readonly BANK_CLEARING_RANGES = [
    { start: 1100, end: 1199, bank: 'Nordea', accountLength: 7 },
    { start: 1200, end: 1399, bank: 'Danske Bank', accountLength: 10 },
    { start: 1400, end: 2099, bank: 'Nordea', accountLength: 7 },
    { start: 2300, end: 2399, bank: 'Ålandsbanken', accountLength: 7 },
    { start: 2400, end: 2499, bank: 'Danske Bank', accountLength: 10 },
    { start: 3000, end: 3099, bank: 'Nordea', accountLength: 7 },
    { start: 3100, end: 3199, bank: 'Nordea', accountLength: 7 },
    { start: 3200, end: 3299, bank: 'Nordea', accountLength: 7 },
    { start: 3300, end: 3399, bank: 'Nordea (f.d. Postgirot Bank)', accountLength: 10 },
    { start: 3400, end: 3409, bank: 'Länsförsäkringar Bank', accountLength: 11 },
    { start: 3410, end: 3781, bank: 'Nordea', accountLength: 7 },
    { start: 3782, end: 3782, bank: 'Nordea', accountLength: 10 },
    { start: 3783, end: 3999, bank: 'Nordea', accountLength: 7 },
    { start: 4000, end: 4999, bank: 'Nordea', accountLength: 7 },
    { start: 5000, end: 5999, bank: 'SEB', accountLength: 11 },
    { start: 6000, end: 6999, bank: 'Handelsbanken', accountLength: 9 },
    { start: 7000, end: 7999, bank: 'Swedbank', accountLength: 10 },
    { start: 8000, end: 8999, bank: 'Swedbank', accountLength: 10 },
    { start: 9020, end: 9029, bank: 'Länsförsäkringar Bank', accountLength: 11 },
    { start: 9040, end: 9049, bank: 'Citibank', accountLength: 7 },
    { start: 9060, end: 9069, bank: 'Länsförsäkringar Bank', accountLength: 11 },
    { start: 9090, end: 9099, bank: 'Royal Bank of Scotland', accountLength: 10 },
    { start: 9100, end: 9109, bank: 'Nordnet Bank', accountLength: 7 },
    { start: 9120, end: 9124, bank: 'SEB', accountLength: 11 },
    { start: 9130, end: 9149, bank: 'SEB', accountLength: 11 },
    { start: 9150, end: 9169, bank: 'Skandiabanken', accountLength: 7 },
    { start: 9170, end: 9179, bank: 'Ikano Bank', accountLength: 7 },
    { start: 9180, end: 9189, bank: 'Danske Bank', accountLength: 10 },
    { start: 9190, end: 9199, bank: 'Den Norske Bank', accountLength: 7 },
    { start: 9230, end: 9239, bank: 'Marginalen Bank', accountLength: 7 },
    { start: 9250, end: 9259, bank: 'SBAB', accountLength: 7 },
    { start: 9260, end: 9269, bank: 'Den Norske Bank', accountLength: 7 },
    { start: 9270, end: 9279, bank: 'ICA Banken', accountLength: 7 },
    { start: 9280, end: 9289, bank: 'Resurs Bank', accountLength: 7 },
    { start: 9300, end: 9349, bank: 'Sparbanken Öresund', accountLength: 10 },
    { start: 9400, end: 9449, bank: 'Forex Bank', accountLength: 7 },
    { start: 9460, end: 9469, bank: 'GE Money Bank', accountLength: 7 },
    { start: 9470, end: 9479, bank: 'Fortis Bank', accountLength: 7 },
    { start: 9500, end: 9549, bank: 'Nordea/Plusgirot', accountLength: 10 },
    { start: 9550, end: 9569, bank: 'Avanza Bank', accountLength: 7 },
    { start: 9570, end: 9579, bank: 'Sparbanken Syd', accountLength: 10 },
    { start: 9960, end: 9969, bank: 'Plusgirot', accountLength: 10 },
  ];

  validateBankAccount(clearingNumber: string, accountNumber: string): BankValidationResult {
    // Remove non-digits
    const cleanClearing = clearingNumber.replace(/\D/g, '');
    const cleanAccount = accountNumber.replace(/\D/g, '');

    // Validate clearing number length (4 digits)
    if (cleanClearing.length !== 4) {
      return { valid: false, error: 'Clearing number must be 4 digits' };
    }

    const clearing = parseInt(cleanClearing);
    
    // Find bank by clearing number
    const bankInfo = this.BANK_CLEARING_RANGES.find(
      range => clearing >= range.start && clearing <= range.end
    );

    if (!bankInfo) {
      return { valid: false, error: 'Invalid clearing number' };
    }

    // Validate account number length
    if (cleanAccount.length !== bankInfo.accountLength) {
      return { 
        valid: false, 
        error: `Account number for ${bankInfo.bank} must be ${bankInfo.accountLength} digits` 
      };
    }

    // Perform checksum validation (simplified for example)
    if (!this.validateAccountChecksum(cleanClearing, cleanAccount, bankInfo.bank)) {
      return { valid: false, error: 'Invalid account number checksum' };
    }

    return {
      valid: true,
      bankName: bankInfo.bank,
      accountType: 'checking' // Default, could be enhanced
    };
  }

  private validateAccountChecksum(clearing: string, account: string, bank: string): boolean {
    // Different banks use different checksum algorithms
    // This is a simplified implementation
    switch (bank) {
      case 'Swedbank':
      case 'Sparbanken':
        return this.validateMod11Checksum(clearing + account);
      case 'SEB':
        return this.validateMod10Checksum(account);
      case 'Handelsbanken':
        return this.validateMod11Checksum(account);
      default:
        // For banks without checksum validation, accept all
        return true;
    }
  }

  private validateMod10Checksum(number: string): boolean {
    let sum = 0;
    let alternate = false;
    
    for (let i = number.length - 1; i >= 0; i--) {
      let n = parseInt(number.charAt(i));
      if (alternate) {
        n *= 2;
        if (n > 9) {
          n = (n % 10) + 1;
        }
      }
      sum += n;
      alternate = !alternate;
    }
    
    return sum % 10 === 0;
  }

  private validateMod11Checksum(number: string): boolean {
    const weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let sum = 0;
    
    for (let i = 0; i < number.length - 1; i++) {
      sum += parseInt(number.charAt(i)) * weights[i % weights.length];
    }
    
    const checkDigit = (11 - (sum % 11)) % 11;
    const actualCheckDigit = parseInt(number.charAt(number.length - 1));
    
    return checkDigit === actualCheckDigit;
  }

  validateSwishNumber(phoneNumber: string): boolean {
    // Remove spaces, dashes, and country code
    const cleaned = phoneNumber.replace(/[\s-]/g, '').replace(/^(\+46|0046|46)/, '0');
    
    // Swedish mobile numbers start with 07 and have 10 digits total
    const mobileRegex = /^07[0-9]{8}$/;
    
    // Also accept 123 numbers (business Swish)
    const businessRegex = /^123[0-9]{7}$/;
    
    return mobileRegex.test(cleaned) || businessRegex.test(cleaned);
  }

  validateBankgiroNumber(bankgiro: string): boolean {
    const cleaned = bankgiro.replace(/[\s-]/g, '');
    
    // Bankgiro numbers are 7-8 digits
    if (!/^\d{7,8}$/.test(cleaned)) {
      return false;
    }

    // Validate checksum using mod-10
    return this.validateMod10Checksum(cleaned);
  }

  validateOrganizationNumber(orgNumber: string): boolean {
    // Swedish organization numbers: NNNNNN-NNNN or NNNNNNNNNN
    const cleaned = orgNumber.replace(/[-\s]/g, '');
    
    if (!/^\d{10}$/.test(cleaned)) {
      return false;
    }

    // Century prefix for organizations is typically 16, 19, or 20
    const century = cleaned.substring(0, 2);
    if (!['16', '19', '20'].includes(century)) {
      return false;
    }

    // Validate checksum (last digit)
    return this.validateMod10Checksum(cleaned);
  }

  validatePersonalNumber(personalNumber: string): boolean {
    // Swedish personal numbers: YYYYMMDD-NNNN or YYMMDD-NNNN
    const cleaned = personalNumber.replace(/[-\s]/g, '');
    
    if (!/^\d{10,12}$/.test(cleaned)) {
      return false;
    }

    // Extract date components
    let year, month, day, serial;
    if (cleaned.length === 12) {
      year = parseInt(cleaned.substring(0, 4));
      month = parseInt(cleaned.substring(4, 6));
      day = parseInt(cleaned.substring(6, 8));
      serial = cleaned.substring(8, 12);
    } else {
      year = parseInt(cleaned.substring(0, 2));
      // Assume 1900s for year > 50, 2000s otherwise
      year = year > 50 ? 1900 + year : 2000 + year;
      month = parseInt(cleaned.substring(2, 4));
      day = parseInt(cleaned.substring(4, 6));
      serial = cleaned.substring(6, 10);
    }

    // Validate date
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return false;
    }

    // Validate checksum (last digit)
    return this.validateMod10Checksum(cleaned.length === 12 ? cleaned.substring(2) : cleaned);
  }

  async initiateSwishPayment(payment: SwishPayment): Promise<any> {
    // This would integrate with the actual Swish API
    // For now, return a mock response
    if (!this.validateSwishNumber(payment.phoneNumber)) {
      throw new Error('Invalid Swish number');
    }

    const paymentId = crypto.randomBytes(16).toString('hex');
    
    return {
      paymentId,
      status: 'CREATED',
      payeePaymentReference: paymentId,
      callbackUrl: process.env.SWISH_CALLBACK_URL,
      payerAlias: payment.phoneNumber,
      payeeAlias: payment.payeeAlias || process.env.SWISH_MERCHANT_ALIAS,
      amount: payment.amount,
      currency: 'SEK',
      message: payment.message || 'Feedback reward',
      dateCreated: new Date().toISOString()
    };
  }

  async checkSwishPaymentStatus(paymentId: string): Promise<any> {
    // Mock implementation
    return {
      paymentId,
      status: 'PAID',
      amount: 100,
      currency: 'SEK',
      datePaid: new Date().toISOString(),
      errorCode: null,
      errorMessage: null
    };
  }

  async initiateBankgiroPayment(payment: BankgiroPayment): Promise<any> {
    if (!this.validateBankgiroNumber(payment.bankgiroNumber)) {
      throw new Error('Invalid Bankgiro number');
    }

    const paymentId = crypto.randomBytes(16).toString('hex');
    
    return {
      paymentId,
      bankgiroNumber: payment.bankgiroNumber,
      amount: payment.amount,
      reference: payment.reference,
      dueDate: payment.dueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  async initiateBankIDAuthentication(personalNumber: string, amount: number): Promise<any> {
    if (!this.validatePersonalNumber(personalNumber)) {
      throw new Error('Invalid personal number');
    }

    const authToken = crypto.randomBytes(32).toString('hex');
    const qrData = crypto.randomBytes(64).toString('base64');
    
    return {
      authToken,
      qrCode: `bankid:///?autostarttoken=${authToken}&redirect=null`,
      qrData,
      expiresIn: 30, // seconds
      status: 'pending'
    };
  }

  async verifyBankIDAuthentication(authToken: string): Promise<any> {
    // Mock implementation
    return {
      authToken,
      status: 'complete',
      user: {
        personalNumber: '199001011234',
        name: 'Test Testsson',
        givenName: 'Test',
        surname: 'Testsson'
      },
      signature: crypto.randomBytes(64).toString('base64'),
      ocspResponse: crypto.randomBytes(256).toString('base64')
    };
  }

  generateOCR(reference: string): string {
    // Generate OCR reference number for Swedish invoices
    const cleaned = reference.replace(/\D/g, '');
    
    // Add length indicator
    const withLength = cleaned.length.toString() + cleaned;
    
    // Calculate checksum
    let sum = 0;
    let multiplier = 2;
    
    for (let i = withLength.length - 1; i >= 0; i--) {
      let digit = parseInt(withLength.charAt(i)) * multiplier;
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
      sum += digit;
      multiplier = multiplier === 2 ? 1 : 2;
    }
    
    const checksum = (10 - (sum % 10)) % 10;
    
    return withLength + checksum;
  }

  validateOCR(ocr: string): boolean {
    if (!/^\d+$/.test(ocr) || ocr.length < 2) {
      return false;
    }

    const withoutChecksum = ocr.substring(0, ocr.length - 1);
    const expectedOcr = this.generateOCR(withoutChecksum.substring(1));
    
    return expectedOcr === ocr;
  }

  formatIBAN(clearingNumber: string, accountNumber: string): string {
    // Convert Swedish bank account to IBAN format
    const countryCode = 'SE';
    const cleaned = (clearingNumber + accountNumber).replace(/\D/g, '');
    
    // Calculate check digits
    const temp = cleaned + '282400'; // SE = 28, 24 = S, 00 = placeholder
    const mod = this.mod97(temp);
    const checkDigits = (98 - mod).toString().padStart(2, '0');
    
    return `${countryCode}${checkDigits}${cleaned}`;
  }

  private mod97(iban: string): number {
    let remainder = '';
    
    for (let i = 0; i < iban.length; i++) {
      remainder = remainder + iban.charAt(i);
      remainder = (parseInt(remainder) % 97).toString();
    }
    
    return parseInt(remainder);
  }

  validateIBAN(iban: string): boolean {
    const cleaned = iban.replace(/\s/g, '').toUpperCase();
    
    if (!/^SE\d{22}$/.test(cleaned)) {
      return false;
    }

    // Move first 4 chars to end and replace letters with numbers
    const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
    const numeric = rearranged.replace(/[A-Z]/g, (char) => 
      (char.charCodeAt(0) - 55).toString()
    );
    
    return this.mod97(numeric) === 1;
  }
}

export const swedishBankingService = new SwedishBankingService();