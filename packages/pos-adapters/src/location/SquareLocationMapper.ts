import { SquareAPIClient } from '../adapters/square/SquareAPIClient';
import { SquareLocation, SquareCredentials } from '../adapters/square/types';
import { POSApiError } from '../base/BasePOSAdapter';

export interface BusinessLocation {
  id: string;
  businessId: string;
  name: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationMapping {
  id: string;
  squareLocationId: string;
  businessLocationId: string;
  businessId: string;
  mappingType: 'automatic' | 'manual';
  confidence: number; // 0-1, how confident we are about the mapping
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  verifiedBy?: string; // Admin user ID who verified
}

export interface LocationMappingCandidate {
  squareLocation: SquareLocation;
  businessLocation: BusinessLocation;
  similarity: number; // 0-1 similarity score
  confidence: number; // 0-1 confidence in mapping
  reasons: string[]; // Why this mapping was suggested
}

export interface LocationMappingConfig {
  credentials: SquareCredentials;
  businessId: string;
  autoMapThreshold?: number; // Default 0.8 - automatically map if confidence > threshold
  requireVerification?: boolean; // Default false - require manual verification
  enableGeocoding?: boolean; // Default true - use geocoding for location matching
}

/**
 * Square Location Mapper
 * 
 * Intelligent location mapping system for the Swedish AI feedback platform:
 * - Automatic location discovery and mapping
 * - Smart matching based on name, address, and geography
 * - Manual override and verification capabilities
 * - Swedish address normalization and geocoding
 * - Location synchronization and updates
 */
export class SquareLocationMapper {
  private apiClient: SquareAPIClient;
  private mappings = new Map<string, LocationMapping>();
  private businessLocations = new Map<string, BusinessLocation>();

  constructor(private config: LocationMappingConfig) {
    this.apiClient = new SquareAPIClient(config.credentials);
  }

  /**
   * Initialize location mapping for a business
   */
  async initializeMapping(): Promise<{
    discovered: number;
    mapped: number;
    requiresVerification: number;
  }> {
    try {
      // 1. Discover Square locations
      const squareLocations = await this.apiClient.getLocations();
      console.log(`🏪 Discovered ${squareLocations.length} Square locations`);

      // 2. Load existing business locations
      await this.loadBusinessLocations();
      console.log(`📍 Loaded ${this.businessLocations.size} business locations`);

      // 3. Load existing mappings
      await this.loadExistingMappings();
      console.log(`🔗 Loaded ${this.mappings.size} existing mappings`);

      // 4. Find mapping candidates for unmapped locations
      const candidates = await this.findMappingCandidates(squareLocations);
      
      let mapped = 0;
      let requiresVerification = 0;

      for (const candidate of candidates) {
        // Check if already mapped
        const existingMapping = Array.from(this.mappings.values())
          .find(m => m.squareLocationId === candidate.squareLocation.id);
        
        if (existingMapping) continue;

        if (candidate.confidence >= (this.config.autoMapThreshold || 0.8)) {
          // Auto-map high confidence matches
          const mapping = await this.createLocationMapping(
            candidate.squareLocation.id,
            candidate.businessLocation.id,
            'automatic',
            candidate.confidence
          );
          
          this.mappings.set(mapping.id, mapping);
          mapped++;
          
          console.log(`✅ Auto-mapped: ${candidate.squareLocation.name} → ${candidate.businessLocation.name} (${Math.round(candidate.confidence * 100)}%)`);
        } else {
          // Mark for verification
          requiresVerification++;
          console.log(`⚠️  Requires verification: ${candidate.squareLocation.name} (${Math.round(candidate.confidence * 100)}% match)`);
        }
      }

      return {
        discovered: squareLocations.length,
        mapped,
        requiresVerification
      };

    } catch (error) {
      throw new POSApiError({
        code: 'LOCATION_MAPPING_INIT_FAILED',
        message: 'Failed to initialize location mapping',
        originalError: error,
        retryable: true
      });
    }
  }

  /**
   * Get mapping candidates that require manual verification
   */
  async getMappingCandidates(): Promise<LocationMappingCandidate[]> {
    try {
      const squareLocations = await this.apiClient.getLocations();
      const candidates = await this.findMappingCandidates(squareLocations);

      // Filter out already mapped locations and low confidence matches
      return candidates.filter(candidate => {
        const existingMapping = Array.from(this.mappings.values())
          .find(m => m.squareLocationId === candidate.squareLocation.id);
        
        return !existingMapping && candidate.confidence >= 0.3; // Show matches above 30%
      }).sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending

    } catch (error) {
      throw new POSApiError({
        code: 'MAPPING_CANDIDATES_FAILED',
        message: 'Failed to get mapping candidates',
        originalError: error
      });
    }
  }

