const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

// Swedish Financial Authority (Finansinspektionen) Compliance Logger
// TEST MODE - Mock reporting for demonstration

console.log('🏛️ Starting Swedish Compliance Logger (TEST MODE)');

// Database connection
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const COMPLIANCE_ENDPOINT = process.env.COMPLIANCE_ENDPOINT || 'http://finansinspektionen-mock:3000';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Compliance logging functions
function log(level, message, data = {}) {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  const logEntry = {
    timestamp,
    level,
    message,
    data: { ...data, test_mode: true }
  };
  
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, 
    Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
  
  // Write to compliance log file
  fs.appendFile('/var/log/compliance/compliance.log', 
    JSON.stringify(logEntry) + '\n').catch(console.error);
}

// Swedish PSD2 Compliance Reporter
class SwedishComplianceReporter {
  constructor() {
    this.reportTypes = {
      MONTHLY_SUMMARY: 'monthly_payment_summary',
      TRANSACTION_DETAIL: 'transaction_detail_report', 
      COMPLIANCE_ISSUE: 'compliance_issue_report',
      CUSTOMER_COMPLAINT: 'customer_complaint_report',
      SYSTEM_INCIDENT: 'system_incident_report'
    };
    
    this.severityLevels = {
      LOW: 'low',
      MEDIUM: 'medium', 
      HIGH: 'high',
      CRITICAL: 'critical'
    };
  }

