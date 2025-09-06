/**
 * Store Validation Service
 * Handles store code validation and purchase verification tolerance checking
 * for the simple verification system
 */

import { db } from '@ai-feedback/database';
import type { SimpleVerificationSettings } from '@ai-feedback/shared-types';

interface StoreCodeValidation {
  valid: boolean;
  businessId?: string;
  locationId?: string;
  businessName?: string;
  locationName?: string;
  verificationSettings?: SimpleVerificationSettings;
  error?: string;
}

interface ToleranceCheck {
  withinTolerance: boolean;
  issues: string[];
  timeDeviation?: number; // minutes
  amountDeviation?: number; // SEK
}

/**
 * Validates a 6-digit store code and returns associated business information
 */
export async function validateStoreCode(storeCode: string): Promise<StoreCodeValidation> {
  try {
    // Validate format
    if (!/^[0-9]{6}$/.test(storeCode)) {
      return {
        valid: false,
        error: 'Store code must be exactly 6 digits'
      };
    }

    // Find active store code
    const storeCodeRecord = await db.storeCode.findFirst({
      where: {
        code: storeCode,
        active: true,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            simpleVerificationSettings: true
          }
        },
        location: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!storeCodeRecord) {
      return {
        valid: false,
        error: 'Invalid or expired store code'
      };
    }

    // Check if business has simple verification enabled
    const settings = storeCodeRecord.business.simpleVerificationSettings as SimpleVerificationSettings;
    if (!settings || !settings.enabled) {
      return {
        valid: false,
        error: 'Simple verification not enabled for this business'
      };
    }

    return {
      valid: true,
      businessId: storeCodeRecord.business.id,
      locationId: storeCodeRecord.location?.id,
      businessName: storeCodeRecord.business.name,
      locationName: storeCodeRecord.location?.name || 'Main Location',
      verificationSettings: settings
    };

  } catch (error) {
    console.error('Store code validation error:', error);
    return {
      valid: false,
      error: 'Internal error during validation'
    };
  }
}

/**
 * Checks if purchase time and amount are within acceptable tolerance
 * Default tolerance: ±2 minutes for time, ±0.5 SEK for amount
 */
export async function checkVerificationTolerance(
  businessId: string,
  purchaseTime: Date,
  purchaseAmount: number
): Promise<ToleranceCheck> {
  try {
    // Get business verification settings
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { simpleVerificationSettings: true }
    });

    if (!business) {
      return {
        withinTolerance: false,
        issues: ['Business not found']
      };
    }

    const settings = business.simpleVerificationSettings as SimpleVerificationSettings;
    const timeToleranceMinutes = settings.verificationTolerance?.timeMinutes || 2;
    const amountToleranceSek = settings.verificationTolerance?.amountSek || 0.5;

    const issues: string[] = [];
    const currentTime = new Date();
    
    // Calculate time deviation in minutes
    const timeDifferenceMs = Math.abs(currentTime.getTime() - purchaseTime.getTime());
    const timeDeviationMinutes = timeDifferenceMs / (1000 * 60);

    // For simple verification, we don't have a specific transaction to compare against
    // The tolerance check here is mainly for reasonable purchase times (not too far in past/future)
    
    // Check if purchase time is reasonable (within last 24 hours or up to 30 minutes in future for clock differences)
    const maxPastHours = 24;
    const maxFutureMinutes = 30;
    const minAllowedTime = new Date(currentTime.getTime() - maxPastHours * 60 * 60 * 1000);
    const maxAllowedTime = new Date(currentTime.getTime() + maxFutureMinutes * 60 * 1000);

    if (purchaseTime < minAllowedTime) {
      issues.push(`Purchase time is too far in the past (more than ${maxPastHours} hours ago)`);
    }

    if (purchaseTime > maxAllowedTime) {
      issues.push(`Purchase time is too far in the future (more than ${maxFutureMinutes} minutes ahead)`);
    }

    // Check amount reasonableness (basic sanity check)
    if (purchaseAmount < 1) {
      issues.push('Purchase amount must be at least 1 SEK');
    }

    if (purchaseAmount > 50000) {
      issues.push('Purchase amount exceeds maximum allowed (50,000 SEK)');
    }

    // Check for suspiciously round amounts (potential fraud indicator)
    const isVeryRoundAmount = purchaseAmount % 100 === 0 && purchaseAmount >= 1000;
    if (isVeryRoundAmount) {
      // This doesn't fail validation but adds a note for fraud scoring
      issues.push('Note: Very round amount detected - may require manual review');
    }

    return {
      withinTolerance: issues.filter(issue => !issue.startsWith('Note:')).length === 0,
      issues,
      timeDeviation: timeDeviationMinutes,
      amountDeviation: 0 // No specific amount to compare against in simple verification
    };

  } catch (error) {
    console.error('Tolerance check error:', error);
    return {
      withinTolerance: false,
      issues: ['Internal error during tolerance check']
    };
  }
}

/**
 * Generate a unique 6-digit store code for a business location
 */
export async function generateUniqueStoreCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    // Generate 6-digit code (100000-999999)
    const code = Math.floor(Math.random() * 900000 + 100000).toString();

    // Check if code already exists
    const existing = await db.storeCode.findFirst({
      where: { code }
    });

    if (!existing) {
      return code;
    }

    attempts++;
  }

  throw new Error('Unable to generate unique store code after maximum attempts');
}

/**
 * Create a new store code for a business location
 */
export async function createStoreCode(
  businessId: string,
  locationId?: string,
  name?: string
): Promise<string> {
  try {
    const code = await generateUniqueStoreCode();
    
    await db.storeCode.create({
      data: {
        businessId,
        locationId,
        code,
        name,
        active: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
      }
    });

    return code;
    
  } catch (error) {
    console.error('Store code creation error:', error);
    throw new Error('Failed to create store code');
  }
}

/**
 * Get all store codes for a business
 */
export async function getBusinessStoreCodes(businessId: string) {
  try {
    return await db.storeCode.findMany({
      where: {
        businessId,
        active: true,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        location: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  } catch (error) {
    console.error('Error fetching business store codes:', error);
    throw new Error('Failed to fetch store codes');
  }
}

/**
 * Deactivate a store code
 */
export async function deactivateStoreCode(storeCodeId: string, businessId: string): Promise<boolean> {
  try {
    const result = await db.storeCode.updateMany({
      where: {
        id: storeCodeId,
        businessId // Ensure business can only deactivate their own codes
      },
      data: {
        active: false
      }
    });

    return result.count > 0;
  } catch (error) {
    console.error('Store code deactivation error:', error);
    return false;
  }
}