/**
 * Scoring Calibration System for Consistent Quality Evaluation
 * Ensures fair and consistent scoring across different models, contexts, and time periods
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';

export interface CalibrationDataPoint {
  id: string;
  transcript: string;
  businessContext: any;
  language: string;
  
  // Human expert scores (ground truth)
  expertScores: {
    authenticity: number;
    concreteness: number;
    depth: number;
    total: number;
  };
  
  // AI model scores
  aiScores: {
    authenticity: number;
    concreteness: number;
    depth: number;
    total: number;
  };
  
  // Metadata
  expertId: string;
  modelVersion: string;
  timestamp: Date;
  businessType: string;
  audioLength?: number;
  customerSegment?: string;
}

export interface CalibrationMetrics {
  correlation: {
    authenticity: number;
    concreteness: number;
    depth: number;
    total: number;
  };
  meanAbsoluteError: {
    authenticity: number;
    concreteness: number;
    depth: number;
    total: number;
  };
  bias: {
    authenticity: number; // AI score - Expert score (average)
    concreteness: number;
    depth: number;
    total: number;
  };
  standardDeviation: {
    authenticity: number;
    concreteness: number;
    depth: number;
    total: number;
  };
  sampleSize: number;
  confidenceLevel: number; // 0-1
}

export interface CalibrationAdjustment {
  component: 'authenticity' | 'concreteness' | 'depth';
  adjustmentType: 'linear' | 'polynomial' | 'threshold';
  parameters: {
    slope?: number;
    intercept?: number;
    polynomial?: number[];
    thresholds?: Array<{ input: number; output: number; }>;
  };
  confidence: number;
  validityPeriod: Date;
  trainingDataSize: number;
}

export interface BusinessContextCalibration {
  businessType: string;
  language: string;
  adjustments: CalibrationAdjustment[];
  lastUpdated: Date;
  sampleSize: number;
  effectiveness: number; // 0-1, how well calibration works
}

export class ScoringCalibrationSystem extends EventEmitter {
  private calibrationData: CalibrationDataPoint[] = [];
  private contextCalibrations: Map<string, BusinessContextCalibration> = new Map();
  private calibrationFilePath: string;
  private adjustmentsFilePath: string;
  private minSampleSize: number = 50;
  private recalibrationThreshold: number = 0.85; // Minimum correlation to maintain
  
  constructor(config: {
    calibrationFilePath?: string;
    adjustmentsFilePath?: string;
    minSampleSize?: number;
    recalibrationThreshold?: number;
  } = {}) {
    super();
    
    this.calibrationFilePath = config.calibrationFilePath || join(process.cwd(), 'calibration-data.jsonl');
    this.adjustmentsFilePath = config.adjustmentsFilePath || join(process.cwd(), 'calibration-adjustments.json');
    this.minSampleSize = config.minSampleSize || 50;
    this.recalibrationThreshold = config.recalibrationThreshold || 0.85;
    
    // Load existing data
    this.loadCalibrationData();
    this.loadAdjustments();
    
    console.log('ScoringCalibrationSystem initialized');
  }

  /**
   * Add a new calibration data point from expert evaluation
   */
  async addCalibrationPoint(dataPoint: CalibrationDataPoint): Promise<void> {
    // Validate data point
    this.validateDataPoint(dataPoint);
    
    // Add to memory
    this.calibrationData.push(dataPoint);
    
    // Persist to disk
    await this.persistCalibrationPoint(dataPoint);
    
    // Check if recalibration is needed
    const contextKey = `${dataPoint.businessType}_${dataPoint.language}`;
    const contextData = this.calibrationData.filter(dp => 
      dp.businessType === dataPoint.businessType && 
      dp.language === dataPoint.language
    );
    
    if (contextData.length >= this.minSampleSize) {
      const metrics = this.calculateCalibrationMetrics(contextData);
      
      // Check if correlation has dropped below threshold
      if (metrics.correlation.total < this.recalibrationThreshold) {
        this.emit('recalibrationNeeded', {
          contextKey,
          currentCorrelation: metrics.correlation.total,
          threshold: this.recalibrationThreshold,
          sampleSize: contextData.length
        });
        
        // Automatically recalibrate if we have enough data
        await this.recalibrateContext(dataPoint.businessType, dataPoint.language);
      }
    }
    
    this.emit('calibrationPointAdded', { dataPoint, contextKey });
  }

  /**
   * Apply calibration adjustments to AI scores
   */
  applyCalibration(
    aiScores: { authenticity: number; concreteness: number; depth: number; total: number; },
    businessType: string,
    language: string
  ): { authenticity: number; concreteness: number; depth: number; total: number; calibrated: boolean; } {
    
    const contextKey = `${businessType}_${language}`;
    const calibration = this.contextCalibrations.get(contextKey);
    
    if (!calibration) {
      // No calibration available, return original scores
      return { ...aiScores, calibrated: false };
    }
    
    const calibratedScores = { ...aiScores };
    
    // Apply adjustments for each component
    for (const adjustment of calibration.adjustments) {
      const originalScore = calibratedScores[adjustment.component];
      const adjustedScore = this.applyAdjustment(originalScore, adjustment);
      
      // Ensure score stays within valid range [0, 100]
      calibratedScores[adjustment.component] = Math.max(0, Math.min(100, adjustedScore));
    }
    
    // Recalculate total score with adjusted components
    calibratedScores.total = 
      calibratedScores.authenticity * 0.4 + 
      calibratedScores.concreteness * 0.3 + 
      calibratedScores.depth * 0.3;
    
    return { ...calibratedScores, calibrated: true };
  }

  /**
   * Calculate calibration metrics for a set of data points
   */
  calculateCalibrationMetrics(dataPoints: CalibrationDataPoint[]): CalibrationMetrics {
    if (dataPoints.length === 0) {
      throw new Error('No data points provided for calibration metrics');
    }
    
    const components = ['authenticity', 'concreteness', 'depth', 'total'] as const;
    const metrics: any = {
      correlation: {},
      meanAbsoluteError: {},
      bias: {},
      standardDeviation: {},
      sampleSize: dataPoints.length,
      confidenceLevel: 0
    };
    
    for (const component of components) {
      const expertScores = dataPoints.map(dp => dp.expertScores[component]);
      const aiScores = dataPoints.map(dp => dp.aiScores[component]);
      
      // Correlation coefficient
      metrics.correlation[component] = this.calculateCorrelation(expertScores, aiScores);
      
      // Mean Absolute Error
      const absoluteErrors = expertScores.map((expert, i) => Math.abs(expert - aiScores[i]));
      metrics.meanAbsoluteError[component] = absoluteErrors.reduce((sum, err) => sum + err, 0) / absoluteErrors.length;
      
      // Bias (systematic error)
      const differences = aiScores.map((ai, i) => ai - expertScores[i]);
      metrics.bias[component] = differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
      
      // Standard deviation of differences
      const meanDiff = metrics.bias[component];
      const variance = differences.reduce((sum, diff) => sum + Math.pow(diff - meanDiff, 2), 0) / differences.length;
      metrics.standardDeviation[component] = Math.sqrt(variance);
    }
    
    // Overall confidence level based on correlation and sample size
    const avgCorrelation = Object.values(metrics.correlation).reduce((sum: number, corr: number) => sum + corr, 0) / 4;
    const sizeConfidence = Math.min(1, dataPoints.length / 100); // Max confidence at 100+ samples
    metrics.confidenceLevel = (avgCorrelation + sizeConfidence) / 2;
    
    return metrics as CalibrationMetrics;
  }

  /**
   * Recalibrate for a specific business context
   */
  async recalibrateContext(businessType: string, language: string): Promise<boolean> {
    console.log(`Recalibrating for ${businessType} (${language})`);
    
    const contextData = this.calibrationData.filter(dp => 
      dp.businessType === businessType && 
      dp.language === language
    );
    
    if (contextData.length < this.minSampleSize) {
      console.warn(`Insufficient data for recalibration: ${contextData.length} < ${this.minSampleSize}`);
      return false;
    }
    
    // Calculate current metrics
    const metrics = this.calculateCalibrationMetrics(contextData);
    
    // Generate new adjustments
    const adjustments: CalibrationAdjustment[] = [];
    const components = ['authenticity', 'concreteness', 'depth'] as const;
    
    for (const component of components) {
      const expertScores = contextData.map(dp => dp.expertScores[component]);
      const aiScores = contextData.map(dp => dp.aiScores[component]);
      
      // Calculate linear adjustment (simple bias correction)
      const adjustment = this.calculateLinearAdjustment(aiScores, expertScores, component);
      if (adjustment) {
        adjustments.push(adjustment);
      }
    }
    
    // Create business context calibration
    const contextKey = `${businessType}_${language}`;
    const calibration: BusinessContextCalibration = {
      businessType,
      language,
      adjustments,
      lastUpdated: new Date(),
      sampleSize: contextData.length,
      effectiveness: metrics.correlation.total
    };
    
    this.contextCalibrations.set(contextKey, calibration);
    
    // Persist adjustments
    await this.saveAdjustments();
    
    this.emit('contextRecalibrated', {
      businessType,
      language,
      adjustments: adjustments.length,
      effectiveness: calibration.effectiveness,
      sampleSize: contextData.length
    });
    
    console.log(`Recalibration completed: ${adjustments.length} adjustments, effectiveness: ${(calibration.effectiveness * 100).toFixed(1)}%`);
    
    return true;
  }

  /**
   * Get calibration status for all contexts
   */
  getCalibrationStatus(): Array<{
    businessType: string;
    language: string;
    sampleSize: number;
    lastCalibration: Date | null;
    effectiveness: number;
    needsRecalibration: boolean;
  }> {
    const statusMap = new Map<string, any>();
    
    // Initialize with all data points
    for (const dataPoint of this.calibrationData) {
      const key = `${dataPoint.businessType}_${dataPoint.language}`;
      if (!statusMap.has(key)) {
        statusMap.set(key, {
          businessType: dataPoint.businessType,
          language: dataPoint.language,
          sampleSize: 0,
          lastCalibration: null,
          effectiveness: 0,
          needsRecalibration: false
        });
      }
      statusMap.get(key).sampleSize++;
    }
    
    // Add calibration information
    for (const [contextKey, calibration] of this.contextCalibrations) {
      if (statusMap.has(contextKey)) {
        const status = statusMap.get(contextKey);
        status.lastCalibration = calibration.lastUpdated;
        status.effectiveness = calibration.effectiveness;
        status.needsRecalibration = calibration.effectiveness < this.recalibrationThreshold;
      }
    }
    
    return Array.from(statusMap.values()).sort((a, b) => b.sampleSize - a.sampleSize);
  }

  /**
   * Generate benchmark test set for validation
   */
  generateBenchmarkSet(size: number = 50): CalibrationDataPoint[] {
    if (this.calibrationData.length < size) {
      throw new Error(`Insufficient calibration data: ${this.calibrationData.length} < ${size}`);
    }
    
    // Stratified sampling across different business types and languages
    const groups = new Map<string, CalibrationDataPoint[]>();
    
    for (const dataPoint of this.calibrationData) {
      const key = `${dataPoint.businessType}_${dataPoint.language}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(dataPoint);
    }
    
    const benchmarkSet: CalibrationDataPoint[] = [];
    const groupSize = Math.ceil(size / groups.size);
    
    for (const [key, groupData] of groups) {
      // Sample from each group
      const shuffled = [...groupData].sort(() => Math.random() - 0.5);
      const sample = shuffled.slice(0, Math.min(groupSize, shuffled.length));
      benchmarkSet.push(...sample);
    }
    
    // If we still need more, sample randomly from remaining data
    while (benchmarkSet.length < size && benchmarkSet.length < this.calibrationData.length) {
      const remaining = this.calibrationData.filter(dp => !benchmarkSet.includes(dp));
      if (remaining.length === 0) break;
      
      const randomIndex = Math.floor(Math.random() * remaining.length);
      benchmarkSet.push(remaining[randomIndex]);
    }
    
    return benchmarkSet.slice(0, size);
  }

  /**
   * Validate calibration effectiveness using benchmark set
   */
  async validateCalibration(benchmarkSet?: CalibrationDataPoint[]): Promise<{
    beforeCalibration: CalibrationMetrics;
    afterCalibration: CalibrationMetrics;
    improvement: {
      correlationImprovement: number;
      errorReduction: number;
      biasReduction: number;
    };
  }> {
    const testSet = benchmarkSet || this.generateBenchmarkSet();
    
    if (testSet.length === 0) {
      throw new Error('No benchmark data available for validation');
    }
    
    // Calculate metrics before calibration
    const beforeMetrics = this.calculateCalibrationMetrics(testSet);
    
    // Apply calibration and calculate metrics after
    const afterTestSet: CalibrationDataPoint[] = testSet.map(dp => {
      const calibrated = this.applyCalibration(
        dp.aiScores,
        dp.businessType,
        dp.language
      );
      
      return {
        ...dp,
        aiScores: {
          authenticity: calibrated.authenticity,
          concreteness: calibrated.concreteness,
          depth: calibrated.depth,
          total: calibrated.total
        }
      };
    });
    
    const afterMetrics = this.calculateCalibrationMetrics(afterTestSet);
    
    // Calculate improvements
    const improvement = {
      correlationImprovement: afterMetrics.correlation.total - beforeMetrics.correlation.total,
      errorReduction: beforeMetrics.meanAbsoluteError.total - afterMetrics.meanAbsoluteError.total,
      biasReduction: Math.abs(beforeMetrics.bias.total) - Math.abs(afterMetrics.bias.total)
    };
    
    return {
      beforeCalibration: beforeMetrics,
      afterCalibration: afterMetrics,
      improvement
    };
  }

  // Private helper methods

  private validateDataPoint(dataPoint: CalibrationDataPoint): void {
    const required = ['id', 'transcript', 'businessContext', 'expertScores', 'aiScores'];
    for (const field of required) {
      if (!(field in dataPoint)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    const scoreFields = ['authenticity', 'concreteness', 'depth', 'total'];
    for (const field of scoreFields) {
      if (!(field in dataPoint.expertScores) || !(field in dataPoint.aiScores)) {
        throw new Error(`Missing score field: ${field}`);
      }
      
      const expertScore = dataPoint.expertScores[field];
      const aiScore = dataPoint.aiScores[field];
      
      if (expertScore < 0 || expertScore > 100 || aiScore < 0 || aiScore > 100) {
        throw new Error(`Invalid score range for ${field}: expert=${expertScore}, ai=${aiScore}`);
      }
    }
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateLinearAdjustment(
    aiScores: number[],
    expertScores: number[],
    component: 'authenticity' | 'concreteness' | 'depth'
  ): CalibrationAdjustment | null {
    
    if (aiScores.length < 10) return null; // Need minimum data for reliable adjustment
    
    // Simple linear regression: expert = slope * ai + intercept
    const n = aiScores.length;
    const sumAI = aiScores.reduce((a, b) => a + b, 0);
    const sumExpert = expertScores.reduce((a, b) => a + b, 0);
    const sumAI2 = aiScores.reduce((sum, ai) => sum + ai * ai, 0);
    const sumProduct = aiScores.reduce((sum, ai, i) => sum + ai * expertScores[i], 0);
    
    const slope = (n * sumProduct - sumAI * sumExpert) / (n * sumAI2 - sumAI * sumAI);
    const intercept = (sumExpert - slope * sumAI) / n;
    
    // Calculate R-squared to assess fit quality
    const meanExpert = sumExpert / n;
    const totalSumSquares = expertScores.reduce((sum, expert) => sum + Math.pow(expert - meanExpert, 2), 0);
    const residualSumSquares = expertScores.reduce((sum, expert, i) => {
      const predicted = slope * aiScores[i] + intercept;
      return sum + Math.pow(expert - predicted, 2);
    }, 0);
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    
    // Only return adjustment if it's significant
    if (rSquared < 0.1) return null; // Less than 10% variance explained
    
    return {
      component,
      adjustmentType: 'linear',
      parameters: { slope, intercept },
      confidence: rSquared,
      validityPeriod: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      trainingDataSize: n
    };
  }

  private applyAdjustment(score: number, adjustment: CalibrationAdjustment): number {
    switch (adjustment.adjustmentType) {
      case 'linear':
        const { slope, intercept } = adjustment.parameters;
        return (slope || 1) * score + (intercept || 0);
      
      case 'polynomial':
        const coefficients = adjustment.parameters.polynomial || [0, 1];
        return coefficients.reduce((sum, coeff, power) => sum + coeff * Math.pow(score, power), 0);
      
      case 'threshold':
        const thresholds = adjustment.parameters.thresholds || [];
        for (let i = 0; i < thresholds.length; i++) {
          const threshold = thresholds[i];
          if (score <= threshold.input) {
            return threshold.output;
          }
        }
        return score;
      
      default:
        return score;
    }
  }

  private async persistCalibrationPoint(dataPoint: CalibrationDataPoint): Promise<void> {
    try {
      const line = JSON.stringify(dataPoint) + '\n';
      await fs.appendFile(this.calibrationFilePath, line);
    } catch (error) {
      console.error('Failed to persist calibration point:', error);
    }
  }

  private async loadCalibrationData(): Promise<void> {
    try {
      const content = await fs.readFile(this.calibrationFilePath, 'utf-8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const dataPoint = JSON.parse(line);
            dataPoint.timestamp = new Date(dataPoint.timestamp);
            this.calibrationData.push(dataPoint);
          } catch (parseError) {
            console.warn('Failed to parse calibration data line:', parseError);
          }
        }
      }
      
      console.log(`Loaded ${this.calibrationData.length} calibration data points`);
    } catch (error) {
      console.log('No existing calibration data found, starting fresh');
    }
  }

  private async saveAdjustments(): Promise<void> {
    try {
      const adjustments = Object.fromEntries(this.contextCalibrations);
      await fs.writeFile(this.adjustmentsFilePath, JSON.stringify(adjustments, null, 2));
    } catch (error) {
      console.error('Failed to save calibration adjustments:', error);
    }
  }

  private async loadAdjustments(): Promise<void> {
    try {
      const content = await fs.readFile(this.adjustmentsFilePath, 'utf-8');
      const adjustments = JSON.parse(content);
      
      for (const [contextKey, calibration] of Object.entries(adjustments)) {
        const cal = calibration as any;
        cal.lastUpdated = new Date(cal.lastUpdated);
        this.contextCalibrations.set(contextKey, cal);
      }
      
      console.log(`Loaded calibration adjustments for ${this.contextCalibrations.size} contexts`);
    } catch (error) {
      console.log('No existing calibration adjustments found');
    }
  }
}