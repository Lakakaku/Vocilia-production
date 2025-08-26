import { createLogger } from '../../utils/logger';
import { ZettleLocation, ZettleDevice } from './types';
import { POSLocation } from '../../types';

const logger = createLogger('ZettleLocationMapper');

/**
 * Zettle Location and Device Mapper
 * 
 * Manages the mapping between Zettle locations, devices, and business locations
 * Handles device tracking, location hierarchy, and Swedish location features
 */
export class ZettleLocationMapper {
  private locationCache = new Map<string, ZettleLocation>();
  private deviceCache = new Map<string, ZettleDevice>();
  private locationDeviceMap = new Map<string, Set<string>>();
  private businessLocationMap = new Map<string, string>(); // Maps Zettle location ID to business location ID
  private readonly cacheExpiryMs = 10 * 60 * 1000; // 10 minutes
  private lastCacheUpdate?: Date;

  /**
   * Map Zettle locations to business locations
   */
  async mapLocations(
    zettleLocations: ZettleLocation[],
    businessLocations?: Array<{ id: string; name: string; address?: any }>
  ): Promise<LocationMappingResult> {
    logger.info('Mapping Zettle locations', { 
      zettleCount: zettleLocations.length,
      businessCount: businessLocations?.length || 0
    });

    const mappings: LocationMapping[] = [];
    const unmappedZettle: ZettleLocation[] = [];
    const unmappedBusiness: string[] = [];

    // Update cache
    this.updateLocationCache(zettleLocations);

    if (!businessLocations || businessLocations.length === 0) {
      // No business locations to map to, create direct mappings
      zettleLocations.forEach(zLocation => {
        mappings.push({
          zettleLocationId: zLocation.uuid,
          zettleLocationName: zLocation.name,
          businessLocationId: zLocation.uuid, // Use Zettle ID as business ID
          businessLocationName: zLocation.name,
          confidence: 1.0,
          matchType: 'direct',
          devices: zLocation.devices?.map(d => ({
            id: d.uuid,
            name: d.name,
            status: d.status
          })) || []
        });
      });
    } else {
      // Map to existing business locations
      for (const zLocation of zettleLocations) {
        const match = this.findBestMatch(zLocation, businessLocations);
        
        if (match) {
          mappings.push({
            zettleLocationId: zLocation.uuid,
            zettleLocationName: zLocation.name,
            businessLocationId: match.businessLocation.id,
            businessLocationName: match.businessLocation.name,
            confidence: match.confidence,
            matchType: match.matchType,
            devices: zLocation.devices?.map(d => ({
              id: d.uuid,
              name: d.name,
              status: d.status
            })) || []
          });

          this.businessLocationMap.set(zLocation.uuid, match.businessLocation.id);
        } else {
          unmappedZettle.push(zLocation);
        }
      }

      // Find business locations without Zettle mappings
      const mappedBusinessIds = new Set(mappings.map(m => m.businessLocationId));
      unmappedBusiness.push(
        ...businessLocations
          .filter(bl => !mappedBusinessIds.has(bl.id))
          .map(bl => bl.id)
      );
    }

    const result: LocationMappingResult = {
      success: unmappedZettle.length === 0,
      mappings,
      unmappedZettleLocations: unmappedZettle,
      unmappedBusinessLocations: unmappedBusiness,
      totalDevices: this.getTotalDeviceCount(zettleLocations),
      onlineDevices: this.getOnlineDeviceCount(zettleLocations)
    };

    logger.info('Location mapping completed', {
      mapped: mappings.length,
      unmappedZettle: unmappedZettle.length,
      unmappedBusiness: unmappedBusiness.length
    });

    return result;
  }

