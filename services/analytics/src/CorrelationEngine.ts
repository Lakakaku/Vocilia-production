import { Matrix } from 'ml-matrix';
import { covariance, variance, mean, standardDeviation } from 'simple-statistics';
import type {
  SessionLocationData,
  TemporalPattern,
  GeographicPattern,
  PatternDetectionResult,
  SessionData,
  CorrelationMatrix,
  DimensionalRelationship,
  MultiDimensionalInsight,
  BusinessContext,
  RiskFactors,
  FraudFlag,
  SeasonalTrend,
  BusinessInsights,
  FeatureVector,
  CorrelationStrength
} from '@feedback-platform/shared-types';

interface CorrelationConfig {
  minCorrelationThreshold: number; // 0.3 = weak, 0.5 = moderate, 0.7 = strong
  significanceLevel: number; // 0.05 = 95% confidence
  minimumSampleSize: number;
  maxDimensions: number;
  timeWindowDays: number;
  enableCausalAnalysis: boolean;
  adaptiveThresholds: boolean;
}

interface DimensionMetrics {
  geographic: {
    latitude: number[];
    longitude: number[];
    travelDistance: number[];
    locationFrequency: number[];
    regionDensity: number[];
  };
  temporal: {
    hourOfDay: number[];
    dayOfWeek: number[];
    monthOfYear: number[];
    sessionDuration: number[];
    timeBetweenSessions: number[];
  };
  behavioral: {
    qualityScore: number[];
    authenticityScore: number[];
    concretenessScore: number[];
    depthScore: number[];
    sentimentScore: number[];
    transcriptLength: number[];
    pauseDuration: number[];
    speechRate: number[];
  };
  contextual: {
    purchaseAmount: number[];
    itemCount: number[];
    businessType: number[];
    locationSize: number[];
    staffCount: number[];
  };
  technical: {
    deviceType: number[];
    browserType: number[];
    connectionQuality: number[];
    audioQuality: number[];
    latency: number[];
  };
}

interface CorrelationResult {
  dimensions: [string, string];
  coefficient: number;
  pValue: number;
  significance: 'very_strong' | 'strong' | 'moderate' | 'weak' | 'very_weak' | 'none';
  sampleSize: number;
  confidenceInterval: [number, number];
  relationship: 'positive' | 'negative' | 'none';
  causalLikelihood?: number; // 0-1, if causal analysis enabled
}

interface PrincipalComponentResult {
  components: number[][];
  explainedVariance: number[];
  cumulativeVariance: number[];
  eigenValues: number[];
  loadings: Record<string, number[]>;
}

interface ClusterCorrelation {
  clusterId: string;
  clusterName: string;
  correlations: CorrelationResult[];
  dominantFactors: string[];
  riskLevel: 'low' | 'medium' | 'high';
  businessRelevance: number; // 0-1
}

export class CorrelationEngine {
  private config: CorrelationConfig;
  private historicalData: SessionData[] = [];
  private correlationCache: Map<string, CorrelationResult> = new Map();
  private adaptiveThresholds: Map<string, number> = new Map();
  private principalComponents: PrincipalComponentResult | null = null;

  constructor(config: Partial<CorrelationConfig> = {}) {
    this.config = {
      minCorrelationThreshold: 0.3,
      significanceLevel: 0.05,
      minimumSampleSize: 30,
      maxDimensions: 50,
      timeWindowDays: 30,
      enableCausalAnalysis: false,
      adaptiveThresholds: true,
      ...config
    };
  }

  /**
   * Analyzes correlations across multiple dimensions of session data
   */
  async analyzeMultiDimensionalCorrelations(
    sessions: SessionData[],
    businessContext?: BusinessContext
  ): Promise<MultiDimensionalInsight> {
    if (sessions.length < this.config.minimumSampleSize) {
      throw new Error(`Insufficient sample size. Need at least ${this.config.minimumSampleSize} sessions.`);
    }

    // Extract dimensional metrics
    const metrics = this.extractDimensionalMetrics(sessions);
    
    // Build correlation matrix
    const correlationMatrix = await this.buildCorrelationMatrix(metrics);
    
    // Identify significant relationships
    const significantRelationships = this.identifySignificantRelationships(correlationMatrix);
    
    // Perform principal component analysis
    const pca = await this.performPrincipalComponentAnalysis(metrics);
    this.principalComponents = pca;
    
    // Detect dimensional clusters
    const clusters = await this.detectDimensionalClusters(metrics, correlationMatrix);
    
    // Generate business insights
    const businessInsights = this.generateBusinessInsights(
      significantRelationships, 
      pca, 
      clusters, 
      businessContext
    );
    
    // Assess fraud risk factors
    const riskFactors = this.assessRiskFactors(significantRelationships, clusters);
    
    // Update adaptive thresholds
    if (this.config.adaptiveThresholds) {
      this.updateAdaptiveThresholds(correlationMatrix);
    }

    return {
      correlationMatrix,
      significantRelationships,
      principalComponents: pca,
      dimensionalClusters: clusters,
      businessInsights,
      riskFactors,
      metadata: {
        sampleSize: sessions.length,
        analysisTimestamp: new Date(),
        timeWindow: this.config.timeWindowDays,
        confidenceLevel: 1 - this.config.significanceLevel
      }
    };
  }

