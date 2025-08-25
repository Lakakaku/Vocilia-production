/**
 * Automated Incident Detection and Escalation Workflows
 * 
 * Advanced incident detection engine with machine learning-based anomaly detection,
 * automated correlation, and intelligent escalation workflows for the Swedish pilot.
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { addMinutes, addHours, format, differenceInMinutes } = require('date-fns');
const { utcToZonedTime } = require('date-fns-tz');
const { sv } = require('date-fns/locale');

class IncidentDetectionEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Incident detection configuration
      detection: {
        // Anomaly detection settings
        anomalyThresholds: {
          responseTime: 2.5,      // 2.5 standard deviations
          errorRate: 3.0,         // 3.0 standard deviations
          throughput: 2.0,        // 2.0 standard deviations
          availability: 1.5       // 1.5 standard deviations (more sensitive)
        },
        
        // Time windows for analysis
        windows: {
          baseline: '7d',         // 7-day baseline
          short: '5m',           // 5-minute short-term analysis
          medium: '15m',         // 15-minute medium-term analysis
          long: '1h'             // 1-hour long-term analysis
        },
        
        // Incident classification thresholds
        severity: {
          critical: {
            errorRate: 0.10,           // 10% error rate
            responseTime: 10000,       // 10s response time
            availability: 0.95,        // Below 95% availability
            swedishPilotImpact: 0.5    // 50% of pilot businesses affected
          },
          high: {
            errorRate: 0.05,           // 5% error rate
            responseTime: 5000,        // 5s response time
            availability: 0.98,        // Below 98% availability
            swedishPilotImpact: 0.2    // 20% of pilot businesses affected
          },
          medium: {
            errorRate: 0.02,           // 2% error rate
            responseTime: 3000,        // 3s response time
            availability: 0.99,        // Below 99% availability
            swedishPilotImpact: 0.1    // 10% of pilot businesses affected
          }
        }
      },
      
      // Incident correlation rules
      correlation: {
        // Time window for correlating related events
        correlationWindow: 300, // 5 minutes
        
        // Correlation patterns
        patterns: [
          {
            name: 'cascade_failure',
            description: 'Multiple service failures in sequence',
            conditions: [
              { metric: 'service_availability', threshold: 0.9, count: 3 }
            ],
            severity: 'critical'
          },
          {
            name: 'database_performance_impact',
            description: 'Database issues causing application degradation',
            conditions: [
              { metric: 'database_response_time', threshold: 5000 },
              { metric: 'application_error_rate', threshold: 0.05 }
            ],
            severity: 'high'
          },
          {
            name: 'payment_system_degradation',
            description: 'Payment system issues affecting customer experience',
            conditions: [
              { metric: 'payment_failure_rate', threshold: 0.03 },
              { metric: 'customer_session_abandonment', threshold: 0.15 }
            ],
            severity: 'high'
          },
          {
            name: 'swedish_regional_outage',
            description: 'Multiple Swedish businesses affected simultaneously',
            conditions: [
              { metric: 'swedish_business_availability', threshold: 0.95, region: 'any' }
            ],
            severity: 'critical'
          }
        ]
      },
      
      // Escalation workflows
      escalation: {
        // Auto-escalation rules
        autoEscalation: [
          {
            condition: 'severity == "critical" && swedishPilot == true',
            initialDelay: 0,        // Immediate
            escalationInterval: 300, // 5 minutes
            maxLevel: 4
          },
          {
            condition: 'severity == "high" && businessHours == true',
            initialDelay: 600,      // 10 minutes
            escalationInterval: 900, // 15 minutes
            maxLevel: 3
          },
          {
            condition: 'severity == "high" && businessHours == false',
            initialDelay: 1200,     // 20 minutes
            escalationInterval: 1800, // 30 minutes
            maxLevel: 3
          },
          {
            condition: 'severity == "medium"',
            initialDelay: 1800,     // 30 minutes
            escalationInterval: 3600, // 1 hour
            maxLevel: 2
          }
        ],
        
        // Escalation levels with Swedish-specific configuration
        levels: [
          {
            name: 'L1_Support',
            description: 'First-line support team',
            contacts: {
              businessHours: ['l1-support@ai-feedback.se'],
              afterHours: ['l1-oncall@ai-feedback.se'],
              swedish: ['l1-sweden@ai-feedback.se']
            },
            channels: ['email', 'slack'],
            responseTime: 15, // 15 minutes expected response
            autoActions: ['gather_diagnostic_info', 'check_known_issues']
          },
          {
            name: 'L2_Engineering',
            description: 'Engineering on-call team',
            contacts: {
              businessHours: ['l2-eng@ai-feedback.se'],
              afterHours: ['l2-oncall@ai-feedback.se'],
              swedish: ['l2-sweden@ai-feedback.se']
            },
            channels: ['email', 'slack', 'phone'],
            responseTime: 10, // 10 minutes expected response
            autoActions: ['run_diagnostics', 'check_system_health', 'review_recent_changes']
          },
          {
            name: 'L3_Senior_Engineering',
            description: 'Senior engineering and team leads',
            contacts: {
              businessHours: ['l3-senior@ai-feedback.se'],
              afterHours: ['l3-oncall@ai-feedback.se'],
              swedish: ['l3-sweden@ai-feedback.se', 'pilot-lead@ai-feedback.se']
            },
            channels: ['email', 'phone', 'pagerduty'],
            responseTime: 5, // 5 minutes expected response
            autoActions: ['escalate_to_vendors', 'prepare_status_update', 'initiate_war_room']
          },
          {
            name: 'Executive_Leadership',
            description: 'C-level executives and business leadership',
            contacts: {
              businessHours: ['cto@ai-feedback.se', 'ceo@ai-feedback.se'],
              afterHours: ['exec-oncall@ai-feedback.se'],
              swedish: ['swedish-exec@ai-feedback.se', 'board-chair@ai-feedback.se']
            },
            channels: ['phone', 'email'],
            responseTime: 30, // 30 minutes for executive response
            autoActions: ['prepare_external_communication', 'notify_investors']
          }
        ]
      },
      
      // Swedish business context
      swedishBusiness: {
        timezone: 'Europe/Stockholm',
        businessHours: {
          weekdays: { start: 8, end: 18 },
          saturday: { start: 10, end: 16 },
          sunday: { closed: true }
        },
        holidays: [
          '2024-01-01', '2024-01-06', '2024-03-29', '2024-04-01',
          '2024-05-01', '2024-05-09', '2024-05-19', '2024-06-06',
          '2024-06-21', '2024-11-02', '2024-12-24', '2024-12-25', '2024-12-26'
        ],
        criticalBusinesses: [
          'ICA_MAXI_STOCKHOLM_001',
          'COOP_GOTEBORG_002', 
          'ESPRESSO_HOUSE_MALMO_003'
        ],
        
        // Swedish pilot specific thresholds
        pilotThresholds: {
          maxBusinessesDown: 3,      // Max 3 businesses can be down
          maxRegionalImpact: 0.5,    // Max 50% regional impact
          maxDowntimeBusiness: 300,  // Max 5 minutes downtime per business
          maxDowntimeRegion: 600     // Max 10 minutes regional downtime
        }
      },
      
      // Machine learning for anomaly detection
      machineLearning: {
        enabled: true,
        models: {
          responseTime: { type: 'isolation_forest', sensitivity: 0.1 },
          errorRate: { type: 'statistical', sensitivity: 0.05 },
          throughput: { type: 'time_series', sensitivity: 0.15 },
          userBehavior: { type: 'clustering', sensitivity: 0.2 }
        },
        trainingWindow: '30d',    // 30-day training window
        retrainInterval: '24h',   // Retrain every 24 hours
        minimumSamples: 1000      // Minimum samples for reliable detection
      },
      
      ...config
    };

    // Incident state management
    this.incidents = new Map();
    this.correlatedEvents = new Map();
    this.escalations = new Map();
    this.metricBaselines = new Map();
    this.mlModels = new Map();
    
    // Performance tracking
    this.performanceHistory = {
      responseTime: [],
      errorRate: [],
      throughput: [],
      availability: []
    };
  }

  /**
   * Start incident detection engine
   */
  async start() {
    console.log('🚨 Starting Incident Detection Engine');
    console.log('====================================');
    
    try {
      // Initialize baselines and ML models
      await this.initializeBaselines();
      await this.initializeMachineLearning();
      
      // Start detection loops
      this.startAnomalyDetection();
      this.startIncidentCorrelation();
      this.startEscalationManagement();
      this.startSwedishPilotMonitoring();
      
      console.log('✅ Incident detection engine started successfully');
      console.log(`   Monitoring ${this.config.correlation.patterns.length} correlation patterns`);
      console.log(`   ${this.config.escalation.levels.length} escalation levels configured`);
      console.log(`   Machine Learning: ${this.config.machineLearning.enabled ? 'Enabled' : 'Disabled'}`);
      
      this.emit('detection_engine_started', {
        timestamp: new Date(),
        configuration: {
          patterns: this.config.correlation.patterns.length,
          escalationLevels: this.config.escalation.levels.length,
          mlEnabled: this.config.machineLearning.enabled
        }
      });
      
    } catch (error) {
      console.error('❌ Failed to start incident detection engine:', error.message);
      throw error;
    }
  }

  /**
   * Stop incident detection engine
   */
  async stop() {
    console.log('🛑 Stopping incident detection engine...');
    
    // Clear all timers and intervals
    if (this.anomalyTimer) clearInterval(this.anomalyTimer);
    if (this.correlationTimer) clearInterval(this.correlationTimer);
    if (this.escalationTimer) clearInterval(this.escalationTimer);
    if (this.swedishPilotTimer) clearInterval(this.swedishPilotTimer);
    
    console.log('✅ Incident detection engine stopped');
    
    this.emit('detection_engine_stopped', {
      timestamp: new Date(),
      activeIncidents: this.incidents.size,
      activeEscalations: this.escalations.size
    });
  }

  /**
   * Initialize performance baselines
   */
  async initializeBaselines() {
    console.log('📊 Initializing performance baselines...');
    
    const metrics = ['response_time', 'error_rate', 'throughput', 'availability'];
    
    for (const metric of metrics) {
      try {
        const baseline = await this.calculateBaseline(metric);
        this.metricBaselines.set(metric, baseline);
        console.log(`   ${metric}: μ=${baseline.mean.toFixed(2)}, σ=${baseline.stddev.toFixed(2)}`);
      } catch (error) {
        console.warn(`   Failed to calculate baseline for ${metric}: ${error.message}`);
      }
    }
    
    console.log('✅ Performance baselines initialized');
  }

  /**
   * Initialize machine learning models
   */
  async initializeMachineLearning() {
    if (!this.config.machineLearning.enabled) {
      console.log('⚠️  Machine learning disabled');
      return;
    }
    
    console.log('🤖 Initializing machine learning models...');
    
    const models = Object.keys(this.config.machineLearning.models);
    
    for (const modelName of models) {
      try {
        const model = await this.trainAnomalyModel(modelName);
        this.mlModels.set(modelName, model);
        console.log(`   ${modelName}: ${model.type} model trained`);
      } catch (error) {
        console.warn(`   Failed to train ${modelName} model: ${error.message}`);
      }
    }
    
    console.log('✅ Machine learning models initialized');
  }

  /**
   * Start anomaly detection monitoring
   */
  startAnomalyDetection() {
    this.anomalyTimer = setInterval(async () => {
      try {
        await this.detectAnomalies();
      } catch (error) {
        console.error('Anomaly detection error:', error.message);
      }
    }, 30000); // Run every 30 seconds
    
    console.log('🔍 Anomaly detection started (30s interval)');
  }

  /**
   * Start incident correlation analysis
   */
  startIncidentCorrelation() {
    this.correlationTimer = setInterval(async () => {
      try {
        await this.correlateEvents();
      } catch (error) {
        console.error('Event correlation error:', error.message);
      }
    }, 60000); // Run every minute
    
    console.log('🔗 Incident correlation started (1min interval)');
  }

  /**
   * Start escalation management
   */
  startEscalationManagement() {
    this.escalationTimer = setInterval(async () => {
      try {
        await this.manageEscalations();
      } catch (error) {
        console.error('Escalation management error:', error.message);
      }
    }, 60000); // Run every minute
    
    console.log('📈 Escalation management started (1min interval)');
  }

  /**
   * Start Swedish pilot specific monitoring
   */
  startSwedishPilotMonitoring() {
    this.swedishPilotTimer = setInterval(async () => {
      try {
        await this.monitorSwedishPilot();
      } catch (error) {
        console.error('Swedish pilot monitoring error:', error.message);
      }
    }, 30000); // Run every 30 seconds
    
    console.log('🇸🇪 Swedish pilot monitoring started (30s interval)');
  }

  /**
   * Detect anomalies in system metrics
   */
  async detectAnomalies() {
    const metrics = ['response_time', 'error_rate', 'throughput', 'availability'];
    const detectedAnomalies = [];
    
    for (const metric of metrics) {
      try {
        const anomaly = await this.detectMetricAnomaly(metric);
        if (anomaly.detected) {
          detectedAnomalies.push(anomaly);
          
          // Create incident if anomaly is significant
          if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
            await this.createIncident(anomaly);
          }
        }
      } catch (error) {
        console.error(`Anomaly detection error for ${metric}:`, error.message);
      }
    }
    
    if (detectedAnomalies.length > 0) {
      console.log(`🔍 Detected ${detectedAnomalies.length} anomalies`);
      this.emit('anomalies_detected', detectedAnomalies);
    }
  }

  /**
   * Detect anomaly in specific metric
   */
  async detectMetricAnomaly(metric) {
    const baseline = this.metricBaselines.get(metric);
    if (!baseline) {
      return { detected: false, reason: 'no_baseline' };
    }
    
    // Get current metric value
    const currentValue = await this.getCurrentMetricValue(metric);
    if (currentValue === null) {
      return { detected: false, reason: 'no_data' };
    }
    
    // Statistical anomaly detection
    const zScore = Math.abs(currentValue - baseline.mean) / baseline.stddev;
    const threshold = this.config.detection.anomalyThresholds[metric] || 2.5;
    
    const statisticalAnomaly = zScore > threshold;
    
    // Machine learning anomaly detection (if enabled)
    let mlAnomaly = false;
    if (this.config.machineLearning.enabled && this.mlModels.has(metric)) {
      mlAnomaly = await this.detectMLAnomaly(metric, currentValue);
    }
    
    const detected = statisticalAnomaly || mlAnomaly;
    
    if (detected) {
      const severity = this.calculateAnomalySeverity(metric, currentValue, zScore);
      
      return {
        detected: true,
        metric,
        currentValue,
        baselineValue: baseline.mean,
        zScore,
        severity,
        detectionMethod: mlAnomaly ? 'ml' : 'statistical',
        timestamp: new Date(),
        confidence: Math.min(1.0, zScore / threshold)
      };
    }
    
    return { detected: false };
  }

  /**
   * Correlate events to identify complex incidents
   */
  async correlateEvents() {
    const recentEvents = await this.getRecentEvents();
    
    for (const pattern of this.config.correlation.patterns) {
      const correlatedIncident = await this.checkCorrelationPattern(pattern, recentEvents);
      
      if (correlatedIncident) {
        console.log(`🔗 Correlated incident detected: ${pattern.name}`);
        await this.createCorrelatedIncident(correlatedIncident, pattern);
      }
    }
  }

  /**
   * Check specific correlation pattern
   */
  async checkCorrelationPattern(pattern, events) {
    const matchingEvents = [];
    const correlationWindow = this.config.correlation.correlationWindow * 1000; // Convert to milliseconds
    const now = Date.now();
    
    for (const condition of pattern.conditions) {
      const recentEvents = events.filter(event => 
        event.metric === condition.metric &&
        (now - event.timestamp.getTime()) <= correlationWindow
      );
      
      // Check if condition is met
      const conditionMet = await this.evaluateCondition(condition, recentEvents);
      
      if (conditionMet) {
        matchingEvents.push(...recentEvents);
      } else {
        return null; // Pattern not matched
      }
    }
    
    if (matchingEvents.length > 0) {
      return {
        pattern: pattern.name,
        description: pattern.description,
        severity: pattern.severity,
        events: matchingEvents,
        detectedAt: new Date()
      };
    }
    
    return null;
  }

  /**
   * Create incident from anomaly or correlation
   */
  async createIncident(data) {
    const incidentId = uuidv4();
    const swedishTime = utcToZonedTime(new Date(), this.config.swedishBusiness.timezone);
    const isBusinessHours = this.isSwedishBusinessHours(swedishTime);
    const isSwedishPilotAffected = await this.checkSwedishPilotImpact(data);
    
    const incident = {
      id: incidentId,
      type: data.metric || data.pattern || 'system_anomaly',
      title: this.generateIncidentTitle(data),
      description: this.generateIncidentDescription(data),
      severity: data.severity || 'medium',
      status: 'open',
      
      // Context
      isSwedishPilotAffected,
      isBusinessHours,
      swedishTime: format(swedishTime, 'yyyy-MM-dd HH:mm:ss', { locale: sv }),
      
      // Data
      anomaly: data,
      affectedServices: await this.getAffectedServices(data),
      businessImpact: await this.calculateBusinessImpact(data, isSwedishPilotAffected),
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      
      // Escalation
      escalationLevel: 0,
      escalationHistory: [],
      
      // Notifications
      notifications: [],
      acknowledgments: []
    };
    
    this.incidents.set(incidentId, incident);
    
    console.log(`🚨 Incident created: ${incident.title} (${incident.severity})`);
    
    // Start escalation workflow
    await this.startIncidentEscalation(incident);
    
    this.emit('incident_created', incident);
    
    return incident;
  }

  /**
   * Start escalation workflow for incident
   */
  async startIncidentEscalation(incident) {
    const escalationRule = this.findEscalationRule(incident);
    
    if (!escalationRule) {
      console.warn(`No escalation rule found for incident ${incident.id}`);
      return;
    }
    
    const escalation = {
      id: uuidv4(),
      incidentId: incident.id,
      rule: escalationRule,
      currentLevel: 0,
      startTime: new Date(),
      nextEscalationTime: new Date(Date.now() + escalationRule.initialDelay * 1000),
      notifications: [],
      status: 'active'
    };
    
    this.escalations.set(escalation.id, escalation);
    
    // Send immediate notifications if initialDelay is 0
    if (escalationRule.initialDelay === 0) {
      await this.executeEscalationLevel(escalation, incident);
    }
    
    console.log(`📈 Escalation started for incident ${incident.id}`);
    
    this.emit('escalation_started', { incident, escalation });
  }

  /**
   * Manage active escalations
   */
  async manageEscalations() {
    const now = new Date();
    
    for (const [escalationId, escalation] of this.escalations) {
      if (escalation.status !== 'active') continue;
      
      const incident = this.incidents.get(escalation.incidentId);
      if (!incident) {
        this.escalations.delete(escalationId);
        continue;
      }
      
      // Check if incident is resolved
      if (incident.status === 'resolved') {
        await this.stopEscalation(escalation, 'incident_resolved');
        continue;
      }
      
      // Check if escalation is due
      if (now >= escalation.nextEscalationTime) {
        await this.escalateIncident(escalation, incident);
      }
    }
  }

  /**
   * Escalate incident to next level
   */
  async escalateIncident(escalation, incident) {
    escalation.currentLevel++;
    
    if (escalation.currentLevel >= this.config.escalation.levels.length) {
      console.log(`⚠️  Maximum escalation level reached for incident ${incident.id}`);
      escalation.status = 'max_level_reached';
      return;
    }
    
    // Execute escalation level
    await this.executeEscalationLevel(escalation, incident);
    
    // Schedule next escalation
    escalation.nextEscalationTime = new Date(
      Date.now() + escalation.rule.escalationInterval * 1000
    );
    
    // Update incident
    incident.escalationLevel = escalation.currentLevel;
    incident.escalationHistory.push({
      level: escalation.currentLevel,
      timestamp: new Date(),
      reason: 'auto_escalation'
    });
    incident.updatedAt = new Date();
    
    const levelName = this.config.escalation.levels[escalation.currentLevel].name;
    console.log(`📢 Incident ${incident.id} escalated to ${levelName}`);
    
    this.emit('incident_escalated', { incident, escalation, level: levelName });
  }

  /**
   * Execute specific escalation level
   */
  async executeEscalationLevel(escalation, incident) {
    const level = this.config.escalation.levels[escalation.currentLevel];
    const isBusinessHours = incident.isBusinessHours;
    const isSwedishPilot = incident.isSwedishPilotAffected;
    
    // Determine contacts
    let contacts = level.contacts.businessHours;
    if (!isBusinessHours) contacts = level.contacts.afterHours;
    if (isSwedishPilot) contacts = [...contacts, ...level.contacts.swedish];
    
    // Send notifications
    const notification = {
      id: uuidv4(),
      escalationLevel: escalation.currentLevel,
      levelName: level.name,
      contacts,
      channels: level.channels,
      timestamp: new Date(),
      status: 'sent'
    };
    
    await this.sendEscalationNotifications(incident, notification);
    
    escalation.notifications.push(notification);
    incident.notifications.push(notification);
    
    // Execute auto-actions
    if (level.autoActions) {
      await this.executeAutoActions(incident, level.autoActions);
    }
    
    console.log(`📧 Sent ${level.name} notifications to ${contacts.length} contacts`);
  }

  /**
   * Monitor Swedish pilot specific metrics
   */
  async monitorSwedishPilot() {
    const pilotMetrics = await this.getSwedishPilotMetrics();
    const thresholds = this.config.swedishBusiness.pilotThresholds;
    
    // Check critical thresholds
    const violations = [];
    
    if (pilotMetrics.businessesDown > thresholds.maxBusinessesDown) {
      violations.push({
        type: 'businesses_down',
        current: pilotMetrics.businessesDown,
        threshold: thresholds.maxBusinessesDown,
        severity: 'critical'
      });
    }
    
    if (pilotMetrics.regionalImpact > thresholds.maxRegionalImpact) {
      violations.push({
        type: 'regional_impact',
        current: pilotMetrics.regionalImpact,
        threshold: thresholds.maxRegionalImpact,
        severity: 'high'
      });
    }
    
    // Create Swedish pilot incidents
    for (const violation of violations) {
      await this.createSwedishPilotIncident(violation, pilotMetrics);
    }
    
    if (violations.length > 0) {
      this.emit('swedish_pilot_violations', violations);
    }
  }

  /**
   * Create Swedish pilot specific incident
   */
  async createSwedishPilotIncident(violation, pilotMetrics) {
    const swedishTime = utcToZonedTime(new Date(), this.config.swedishBusiness.timezone);
    
    const incident = {
      id: uuidv4(),
      type: 'swedish_pilot_violation',
      title: `Swedish Pilot ${violation.type.replace('_', ' ').toUpperCase()} Threshold Exceeded`,
      description: `Swedish pilot experiencing ${violation.type}: ${violation.current} (threshold: ${violation.threshold})`,
      severity: violation.severity,
      status: 'open',
      
      // Swedish pilot specific
      isSwedishPilotAffected: true,
      isBusinessHours: this.isSwedishBusinessHours(swedishTime),
      swedishTime: format(swedishTime, 'yyyy-MM-dd HH:mm:ss', { locale: sv }),
      
      // Pilot context
      violation,
      pilotMetrics,
      affectedBusinesses: pilotMetrics.affectedBusinesses || [],
      affectedRegions: pilotMetrics.affectedRegions || [],
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      
      // Escalation
      escalationLevel: 0,
      escalationHistory: [],
      
      // Priority (Swedish pilot gets higher priority)
      priority: 'high',
      businessImpact: 'high'
    };
    
    this.incidents.set(incident.id, incident);
    
    console.log(`🇸🇪 Swedish pilot incident: ${incident.title}`);
    
    // Immediate escalation for Swedish pilot critical issues
    if (violation.severity === 'critical') {
      await this.startIncidentEscalation(incident);
    }
    
    this.emit('swedish_pilot_incident_created', incident);
    
    return incident;
  }

  // Utility methods

  /**
   * Check if current time is Swedish business hours
   */
  isSwedishBusinessHours(time = new Date()) {
    const swedishTime = utcToZonedTime(time, this.config.swedishBusiness.timezone);
    const day = swedishTime.getDay();
    const hour = swedishTime.getHours();
    const dateStr = format(swedishTime, 'yyyy-MM-dd');
    
    // Check holidays
    if (this.config.swedishBusiness.holidays.includes(dateStr)) return false;
    
    // Sunday
    if (day === 0 && this.config.swedishBusiness.businessHours.sunday.closed) return false;
    
    // Saturday
    if (day === 6) {
      const sat = this.config.swedishBusiness.businessHours.saturday;
      return hour >= sat.start && hour < sat.end;
    }
    
    // Weekdays
    if (day >= 1 && day <= 5) {
      const weekdays = this.config.swedishBusiness.businessHours.weekdays;
      return hour >= weekdays.start && hour < weekdays.end;
    }
    
    return false;
  }

  /**
   * Find appropriate escalation rule
   */
  findEscalationRule(incident) {
    for (const rule of this.config.escalation.autoEscalation) {
      if (this.evaluateEscalationCondition(rule.condition, incident)) {
        return rule;
      }
    }
    
    // Default rule
    return this.config.escalation.autoEscalation[this.config.escalation.autoEscalation.length - 1];
  }

  /**
   * Evaluate escalation condition
   */
  evaluateEscalationCondition(condition, incident) {
    try {
      // Simple condition evaluation (could be enhanced with expression parser)
      const variables = {
        severity: incident.severity,
        swedishPilot: incident.isSwedishPilotAffected,
        businessHours: incident.isBusinessHours,
        businessImpact: incident.businessImpact
      };
      
      // Basic condition matching
      if (condition.includes('severity == "critical"') && variables.severity === 'critical') {
        if (!condition.includes('swedishPilot') || variables.swedishPilot) {
          return true;
        }
      }
      
      if (condition.includes('severity == "high"') && variables.severity === 'high') {
        if (condition.includes('businessHours == true') && variables.businessHours) return true;
        if (condition.includes('businessHours == false') && !variables.businessHours) return true;
      }
      
      if (condition.includes('severity == "medium"') && variables.severity === 'medium') {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Condition evaluation error:', error.message);
      return false;
    }
  }

  // Placeholder methods for complex operations
  
  async calculateBaseline(metric) {
    // Mock baseline calculation
    return {
      mean: Math.random() * 100,
      stddev: Math.random() * 20,
      samples: 10000
    };
  }
  
  async trainAnomalyModel(modelName) {
    // Mock ML model training
    return {
      type: this.config.machineLearning.models[modelName].type,
      trained: true,
      accuracy: 0.95
    };
  }
  
  async getCurrentMetricValue(metric) {
    // Mock current metric value
    return Math.random() * 100;
  }
  
  async detectMLAnomaly(metric, value) {
    // Mock ML anomaly detection
    return Math.random() < 0.1; // 10% chance of anomaly
  }
  
  calculateAnomalySeverity(metric, value, zScore) {
    if (zScore > 4) return 'critical';
    if (zScore > 3) return 'high';
    if (zScore > 2) return 'medium';
    return 'low';
  }
  
  async getRecentEvents() {
    // Mock recent events
    return [];
  }
  
  async evaluateCondition(condition, events) {
    // Mock condition evaluation
    return events.length >= (condition.count || 1);
  }
  
  async createCorrelatedIncident(correlatedIncident, pattern) {
    // Create incident from correlation pattern
    return this.createIncident({
      pattern: pattern.name,
      severity: pattern.severity,
      events: correlatedIncident.events
    });
  }
  
  generateIncidentTitle(data) {
    if (data.metric) {
      return `${data.metric.replace('_', ' ').toUpperCase()} Anomaly Detected`;
    }
    if (data.pattern) {
      return `${data.pattern.replace('_', ' ').toUpperCase()} Pattern Detected`;
    }
    return 'System Incident Detected';
  }
  
  generateIncidentDescription(data) {
    if (data.currentValue && data.baselineValue) {
      return `${data.metric} is ${data.currentValue.toFixed(2)}, significantly different from baseline ${data.baselineValue.toFixed(2)} (z-score: ${data.zScore?.toFixed(2)})`;
    }
    if (data.description) {
      return data.description;
    }
    return 'System anomaly detected requiring investigation';
  }
  
  async checkSwedishPilotImpact(data) {
    // Check if Swedish pilot is affected
    return Math.random() < 0.3; // 30% chance
  }
  
  async getAffectedServices(data) {
    // Get affected services
    return ['voice-service', 'ai-processor'];
  }
  
  async calculateBusinessImpact(data, isSwedishPilot) {
    // Calculate business impact
    if (isSwedishPilot) return 'high';
    return ['low', 'medium', 'high'][Math.floor(Math.random() * 3)];
  }
  
  async stopEscalation(escalation, reason) {
    escalation.status = 'stopped';
    escalation.stopReason = reason;
    escalation.stopTime = new Date();
    
    console.log(`🛑 Stopped escalation ${escalation.id}: ${reason}`);
  }
  
  async sendEscalationNotifications(incident, notification) {
    // Send notifications through various channels
    console.log(`📧 Sending ${notification.levelName} notifications for incident ${incident.id}`);
  }
  
  async executeAutoActions(incident, actions) {
    // Execute automated actions
    console.log(`🤖 Executing auto actions for incident ${incident.id}: ${actions.join(', ')}`);
  }
  
  async getSwedishPilotMetrics() {
    // Mock Swedish pilot metrics
    return {
      businessesDown: Math.floor(Math.random() * 5),
      regionalImpact: Math.random(),
      totalBusinesses: 12,
      affectedBusinesses: ['business_1', 'business_2'],
      affectedRegions: ['stockholm']
    };
  }
}

