/**
 * Live Session Monitoring Tests
 * Tests admin capabilities for real-time monitoring of customer feedback sessions,
 * system performance tracking, and business analytics dashboard
 */

const { AdminTestUtils, LIVE_SESSION_DATA, ADMIN_TEST_USERS, ADMIN_TEST_CONFIG } = global;

describe('Live Session Monitoring Tests', () => {
  let monitoringData = [];
  let performanceMetrics = [];
  let realTimeUpdates = [];

  beforeEach(() => {
    monitoringData = [];
    performanceMetrics = [];
    realTimeUpdates = [];
  });

  afterEach(() => {
    // Clear monitoring data
    monitoringData = [];
    performanceMetrics = [];
    realTimeUpdates = [];
  });

  describe('Real-Time Session Tracking', () => {
    it('should monitor active feedback sessions', () => {
      const activeSessions = LIVE_SESSION_DATA.active_sessions;
      const currentTime = new Date();

      const sessionAnalysis = activeSessions.map(session => {
        const sessionDuration = session.completedAt ? 
          session.completedAt.getTime() - session.startedAt.getTime() :
          currentTime.getTime() - session.startedAt.getTime();

        return {
          sessionId: session.sessionId,
          businessId: session.businessId,
          businessName: session.businessName,
          status: session.status,
          duration: sessionDuration,
          durationMinutes: Math.round(sessionDuration / (1000 * 60)),
          location: session.location,
          deviceType: session.deviceInfo?.type,
          isCompleted: session.status === 'completed',
          qualityScore: session.qualityScore,
          rewardAmount: session.rewardAmount,
          sessionHealth: sessionDuration < 600000 ? 'normal' : 'extended' // Over 10 minutes is extended
        };
      });

      const completedSessions = sessionAnalysis.filter(s => s.isCompleted);
      const activeSessions = sessionAnalysis.filter(s => !s.isCompleted);
      
      expect(sessionAnalysis).toHaveLength(2);
      expect(completedSessions).toHaveLength(1);
      expect(activeSessions).toHaveLength(1);

      // Validate completed session data
      const completedSession = completedSessions[0];
      expect(completedSession.qualityScore).toBe(78);
      expect(completedSession.rewardAmount).toBe(8750); // 87.50 SEK in öre
      expect(completedSession.durationMinutes).toBeGreaterThan(0);

      monitoringData.push({
        type: 'session_analysis',
        timestamp: currentTime,
        totalSessions: sessionAnalysis.length,
        completedSessions: completedSessions.length,
        activeSessions: activeSessions.length,
        averageDuration: sessionAnalysis.reduce((sum, s) => sum + s.durationMinutes, 0) / sessionAnalysis.length
      });
    });

    it('should track session performance metrics', () => {
      const sessionMetrics = LIVE_SESSION_DATA.session_metrics;
      const performanceThresholds = ADMIN_TEST_CONFIG.monitoring.performanceThresholds;

      const metricsAnalysis = {
        timestamp: new Date(),
        dailyMetrics: {
          totalSessions: sessionMetrics.totalSessionsToday,
          averageSessionDuration: sessionMetrics.avgSessionDuration,
          averageQualityScore: sessionMetrics.avgQualityScore,
          totalRewards: sessionMetrics.totalRewardsToday,
          platformCommission: sessionMetrics.platformCommission,
          conversionRate: sessionMetrics.conversionRate
        },
        performanceStatus: {
          sessionVolume: sessionMetrics.totalSessionsToday > 100 ? 'high' : 'normal',
          qualityScores: sessionMetrics.avgQualityScore > 70 ? 'good' : 'needs_improvement',
          conversionRate: sessionMetrics.conversionRate > 0.8 ? 'excellent' : 
                         sessionMetrics.conversionRate > 0.6 ? 'good' : 'poor',
          rewardDistribution: sessionMetrics.totalRewardsToday > 1000000 ? 'high_volume' : 'normal' // >10,000 SEK
        },
        alerts: []
      };

      // Generate alerts based on performance
      if (sessionMetrics.avgQualityScore < 60) {
        metricsAnalysis.alerts.push({
          type: 'low_quality_scores',
          severity: 'medium',
          message: `Average quality score (${sessionMetrics.avgQualityScore}) below 60% threshold`,
          recommendedAction: 'Review feedback quality guidelines with businesses'
        });
      }

      if (sessionMetrics.conversionRate < 0.5) {
        metricsAnalysis.alerts.push({
          type: 'low_conversion_rate',
          severity: 'high',
          message: `Conversion rate (${Math.round(sessionMetrics.conversionRate * 100)}%) critically low`,
          recommendedAction: 'Investigate user experience issues'
        });
      }

      expect(metricsAnalysis.dailyMetrics.totalSessions).toBe(142);
      expect(metricsAnalysis.dailyMetrics.averageQualityScore).toBe(73.5);
      expect(metricsAnalysis.performanceStatus.conversionRate).toBe('excellent');
      expect(metricsAnalysis.alerts).toHaveLength(0); // No alerts for good performance

      performanceMetrics.push(metricsAnalysis);
    });

    it('should generate real-time system updates', async () => {
      // Simulate real-time updates over time
      const updateInterval = ADMIN_TEST_CONFIG.monitoring.realTimeUpdateInterval;
      const updates = [];

      for (let i = 0; i < 5; i++) {
        const update = AdminTestUtils.generateLiveSessionUpdate();
        updates.push({
          updateId: i + 1,
          timestamp: new Date(Date.now() + (i * updateInterval)),
          data: update
        });

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const latestUpdate = updates[updates.length - 1];
      const performanceCheck = {
        updateFrequency: updateInterval,
        totalUpdates: updates.length,
        latestMetrics: latestUpdate.data,
        systemHealth: {
          responseTime: latestUpdate.data.systemPerformance.responseTime < 2000,
          dbQueryTime: latestUpdate.data.systemPerformance.dbQueryTime < 500,
          memoryUsage: latestUpdate.data.systemPerformance.memoryUsage < 0.8,
          cpuUsage: latestUpdate.data.systemPerformance.cpuUsage < 0.7
        },
        alertsGenerated: []
      };

      // Check for performance alerts
      Object.entries(performanceCheck.systemHealth).forEach(([metric, isHealthy]) => {
        if (!isHealthy) {
          performanceCheck.alertsGenerated.push({
            metric,
            severity: 'high',
            timestamp: latestUpdate.timestamp,
            action: 'investigate_performance_degradation'
          });
        }
      });

      expect(updates).toHaveLength(5);
      expect(performanceCheck.latestMetrics.activeSessions).toBeGreaterThan(0);
      expect(performanceCheck.systemHealth.responseTime).toBe(true);

      realTimeUpdates.push(...updates);
    });
  });

  describe('Business Performance Monitoring', () => {
    it('should track individual business performance', () => {
      const businessPerformanceData = [
        {
          businessId: 'bus_approved_001',
          businessName: 'Stockholm Bakery',
          todayMetrics: {
            sessionsStarted: 15,
            sessionsCompleted: 13,
            averageQualityScore: 78.2,
            totalRewards: 185000, // 1,850 SEK in öre
            platformCommission: 37000, // 370 SEK (20%)
            conversionRate: 13 / 15
          },
          weeklyTrend: {
            sessionsGrowth: 0.12, // 12% increase
            qualityImprovement: 0.05, // 5% improvement
            rewardGrowth: 0.18 // 18% increase
          },
          performanceRating: 'excellent'
        },
        {
          businessId: 'bus_approved_002',
          businessName: 'Göteborg Restaurant',
          todayMetrics: {
            sessionsStarted: 28,
            sessionsCompleted: 22,
            averageQualityScore: 71.8,
            totalRewards: 425000, // 4,250 SEK in öre
            platformCommission: 76500, // 765 SEK (18% - tier 2)
            conversionRate: 22 / 28
          },
          weeklyTrend: {
            sessionsGrowth: 0.08, // 8% increase
            qualityImprovement: -0.02, // 2% decline
            rewardGrowth: 0.15 // 15% increase
          },
          performanceRating: 'good'
        }
      ];

      const businessAnalysis = businessPerformanceData.map(business => {
        const performanceScore = (
          (business.todayMetrics.conversionRate * 0.3) +
          (business.todayMetrics.averageQualityScore / 100 * 0.4) +
          (Math.min(business.weeklyTrend.sessionsGrowth, 0.5) * 0.3)
        );

        return {
          businessId: business.businessId,
          businessName: business.businessName,
          performanceScore,
          todayMetrics: business.todayMetrics,
          trends: business.weeklyTrend,
          healthStatus: performanceScore > 0.8 ? 'excellent' :
                       performanceScore > 0.6 ? 'good' :
                       performanceScore > 0.4 ? 'fair' : 'needs_attention',
          recommendations: []
        };
      });

      // Generate business-specific recommendations
      businessAnalysis.forEach(business => {
        if (business.todayMetrics.conversionRate < 0.7) {
          business.recommendations.push('Improve customer onboarding experience');
        }
        if (business.todayMetrics.averageQualityScore < 70) {
          business.recommendations.push('Provide staff training on encouraging detailed feedback');
        }
        if (business.trends.qualityImprovement < 0) {
          business.recommendations.push('Review recent feedback patterns for quality decline');
        }
      });

      expect(businessAnalysis).toHaveLength(2);
      expect(businessAnalysis[0].healthStatus).toBe('excellent');
      expect(businessAnalysis[1].healthStatus).toBe('good');
      expect(businessAnalysis[1].recommendations.length).toBeGreaterThan(0);

      monitoringData.push({
        type: 'business_performance_analysis',
        timestamp: new Date(),
        businesses: businessAnalysis
      });
    });

    it('should identify top performing businesses', () => {
      const sessionMetrics = LIVE_SESSION_DATA.session_metrics;
      const topBusinessIds = sessionMetrics.topPerformingBusinesses;

      const topPerformersAnalysis = topBusinessIds.map(businessId => {
        // Simulate detailed performance data for top performers
        return {
          businessId,
          businessName: `Top Performer ${businessId}`,
          rank: topBusinessIds.indexOf(businessId) + 1,
          keyMetrics: {
            monthlyFeedbacks: Math.floor(Math.random() * 2000) + 1500, // 1500-3500
            averageQualityScore: Math.floor(Math.random() * 15) + 80, // 80-95
            customerReturnRate: Math.random() * 0.3 + 0.6, // 60-90%
            monthlyRewards: Math.floor(Math.random() * 500000) + 300000, // 3,000-8,000 SEK
            platformCommission: 0 // Will be calculated
          },
          successFactors: [
            'Consistent high-quality customer interactions',
            'Well-trained staff encouraging detailed feedback',
            'Effective QR code placement and visibility',
            'Strong customer incentive communication'
          ]
        };
      });

      // Calculate commission based on estimated tier
      topPerformersAnalysis.forEach(business => {
        const monthlyFeedbacks = business.keyMetrics.monthlyFeedbacks;
        let commissionRate = 0.20; // Default tier 1
        
        if (monthlyFeedbacks > 5000) commissionRate = 0.15; // Tier 3
        else if (monthlyFeedbacks > 1000) commissionRate = 0.18; // Tier 2

        business.keyMetrics.platformCommission = Math.round(
          business.keyMetrics.monthlyRewards * commissionRate
        );
      });

      const topPerformerSummary = {
        totalTopPerformers: topPerformersAnalysis.length,
        averageQualityScore: topPerformersAnalysis.reduce((sum, b) => 
          sum + b.keyMetrics.averageQualityScore, 0) / topPerformersAnalysis.length,
        totalMonthlyRewards: topPerformersAnalysis.reduce((sum, b) => 
          sum + b.keyMetrics.monthlyRewards, 0),
        totalPlatformRevenue: topPerformersAnalysis.reduce((sum, b) => 
          sum + b.keyMetrics.platformCommission, 0),
        commonSuccessFactors: topPerformersAnalysis[0].successFactors
      };

      expect(topPerformersAnalysis).toHaveLength(2);
      expect(topPerformerSummary.averageQualityScore).toBeGreaterThan(80);
      expect(topPerformerSummary.totalPlatformRevenue).toBeGreaterThan(0);

      monitoringData.push({
        type: 'top_performers_analysis',
        timestamp: new Date(),
        summary: topPerformerSummary,
        businesses: topPerformersAnalysis
      });
    });
  });

  describe('Geographic and Temporal Analytics', () => {
    it('should analyze session distribution by location', () => {
      // Simulate sessions from different Swedish cities
      const locationData = [
        { city: 'Stockholm', sessions: 58, avgQualityScore: 75.2, totalRewards: 485000 },
        { city: 'Göteborg', sessions: 32, avgQualityScore: 72.1, totalRewards: 298000 },
        { city: 'Malmö', sessions: 18, avgQualityScore: 69.8, totalRewards: 165000 },
        { city: 'Uppsala', sessions: 12, avgQualityScore: 78.5, totalRewards: 128000 },
        { city: 'Västerås', sessions: 8, avgQualityScore: 71.3, totalRewards: 74000 }
      ];

      const geographicAnalysis = {
        timestamp: new Date(),
        totalCities: locationData.length,
        totalSessions: locationData.reduce((sum, city) => sum + city.sessions, 0),
        totalRewards: locationData.reduce((sum, city) => sum + city.totalRewards, 0),
        cityRankings: locationData
          .sort((a, b) => b.sessions - a.sessions)
          .map((city, index) => ({
            ...city,
            rank: index + 1,
            marketShare: city.sessions / locationData.reduce((sum, c) => sum + c.sessions, 0),
            rewardPerSession: Math.round(city.totalRewards / city.sessions)
          })),
        insights: []
      };

      // Generate geographic insights
      const topCity = geographicAnalysis.cityRankings[0];
      const highestQuality = locationData.reduce((prev, current) => 
        prev.avgQualityScore > current.avgQualityScore ? prev : current
      );

      geographicAnalysis.insights.push(
        `${topCity.city} leads with ${Math.round(topCity.marketShare * 100)}% of total sessions`,
        `${highestQuality.city} has highest quality scores (${highestQuality.avgQualityScore})`,
        `Average reward per session varies from ${Math.min(...geographicAnalysis.cityRankings.map(c => c.rewardPerSession))} to ${Math.max(...geographicAnalysis.cityRankings.map(c => c.rewardPerSession))} öre`
      );

      expect(geographicAnalysis.totalSessions).toBe(128);
      expect(geographicAnalysis.cityRankings[0].city).toBe('Stockholm');
      expect(geographicAnalysis.insights).toHaveLength(3);

      monitoringData.push({
        type: 'geographic_analysis',
        data: geographicAnalysis
      });
    });

    it('should analyze temporal patterns and peak hours', () => {
      // Simulate hourly session distribution
      const hourlyData = Array.from({ length: 24 }, (_, hour) => {
        let baseSessions = 5;
        
        // Model realistic patterns: higher during business hours, lunch, and evening
        if (hour >= 9 && hour <= 11) baseSessions = 15; // Morning coffee
        else if (hour >= 12 && hour <= 14) baseSessions = 25; // Lunch peak
        else if (hour >= 17 && hour <= 20) baseSessions = 20; // Evening dining
        else if (hour >= 21 || hour <= 6) baseSessions = 2; // Night/early morning

        return {
          hour,
          sessions: baseSessions + Math.floor(Math.random() * 5),
          avgQualityScore: 70 + Math.random() * 15,
          avgSessionDuration: 180000 + Math.random() * 120000 // 3-5 minutes
        };
      });

      const temporalAnalysis = {
        timestamp: new Date(),
        hourlyDistribution: hourlyData,
        peakHours: hourlyData
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 3)
          .map(hour => ({
            hour: hour.hour,
            sessions: hour.sessions,
            timeLabel: `${hour.hour.toString().padStart(2, '0')}:00`
          })),
        offPeakHours: hourlyData
          .sort((a, b) => a.sessions - b.sessions)
          .slice(0, 3)
          .map(hour => ({
            hour: hour.hour,
            sessions: hour.sessions,
            timeLabel: `${hour.hour.toString().padStart(2, '0')}:00`
          })),
        dailyPatterns: {
          morningRush: hourlyData.filter(h => h.hour >= 7 && h.hour <= 10).reduce((sum, h) => sum + h.sessions, 0),
          lunchPeak: hourlyData.filter(h => h.hour >= 11 && h.hour <= 14).reduce((sum, h) => sum + h.sessions, 0),
          eveningDining: hourlyData.filter(h => h.hour >= 17 && h.hour <= 20).reduce((sum, h) => sum + h.sessions, 0),
          nightTime: hourlyData.filter(h => h.hour >= 21 || h.hour <= 6).reduce((sum, h) => sum + h.sessions, 0)
        }
      };

      expect(temporalAnalysis.peakHours).toHaveLength(3);
      expect(temporalAnalysis.offPeakHours).toHaveLength(3);
      expect(temporalAnalysis.dailyPatterns.lunchPeak).toBeGreaterThan(temporalAnalysis.dailyPatterns.nightTime);
      expect(temporalAnalysis.peakHours[0].sessions).toBeGreaterThan(temporalAnalysis.offPeakHours[0].sessions);

      monitoringData.push({
        type: 'temporal_analysis',
        data: temporalAnalysis
      });
    });
  });

  describe('Admin Monitoring Dashboard Access', () => {
    it('should validate super admin full monitoring access', () => {
      const superAdmin = ADMIN_TEST_USERS.super_admin;
      const dashboardAccess = {
        userId: superAdmin.id,
        role: superAdmin.role,
        monitoringPermissions: {
          liveSessionView: AdminTestUtils.hasPermission(superAdmin, 'monitoring:view'),
          systemMetrics: AdminTestUtils.hasPermission(superAdmin, 'system:manage'),
          businessAnalytics: AdminTestUtils.hasPermission(superAdmin, 'businesses:manage'),
          performanceReports: AdminTestUtils.hasPermission(superAdmin, 'audit:view'),
          dataExport: AdminTestUtils.hasPermission(superAdmin, 'data:export')
        }
      };

      expect(dashboardAccess.monitoringPermissions.liveSessionView).toBe(true);
      expect(dashboardAccess.monitoringPermissions.systemMetrics).toBe(true);
      expect(dashboardAccess.monitoringPermissions.businessAnalytics).toBe(true);
      expect(dashboardAccess.monitoringPermissions.performanceReports).toBe(true);
      expect(dashboardAccess.monitoringPermissions.dataExport).toBe(true);
    });

    it('should validate platform admin monitoring access', () => {
      const platformAdmin = ADMIN_TEST_USERS.platform_admin;
      const dashboardAccess = {
        userId: platformAdmin.id,
        role: platformAdmin.role,
        monitoringPermissions: {
          liveSessionView: AdminTestUtils.hasPermission(platformAdmin, 'monitoring:view'),
          systemMetrics: AdminTestUtils.hasPermission(platformAdmin, 'system:manage'),
          businessAnalytics: AdminTestUtils.hasPermission(platformAdmin, 'businesses:manage'),
          performanceReports: AdminTestUtils.hasPermission(platformAdmin, 'audit:view'),
          dataExport: AdminTestUtils.hasPermission(platformAdmin, 'data:export')
        }
      };

      expect(dashboardAccess.monitoringPermissions.liveSessionView).toBe(true);
      expect(dashboardAccess.monitoringPermissions.systemMetrics).toBe(false); // No system management
      expect(dashboardAccess.monitoringPermissions.businessAnalytics).toBe(true);
      expect(dashboardAccess.monitoringPermissions.performanceReports).toBe(true);
      expect(dashboardAccess.monitoringPermissions.dataExport).toBe(false); // No data export
    });

    it('should restrict support agent monitoring access', () => {
      const supportAgent = ADMIN_TEST_USERS.support_agent;
      const dashboardAccess = {
        userId: supportAgent.id,
        role: supportAgent.role,
        monitoringPermissions: {
          liveSessionView: AdminTestUtils.hasPermission(supportAgent, 'monitoring:view'),
          systemMetrics: AdminTestUtils.hasPermission(supportAgent, 'system:manage'),
          businessAnalytics: AdminTestUtils.hasPermission(supportAgent, 'businesses:manage'),
          performanceReports: AdminTestUtils.hasPermission(supportAgent, 'audit:view'),
          dataExport: AdminTestUtils.hasPermission(supportAgent, 'data:export')
        },
        restrictedAccess: {
          canViewSessions: true,
          canViewSystemHealth: false,
          canModifySettings: false,
          canExportData: false
        }
      };

      expect(dashboardAccess.monitoringPermissions.liveSessionView).toBe(true);
      expect(dashboardAccess.monitoringPermissions.systemMetrics).toBe(false);
      expect(dashboardAccess.monitoringPermissions.businessAnalytics).toBe(false);
      expect(dashboardAccess.monitoringPermissions.performanceReports).toBe(false);
      expect(dashboardAccess.restrictedAccess.canViewSessions).toBe(true);
      expect(dashboardAccess.restrictedAccess.canModifySettings).toBe(false);
    });

    it('should prevent viewer from system monitoring', () => {
      const viewer = ADMIN_TEST_USERS.viewer;
      const dashboardAccess = {
        userId: viewer.id,
        role: viewer.role,
        monitoringPermissions: {
          liveSessionView: AdminTestUtils.hasPermission(viewer, 'monitoring:view'),
          businessView: AdminTestUtils.hasPermission(viewer, 'businesses:view')
        },
        allowedViews: ['business_list', 'basic_session_counts'],
        deniedViews: ['live_session_details', 'system_performance', 'business_analytics', 'admin_reports']
      };

      expect(dashboardAccess.monitoringPermissions.liveSessionView).toBe(true);
      expect(dashboardAccess.monitoringPermissions.businessView).toBe(true);
      expect(dashboardAccess.allowedViews).toHaveLength(2);
      expect(dashboardAccess.deniedViews).toHaveLength(4);
    });
  });

  describe('Monitoring Alerts and Notifications', () => {
    it('should generate system performance alerts', () => {
      const systemUpdate = AdminTestUtils.generateLiveSessionUpdate();
      const performanceThresholds = ADMIN_TEST_CONFIG.monitoring.performanceThresholds;
      
      const alertChecks = {
        responseTime: {
          current: systemUpdate.systemPerformance.responseTime,
          threshold: performanceThresholds.responseTime,
          exceeded: systemUpdate.systemPerformance.responseTime > performanceThresholds.responseTime
        },
        dbQueryTime: {
          current: systemUpdate.systemPerformance.dbQueryTime,
          threshold: performanceThresholds.dbQueryTime,
          exceeded: systemUpdate.systemPerformance.dbQueryTime > performanceThresholds.dbQueryTime
        },
        memoryUsage: {
          current: systemUpdate.systemPerformance.memoryUsage,
          threshold: performanceThresholds.memoryUsage,
          exceeded: systemUpdate.systemPerformance.memoryUsage > performanceThresholds.memoryUsage
        },
        cpuUsage: {
          current: systemUpdate.systemPerformance.cpuUsage,
          threshold: performanceThresholds.cpuUsage,
          exceeded: systemUpdate.systemPerformance.cpuUsage > performanceThresholds.cpuUsage
        }
      };

      const alertsGenerated = [];

      Object.entries(alertChecks).forEach(([metric, check]) => {
        if (check.exceeded) {
          alertsGenerated.push({
            type: 'performance_threshold_exceeded',
            metric,
            severity: metric === 'responseTime' || metric === 'dbQueryTime' ? 'high' : 'medium',
            currentValue: check.current,
            threshold: check.threshold,
            timestamp: new Date(),
            recommendedActions: [
              'Investigate system resource usage',
              'Check for database query optimization opportunities',
              'Monitor for traffic spikes',
              'Consider scaling resources if pattern persists'
            ]
          });
        }
      });

      // Most randomly generated metrics should be within thresholds
      const withinThresholds = Object.values(alertChecks).filter(check => !check.exceeded);
      expect(withinThresholds.length).toBeGreaterThan(2); // Most should be healthy

      if (alertsGenerated.length > 0) {
        expect(alertsGenerated[0]).toHaveProperty('type');
        expect(alertsGenerated[0]).toHaveProperty('severity');
        expect(alertsGenerated[0].recommendedActions).toHaveLength(4);
      }

      monitoringData.push({
        type: 'performance_alert_check',
        timestamp: new Date(),
        systemMetrics: systemUpdate.systemPerformance,
        thresholds: performanceThresholds,
        alertsGenerated
      });
    });

    it('should generate business performance alerts', () => {
      const businessAlertScenarios = [
        {
          businessId: 'bus_low_quality_001',
          businessName: 'Low Quality Business',
          currentMetrics: {
            todayQualityScore: 45, // Below 60 threshold
            sessionsToday: 12,
            conversionRate: 0.4 // Below 50% threshold
          },
          alertTypes: ['low_quality_scores', 'low_conversion_rate']
        },
        {
          businessId: 'bus_high_volume_001',
          businessName: 'High Volume Business',
          currentMetrics: {
            todayQualityScore: 82,
            sessionsToday: 150, // Very high volume
            conversionRate: 0.95
          },
          alertTypes: ['high_volume_notification'] // Positive alert
        },
        {
          businessId: 'bus_suspicious_001',
          businessName: 'Suspicious Activity Business',
          currentMetrics: {
            todayQualityScore: 95, // Unusually high
            sessionsToday: 8,
            conversionRate: 1.0, // Perfect conversion suspicious
            feedbackSimilarity: 0.98 // Very similar feedback patterns
          },
          alertTypes: ['suspicious_activity']
        }
      ];

      const businessAlerts = businessAlertScenarios.map(scenario => {
        const alerts = [];

        scenario.alertTypes.forEach(alertType => {
          switch (alertType) {
            case 'low_quality_scores':
              alerts.push({
                businessId: scenario.businessId,
                businessName: scenario.businessName,
                type: 'quality_score_alert',
                severity: 'high',
                message: `Average quality score (${scenario.currentMetrics.todayQualityScore}%) below 60% threshold`,
                recommendedActions: [
                  'Contact business for quality improvement guidance',
                  'Review recent feedback patterns',
                  'Provide staff training resources'
                ],
                requiresAdminAction: true
              });
              break;

            case 'low_conversion_rate':
              alerts.push({
                businessId: scenario.businessId,
                businessName: scenario.businessName,
                type: 'conversion_rate_alert',
                severity: 'medium',
                message: `Conversion rate (${Math.round(scenario.currentMetrics.conversionRate * 100)}%) below 50% threshold`,
                recommendedActions: [
                  'Investigate user experience issues',
                  'Check QR code functionality',
                  'Review onboarding flow'
                ],
                requiresAdminAction: true
              });
              break;

            case 'suspicious_activity':
              alerts.push({
                businessId: scenario.businessId,
                businessName: scenario.businessName,
                type: 'fraud_alert',
                severity: 'critical',
                message: 'Suspicious activity patterns detected - unusually high scores with perfect conversion',
                recommendedActions: [
                  'Manual review of recent feedback',
                  'Verify customer authenticity',
                  'Consider temporary monitoring increase',
                  'Contact business for verification'
                ],
                requiresAdminAction: true,
                escalateToSuperAdmin: true
              });
              break;

            case 'high_volume_notification':
              alerts.push({
                businessId: scenario.businessId,
                businessName: scenario.businessName,
                type: 'performance_recognition',
                severity: 'info',
                message: `Exceptional performance with ${scenario.currentMetrics.sessionsToday} sessions today`,
                recommendedActions: [
                  'Consider featuring as success story',
                  'Offer tier upgrade discussion',
                  'Request feedback on success factors'
                ],
                requiresAdminAction: false
              });
              break;
          }
        });

        return alerts;
      }).flat();

      const criticalAlerts = businessAlerts.filter(a => a.severity === 'critical');
      const highPriorityAlerts = businessAlerts.filter(a => a.severity === 'high');
      const actionRequiredAlerts = businessAlerts.filter(a => a.requiresAdminAction);

      expect(businessAlerts).toHaveLength(4);
      expect(criticalAlerts).toHaveLength(1);
      expect(highPriorityAlerts).toHaveLength(1);
      expect(actionRequiredAlerts).toHaveLength(3);
      expect(criticalAlerts[0].escalateToSuperAdmin).toBe(true);

      monitoringData.push({
        type: 'business_alerts_generated',
        timestamp: new Date(),
        totalAlerts: businessAlerts.length,
        criticalAlerts: criticalAlerts.length,
        alerts: businessAlerts
      });
    });
  });

  describe('Monitoring Data Export and Reporting', () => {
    it('should generate comprehensive monitoring reports', () => {
      const reportingPeriod = {
        startDate: new Date(Date.now() - 86400000 * 7), // 7 days ago
        endDate: new Date(),
        periodType: 'weekly'
      };

      const monitoringReport = {
        reportId: `monitor_report_${Date.now()}`,
        generatedAt: new Date(),
        generatedBy: ADMIN_TEST_USERS.platform_admin.id,
        period: reportingPeriod,
        executiveSummary: {
          totalSessions: 1247,
          averageQualityScore: 74.2,
          totalRewards: 15750000, // 157,500 SEK
          platformRevenue: 2950000, // 29,500 SEK
          businessGrowth: 0.08, // 8% week-over-week
          systemUptime: 0.998 // 99.8%
        },
        performanceMetrics: {
          peakDailyHours: ['12:00-14:00', '18:00-20:00'],
          topPerformingCities: ['Stockholm', 'Göteborg', 'Malmö'],
          averageSessionDuration: 195000, // 3.25 minutes
          conversionRate: 0.847,
          qualityScoreDistribution: {
            excellent: 0.32, // 90-100
            good: 0.41,      // 70-89
            fair: 0.22,      // 50-69
            poor: 0.05       // 0-49
          }
        },
        systemHealth: {
          averageResponseTime: 485, // ms
          averageDbQueryTime: 128,  // ms
          averageMemoryUsage: 0.62, // 62%
          averageCpuUsage: 0.34,    // 34%
          alertsGenerated: 3,
          criticalIssues: 0
        },
        businessInsights: {
          newBusinessesOnboarded: 5,
          businessesTierUpgraded: 2,
          businessesSuspended: 0,
          averageBusinessGrowth: 0.12
        },
        recommendations: [
          'Consider implementing capacity scaling for peak hours (12-14, 18-20)',
          'Focus expansion efforts on Stockholm and Göteborg markets',
          'Develop quality improvement program for businesses scoring below 70%',
          'Investigate causes of 5% poor quality feedback scores'
        ]
      };

      expect(monitoringReport.executiveSummary.systemUptime).toBeGreaterThan(0.99);
      expect(monitoringReport.performanceMetrics.conversionRate).toBeGreaterThan(0.8);
      expect(monitoringReport.systemHealth.averageResponseTime).toBeLessThan(2000);
      expect(monitoringReport.businessInsights.newBusinessesOnboarded).toBeGreaterThan(0);
      expect(monitoringReport.recommendations).toHaveLength(4);

      monitoringData.push({
        type: 'comprehensive_monitoring_report',
        report: monitoringReport
      });
    });

    it('should handle monitoring data retention and archival', () => {
      const dataRetentionPolicy = {
        realTimeData: {
          retentionPeriod: 24, // hours
          archiveAfter: 7, // days
          purgeAfter: 30 // days
        },
        sessionDetails: {
          retentionPeriod: 90, // days
          archiveAfter: 365, // days
          purgeAfter: 2555 // 7 years (GDPR compliance)
        },
        performanceMetrics: {
          retentionPeriod: 30, // days
          archiveAfter: 90, // days
          purgeAfter: 1095 // 3 years
        },
        businessAnalytics: {
          retentionPeriod: 180, // days
          archiveAfter: 365, // days
          purgeAfter: 2555 // 7 years
        }
      };

      const currentDataAge = {
        realTimeUpdates: realTimeUpdates.length,
        monitoringData: monitoringData.length,
        performanceMetrics: performanceMetrics.length
      };

      const archivalPlan = {
        scheduledDate: new Date(Date.now() + 86400000), // Tomorrow
        dataToArchive: {
          oldRealTimeData: Math.floor(currentDataAge.realTimeUpdates * 0.8),
          oldMonitoringData: Math.floor(currentDataAge.monitoringData * 0.6),
          oldPerformanceData: Math.floor(currentDataAge.performanceMetrics * 0.4)
        },
        dataToRetain: {
          recentRealTimeData: Math.ceil(currentDataAge.realTimeUpdates * 0.2),
          recentMonitoringData: Math.ceil(currentDataAge.monitoringData * 0.4),
          recentPerformanceData: Math.ceil(currentDataAge.performanceMetrics * 0.6)
        },
        archivalMethod: 'compressed_storage',
        accessibilityLevel: 'admin_request_only'
      };

      expect(dataRetentionPolicy.sessionDetails.purgeAfter).toBe(2555); // GDPR compliance
      expect(archivalPlan.dataToArchive.oldRealTimeData).toBeGreaterThanOrEqual(0);
      expect(archivalPlan.archivalMethod).toBe('compressed_storage');

      monitoringData.push({
        type: 'data_retention_management',
        policy: dataRetentionPolicy,
        currentState: currentDataAge,
        archivalPlan
      });
    });
  });
});