  // Generate monthly summary report for Finansinspektionen
  async generateMonthlySummary(year, month) {
    log('info', 'Generating monthly compliance summary', { year, month });
    
    try {
      // Get payment statistics for the month
      const startDate = moment({ year, month: month - 1 }).startOf('month');
      const endDate = moment({ year, month: month - 1 }).endOf('month');
      
      const paymentStats = await dbPool.query(`
        SELECT 
          COUNT(*) as total_payments,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_payments,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_amount_sek,
          AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as avg_payment_sek,
          COUNT(DISTINCT business_id) as active_businesses,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM payments_test 
        WHERE created_at >= $1 AND created_at <= $2
      `, [startDate.toISOString(), endDate.toISOString()]);

      const stats = paymentStats.rows[0];

      // Get business breakdown
      const businessBreakdown = await dbPool.query(`
        SELECT 
          bt.name as business_name,
          bt.org_number,
          bt.tier,
          blt.region,
          COUNT(*) as payment_count,
          SUM(p.amount) as total_amount
        FROM payments_test p
        JOIN businesses_test bt ON p.business_id = bt.id
        JOIN business_locations_test blt ON p.location_id = blt.id
        WHERE p.created_at >= $1 AND p.created_at <= $2
        GROUP BY bt.id, bt.name, bt.org_number, bt.tier, blt.region
        ORDER BY total_amount DESC
      `, [startDate.toISOString(), endDate.toISOString()]);

      // Get compliance events
      const complianceEvents = await dbPool.query(`
        SELECT type, severity, COUNT(*) as event_count
        FROM compliance_events 
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY type, severity
        ORDER BY event_count DESC
      `, [startDate.toISOString(), endDate.toISOString()]);

      const report = {
        report_id: uuidv4(),
        report_type: this.reportTypes.MONTHLY_SUMMARY,
        period: {
          year,
          month,
          start_date: startDate.format('YYYY-MM-DD'),
          end_date: endDate.format('YYYY-MM-DD')
        },
        generated_at: moment().toISOString(),
        test_mode: true,
        regulatory_authority: 'Finansinspektionen (Sweden)',
        reporting_entity: {
          name: 'AI Feedback Platform AB',
          org_number: '5569999999',
          address: 'Test Address 123, Stockholm, Sweden',
          contact: 'compliance@ai-feedback.se'
        },
        summary: {
          total_payments: parseInt(stats.total_payments),
          successful_payments: parseInt(stats.successful_payments),
          failed_payments: parseInt(stats.failed_payments), 
          success_rate: stats.total_payments > 0 ? 
            (parseInt(stats.successful_payments) / parseInt(stats.total_payments) * 100).toFixed(2) : '0.00',
          total_amount_sek: parseFloat(stats.total_amount_sek || 0),
          average_payment_sek: parseFloat(stats.avg_payment_sek || 0),
          active_businesses: parseInt(stats.active_businesses),
          unique_customers: parseInt(stats.unique_customers)
        },
        business_breakdown: businessBreakdown.rows.map(row => ({
          business_name: row.business_name,
          org_number: row.org_number,
          tier: row.tier,
          region: row.region,
          payment_count: parseInt(row.payment_count),
          total_amount_sek: parseFloat(row.total_amount)
        })),
        compliance_events: complianceEvents.rows.map(row => ({
          event_type: row.type,
          severity: row.severity,
          count: parseInt(row.event_count)
        })),
        regulatory_compliance: {
          psd2_compliant: true,
          gdpr_compliant: true,
          local_regulations: ['Swedish Payment Services Act', 'Consumer Protection Act'],
          aml_checks_performed: parseInt(stats.total_payments),
          fraud_detection_active: true
        },
        technical_metrics: {
          system_uptime: '99.9%',
          average_processing_time_seconds: 1.2,
          payment_security_incidents: 0,
          data_breaches: 0
        }
      };

      // Save report to database
      await dbPool.query(`
        INSERT INTO fi_reports_test (
          id, report_type, period_start, period_end, 
          business_count, transaction_count, total_amount_sek,
          report_data, compliance_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        report.report_id,
        report.report_type,
        startDate.toDate(),
        endDate.toDate(),
        report.summary.active_businesses,
        report.summary.total_payments,
        report.summary.total_amount_sek,
        JSON.stringify(report),
        'generated'
      ]);

      log('info', 'Monthly compliance report generated', {
        report_id: report.report_id,
        period: `${year}-${month}`,
        total_payments: report.summary.total_payments,
        total_amount_sek: report.summary.total_amount_sek
      });

      return report;
      
    } catch (error) {
      log('error', 'Failed to generate monthly compliance report', { 
        error: error.message,
        year,
        month
      });
      throw error;
    }
  }

  // Submit report to mock Finansinspektionen API
  async submitToFinansinspektionen(report) {
    log('info', 'Submitting compliance report to Finansinspektionen (MOCK)', {
      report_id: report.report_id,
      report_type: report.report_type
    });

    try {
      const axios = require('axios');
      const submission = {
        report_id: report.report_id,
        submission_timestamp: moment().toISOString(),
        reporting_entity: report.reporting_entity,
        report_data: report,
        digital_signature: `mock_signature_${uuidv4()}`,
        test_submission: true
      };

      const response = await axios.post(`${COMPLIANCE_ENDPOINT}/reports/submit`, submission, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FI_TEST_API_KEY || 'test_key'}`,
          'X-Test-Mode': 'true'
        }
      });

      // Update database with submission status
      await dbPool.query(`
        UPDATE fi_reports_test 
        SET submitted_to_fi = TRUE, 
            fi_reference_number = $1,
            compliance_status = $2,
            submitted_at = NOW()
        WHERE id = $3
      `, [response.data.reference_number, 'submitted', report.report_id]);

      log('info', 'Report successfully submitted to Finansinspektionen', {
        report_id: report.report_id,
        fi_reference: response.data.reference_number,
        status: response.status
      });

