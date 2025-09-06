/**
 * Device Fingerprinting Utilities
 * Creates unique device identifiers for fraud detection in simple verification
 */

import { Request } from 'express';
import crypto from 'crypto';

export interface DeviceFingerprint {
  id: string;
  userAgent: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
  screen?: {
    width?: number;
    height?: number;
    colorDepth?: number;
  };
  timezone?: string;
  platform?: string;
  cookiesEnabled?: boolean;
  doNotTrack?: boolean;
  ipAddress: string;
  headers: Record<string, string>;
  timestamp: string;
}

/**
 * Generate device fingerprint from HTTP request
 */
export function generateDeviceFingerprint(req: Request): DeviceFingerprint {
  const userAgent = req.get('User-Agent') || 'unknown';
  const acceptLanguage = req.get('Accept-Language');
  const acceptEncoding = req.get('Accept-Encoding');
  const ipAddress = getClientIP(req);
  
  // Extract relevant headers for fingerprinting
  const relevantHeaders: Record<string, string> = {};
  const headerKeys = [
    'user-agent',
    'accept-language', 
    'accept-encoding',
    'accept',
    'sec-fetch-site',
    'sec-fetch-mode',
    'sec-fetch-dest',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform'
  ];

  headerKeys.forEach(key => {
    const value = req.get(key);
    if (value) {
      relevantHeaders[key] = value;
    }
  });

  // Generate unique device ID based on stable characteristics
  const fingerprintData = [
    userAgent,
    acceptLanguage,
    acceptEncoding,
    ipAddress,
    JSON.stringify(relevantHeaders)
  ].join('|');

  const deviceId = crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('hex')
    .substring(0, 32);

  return {
    id: deviceId,
    userAgent,
    acceptLanguage,
    acceptEncoding,
    ipAddress,
    headers: relevantHeaders,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get client IP address from request, handling proxies
 */
function getClientIP(req: Request): string {
  // Check various headers that might contain the real IP
  const forwardedFor = req.get('X-Forwarded-For');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = req.get('X-Real-IP');
  if (realIP) {
    return realIP.trim();
  }

  const clientIP = req.get('X-Client-IP');
  if (clientIP) {
    return clientIP.trim();
  }

  // Fallback to connection remote address
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Compare two device fingerprints to determine similarity
 * Returns a score from 0-1 (1 = identical, 0 = completely different)
 */
export function compareDeviceFingerprints(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
  let matches = 0;
  let total = 0;

  // Compare user agent
  total++;
  if (fp1.userAgent === fp2.userAgent) matches++;

  // Compare accept language
  total++;
  if (fp1.acceptLanguage === fp2.acceptLanguage) matches++;

  // Compare IP address (exact match)
  total++;
  if (fp1.ipAddress === fp2.ipAddress) matches++;

  // Compare key headers
  const headerKeys = new Set([
    ...Object.keys(fp1.headers),
    ...Object.keys(fp2.headers)
  ]);

  headerKeys.forEach(key => {
    total++;
    if (fp1.headers[key] === fp2.headers[key]) matches++;
  });

  return total > 0 ? matches / total : 0;
}

/**
 * Check if device fingerprint indicates suspicious behavior
 */
export function analyzeDeviceFingerprint(fingerprint: DeviceFingerprint): {
  riskScore: number;
  flags: string[];
} {
  const flags: string[] = [];
  let riskScore = 0;

  // Check for missing or suspicious user agent
  if (!fingerprint.userAgent || fingerprint.userAgent === 'unknown') {
    flags.push('Missing user agent');
    riskScore += 0.3;
  } else if (fingerprint.userAgent.length < 20) {
    flags.push('Suspiciously short user agent');
    riskScore += 0.2;
  }

  // Check for bot-like characteristics
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /postman/i
  ];

  if (botPatterns.some(pattern => pattern.test(fingerprint.userAgent))) {
    flags.push('Bot-like user agent detected');
    riskScore += 0.8;
  }

  // Check for missing headers that browsers typically send
  const expectedHeaders = ['accept-language', 'accept-encoding'];
  const missingHeaders = expectedHeaders.filter(header => !fingerprint.headers[header]);
  
  if (missingHeaders.length > 0) {
    flags.push(`Missing standard headers: ${missingHeaders.join(', ')}`);
    riskScore += 0.1 * missingHeaders.length;
  }

  // Check for private/local IP addresses (could indicate proxy/VPN)
  const privateIPPatterns = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fe80::/i
  ];

  if (privateIPPatterns.some(pattern => pattern.test(fingerprint.ipAddress))) {
    flags.push('Private/local IP address detected');
    riskScore += 0.1;
  }

  // Normalize risk score to 0-1 range
  riskScore = Math.min(riskScore, 1);

  return {
    riskScore,
    flags
  };
}

/**
 * Enhanced device fingerprinting with additional client-side data
 * This would be called if client sends additional fingerprint data
 */
export function enhanceDeviceFingerprint(
  baseFingerprint: DeviceFingerprint,
  clientData: {
    screen?: { width: number; height: number; colorDepth: number };
    timezone?: string;
    platform?: string;
    cookiesEnabled?: boolean;
    doNotTrack?: boolean;
  }
): DeviceFingerprint {
  return {
    ...baseFingerprint,
    ...clientData,
    // Regenerate ID with additional data
    id: crypto
      .createHash('sha256')
      .update(JSON.stringify({ ...baseFingerprint, ...clientData }))
      .digest('hex')
      .substring(0, 32)
  };
}