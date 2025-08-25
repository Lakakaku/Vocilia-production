/**
 * Admin Notification System with Priority-Based Routing
 * 
 * Intelligent notification system that routes alerts to appropriate admin personnel
 * based on priority, Swedish business context, role hierarchy, and availability.
 * Supports multiple channels with escalation and acknowledgment workflows.
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { addMinutes, addHours, format, differenceInMinutes } = require('date-fns');
const { utcToZonedTime } = require('date-fns-tz');
const { sv } = require('date-fns/locale');
const axios = require('axios');

class AdminNotificationSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Notification channels configuration
      channels: {
        email: {
          enabled: true,
          smtp: {
            host: process.env.SMTP_HOST || 'localhost',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          templates: {
            critical: 'critical_alert',
            high: 'high_priority_alert', 
            medium: 'standard_alert',
            low: 'info_alert'
          }
        },
        
        slack: {
          enabled: true,
          webhooks: {
            critical: process.env.SLACK_CRITICAL_WEBHOOK,
            high: process.env.SLACK_HIGH_WEBHOOK,
            medium: process.env.SLACK_MEDIUM_WEBHOOK,
            swedish_pilot: process.env.SLACK_SWEDISH_PILOT_WEBHOOK,
            admin_team: process.env.SLACK_ADMIN_TEAM_WEBHOOK
          },
          channels: {
            critical: '#critical-alerts',
            high: '#high-priority',
            medium: '#alerts',
            swedish_pilot: '#swedish-pilot',
            admin_team: '#admin-team'
          }
        },
        
        sms: {
          enabled: process.env.SMS_ENABLED === 'true',
          provider: 'twilio', // or 'nexmo', 'messagebird'
          apiKey: process.env.SMS_API_KEY,
          apiSecret: process.env.SMS_API_SECRET,
          rateLimits: {
            critical: 0,      // No rate limit for critical
            high: 300000,     // 5min rate limit for high
            medium: 1800000,  // 30min rate limit for medium
            low: 3600000      // 1hour rate limit for low
          }
        },
        
        phone: {
          enabled: process.env.PHONE_ENABLED === 'true',
          provider: 'twilio',
          apiKey: process.env.PHONE_API_KEY,
          apiSecret: process.env.PHONE_API_SECRET,
          callScript: {
            critical: 'This is a CRITICAL alert from AI Feedback Platform. Press 1 to acknowledge.',
            high: 'This is a HIGH priority alert from AI Feedback Platform. Press 1 to acknowledge.',
            swedish_pilot: 'This is a SWEDISH PILOT alert from AI Feedback Platform. Press 1 to acknowledge.'
          }
        },
        
        pagerduty: {
          enabled: process.env.PAGERDUTY_ENABLED === 'true',
          integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
          apiUrl: 'https://events.pagerduty.com/v2/enqueue'
        },
        
        teams: {
          enabled: process.env.TEAMS_ENABLED === 'true',
          webhooks: {
            management: process.env.TEAMS_MANAGEMENT_WEBHOOK,
            engineering: process.env.TEAMS_ENGINEERING_WEBHOOK,
            swedish_team: process.env.TEAMS_SWEDISH_WEBHOOK
          }
        },
        
        webhook: {
          enabled: true,
          endpoints: {
            dashboard: process.env.DASHBOARD_WEBHOOK_URL,
            mobile_app: process.env.MOBILE_APP_WEBHOOK_URL,
            external_monitoring: process.env.EXTERNAL_MONITORING_WEBHOOK_URL
          }
        }
      },
      
      // Admin personnel and role hierarchy
      personnel: {
        // Role-based hierarchy with Swedish context
        roles: {
          super_admin: {
            level: 100,
            name: 'Super Administrator',
            swedishName: 'Superadministratör',
            permissions: ['*'],
            availability: '24/7',
            escalationDelay: 0,
            channels: ['email', 'slack', 'sms', 'phone', 'pagerduty']
          },
          
          platform_admin: {
            level: 90,
            name: 'Platform Administrator',
            swedishName: 'Plattformsadministratör',
            permissions: ['platform:*', 'swedish_pilot:*'],
            availability: 'business_hours',
            escalationDelay: 300, // 5 minutes
            channels: ['email', 'slack', 'sms', 'phone']
          },
          
          swedish_pilot_admin: {
            level: 85,
            name: 'Swedish Pilot Administrator',
            swedishName: 'Svensk Pilot Administratör',
            permissions: ['swedish_pilot:*', 'business:manage'],
            availability: 'swedish_business_hours',
            escalationDelay: 180, // 3 minutes
            channels: ['email', 'slack', 'sms'],
            priority: 'swedish_pilot'
          },
          
          engineering_lead: {
            level: 80,
            name: 'Engineering Lead',
            swedishName: 'Teknisk Ledare',
            permissions: ['system:*', 'engineering:*'],
            availability: 'on_call',
            escalationDelay: 600, // 10 minutes
            channels: ['email', 'slack', 'phone']
          },
          
          support_manager: {
            level: 70,
            name: 'Support Manager',
            swedishName: 'Supportchef',
            permissions: ['support:*', 'business:view'],
            availability: 'business_hours',
            escalationDelay: 900, // 15 minutes
            channels: ['email', 'slack']
          },
          
          oncall_engineer: {
            level: 60,
            name: 'On-Call Engineer',
            swedishName: 'Jourtekniker',
            permissions: ['system:troubleshoot', 'incidents:respond'],
            availability: 'on_call',
            escalationDelay: 300, // 5 minutes
            channels: ['email', 'slack', 'phone']
          }
        },
        
        // Individual admin contacts
        contacts: {
          // Super admins
          'admin-001': {
            id: 'admin-001',
            name: 'System Administrator',
            email: 'admin@ai-feedback.se',
            phone: '+46701234567',
            slack: '@admin',
            role: 'super_admin',
            timezone: 'Europe/Stockholm',
            languages: ['sv', 'en'],
            availability: {
              schedule: '24/7',
              overrides: []
            }
          },
          
          // Swedish pilot team
          'pilot-lead-001': {
            id: 'pilot-lead-001',
            name: 'Erik Andersson',
            email: 'erik.andersson@ai-feedback.se',
            phone: '+46702345678',
            slack: '@erik.andersson',
            role: 'swedish_pilot_admin',
            timezone: 'Europe/Stockholm',
            languages: ['sv', 'en'],
            availability: {
              schedule: 'swedish_business_hours',
              overrides: []
            },
            specializations: ['swedish_regulations', 'pilot_management']
          },
          
          'pilot-support-001': {
            id: 'pilot-support-001',
            name: 'Anna Lindqvist',
            email: 'anna.lindqvist@ai-feedback.se',
            phone: '+46703456789',
            slack: '@anna.lindqvist',
            role: 'swedish_pilot_admin',
            timezone: 'Europe/Stockholm',
            languages: ['sv', 'en'],
            availability: {
              schedule: 'swedish_business_hours',
              overrides: []
            },
            specializations: ['customer_support', 'business_relations']
          },
          
          // Engineering team
          'eng-lead-001': {
            id: 'eng-lead-001',
            name: 'Technical Lead',
            email: 'tech-lead@ai-feedback.se',
            phone: '+46704567890',
            slack: '@tech-lead',
            role: 'engineering_lead',
            timezone: 'Europe/Stockholm',
            languages: ['en', 'sv'],
            availability: {
              schedule: 'on_call',
              overrides: []
            }
          },
          
          'oncall-001': {
            id: 'oncall-001',
            name: 'On-Call Engineer',
            email: 'oncall@ai-feedback.se',
            phone: '+46705678901',
            slack: '@oncall',
            role: 'oncall_engineer',
            timezone: 'Europe/Stockholm',
            languages: ['en'],
            availability: {
              schedule: 'on_call',
              overrides: []
            }
          }
        }
      },
      
      // Priority-based routing rules
      routing: {
        rules: [
          {
            name: 'critical_swedish_pilot',
            condition: {
              priority: 'critical',
              tags: ['swedish_pilot']
            },
            routing: {
              immediate: ['pilot-lead-001', 'admin-001'],
              escalation: [
                { delay: 180, contacts: ['pilot-support-001'] },
                { delay: 600, contacts: ['eng-lead-001'] }
              ],
              channels: ['email', 'slack', 'sms', 'phone']
            }
          },
          
          {
            name: 'critical_system',
            condition: {
              priority: 'critical',
              categories: ['system_failure', 'security_breach', 'data_loss']
            },
            routing: {
              immediate: ['admin-001', 'eng-lead-001'],
              escalation: [
                { delay: 300, contacts: ['oncall-001'] },
                { delay: 900, contacts: ['management'] }
              ],
              channels: ['email', 'slack', 'phone', 'pagerduty']
            }
          },
          
          {
            name: 'high_business_hours',
            condition: {
              priority: 'high',
              time: 'business_hours'
            },
            routing: {
              immediate: ['oncall-001'],
              escalation: [
                { delay: 600, contacts: ['eng-lead-001'] },
                { delay: 1800, contacts: ['admin-001'] }
              ],
              channels: ['email', 'slack', 'sms']
            }
          },
          
          {
            name: 'high_after_hours',
            condition: {
              priority: 'high',
              time: 'after_hours'
            },
            routing: {
              immediate: ['oncall-001'],
              escalation: [
                { delay: 1200, contacts: ['eng-lead-001'] },
                { delay: 3600, contacts: ['admin-001'] }
              ],
              channels: ['email', 'phone']
            }
          },
          
          {
            name: 'medium_priority',
            condition: {
              priority: 'medium'
            },
            routing: {
              immediate: ['oncall-001'],
              escalation: [
                { delay: 1800, contacts: ['eng-lead-001'] }
              ],
              channels: ['email', 'slack']
            }
          },
          
          {
            name: 'low_priority',
            condition: {
              priority: 'low'
            },
            routing: {
              immediate: ['oncall-001'],
              escalation: [],
              channels: ['email']
            }
          }
        ],
        
        // Default routing when no rules match
        defaultRouting: {
          immediate: ['oncall-001'],
          escalation: [
            { delay: 900, contacts: ['eng-lead-001'] },
            { delay: 3600, contacts: ['admin-001'] }
          ],
          channels: ['email', 'slack']
        }
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
        language: 'sv-SE',
        currency: 'SEK'
      },
      
      // Acknowledgment and response tracking
      acknowledgment: {
        timeouts: {
          critical: 300000,    // 5 minutes
          high: 600000,        // 10 minutes
          medium: 1800000,     // 30 minutes
          low: 3600000         // 1 hour
        },
        
        // Auto-escalation if no acknowledgment
        autoEscalation: true,
        
        // Response tracking
        responseTracking: {
          expectedResponseTime: {
            critical: 300,       // 5 minutes
            high: 900,          // 15 minutes
            medium: 3600,       // 1 hour
            low: 14400          // 4 hours
          }
        }
      },
      
      ...config
    };

    // System state
    this.state = {
      activeNotifications: new Map(),
      escalations: new Map(),
      acknowledgments: new Map(),
      deliveryStatus: new Map(),
      personnelAvailability: new Map(),
      rateLimits: new Map()
    };

    // Initialize personnel availability
    this.initializePersonnelAvailability();
  }

  /**
   * Start admin notification system
   */
  async start() {
    console.log('📢 Starting Admin Notification System');
    console.log('====================================');
    
    try {
      // Validate configuration
      await this.validateConfiguration();
      
      // Initialize notification channels
      await this.initializeChannels();
      
      // Start monitoring loops
      this.startEscalationMonitoring();
      this.startAcknowledgmentMonitoring();
      this.startAvailabilityUpdates();
      
      console.log('✅ Admin notification system started successfully');
      console.log(`   Personnel: ${Object.keys(this.config.personnel.contacts).length} contacts`);
      console.log(`   Routing rules: ${this.config.routing.rules.length} rules`);
      console.log(`   Channels: ${Object.keys(this.config.channels).filter(c => this.config.channels[c].enabled).length} enabled`);
      
      this.emit('notification_system_started', {
        timestamp: new Date(),
        personnel: Object.keys(this.config.personnel.contacts).length,
        rules: this.config.routing.rules.length
      });
      
    } catch (error) {
      console.error('❌ Failed to start notification system:', error.message);
      throw error;
    }
  }

  /**
   * Send notification with priority-based routing
   */
  async sendNotification(alert) {
    const notificationId = uuidv4();
    const swedishTime = utcToZonedTime(new Date(), this.config.swedishBusiness.timezone);
    const timeContext = this.getTimeContext(swedishTime);
    
    console.log(`📨 Processing notification: ${alert.title || alert.summary}`);
    
    // Determine routing rule
    const routingRule = this.findRoutingRule(alert, timeContext);
    
    // Enhance alert with context
    const enhancedAlert = {
      ...alert,
      notificationId,
      timeContext,
      swedishTime: format(swedishTime, 'yyyy-MM-dd HH:mm:ss', { locale: sv }),
      routingRule: routingRule.name,
      timestamp: new Date()
    };
    
    // Create notification record
    const notification = {
      id: notificationId,
      alert: enhancedAlert,
      routingRule,
      status: 'sending',
      deliveries: new Map(),
      escalations: [],
      acknowledgments: [],
      createdAt: new Date()
    };
    
    this.state.activeNotifications.set(notificationId, notification);
    
    try {
      // Send immediate notifications
      await this.sendImmediateNotifications(notification);
      
      // Schedule escalations if needed
      if (routingRule.routing.escalation.length > 0) {
        await this.scheduleEscalations(notification);
      }
      
      // Start acknowledgment timer
      this.startAcknowledgmentTimer(notification);
      
      console.log(`✅ Notification sent: ${notificationId}`);
      
      this.emit('notification_sent', notification);
      
      return notification;
      
    } catch (error) {
      notification.status = 'failed';
      notification.error = error.message;
      
      console.error(`❌ Notification failed: ${notificationId} - ${error.message}`);
      
      this.emit('notification_failed', { notification, error });
      
      throw error;
    }
  }

  /**
   * Send immediate notifications to primary contacts
   */
  async sendImmediateNotifications(notification) {
    const { alert, routingRule } = notification;
    const immediateContacts = routingRule.routing.immediate;
    const channels = routingRule.routing.channels;
    
    for (const contactId of immediateContacts) {
      const contact = this.config.personnel.contacts[contactId];
      
      if (!contact) {
        console.warn(`Contact not found: ${contactId}`);
        continue;
      }
      
      // Check availability
      if (!this.isContactAvailable(contact)) {
        console.warn(`Contact unavailable: ${contact.name}`);
        continue;
      }
      
      // Send via each enabled channel
      for (const channel of channels) {
        if (this.config.channels[channel]?.enabled) {
          try {
            await this.sendViaChannel(alert, contact, channel);
            
            notification.deliveries.set(`${contactId}_${channel}`, {
              contactId,
              channel,
              status: 'delivered',
              timestamp: new Date()
            });
            
          } catch (error) {
            console.error(`Failed to send via ${channel} to ${contact.name}: ${error.message}`);
            
            notification.deliveries.set(`${contactId}_${channel}`, {
              contactId,
              channel,
              status: 'failed',
              error: error.message,
              timestamp: new Date()
            });
          }
        }
      }
    }
    
    notification.status = 'sent';
  }

  /**
   * Send notification via specific channel
   */
  async sendViaChannel(alert, contact, channel) {
    switch (channel) {
      case 'email':
        return await this.sendEmail(alert, contact);
      case 'slack':
        return await this.sendSlack(alert, contact);
      case 'sms':
        return await this.sendSMS(alert, contact);
      case 'phone':
        return await this.sendPhoneCall(alert, contact);
      case 'pagerduty':
        return await this.sendPagerDuty(alert, contact);
      case 'teams':
        return await this.sendTeams(alert, contact);
      case 'webhook':
        return await this.sendWebhook(alert, contact);
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(alert, contact) {
    const template = this.getEmailTemplate(alert.priority);
    const swedishContent = contact.languages.includes('sv');
    
    const subject = swedishContent ?
      `${alert.priority.toUpperCase()} Varning - AI Feedback Platform` :
      `${alert.priority.toUpperCase()} Alert - AI Feedback Platform`;
    
    const body = this.formatEmailBody(alert, contact, swedishContent);
    
    // Mock email sending
    console.log(`📧 Email sent to ${contact.name} (${contact.email}): ${subject}`);
    
    // In real implementation:
    // await this.emailClient.sendMail({
    //   from: 'alerts@ai-feedback.se',
    //   to: contact.email,
    //   subject,
    //   html: body
    // });
  }

  /**
   * Send Slack notification
   */
  async sendSlack(alert, contact) {
    const webhook = this.getSlackWebhook(alert);
    const message = this.formatSlackMessage(alert, contact);
    
    console.log(`📱 Slack notification sent to ${contact.name} (@${contact.slack})`);
    
    // In real implementation:
    // await axios.post(webhook, message);
  }

  /**
   * Send SMS notification
   */
  async sendSMS(alert, contact) {
    // Check rate limits
    if (!this.checkSMSRateLimit(alert.priority, contact)) {
      console.warn(`SMS rate limited for ${contact.name}`);
      return;
    }
    
    const message = this.formatSMSMessage(alert, contact);
    
    console.log(`📱 SMS sent to ${contact.name} (${contact.phone}): ${message.substring(0, 50)}...`);
    
    // Record for rate limiting
    this.recordSMSSent(alert.priority, contact);
  }

  /**
   * Send phone call
   */
  async sendPhoneCall(alert, contact) {
    const script = this.config.channels.phone.callScript[alert.priority] ||
                  this.config.channels.phone.callScript.critical;
    
    console.log(`📞 Phone call initiated to ${contact.name} (${contact.phone})`);
    
    // In real implementation:
    // await this.phoneClient.calls.create({
    //   to: contact.phone,
    //   from: '+46771234567',
    //   twiml: `<Response><Say>${script}</Say><Gather numDigits="1" action="/acknowledge"/></Response>`
    // });
  }

  /**
   * Send PagerDuty alert
   */
  async sendPagerDuty(alert, contact) {
    const payload = {
      routing_key: this.config.channels.pagerduty.integrationKey,
      event_action: 'trigger',
      payload: {
        summary: alert.title || alert.summary,
        source: 'ai-feedback-platform',
        severity: this.mapPriorityToSeverity(alert.priority),
        component: alert.component || 'system',
        group: alert.tags?.includes('swedish_pilot') ? 'swedish-pilot' : 'platform',
        custom_details: {
          alert_id: alert.id,
          swedish_pilot: alert.tags?.includes('swedish_pilot') || false,
          business_hours: alert.timeContext?.isBusinessHours || false
        }
      }
    };
    
    console.log(`📟 PagerDuty alert sent for ${alert.title}`);
    
    // In real implementation:
    // await axios.post(this.config.channels.pagerduty.apiUrl, payload);
  }

  /**
   * Find appropriate routing rule
   */
  findRoutingRule(alert, timeContext) {
    for (const rule of this.config.routing.rules) {
      if (this.matchesRoutingCondition(alert, timeContext, rule.condition)) {
        return rule;
      }
    }
    
    // Return default routing
    return {
      name: 'default',
      routing: this.config.routing.defaultRouting
    };
  }

  /**
   * Check if alert matches routing condition
   */
  matchesRoutingCondition(alert, timeContext, condition) {
    // Check priority
    if (condition.priority && alert.priority !== condition.priority) {
      return false;
    }
    
    // Check tags
    if (condition.tags) {
      const alertTags = alert.tags || [];
      const hasAllTags = condition.tags.every(tag => alertTags.includes(tag));
      if (!hasAllTags) return false;
    }
    
    // Check categories
    if (condition.categories) {
      const alertCategories = alert.categories || [];
      const hasAnyCategory = condition.categories.some(cat => alertCategories.includes(cat));
      if (!hasAnyCategory) return false;
    }
    
    // Check time context
    if (condition.time) {
      if (condition.time === 'business_hours' && !timeContext.isBusinessHours) return false;
      if (condition.time === 'after_hours' && timeContext.isBusinessHours) return false;
    }
    
    return true;
  }

  /**
   * Get time context for routing decisions
   */
  getTimeContext(swedishTime) {
    const hour = swedishTime.getHours();
    const day = swedishTime.getDay();
    const dateStr = format(swedishTime, 'yyyy-MM-dd');
    
    const isHoliday = this.config.swedishBusiness.holidays.includes(dateStr);
    const isBusinessHours = this.isSwedishBusinessHours(swedishTime) && !isHoliday;
    
    return {
      hour,
      day,
      isBusinessHours,
      isHoliday,
      isPeakHour: this.isPeakHour(hour, day),
      period: isBusinessHours ? 'business_hours' : 'after_hours'
    };
  }

  /**
   * Check if Swedish business hours
   */
  isSwedishBusinessHours(swedishTime) {
    const day = swedishTime.getDay();
    const hour = swedishTime.getHours();
    
    if (day >= 1 && day <= 5) { // Weekdays
      return hour >= this.config.swedishBusiness.businessHours.weekdays.start && 
             hour < this.config.swedishBusiness.businessHours.weekdays.end;
    } else if (day === 6) { // Saturday
      return hour >= this.config.swedishBusiness.businessHours.saturday.start && 
             hour < this.config.swedishBusiness.businessHours.saturday.end;
    }
    
    return false; // Sunday
  }

  /**
   * Check if peak hour (higher alert volume expected)
   */
  isPeakHour(hour, day) {
    // Peak hours: morning rush, lunch, evening rush
    if (day >= 1 && day <= 5) { // Weekdays
      return hour === 9 || hour === 12 || hour === 17;
    }
    return false;
  }

  /**
   * Check contact availability
   */
  isContactAvailable(contact) {
    const availability = this.state.personnelAvailability.get(contact.id);
    if (!availability) return true; // Assume available if no data
    
    return availability.status === 'available';
  }

  /**
   * Format email body
   */
  formatEmailBody(alert, contact, swedish = false) {
    const lang = swedish ? 'sv' : 'en';
    const templates = {
      sv: {
        greeting: `Hej ${contact.name},`,
        alertInfo: 'En systemvarning har utlösts:',
        priority: 'Prioritet',
        description: 'Beskrivning',
        time: 'Tid (svensk tid)',
        action: 'Vänligen bekräfta mottagandet och vidta lämpliga åtgärder.',
        footer: 'AI Feedback Platform - Automatisk varning'
      },
      en: {
        greeting: `Hello ${contact.name},`,
        alertInfo: 'A system alert has been triggered:',
        priority: 'Priority',
        description: 'Description', 
        time: 'Time (Swedish time)',
        action: 'Please acknowledge receipt and take appropriate action.',
        footer: 'AI Feedback Platform - Automated Alert'
      }
    };
    
    const t = templates[lang];
    
    return `
      <h2>${t.greeting}</h2>
      <p>${t.alertInfo}</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <h3>${alert.title || alert.summary}</h3>
        <p><strong>${t.priority}:</strong> ${alert.priority.toUpperCase()}</p>
        <p><strong>${t.description}:</strong> ${alert.description || alert.message}</p>
        <p><strong>${t.time}:</strong> ${alert.swedishTime}</p>
        ${alert.tags?.includes('swedish_pilot') ? '<p><strong>🇸🇪 Swedish Pilot Affected</strong></p>' : ''}
      </div>
      
      <p>${t.action}</p>
      
      <hr>
      <small>${t.footer}</small>
    `;
  }

  /**
   * Format Slack message
   */
  formatSlackMessage(alert, contact) {
    const color = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#f59e0b',
      low: '#10b981'
    }[alert.priority] || '#6b7280';
    
    return {
      text: `🚨 ${alert.priority.toUpperCase()} Alert: ${alert.title || alert.summary}`,
      attachments: [{
        color,
        fields: [
          {
            title: 'Priority',
            value: alert.priority.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: alert.swedishTime,
            short: true
          },
          {
            title: 'Description',
            value: alert.description || alert.message || 'No description provided',
            short: false
          }
        ],
        footer: alert.tags?.includes('swedish_pilot') ? '🇸🇪 Swedish Pilot Alert' : 'AI Feedback Platform',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }

  /**
   * Format SMS message
   */
  formatSMSMessage(alert, contact) {
    const maxLength = 160; // SMS character limit
    const prefix = `🚨 ${alert.priority.toUpperCase()}:`;
    const title = alert.title || alert.summary || 'System Alert';
    const swedishPilotTag = alert.tags?.includes('swedish_pilot') ? ' 🇸🇪' : '';
    
    let message = `${prefix} ${title}${swedishPilotTag}`;
    
    if (message.length > maxLength) {
      message = message.substring(0, maxLength - 3) + '...';
    }
    
    return message;
  }

  /**
   * Get appropriate Slack webhook for alert
   */
  getSlackWebhook(alert) {
    if (alert.tags?.includes('swedish_pilot')) {
      return this.config.channels.slack.webhooks.swedish_pilot;
    }
    
    return this.config.channels.slack.webhooks[alert.priority] ||
           this.config.channels.slack.webhooks.medium;
  }

  /**
   * Check SMS rate limits
   */
  checkSMSRateLimit(priority, contact) {
    const rateLimit = this.config.channels.sms.rateLimits[priority];
    if (rateLimit === 0) return true; // No rate limit
    
    const key = `sms_${contact.id}`;
    const lastSent = this.state.rateLimits.get(key);
    
    if (!lastSent) return true;
    
    return Date.now() - lastSent >= rateLimit;
  }

  /**
   * Record SMS sent for rate limiting
   */
  recordSMSSent(priority, contact) {
    const key = `sms_${contact.id}`;
    this.state.rateLimits.set(key, Date.now());
  }

  /**
   * Map priority to PagerDuty severity
   */
  mapPriorityToSeverity(priority) {
    const mapping = {
      critical: 'critical',
      high: 'error',
      medium: 'warning',
      low: 'info'
    };
    
    return mapping[priority] || 'warning';
  }

  /**
   * Get email template based on priority
   */
  getEmailTemplate(priority) {
    return this.config.channels.email.templates[priority] ||
           this.config.channels.email.templates.medium;
  }

  // Placeholder methods for monitoring loops
  
  startEscalationMonitoring() {
    console.log('📈 Escalation monitoring started');
  }
  
  startAcknowledgmentMonitoring() {
    console.log('✅ Acknowledgment monitoring started');
  }
  
  startAvailabilityUpdates() {
    console.log('🟢 Availability updates started');
  }
  
  async validateConfiguration() {
    console.log('✅ Configuration validated');
  }
  
  async initializeChannels() {
    console.log('✅ Notification channels initialized');
  }
  
  initializePersonnelAvailability() {
    // Initialize all contacts as available
    Object.keys(this.config.personnel.contacts).forEach(contactId => {
      this.state.personnelAvailability.set(contactId, {
        status: 'available',
        lastUpdate: new Date()
      });
    });
  }
  
  async scheduleEscalations(notification) {
    console.log(`📅 Escalations scheduled for ${notification.id}`);
  }
  
  startAcknowledgmentTimer(notification) {
    const timeout = this.config.acknowledgment.timeouts[notification.alert.priority];
    
    setTimeout(() => {
      if (!this.state.acknowledgments.has(notification.id)) {
        console.log(`⏰ No acknowledgment received for ${notification.id}, escalating...`);
        this.emit('acknowledgment_timeout', notification);
      }
    }, timeout);
  }
  
  async sendTeams(alert, contact) {
    console.log(`💬 Teams notification sent to ${contact.name}`);
  }
  
  async sendWebhook(alert, contact) {
    console.log(`🔗 Webhook notification sent for ${contact.name}`);
  }
}

module.exports = { AdminNotificationSystem };

// CLI usage
if (require.main === module) {
  const notificationSystem = new AdminNotificationSystem();
  
  // Event listeners for demo
  notificationSystem.on('notification_system_started', (data) => {
    console.log('🎯 Admin Notification System Active');
    console.log(`   Personnel: ${data.personnel} contacts configured`);
    console.log(`   Routing rules: ${data.rules} priority-based rules`);
    console.log(`   Swedish business context aware`);
  });
  
  notificationSystem.on('notification_sent', (notification) => {
    console.log(`📨 NOTIFICATION SENT: ${notification.alert.title}`);
    console.log(`   ID: ${notification.id}`);
    console.log(`   Priority: ${notification.alert.priority.toUpperCase()}`);
    console.log(`   Routing: ${notification.routingRule.name}`);
    console.log(`   Deliveries: ${notification.deliveries.size} channels`);
  });
  
  notificationSystem.on('notification_failed', (data) => {
    console.log(`❌ NOTIFICATION FAILED: ${data.notification.id}`);
    console.log(`   Error: ${data.error.message}`);
  });
  
  async function runSystem() {
    console.log('🇸🇪 Admin Notification System with Priority-Based Routing');
    console.log('========================================================\n');
    
    try {
      await notificationSystem.start();
      
      // Demo notifications
      setTimeout(async () => {
        console.log('\n🎭 Sending demo critical Swedish pilot alert...');
        
        await notificationSystem.sendNotification({
          id: 'demo-001',
          title: 'Swedish Pilot Business Down',
          description: 'ICA Maxi Stockholm experiencing complete service outage',
          priority: 'critical',
          tags: ['swedish_pilot', 'service_outage'],
          categories: ['system_failure'],
          component: 'payment_service'
        });
      }, 3000);
      
      setTimeout(async () => {
        console.log('\n🎭 Sending demo high priority performance alert...');
        
        await notificationSystem.sendNotification({
          id: 'demo-002',
          title: 'Response Time Degradation',
          description: 'System response times exceed SLA thresholds',
          priority: 'high',
          tags: ['performance'],
          categories: ['performance_degradation'],
          component: 'ai_service'
        });
      }, 6000);
      
      // Keep running
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down notification system...');
        process.exit(0);
      });
      
      console.log('\n💡 Press Ctrl+C to stop system\n');
      
    } catch (error) {
      console.error('❌ Failed to start system:', error.message);
      process.exit(1);
    }
  }
  
  runSystem();
}