  /**
   * Real-time correlation analysis for incoming session
   */
  async analyzeSessionCorrelations(
    session: SessionData,
    referenceSessions: SessionData[]
  ): Promise<PatternDetectionResult> {
    const sessionMetrics = this.extractSessionMetrics(session);
    const referenceMetrics = this.extractDimensionalMetrics(referenceSessions);
    
    const anomalies: Array<{
      dimension: string;
      severity: number;
      description: string;
      expectedRange: [number, number];
      actualValue: number;
    }> = [];

    // Check correlations against established patterns
    for (const [dimName, values] of Object.entries(referenceMetrics)) {
      if (typeof values === 'object' && values !== null) {
        for (const [metricName, metricValues] of Object.entries(values)) {
          const sessionValue = this.getSessionMetricValue(sessionMetrics, dimName, metricName);
          if (sessionValue !== null) {
            const anomaly = this.detectCorrelationAnomaly(
              sessionValue,
              metricValues as number[],
              `${dimName}.${metricName}`
            );
            if (anomaly) {
              anomalies.push(anomaly);
            }
          }
        }
      }
    }

    // Calculate overall risk score
    const riskScore = this.calculateOverallRiskScore(anomalies);
    
    // Generate fraud flags if needed
    const fraudFlags = anomalies
      .filter(a => a.severity > 0.7)
      .map(a => this.createFraudFlag(a));

    return {
      sessionId: session.id,
      patternType: 'correlation_analysis',
      anomalyScore: riskScore,
      confidence: Math.min(0.95, referenceSessions.length / 100),
      details: {
        correlationAnomalies: anomalies,
        dimensionsAnalyzed: Object.keys(referenceMetrics).length,
        referenceSize: referenceSessions.length
      },
      fraudFlags,
      timestamp: new Date(),
      processingTimeMs: 0 // Will be set by caller
    };
  }

  /**
   * Extract metrics from session data for correlation analysis
   */
  private extractDimensionalMetrics(sessions: SessionData[]): DimensionMetrics {
    const metrics: DimensionMetrics = {
      geographic: {
        latitude: [],
        longitude: [],
        travelDistance: [],
        locationFrequency: [],
        regionDensity: []
      },
      temporal: {
        hourOfDay: [],
        dayOfWeek: [],
        monthOfYear: [],
        sessionDuration: [],
        timeBetweenSessions: []
      },
      behavioral: {
        qualityScore: [],
        authenticityScore: [],
        concretenessScore: [],
        depthScore: [],
        sentimentScore: [],
        transcriptLength: [],
        pauseDuration: [],
        speechRate: []
      },
      contextual: {
        purchaseAmount: [],
        itemCount: [],
        businessType: [],
        locationSize: [],
        staffCount: []
      },
      technical: {
        deviceType: [],
        browserType: [],
        connectionQuality: [],
        audioQuality: [],
        latency: []
      }
    };

    sessions.forEach(session => {
      // Geographic metrics
      if (session.location) {
        metrics.geographic.latitude.push(session.location.latitude || 0);
        metrics.geographic.longitude.push(session.location.longitude || 0);
        metrics.geographic.locationFrequency.push(session.locationFrequency || 1);
      }

      // Temporal metrics
      const timestamp = new Date(session.timestamp);
      metrics.temporal.hourOfDay.push(timestamp.getHours());
      metrics.temporal.dayOfWeek.push(timestamp.getDay());
      metrics.temporal.monthOfYear.push(timestamp.getMonth());
      metrics.temporal.sessionDuration.push(session.audioDurationSeconds || 0);

      // Behavioral metrics
      if (session.aiEvaluation) {
        metrics.behavioral.qualityScore.push(session.qualityScore || 0);
        metrics.behavioral.authenticityScore.push(session.authenticityScore || 0);
        metrics.behavioral.concretenessScore.push(session.concretenessScore || 0);
        metrics.behavioral.depthScore.push(session.depthScore || 0);
        metrics.behavioral.sentimentScore.push(session.sentimentScore || 0);
      }

      if (session.transcript) {
        metrics.behavioral.transcriptLength.push(session.transcript.length);
        // Estimate speech rate (words per minute)
        const wordCount = session.transcript.split(' ').length;
        const duration = session.audioDurationSeconds || 1;
        metrics.behavioral.speechRate.push((wordCount / duration) * 60);
      }

      // Contextual metrics
      metrics.contextual.purchaseAmount.push(session.transactionAmount || 0);
      metrics.contextual.itemCount.push(session.transactionItems?.length || 0);

      // Technical metrics
      if (session.deviceFingerprint) {
        metrics.technical.deviceType.push(this.encodeDeviceType(session.deviceFingerprint.platform));
        metrics.technical.audioQuality.push(session.aiEvaluation?.transcriptionConfidence || 0.8);
      }
    });

    return metrics;
  }