  /**
   * Map devices to locations
   */
  async mapDevices(devices: ZettleDevice[]): Promise<DeviceMappingResult> {
    logger.info('Mapping Zettle devices', { count: devices.length });

    const mappings: DeviceMapping[] = [];
    const unmappedDevices: ZettleDevice[] = [];
    const locationDeviceGroups = new Map<string, ZettleDevice[]>();

    // Update device cache
    devices.forEach(device => {
      this.deviceCache.set(device.uuid, device);
      
      if (device.locationId) {
        if (!locationDeviceGroups.has(device.locationId)) {
          locationDeviceGroups.set(device.locationId, []);
        }
        locationDeviceGroups.get(device.locationId)!.push(device);

        // Update location-device mapping
        if (!this.locationDeviceMap.has(device.locationId)) {
          this.locationDeviceMap.set(device.locationId, new Set());
        }
        this.locationDeviceMap.get(device.locationId)!.add(device.uuid);

        mappings.push({
          deviceId: device.uuid,
          deviceName: device.name,
          deviceModel: device.model,
          locationId: device.locationId,
          locationName: this.locationCache.get(device.locationId)?.name || 'Unknown',
          status: device.status,
          lastSeen: device.lastSeen ? new Date(device.lastSeen) : undefined
        });
      } else {
        unmappedDevices.push(device);
      }
    });

    // Analyze device distribution
    const deviceStats: DeviceStatistics = {
      total: devices.length,
      online: devices.filter(d => d.status === 'ONLINE').length,
      offline: devices.filter(d => d.status === 'OFFLINE').length,
      inactive: devices.filter(d => d.status === 'INACTIVE').length,
      byModel: this.groupByModel(devices),
      byLocation: Array.from(locationDeviceGroups.entries()).map(([locationId, devs]) => ({
        locationId,
        locationName: this.locationCache.get(locationId)?.name || 'Unknown',
        deviceCount: devs.length,
        onlineCount: devs.filter(d => d.status === 'ONLINE').length
      }))
    };

    return {
      success: unmappedDevices.length === 0,
      mappings,
      unmappedDevices,
      statistics: deviceStats
    };
  }

  /**
   * Get device activity for a location
   */
  getLocationDeviceActivity(locationId: string): LocationDeviceActivity {
    const devices = this.locationDeviceMap.get(locationId);
    if (!devices) {
      return {
        locationId,
        totalDevices: 0,
        activeDevices: 0,
        devices: []
      };
    }

    const deviceList = Array.from(devices)
      .map(deviceId => this.deviceCache.get(deviceId))
      .filter(device => device !== undefined) as ZettleDevice[];

    const activeDevices = deviceList.filter(d => d.status === 'ONLINE');

    return {
      locationId,
      locationName: this.locationCache.get(locationId)?.name,
      totalDevices: deviceList.length,
      activeDevices: activeDevices.length,
      devices: deviceList.map(d => ({
        id: d.uuid,
        name: d.name,
        model: d.model,
        status: d.status,
        lastSeen: d.lastSeen ? new Date(d.lastSeen) : undefined,
        isActive: d.status === 'ONLINE',
        minutesSinceLastSeen: d.lastSeen 
          ? Math.floor((Date.now() - new Date(d.lastSeen).getTime()) / 60000)
          : undefined
      }))
    };
  }