      return response.data;

    } catch (error) {
      log('error', 'Failed to submit report to Finansinspektionen', {
        report_id: report.report_id,
        error: error.message
      });

      // Update database with failure status
      await dbPool.query(`
        UPDATE fi_reports_test 
        SET compliance_status = $1
        WHERE id = $2
      `, ['submission_failed', report.report_id]);

      throw error;
    }
  }

  // Generate compliance issue report
  async reportComplianceIssue(issueType, severity, details) {
    log('warn', 'Reporting compliance issue', { issueType, severity, details });

    const report = {
      report_id: uuidv4(),
      report_type: this.reportTypes.COMPLIANCE_ISSUE,
      issue_type: issueType,
      severity: severity,
      details: details,
      reported_at: moment().toISOString(),
      test_mode: true,
      regulatory_authority: 'Finansinspektionen (Sweden)',
      corrective_actions: {
        immediate: details.immediate_actions || [],
        planned: details.planned_actions || [],
        timeline: details.timeline || 'Within 30 days'
      }
    };

    // Save to database
    await dbPool.query(`
      INSERT INTO compliance_events (type, severity, data)
      VALUES ($1, $2, $3)
    `, ['compliance_issue', severity, JSON.stringify(report)]);

    // If critical, submit immediately
    if (severity === this.severityLevels.CRITICAL) {
      await this.submitToFinansinspektionen(report);
    }

    return report;
  }

  // Monitor and report on system compliance status
  async performComplianceCheck() {
    log('info', 'Performing routine compliance check');

    try {
      const checks = {
        payment_processing: await this.checkPaymentProcessingCompliance(),
        data_protection: await this.checkDataProtectionCompliance(),
        fraud_detection: await this.checkFraudDetectionCompliance(),
        customer_rights: await this.checkCustomerRightsCompliance(),
        reporting_accuracy: await this.checkReportingAccuracy()
      };

      const overallCompliance = Object.values(checks).every(check => check.compliant);
      
      log('info', 'Compliance check completed', {
        overall_compliant: overallCompliance,
        check_results: checks
      });

      // Log any non-compliance issues
      Object.entries(checks).forEach(([checkType, result]) => {
        if (!result.compliant) {
          this.reportComplianceIssue(checkType, result.severity, result.details);
        }
      });

      return { overall_compliant: overallCompliance, checks };

    } catch (error) {
      log('error', 'Compliance check failed', { error: error.message });
      throw error;
    }
  }

  // Individual compliance check methods
  async checkPaymentProcessingCompliance() {
    // Check for payment processing compliance (mock implementation)
    return {
      compliant: true,
      last_checked: moment().toISOString(),
      details: {
        psd2_compliant: true,
        processing_time_compliant: true,
        error_rate_acceptable: true
      }
    };
  }

  async checkDataProtectionCompliance() {
    return {
      compliant: true,
      last_checked: moment().toISOString(),
      details: {
        gdpr_compliant: true,
        data_retention_compliant: true,
        anonymization_active: true
      }
    };
  }

  async checkFraudDetectionCompliance() {
    return {
      compliant: true,
      last_checked: moment().toISOString(),
      details: {
        aml_checks_active: true,
        fraud_monitoring_active: true,
        suspicious_activity_reporting: true
      }
    };
  }

  async checkCustomerRightsCompliance() {
    return {
      compliant: true,
      last_checked: moment().toISOString(),
      details: {
        complaint_handling_active: true,
        data_access_rights_implemented: true,
        refund_process_compliant: true
      }
    };
  }

  async checkReportingAccuracy() {
    return {
      compliant: true,
      last_checked: moment().toISOString(),
      details: {
        report_generation_accurate: true,
        data_integrity_verified: true,
        submission_process_working: true
      }
    };
  }
}

// Main execution
async function main() {
  const reporter = new SwedishComplianceReporter();

  try {
    // Test database connection
    await dbPool.query('SELECT 1');
    log('info', 'Database connection established');

    // Perform initial compliance check
    await reporter.performComplianceCheck();

    // Generate current month report (for testing)
    const now = moment();
    const report = await reporter.generateMonthlySummary(now.year(), now.month() + 1);

    // Submit to mock FI API
    try {
      await reporter.submitToFinansinspektionen(report);
    } catch (submitError) {
      log('warn', 'Report generation succeeded but submission failed', {
        error: submitError.message
      });
    }

    log('info', 'Compliance logging completed successfully');

  } catch (error) {
    log('error', 'Compliance logging failed', { error: error.message });
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  log('info', 'Received SIGTERM, shutting down gracefully');
  await dbPool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log('info', 'Received SIGINT, shutting down gracefully'); 
  await dbPool.end();
  process.exit(0);
});

// Run main function
main().catch(error => {
  console.error('Fatal error in compliance logger:', error);
  process.exit(1);
});