  /**
   * Build comprehensive correlation matrix
   */
  private async buildCorrelationMatrix(metrics: DimensionMetrics): Promise<CorrelationMatrix> {
    const flatMetrics: Record<string, number[]> = {};
    
    // Flatten metrics into single-level structure
    for (const [dimension, subMetrics] of Object.entries(metrics)) {
      for (const [metric, values] of Object.entries(subMetrics)) {
        flatMetrics[`${dimension}.${metric}`] = values as number[];
      }
    }

    const correlations: Record<string, Record<string, CorrelationResult>> = {};
    const metricNames = Object.keys(flatMetrics);

    for (let i = 0; i < metricNames.length; i++) {
      const metric1 = metricNames[i];
      correlations[metric1] = {};

      for (let j = i; j < metricNames.length; j++) {
        const metric2 = metricNames[j];
        
        if (i === j) {
          // Self-correlation is always 1
          correlations[metric1][metric2] = {
            dimensions: [metric1, metric2],
            coefficient: 1.0,
            pValue: 0,
            significance: 'very_strong',
            sampleSize: flatMetrics[metric1].length,
            confidenceInterval: [1.0, 1.0],
            relationship: 'positive'
          };
        } else {
          const correlation = this.calculatePearsonCorrelation(
            flatMetrics[metric1],
            flatMetrics[metric2]
          );
          
          correlations[metric1][metric2] = correlation;
          // Mirror the correlation
          if (!correlations[metric2]) correlations[metric2] = {};
          correlations[metric2][metric1] = correlation;
        }
      }
    }

    return {
      matrix: correlations,
      dimensions: metricNames,
      sampleSize: Math.min(...Object.values(flatMetrics).map(arr => arr.length)),
      timestamp: new Date()
    };
  }

  /**
   * Calculate Pearson correlation coefficient with statistical significance
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): CorrelationResult {
    if (x.length !== y.length || x.length < 2) {
      throw new Error('Arrays must have equal length and at least 2 values');
    }

    const n = x.length;
    const meanX = mean(x);
    const meanY = mean(y);
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      
      numerator += deltaX * deltaY;
      denomX += deltaX * deltaX;
      denomY += deltaY * deltaY;
    }

    const r = numerator / Math.sqrt(denomX * denomY);
    
    // Calculate t-statistic for significance testing
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const pValue = this.calculateTTestPValue(t, n - 2);
    
    // Determine significance level
    const significance = this.determineSignificance(Math.abs(r), pValue);
    
    // Calculate confidence interval
    const confidenceInterval = this.calculateCorrelationConfidenceInterval(r, n);

    return {
      dimensions: ['x', 'y'], // Will be updated by caller
      coefficient: r,
      pValue,
      significance,
      sampleSize: n,
      confidenceInterval,
      relationship: r > 0 ? 'positive' : r < 0 ? 'negative' : 'none'
    };
  }

  /**
   * Identify statistically significant relationships
   */
  private identifySignificantRelationships(
    correlationMatrix: CorrelationMatrix
  ): DimensionalRelationship[] {
    const relationships: DimensionalRelationship[] = [];
    const processedPairs = new Set<string>();

    for (const [dim1, correlations] of Object.entries(correlationMatrix.matrix)) {
      for (const [dim2, correlation] of Object.entries(correlations)) {
        const pairKey = [dim1, dim2].sort().join('|');
        
        if (processedPairs.has(pairKey) || dim1 === dim2) {
          continue;
        }
        processedPairs.add(pairKey);

        if (Math.abs(correlation.coefficient) >= this.config.minCorrelationThreshold &&
            correlation.pValue <= this.config.significanceLevel) {
          
          relationships.push({
            dimension1: dim1,
            dimension2: dim2,
            correlationCoefficient: correlation.coefficient,
            significance: correlation.significance,
            relationship: correlation.relationship,
            businessImpact: this.assessBusinessImpact(dim1, dim2, correlation),
            fraudRelevance: this.assessFraudRelevance(dim1, dim2, correlation),
            actionable: this.isActionableInsight(dim1, dim2, correlation),
            confidenceLevel: 1 - correlation.pValue
          });
        }
      }
    }

    // Sort by absolute correlation strength
    return relationships.sort((a, b) => 
      Math.abs(b.correlationCoefficient) - Math.abs(a.correlationCoefficient)
    );
  }

