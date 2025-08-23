/**
 * Advanced Geographic Pattern Analysis for AI Feedback Platform
 * Implements sophisticated location-based pattern detection, impossible travel detection,
 * location clustering, and geographic fraud analysis
 */

import {
  GeographicLocation,
  GeographicPattern,
  GeographicPatternType,
  ImpossibleTravelEvent,
  GeographicHeatmapData,
  CompetitorAnalysis,
  PatternDetectionResult,
  AnalyticsConfig
} from '@feedback-platform/shared-types';
import KMeans from 'ml-kmeans';
import { distance as geoDistance } from 'geokdbush';
import * as math from 'mathjs';
import { mean, standardDeviation, variance } from 'simple-statistics';

interface SessionLocationData {
  sessionId: string;
  customerHash: string;
  businessId: string;
  locationId: string;
  location: GeographicLocation;
  timestamp: Date;
  qualityScore?: number;
  rewardAmount?: number;
}

export class GeographicAnalyzer {
  private config: AnalyticsConfig['geographic'];
  private sessionHistory: Map<string, SessionLocationData[]> = new Map();
  private locationCache: Map<string, GeographicLocation> = new Map();
  private patternCache: Map<string, GeographicPattern[]> = new Map();

  constructor(config: Partial<AnalyticsConfig['geographic']> = {}) {
    this.config = {
      impossibleTravelSpeedKmh: 1000, // Very fast but realistic (commercial aviation + ground transport)
      clusterDistanceThresholdKm: 5,
      hotspotMinimumSessions: 10,
      geofenceRadiusKm: 50,
      ...config
    };
  }

  /**
   * Analyze a session for geographic patterns and anomalies
   */
  async analyzeSession(sessionData: SessionLocationData): Promise<PatternDetectionResult> {
    // Store session data
    this.addSessionData(sessionData);

    // Get customer history for pattern analysis
    const customerHistory = this.getCustomerHistory(sessionData.customerHash);
    
    // Detect impossible travel
    const impossibleTravel = await this.detectImpossibleTravel(sessionData, customerHistory);
    
    // Detect location clustering patterns
    const clusterPatterns = await this.detectLocationClusters(customerHistory);
    
    // Detect geographic outliers
    const outlierPatterns = await this.detectGeographicOutliers(sessionData, customerHistory);
    
    // Detect geofence violations
    const geofenceViolations = await this.detectGeofenceViolations(sessionData);

    // Combine all patterns
    const allPatterns: GeographicPattern[] = [
      ...impossibleTravel.map(it => this.impossibleTravelToPattern(it)),
      ...clusterPatterns,
      ...outlierPatterns,
      ...geofenceViolations
    ];

    // Calculate overall anomaly score
    const anomalyScore = this.calculateGeographicAnomalyScore(allPatterns, sessionData);
    
    return {
      sessionId: sessionData.sessionId,
      customerHash: sessionData.customerHash,
      geographicPatterns: allPatterns,
      temporalPatterns: [], // Will be populated by TemporalAnalyzer
      anomalyScore,
      riskLevel: this.determineRiskLevel(anomalyScore),
      confidence: this.calculateConfidence(allPatterns),
      reasoning: this.generateReasoning(allPatterns),
      detectedAt: new Date()
    };
  }

  /**
   * Detect impossible travel events
   */
  private async detectImpossibleTravel(
    currentSession: SessionLocationData,
    customerHistory: SessionLocationData[]
  ): Promise<ImpossibleTravelEvent[]> {
    const impossibleTravels: ImpossibleTravelEvent[] = [];
    
    // Check against recent sessions (last 24 hours)
    const recentSessions = customerHistory.filter(session => {
      const timeDiff = currentSession.timestamp.getTime() - session.timestamp.getTime();
      return timeDiff > 0 && timeDiff < 24 * 60 * 60 * 1000; // 24 hours
    });

    for (const previousSession of recentSessions) {
      const distance = this.calculateDistance(
        currentSession.location,
        previousSession.location
      );
      
      const timeDifference = (currentSession.timestamp.getTime() - previousSession.timestamp.getTime()) / (1000 * 60); // minutes
      
      if (distance > 0.1 && timeDifference > 0) { // Ignore same location or time anomalies
        const minimumTravelTime = this.calculateMinimumTravelTime(distance);
        const impossibilityFactor = minimumTravelTime / timeDifference;
        
        if (impossibilityFactor > 1.2) { // 20% tolerance for scheduling differences
          impossibleTravels.push({
            sessionId1: previousSession.sessionId,
            sessionId2: currentSession.sessionId,
            location1: previousSession.location,
            location2: currentSession.location,
            distance,
            timeDifference,
            minimumTravelTime,
            impossibilityFactor,
            confidence: Math.min(0.95, impossibilityFactor / 2), // Higher impossibility = higher confidence
            customerHash: currentSession.customerHash
          });
        }
      }
    }

    return impossibleTravels;
  }

