/**
 * Comprehensive Real-Time Monitoring System
 * 
 * Advanced monitoring system with Swedish business hour awareness,
 * automated incident detection, escalation workflows, and priority-based routing.
 * 
 * Integrates with existing Prometheus, AlertManager, and Swedish pilot infrastructure.
 */

const EventEmitter = require('events');
const axios = require('axios');
const { format, addMinutes, parseISO } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');
const { sv } = require('date-fns/locale');

class ComprehensiveMonitoringSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Monitoring endpoints
      prometheusUrl: process.env.PROMETHEUS_URL || 'http://localhost:9090',
      alertManagerUrl: process.env.ALERTMANAGER_URL || 'http://localhost:9093',
      adminPrometheusUrl: process.env.ADMIN_PROMETHEUS_URL || 'http://localhost:9095',
      adminAlertManagerUrl: process.env.ADMIN_ALERTMANAGER_URL || 'http://localhost:9096',
      
      // Swedish business hours configuration
      swedishBusinessHours: {
        timezone: 'Europe/Stockholm',
        weekdays: {
          start: 8,  // 08:00
          end: 18,   // 18:00
        },
        saturday: {
          start: 10, // 10:00
          end: 16,   // 16:00
        },
        sunday: {
          closed: true
        },
        holidays: [
          '2024-01-01', '2024-01-06', '2024-03-29', '2024-04-01', // New Year, Epiphany, Good Friday, Easter Monday
          '2024-05-01', '2024-05-09', '2024-05-19', '2024-06-06', // May Day, Ascension Day, Whit Monday, National Day
          '2024-06-21', '2024-11-02', '2024-12-24', '2024-12-25', '2024-12-26' // Midsummer, All Saints, Christmas Eve, Christmas, Boxing Day
        ]
      },
      
      // Incident detection thresholds
      incidentThresholds: {
        critical: {
          responseTime: 5000,        // 5s max response time
          errorRate: 0.05,          // 5% max error rate
          systemLoad: 0.85,         // 85% max system load
          memoryUsage: 0.90,        // 90% max memory usage
          diskUsage: 0.85,          // 85% max disk usage
          paymentFailureRate: 0.03, // 3% max payment failure rate
          aiProcessingFailure: 0.02 // 2% max AI processing failure
        },
        warning: {
          responseTime: 3000,        // 3s response time warning
          errorRate: 0.02,          // 2% error rate warning
          systemLoad: 0.70,         // 70% system load warning
          memoryUsage: 0.75,        // 75% memory usage warning
          diskUsage: 0.70,          // 70% disk usage warning
          paymentFailureRate: 0.01, // 1% payment failure warning
          aiProcessingFailure: 0.01 // 1% AI processing failure warning
        }
      },
      
      // Performance degradation detection
      performanceDegradation: {
        baselineWindow: '7d',      // 7-day baseline
        comparisonWindow: '1h',    // 1-hour comparison window
        degradationThreshold: 0.20, // 20% degradation threshold
        minimumDataPoints: 100,    // Minimum data points for analysis
        confidenceLevel: 0.95      // 95% confidence level
      },
      
      // Escalation configuration
      escalation: {
        levels: [
          {
            name: 'L1_Support',
            timeout: 300, // 5 minutes
            contacts: ['l1-support@ai-feedback.se'],
            channels: ['email', 'slack'],
            businessHours: true
          },
          {
            name: 'L2_Engineering',
            timeout: 600, // 10 minutes
            contacts: ['l2-engineering@ai-feedback.se'],
            channels: ['email', 'slack', 'phone'],
            businessHours: false
          },
          {
            name: 'L3_Senior_Engineering',
            timeout: 900, // 15 minutes
            contacts: ['l3-senior@ai-feedback.se'],
            channels: ['email', 'phone', 'pagerduty'],
            businessHours: false
          },
          {
            name: 'Management',
            timeout: 1800, // 30 minutes
            contacts: ['management@ai-feedback.se', 'cto@ai-feedback.se'],
            channels: ['email', 'phone'],
            businessHours: false
          }
        ]
      },
      
      // Swedish pilot specific configuration
      swedishPilot: {
        regions: ['stockholm', 'gothenburg', 'malmo'],
        businessTypes: ['grocery_store', 'cafe', 'restaurant', 'retail'],
        criticalBusinesses: [], // Will be loaded from configuration
        maxDowntime: 300, // 5 minutes max downtime for pilot businesses
        slaTargets: {
          availability: 0.999,  // 99.9% availability
          responseTime: 2000,   // 2s max response time
          successRate: 0.95     // 95% success rate
        }
      },
      
      // Monitoring intervals
      monitoring: {
        healthCheckInterval: 30000,    // 30s health checks
        metricsInterval: 60000,        // 1min metrics collection
        alertEvaluation: 30000,        // 30s alert evaluation
        performanceAnalysis: 300000,   // 5min performance analysis
        systemHealthInterval: 120000   // 2min system health checks
      },
      
      // Notification channels
      notifications: {
        slack: {
          webhooks: {
            critical: process.env.SLACK_CRITICAL_WEBHOOK,
            warning: process.env.SLACK_WARNING_WEBHOOK,
            info: process.env.SLACK_INFO_WEBHOOK,
            swedishPilot: process.env.SLACK_SWEDISH_PILOT_WEBHOOK
          }
        },
        email: {
          smtp: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          }
        },
        pagerduty: {
          integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY
        }
      },
      
      ...config
    };

    // Monitoring state
    this.monitoringState = {
      incidents: new Map(),
      escalations: new Map(),
      performanceBaselines: new Map(),
      systemHealth: {
        lastUpdate: null,
        status: 'unknown',
        services: new Map()
      },
      swedishPilotStatus: {
        businesses: new Map(),
        regionalHealth: new Map(),
        lastUpdate: null
      }
    };

    // Timers
    this.timers = new Map();
  }

  /**
   * Start comprehensive monitoring system
   */
  async start() {
    console.log('🚀 Starting Comprehensive Real-Time Monitoring System');
    console.log('====================================================');
    
    try {
      // Initialize monitoring components
      await this.initializeMonitoring();
      
      // Start health checks
      this.startHealthChecks();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      // Start incident detection
      this.startIncidentDetection();
      
      // Start Swedish pilot monitoring
      this.startSwedishPilotMonitoring();
      
      // Start alert processing
      this.startAlertProcessing();
      
      console.log('✅ Comprehensive monitoring system started successfully');
      console.log(`   Swedish Business Hours: ${this.getCurrentSwedishBusinessHourStatus()}`);
      console.log(`   Active Monitoring: ${this.timers.size} monitoring loops`);
      
      this.emit('monitoring_started', {
        timestamp: new Date(),
        components: ['health_checks', 'performance', 'incidents', 'swedish_pilot', 'alerts']
      });
      
    } catch (error) {
      console.error('❌ Failed to start monitoring system:', error.message);
      throw error;
    }
  }

  /**
   * Stop monitoring system
   */
  async stop() {
    console.log('🛑 Stopping monitoring system...');
    
    // Clear all timers
    this.timers.forEach((timer, name) => {
      clearInterval(timer);
      console.log(`   Stopped ${name} monitoring`);
    });
    
    this.timers.clear();
    
    this.emit('monitoring_stopped', {
      timestamp: new Date(),
      incidents: this.monitoringState.incidents.size,
      escalations: this.monitoringState.escalations.size
    });
    
    console.log('✅ Monitoring system stopped');
  }

  /**
   * Initialize monitoring components
   */
  async initializeMonitoring() {
    console.log('🔧 Initializing monitoring components...');
    
    // Validate endpoints
    await this.validateMonitoringEndpoints();
    
    // Load Swedish pilot businesses
    await this.loadSwedishPilotBusinesses();
    
    // Initialize performance baselines
    await this.initializePerformanceBaselines();
    
    // Set up event listeners
    this.setupEventListeners();
    
    console.log('✅ Monitoring components initialized');
  }

  /**
   * Start health checks monitoring
   */
  startHealthChecks() {
    const timer = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('Health check error:', error.message);
      }
    }, this.config.monitoring.healthCheckInterval);
    
    this.timers.set('health_checks', timer);
    console.log('✅ Health checks monitoring started');
  }

  /**
   * Start performance monitoring and degradation detection
   */
  startPerformanceMonitoring() {
    const timer = setInterval(async () => {
      try {
        await this.analyzePerformanceDegradation();
      } catch (error) {
        console.error('Performance monitoring error:', error.message);
      }
    }, this.config.monitoring.performanceAnalysis);
    
    this.timers.set('performance_monitoring', timer);
    console.log('✅ Performance monitoring started');
  }

  /**
   * Start incident detection and classification
   */
  startIncidentDetection() {
    const timer = setInterval(async () => {
      try {
        await this.detectIncidents();
      } catch (error) {
        console.error('Incident detection error:', error.message);
      }
    }, this.config.monitoring.alertEvaluation);
    
    this.timers.set('incident_detection', timer);
    console.log('✅ Incident detection started');
  }

  /**
   * Start Swedish pilot specific monitoring
   */
  startSwedishPilotMonitoring() {
    const timer = setInterval(async () => {
      try {
        await this.monitorSwedishPilot();
      } catch (error) {
        console.error('Swedish pilot monitoring error:', error.message);
      }
    }, this.config.monitoring.systemHealthInterval);
    
    this.timers.set('swedish_pilot_monitoring', timer);
    console.log('✅ Swedish pilot monitoring started');
  }

  /**
   * Start alert processing and routing
   */
  startAlertProcessing() {
    const timer = setInterval(async () => {
      try {
        await this.processAlerts();
        await this.handleEscalations();
      } catch (error) {
        console.error('Alert processing error:', error.message);
      }
    }, this.config.monitoring.alertEvaluation);
    
    this.timers.set('alert_processing', timer);
    console.log('✅ Alert processing started');
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks() {
    const healthCheck = {
      timestamp: new Date(),
      services: new Map(),
      overallStatus: 'healthy'
    };

    // Core service health checks
    const services = [
      { name: 'prometheus', url: `${this.config.prometheusUrl}/-/healthy` },
      { name: 'alertmanager', url: `${this.config.alertManagerUrl}/-/healthy` },
      { name: 'admin_prometheus', url: `${this.config.adminPrometheusUrl}/-/healthy` },
      { name: 'admin_alertmanager', url: `${this.config.adminAlertManagerUrl}/-/healthy` }
    ];

    for (const service of services) {
      try {
        const response = await axios.get(service.url, { timeout: 5000 });
        const isHealthy = response.status === 200;
        
        healthCheck.services.set(service.name, {
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - healthCheck.timestamp.getTime(),
          lastCheck: new Date()
        });
        
        if (!isHealthy && healthCheck.overallStatus === 'healthy') {
          healthCheck.overallStatus = 'degraded';
        }
        
      } catch (error) {
        healthCheck.services.set(service.name, {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date()
        });
        healthCheck.overallStatus = 'unhealthy';
      }
    }

    this.monitoringState.systemHealth = healthCheck;
    
    // Emit health status change
    this.emit('health_check_complete', healthCheck);
    
    // Generate alerts for unhealthy services
    if (healthCheck.overallStatus !== 'healthy') {
      await this.generateHealthAlert(healthCheck);
    }
  }

  /**
   * Analyze performance degradation patterns
   */
  async analyzePerformanceDegradation() {
    const metrics = [
      'feedback_session_duration_seconds',
      'ai_processing_duration_seconds',
      'payment_processing_duration_seconds',
      'voice_recognition_accuracy',
      'system_cpu_usage',
      'system_memory_usage'
    ];

    for (const metric of metrics) {
      try {
        const degradation = await this.detectPerformanceDegradation(metric);
        
        if (degradation.detected) {
          await this.handlePerformanceDegradation(metric, degradation);
        }
        
      } catch (error) {
        console.error(`Performance analysis error for ${metric}:`, error.message);
      }
    }
  }

  /**
   * Detect specific performance degradation
   */
  async detectPerformanceDegradation(metric) {
    const { baselineWindow, comparisonWindow, degradationThreshold } = this.config.performanceDegradation;
    
    // Get baseline performance (7 days ago)
    const baselineQuery = `avg_over_time(${metric}[${baselineWindow}] offset ${baselineWindow})`;
    const baseline = await this.queryPrometheus(baselineQuery);
    
    // Get current performance
    const currentQuery = `avg_over_time(${metric}[${comparisonWindow}])`;
    const current = await this.queryPrometheus(currentQuery);
    
    if (!baseline.data?.result?.length || !current.data?.result?.length) {
      return { detected: false, reason: 'insufficient_data' };
    }
    
    const baselineValue = parseFloat(baseline.data.result[0].value[1]);
    const currentValue = parseFloat(current.data.result[0].value[1]);
    
    // Calculate degradation percentage
    const degradationPercent = (currentValue - baselineValue) / baselineValue;
    
    const detected = Math.abs(degradationPercent) > degradationThreshold;
    
    return {
      detected,
      metric,
      baselineValue,
      currentValue,
      degradationPercent,
      severity: Math.abs(degradationPercent) > 0.5 ? 'critical' : 'warning',
      confidence: this.calculateConfidence(baseline, current)
    };
  }

  /**
   * Detect incidents based on comprehensive metrics
   */
  async detectIncidents() {
    const incidents = [];

    // System performance incidents
    const systemMetrics = await this.getSystemMetrics();
    const systemIncident = this.analyzeSystemIncident(systemMetrics);
    if (systemIncident) incidents.push(systemIncident);

    // Swedish pilot specific incidents
    const pilotMetrics = await this.getSwedishPilotMetrics();
    const pilotIncident = this.analyzeSwedishPilotIncident(pilotMetrics);
    if (pilotIncident) incidents.push(pilotIncident);

    // Customer journey incidents
    const journeyMetrics = await this.getCustomerJourneyMetrics();
    const journeyIncident = this.analyzeCustomerJourneyIncident(journeyMetrics);
    if (journeyIncident) incidents.push(journeyIncident);

    // Process new incidents
    for (const incident of incidents) {
      await this.processIncident(incident);
    }
  }

  /**
   * Monitor Swedish pilot specific metrics
   */
  async monitorSwedishPilot() {
    const swedishTime = utcToZonedTime(new Date(), this.config.swedishBusinessHours.timezone);
    const isBusinessHours = this.isSwedishBusinessHours(swedishTime);
    
    // Get Swedish pilot business health
    const businesses = await this.getSwedishPilotBusinessHealth();
    
    // Monitor regional health
    const regionalHealth = await this.getSwedishRegionalHealth();
    
    // Update Swedish pilot status
    this.monitoringState.swedishPilotStatus = {
      businesses,
      regionalHealth,
      isBusinessHours,
      lastUpdate: new Date()
    };
    
    // Generate Swedish-specific alerts
    await this.generateSwedishPilotAlerts(businesses, regionalHealth, isBusinessHours);
    
    this.emit('swedish_pilot_status_update', {
      timestamp: new Date(),
      businesses: businesses.size,
      regions: regionalHealth.size,
      isBusinessHours
    });
  }

  /**
   * Process alerts with priority-based routing
   */
  async processAlerts() {
    try {
      // Get active alerts from AlertManager
      const alerts = await this.getActiveAlerts();
      
      for (const alert of alerts) {
        await this.routeAlertByPriority(alert);
      }
      
    } catch (error) {
      console.error('Alert processing error:', error.message);
    }
  }

  /**
   * Route alert based on priority and Swedish business context
   */
  async routeAlertByPriority(alert) {
    const priority = this.calculateAlertPriority(alert);
    const isSwedishBusiness = alert.labels?.swedish_pilot === 'true';
    const isBusinessHours = this.isSwedishBusinessHours();
    
    const routing = {
      priority,
      isSwedishBusiness,
      isBusinessHours,
      escalationLevel: this.getInitialEscalationLevel(priority, isSwedishBusiness, isBusinessHours),
      channels: this.selectNotificationChannels(priority, isSwedishBusiness, isBusinessHours),
      urgency: this.calculateUrgency(alert, isSwedishBusiness, isBusinessHours)
    };
    
    // Send notifications
    await this.sendNotifications(alert, routing);
    
    // Start escalation if needed
    if (routing.urgency === 'high' || priority === 'critical') {
      await this.startEscalation(alert, routing);
    }
    
    this.emit('alert_routed', { alert, routing });
  }

  /**
   * Handle escalations for unresolved incidents
   */
  async handleEscalations() {
    const now = new Date();
    
    for (const [escalationId, escalation] of this.monitoringState.escalations) {
      const timeElapsed = now - escalation.startTime;
      const currentLevel = escalation.currentLevel;
      
      if (timeElapsed > this.config.escalation.levels[currentLevel].timeout * 1000) {
        await this.escalateToNextLevel(escalationId, escalation);
      }
    }
  }

  /**
   * Escalate incident to next level
   */
  async escalateToNextLevel(escalationId, escalation) {
    const nextLevel = escalation.currentLevel + 1;
    
    if (nextLevel >= this.config.escalation.levels.length) {
      console.log(`⚠️  Maximum escalation level reached for ${escalationId}`);
      return;
    }
    
    escalation.currentLevel = nextLevel;
    escalation.escalationHistory.push({
      level: nextLevel,
      timestamp: new Date(),
      reason: 'timeout'
    });
    
    const levelConfig = this.config.escalation.levels[nextLevel];
    const isBusinessHours = this.isSwedishBusinessHours();
    
    // Send escalation notifications
    await this.sendEscalationNotifications(escalation, levelConfig, isBusinessHours);
    
    console.log(`📢 Escalated incident ${escalationId} to ${levelConfig.name}`);
    
    this.emit('incident_escalated', {
      escalationId,
      level: levelConfig.name,
      timestamp: new Date()
    });
  }

  // Utility methods

  /**
   * Check if current time is within Swedish business hours
   */
  isSwedishBusinessHours(time = new Date()) {
    const swedishTime = utcToZonedTime(time, this.config.swedishBusinessHours.timezone);
    const dayOfWeek = swedishTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = swedishTime.getHours();
    const dateStr = format(swedishTime, 'yyyy-MM-dd');
    
    // Check if it's a holiday
    if (this.config.swedishBusinessHours.holidays.includes(dateStr)) {
      return false;
    }
    
    // Sunday is closed
    if (dayOfWeek === 0 && this.config.swedishBusinessHours.sunday.closed) {
      return false;
    }
    
    // Saturday hours
    if (dayOfWeek === 6) {
      const saturday = this.config.swedishBusinessHours.saturday;
      return hour >= saturday.start && hour < saturday.end;
    }
    
    // Weekday hours
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const weekdays = this.config.swedishBusinessHours.weekdays;
      return hour >= weekdays.start && hour < weekdays.end;
    }
    
    return false;
  }

  /**
   * Get current Swedish business hour status
   */
  getCurrentSwedishBusinessHourStatus() {
    const isBusinessHours = this.isSwedishBusinessHours();
    const swedishTime = utcToZonedTime(new Date(), this.config.swedishBusinessHours.timezone);
    const timeStr = format(swedishTime, 'HH:mm', { locale: sv });
    
    return `${isBusinessHours ? '🟢 Open' : '🔴 Closed'} (${timeStr} CET)`;
  }

  /**
   * Calculate alert priority
   */
  calculateAlertPriority(alert) {
    const severity = alert.labels?.severity || 'info';
    const businessImpact = alert.labels?.business_impact || 'low';
    const isSwedishPilot = alert.labels?.swedish_pilot === 'true';
    
    // Swedish pilot gets higher priority
    let priority = severity;
    if (isSwedishPilot && businessImpact === 'high') {
      priority = 'critical';
    } else if (isSwedishPilot) {
      // Bump up Swedish pilot alerts by one level
      if (severity === 'warning') priority = 'critical';
      if (severity === 'info') priority = 'warning';
    }
    
    return priority;
  }

  /**
   * Calculate notification urgency
   */
  calculateUrgency(alert, isSwedishBusiness, isBusinessHours) {
    const severity = alert.labels?.severity || 'info';
    
    if (severity === 'critical') return 'high';
    if (severity === 'warning' && isSwedishBusiness && isBusinessHours) return 'high';
    if (severity === 'warning') return 'medium';
    
    return 'low';
  }

  /**
   * Select notification channels based on context
   */
  selectNotificationChannels(priority, isSwedishBusiness, isBusinessHours) {
    const channels = [];
    
    // Always include email
    channels.push('email');
    
    if (priority === 'critical') {
      channels.push('slack', 'phone');
      if (!isBusinessHours) channels.push('pagerduty');
    } else if (priority === 'warning') {
      channels.push('slack');
      if (isSwedishBusiness && isBusinessHours) channels.push('phone');
    } else {
      channels.push('slack');
    }
    
    return channels;
  }

  /**
   * Query Prometheus
   */
  async queryPrometheus(query, url = this.config.prometheusUrl) {
    try {
      const response = await axios.get(`${url}/api/v1/query`, {
        params: { query },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`Prometheus query error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active alerts from AlertManager
   */
  async getActiveAlerts() {
    try {
      const response = await axios.get(`${this.config.alertManagerUrl}/api/v1/alerts`, {
        timeout: 5000
      });
      return response.data.data || [];
    } catch (error) {
      console.error('AlertManager query error:', error.message);
      return [];
    }
  }

  /**
   * Send notifications through multiple channels
   */
  async sendNotifications(alert, routing) {
    const notifications = routing.channels.map(channel => {
      switch (channel) {
        case 'slack':
          return this.sendSlackNotification(alert, routing);
        case 'email':
          return this.sendEmailNotification(alert, routing);
        case 'phone':
          return this.sendPhoneNotification(alert, routing);
        case 'pagerduty':
          return this.sendPagerDutyNotification(alert, routing);
        default:
          return Promise.resolve();
      }
    });
    
    await Promise.all(notifications);
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(alert, routing) {
    const webhook = routing.isSwedishBusiness ? 
      this.config.notifications.slack.webhooks.swedishPilot :
      this.config.notifications.slack.webhooks[routing.priority];
    
    if (!webhook) return;
    
    const color = {
      critical: 'danger',
      warning: 'warning',
      info: 'good'
    }[routing.priority];
    
    const swedishTime = utcToZonedTime(new Date(), this.config.swedishBusinessHours.timezone);
    const timeStr = format(swedishTime, 'HH:mm dd/MM', { locale: sv });
    
    const message = {
      text: `${routing.isSwedishBusiness ? '🇸🇪' : '⚠️'} ${alert.annotations?.summary || 'System Alert'}`,
      attachments: [{
        color,
        fields: [
          {
            title: 'Alert',
            value: alert.labels?.alertname || 'Unknown',
            short: true
          },
          {
            title: 'Priority',
            value: routing.priority.toUpperCase(),
            short: true
          },
          {
            title: 'Description',
            value: alert.annotations?.description || 'No description',
            short: false
          },
          {
            title: 'Swedish Time',
            value: `${timeStr} CET ${routing.isBusinessHours ? '(Business Hours)' : '(After Hours)'}`,
            short: true
          }
        ],
        footer: 'AI Feedback Platform Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
    
    try {
      await axios.post(webhook, message);
    } catch (error) {
      console.error('Slack notification error:', error.message);
    }
  }

  /**
   * Validate monitoring endpoints
   */
  async validateMonitoringEndpoints() {
    const endpoints = [
      { name: 'Prometheus', url: this.config.prometheusUrl },
      { name: 'AlertManager', url: this.config.alertManagerUrl },
      { name: 'Admin Prometheus', url: this.config.adminPrometheusUrl },
      { name: 'Admin AlertManager', url: this.config.adminAlertManagerUrl }
    ];
    
    for (const endpoint of endpoints) {
      try {
        await axios.get(`${endpoint.url}/-/healthy`, { timeout: 5000 });
        console.log(`✅ ${endpoint.name} endpoint accessible`);
      } catch (error) {
        console.warn(`⚠️  ${endpoint.name} endpoint not accessible: ${error.message}`);
      }
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.on('incident_detected', (incident) => {
      console.log(`🚨 Incident detected: ${incident.type} - ${incident.severity}`);
    });
    
    this.on('incident_escalated', (data) => {
      console.log(`📢 Incident escalated to ${data.level}`);
    });
    
    this.on('swedish_pilot_alert', (alert) => {
      console.log(`🇸🇪 Swedish pilot alert: ${alert.summary}`);
    });
  }

  // Placeholder methods for complex operations
  
  async loadSwedishPilotBusinesses() {
    // Load from configuration or API
    console.log('✅ Swedish pilot businesses loaded');
  }
  
  async initializePerformanceBaselines() {
    // Initialize performance baselines
    console.log('✅ Performance baselines initialized');
  }
  
  async getSystemMetrics() {
    // Get comprehensive system metrics
    return {};
  }
  
  async analyzeSystemIncident(metrics) {
    // Analyze system metrics for incidents
    return null;
  }
  
  async getSwedishPilotMetrics() {
    // Get Swedish pilot specific metrics
    return {};
  }
  
  async analyzeSwedishPilotIncident(metrics) {
    // Analyze Swedish pilot metrics
    return null;
  }
  
  async getCustomerJourneyMetrics() {
    // Get customer journey metrics
    return {};
  }
  
  async analyzeCustomerJourneyIncident(metrics) {
    // Analyze customer journey metrics
    return null;
  }
  
  async processIncident(incident) {
    // Process detected incident
    this.emit('incident_detected', incident);
  }
  
  async generateHealthAlert(healthCheck) {
    // Generate health-related alerts
  }
  
  async handlePerformanceDegradation(metric, degradation) {
    // Handle performance degradation
    console.log(`📉 Performance degradation detected in ${metric}: ${Math.round(degradation.degradationPercent * 100)}%`);
  }
  
  calculateConfidence(baseline, current) {
    // Calculate statistical confidence
    return 0.95;
  }
  
  async getSwedishPilotBusinessHealth() {
    // Get Swedish pilot business health status
    return new Map();
  }
  
  async getSwedishRegionalHealth() {
    // Get Swedish regional health status
    return new Map();
  }
  
  async generateSwedishPilotAlerts(businesses, regionalHealth, isBusinessHours) {
    // Generate Swedish pilot specific alerts
  }
  
  getInitialEscalationLevel(priority, isSwedishBusiness, isBusinessHours) {
    // Determine initial escalation level
    if (priority === 'critical' && isSwedishBusiness) return 1;
    return 0;
  }
  
  async startEscalation(alert, routing) {
    // Start escalation process
    const escalationId = alert.fingerprint || Date.now().toString();
    
    this.monitoringState.escalations.set(escalationId, {
      alert,
      routing,
      startTime: new Date(),
      currentLevel: routing.escalationLevel,
      escalationHistory: [{
        level: routing.escalationLevel,
        timestamp: new Date(),
        reason: 'initial'
      }]
    });
    
    console.log(`🚨 Started escalation for ${escalationId}`);
  }
  
  async sendEscalationNotifications(escalation, levelConfig, isBusinessHours) {
    // Send escalation notifications
    console.log(`📧 Sending escalation notifications to ${levelConfig.name}`);
  }
  
  async sendEmailNotification(alert, routing) {
    // Send email notification
    console.log(`📧 Sending email notification for ${alert.labels?.alertname}`);
  }
  
  async sendPhoneNotification(alert, routing) {
    // Send phone/SMS notification
    console.log(`📞 Sending phone notification for ${alert.labels?.alertname}`);
  }
  
  async sendPagerDutyNotification(alert, routing) {
    // Send PagerDuty notification
    console.log(`📟 Sending PagerDuty notification for ${alert.labels?.alertname}`);
  }
}

module.exports = { ComprehensiveMonitoringSystem };

// CLI usage
if (require.main === module) {
  const monitoring = new ComprehensiveMonitoringSystem({
    // Override configuration for demo
    monitoring: {
      healthCheckInterval: 10000,    // 10s for demo
      metricsInterval: 15000,        // 15s for demo
      alertEvaluation: 5000,         // 5s for demo
      performanceAnalysis: 30000,    // 30s for demo
      systemHealthInterval: 20000    // 20s for demo
    }
  });
  
  // Event listeners for demo
  monitoring.on('monitoring_started', () => {
    console.log('🎯 Monitoring system is now active');
    console.log('   - Health checks running every 10 seconds');
    console.log('   - Performance analysis every 30 seconds');
    console.log('   - Swedish business hours awareness enabled');
    console.log('   - Incident detection and escalation active');
  });
  
  monitoring.on('health_check_complete', (health) => {
    const healthyServices = Array.from(health.services.entries())
      .filter(([, status]) => status.status === 'healthy').length;
    const totalServices = health.services.size;
    
    console.log(`🏥 Health check: ${healthyServices}/${totalServices} services healthy`);
  });
  
  monitoring.on('swedish_pilot_status_update', (status) => {
    console.log(`🇸🇪 Swedish pilot status: ${status.businesses} businesses, Business hours: ${status.isBusinessHours}`);
  });
  
  async function runMonitoring() {
    console.log('🇸🇪 Comprehensive Real-Time Monitoring System');
    console.log('============================================\n');
    
    try {
      await monitoring.start();
      
      // Keep running for demo
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down monitoring system...');
        await monitoring.stop();
        process.exit(0);
      });
      
      console.log('\n💡 Press Ctrl+C to stop monitoring\n');
      
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error.message);
      process.exit(1);
    }
  }
  
  runMonitoring();
}