  /**
   * Perform Principal Component Analysis to identify key dimensions
   */
  private async performPrincipalComponentAnalysis(
    metrics: DimensionMetrics
  ): Promise<PrincipalComponentResult> {
    // Flatten and normalize metrics
    const flatMetrics: Record<string, number[]> = {};
    
    for (const [dimension, subMetrics] of Object.entries(metrics)) {
      for (const [metric, values] of Object.entries(subMetrics)) {
        if ((values as number[]).length > 0) {
          flatMetrics[`${dimension}.${metric}`] = this.normalizeArray(values as number[]);
        }
      }
    }

    const metricNames = Object.keys(flatMetrics);
    const dataMatrix = this.buildDataMatrix(flatMetrics);
    
    if (dataMatrix.rows < 2 || dataMatrix.columns < 2) {
      throw new Error('Insufficient data for PCA analysis');
    }

    // Calculate covariance matrix
    const covMatrix = this.calculateCovarianceMatrix(dataMatrix);
    
    // Calculate eigenvalues and eigenvectors
    const eigenDecomposition = covMatrix.eig();
    const eigenValues = eigenDecomposition.realEigenvalues;
    const eigenVectors = eigenDecomposition.eigenvectorMatrix;

    // Sort by eigenvalue (descending)
    const indices = eigenValues.map((val, idx) => ({ val, idx }))
      .sort((a, b) => b.val - a.val)
      .map(item => item.idx);

    const sortedEigenValues = indices.map(i => eigenValues[i]);
    const sortedEigenVectors = eigenVectors.selection([], indices);

    // Calculate explained variance
    const totalVariance = sortedEigenValues.reduce((sum, val) => sum + val, 0);
    const explainedVariance = sortedEigenValues.map(val => val / totalVariance);
    
    const cumulativeVariance: number[] = [];
    let cumulative = 0;
    for (const variance of explainedVariance) {
      cumulative += variance;
      cumulativeVariance.push(cumulative);
    }

    // Extract principal components (limiting to meaningful number)
    const numComponents = Math.min(
      this.config.maxDimensions,
      sortedEigenValues.filter(val => val > 0.01).length
    );

    const components = Array.from({ length: numComponents }, (_, i) => 
      Array.from({ length: metricNames.length }, (_, j) => 
        sortedEigenVectors.get(j, i)
      )
    );

    // Create loadings map
    const loadings: Record<string, number[]> = {};
    metricNames.forEach((name, idx) => {
      loadings[name] = components.map(comp => comp[idx]);
    });

    return {
      components,
      explainedVariance: explainedVariance.slice(0, numComponents),
      cumulativeVariance: cumulativeVariance.slice(0, numComponents),
      eigenValues: sortedEigenValues.slice(0, numComponents),
      loadings
    };
  }

  /**
   * Detect dimensional clusters based on correlation patterns
   */
  private async detectDimensionalClusters(
    metrics: DimensionMetrics,
    correlationMatrix: CorrelationMatrix
  ): Promise<ClusterCorrelation[]> {
    const dimensions = correlationMatrix.dimensions;
    const distanceMatrix = this.buildDistanceMatrix(correlationMatrix);
    
    // Perform hierarchical clustering
    const clusters = this.performHierarchicalClustering(distanceMatrix, dimensions);
    
    const clusterCorrelations: ClusterCorrelation[] = [];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const intraClusterCorrelations: CorrelationResult[] = [];
      
      // Calculate intra-cluster correlations
      for (let j = 0; j < cluster.dimensions.length; j++) {
        for (let k = j + 1; k < cluster.dimensions.length; k++) {
          const dim1 = cluster.dimensions[j];
          const dim2 = cluster.dimensions[k];
          
          if (correlationMatrix.matrix[dim1] && correlationMatrix.matrix[dim1][dim2]) {
            intraClusterCorrelations.push(correlationMatrix.matrix[dim1][dim2]);
          }
        }
      }

      // Identify dominant factors
      const dominantFactors = this.identifyDominantFactors(cluster.dimensions, correlationMatrix);
      
      // Assess risk level
      const riskLevel = this.assessClusterRiskLevel(cluster.dimensions, intraClusterCorrelations);
      
      // Calculate business relevance
      const businessRelevance = this.calculateBusinessRelevance(cluster.dimensions);

      clusterCorrelations.push({
        clusterId: `cluster_${i}`,
        clusterName: this.generateClusterName(dominantFactors),
        correlations: intraClusterCorrelations,
        dominantFactors,
        riskLevel,
        businessRelevance
      });
    }

