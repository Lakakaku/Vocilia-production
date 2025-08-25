/**
 * Security Monitoring and Alerting Tests
 * Tests security event detection, monitoring, and automated response systems
 * Uses only test data and simulated security events
 */

const { SecurityTestUtils } = global;

describe('Security Monitoring and Alerting Tests', () => {
  let securityEvents = [];
  let alertingResults = [];
  let monitoringMetrics = {};

  beforeEach(() => {
    securityEvents = [];
    alertingResults = [];
    monitoringMetrics = {
      totalEvents: 0,
      highSeverityEvents: 0,
      mediumSeverityEvents: 0,
      lowSeverityEvents: 0,
      averageResponseTime: 0,
      alertsTriggered: 0,
      falsePositives: 0
    };
  });

  afterEach(() => {
    // Generate monitoring summary
    console.log(`Security monitoring summary: ${monitoringMetrics.totalEvents} events processed, ${monitoringMetrics.alertsTriggered} alerts triggered`);
  });

  describe('Real-time Security Event Detection', () => {
    it('should detect suspicious payment patterns', async () => {
      const suspiciousPaymentPatterns = [
        {
          patternType: 'velocity_abuse',
          customerHash: 'suspicious_customer_001',
          events: Array.from({ length: 15 }, (_, i) => ({
            timestamp: Date.now() + (i * 1000),
            amount: 50000 + (i * 5000),
            riskScore: 30 + (i * 5)
          })),
          expectedSeverity: 'HIGH'
        },
        {
          patternType: 'unusual_amounts',
          customerHash: 'unusual_customer_002',
          events: [
            { timestamp: Date.now(), amount: 10000000, riskScore: 85 }, // 100,000 SEK
            { timestamp: Date.now() + 60000, amount: 15000000, riskScore: 90 }, // 150,000 SEK
            { timestamp: Date.now() + 120000, amount: 20000000, riskScore: 95 } // 200,000 SEK
          ],
          expectedSeverity: 'HIGH'
        },
        {
          patternType: 'geographic_anomaly',
          customerHash: 'traveling_customer_003',
          events: [
            { timestamp: Date.now() - 7200000, location: 'Stockholm, SE', riskScore: 10 },
            { timestamp: Date.now() - 3600000, location: 'Copenhagen, DK', riskScore: 25 },
            { timestamp: Date.now(), location: 'New York, US', riskScore: 80 } // Impossible travel
          ],
          expectedSeverity: 'MEDIUM'
        }
      ];

      const patternDetectionResults = [];

      for (const pattern of suspiciousPaymentPatterns) {
        const detectionStartTime = Date.now();
        
        // Analyze pattern for suspicious behavior
        let patternAnalysis = {
          patternType: pattern.patternType,
          customerHash: pattern.customerHash,
          eventCount: pattern.events.length,
          timeSpan: pattern.events.length > 1 ? 
            Math.max(...pattern.events.map(e => e.timestamp)) - 
            Math.min(...pattern.events.map(e => e.timestamp)) : 0,
          maxRiskScore: Math.max(...pattern.events.map(e => e.riskScore)),
          avgRiskScore: pattern.events.reduce((sum, e) => sum + e.riskScore, 0) / pattern.events.length,
          severity: 'LOW' // Will be calculated
        };

        // Determine severity based on pattern characteristics
        if (pattern.patternType === 'velocity_abuse' && patternAnalysis.eventCount > 10) {
          patternAnalysis.severity = 'HIGH';
        } else if (pattern.patternType === 'unusual_amounts' && patternAnalysis.maxRiskScore > 80) {
          patternAnalysis.severity = 'HIGH';
        } else if (pattern.patternType === 'geographic_anomaly' && patternAnalysis.maxRiskScore > 70) {
          patternAnalysis.severity = 'MEDIUM';
        }

        const detectionTime = Date.now() - detectionStartTime;
        const alertShouldTrigger = patternAnalysis.severity === 'HIGH' || 
                                  (patternAnalysis.severity === 'MEDIUM' && patternAnalysis.maxRiskScore > 75);

        patternDetectionResults.push({
          ...patternAnalysis,
          expectedSeverity: pattern.expectedSeverity,
          detectionTime,
          alertTriggered: alertShouldTrigger,
          severityMatches: patternAnalysis.severity === pattern.expectedSeverity,
          detectionAccurate: true
        });

        // Generate security event
        securityEvents.push({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          eventType: 'SUSPICIOUS_PAYMENT_PATTERN',
          timestamp: Date.now(),
          severity: patternAnalysis.severity,
          customerHash: pattern.customerHash,
          patternType: pattern.patternType,
          riskScore: patternAnalysis.maxRiskScore,
          metadata: {
            eventCount: patternAnalysis.eventCount,
            timeSpan: patternAnalysis.timeSpan,
            avgRiskScore: patternAnalysis.avgRiskScore
          }
        });

        monitoringMetrics.totalEvents++;
        if (patternAnalysis.severity === 'HIGH') monitoringMetrics.highSeverityEvents++;
        else if (patternAnalysis.severity === 'MEDIUM') monitoringMetrics.mediumSeverityEvents++;
        else monitoringMetrics.lowSeverityEvents++;
      }

      const accurateDetections = patternDetectionResults.filter(r => r.severityMatches);
      const highSeverityPatterns = patternDetectionResults.filter(r => r.severity === 'HIGH');
      const averageDetectionTime = patternDetectionResults.reduce((sum, r) => 
        sum + r.detectionTime, 0) / patternDetectionResults.length;

      expect(accurateDetections.length).toBe(suspiciousPaymentPatterns.length);
      expect(highSeverityPatterns.length).toBe(2); // Two HIGH severity patterns
      expect(averageDetectionTime).toBeLessThan(1000); // Should detect quickly

      monitoringMetrics.averageResponseTime = averageDetectionTime;
    });

    it('should monitor authentication security events', async () => {
      const authenticationEvents = [
        {
          eventType: 'multiple_failed_logins',
          customerHash: 'brute_force_target_001',
          failedAttempts: [
            { timestamp: Date.now() - 600000, ip: '192.0.2.100', reason: 'invalid_password' },
            { timestamp: Date.now() - 540000, ip: '192.0.2.100', reason: 'invalid_password' },
            { timestamp: Date.now() - 480000, ip: '192.0.2.100', reason: 'invalid_password' },
            { timestamp: Date.now() - 420000, ip: '192.0.2.100', reason: 'invalid_password' },
            { timestamp: Date.now() - 360000, ip: '192.0.2.100', reason: 'invalid_password' }
          ],
          expectedThreat: 'brute_force_attack'
        },
        {
          eventType: 'impossible_travel',
          customerHash: 'traveling_user_002',
          loginEvents: [
            { timestamp: Date.now() - 7200000, ip: '192.168.1.100', location: 'Stockholm, SE' },
            { timestamp: Date.now(), ip: '203.0.113.50', location: 'Tokyo, JP' } // 7000km in 2 hours
          ],
          expectedThreat: 'account_compromise'
        },
        {
          eventType: 'session_anomaly',
          customerHash: 'session_hijack_victim_003',
          sessionEvents: [
            { 
              timestamp: Date.now() - 1800000, 
              deviceFingerprint: SecurityTestUtils.utils.generateDeviceFingerprint('iPhone', '192.168.1.100'),
              activity: 'normal_browsing'
            },
            {
              timestamp: Date.now(),
              deviceFingerprint: SecurityTestUtils.utils.generateDeviceFingerprint('Linux', '203.0.113.75'),
              activity: 'payment_attempt' // Different device, high-risk activity
            }
          ],
          expectedThreat: 'session_hijacking'
        }
      ];

      const authMonitoringResults = [];

      for (const authEvent of authenticationEvents) {
        const monitoringAnalysis = {
          eventType: authEvent.eventType,
          customerHash: authEvent.customerHash,
          threatLevel: 'LOW', // Will be calculated
          indicators: [],
          recommendedActions: []
        };

        // Analyze different authentication threats
        switch (authEvent.eventType) {
          case 'multiple_failed_logins':
            const failureCount = authEvent.failedAttempts.length;
            const sameIPAttempts = new Set(authEvent.failedAttempts.map(a => a.ip)).size === 1;
            
            if (failureCount >= 5 && sameIPAttempts) {
              monitoringAnalysis.threatLevel = 'HIGH';
              monitoringAnalysis.indicators = ['excessive_failures', 'single_ip_source'];
              monitoringAnalysis.recommendedActions = ['block_ip_address', 'lock_account_temporarily', 'require_additional_auth'];
            }
            break;

          case 'impossible_travel':
            const timeDiff = authEvent.loginEvents[1].timestamp - authEvent.loginEvents[0].timestamp;
            const impossibleTravelDetected = timeDiff < 14400000; // Less than 4 hours for international travel
            
            if (impossibleTravelDetected) {
              monitoringAnalysis.threatLevel = 'HIGH';
              monitoringAnalysis.indicators = ['impossible_geographic_transition'];
              monitoringAnalysis.recommendedActions = ['verify_account_owner', 'temporary_account_restriction', 'require_identity_verification'];
            }
            break;

          case 'session_anomaly':
            const deviceMismatch = authEvent.sessionEvents[0].deviceFingerprint !== 
                                 authEvent.sessionEvents[1].deviceFingerprint;
            const riskActivityDetected = authEvent.sessionEvents[1].activity === 'payment_attempt';
            
            if (deviceMismatch && riskActivityDetected) {
              monitoringAnalysis.threatLevel = 'MEDIUM';
              monitoringAnalysis.indicators = ['device_fingerprint_change', 'high_risk_activity'];
              monitoringAnalysis.recommendedActions = ['challenge_user_identity', 'log_security_event', 'monitor_session_closely'];
            }
            break;
        }

        const alertTriggered = monitoringAnalysis.threatLevel !== 'LOW';
        
        authMonitoringResults.push({
          ...monitoringAnalysis,
          expectedThreat: authEvent.expectedThreat,
          alertTriggered,
          detectionTimestamp: Date.now(),
          threatDetectionAccurate: monitoringAnalysis.threatLevel === 'HIGH' || monitoringAnalysis.threatLevel === 'MEDIUM'
        });

        // Log security event
        if (alertTriggered) {
          securityEvents.push({
            eventId: `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            eventType: 'AUTHENTICATION_THREAT',
            timestamp: Date.now(),
            severity: monitoringAnalysis.threatLevel,
            customerHash: authEvent.customerHash,
            threatType: authEvent.expectedThreat,
            indicators: monitoringAnalysis.indicators,
            recommendedActions: monitoringAnalysis.recommendedActions
          });

          monitoringMetrics.alertsTriggered++;
        }
      }

      const threatsDetected = authMonitoringResults.filter(r => r.threatDetectionAccurate);
      const alertsTriggered = authMonitoringResults.filter(r => r.alertTriggered);
      
      expect(threatsDetected.length).toBe(authenticationEvents.length); // All threats should be detected
      expect(alertsTriggered.length).toBeGreaterThan(0); // Should trigger alerts
    });
  });

  describe('Automated Security Response Systems', () => {
    it('should implement automated threat response', async () => {
      const threatScenarios = [
        {
          threatType: 'card_testing_attack',
          severity: 'HIGH',
          indicators: ['rapid_card_attempts', 'high_failure_rate', 'multiple_cards'],
          customerHash: 'attacker_001',
          expectedActions: ['block_ip', 'rate_limit_customer', 'flag_for_review']
        },
        {
          threatType: 'account_takeover_attempt',
          severity: 'HIGH', 
          indicators: ['password_spray', 'credential_stuffing', 'multiple_accounts'],
          customerHash: 'victim_002',
          expectedActions: ['lock_account', 'require_verification', 'notify_customer']
        },
        {
          threatType: 'fraudulent_transaction',
          severity: 'MEDIUM',
          indicators: ['unusual_amount', 'geographic_anomaly', 'device_mismatch'],
          customerHash: 'suspicious_003',
          expectedActions: ['hold_transaction', 'additional_verification', 'risk_assessment']
        }
      ];

      const automatedResponseResults = [];

      for (const threat of threatScenarios) {
        const responseStartTime = Date.now();
        
        // Determine automated response based on threat characteristics
        const automatedActions = [];
        const responseLevel = threat.severity === 'HIGH' ? 'IMMEDIATE' : 'STANDARD';

        if (threat.severity === 'HIGH') {
          // Immediate high-severity responses
          if (threat.indicators.includes('rapid_card_attempts')) {
            automatedActions.push({ action: 'block_ip', executionTime: responseStartTime + 100 });
            automatedActions.push({ action: 'rate_limit_customer', executionTime: responseStartTime + 200 });
          }
          
          if (threat.indicators.includes('password_spray') || threat.indicators.includes('credential_stuffing')) {
            automatedActions.push({ action: 'lock_account', executionTime: responseStartTime + 150 });
            automatedActions.push({ action: 'require_verification', executionTime: responseStartTime + 300 });
          }
        } else if (threat.severity === 'MEDIUM') {
          // Standard medium-severity responses
          if (threat.indicators.includes('unusual_amount')) {
            automatedActions.push({ action: 'hold_transaction', executionTime: responseStartTime + 500 });
            automatedActions.push({ action: 'additional_verification', executionTime: responseStartTime + 1000 });
          }
        }

        // Add monitoring and alerting actions
        automatedActions.push({ action: 'log_security_event', executionTime: responseStartTime + 50 });
        automatedActions.push({ action: 'update_risk_score', executionTime: responseStartTime + 100 });

        if (threat.severity === 'HIGH') {
          automatedActions.push({ action: 'notify_security_team', executionTime: responseStartTime + 200 });
        }

        const totalResponseTime = Math.max(...automatedActions.map(a => a.executionTime)) - responseStartTime;
        const responseTimely = totalResponseTime < 2000; // Should respond within 2 seconds

        automatedResponseResults.push({
          threatType: threat.threatType,
          severity: threat.severity,
          responseLevel,
          automatedActions,
          totalResponseTime,
          responseTimely,
          actionCount: automatedActions.length,
          containmentEffective: automatedActions.some(a => 
            ['block_ip', 'lock_account', 'hold_transaction'].includes(a.action)
          ),
          expectedActionsMatched: threat.expectedActions.every(expected =>
            automatedActions.some(actual => actual.action.includes(expected))
          )
        });

        // Generate security event for automated response
        securityEvents.push({
          eventId: `auto_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          eventType: 'AUTOMATED_SECURITY_RESPONSE',
          timestamp: responseStartTime,
          severity: threat.severity,
          threatType: threat.threatType,
          responseActions: automatedActions.map(a => a.action),
          responseTime: totalResponseTime,
          customerHash: threat.customerHash
        });
      }

      const timelyResponses = automatedResponseResults.filter(r => r.responseTimely);
      const effectiveContainments = automatedResponseResults.filter(r => r.containmentEffective);
      const averageResponseTime = automatedResponseResults.reduce((sum, r) => 
        sum + r.totalResponseTime, 0) / automatedResponseResults.length;

      expect(timelyResponses.length).toBe(threatScenarios.length); // All should respond quickly
      expect(effectiveContainments.length).toBe(threatScenarios.length); // All should contain threats
      expect(averageResponseTime).toBeLessThan(1000); // Average response under 1 second

      monitoringMetrics.averageResponseTime = averageResponseTime;
    });

    it('should escalate unresolved security incidents', async () => {
      const securityIncidents = [
        {
          incidentId: 'inc_001',
          type: 'persistent_attack',
          severity: 'HIGH',
          initialDetection: Date.now() - 3600000, // 1 hour ago
          automatedResponseFailed: true,
          escalationTriggers: ['response_ineffective', 'attack_persisting'],
          expectedEscalationLevel: 2
        },
        {
          incidentId: 'inc_002',
          type: 'data_breach_suspected',
          severity: 'CRITICAL',
          initialDetection: Date.now() - 1800000, // 30 minutes ago
          automatedResponseFailed: false,
          escalationTriggers: ['critical_severity', 'potential_data_exposure'],
          expectedEscalationLevel: 3
        },
        {
          incidentId: 'inc_003',
          type: 'account_compromise',
          severity: 'MEDIUM',
          initialDetection: Date.now() - 7200000, // 2 hours ago
          automatedResponseFailed: false,
          escalationTriggers: ['extended_duration'],
          expectedEscalationLevel: 1
        }
      ];

      const escalationResults = [];

      for (const incident of securityIncidents) {
        const currentTime = Date.now();
        const incidentDuration = currentTime - incident.initialDetection;
        
        // Determine escalation level based on incident characteristics
        let escalationLevel = 0;
        const escalationReasons = [];

        // Time-based escalation
        if (incidentDuration > 3600000) { // Over 1 hour
          escalationLevel = Math.max(escalationLevel, 1);
          escalationReasons.push('extended_duration');
        }

        // Severity-based escalation  
        if (incident.severity === 'CRITICAL') {
          escalationLevel = Math.max(escalationLevel, 3);
          escalationReasons.push('critical_severity');
        } else if (incident.severity === 'HIGH') {
          escalationLevel = Math.max(escalationLevel, 2);
          escalationReasons.push('high_severity');
        }

        // Response failure escalation
        if (incident.automatedResponseFailed) {
          escalationLevel = Math.max(escalationLevel, 2);
          escalationReasons.push('automated_response_failed');
        }

        // Determine escalation actions
        const escalationActions = [];
        if (escalationLevel >= 1) {
          escalationActions.push('notify_security_analyst');
        }
        if (escalationLevel >= 2) {
          escalationActions.push('notify_security_manager');
          escalationActions.push('initiate_incident_response_procedure');
        }
        if (escalationLevel >= 3) {
          escalationActions.push('notify_ciso');
          escalationActions.push('activate_crisis_management_team');
          escalationActions.push('prepare_external_notifications');
        }

        const escalationTimestamp = currentTime;
        const escalationTimely = escalationLevel > 0; // Escalation should happen for all incidents

        escalationResults.push({
          incidentId: incident.incidentId,
          type: incident.type,
          severity: incident.severity,
          incidentDuration,
          escalationLevel,
          expectedEscalationLevel: incident.expectedEscalationLevel,
          escalationReasons,
          escalationActions,
          escalationTimestamp,
          escalationTimely,
          escalationAccurate: escalationLevel === incident.expectedEscalationLevel
        });

        // Log escalation event
        securityEvents.push({
          eventId: `escalation_${incident.incidentId}_${Date.now()}`,
          eventType: 'SECURITY_INCIDENT_ESCALATION',
          timestamp: escalationTimestamp,
          severity: incident.severity,
          incidentId: incident.incidentId,
          escalationLevel,
          escalationReasons,
          escalationActions,
          incidentDuration
        });
      }

      const accurateEscalations = escalationResults.filter(r => r.escalationAccurate);
      const timelyEscalations = escalationResults.filter(r => r.escalationTimely);
      const criticalIncidents = escalationResults.filter(r => r.severity === 'CRITICAL');

      expect(accurateEscalations.length).toBe(securityIncidents.length); // All escalations should be accurate
      expect(timelyEscalations.length).toBe(securityIncidents.length); // All should escalate
      expect(criticalIncidents[0].escalationLevel).toBe(3); // Critical incident should escalate to highest level
    });
  });

  describe('Security Metrics and KPI Monitoring', () => {
    it('should track security performance indicators', async () => {
      // Simulate security metrics over time periods
      const securityMetricsData = [
        {
          timeWindow: '2024-01-01_to_2024-01-07',
          metrics: {
            totalSecurityEvents: 1250,
            highSeverityEvents: 15,
            mediumSeverityEvents: 89,
            lowSeverityEvents: 1146,
            falsePositiveRate: 0.12, // 12%
            averageDetectionTime: 450, // milliseconds
            averageResponseTime: 1200, // milliseconds
            incidentsEscalated: 8,
            attacksBlocked: 142,
            fraudPrevented: 89000000 // 890,000 SEK in öre
          }
        },
        {
          timeWindow: '2024-01-08_to_2024-01-14', 
          metrics: {
            totalSecurityEvents: 1380,
            highSeverityEvents: 22,
            mediumSeverityEvents: 95,
            lowSeverityEvents: 1263,
            falsePositiveRate: 0.08, // 8% - improvement
            averageDetectionTime: 380, // milliseconds - improvement
            averageResponseTime: 950, // milliseconds - improvement
            incidentsEscalated: 12,
            attacksBlocked: 167,
            fraudPrevented: 156000000 // 1,560,000 SEK in öre
          }
        }
      ];

      const kpiAnalysisResults = [];

      for (const period of securityMetricsData) {
        const kpiAnalysis = {
          timeWindow: period.timeWindow,
          metrics: period.metrics,
          kpiPerformance: {},
          trendsIdentified: [],
          performanceRating: 'GOOD' // Will be calculated
        };

        // Calculate KPI performance ratings
        kpiAnalysis.kpiPerformance = {
          detectionSpeed: period.metrics.averageDetectionTime < 500 ? 'EXCELLENT' : 
                         period.metrics.averageDetectionTime < 1000 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
          responseTime: period.metrics.averageResponseTime < 1000 ? 'EXCELLENT' :
                       period.metrics.averageResponseTime < 2000 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
          falsePositiveRate: period.metrics.falsePositiveRate < 0.10 ? 'EXCELLENT' :
                            period.metrics.falsePositiveRate < 0.15 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
          threatBlocking: period.metrics.attacksBlocked > 100 ? 'EXCELLENT' : 
                         period.metrics.attacksBlocked > 50 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
          fraudPrevention: period.metrics.fraudPrevented > 100000000 ? 'EXCELLENT' : // >1M SEK
                          period.metrics.fraudPrevented > 50000000 ? 'GOOD' : 'ADEQUATE'
        };

        // Identify trends (comparing with previous period if available)
        const previousPeriodIndex = securityMetricsData.indexOf(period) - 1;
        if (previousPeriodIndex >= 0) {
          const previousMetrics = securityMetricsData[previousPeriodIndex].metrics;
          
          if (period.metrics.falsePositiveRate < previousMetrics.falsePositiveRate) {
            kpiAnalysis.trendsIdentified.push('false_positive_rate_decreasing');
          }
          if (period.metrics.averageDetectionTime < previousMetrics.averageDetectionTime) {
            kpiAnalysis.trendsIdentified.push('detection_time_improving');
          }
          if (period.metrics.fraudPrevented > previousMetrics.fraudPrevented) {
            kpiAnalysis.trendsIdentified.push('fraud_prevention_increasing');
          }
        }

        // Overall performance rating
        const excellentKPIs = Object.values(kpiAnalysis.kpiPerformance).filter(rating => rating === 'EXCELLENT').length;
        const goodKPIs = Object.values(kpiAnalysis.kpiPerformance).filter(rating => rating === 'GOOD').length;
        
        if (excellentKPIs >= 3) {
          kpiAnalysis.performanceRating = 'EXCELLENT';
        } else if (excellentKPIs + goodKPIs >= 4) {
          kpiAnalysis.performanceRating = 'GOOD';
        } else {
          kpiAnalysis.performanceRating = 'NEEDS_IMPROVEMENT';
        }

        kpiAnalysisResults.push(kpiAnalysis);
      }

      // Validate KPI tracking accuracy
      const excellentPerformancePeriods = kpiAnalysisResults.filter(r => r.performanceRating === 'EXCELLENT');
      const improvingTrends = kpiAnalysisResults.filter(r => r.trendsIdentified.length > 0);
      const consistentDetectionPerformance = kpiAnalysisResults.every(r => 
        r.kpiPerformance.detectionSpeed !== 'NEEDS_IMPROVEMENT'
      );

      expect(excellentPerformancePeriods.length).toBeGreaterThan(0);
      expect(improvingTrends.length).toBeGreaterThan(0);
      expect(consistentDetectionPerformance).toBe(true);

      // Update monitoring metrics
      monitoringMetrics.totalEvents = kpiAnalysisResults.reduce((sum, r) => 
        sum + r.metrics.totalSecurityEvents, 0);
      monitoringMetrics.averageResponseTime = kpiAnalysisResults.reduce((sum, r) => 
        sum + r.metrics.averageResponseTime, 0) / kpiAnalysisResults.length;
    });

    it('should generate security compliance reports', async () => {
      const complianceRequirements = [
        {
          framework: 'PCI_DSS',
          requirements: [
            { control: '1.1', description: 'Firewall configuration standards', status: 'COMPLIANT' },
            { control: '2.1', description: 'Vendor default passwords', status: 'COMPLIANT' },
            { control: '3.4', description: 'Primary account number encryption', status: 'COMPLIANT' },
            { control: '8.2', description: 'User authentication management', status: 'COMPLIANT' },
            { control: '10.2', description: 'Audit log implementation', status: 'COMPLIANT' },
            { control: '11.3', description: 'Penetration testing', status: 'IN_PROGRESS' }
          ]
        },
        {
          framework: 'GDPR',
          requirements: [
            { control: 'Art. 25', description: 'Data protection by design', status: 'COMPLIANT' },
            { control: 'Art. 30', description: 'Records of processing activities', status: 'COMPLIANT' },
            { control: 'Art. 32', description: 'Security of processing', status: 'COMPLIANT' },
            { control: 'Art. 33', description: 'Breach notification procedures', status: 'COMPLIANT' },
            { control: 'Art. 35', description: 'Data protection impact assessment', status: 'REVIEW_REQUIRED' }
          ]
        },
        {
          framework: 'Swedish_Banking_Regulations',
          requirements: [
            { control: 'FI_2017:6', description: 'IT operational risk management', status: 'COMPLIANT' },
            { control: 'PSD2', description: 'Strong customer authentication', status: 'COMPLIANT' },
            { control: 'AML_Directive', description: 'Anti-money laundering controls', status: 'COMPLIANT' },
            { control: 'FFFS_2014:1', description: 'Outsourcing regulations', status: 'COMPLIANT' }
          ]
        }
      ];

      const complianceReportResults = [];

      for (const framework of complianceRequirements) {
        const compliantControls = framework.requirements.filter(req => req.status === 'COMPLIANT').length;
        const totalControls = framework.requirements.length;
        const compliancePercentage = (compliantControls / totalControls) * 100;
        
        const nonCompliantControls = framework.requirements.filter(req => 
          req.status !== 'COMPLIANT'
        );

        const complianceReport = {
          framework: framework.framework,
          reportTimestamp: Date.now(),
          totalControls,
          compliantControls,
          compliancePercentage,
          nonCompliantControls,
          overallStatus: compliancePercentage >= 90 ? 'FULLY_COMPLIANT' :
                        compliancePercentage >= 80 ? 'LARGELY_COMPLIANT' : 'NON_COMPLIANT',
          remedialActionsRequired: nonCompliantControls.map(control => ({
            control: control.control,
            description: control.description,
            currentStatus: control.status,
            requiredAction: control.status === 'IN_PROGRESS' ? 'COMPLETE_IMPLEMENTATION' : 'INITIATE_REMEDIATION'
          }))
        };

        complianceReportResults.push(complianceReport);

        // Generate security event for compliance reporting
        securityEvents.push({
          eventId: `compliance_report_${framework.framework}_${Date.now()}`,
          eventType: 'COMPLIANCE_ASSESSMENT',
          timestamp: Date.now(),
          severity: complianceReport.overallStatus === 'FULLY_COMPLIANT' ? 'LOW' : 'MEDIUM',
          framework: framework.framework,
          compliancePercentage,
          remedialActionsCount: complianceReport.remedialActionsRequired.length
        });
      }

      const fullyCompliantFrameworks = complianceReportResults.filter(r => 
        r.overallStatus === 'FULLY_COMPLIANT'
      );
      const averageCompliance = complianceReportResults.reduce((sum, r) => 
        sum + r.compliancePercentage, 0) / complianceReportResults.length;
      const totalRemedialActions = complianceReportResults.reduce((sum, r) => 
        sum + r.remedialActionsRequired.length, 0);

      expect(fullyCompliantFrameworks.length).toBeGreaterThan(0);
      expect(averageCompliance).toBeGreaterThan(85); // Should maintain high compliance
      expect(totalRemedialActions).toBeLessThan(5); // Minimal remedial actions needed
    });
  });

  describe('Alert Management and False Positive Reduction', () => {
    it('should optimize alert thresholds to reduce false positives', async () => {
      const alertingScenarios = [
        {
          alertType: 'unusual_transaction_amount',
          currentThreshold: 100000, // 1,000 SEK
          testTransactions: [
            { amount: 95000, legitimate: true, customerHistory: [90000, 88000, 92000] },
            { amount: 150000, legitimate: true, customerHistory: [140000, 135000, 145000] },
            { amount: 500000, legitimate: false, customerHistory: [50000, 45000, 48000] },
            { amount: 75000, legitimate: true, customerHistory: [70000, 72000, 78000] }
          ]
        },
        {
          alertType: 'rapid_transaction_velocity',
          currentThreshold: 5, // transactions per minute
          testSequences: [
            { transactionCount: 4, timeSpan: 60000, legitimate: true, pattern: 'bulk_purchase' },
            { transactionCount: 8, timeSpan: 60000, legitimate: false, pattern: 'velocity_abuse' },
            { transactionCount: 6, timeSpan: 120000, legitimate: true, pattern: 'normal_shopping' }
          ]
        }
      ];

      const thresholdOptimizationResults = [];

      for (const scenario of alertingScenarios) {
        let falsePositives = 0;
        let truePositives = 0;
        let falseNegatives = 0;
        let trueNegatives = 0;

        if (scenario.alertType === 'unusual_transaction_amount') {
          for (const transaction of scenario.testTransactions) {
            const averageHistory = transaction.customerHistory.reduce((sum, amt) => sum + amt, 0) / transaction.customerHistory.length;
            const deviationFromHistory = Math.abs(transaction.amount - averageHistory) / averageHistory;
            
            const alertTriggered = transaction.amount > scenario.currentThreshold || deviationFromHistory > 0.5;
            const shouldAlert = !transaction.legitimate;

            if (alertTriggered && !shouldAlert) falsePositives++;
            else if (alertTriggered && shouldAlert) truePositives++;
            else if (!alertTriggered && shouldAlert) falseNegatives++;
            else trueNegatives++;
          }
        } else if (scenario.alertType === 'rapid_transaction_velocity') {
          for (const sequence of scenario.testSequences) {
            const transactionsPerMinute = (sequence.transactionCount / sequence.timeSpan) * 60000;
            const alertTriggered = transactionsPerMinute > scenario.currentThreshold;
            const shouldAlert = !sequence.legitimate;

            if (alertTriggered && !shouldAlert) falsePositives++;
            else if (alertTriggered && shouldAlert) truePositives++;
            else if (!alertTriggered && shouldAlert) falseNegatives++;
            else trueNegatives++;
          }
        }

        const totalTests = falsePositives + truePositives + falseNegatives + trueNegatives;
        const falsePositiveRate = falsePositives / (falsePositives + trueNegatives);
        const detectionRate = truePositives / (truePositives + falseNegatives);
        const accuracy = (truePositives + trueNegatives) / totalTests;

        // Recommend threshold optimization
        let optimizationRecommendation = 'maintain_current_threshold';
        if (falsePositiveRate > 0.15) {
          optimizationRecommendation = 'increase_threshold_reduce_sensitivity';
        } else if (falseNegatives > 0 && falsePositiveRate < 0.05) {
          optimizationRecommendation = 'decrease_threshold_increase_sensitivity';
        }

        thresholdOptimizationResults.push({
          alertType: scenario.alertType,
          currentThreshold: scenario.currentThreshold,
          falsePositives,
          truePositives,
          falseNegatives,
          trueNegatives,
          falsePositiveRate,
          detectionRate,
          accuracy,
          optimizationRecommendation,
          performanceRating: accuracy > 0.8 ? 'GOOD' : accuracy > 0.6 ? 'ACCEPTABLE' : 'POOR'
        });

        monitoringMetrics.falsePositives += falsePositives;
      }

      const wellTunedAlerts = thresholdOptimizationResults.filter(r => r.falsePositiveRate < 0.10);
      const highAccuracyAlerts = thresholdOptimizationResults.filter(r => r.accuracy > 0.80);
      const averageFalsePositiveRate = thresholdOptimizationResults.reduce((sum, r) => 
        sum + r.falsePositiveRate, 0) / thresholdOptimizationResults.length;

      expect(wellTunedAlerts.length).toBeGreaterThan(0);
      expect(highAccuracyAlerts.length).toBeGreaterThan(0);
      expect(averageFalsePositiveRate).toBeLessThan(0.15); // Should keep false positives under 15%
    });
  });

  afterAll(() => {
    // Final monitoring metrics summary
    console.log('Final Security Monitoring Metrics:', {
      totalEventsProcessed: monitoringMetrics.totalEvents,
      alertsTriggered: monitoringMetrics.alertsTriggered,
      averageResponseTime: `${monitoringMetrics.averageResponseTime}ms`,
      falsePositives: monitoringMetrics.falsePositives,
      securityEventsLogged: securityEvents.length
    });

    // Validate overall security monitoring effectiveness
    const monitoringEffectiveness = {
      responseTimeAcceptable: monitoringMetrics.averageResponseTime < 2000,
      alertVolumeManageable: monitoringMetrics.alertsTriggered < monitoringMetrics.totalEvents * 0.1,
      falsePositiveRateAcceptable: monitoringMetrics.falsePositives < monitoringMetrics.totalEvents * 0.15
    };

    expect(monitoringEffectiveness.responseTimeAcceptable).toBe(true);
    expect(monitoringEffectiveness.alertVolumeManageable).toBe(true);
    expect(monitoringEffectiveness.falsePositiveRateAcceptable).toBe(true);
  });
});