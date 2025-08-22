import crypto from 'crypto';
import type { QRPayload, DeviceFingerprint } from '@ai-feedback/shared-types';

const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY || 'development-key-32-characters!!';
const ALGORITHM = 'aes-256-gcm';

// Encrypt QR payload for secure token generation
export function encryptQRPayload(payload: QRPayload): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    cipher.setAAD(Buffer.from('qr-payload'));
    
    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    return Buffer.from(combined).toString('base64url');
  } catch (error) {
    throw new Error('Failed to encrypt QR payload');
  }
}

// Decrypt QR token back to payload
export function decryptQRPayload(encryptedToken: string): QRPayload {
  try {
    const combined = Buffer.from(encryptedToken, 'base64url').toString('utf8');
    const [ivHex, authTagHex, encrypted] = combined.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid token format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAAD(Buffer.from('qr-payload'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const payload = JSON.parse(decrypted) as QRPayload;
    
    // Validate payload structure
    if (!payload.v || !payload.b || !payload.t) {
      throw new Error('Invalid payload structure');
    }
    
    return payload;
  } catch (error) {
    throw new Error('Failed to decrypt QR payload');
  }
}

// Create anonymous customer hash from device fingerprint and phone
export function createDeviceFingerprint(fingerprint: DeviceFingerprint, phoneLastDigits?: string): string {
  const fingerprintString = [
    fingerprint.userAgent,
    fingerprint.screenResolution,
    fingerprint.timezone,
    fingerprint.language,
    fingerprint.platform,
    fingerprint.cookieEnabled.toString(),
    fingerprint.touchSupport.toString(),
    fingerprint.canvasFingerprint || '',
    phoneLastDigits?.slice(-4) || '' // Only last 4 digits for privacy
  ].join('|');
  
  return crypto
    .createHash('sha256')
    .update(fingerprintString)
    .digest('hex');
}

// Generate secure session tokens
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Hash sensitive data for storage
export function hashData(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512');
  return `${actualSalt}:${hash.toString('hex')}`;
}

// Verify hashed data
export function verifyHash(data: string, hash: string): boolean {
  const [salt, originalHash] = hash.split(':');
  const testHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
  return originalHash === testHash.toString('hex');
}

// Generate random alphanumeric codes
export function generateCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}