    return clusterCorrelations;
  }

  /**
   * Generate actionable business insights from correlation analysis
   */
  private generateBusinessInsights(
    relationships: DimensionalRelationship[],
    pca: PrincipalComponentResult,
    clusters: ClusterCorrelation[],
    businessContext?: BusinessContext
  ): BusinessInsights {
    const insights: BusinessInsights = {
      keyFindings: [],
      riskFactors: [],
      opportunities: [],
      recommendations: [],
      confidence: 0.8,
      actionPriority: 'medium'
    };

    // Analyze key findings from strong correlations
    const strongRelationships = relationships.filter(r => r.significance === 'strong' || r.significance === 'very_strong');
    
    for (const rel of strongRelationships.slice(0, 5)) { // Top 5 strongest
      if (rel.businessImpact > 0.6) {
        insights.keyFindings.push({
          title: `Strong ${rel.relationship} correlation between ${this.formatDimensionName(rel.dimension1)} and ${this.formatDimensionName(rel.dimension2)}`,
          description: `${(rel.correlationCoefficient * 100).toFixed(1)}% correlation strength with ${(rel.confidenceLevel * 100).toFixed(1)}% confidence`,
          impact: rel.businessImpact > 0.8 ? 'high' : 'medium',
          category: this.categorizeFinding(rel.dimension1, rel.dimension2)
        });
      }
    }

    // Identify risk factors from suspicious correlations
    const suspiciousRelationships = relationships.filter(r => r.fraudRelevance > 0.7);
    for (const rel of suspiciousRelationships) {
      insights.riskFactors.push({
        type: this.categorizeFraudRisk(rel.dimension1, rel.dimension2),
        severity: rel.fraudRelevance > 0.9 ? 'high' : 'medium',
        description: `Unusual correlation pattern between ${this.formatDimensionName(rel.dimension1)} and ${this.formatDimensionName(rel.dimension2)}`,
        likelihood: rel.fraudRelevance
      });
    }

    // Generate opportunities from PCA insights
    const topComponents = pca.explainedVariance.slice(0, 3);
    topComponents.forEach((variance, idx) => {
      if (variance > 0.15) { // Component explains >15% of variance
        const topLoadings = Object.entries(pca.loadings)
          .map(([dim, loads]) => ({ dim, loading: Math.abs(loads[idx]) }))
          .sort((a, b) => b.loading - a.loading)
          .slice(0, 3);

        insights.opportunities.push({
          title: `Principal Component ${idx + 1} Analysis`,
          description: `Focus on ${topLoadings.map(l => this.formatDimensionName(l.dim)).join(', ')} (explains ${(variance * 100).toFixed(1)}% of variance)`,
          potential: variance > 0.25 ? 'high' : 'medium',
          effort: 'medium'
        });
      }
    });

    // Generate recommendations
    insights.recommendations = this.generateRecommendations(relationships, clusters, businessContext);
    
    // Calculate overall confidence and priority
    insights.confidence = Math.min(0.95, relationships.length / 20);
    insights.actionPriority = insights.riskFactors.length > 2 ? 'high' : 
                              insights.opportunities.length > 3 ? 'medium' : 'low';

    return insights;
  }

  /**
   * Helper methods for correlation analysis
   */
  private normalizeArray(arr: number[]): number[] {
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const std = Math.sqrt(arr.reduce((sum, val) => sum + (val - mean) ** 2, 0) / arr.length);
    return std === 0 ? arr.map(() => 0) : arr.map(val => (val - mean) / std);
  }

  private buildDataMatrix(metrics: Record<string, number[]>): Matrix {
    const metricNames = Object.keys(metrics);
    const sampleSize = Math.min(...Object.values(metrics).map(arr => arr.length));
    
    const data: number[][] = [];
    for (let i = 0; i < sampleSize; i++) {
      const row: number[] = [];
      for (const metricName of metricNames) {
        row.push(metrics[metricName][i] || 0);
      }
      data.push(row);
    }
    
    return new Matrix(data);
  }

  private calculateCovarianceMatrix(dataMatrix: Matrix): Matrix {
    const centered = dataMatrix.center();
    return centered.transpose().mmul(centered).div(dataMatrix.rows - 1);
  }

  private encodeDeviceType(platform: string): number {
    const types: Record<string, number> = {
      'iPhone': 1, 'iPad': 2, 'Android': 3, 'Windows': 4, 'Mac': 5, 'Linux': 6
    };
    return types[platform] || 0;
  }

  private extractSessionMetrics(session: SessionData): Record<string, any> {
    // Extract individual session metrics for real-time analysis
    const timestamp = new Date(session.timestamp);
    
    return {
      geographic: {
        latitude: session.location?.latitude || 0,
        longitude: session.location?.longitude || 0
      },
      temporal: {
        hourOfDay: timestamp.getHours(),
        dayOfWeek: timestamp.getDay(),
        monthOfYear: timestamp.getMonth()
      },
      behavioral: {
        qualityScore: session.qualityScore || 0,
        authenticityScore: session.authenticityScore || 0,
        transcriptLength: session.transcript?.length || 0
      },
      contextual: {
        purchaseAmount: session.transactionAmount || 0
      }
    };
  }

  private getSessionMetricValue(sessionMetrics: any, dimension: string, metric: string): number | null {
    return sessionMetrics[dimension]?.[metric] ?? null;
  }

  private detectCorrelationAnomaly(
    sessionValue: number,
    referenceValues: number[],
    metricName: string
  ): { dimension: string; severity: number; description: string; expectedRange: [number, number]; actualValue: number } | null {
    if (referenceValues.length < 10) return null;

    const mean = referenceValues.reduce((sum, val) => sum + val, 0) / referenceValues.length;
    const std = Math.sqrt(referenceValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) / referenceValues.length);
    
    const zScore = Math.abs((sessionValue - mean) / std);
    
    if (zScore > 2.5) { // More than 2.5 standard deviations
      const severity = Math.min(1.0, zScore / 4); // Cap at 4 sigma
      
      return {
        dimension: metricName,
        severity,
        description: `${metricName} value significantly deviates from expected pattern (z-score: ${zScore.toFixed(2)})`,
        expectedRange: [mean - 2 * std, mean + 2 * std],
        actualValue: sessionValue
      };
    }

    return null;
  }

  private calculateOverallRiskScore(anomalies: any[]): number {
    if (anomalies.length === 0) return 0;
    
    const avgSeverity = anomalies.reduce((sum, a) => sum + a.severity, 0) / anomalies.length;
    const anomalyCount = anomalies.length;
    
    // Higher risk for multiple anomalies
    const countFactor = Math.min(1.0, anomalyCount / 5);
    
    return Math.min(1.0, avgSeverity * 0.7 + countFactor * 0.3);
  }

  private createFraudFlag(anomaly: any): FraudFlag {
    return {
      type: 'correlation_pattern' as any,
      severity: anomaly.severity > 0.9 ? 'high' : anomaly.severity > 0.7 ? 'medium' : 'low',
      description: anomaly.description,
      confidence: anomaly.severity,
      data: {
        dimension: anomaly.dimension,
        expectedRange: anomaly.expectedRange,
        actualValue: anomaly.actualValue
      }
    };
  }

  // Additional helper methods would be implemented here...
  private determineSignificance(r: number, pValue: number): CorrelationStrength {
    if (pValue > this.config.significanceLevel) return 'none';
    if (Math.abs(r) >= 0.8) return 'very_strong';
    if (Math.abs(r) >= 0.6) return 'strong';
    if (Math.abs(r) >= 0.4) return 'moderate';
    if (Math.abs(r) >= 0.2) return 'weak';
    return 'very_weak';
  }

  private calculateTTestPValue(t: number, df: number): number {
    // Simplified p-value calculation - in production, use proper statistical library
    return Math.min(1, Math.abs(t) > 2 ? 0.05 : 0.1);
  }

  private calculateCorrelationConfidenceInterval(r: number, n: number): [number, number] {
    // Fisher's z-transformation for confidence interval
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const se = 1 / Math.sqrt(n - 3);
    const margin = 1.96 * se; // 95% confidence
    
    const lowerZ = z - margin;
    const upperZ = z + margin;
    
    const lower = (Math.exp(2 * lowerZ) - 1) / (Math.exp(2 * lowerZ) + 1);
    const upper = (Math.exp(2 * upperZ) - 1) / (Math.exp(2 * upperZ) + 1);
    
    return [lower, upper];
  }

  private assessBusinessImpact(dim1: string, dim2: string, correlation: CorrelationResult): number {
    // Business relevance scoring based on dimension types
    const businessRelevantDimensions = [
      'behavioral.qualityScore', 'contextual.purchaseAmount', 
      'temporal.hourOfDay', 'geographic.locationFrequency'
    ];
    
    const relevance1 = businessRelevantDimensions.includes(dim1) ? 0.8 : 0.3;
    const relevance2 = businessRelevantDimensions.includes(dim2) ? 0.8 : 0.3;
    
    return Math.min(1.0, (relevance1 + relevance2) / 2 * Math.abs(correlation.coefficient));
  }

  private assessFraudRelevance(dim1: string, dim2: string, correlation: CorrelationResult): number {
    // Fraud relevance scoring
    const fraudIndicators = [
      'technical.deviceType', 'geographic.travelDistance', 
      'temporal.timeBetweenSessions', 'behavioral.speechRate'
    ];
    
    const isFraudRelevant1 = fraudIndicators.includes(dim1);
    const isFraudRelevant2 = fraudIndicators.includes(dim2);
    
    if (!isFraudRelevant1 && !isFraudRelevant2) return 0.1;
    
    return Math.abs(correlation.coefficient) * 0.8;
  }

  private isActionableInsight(dim1: string, dim2: string, correlation: CorrelationResult): boolean {
    // Determine if this correlation provides actionable business insight
    return Math.abs(correlation.coefficient) > 0.5 && 
           (dim1.includes('behavioral') || dim2.includes('behavioral')) &&
           correlation.pValue < 0.01;
  }

  private buildDistanceMatrix(correlationMatrix: CorrelationMatrix): number[][] {
    const dimensions = correlationMatrix.dimensions;
    const n = dimensions.length;
    const distances: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dim1 = dimensions[i];
        const dim2 = dimensions[j];
        const correlation = correlationMatrix.matrix[dim1]?.[dim2]?.coefficient || 0;
        
        // Convert correlation to distance (1 - |r|)
        const distance = 1 - Math.abs(correlation);
        distances[i][j] = distance;
        distances[j][i] = distance;
      }
    }
    
    return distances;
  }

  private performHierarchicalClustering(distanceMatrix: number[][], dimensions: string[]): Array<{ dimensions: string[] }> {
    // Simplified hierarchical clustering implementation
    // In production, use a proper clustering library
    const clusters: Array<{ dimensions: string[] }> = [];
    const n = dimensions.length;
    
    // Start with each dimension as its own cluster
    const activeClusters = dimensions.map(dim => ({ dimensions: [dim] }));
    
    // Merge clusters based on minimum distance
    while (activeClusters.length > Math.max(3, Math.ceil(n / 5))) {
      let minDistance = Infinity;
      let mergeIndices = [-1, -1];
      
      for (let i = 0; i < activeClusters.length; i++) {
        for (let j = i + 1; j < activeClusters.length; j++) {
          const distance = this.calculateClusterDistance(
            activeClusters[i], 
            activeClusters[j], 
            distanceMatrix, 
            dimensions
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            mergeIndices = [i, j];
          }
        }
      }
      
      if (mergeIndices[0] !== -1) {
        // Merge clusters
        const cluster1 = activeClusters[mergeIndices[0]];
        const cluster2 = activeClusters[mergeIndices[1]];
        const mergedCluster = {
          dimensions: [...cluster1.dimensions, ...cluster2.dimensions]
        };
        
        // Remove original clusters and add merged one
        activeClusters.splice(Math.max(mergeIndices[0], mergeIndices[1]), 1);
        activeClusters.splice(Math.min(mergeIndices[0], mergeIndices[1]), 1);
        activeClusters.push(mergedCluster);
      } else {
        break;
      }
    }
    
    return activeClusters;
  }

  private calculateClusterDistance(
    cluster1: { dimensions: string[] },
    cluster2: { dimensions: string[] },
    distanceMatrix: number[][],
    allDimensions: string[]
  ): number {
    let totalDistance = 0;
    let count = 0;
    
    for (const dim1 of cluster1.dimensions) {
      for (const dim2 of cluster2.dimensions) {
        const idx1 = allDimensions.indexOf(dim1);
        const idx2 = allDimensions.indexOf(dim2);
        
        if (idx1 !== -1 && idx2 !== -1) {
          totalDistance += distanceMatrix[idx1][idx2];
          count++;
        }
      }
    }
    
    return count > 0 ? totalDistance / count : Infinity;
  }

  private identifyDominantFactors(dimensions: string[], correlationMatrix: CorrelationMatrix): string[] {
    const factorStrength = new Map<string, number>();
    
    for (const dim of dimensions) {
      let totalStrength = 0;
      let connections = 0;
      
      for (const otherDim of dimensions) {
        if (dim !== otherDim && correlationMatrix.matrix[dim]?.[otherDim]) {
          totalStrength += Math.abs(correlationMatrix.matrix[dim][otherDim].coefficient);
          connections++;
        }
      }
      
      if (connections > 0) {
        factorStrength.set(dim, totalStrength / connections);
      }
    }
    
    return Array.from(factorStrength.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  }

  private assessClusterRiskLevel(dimensions: string[], correlations: CorrelationResult[]): 'low' | 'medium' | 'high' {
    const hasHighRiskDimensions = dimensions.some(dim => 
      dim.includes('technical') || dim.includes('geographic.travelDistance')
    );
    
    const strongCorrelations = correlations.filter(corr => Math.abs(corr.coefficient) > 0.7);
    
    if (hasHighRiskDimensions && strongCorrelations.length > 2) return 'high';
    if (hasHighRiskDimensions || strongCorrelations.length > 1) return 'medium';
    return 'low';
  }

  private calculateBusinessRelevance(dimensions: string[]): number {
    const businessRelevantCount = dimensions.filter(dim =>
      dim.includes('behavioral') || dim.includes('contextual')
    ).length;
    
    return Math.min(1.0, businessRelevantCount / dimensions.length);
  }

  private generateClusterName(dominantFactors: string[]): string {
    const categories = dominantFactors.map(factor => factor.split('.')[0]);
    const uniqueCategories = [...new Set(categories)];
    
    if (uniqueCategories.length === 1) {
      return `${uniqueCategories[0].charAt(0).toUpperCase() + uniqueCategories[0].slice(1)} Cluster`;
    }
    
    return `Mixed ${uniqueCategories.join('/')} Cluster`;
  }

  private formatDimensionName(dimension: string): string {
    return dimension.split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1).replace(/([A-Z])/g, ' $1')
    ).join(' - ');
  }

  private categorizeFinding(dim1: string, dim2: string): string {
    if (dim1.includes('behavioral') || dim2.includes('behavioral')) return 'customer_behavior';
    if (dim1.includes('temporal') || dim2.includes('temporal')) return 'timing_patterns';
    if (dim1.includes('geographic') || dim2.includes('geographic')) return 'location_insights';
    if (dim1.includes('contextual') || dim2.includes('contextual')) return 'business_context';
    return 'technical_metrics';
  }

  private categorizeFraudRisk(dim1: string, dim2: string): string {
    if (dim1.includes('geographic') || dim2.includes('geographic')) return 'location_fraud';
    if (dim1.includes('temporal') || dim2.includes('temporal')) return 'timing_fraud';
    if (dim1.includes('behavioral') || dim2.includes('behavioral')) return 'behavior_fraud';
    return 'technical_fraud';
  }

  private generateRecommendations(
    relationships: DimensionalRelationship[],
    clusters: ClusterCorrelation[],
    businessContext?: BusinessContext
  ): Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; category: string }> {
    const recommendations = [];
    
    // High-impact business relationships
    const businessRelationships = relationships.filter(r => r.businessImpact > 0.7);
    for (const rel of businessRelationships.slice(0, 3)) {
      recommendations.push({
        title: `Optimize ${this.formatDimensionName(rel.dimension1)} Strategy`,
        description: `Strong correlation with ${this.formatDimensionName(rel.dimension2)} suggests optimization opportunity`,
        priority: 'high' as const,
        category: 'business_optimization'
      });
    }
    
    // High-risk fraud relationships
    const fraudRelationships = relationships.filter(r => r.fraudRelevance > 0.8);
    for (const rel of fraudRelationships.slice(0, 2)) {
      recommendations.push({
        title: `Monitor ${this.formatDimensionName(rel.dimension1)} Pattern`,
        description: `Implement enhanced monitoring due to fraud correlation risk`,
        priority: 'high' as const,
        category: 'fraud_prevention'
      });
    }
    
    // Cluster-based recommendations
    const highRiskClusters = clusters.filter(c => c.riskLevel === 'high');
    for (const cluster of highRiskClusters.slice(0, 2)) {
      recommendations.push({
        title: `Address ${cluster.clusterName} Risk`,
        description: `Focus on ${cluster.dominantFactors.join(', ')} for risk mitigation`,
        priority: 'medium' as const,
        category: 'risk_management'
      });
    }
    
    return recommendations;
  }

  private updateAdaptiveThresholds(correlationMatrix: CorrelationMatrix): void {
    // Update thresholds based on recent correlation patterns
    const significantCorrelations = Object.values(correlationMatrix.matrix)
      .flatMap(corrs => Object.values(corrs))
      .filter(corr => corr.pValue <= this.config.significanceLevel)
      .map(corr => Math.abs(corr.coefficient));
    
    if (significantCorrelations.length > 10) {
      const avgCorrelation = significantCorrelations.reduce((sum, val) => sum + val, 0) / significantCorrelations.length;
      const adaptiveThreshold = Math.max(0.2, avgCorrelation * 0.8);
      
      this.adaptiveThresholds.set('correlation', adaptiveThreshold);
      this.config.minCorrelationThreshold = adaptiveThreshold;
    }
  }
}