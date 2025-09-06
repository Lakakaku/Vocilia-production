import { randomInt } from 'crypto';
import QRCode from 'qrcode';
import {
  StoreCode,
  StoreCodeGenerationRequest,
  SimpleVerificationSettings,
  APIResponse
} from '@ai-feedback-platform/shared-types';

export interface StoreCodeRepository {
  create(data: Omit<StoreCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreCode>;
  findByCode(code: string): Promise<StoreCode | null>;
  findByBusinessId(businessId: string): Promise<StoreCode[]>;
  findByLocationId(locationId: string): Promise<StoreCode[]>;
  update(id: string, data: Partial<StoreCode>): Promise<StoreCode>;
  deactivate(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export class StoreCodeService {
  constructor(
    private repository: StoreCodeRepository,
    private logger: Console = console
  ) {}

  async generateStoreCode(request: StoreCodeGenerationRequest): Promise<APIResponse<StoreCode>> {
    try {
      const code = await this.generateUniqueCode();
      const expiresAt = request.expiresAt || this.getDefaultExpiration();

      const storeCode = await this.repository.create({
        businessId: request.businessId,
        locationId: request.locationId,
        code,
        name: request.name,
        active: true,
        expiresAt
      });

      this.logger.log(`Generated store code ${code} for business ${request.businessId}`);

      return {
        success: true,
        data: storeCode
      };
    } catch (error) {
      this.logger.error('Failed to generate store code:', error);
      return {
        success: false,
        error: {
          code: 'CODE_GENERATION_FAILED',
          message: 'Failed to generate store code'
        }
      };
    }
  }

  async generateQRCodeWithStoreCode(storeCode: string, baseUrl: string): Promise<APIResponse<string>> {
    try {
      // Create QR code URL that includes the store code
      const qrUrl = `${baseUrl}/verify?code=${storeCode}`;
      
      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      return {
        success: true,
        data: qrCodeDataUrl
      };
    } catch (error) {
      this.logger.error('Failed to generate QR code:', error);
      return {
        success: false,
        error: {
          code: 'QR_GENERATION_FAILED',
          message: 'Failed to generate QR code'
        }
      };
    }
  }

  async validateStoreCode(code: string): Promise<APIResponse<StoreCode>> {
    try {
      if (!this.isValidCodeFormat(code)) {
        return {
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Store code must be 6 digits'
          }
        };
      }

      const storeCode = await this.repository.findByCode(code);
      
      if (!storeCode) {
        return {
          success: false,
          error: {
            code: 'CODE_NOT_FOUND',
            message: 'Store code not found'
          }
        };
      }

      if (!storeCode.active) {
        return {
          success: false,
          error: {
            code: 'CODE_INACTIVE',
            message: 'Store code is not active'
          }
        };
      }

      if (new Date(storeCode.expiresAt) < new Date()) {
        return {
          success: false,
          error: {
            code: 'CODE_EXPIRED',
            message: 'Store code has expired'
          }
        };
      }

      return {
        success: true,
        data: storeCode
      };
    } catch (error) {
      this.logger.error('Failed to validate store code:', error);
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Failed to validate store code'
        }
      };
    }
  }