  /**
   * Find the best match for a Zettle location among business locations
   */
  private findBestMatch(
    zettleLocation: ZettleLocation,
    businessLocations: Array<{ id: string; name: string; address?: any }>
  ): LocationMatch | null {
    let bestMatch: LocationMatch | null = null;
    let highestConfidence = 0;

    for (const businessLocation of businessLocations) {
      // Try different matching strategies
      const nameMatch = this.calculateNameSimilarity(
        zettleLocation.name,
        businessLocation.name
      );

      const addressMatch = this.calculateAddressMatch(
        zettleLocation.address,
        businessLocation.address
      );

      // Calculate combined confidence
      const confidence = (nameMatch * 0.6 + addressMatch * 0.4);

      if (confidence > highestConfidence && confidence > 0.5) {
        highestConfidence = confidence;
        bestMatch = {
          businessLocation,
          confidence,
          matchType: this.determineMatchType(nameMatch, addressMatch)
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate name similarity using Levenshtein distance
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    if (n1 === n2) return 1.0;
    if (n1.includes(n2) || n2.includes(n1)) return 0.9;

    // Simple Levenshtein distance calculation
    const distance = this.levenshteinDistance(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    return Math.max(0, 1 - distance / maxLength);
  }

  /**
   * Calculate address matching score
   */
  private calculateAddressMatch(address1?: any, address2?: any): number {
    if (!address1 || !address2) return 0;

    let score = 0;
    let factors = 0;

    // Check postal code
    if (address1.postalCode && address2.postalCode) {
      factors++;
      if (address1.postalCode === address2.postalCode) score += 1;
    }

    // Check city
    if (address1.city && address2.city) {
      factors++;
      if (address1.city.toLowerCase() === address2.city.toLowerCase()) score += 1;
    }

    // Check street address
    if (address1.addressLine1 && address2.line1) {
      factors++;
      const similarity = this.calculateNameSimilarity(address1.addressLine1, address2.line1);
      score += similarity;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Determine match type based on scores
   */
  private determineMatchType(nameScore: number, addressScore: number): MatchType {
    if (nameScore >= 0.95 && addressScore >= 0.95) return 'exact';
    if (nameScore >= 0.8 || addressScore >= 0.8) return 'high';
    if (nameScore >= 0.6 || addressScore >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Update location cache
   */
  private updateLocationCache(locations: ZettleLocation[]): void {
    locations.forEach(location => {
      this.locationCache.set(location.uuid, location);
    });
    this.lastCacheUpdate = new Date();
  }

  /**
   * Get total device count
   */
  private getTotalDeviceCount(locations: ZettleLocation[]): number {
    return locations.reduce((count, loc) => count + (loc.devices?.length || 0), 0);
  }

  /**
   * Get online device count
   */
  private getOnlineDeviceCount(locations: ZettleLocation[]): number {
    return locations.reduce((count, loc) => {
      const onlineDevices = loc.devices?.filter(d => d.status === 'ONLINE').length || 0;
      return count + onlineDevices;
    }, 0);
  }

  /**
   * Group devices by model
   */
  private groupByModel(devices: ZettleDevice[]): Record<string, number> {
    const groups: Record<string, number> = {};
    devices.forEach(device => {
      const model = device.model || 'Unknown';
      groups[model] = (groups[model] || 0) + 1;
    });
    return groups;
  }

  /**
   * Check if cache needs refresh
   */
  needsCacheRefresh(): boolean {
    if (!this.lastCacheUpdate) return true;
    const ageMs = Date.now() - this.lastCacheUpdate.getTime();
    return ageMs > this.cacheExpiryMs;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.locationCache.clear();
    this.deviceCache.clear();
    this.locationDeviceMap.clear();
    this.businessLocationMap.clear();
    this.lastCacheUpdate = undefined;
    logger.info('Location mapper caches cleared');
  }

  /**
   * Get mapping statistics
   */
  getMappingStatistics(): MappingStatistics {
    return {
      totalLocations: this.locationCache.size,
      totalDevices: this.deviceCache.size,
      mappedLocations: this.businessLocationMap.size,
      locationsWithDevices: this.locationDeviceMap.size,
      cacheAge: this.lastCacheUpdate 
        ? Math.floor((Date.now() - this.lastCacheUpdate.getTime()) / 1000)
        : undefined
    };
  }
}

// Type definitions
export interface LocationMappingResult {
  success: boolean;
  mappings: LocationMapping[];
  unmappedZettleLocations: ZettleLocation[];
  unmappedBusinessLocations: string[];
  totalDevices: number;
  onlineDevices: number;
}

export interface LocationMapping {
  zettleLocationId: string;
  zettleLocationName: string;
  businessLocationId: string;
  businessLocationName: string;
  confidence: number;
  matchType: MatchType;
  devices: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

export interface DeviceMappingResult {
  success: boolean;
  mappings: DeviceMapping[];
  unmappedDevices: ZettleDevice[];
  statistics: DeviceStatistics;
}

export interface DeviceMapping {
  deviceId: string;
  deviceName: string;
  deviceModel: string;
  locationId: string;
  locationName: string;
  status: string;
  lastSeen?: Date;
}

export interface DeviceStatistics {
  total: number;
  online: number;
  offline: number;
  inactive: number;
  byModel: Record<string, number>;
  byLocation: Array<{
    locationId: string;
    locationName: string;
    deviceCount: number;
    onlineCount: number;
  }>;
}

export interface LocationDeviceActivity {
  locationId: string;
  locationName?: string;
  totalDevices: number;
  activeDevices: number;
  devices: Array<{
    id: string;
    name: string;
    model: string;
    status: string;
    lastSeen?: Date;
    isActive: boolean;
    minutesSinceLastSeen?: number;
  }>;
}

interface LocationMatch {
  businessLocation: { id: string; name: string; address?: any };
  confidence: number;
  matchType: MatchType;
}

type MatchType = 'exact' | 'high' | 'medium' | 'low' | 'direct';

export interface MappingStatistics {
  totalLocations: number;
  totalDevices: number;
  mappedLocations: number;
  locationsWithDevices: number;
  cacheAge?: number;
}

// Export factory function
export function createZettleLocationMapper(): ZettleLocationMapper {
  return new ZettleLocationMapper();
}