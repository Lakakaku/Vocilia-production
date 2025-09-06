const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

// TEST to LIVE Migration System for Swedish Pilot
// Seamless transition from test environment to production

console.log('🚀 AI Feedback Platform - TEST to LIVE Migration System');
console.log('🇸🇪 Swedish Pilot Migration Preparation');

class TestToLiveMigrator {
  constructor() {
    this.testDb = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000
    });

    this.prodDb = process.env.PRODUCTION_DATABASE_URL ? new Pool({
      connectionString: process.env.PRODUCTION_DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000
    }) : null;

    this.migrationMode = process.env.MIGRATION_MODE || 'prepare';
    this.dryRun = process.env.DRY_RUN === 'true';
    
    this.migrationSteps = [
      'validate_test_environment',
      'prepare_production_schema',
      'migrate_business_data',
      'migrate_compliance_framework',
      'migrate_configuration',
      'validate_production_environment',
      'switch_dns_and_routing',
      'verify_live_system'
    ];
  }

  log(level, message, data = {}) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, 
      Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
  }

  // Step 1: Validate test environment readiness
  async validateTestEnvironment() {
    this.log('info', 'Validating test environment readiness for migration');

    const validations = {
      database_connectivity: false,
      test_data_integrity: false,
      compliance_records: false,
      business_configuration: false,
      swedish_pilot_data: false
    };

    try {
      // Check database connectivity
      await this.testDb.query('SELECT 1');
      validations.database_connectivity = true;
      this.log('success', 'Test database connectivity verified');

      // Validate test data integrity
      const dataIntegrityResults = await this.testDb.query(`
        SELECT 
          (SELECT COUNT(*) FROM payments_test) as payment_count,
          (SELECT COUNT(*) FROM businesses_test) as business_count,
          (SELECT COUNT(*) FROM business_locations_test) as location_count,
          (SELECT COUNT(*) FROM compliance_events) as compliance_event_count,
          (SELECT COUNT(*) FROM fi_reports_test) as fi_report_count
      `);

      const counts = dataIntegrityResults.rows[0];
      if (Object.values(counts).every(count => parseInt(count) > 0)) {
        validations.test_data_integrity = true;
        this.log('success', 'Test data integrity validated', counts);
      }

      // Check compliance records
      const complianceCheck = await this.testDb.query(`
        SELECT COUNT(*) as compliant_businesses
        FROM businesses_test 
        WHERE compliance_verified = true
      `);

      if (parseInt(complianceCheck.rows[0].compliant_businesses) > 0) {
        validations.compliance_records = true;
        this.log('success', 'Compliance records validated');
      }

      // Validate business configuration
      const businessConfig = await this.testDb.query(`
        SELECT 
          COUNT(*) as active_businesses,
          COUNT(CASE WHEN stripe_account_id IS NOT NULL THEN 1 END) as configured_payments
        FROM businesses_test 
        WHERE status = 'active'
      `);

      const businessCounts = businessConfig.rows[0];
      if (parseInt(businessCounts.active_businesses) > 0) {
        validations.business_configuration = true;
        this.log('success', 'Business configuration validated', businessCounts);
      }

      // Check Swedish pilot specific data
      const swedishPilotCheck = await this.testDb.query(`
        SELECT 
          COUNT(DISTINCT bl.region) as regions_covered,
          COUNT(*) as swedish_locations
        FROM business_locations_test bl
        WHERE bl.address_country = 'SE'
      `);

      const swedishData = swedishPilotCheck.rows[0];
      if (parseInt(swedishData.regions_covered) >= 3) { // Stockholm, Gothenburg, Malmö
        validations.swedish_pilot_data = true;
        this.log('success', 'Swedish pilot data validated', swedishData);
      }

      const overallValid = Object.values(validations).every(v => v);
      
      this.log('info', 'Test environment validation completed', {
        overall_valid: overallValid,
        validations
      });

      return { valid: overallValid, details: validations };

    } catch (error) {
      this.log('error', 'Test environment validation failed', { error: error.message });
      throw error;
    }
  }

  // Step 2: Prepare production schema
  async prepareProductionSchema() {
    this.log('info', 'Preparing production database schema');

    if (!this.prodDb) {
      this.log('warning', 'Production database not configured, generating migration scripts only');
      return await this.generateMigrationScripts();
    }

    if (this.dryRun) {
      this.log('info', 'DRY RUN: Would prepare production schema');
      return { success: true, dry_run: true };
    }

    try {
      // Create production tables (similar to test but without _test suffix)
      const productionSchema = await fs.readFile(
        path.join(__dirname, '../test-data/db-init/01-init-payments-test.sql'), 
        'utf8'
      );

      // Transform test schema to production schema
      const prodSchema = productionSchema
        .replace(/payments_test/g, 'payments')
        .replace(/businesses_test/g, 'businesses')
        .replace(/business_locations_test/g, 'business_locations')
        .replace(/feedback_sessions_test/g, 'feedback_sessions')
        .replace(/fi_reports_test/g, 'fi_reports')
        .replace(/test_mode BOOLEAN DEFAULT TRUE/g, 'test_mode BOOLEAN DEFAULT FALSE')
        .replace(/pilot_participant BOOLEAN DEFAULT TRUE/g, 'pilot_participant BOOLEAN DEFAULT FALSE')
        .replace(/test_location BOOLEAN DEFAULT TRUE/g, 'test_location BOOLEAN DEFAULT FALSE')
        .replace(/test_session BOOLEAN DEFAULT TRUE/g, 'test_session BOOLEAN DEFAULT FALSE')
        .replace(/test_report BOOLEAN DEFAULT TRUE/g, 'test_report BOOLEAN DEFAULT FALSE');

      // Save production schema
      await fs.writeFile(
        path.join(__dirname, '../migration-artifacts/production-schema.sql'),
        prodSchema
      );

      this.log('success', 'Production schema prepared and saved');
      return { success: true, schema_file: 'production-schema.sql' };

    } catch (error) {
      this.log('error', 'Production schema preparation failed', { error: error.message });
      throw error;
    }
  }

  // Step 3: Migrate business data
  async migrateBusinessData() {
    this.log('info', 'Preparing business data migration');

    try {
      // Extract production-ready business data from test environment
      const businessData = await this.testDb.query(`
        SELECT 
          b.*,
          array_agg(
            json_build_object(
              'location_data', row_to_json(bl.*),
              'performance_metrics', (
                SELECT json_build_object(
                  'total_payments', COUNT(p.id),
                  'total_amount_sek', COALESCE(SUM(p.amount), 0),
                  'avg_feedback_score', COALESCE(AVG(fs.feedback_quality_score), 0)
                )
                FROM payments_test p
                LEFT JOIN feedback_sessions_test fs ON p.id = fs.payment_id
                WHERE p.business_id = b.id AND p.location_id = bl.id
              )
            )
          ) as locations_data
        FROM businesses_test b
        LEFT JOIN business_locations_test bl ON b.id = bl.business_id
        WHERE b.status = 'active' AND b.compliance_verified = true
        GROUP BY b.id
      `);

      // Prepare migration data
      const migrationData = {
        timestamp: moment().toISOString(),
        migration_type: 'business_data',
        source_environment: 'test',
        target_environment: 'production',
        businesses: businessData.rows.map(business => ({
          ...business,
          // Remove test-specific flags
          pilot_participant: false,
          test_mode: false,
          // Generate new production IDs if needed
          migration_notes: `Migrated from test environment on ${moment().format('YYYY-MM-DD')}`
        }))
      };

      // Save migration data
      await fs.writeFile(
        path.join(__dirname, '../migration-artifacts/business-migration-data.json'),
        JSON.stringify(migrationData, null, 2)
      );

      this.log('success', 'Business data migration prepared', {
        businesses_count: businessData.rows.length,
        file: 'business-migration-data.json'
      });

      return migrationData;

    } catch (error) {
      this.log('error', 'Business data migration preparation failed', { error: error.message });
      throw error;
    }
  }

  // Step 4: Migrate compliance framework
  async migrateComplianceFramework() {
    this.log('info', 'Preparing compliance framework migration');

    try {
      // Extract compliance configuration and templates
      const complianceData = await this.testDb.query(`
        SELECT 
          'compliance_events' as data_type,
          json_agg(
            CASE 
              WHEN type IN ('system_startup', 'compliance_check', 'fi_connection_test') 
              THEN row_to_json(compliance_events.*) 
              ELSE NULL 
            END
          ) FILTER (WHERE type IN ('system_startup', 'compliance_check', 'fi_connection_test')) as configuration_events
        FROM compliance_events
        UNION ALL
        SELECT 
          'fi_reports_template' as data_type,
          json_agg(
            json_build_object(
              'report_type', report_type,
              'template_data', report_data->'template'
            )
          ) as configuration_events
        FROM fi_reports_test
        WHERE report_data ? 'template'
      `);

      // Prepare compliance migration
      const complianceMigration = {
        timestamp: moment().toISOString(),
        migration_type: 'compliance_framework',
        swedish_financial_authority: {
          endpoint: 'https://api.fi.se/reporting/v1', // Production FI endpoint
          test_mode: false,
          compliance_requirements: [
            'PSD2 Compliance',
            'Swedish Payment Services Act',
            'GDPR Data Protection',
            'Consumer Protection Act',
            'AML/CFT Requirements'
          ]
        },
        reporting_schedule: {
          monthly_reports: 'Last day of each month',
          incident_reports: 'Within 24 hours',
          compliance_checks: 'Daily at 02:00 CET'
        },
        data_retention: {
          payment_data: '7 years',
          compliance_logs: '10 years',
          customer_data: 'Until consent withdrawal'
        },
        migration_data: complianceData.rows
      };

      // Save compliance migration
      await fs.writeFile(
        path.join(__dirname, '../migration-artifacts/compliance-migration.json'),
        JSON.stringify(complianceMigration, null, 2)
      );

      this.log('success', 'Compliance framework migration prepared');
      return complianceMigration;

    } catch (error) {
      this.log('error', 'Compliance framework migration preparation failed', { error: error.message });
      throw error;
    }
  }

  // Step 5: Migrate configuration
  async migrateConfiguration() {
    this.log('info', 'Preparing system configuration migration');

    const productionConfig = {
      environment: 'production',
      swedish_pilot: {
        status: 'live',
        launch_date: moment().format('YYYY-MM-DD'),
        regions: ['stockholm', 'gothenburg', 'malmo'],
        regulatory_compliance: true
      },
      payment_gateway: {
        stripe_mode: 'live',
        webhook_endpoints: {
          payments: 'https://api.feedback.your-domain.com/webhooks/stripe',
          compliance: 'https://api.feedback.your-domain.com/webhooks/compliance'
        },
        supported_methods: ['card', 'swish', 'bankgiro'],
        currency: 'SEK'
      },
      database: {
        connection_pool_size: 20,
        max_connections: 100,
        backup_schedule: '0 2 * * *', // Daily at 2 AM
        retention_policy: '7 years'
      },
      monitoring: {
        prometheus_enabled: true,
        grafana_enabled: true,
        alerting_enabled: true,
        notification_channels: ['slack', 'email', 'pagerduty']
      },
      compliance: {
        finansinspektionen_reporting: true,
        gdpr_compliance: true,
        data_protection_officer: 'dpo@feedback.your-domain.com',
        audit_logging: true
      },
      security: {
        encryption_at_rest: true,
        encryption_in_transit: true,
        access_logging: true,
        rate_limiting: true,
        fraud_detection: true
      }
    };

    // Save production configuration
    await fs.writeFile(
      path.join(__dirname, '../migration-artifacts/production-config.json'),
      JSON.stringify(productionConfig, null, 2)
    );

    this.log('success', 'Production configuration prepared');
    return productionConfig;
  }

  // Generate migration scripts
  async generateMigrationScripts() {
    this.log('info', 'Generating migration execution scripts');

    const migrationScript = `#!/bin/bash

# AI Feedback Platform - TEST to LIVE Migration Script
# Swedish Pilot Production Deployment

set -euo pipefail

echo "🇸🇪 AI Feedback Platform - Swedish Pilot Production Migration"
echo "=================================================="

# Configuration
MIGRATION_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")/../migration-artifacts" && pwd)"
BACKUP_DIR="/opt/ai-feedback/migration-backups"
LOG_FILE="/var/log/ai-feedback/migration-\$(date +%Y%m%d_%H%M%S).log"

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log() {
    echo -e "\${BLUE}[\$(date '+%Y-%m-%d %H:%M:%S')] [MIGRATION] [INFO]\${NC} \$1" | tee -a "\$LOG_FILE"
}

log_success() {
    echo -e "\${GREEN}[\$(date '+%Y-%m-%d %H:%M:%S')] [MIGRATION] [SUCCESS]\${NC} \$1" | tee -a "\$LOG_FILE"
}

log_error() {
    echo -e "\${RED}[\$(date '+%Y-%m-%d %H:%M:%S')] [MIGRATION] [ERROR]\${NC} \$1" | tee -a "\$LOG_FILE"
}

# Pre-migration checks
pre_migration_checks() {
    log "Performing pre-migration checks..."
    
    # Check required environment variables
    local required_vars=(
        "PRODUCTION_DATABASE_URL"
        "STRIPE_LIVE_SECRET_KEY"
        "STRIPE_LIVE_WEBHOOK_SECRET"
        "PRODUCTION_DOMAIN"
    )
    
    for var in "\${required_vars[@]}"; do
        if [[ -z "\${!var:-}" ]]; then
            log_error "Required environment variable \$var is not set"
            exit 1
        fi
    done
    
    log_success "Pre-migration checks passed"
}

# Deploy production schema
deploy_production_schema() {
    log "Deploying production database schema..."
    
    if psql "\$PRODUCTION_DATABASE_URL" -f "\$MIGRATION_DIR/production-schema.sql"; then
        log_success "Production schema deployed successfully"
    else
        log_error "Failed to deploy production schema"
        exit 1
    fi
}

# Migrate business data
migrate_business_data() {
    log "Migrating business data to production..."
    
    # Load business migration data using Node.js script
    if node "\$MIGRATION_DIR/../migration/data-migrator.js"; then
        log_success "Business data migrated successfully"
    else
        log_error "Failed to migrate business data"
        exit 1
    fi
}

# Configure production services
configure_production_services() {
    log "Configuring production services..."
    
    # Deploy production Docker stack
    if docker stack deploy -c docker-compose.prod.yml ai-feedback-production; then
        log_success "Production services deployed"
    else
        log_error "Failed to deploy production services"
        exit 1
    fi
}

# Verify production deployment
verify_production_deployment() {
    log "Verifying production deployment..."
    
    local health_checks=(
        "https://\$PRODUCTION_DOMAIN/api/health"
        "https://business.\$PRODUCTION_DOMAIN/api/health"
        "https://api.\$PRODUCTION_DOMAIN/payments/health"
    )
    
    for endpoint in "\${health_checks[@]}"; do
        if curl -f "\$endpoint" &> /dev/null; then
            log_success "Health check passed: \$endpoint"
        else
            log_error "Health check failed: \$endpoint"
            exit 1
        fi
    done
    
    log_success "Production deployment verified"
}

# Main migration function
main() {
    log "Starting TEST to LIVE migration..."
    
    mkdir -p "\$(dirname "\$LOG_FILE")"
    mkdir -p "\$BACKUP_DIR"
    
    pre_migration_checks
    deploy_production_schema
    migrate_business_data
    configure_production_services
    verify_production_deployment
    
    log_success "🎉 Migration completed successfully!"
    log "Production system is now live at https://\$PRODUCTION_DOMAIN"
    log "Business portal available at https://business.\$PRODUCTION_DOMAIN"
    log "Swedish pilot is ready for public use"
}

# Execute migration
main "\$@"
`;

    await fs.writeFile(
      path.join(__dirname, '../migration-artifacts/migrate-to-production.sh'),
      migrationScript
    );

    // Make script executable
    await fs.chmod(
      path.join(__dirname, '../migration-artifacts/migrate-to-production.sh'),
      0o755
    );

    this.log('success', 'Migration scripts generated');
  }

  // Main migration orchestrator
  async executeMigration() {
    this.log('info', `Starting migration in ${this.migrationMode} mode${this.dryRun ? ' (DRY RUN)' : ''}`);

    const migrationResults = {
      started_at: moment().toISOString(),
      mode: this.migrationMode,
      dry_run: this.dryRun,
      steps: {},
      overall_success: true
    };

    try {
      // Execute migration steps
      for (const step of this.migrationSteps) {
        this.log('info', `Executing migration step: ${step}`);
        
        try {
          let result;
          switch (step) {
            case 'validate_test_environment':
              result = await this.validateTestEnvironment();
              break;
            case 'prepare_production_schema':
              result = await this.prepareProductionSchema();
              break;
            case 'migrate_business_data':
              result = await this.migrateBusinessData();
              break;
            case 'migrate_compliance_framework':
              result = await this.migrateComplianceFramework();
              break;
            case 'migrate_configuration':
              result = await this.migrateConfiguration();
              break;
            default:
              this.log('info', `Step ${step} prepared for manual execution`);
              result = { success: true, manual_step: true };
          }
          
          migrationResults.steps[step] = { success: true, result };
          this.log('success', `Migration step completed: ${step}`);
          
        } catch (stepError) {
          migrationResults.steps[step] = { success: false, error: stepError.message };
          migrationResults.overall_success = false;
          this.log('error', `Migration step failed: ${step}`, { error: stepError.message });
        }
      }

      // Generate final migration artifacts
      await this.generateMigrationScripts();

      migrationResults.completed_at = moment().toISOString();
      migrationResults.duration = moment().diff(moment(migrationResults.started_at), 'seconds');

      // Save migration results
      await fs.writeFile(
        path.join(__dirname, '../migration-artifacts/migration-results.json'),
        JSON.stringify(migrationResults, null, 2)
      );

      if (migrationResults.overall_success) {
        this.log('success', '🎉 Migration preparation completed successfully!');
        this.log('info', 'Next steps:');
        this.log('info', '1. Review migration artifacts in migration-artifacts/');
        this.log('info', '2. Set production environment variables');
        this.log('info', '3. Execute: ./migration-artifacts/migrate-to-production.sh');
        this.log('info', '4. Monitor production deployment');
      } else {
        this.log('error', '❌ Migration preparation completed with errors');
        this.log('info', 'Please review migration results and fix issues before proceeding');
      }

      return migrationResults;

    } catch (error) {
      this.log('error', 'Migration failed', { error: error.message });
      migrationResults.overall_success = false;
      migrationResults.fatal_error = error.message;
      throw error;
    } finally {
      await this.testDb.end();
      if (this.prodDb) {
        await this.prodDb.end();
      }
    }
  }
}

// Main execution
async function main() {
  try {
    const migrator = new TestToLiveMigrator();
    const results = await migrator.executeMigration();
    
    console.log('\\n📋 Migration Summary:');
    console.log(`Overall Success: ${results.overall_success ? '✅' : '❌'}`);
    console.log(`Duration: ${results.duration} seconds`);
    console.log(`Steps Completed: ${Object.keys(results.steps).length}/${migrator.migrationSteps.length}`);
    
    process.exit(results.overall_success ? 0 : 1);
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down migration process...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down migration process...');
  process.exit(0);
});

// Execute if running directly
if (require.main === module) {
  main();
}

module.exports = { TestToLiveMigrator };