  /**
   * Create manual location mapping
   */
  async createManualMapping(
    squareLocationId: string,
    businessLocationId: string,
    verifiedBy: string
  ): Promise<LocationMapping> {
    try {
      // Verify the Square location exists
      const squareLocation = await this.apiClient.getLocation(squareLocationId);
      
      // Verify the business location exists
      const businessLocation = this.businessLocations.get(businessLocationId);
      if (!businessLocation) {
        throw new POSApiError({
          code: 'BUSINESS_LOCATION_NOT_FOUND',
          message: `Business location ${businessLocationId} not found`
        });
      }

      // Create the mapping
      const mapping = await this.createLocationMapping(
        squareLocationId,
        businessLocationId,
        'manual',
        1.0 // Manual mappings have 100% confidence
      );

      // Mark as verified
      mapping.verifiedAt = new Date().toISOString();
      mapping.verifiedBy = verifiedBy;

      this.mappings.set(mapping.id, mapping);

      console.log(`✅ Manual mapping created: ${squareLocation.name} → ${businessLocation.name}`);

      return mapping;

    } catch (error) {
      throw new POSApiError({
        code: 'MANUAL_MAPPING_FAILED',
        message: 'Failed to create manual mapping',
        originalError: error
      });
    }
  }

  /**
   * Get location mapping for a Square location
   */
  getLocationMapping(squareLocationId: string): LocationMapping | null {
    return Array.from(this.mappings.values())
      .find(m => m.squareLocationId === squareLocationId) || null;
  }

  /**
   * Get business location for a Square location
   */
  getBusinessLocation(squareLocationId: string): BusinessLocation | null {
    const mapping = this.getLocationMapping(squareLocationId);
    if (!mapping) return null;

    return this.businessLocations.get(mapping.businessLocationId) || null;
  }

