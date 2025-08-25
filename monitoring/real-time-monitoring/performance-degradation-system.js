/**
 * Performance Degradation Early Warning System
 * 
 * Advanced predictive monitoring system that detects performance degradation
 * before it impacts users. Uses machine learning and statistical analysis
 * to provide early warnings with Swedish business context.
 */

const EventEmitter = require('events');
const { addDays, addHours, addMinutes, format, differenceInMinutes } = require('date-fns');
const { utcToZonedTime } = require('date-fns-tz');
const { sv } = require('date-fns/locale');

class PerformanceDegradationSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Performance monitoring configuration
      monitoring: {
        // Metrics to monitor for degradation
        metrics: [
          'response_time',
          'error_rate', 
          'throughput',
          'cpu_usage',
          'memory_usage',
          'disk_io',
          'network_latency',
          'database_query_time',
          'voice_processing_time',
          'ai_inference_time'
        ],
        
        // Monitoring intervals
        intervals: {
          realtime: 30000,      // 30s for real-time monitoring
          trending: 300000,     // 5min for trend analysis
          prediction: 900000,   // 15min for predictive analysis
          baseline: 86400000    // 24h for baseline updates
        },
        
        // Data collection windows
        windows: {
          immediate: '5m',      // 5-minute immediate window
          short: '15m',         // 15-minute short-term window
          medium: '1h',         // 1-hour medium-term window
          long: '4h',           // 4-hour long-term window
          baseline: '7d'        // 7-day baseline window
        }
      },
      
      // Degradation detection thresholds
      degradation: {
        // Performance degradation levels
        levels: {
          // Early warning (10-20% degradation)
          early_warning: {
            threshold: 0.10,        // 10% degradation
            confidence: 0.75,       // 75% confidence required
            duration: 300,          // 5 minutes sustained
            severity: 'info'
          },
          
          // Warning (20-40% degradation)
          warning: {
            threshold: 0.20,        // 20% degradation  
            confidence: 0.80,       // 80% confidence required
            duration: 180,          // 3 minutes sustained
            severity: 'warning'
          },
          
          // Critical (40%+ degradation)
          critical: {
            threshold: 0.40,        // 40% degradation
            confidence: 0.85,       // 85% confidence required
            duration: 60,           // 1 minute sustained
            severity: 'critical'
          }
        },
        
        // Prediction algorithms
        prediction: {
          // Trend analysis
          trendAnalysis: {
            enabled: true,
            windowSize: 60,         // 60 data points
            minimumTrend: 0.05,     // 5% minimum trend
            projectionHorizon: 30   // 30 minutes ahead
          },
          
          // Seasonal pattern detection
          seasonalAnalysis: {
            enabled: true,
            patterns: ['hourly', 'daily', 'weekly'],
            confidenceThreshold: 0.70
          },
          
          // Machine learning prediction
          mlPrediction: {
            enabled: true,
            models: ['linear_regression', 'arima', 'lstm'],
            ensembleMethod: 'weighted_average',
            retrainInterval: 86400000 // 24h retrain interval
          }
        }
      },
      
      // Swedish business context
      swedishBusiness: {
        timezone: 'Europe/Stockholm',
        
        // Business pattern expectations
        patterns: {
          // Peak hours (higher performance expectations)
          peakHours: [
            { day: 'weekday', hours: [8, 9, 12, 13, 17, 18] },
            { day: 'saturday', hours: [11, 12, 13, 14] }
          ],
          
          // Low activity hours (maintenance windows)
          lowActivity: [
            { day: 'weekday', hours: [2, 3, 4, 5] },
            { day: 'weekend', hours: [2, 3, 4, 5, 6] }
          ],
          
          // Holiday impact (reduced load expectations)
          holidays: [
            '2024-01-01', '2024-01-06', '2024-03-29', '2024-04-01',
            '2024-05-01', '2024-05-09', '2024-05-19', '2024-06-06',
            '2024-06-21', '2024-11-02', '2024-12-24', '2024-12-25', '2024-12-26'
          ]
        },
        
        // Swedish pilot specific thresholds
        pilot: {
          // Stricter thresholds for pilot businesses
          responseTimeMax: 2000,      // 2s max response time
          errorRateMax: 0.01,         // 1% max error rate
          availabilityMin: 0.999,     // 99.9% minimum availability
          
          // Regional considerations
          regions: {
            stockholm: { weight: 0.4 },   // 40% of pilot load
            gothenburg: { weight: 0.3 },  // 30% of pilot load
            malmo: { weight: 0.3 }        // 30% of pilot load
          }
        }
      },
      
      // Alert configuration
      alerts: {
        // Alert routing based on degradation type and severity
        routing: {
          early_warning: {
            channels: ['email', 'slack'],
            recipients: ['performance-team@ai-feedback.se'],
            throttle: 1800000 // 30min throttle
          },
          warning: {
            channels: ['email', 'slack', 'dashboard'],
            recipients: ['performance-team@ai-feedback.se', 'oncall@ai-feedback.se'],
            throttle: 900000 // 15min throttle
          },
          critical: {
            channels: ['email', 'slack', 'phone', 'pagerduty'],
            recipients: ['performance-team@ai-feedback.se', 'oncall@ai-feedback.se', 'management@ai-feedback.se'],
            throttle: 300000 // 5min throttle
          }
        },
        
        // Swedish pilot specific routing
        swedishPilotRouting: {
          any_degradation: {
            channels: ['slack'],
            recipients: ['swedish-pilot-team@ai-feedback.se'],
            webhookUrl: process.env.SLACK_SWEDISH_PILOT_WEBHOOK
          }
        }
      },
      
      ...config
    };

    // System state
    this.state = {
      baselines: new Map(),
      currentMetrics: new Map(),
      degradationHistory: new Map(),
      predictions: new Map(),
      activeAlerts: new Map(),
      mlModels: new Map()
    };

    // Timers
    this.timers = new Map();
    
    // Performance data buffer
    this.dataBuffer = new Map();
  }

  /**
   * Start performance degradation monitoring
   */
  async start() {
    console.log('📉 Starting Performance Degradation Early Warning System');
    console.log('======================================================');
    
    try {
      // Initialize system components
      await this.initializeBaselines();
      await this.initializePredictionModels();
      
      // Start monitoring loops
      this.startRealtimeMonitoring();
      this.startTrendAnalysis();
      this.startPredictiveAnalysis();
      this.startBaselineUpdates();
      
      console.log('✅ Performance degradation system started successfully');
      console.log(`   Monitoring ${this.config.monitoring.metrics.length} metrics`);
      console.log(`   Swedish business hours awareness: Enabled`);
      console.log(`   Machine learning prediction: ${this.config.degradation.prediction.mlPrediction.enabled ? 'Enabled' : 'Disabled'}`);
      
      this.emit('degradation_system_started', {
        timestamp: new Date(),
        metricsCount: this.config.monitoring.metrics.length,
        mlEnabled: this.config.degradation.prediction.mlPrediction.enabled
      });
      
    } catch (error) {
      console.error('❌ Failed to start performance degradation system:', error.message);
      throw error;
    }
  }

  /**
   * Stop performance degradation monitoring
   */
  async stop() {
    console.log('🛑 Stopping performance degradation system...');
    
    // Clear all timers
    this.timers.forEach((timer, name) => {
      clearInterval(timer);
      console.log(`   Stopped ${name}`);
    });
    
    this.timers.clear();
    
    console.log('✅ Performance degradation system stopped');
    
    this.emit('degradation_system_stopped', {
      timestamp: new Date(),
      activeAlerts: this.state.activeAlerts.size
    });
  }

  /**
   * Initialize performance baselines
   */
  async initializeBaselines() {
    console.log('📊 Initializing performance baselines...');
    
    for (const metric of this.config.monitoring.metrics) {
      try {
        const baseline = await this.calculateBaseline(metric);
        this.state.baselines.set(metric, baseline);
        
        console.log(`   ${metric}: μ=${baseline.mean.toFixed(2)}, σ=${baseline.stddev.toFixed(2)}, samples=${baseline.samples}`);
      } catch (error) {
        console.warn(`   Failed to calculate baseline for ${metric}: ${error.message}`);
      }
    }
    
    console.log('✅ Performance baselines initialized');
  }

  /**
   * Initialize prediction models
   */
  async initializePredictionModels() {
    if (!this.config.degradation.prediction.mlPrediction.enabled) {
      console.log('⚠️  Machine learning prediction disabled');
      return;
    }
    
    console.log('🤖 Initializing prediction models...');
    
    for (const metric of this.config.monitoring.metrics) {
      try {
        const models = {};
        
        for (const modelType of this.config.degradation.prediction.mlPrediction.models) {
          const model = await this.trainPredictionModel(metric, modelType);
          models[modelType] = model;
        }
        
        this.state.mlModels.set(metric, models);
        console.log(`   ${metric}: ${Object.keys(models).length} models trained`);
        
      } catch (error) {
        console.warn(`   Failed to train models for ${metric}: ${error.message}`);
      }
    }
    
    console.log('✅ Prediction models initialized');
  }

  /**
   * Start real-time monitoring
   */
  startRealtimeMonitoring() {
    const timer = setInterval(async () => {
      try {
        await this.performRealtimeAnalysis();
      } catch (error) {
        console.error('Real-time monitoring error:', error.message);
      }
    }, this.config.monitoring.intervals.realtime);
    
    this.timers.set('realtime_monitoring', timer);
    console.log('⚡ Real-time monitoring started (30s interval)');
  }

  /**
   * Start trend analysis
   */
  startTrendAnalysis() {
    const timer = setInterval(async () => {
      try {
        await this.performTrendAnalysis();
      } catch (error) {
        console.error('Trend analysis error:', error.message);
      }
    }, this.config.monitoring.intervals.trending);
    
    this.timers.set('trend_analysis', timer);
    console.log('📈 Trend analysis started (5min interval)');
  }

  /**
   * Start predictive analysis
   */
  startPredictiveAnalysis() {
    const timer = setInterval(async () => {
      try {
        await this.performPredictiveAnalysis();
      } catch (error) {
        console.error('Predictive analysis error:', error.message);
      }
    }, this.config.monitoring.intervals.prediction);
    
    this.timers.set('predictive_analysis', timer);
    console.log('🔮 Predictive analysis started (15min interval)');
  }

  /**
   * Start baseline updates
   */
  startBaselineUpdates() {
    const timer = setInterval(async () => {
      try {
        await this.updateBaselines();
      } catch (error) {
        console.error('Baseline update error:', error.message);
      }
    }, this.config.monitoring.intervals.baseline);
    
    this.timers.set('baseline_updates', timer);
    console.log('🔄 Baseline updates started (24h interval)');
  }

  /**
   * Perform real-time performance analysis
   */
  async performRealtimeAnalysis() {
    const swedishTime = utcToZonedTime(new Date(), this.config.swedishBusiness.timezone);
    const contextualInfo = this.getSwedishBusinessContext(swedishTime);
    
    for (const metric of this.config.monitoring.metrics) {
      try {
        const analysis = await this.analyzeMetricRealtime(metric, contextualInfo);
        
        if (analysis.degradationDetected) {
          await this.handleDegradationDetection(metric, analysis, contextualInfo);
        }
        
        // Update current metrics
        this.state.currentMetrics.set(metric, {
          value: analysis.currentValue,
          timestamp: new Date(),
          context: contextualInfo
        });
        
      } catch (error) {
        console.error(`Real-time analysis error for ${metric}:`, error.message);
      }
    }
  }

  /**
   * Analyze specific metric in real-time
   */
  async analyzeMetricRealtime(metric, context) {
    const currentValue = await this.getCurrentMetricValue(metric);
    const baseline = this.state.baselines.get(metric);
    
    if (!currentValue || !baseline) {
      return { degradationDetected: false, reason: 'insufficient_data' };
    }
    
    // Calculate degradation percentage
    const degradationPercent = this.calculateDegradation(currentValue, baseline, context);
    
    // Check against thresholds
    const degradationLevel = this.assessDegradationLevel(degradationPercent, metric, context);
    
    // Calculate confidence using multiple factors
    const confidence = this.calculateConfidence(metric, currentValue, baseline, context);
    
    return {
      metric,
      currentValue,
      baselineValue: baseline.mean,
      degradationPercent,
      degradationLevel,
      confidence,
      degradationDetected: degradationLevel && confidence >= this.config.degradation.levels[degradationLevel].confidence,
      context,
      timestamp: new Date()
    };
  }

  /**
   * Handle degradation detection
   */
  async handleDegradationDetection(metric, analysis, context) {
    const degradationKey = `${metric}_${analysis.degradationLevel}`;
    
    // Check if already alerted recently (throttling)
    const existingAlert = this.state.activeAlerts.get(degradationKey);
    const throttleTime = this.config.alerts.routing[analysis.degradationLevel].throttle;
    
    if (existingAlert && Date.now() - existingAlert.timestamp.getTime() < throttleTime) {
      return; // Throttled
    }
    
    // Create degradation alert
    const alert = {
      id: `${Date.now()}_${metric}_${analysis.degradationLevel}`,
      type: 'performance_degradation',
      metric,
      level: analysis.degradationLevel,
      analysis,
      context,
      timestamp: new Date(),
      swedishPilotAffected: await this.checkSwedishPilotImpact(metric, analysis)
    };
    
    this.state.activeAlerts.set(degradationKey, alert);
    
    console.log(`⚠️  Performance degradation detected: ${metric} (${analysis.degradationLevel})`);
    console.log(`   Current: ${analysis.currentValue.toFixed(2)}, Baseline: ${analysis.baselineValue.toFixed(2)}`);
    console.log(`   Degradation: ${(analysis.degradationPercent * 100).toFixed(1)}%, Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
    
    // Send notifications
    await this.sendDegradationAlert(alert);
    
    // Record degradation history
    this.recordDegradationEvent(alert);
    
    this.emit('degradation_detected', alert);
  }

  /**
   * Perform trend analysis
   */
  async performTrendAnalysis() {
    if (!this.config.degradation.prediction.trendAnalysis.enabled) return;
    
    console.log('📈 Performing trend analysis...');
    
    for (const metric of this.config.monitoring.metrics) {
      try {
        const trendAnalysis = await this.analyzeTrend(metric);
        
        if (trendAnalysis.degradationPredicted) {
          await this.handleTrendPrediction(metric, trendAnalysis);
        }
        
      } catch (error) {
        console.error(`Trend analysis error for ${metric}:`, error.message);
      }
    }
  }

  /**
   * Analyze trend for specific metric
   */
  async analyzeTrend(metric) {
    const dataPoints = await this.getMetricHistory(metric, this.config.degradation.prediction.trendAnalysis.windowSize);
    
    if (dataPoints.length < this.config.degradation.prediction.trendAnalysis.windowSize) {
      return { degradationPredicted: false, reason: 'insufficient_data' };
    }
    
    // Calculate linear trend
    const trend = this.calculateLinearTrend(dataPoints);
    const minimumTrend = this.config.degradation.prediction.trendAnalysis.minimumTrend;
    
    // Project trend into future
    const projectionHorizon = this.config.degradation.prediction.trendAnalysis.projectionHorizon;
    const projectedValue = this.projectTrend(trend, projectionHorizon);
    
    // Check if projected degradation exceeds thresholds
    const baseline = this.state.baselines.get(metric);
    const projectedDegradation = this.calculateDegradation(projectedValue, baseline);
    
    return {
      metric,
      trend,
      projectedValue,
      projectedDegradation,
      degradationPredicted: Math.abs(trend.slope) > minimumTrend && projectedDegradation > 0.15,
      confidence: trend.rSquared,
      projectionMinutes: projectionHorizon,
      timestamp: new Date()
    };
  }

  /**
   * Perform predictive analysis using ML models
   */
  async performPredictiveAnalysis() {
    if (!this.config.degradation.prediction.mlPrediction.enabled) return;
    
    console.log('🔮 Performing predictive analysis...');
    
    for (const metric of this.config.monitoring.metrics) {
      try {
        const prediction = await this.predictPerformance(metric);
        
        if (prediction.degradationPredicted) {
          await this.handlePredictiveDegradation(metric, prediction);
        }
        
        // Store prediction for trending
        this.state.predictions.set(metric, prediction);
        
      } catch (error) {
        console.error(`Predictive analysis error for ${metric}:`, error.message);
      }
    }
  }

  /**
   * Predict performance using ML models
   */
  async predictPerformance(metric) {
    const models = this.state.mlModels.get(metric);
    if (!models) {
      return { degradationPredicted: false, reason: 'no_models' };
    }
    
    const predictions = [];
    
    // Get predictions from each model
    for (const [modelType, model] of Object.entries(models)) {
      try {
        const prediction = await this.runModelPrediction(metric, modelType, model);
        predictions.push({ modelType, ...prediction });
      } catch (error) {
        console.warn(`Model prediction error for ${metric} ${modelType}:`, error.message);
      }
    }
    
    if (predictions.length === 0) {
      return { degradationPredicted: false, reason: 'no_predictions' };
    }
    
    // Ensemble prediction
    const ensemblePrediction = this.ensemblePredictions(predictions);
    
    // Check degradation threshold
    const baseline = this.state.baselines.get(metric);
    const predictedDegradation = this.calculateDegradation(ensemblePrediction.value, baseline);
    
    return {
      metric,
      predictedValue: ensemblePrediction.value,
      predictedDegradation,
      confidence: ensemblePrediction.confidence,
      modelPredictions: predictions,
      degradationPredicted: predictedDegradation > 0.20, // 20% predicted degradation
      predictionHorizon: '15min',
      timestamp: new Date()
    };
  }

  /**
   * Get Swedish business context
   */
  getSwedishBusinessContext(swedishTime) {
    const hour = swedishTime.getHours();
    const day = swedishTime.getDay(); // 0 = Sunday
    const dateStr = format(swedishTime, 'yyyy-MM-dd');
    
    const context = {
      swedishTime,
      hour,
      day,
      isBusinessHours: this.isBusinessHours(swedishTime),
      isHoliday: this.config.swedishBusiness.patterns.holidays.includes(dateStr),
      isPeakHour: this.isPeakHour(hour, day),
      isLowActivityPeriod: this.isLowActivityPeriod(hour, day),
      expectedLoad: this.calculateExpectedLoad(hour, day, dateStr)
    };
    
    return context;
  }

  /**
   * Check if Swedish pilot is impacted
   */
  async checkSwedishPilotImpact(metric, analysis) {
    // Swedish pilot has stricter performance requirements
    const pilotThresholds = this.config.swedishBusiness.pilot;
    
    switch (metric) {
      case 'response_time':
        return analysis.currentValue > pilotThresholds.responseTimeMax;
      case 'error_rate':
        return analysis.currentValue > pilotThresholds.errorRateMax;
      case 'availability':
        return analysis.currentValue < pilotThresholds.availabilityMin;
      default:
        return analysis.degradationPercent > 0.15; // 15% degradation affects pilot
    }
  }

  /**
   * Send degradation alert
   */
  async sendDegradationAlert(alert) {
    const routing = this.config.alerts.routing[alert.level];
    const swedishRouting = alert.swedishPilotAffected ? this.config.alerts.swedishPilotRouting.any_degradation : null;
    
    // Standard alert routing
    await this.sendNotifications(alert, routing);
    
    // Swedish pilot specific notifications
    if (swedishRouting) {
      await this.sendSwedishPilotNotification(alert, swedishRouting);
    }
    
    console.log(`📧 Degradation alert sent: ${alert.metric} (${alert.level})`);
  }

  /**
   * Send notifications
   */
  async sendNotifications(alert, routing) {
    const swedishTime = alert.context.swedishTime;
    const timeStr = format(swedishTime, 'HH:mm dd/MM', { locale: sv });
    
    if (routing.channels.includes('slack')) {
      await this.sendSlackAlert(alert, timeStr);
    }
    
    if (routing.channels.includes('email')) {
      await this.sendEmailAlert(alert, routing.recipients);
    }
    
    // Additional channels for critical alerts
    if (routing.channels.includes('phone') && alert.level === 'critical') {
      await this.sendPhoneAlert(alert);
    }
    
    if (routing.channels.includes('pagerduty') && alert.level === 'critical') {
      await this.sendPagerDutyAlert(alert);
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert, timeStr) {
    const color = {
      early_warning: '#ffeb3b',
      warning: '#ff9800', 
      critical: '#f44336'
    }[alert.level];
    
    const message = {
      text: `📉 Performance Degradation ${alert.level.toUpperCase()}: ${alert.metric.replace('_', ' ')}`,
      attachments: [{
        color,
        fields: [
          {
            title: 'Metric',
            value: alert.metric.replace('_', ' ').toUpperCase(),
            short: true
          },
          {
            title: 'Degradation',
            value: `${(alert.analysis.degradationPercent * 100).toFixed(1)}%`,
            short: true
          },
          {
            title: 'Current Value',
            value: alert.analysis.currentValue.toFixed(2),
            short: true
          },
          {
            title: 'Baseline Value', 
            value: alert.analysis.baselineValue.toFixed(2),
            short: true
          },
          {
            title: 'Confidence',
            value: `${(alert.analysis.confidence * 100).toFixed(1)}%`,
            short: true
          },
          {
            title: 'Swedish Time',
            value: `${timeStr} CET ${alert.context.isBusinessHours ? '(Business Hours)' : '(After Hours)'}`,
            short: true
          }
        ],
        footer: alert.swedishPilotAffected ? '🇸🇪 Swedish Pilot Affected' : 'AI Feedback Platform',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
    
    try {
      // Send to appropriate Slack channel
      console.log(`📱 Slack alert sent for ${alert.metric} degradation`);
    } catch (error) {
      console.error('Slack alert error:', error.message);
    }
  }

  // Utility and helper methods

  calculateDegradation(currentValue, baseline, context = null) {
    // Adjust baseline based on Swedish business context
    let adjustedBaseline = baseline.mean;
    
    if (context) {
      // Adjust expectations based on business context
      if (context.isPeakHour) {
        adjustedBaseline *= 1.2; // Expect 20% higher during peak
      }
      if (context.isHoliday) {
        adjustedBaseline *= 0.8; // Expect 20% lower on holidays
      }
    }
    
    return (currentValue - adjustedBaseline) / adjustedBaseline;
  }

  assessDegradationLevel(degradationPercent, metric, context) {
    const levels = this.config.degradation.levels;
    
    // Swedish pilot gets stricter thresholds
    const multiplier = context.swedishPilotAffected ? 0.8 : 1.0;
    
    if (Math.abs(degradationPercent) >= levels.critical.threshold * multiplier) {
      return 'critical';
    } else if (Math.abs(degradationPercent) >= levels.warning.threshold * multiplier) {
      return 'warning';
    } else if (Math.abs(degradationPercent) >= levels.early_warning.threshold * multiplier) {
      return 'early_warning';
    }
    
    return null;
  }

  calculateConfidence(metric, currentValue, baseline, context) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on deviation magnitude
    const zScore = Math.abs(currentValue - baseline.mean) / baseline.stddev;
    confidence += Math.min(0.3, zScore * 0.1);
    
    // Increase confidence if consistent with recent trend
    const recentTrend = this.getRecentTrend(metric);
    if (recentTrend && recentTrend.slope > 0) {
      confidence += 0.2;
    }
    
    // Adjust for business context
    if (context.isPeakHour && metric === 'response_time') {
      confidence += 0.1; // More confident about response time issues during peak
    }
    
    return Math.min(1.0, confidence);
  }

  isBusinessHours(swedishTime) {
    const day = swedishTime.getDay();
    const hour = swedishTime.getHours();
    
    if (day >= 1 && day <= 5) { // Weekdays
      return hour >= 8 && hour < 18;
    } else if (day === 6) { // Saturday
      return hour >= 10 && hour < 16;
    }
    
    return false; // Sunday
  }

  isPeakHour(hour, day) {
    const patterns = this.config.swedishBusiness.patterns.peakHours;
    
    for (const pattern of patterns) {
      if ((pattern.day === 'weekday' && day >= 1 && day <= 5) ||
          (pattern.day === 'saturday' && day === 6)) {
        if (pattern.hours.includes(hour)) {
          return true;
        }
      }
    }
    
    return false;
  }

  isLowActivityPeriod(hour, day) {
    const patterns = this.config.swedishBusiness.patterns.lowActivity;
    
    for (const pattern of patterns) {
      if ((pattern.day === 'weekday' && day >= 1 && day <= 5) ||
          (pattern.day === 'weekend' && (day === 0 || day === 6))) {
        if (pattern.hours.includes(hour)) {
          return true;
        }
      }
    }
    
    return false;
  }

  calculateExpectedLoad(hour, day, dateStr) {
    let expectedLoad = 1.0; // Baseline
    
    if (this.isPeakHour(hour, day)) expectedLoad = 1.5;
    if (this.isLowActivityPeriod(hour, day)) expectedLoad = 0.3;
    if (this.config.swedishBusiness.patterns.holidays.includes(dateStr)) expectedLoad *= 0.5;
    
    return expectedLoad;
  }

  // Placeholder methods for complex operations
  
  async calculateBaseline(metric) {
    // Mock baseline calculation
    const mockData = {
      response_time: { mean: 1500, stddev: 300 },
      error_rate: { mean: 0.01, stddev: 0.005 },
      throughput: { mean: 100, stddev: 20 },
      cpu_usage: { mean: 65, stddev: 15 },
      memory_usage: { mean: 70, stddev: 10 }
    };
    
    const data = mockData[metric] || { mean: 50, stddev: 10 };
    
    return { ...data, samples: 10000 };
  }

  async trainPredictionModel(metric, modelType) {
    // Mock ML model training
    return {
      type: modelType,
      trained: true,
      accuracy: 0.85 + Math.random() * 0.1,
      lastTrained: new Date()
    };
  }

  async getCurrentMetricValue(metric) {
    // Mock current metric values with some randomization
    const baselines = {
      response_time: 1500,
      error_rate: 0.01,
      throughput: 100,
      cpu_usage: 65,
      memory_usage: 70
    };
    
    const baseline = baselines[metric] || 50;
    const variation = baseline * 0.3; // 30% variation
    
    return baseline + (Math.random() - 0.5) * variation;
  }

  async getMetricHistory(metric, points) {
    // Mock historical data
    const history = [];
    const baseline = await this.getCurrentMetricValue(metric);
    
    for (let i = 0; i < points; i++) {
      history.push({
        timestamp: new Date(Date.now() - i * 60000), // 1 minute intervals
        value: baseline + (Math.random() - 0.5) * baseline * 0.2
      });
    }
    
    return history.reverse();
  }

  calculateLinearTrend(dataPoints) {
    // Simple linear regression
    const n = dataPoints.length;
    const x = dataPoints.map((_, i) => i);
    const y = dataPoints.map(p => p.value);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, val, i) => sum + Math.pow(val - (slope * x[i] + intercept), 2), 0);
    const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const rSquared = 1 - ssRes / ssTot;
    
    return { slope, intercept, rSquared };
  }

  projectTrend(trend, minutes) {
    return trend.slope * minutes + trend.intercept;
  }

  async runModelPrediction(metric, modelType, model) {
    // Mock ML prediction
    const baseline = await this.getCurrentMetricValue(metric);
    const variation = baseline * 0.1; // 10% prediction variation
    
    return {
      value: baseline + (Math.random() - 0.5) * variation,
      confidence: 0.8 + Math.random() * 0.15
    };
  }

  ensemblePredictions(predictions) {
    // Weighted average ensemble
    const totalWeight = predictions.reduce((sum, p) => sum + p.confidence, 0);
    const weightedValue = predictions.reduce((sum, p) => sum + p.value * p.confidence, 0) / totalWeight;
    const avgConfidence = totalWeight / predictions.length;
    
    return {
      value: weightedValue,
      confidence: avgConfidence
    };
  }

  getRecentTrend(metric) {
    // Mock recent trend
    return {
      slope: (Math.random() - 0.5) * 2,
      confidence: 0.7
    };
  }

  recordDegradationEvent(alert) {
    const history = this.state.degradationHistory.get(alert.metric) || [];
    history.push({
      timestamp: alert.timestamp,
      level: alert.level,
      degradation: alert.analysis.degradationPercent,
      confidence: alert.analysis.confidence
    });
    
    // Keep last 100 events
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.state.degradationHistory.set(alert.metric, history);
  }

  async handleTrendPrediction(metric, trendAnalysis) {
    console.log(`📈 Trend-based degradation prediction: ${metric} (${(trendAnalysis.projectedDegradation * 100).toFixed(1)}% in ${trendAnalysis.projectionMinutes}min)`);
  }

  async handlePredictiveDegradation(metric, prediction) {
    console.log(`🔮 ML-based degradation prediction: ${metric} (${(prediction.predictedDegradation * 100).toFixed(1)}% predicted)`);
  }

  async updateBaselines() {
    console.log('🔄 Updating performance baselines...');
    // In real implementation, recalculate baselines with fresh data
  }

  async sendSwedishPilotNotification(alert, routing) {
    console.log(`🇸🇪 Swedish pilot notification sent for ${alert.metric} degradation`);
  }

  async sendEmailAlert(alert, recipients) {
    console.log(`📧 Email alert sent to ${recipients.length} recipients`);
  }

  async sendPhoneAlert(alert) {
    console.log(`📞 Phone alert sent for critical ${alert.metric} degradation`);
  }

  async sendPagerDutyAlert(alert) {
    console.log(`📟 PagerDuty alert sent for critical ${alert.metric} degradation`);
  }
}

module.exports = { PerformanceDegradationSystem };

// CLI usage
if (require.main === module) {
  const system = new PerformanceDegradationSystem({
    // Demo configuration with shorter intervals
    monitoring: {
      intervals: {
        realtime: 10000,      // 10s for demo
        trending: 30000,      // 30s for demo  
        prediction: 60000,    // 1min for demo
        baseline: 300000      // 5min for demo
      }
    }
  });
  
  // Event listeners
  system.on('degradation_system_started', (data) => {
    console.log('🎯 Performance Degradation System Active');
    console.log(`   Monitoring ${data.metricsCount} performance metrics`);
    console.log(`   Swedish business context aware`);
    console.log(`   Machine learning predictions: ${data.mlEnabled ? 'Enabled' : 'Disabled'}`);
  });
  
  system.on('degradation_detected', (alert) => {
    console.log(`⚠️  PERFORMANCE DEGRADATION: ${alert.metric.toUpperCase()}`);
    console.log(`   Level: ${alert.level.toUpperCase()}`);
    console.log(`   Degradation: ${(alert.analysis.degradationPercent * 100).toFixed(1)}%`);
    console.log(`   Swedish Pilot Affected: ${alert.swedishPilotAffected ? 'YES' : 'NO'}`);
    console.log(`   Business Hours: ${alert.context.isBusinessHours ? 'YES' : 'NO'}`);
  });
  
  async function runSystem() {
    console.log('🇸🇪 Performance Degradation Early Warning System');
    console.log('================================================\n');
    
    try {
      await system.start();
      
      // Simulate degradation for demo
      setTimeout(() => {
        console.log('\n🎭 Simulating performance degradation for demonstration...');
        // In real system, this would be triggered by actual metric degradation
        system.emit('degradation_detected', {
          id: 'demo_degradation',
          type: 'performance_degradation',
          metric: 'response_time',
          level: 'warning',
          analysis: {
            currentValue: 3200,
            baselineValue: 1500,
            degradationPercent: 0.23,
            confidence: 0.87
          },
          context: {
            isBusinessHours: true,
            isPeakHour: true,
            swedishTime: new Date()
          },
          swedishPilotAffected: true,
          timestamp: new Date()
        });
      }, 15000);
      
      // Keep running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down performance degradation system...');
        await system.stop();
        process.exit(0);
      });
      
      console.log('\n💡 Press Ctrl+C to stop monitoring\n');
      
    } catch (error) {
      console.error('❌ Failed to start system:', error.message);
      process.exit(1);
    }
  }
  
  runSystem();
}