  /**
   * Detect location clustering patterns
   */
  private async detectLocationClusters(
    customerHistory: SessionLocationData[]
  ): Promise<GeographicPattern[]> {
    if (customerHistory.length < 3) return [];

    const locations = customerHistory.map(session => ({
      id: session.sessionId,
      lat: session.location.latitude,
      lng: session.location.longitude,
      session
    }));

    // Use K-means clustering to identify location clusters
    const coordinates = locations.map(loc => [loc.lat, loc.lng]);
    const k = Math.min(5, Math.max(2, Math.floor(coordinates.length / 3))); // Dynamic K selection
    
    try {
      const kmeans = KMeans(coordinates, k, { initialization: 'kmeans++' });
      const clusters = this.groupLocationsByCluster(locations, kmeans.clusters);
      
      const patterns: GeographicPattern[] = [];
      
      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        if (cluster.length >= 2) {
          const centerPoint = this.calculateClusterCenter(cluster);
          const radius = this.calculateClusterRadius(cluster, centerPoint);
          
          patterns.push({
            id: `cluster_${Date.now()}_${i}`,
            type: 'location_cluster',
            locations: cluster.map(item => item.session.location),
            centerPoint,
            radius,
            confidence: this.calculateClusterConfidence(cluster),
            sessionCount: cluster.length,
            timespan: {
              start: new Date(Math.min(...cluster.map(c => c.session.timestamp.getTime()))),
              end: new Date(Math.max(...cluster.map(c => c.session.timestamp.getTime())))
            },
            metadata: {
              averageQualityScore: mean(cluster.map(c => c.session.qualityScore || 0).filter(s => s > 0))
            }
          });
        }
      }

      return patterns;
    } catch (error) {
      console.error('Clustering error:', error);
      return [];
    }
  }

  /**
   * Detect geographic outliers
   */
  private async detectGeographicOutliers(
    currentSession: SessionLocationData,
    customerHistory: SessionLocationData[]
  ): Promise<GeographicPattern[]> {
    if (customerHistory.length < 5) return [];

    const distances = customerHistory.map(session => 
      this.calculateDistance(currentSession.location, session.location)
    );

    if (distances.length === 0) return [];

    const meanDistance = mean(distances);
    const stdDistance = standardDeviation(distances);
    const currentDistances = distances.slice(-1);

    const outlierPatterns: GeographicPattern[] = [];

    // Z-score outlier detection
    for (let i = 0; i < currentDistances.length; i++) {
      const distance = currentDistances[i];
      const zScore = Math.abs((distance - meanDistance) / stdDistance);
      
      if (zScore > 2.5) { // Significant outlier
        outlierPatterns.push({
          id: `outlier_${currentSession.sessionId}`,
          type: 'outlier',
          locations: [currentSession.location],
          centerPoint: currentSession.location,
          radius: 0,
          confidence: Math.min(0.95, zScore / 4),
          sessionCount: 1,
          timespan: {
            start: currentSession.timestamp,
            end: currentSession.timestamp
          },
          metadata: {
            zScore,
            meanDistance,
            standardDeviation: stdDistance
          }
        });
      }
    }

    return outlierPatterns;
  }

  /**
   * Detect geofence violations (sessions outside expected business area)
   */
  private async detectGeofenceViolations(
    sessionData: SessionLocationData
  ): Promise<GeographicPattern[]> {
    // Get business location center (in production, this would come from database)
    const businessCenter = await this.getBusinessCenter(sessionData.businessId);
    if (!businessCenter) return [];

    const distance = this.calculateDistance(sessionData.location, businessCenter);
    
    if (distance > this.config.geofenceRadiusKm) {
      return [{
        id: `geofence_violation_${sessionData.sessionId}`,
        type: 'geofence_violation',
        locations: [sessionData.location],
        centerPoint: businessCenter,
        radius: distance,
        confidence: Math.min(0.9, (distance - this.config.geofenceRadiusKm) / this.config.geofenceRadiusKm),
        sessionCount: 1,
        timespan: {
          start: sessionData.timestamp,
          end: sessionData.timestamp
        },
        metadata: {
          expectedRadius: this.config.geofenceRadiusKm,
          actualDistance: distance,
          businessCenter
        }
      }];
    }

    return [];
  }

  /**
   * Generate geographic heatmap data for visualization
   */
  async generateHeatmapData(
    businessId?: string,
    locationId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<GeographicHeatmapData[]> {
    const sessions = this.getFilteredSessions(businessId, locationId, timeRange);
    const locationGroups = this.groupSessionsByLocation(sessions);
    
    const heatmapData: GeographicHeatmapData[] = [];
    const maxSessions = Math.max(...Object.values(locationGroups).map(group => group.length));

    for (const [locationKey, sessionGroup] of Object.entries(locationGroups)) {
      const location = sessionGroup[0].location;
      const intensity = sessionGroup.length / maxSessions;
      const avgQuality = mean(sessionGroup.map(s => s.qualityScore || 0).filter(s => s > 0));

      heatmapData.push({
        location,
        intensity,
        sessionCount: sessionGroup.length,
        averageQualityScore: avgQuality || undefined,
        metadata: {
          locationKey,
          timeRange: {
            start: new Date(Math.min(...sessionGroup.map(s => s.timestamp.getTime()))),
            end: new Date(Math.max(...sessionGroup.map(s => s.timestamp.getTime())))
          }
        }
      });
    }

    return heatmapData.sort((a, b) => b.intensity - a.intensity);
  }

  /**
   * Analyze competitor proximity and impact
   */
  async analyzeCompetitorProximity(
    businessLocation: GeographicLocation,
    competitorLocations: GeographicLocation[]
  ): Promise<CompetitorAnalysis[]> {
    return competitorLocations.map(competitor => {
      const distance = this.calculateDistance(businessLocation, competitor);
      const estimatedImpact = this.calculateCompetitorImpact(distance);

      return {
        location: competitor,
        type: 'competitor', // In production, this would be determined from business type
        distance,
        estimatedImpact
      };
    }).sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  }

  // Utility Methods

  private addSessionData(sessionData: SessionLocationData): void {
    const customerHistory = this.sessionHistory.get(sessionData.customerHash) || [];
    customerHistory.push(sessionData);
    
    // Keep only last 100 sessions per customer for memory efficiency
    if (customerHistory.length > 100) {
      customerHistory.splice(0, customerHistory.length - 100);
    }
    
    this.sessionHistory.set(sessionData.customerHash, customerHistory);
  }

  private getCustomerHistory(customerHash: string): SessionLocationData[] {
    return this.sessionHistory.get(customerHash) || [];
  }

  private calculateDistance(loc1: GeographicLocation, loc2: GeographicLocation): number {
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateMinimumTravelTime(distanceKm: number): number {
    // Realistic travel time calculation considering multiple transport modes
    if (distanceKm < 50) {
      return (distanceKm / 60) * 60; // 60 km/h average for local travel
    } else if (distanceKm < 500) {
      return (distanceKm / 100) * 60; // 100 km/h for highway travel
    } else {
      return (distanceKm / this.config.impossibleTravelSpeedKmh) * 60; // Air travel + ground transport
    }
  }

  private groupLocationsByCluster(
    locations: Array<{ id: string; lat: number; lng: number; session: SessionLocationData }>,
    clusters: number[]
  ): Array<Array<{ id: string; lat: number; lng: number; session: SessionLocationData }>> {
    const groups: Array<Array<{ id: string; lat: number; lng: number; session: SessionLocationData }>> = [];
    const maxCluster = Math.max(...clusters);
    
    for (let i = 0; i <= maxCluster; i++) {
      groups.push([]);
    }
    
    clusters.forEach((cluster, index) => {
      groups[cluster].push(locations[index]);
    });
    
    return groups;
  }

  private calculateClusterCenter(cluster: Array<{ lat: number; lng: number }>): GeographicLocation {
    const avgLat = mean(cluster.map(c => c.lat));
    const avgLng = mean(cluster.map(c => c.lng));
    
    return {
      id: `center_${Date.now()}`,
      latitude: avgLat,
      longitude: avgLng,
      country: 'SE' // Default to Sweden for this platform
    };
  }

  private calculateClusterRadius(
    cluster: Array<{ lat: number; lng: number }>,
    center: GeographicLocation
  ): number {
    const distances = cluster.map(point => 
      this.calculateDistance(center, { id: '', latitude: point.lat, longitude: point.lng, country: 'SE' })
    );
    return Math.max(...distances);
  }

  private calculateClusterConfidence(cluster: Array<{ session: SessionLocationData }>): number {
    // Higher confidence for larger, more consistent clusters
    const size = cluster.length;
    const timeSpan = Math.max(...cluster.map(c => c.session.timestamp.getTime())) - 
                    Math.min(...cluster.map(c => c.session.timestamp.getTime()));
    
    // Confidence based on cluster size and time span
    const sizeScore = Math.min(1, size / 10); // Max confidence at 10+ sessions
    const timeScore = Math.min(1, timeSpan / (7 * 24 * 60 * 60 * 1000)); // Max confidence at 1 week span
    
    return (sizeScore + timeScore) / 2;
  }

  private impossibleTravelToPattern(impossibleTravel: ImpossibleTravelEvent): GeographicPattern {
    return {
      id: `impossible_travel_${impossibleTravel.sessionId2}`,
      type: 'impossible_travel',
      locations: [impossibleTravel.location1, impossibleTravel.location2],
      centerPoint: this.calculateMidpoint(impossibleTravel.location1, impossibleTravel.location2),
      radius: impossibleTravel.distance / 2,
      confidence: impossibleTravel.confidence,
      sessionCount: 2,
      timespan: {
        start: new Date(Date.now() - impossibleTravel.timeDifference * 60 * 1000),
        end: new Date()
      },
      metadata: {
        impossibilityFactor: impossibleTravel.impossibilityFactor,
        distance: impossibleTravel.distance,
        timeDifference: impossibleTravel.timeDifference
      }
    };
  }

  private calculateMidpoint(loc1: GeographicLocation, loc2: GeographicLocation): GeographicLocation {
    return {
      id: `midpoint_${Date.now()}`,
      latitude: (loc1.latitude + loc2.latitude) / 2,
      longitude: (loc1.longitude + loc2.longitude) / 2,
      country: loc1.country
    };
  }

  private calculateGeographicAnomalyScore(
    patterns: GeographicPattern[],
    sessionData: SessionLocationData
  ): number {
    if (patterns.length === 0) return 0;

    // Weight different pattern types
    const weights: Record<GeographicPatternType, number> = {
      'impossible_travel': 0.9,
      'geofence_violation': 0.7,
      'outlier': 0.6,
      'location_cluster': 0.3,
      'hotspot': 0.2,
      'travel_route': 0.4
    };

    let totalScore = 0;
    let totalWeight = 0;

    patterns.forEach(pattern => {
      const weight = weights[pattern.type];
      const score = pattern.confidence * weight;
      totalScore += score;
      totalWeight += weight;
    });

    return totalWeight > 0 ? Math.min(1, totalScore / totalWeight) : 0;
  }

  private determineRiskLevel(anomalyScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (anomalyScore >= 0.8) return 'critical';
    if (anomalyScore >= 0.6) return 'high';
    if (anomalyScore >= 0.3) return 'medium';
    return 'low';
  }

  private calculateConfidence(patterns: GeographicPattern[]): number {
    if (patterns.length === 0) return 0.8; // High confidence when no anomalies detected
    
    const avgConfidence = mean(patterns.map(p => p.confidence));
    const patternVariety = Math.min(1, patterns.length / 5); // More patterns = higher confidence
    
    return avgConfidence * (0.8 + patternVariety * 0.2);
  }

  private generateReasoning(patterns: GeographicPattern[]): string[] {
    const reasoning: string[] = [];

    patterns.forEach(pattern => {
      switch (pattern.type) {
        case 'impossible_travel':
          reasoning.push(`Impossible travel detected: ${pattern.radius * 2}km in ${pattern.metadata?.timeDifference}min`);
          break;
        case 'geofence_violation':
          reasoning.push(`Location outside expected business area by ${(pattern.metadata?.actualDistance - pattern.metadata?.expectedRadius).toFixed(1)}km`);
          break;
        case 'outlier':
          reasoning.push(`Geographic outlier detected with Z-score: ${pattern.metadata?.zScore?.toFixed(2)}`);
          break;
        case 'location_cluster':
          reasoning.push(`Location clustering pattern with ${pattern.sessionCount} sessions`);
          break;
      }
    });

    if (reasoning.length === 0) {
      reasoning.push('No significant geographic anomalies detected');
    }

    return reasoning;
  }

  private getFilteredSessions(
    businessId?: string,
    locationId?: string,
    timeRange?: { start: Date; end: Date }
  ): SessionLocationData[] {
    let allSessions: SessionLocationData[] = [];
    
    // Collect all sessions from history
    for (const customerSessions of this.sessionHistory.values()) {
      allSessions = allSessions.concat(customerSessions);
    }

    return allSessions.filter(session => {
      if (businessId && session.businessId !== businessId) return false;
      if (locationId && session.locationId !== locationId) return false;
      if (timeRange) {
        if (session.timestamp < timeRange.start || session.timestamp > timeRange.end) return false;
      }
      return true;
    });
  }

  private groupSessionsByLocation(sessions: SessionLocationData[]): Record<string, SessionLocationData[]> {
    const groups: Record<string, SessionLocationData[]> = {};
    
    sessions.forEach(session => {
      // Create a location key with some precision rounding for grouping nearby locations
      const lat = Math.round(session.location.latitude * 1000) / 1000;
      const lng = Math.round(session.location.longitude * 1000) / 1000;
      const key = `${lat},${lng}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(session);
    });
    
    return groups;
  }

  private calculateCompetitorImpact(distance: number): number {
    // Impact decreases exponentially with distance
    // Maximum impact at 0km, minimal impact beyond 5km
    return Math.max(0, Math.exp(-distance / 2));
  }

  private async getBusinessCenter(businessId: string): Promise<GeographicLocation | null> {
    // In production, this would query the database for business location
    // For now, return mock data
    return {
      id: `business_center_${businessId}`,
      latitude: 59.3293, // Stockholm coordinates as default
      longitude: 18.0686,
      country: 'SE'
    };
  }

  /**
   * Clean up old data to prevent memory leaks
   */
  cleanupHistory(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [customerHash, sessions] of this.sessionHistory.entries()) {
      const filteredSessions = sessions.filter(session => session.timestamp >= cutoff);
      
      if (filteredSessions.length === 0) {
        this.sessionHistory.delete(customerHash);
      } else {
        this.sessionHistory.set(customerHash, filteredSessions);
      }
    }

    this.patternCache.clear(); // Clear pattern cache on cleanup
  }

  /**
   * Get statistics about the geographic analyzer
   */
  getStats(): {
    customerCount: number;
    totalSessions: number;
    cacheSize: number;
    oldestSession: Date | null;
  } {
    let totalSessions = 0;
    let oldestTimestamp = Infinity;

    for (const sessions of this.sessionHistory.values()) {
      totalSessions += sessions.length;
      for (const session of sessions) {
        oldestTimestamp = Math.min(oldestTimestamp, session.timestamp.getTime());
      }
    }

    return {
      customerCount: this.sessionHistory.size,
      totalSessions,
      cacheSize: this.patternCache.size,
      oldestSession: oldestTimestamp === Infinity ? null : new Date(oldestTimestamp)
    };
  }
}