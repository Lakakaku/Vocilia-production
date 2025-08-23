/**
 * Advanced Analytics Types for AI Feedback Platform
 * Geographic and Temporal Pattern Analysis
 */

// Geographic Types
export interface GeographicLocation {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  region?: string;
  country: string;
  postalCode?: string;
}

export interface GeographicPattern {
  id: string;
  type: GeographicPatternType;
  locations: GeographicLocation[];
  centerPoint: GeographicLocation;
  radius: number; // km
  confidence: number; // 0-1
  sessionCount: number;
  timespan: {
    start: Date;
    end: Date;
  };
  metadata?: Record<string, unknown>;
}

export type GeographicPatternType = 
  | 'impossible_travel'
  | 'location_cluster'
  | 'hotspot'
  | 'outlier'
  | 'travel_route'
  | 'geofence_violation';

export interface ImpossibleTravelEvent {
  sessionId1: string;
  sessionId2: string;
  location1: GeographicLocation;
  location2: GeographicLocation;
  distance: number; // km
  timeDifference: number; // minutes
  minimumTravelTime: number; // minutes (by fastest transport)
  impossibilityFactor: number; // ratio of required speed to max realistic speed
  confidence: number; // 0-1
  customerHash: string;
}

// Temporal Types
export interface TemporalPattern {
  id: string;
  type: TemporalPatternType;
  timeRange: {
    start: Date;
    end: Date;
  };
  frequency: TemporalFrequency;
  sessionCount: number;
  averageInterval: number; // milliseconds
  intervalVariance: number; // statistical variance
  confidence: number; // 0-1
  metadata?: Record<string, unknown>;
}

export type TemporalPatternType =
  | 'regular_intervals'
  | 'burst_activity'
  | 'unusual_hours'
  | 'seasonal_anomaly'
  | 'frequency_spike'
  | 'dormant_period'
  | 'rapid_fire';

export type TemporalFrequency = 
  | 'minutely'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'seasonal'
  | 'irregular';

export interface SeasonalPattern {
  id: string;
  businessId?: string;
  locationId?: string;
  pattern: {
    hour: number[];     // 0-23
    dayOfWeek: number[]; // 0-6 (0=Sunday)
    dayOfMonth: number[]; // 1-31
    month: number[];    // 1-12
  };
  averageVolume: number;
  variance: number;
  confidence: number;
  lastUpdated: Date;
}

// Pattern Detection Results
export interface PatternDetectionResult {
  sessionId: string;
  customerHash: string;
  geographicPatterns: GeographicPattern[];
  temporalPatterns: TemporalPattern[];
  anomalyScore: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  reasoning: string[];
  detectedAt: Date;
}

// Correlation Analysis
export interface CorrelationAnalysis {
  id: string;
  type: 'geographic_temporal' | 'cross_location' | 'customer_behavior';
  correlationCoefficient: number; // -1 to 1
  significance: number; // p-value
  sampleSize: number;
  variables: {
    x: string; // variable name
    y: string; // variable name
  };
  timeRange: {
    start: Date;
    end: Date;
  };
  insights: string[];
}

// Business Analytics Types
export interface LocationInsights {
  locationId: string;
  businessId: string;
  metrics: {
    totalSessions: number;
    uniqueCustomers: number;
    averageQualityScore: number;
    peakHours: number[];
    customerRetentionRate: number;
  };
  geographicData: {
    customerDistribution: GeographicHeatmapData[];
    catchmentArea: GeographicLocation[];
    competitorProximity: CompetitorAnalysis[];
  };
  temporalData: {
    hourlyTrends: HourlyTrend[];
    dailyTrends: DailyTrend[];
    seasonalTrends: SeasonalTrend[];
  };
  patterns: {
    geographicPatterns: GeographicPattern[];
    temporalPatterns: TemporalPattern[];
    anomalies: PatternDetectionResult[];
  };
  lastUpdated: Date;
}

export interface GeographicHeatmapData {
  location: GeographicLocation;
  intensity: number; // 0-1 normalized
  sessionCount: number;
  averageQualityScore?: number;
  metadata?: Record<string, unknown>;
}

export interface CompetitorAnalysis {
  location: GeographicLocation;
  type: string; // business type
  distance: number; // km
  estimatedImpact: number; // 0-1
}

export interface HourlyTrend {
  hour: number; // 0-23
  sessionCount: number;
  averageQualityScore: number;
  averageRewardAmount: number;
}

export interface DailyTrend {
  dayOfWeek: number; // 0-6
  sessionCount: number;
  averageQualityScore: number;
  averageRewardAmount: number;
}

export interface SeasonalTrend {
  month: number; // 1-12
  sessionCount: number;
  averageQualityScore: number;
  averageRewardAmount: number;
  yearOverYearGrowth?: number; // percentage
}

// Analytics Configuration
export interface AnalyticsConfig {
  geographic: {
    impossibleTravelSpeedKmh: number; // max realistic travel speed
    clusterDistanceThresholdKm: number; // distance for location clustering
    hotspotMinimumSessions: number; // minimum sessions to form hotspot
    geofenceRadiusKm: number; // standard geofence radius
  };
  temporal: {
    burstDetectionWindowMinutes: number; // time window for burst detection
    regularIntervalToleranceMs: number; // tolerance for regular intervals
    seasonalAnalysisMinimumDays: number; // minimum data for seasonal analysis
    anomalyDetectionSensitivity: number; // 0-1, higher = more sensitive
  };
  pattern: {
    minimumPatternOccurrences: number; // minimum occurrences to establish pattern
    confidenceThreshold: number; // minimum confidence to report pattern
    correlationSignificanceLevel: number; // statistical significance level
  };
  performance: {
    maxConcurrentAnalyses: number; // maximum concurrent pattern analyses
    cacheRetentionHours: number; // how long to cache analysis results
    batchSize: number; // batch size for processing large datasets
  };
}

// API Response Types
export interface AnalyticsAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    processingTime: number; // milliseconds
    cacheHit: boolean;
    dataVersion: string;
  };
}

// Event Types for Real-time Analytics
export interface AnalyticsEvent {
  type: AnalyticsEventType;
  sessionId: string;
  customerHash?: string;
  businessId?: string;
  locationId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type AnalyticsEventType =
  | 'session_start'
  | 'session_end'
  | 'location_change'
  | 'pattern_detected'
  | 'anomaly_detected'
  | 'correlation_found';

// Machine Learning Types
export interface MLModelConfig {
  modelType: 'kmeans' | 'dbscan' | 'isolation_forest' | 'autoencoder';
  parameters: Record<string, unknown>;
  trainingDataSize: number;
  accuracy: number; // 0-1
  lastTrained: Date;
  version: string;
}

export interface AnomalyDetectionModel {
  id: string;
  config: MLModelConfig;
  threshold: number; // anomaly score threshold
  falsePositiveRate: number; // measured false positive rate
  truePositiveRate: number; // measured true positive rate
  isActive: boolean;
}

// Analytics Query Types
export interface AnalyticsQuery {
  type: 'geographic' | 'temporal' | 'pattern' | 'correlation';
  filters: {
    businessId?: string;
    locationId?: string;
    customerHash?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
    geographicBounds?: {
      northEast: GeographicLocation;
      southWest: GeographicLocation;
    };
  };
  aggregation?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
  offset?: number;
}

export interface AnalyticsQueryResult<T = unknown> {
  query: AnalyticsQuery;
  results: T[];
  totalCount: number;
  processingTime: number; // milliseconds
  generatedAt: Date;
}