  async getStoreCodesForBusiness(businessId: string): Promise<APIResponse<StoreCode[]>> {
    try {
      const storeCodes = await this.repository.findByBusinessId(businessId);
      
      // Filter out expired codes
      const activeCodes = storeCodes.filter(code => 
        code.active && new Date(code.expiresAt) > new Date()
      );

      return {
        success: true,
        data: activeCodes
      };
    } catch (error) {
      this.logger.error('Failed to get store codes:', error);
      return {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch store codes'
        }
      };
    }
  }

  async rotateStoreCode(codeId: string): Promise<APIResponse<StoreCode>> {
    try {
      // Deactivate old code
      await this.repository.deactivate(codeId);
      
      // Get old code details to create new one
      const oldCode = await this.repository.findByCode(codeId);
      if (!oldCode) {
        return {
          success: false,
          error: {
            code: 'CODE_NOT_FOUND',
            message: 'Store code not found'
          }
        };
      }

      // Generate new code
      const newCode = await this.generateUniqueCode();
      const newStoreCode = await this.repository.create({
        businessId: oldCode.businessId,
        locationId: oldCode.locationId,
        code: newCode,
        name: oldCode.name,
        active: true,
        expiresAt: this.getDefaultExpiration()
      });

      this.logger.log(`Rotated store code for business ${oldCode.businessId}: ${oldCode.code} -> ${newCode}`);

      return {
        success: true,
        data: newStoreCode
      };
    } catch (error) {
      this.logger.error('Failed to rotate store code:', error);
      return {
        success: false,
        error: {
          code: 'ROTATION_FAILED',
          message: 'Failed to rotate store code'
        }
      };
    }
  }

  async cleanupExpiredCodes(): Promise<APIResponse<{ deleted: number }>> {
    try {
      const deletedCount = await this.repository.deleteExpired();
      
      this.logger.log(`Cleaned up ${deletedCount} expired store codes`);

      return {
        success: true,
        data: { deleted: deletedCount }
      };
    } catch (error) {
      this.logger.error('Failed to cleanup expired codes:', error);
      return {
        success: false,
        error: {
          code: 'CLEANUP_FAILED',
          message: 'Failed to cleanup expired codes'
        }
      };
    }
  }

  private async generateUniqueCode(maxAttempts = 100): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate 6-digit numeric code
      const code = randomInt(100000, 999999).toString().padStart(6, '0');
      
      // Check if code already exists
      const existing = await this.repository.findByCode(code);
      if (!existing) {
        return code;
      }
    }

    throw new Error(`Unable to generate unique store code after ${maxAttempts} attempts`);
  }

  private isValidCodeFormat(code: string): boolean {
    return /^\d{6}$/.test(code);
  }

  private getDefaultExpiration(): string {
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    return oneYear.toISOString();
  }

  generateQRCodePrintable(storeCode: string, businessName: string, locationName?: string): string {
    const displayName = locationName ? `${businessName} - ${locationName}` : businessName;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Store Code - ${displayName}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
        }
        .store-info { 
            margin-bottom: 20px; 
            font-size: 18px;
            font-weight: bold;
        }
        .store-code { 
            font-size: 36px; 
            font-weight: bold; 
            letter-spacing: 4px;
            background: #f0f0f0;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .instructions {
            font-size: 14px;
            color: #666;
            margin-top: 20px;
            line-height: 1.5;
        }
        .qr-placeholder {
            width: 200px;
            height: 200px;
            border: 2px dashed #ccc;
            margin: 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
        }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="store-info">${displayName}</div>
    
    <div class="qr-placeholder">
        QR Code Here
    </div>
    
    <div class="store-code">${storeCode}</div>
    
    <div class="instructions">
        <strong>För kunder:</strong><br>
        Scanna QR-koden eller ange butikskoden <strong>${storeCode}</strong> 
        för att ge feedback och få cashback.
        <br><br>
        <strong>Hjälp:</strong> Ring 08-XXX XX XX
    </div>
</body>
</html>`;
  }

  generateInstructions(settings: SimpleVerificationSettings): string {
    return `
# Instruktioner för Enkel Verifiering

## För kunder:
1. Scanna QR-koden eller ange 6-siffrig butikskod
2. Ange tid för köp (±${settings.verificationTolerance.timeMinutes} minuter tillåts)
3. Ange köpbelopp (±${settings.verificationTolerance.amountSek} SEK tillåts)
4. Ange telefonnummer för Swish-betalning
5. Genomför feedbackintervju
6. Få cashback via Swish efter butikens godkännande

## Begränsningar:
- Max ${settings.dailyLimits.maxPerPhone} verifieringar per telefonnummer per dag
- Max ${settings.dailyLimits.maxPerIp} verifieringar per IP-adress per dag

## Fraudskydd:
- Automatisk avvisning vid misstänkta mönster (risk > ${settings.fraudSettings.autoRejectThreshold})
- Manuell granskning vid medelhög risk (> ${settings.fraudSettings.manualReviewThreshold})

## För butiker:
- Granska verifieringar inom ${settings.reviewPeriodDays} dagar
- Godkänn eller avvisa baserat på era kvitton/system
- Betala sammanlagd kostnad månadsvis
- Plattformen sköter utbetalning till kunder via Swish
`;
  }
}