  /**
   * Get all mappings for the business
   */
  getAllMappings(): LocationMapping[] {
    return Array.from(this.mappings.values())
      .filter(m => m.businessId === this.config.businessId)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Update location mapping
   */
  async updateMapping(
    mappingId: string,
    updates: Partial<Pick<LocationMapping, 'businessLocationId' | 'verifiedBy'>>
  ): Promise<LocationMapping> {
    const mapping = this.mappings.get(mappingId);
    if (!mapping) {
      throw new POSApiError({
        code: 'MAPPING_NOT_FOUND',
        message: `Location mapping ${mappingId} not found`
      });
    }

    // Update mapping
    Object.assign(mapping, {
      ...updates,
      updatedAt: new Date().toISOString(),
      verifiedAt: updates.verifiedBy ? new Date().toISOString() : mapping.verifiedAt
    });

    // Save to database (in real implementation)
    await this.saveMapping(mapping);

    this.mappings.set(mappingId, mapping);
    return mapping;
  }

  /**
   * Delete location mapping
   */
  async deleteMapping(mappingId: string): Promise<void> {
    const mapping = this.mappings.get(mappingId);
    if (!mapping) {
      throw new POSApiError({
        code: 'MAPPING_NOT_FOUND',
        message: `Location mapping ${mappingId} not found`
      });
    }

    // Remove from database (in real implementation)
    await this.deleteMappingFromDatabase(mappingId);

    this.mappings.delete(mappingId);
  }

  /**
   * Synchronize locations with Square
   */
  async synchronizeLocations(): Promise<{
    updated: number;
    created: number;
    errors: string[];
  }> {
    try {
      const squareLocations = await this.apiClient.getLocations();
      let updated = 0;
      let created = 0;
      const errors: string[] = [];

      for (const squareLocation of squareLocations) {
        try {
          const mapping = this.getLocationMapping(squareLocation.id);
          if (mapping) {
            // Update existing mapping if location details changed
            const businessLocation = this.businessLocations.get(mapping.businessLocationId);
            if (businessLocation && this.hasLocationChanged(squareLocation, businessLocation)) {
              await this.updateBusinessLocationFromSquare(businessLocation, squareLocation);
              updated++;
            }
          } else {
            // Try to auto-map new location
            const candidates = await this.findMappingCandidates([squareLocation]);
            const bestCandidate = candidates[0];
            
            if (bestCandidate && bestCandidate.confidence >= (this.config.autoMapThreshold || 0.8)) {
              await this.createLocationMapping(
                squareLocation.id,
                bestCandidate.businessLocation.id,
                'automatic',
                bestCandidate.confidence
              );
              created++;
            }
          }
        } catch (error) {
          errors.push(`Failed to sync ${squareLocation.name}: ${(error as Error).message}`);
        }
      }

      return { updated, created, errors };

    } catch (error) {
      throw new POSApiError({
        code: 'LOCATION_SYNC_FAILED',
        message: 'Failed to synchronize locations',
        originalError: error,
        retryable: true
      });
    }
  }

  // Private methods

  private async findMappingCandidates(
    squareLocations: SquareLocation[]
  ): Promise<LocationMappingCandidate[]> {
    const candidates: LocationMappingCandidate[] = [];

    for (const squareLocation of squareLocations) {
      for (const businessLocation of this.businessLocations.values()) {
        const similarity = this.calculateLocationSimilarity(squareLocation, businessLocation);
        
        if (similarity > 0.3) { // Only consider matches above 30% similarity
          candidates.push({
            squareLocation,
            businessLocation,
            similarity,
            confidence: this.calculateMappingConfidence(squareLocation, businessLocation, similarity),
            reasons: this.getMappingReasons(squareLocation, businessLocation, similarity)
          });
        }
      }
    }

    return candidates;
  }

  private calculateLocationSimilarity(
    squareLocation: SquareLocation,
    businessLocation: BusinessLocation
  ): number {
    let totalScore = 0;
    let weights = 0;

    // Name similarity (weight: 0.4)
    const nameScore = this.calculateStringSimilarity(
      squareLocation.name || '',
      businessLocation.name
    );
    totalScore += nameScore * 0.4;
    weights += 0.4;

    // Address similarity (weight: 0.3)
    const addressScore = this.calculateAddressSimilarity(
      squareLocation.address,
      businessLocation.address
    );
    totalScore += addressScore * 0.3;
    weights += 0.3;

    // City similarity (weight: 0.2)
    const cityScore = this.calculateStringSimilarity(
      squareLocation.address?.locality || '',
      businessLocation.address.city
    );
    totalScore += cityScore * 0.2;
    weights += 0.2;

    // Postal code similarity (weight: 0.1)
    const postalScore = this.calculateStringSimilarity(
      squareLocation.address?.postal_code || '',
      businessLocation.address.postalCode
    );
    totalScore += postalScore * 0.1;
    weights += 0.1;

    return weights > 0 ? totalScore / weights : 0;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Normalize strings for Swedish market
    const normalize = (str: string) => str.toLowerCase()
      .replace(/[åä]/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/[^a-z0-9]/g, '');

    const norm1 = normalize(str1);
    const norm2 = normalize(str2);

    if (norm1 === norm2) return 1.0;
    if (norm1.length === 0 || norm2.length === 0) return 0;

    // Levenshtein distance
    const matrix = Array(norm2.length + 1).fill(null).map(() => Array(norm1.length + 1).fill(null));

    for (let i = 0; i <= norm1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= norm2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= norm2.length; j++) {
      for (let i = 1; i <= norm1.length; i++) {
        const substitutionCost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    const distance = matrix[norm2.length][norm1.length];
    const maxLength = Math.max(norm1.length, norm2.length);
    
    return (maxLength - distance) / maxLength;
  }

  private calculateAddressSimilarity(
    squareAddress: any,
    businessAddress: BusinessLocation['address']
  ): number {
    if (!squareAddress) return 0;

    const streetScore = this.calculateStringSimilarity(
      squareAddress.address_line_1 || '',
      businessAddress.street
    );

    return streetScore; // Could be expanded to include more address components
  }

  private calculateMappingConfidence(
    squareLocation: SquareLocation,
    businessLocation: BusinessLocation,
    similarity: number
  ): number {
    let confidence = similarity;

    // Boost confidence for exact city matches
    if (squareLocation.address?.locality?.toLowerCase() === 
        businessLocation.address.city.toLowerCase()) {
      confidence += 0.1;
    }

    // Boost confidence for exact postal code matches
    if (squareLocation.address?.postal_code === businessLocation.address.postalCode) {
      confidence += 0.1;
    }

    // Reduce confidence if location is inactive
    if (!businessLocation.isActive) {
      confidence -= 0.2;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private getMappingReasons(
    squareLocation: SquareLocation,
    businessLocation: BusinessLocation,
    similarity: number
  ): string[] {
    const reasons: string[] = [];

    if (this.calculateStringSimilarity(squareLocation.name || '', businessLocation.name) > 0.8) {
      reasons.push('Strong name match');
    }

    if (squareLocation.address?.locality?.toLowerCase() === 
        businessLocation.address.city.toLowerCase()) {
      reasons.push('Exact city match');
    }

    if (squareLocation.address?.postal_code === businessLocation.address.postalCode) {
      reasons.push('Exact postal code match');
    }

    if (similarity > 0.9) {
      reasons.push('Very high overall similarity');
    } else if (similarity > 0.7) {
      reasons.push('High overall similarity');
    }

    return reasons;
  }

  private async createLocationMapping(
    squareLocationId: string,
    businessLocationId: string,
    mappingType: 'automatic' | 'manual',
    confidence: number
  ): Promise<LocationMapping> {
    const mapping: LocationMapping = {
      id: `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      squareLocationId,
      businessLocationId,
      businessId: this.config.businessId,
      mappingType,
      confidence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to database (in real implementation)
    await this.saveMapping(mapping);

    return mapping;
  }

  private hasLocationChanged(
    squareLocation: SquareLocation,
    businessLocation: BusinessLocation
  ): boolean {
    // Check if Square location details have changed compared to business location
    return (
      squareLocation.name !== businessLocation.name ||
      squareLocation.address?.address_line_1 !== businessLocation.address.street ||
      squareLocation.address?.locality !== businessLocation.address.city
    );
  }

  private async updateBusinessLocationFromSquare(
    businessLocation: BusinessLocation,
    squareLocation: SquareLocation
  ): Promise<void> {
    // Update business location with Square location data
    businessLocation.name = squareLocation.name || businessLocation.name;
    businessLocation.updatedAt = new Date().toISOString();

    if (squareLocation.address) {
      businessLocation.address = {
        ...businessLocation.address,
        street: squareLocation.address.address_line_1 || businessLocation.address.street,
        city: squareLocation.address.locality || businessLocation.address.city,
        postalCode: squareLocation.address.postal_code || businessLocation.address.postalCode
      };
    }

    // Save to database (in real implementation)
    await this.saveBusinessLocation(businessLocation);
  }

  private async loadBusinessLocations(): Promise<void> {
    // In a real implementation, this would load from the database
    // For development, we'll create some mock Swedish business locations
    const mockLocations: BusinessLocation[] = [
      {
        id: 'biz_loc_1',
        businessId: this.config.businessId,
        name: 'Aurora Café Stockholm',
        address: {
          street: 'Kungsgatan 12',
          city: 'Stockholm',
          postalCode: '111 43',
          country: 'SE'
        },
        timezone: 'Europe/Stockholm',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      {
        id: 'biz_loc_2',
        businessId: this.config.businessId,
        name: 'Fika Kaffebar Göteborg',
        address: {
          street: 'Avenyn 22',
          city: 'Göteborg',
          postalCode: '411 36',
          country: 'SE'
        },
        timezone: 'Europe/Stockholm',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ];

    for (const location of mockLocations) {
      this.businessLocations.set(location.id, location);
    }
  }

  private async loadExistingMappings(): Promise<void> {
    // In a real implementation, this would load from the database
    // For development, we'll start with empty mappings
  }

  private async saveMapping(mapping: LocationMapping): Promise<void> {
    // In a real implementation, this would save to the database
    console.log(`💾 Saving mapping: ${mapping.id}`);
  }

  private async saveBusinessLocation(location: BusinessLocation): Promise<void> {
    // In a real implementation, this would save to the database
    console.log(`💾 Updating business location: ${location.id}`);
  }

  private async deleteMappingFromDatabase(mappingId: string): Promise<void> {
    // In a real implementation, this would delete from the database
    console.log(`🗑️  Deleting mapping: ${mappingId}`);
  }
}

/**
 * Create location mapper instance for Swedish AI feedback platform
 */
export function createSquareLocationMapper(
  credentials: SquareCredentials,
  businessId: string,
  options?: Partial<LocationMappingConfig>
): SquareLocationMapper {
  return new SquareLocationMapper({
    credentials,
    businessId,
    autoMapThreshold: 0.8,
    requireVerification: false,
    enableGeocoding: true,
    ...options
  });
}