module.exports = { IncidentDetectionEngine };

// CLI usage
if (require.main === module) {
  const engine = new IncidentDetectionEngine({
    // Demo configuration with shorter intervals
    detection: {
      windows: {
        baseline: '1d',    // Shorter for demo
        short: '1m',
        medium: '5m',
        long: '15m'
      }
    }
  });
  
  // Event listeners for demo
  engine.on('detection_engine_started', (data) => {
    console.log('🎯 Incident Detection Engine is active');
    console.log(`   Correlation patterns: ${data.configuration.patterns}`);
    console.log(`   Escalation levels: ${data.configuration.escalationLevels}`);
    console.log(`   Machine Learning: ${data.configuration.mlEnabled}`);
  });
  
  engine.on('incident_created', (incident) => {
    console.log(`🚨 NEW INCIDENT: ${incident.title}`);
    console.log(`   Severity: ${incident.severity.toUpperCase()}`);
    console.log(`   Swedish Pilot: ${incident.isSwedishPilotAffected ? 'YES' : 'NO'}`);
    console.log(`   Business Hours: ${incident.isBusinessHours ? 'YES' : 'NO'}`);
  });
  
  engine.on('incident_escalated', (data) => {
    console.log(`📢 ESCALATION: ${data.incident.title} → ${data.level}`);
  });
  
  engine.on('swedish_pilot_incident_created', (incident) => {
    console.log(`🇸🇪 SWEDISH PILOT INCIDENT: ${incident.title}`);
  });
  
  async function runDetection() {
    console.log('🇸🇪 Automated Incident Detection and Escalation Engine');
    console.log('===================================================\n');
    
    try {
      await engine.start();
      
      // Keep running for demo
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down incident detection engine...');
        await engine.stop();
        process.exit(0);
      });
      
      console.log('\n💡 Press Ctrl+C to stop detection engine\n');
      
      // Simulate some incidents for demo
      setTimeout(() => {
        console.log('\n🎭 Simulating incident for demonstration...');
        engine.createIncident({
          metric: 'response_time',
          currentValue: 8500,
          baselineValue: 2000,
          zScore: 3.2,
          severity: 'high'
        });
      }, 5000);
      
    } catch (error) {
      console.error('❌ Failed to start detection engine:', error.message);
      process.exit(1);
    }
  }
  
  runDetection();
}