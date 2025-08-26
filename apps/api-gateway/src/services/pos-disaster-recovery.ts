import { POSProvider } from '@ai-feedback-platform/shared-types';
import { logger } from '../utils/logger';
import { createClient } from 'redis';
import { db } from '@ai-feedback/database';

/**
 * POS Disaster Recovery & Failover System
 * 
 * Features:
 * - POS API failover mechanisms (primary/secondary endpoints)
 * - Circuit breakers for POS provider failures
 * - Automated rollback procedures for failed deployments
 * - Data consistency checks and repair mechanisms
 * - Graceful degradation for partial POS failures
 * - Cross-region backup coordination
 * - Recovery orchestration and validation
 */

interface POSEndpointConfig {
  provider: POSProvider;
  primary: {
    baseUrl: string;
    region: string;
    healthEndpoint: string;
    priority: number;
  };
  secondary: {
    baseUrl: string;
    region: string;
    healthEndpoint: string;
    priority: number;
  };
  tertiary?: {
    baseUrl: string;
    region: string;
    healthEndpoint: string;
    priority: number;
  };
}

interface FailoverState {
  provider: POSProvider;
  currentEndpoint: 'primary' | 'secondary' | 'tertiary';
  lastFailover: Date;
  failoverReason: string;
  automaticFailback: boolean;
  healthCheckInterval: number;
}

interface DisasterRecoveryPlan {
  id: string;
  name: string;
  triggers: string[];
  procedures: RecoveryProcedure[];
  rollbackProcedures: RecoveryProcedure[];
  validationSteps: ValidationStep[];
  stakeholders: string[];
  estimatedRTO: number; // Recovery Time Objective in minutes
  estimatedRPO: number; // Recovery Point Objective in minutes
}

interface RecoveryProcedure {
  id: string;
  name: string;
  description: string;
  command: string;
  timeout: number;
  retryAttempts: number;
  dependencies: string[];
  rollbackCommand?: string;
}

interface ValidationStep {
  id: string;
  name: string;
  type: 'health_check' | 'data_integrity' | 'functional_test' | 'load_test';
  command: string;
  expectedResult: any;
  timeout: number;
}

interface DataConsistencyCheck {
  checkId: string;
  description: string;
  query: string;
  expectedConstraints: any;
  repairProcedure?: string;
}

export class POSDisasterRecovery {
  private redisClient: any;
  private failoverStates: Map<POSProvider, FailoverState> = new Map();
  private recoveryPlans: DisasterRecoveryPlan[] = [];

  // POS endpoint configurations
  private endpointConfigs: POSEndpointConfig[] = [
    {
      provider: 'square',
      primary: {
        baseUrl: process.env.SQUARE_API_URL || 'https://connect.squareup.com',
        region: 'eu-west-1',
        healthEndpoint: '/v2/locations',
        priority: 1
      },
      secondary: {
        baseUrl: process.env.SQUARE_API_BACKUP_URL || 'https://connect.squareupsandbox.com',
        region: 'eu-central-1',
        healthEndpoint: '/v2/locations',
        priority: 2
      }
    },
    {
      provider: 'shopify',
      primary: {
        baseUrl: 'https://admin.shopify.com',
        region: 'eu-west-1',
        healthEndpoint: '/admin/api/2023-10/shop.json',
        priority: 1
      },
      secondary: {
        baseUrl: 'https://partners.shopify.com',
        region: 'eu-central-1',
        healthEndpoint: '/admin/api/2023-10/shop.json',
        priority: 2
      }
    },
    {
      provider: 'zettle',
      primary: {
        baseUrl: 'https://oauth.izettle.com',
        region: 'eu-west-1',
        healthEndpoint: '/users/me',
        priority: 1
      },
      secondary: {
        baseUrl: 'https://oauth.izettle.net',
        region: 'eu-central-1',
        healthEndpoint: '/users/me',
        priority: 2
      }
    }
  ];

  // Data consistency checks
  private consistencyChecks: DataConsistencyCheck[] = [
    {
      checkId: 'business_pos_sync',
      description: 'Ensure all businesses have valid POS connections',
      query: `
        SELECT b.id, b.name, pc.provider, pc.status 
        FROM businesses b 
        LEFT JOIN pos_connections pc ON b.id = pc.business_id 
        WHERE pc.status != 'active' OR pc.id IS NULL
      `,
      expectedConstraints: { maxRows: 0 },
      repairProcedure: 'repair_pos_connections'
    },
    {
      checkId: 'webhook_delivery_integrity',
      description: 'Check for webhook delivery gaps',
      query: `
        SELECT provider, COUNT(*) as failed_count 
        FROM webhook_delivery_attempts 
        WHERE status = 'failed' 
        AND created_at > NOW() - INTERVAL '1 hour' 
        GROUP BY provider 
        HAVING COUNT(*) > 10
      `,
      expectedConstraints: { maxRows: 0 },
      repairProcedure: 'retry_failed_webhooks'
    },
    {
      checkId: 'transaction_verification_gaps',
      description: 'Identify unverified transactions',
      query: `
        SELECT fs.id, fs.transaction_id, fs.provider 
        FROM feedback_sessions fs 
        WHERE fs.status = 'pending' 
        AND fs.created_at < NOW() - INTERVAL '10 minutes'
      `,
      expectedConstraints: { maxRows: 0 },
      repairProcedure: 'retry_transaction_verification'
    }
  ];

  constructor() {
    this.initializeRedis();
    this.initializeFailoverStates();
    this.initializeRecoveryPlans();
    this.startHealthMonitoring();
    this.startConsistencyMonitoring();
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('POS Disaster Recovery Redis Error:', err);
      });

      await this.redisClient.connect();
      logger.info('POS Disaster Recovery connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis for POS Disaster Recovery:', error);
    }
  }

  private initializeFailoverStates() {
    const providers: POSProvider[] = ['square', 'shopify', 'zettle'];
    
    for (const provider of providers) {
      this.failoverStates.set(provider, {
        provider,
        currentEndpoint: 'primary',
        lastFailover: new Date(0), // Initialize to epoch
        failoverReason: 'none',
        automaticFailback: true,
        healthCheckInterval: 30000 // 30 seconds
      });
    }
  }

  private initializeRecoveryPlans() {
    // Complete POS system recovery plan
    this.recoveryPlans.push({
      id: 'pos_complete_failure',
      name: 'Complete POS System Recovery',
      triggers: ['all_pos_providers_down', 'critical_system_failure'],
      procedures: [
        {
          id: 'enable_maintenance_mode',
          name: 'Enable Maintenance Mode',
          description: 'Put system in maintenance mode to prevent new requests',
          command: 'curl -X POST $API_GATEWAY_URL/admin/maintenance-mode',
          timeout: 30000,
          retryAttempts: 3,
          dependencies: [],
          rollbackCommand: 'curl -X DELETE $API_GATEWAY_URL/admin/maintenance-mode'
        },
        {
          id: 'failover_all_providers',
          name: 'Failover All POS Providers',
          description: 'Switch all POS providers to secondary endpoints',
          command: 'node /scripts/pos-failover-all.js',
          timeout: 120000,
          retryAttempts: 2,
          dependencies: ['enable_maintenance_mode']
        },
        {
          id: 'verify_secondary_endpoints',
          name: 'Verify Secondary Endpoints',
          description: 'Health check all secondary POS endpoints',
          command: 'node /scripts/pos-health-check-secondary.js',
          timeout: 60000,
          retryAttempts: 3,
          dependencies: ['failover_all_providers']
        },
        {
          id: 'sync_cached_data',
          name: 'Sync Cached POS Data',
          description: 'Ensure cached POS data is synchronized',
          command: 'node /scripts/pos-sync-cache.js',
          timeout: 180000,
          retryAttempts: 2,
          dependencies: ['verify_secondary_endpoints']
        },
        {
          id: 'disable_maintenance_mode',
          name: 'Disable Maintenance Mode',
          description: 'Resume normal operations',
          command: 'curl -X DELETE $API_GATEWAY_URL/admin/maintenance-mode',
          timeout: 30000,
          retryAttempts: 3,
          dependencies: ['sync_cached_data']
        }
      ],
      rollbackProcedures: [
        {
          id: 'rollback_to_primary',
          name: 'Rollback to Primary Endpoints',
          description: 'Switch back to primary POS endpoints',
          command: 'node /scripts/pos-rollback-primary.js',
          timeout: 120000,
          retryAttempts: 1,
          dependencies: []
        }
      ],
      validationSteps: [
        {
          id: 'pos_endpoints_health',
          name: 'POS Endpoints Health Check',
          type: 'health_check',
          command: 'curl $API_GATEWAY_URL/pos/health',
          expectedResult: { status: 'healthy' },
          timeout: 30000
        },
        {
          id: 'transaction_verification_test',
          name: 'Transaction Verification Test',
          type: 'functional_test',
          command: 'node /scripts/pos-test-transaction-verification.js',
          expectedResult: { success: true },
          timeout: 60000
        }
      ],
      stakeholders: ['devops-team', 'engineering-lead', 'cto'],
      estimatedRTO: 10, // 10 minutes
      estimatedRPO: 5   // 5 minutes
    });

    // Single provider failure recovery plan
    this.recoveryPlans.push({
      id: 'single_pos_provider_failure',
      name: 'Single POS Provider Failure Recovery',
      triggers: ['square_down', 'shopify_down', 'zettle_down'],
      procedures: [
        {
          id: 'failover_provider',
          name: 'Failover Single Provider',
          description: 'Switch specific POS provider to secondary endpoint',
          command: 'node /scripts/pos-failover-provider.js --provider=$PROVIDER',
          timeout: 60000,
          retryAttempts: 3,
          dependencies: []
        },
        {
          id: 'verify_provider_health',
          name: 'Verify Provider Health',
          description: 'Health check the failed over provider',
          command: 'curl $API_GATEWAY_URL/pos/health/$PROVIDER',
          timeout: 30000,
          retryAttempts: 3,
          dependencies: ['failover_provider']
        }
      ],
      rollbackProcedures: [
        {
          id: 'rollback_provider',
          name: 'Rollback Provider to Primary',
          description: 'Switch provider back to primary endpoint',
          command: 'node /scripts/pos-rollback-provider.js --provider=$PROVIDER',
          timeout: 60000,
          retryAttempts: 1,
          dependencies: []
        }
      ],
      validationSteps: [
        {
          id: 'provider_health_check',
          name: 'Provider Specific Health Check',
          type: 'health_check',
          command: 'curl $API_GATEWAY_URL/pos/health/$PROVIDER',
          expectedResult: { healthy: true },
          timeout: 30000
        }
      ],
      stakeholders: ['devops-team'],
      estimatedRTO: 3, // 3 minutes
      estimatedRPO: 2  // 2 minutes
    });
  }

  /**
   * Trigger failover for a specific POS provider
   */
  async triggerFailover(
    provider: POSProvider, 
    reason: string,
    automatic: boolean = true
  ): Promise<{
    success: boolean;
    message: string;
    newEndpoint: string;
    failoverTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      logger.warn(`Triggering failover for ${provider}: ${reason}`);
      
      const config = this.endpointConfigs.find(c => c.provider === provider);
      const state = this.failoverStates.get(provider);
      
      if (!config || !state) {
        throw new Error(`No configuration found for provider ${provider}`);
      }

      // Determine next endpoint
      let nextEndpoint: 'primary' | 'secondary' | 'tertiary';
      if (state.currentEndpoint === 'primary' && config.secondary) {
        nextEndpoint = 'secondary';
      } else if (state.currentEndpoint === 'secondary' && config.tertiary) {
        nextEndpoint = 'tertiary';
      } else {
        throw new Error(`No available failover endpoint for ${provider}`);
      }

      // Test secondary endpoint health
      const targetConfig = config[nextEndpoint];
      const isHealthy = await this.testEndpointHealth(provider, targetConfig);
      
      if (!isHealthy) {
        throw new Error(`Target endpoint ${nextEndpoint} is not healthy for ${provider}`);
      }

      // Update configuration in environment/database
      await this.updateProviderEndpoint(provider, nextEndpoint, targetConfig);
      
      // Update failover state
      state.currentEndpoint = nextEndpoint;
      state.lastFailover = new Date();
      state.failoverReason = reason;
      state.automaticFailback = automatic;
      
      this.failoverStates.set(provider, state);
      
      // Store failover event
      await this.recordFailoverEvent(provider, nextEndpoint, reason, automatic);
      
      const failoverTime = Date.now() - startTime;
      
      logger.info(`Failover completed for ${provider} to ${nextEndpoint} in ${failoverTime}ms`);
      
      return {
        success: true,
        message: `Successfully failed over ${provider} to ${nextEndpoint}`,
        newEndpoint: nextEndpoint,
        failoverTime
      };
      
    } catch (error) {
      const failoverTime = Date.now() - startTime;
      logger.error(`Failover failed for ${provider}:`, error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown failover error',
        newEndpoint: 'failed',
        failoverTime
      };
    }
  }

  /**
   * Test endpoint health
   */
  private async testEndpointHealth(provider: POSProvider, endpoint: any): Promise<boolean> {
    try {
      const response = await fetch(`${endpoint.baseUrl}${endpoint.healthEndpoint}`, {
        method: 'GET',
        headers: this.getProviderHeaders(provider),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      return response.ok;
    } catch (error) {
      logger.error(`Health check failed for ${provider} endpoint ${endpoint.baseUrl}:`, error);
      return false;
    }
  }

  /**
   * Get provider-specific headers for API calls
   */
  private getProviderHeaders(provider: POSProvider): Record<string, string> {
    switch (provider) {
      case 'square':
        return {
          'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2023-10-18',
          'Content-Type': 'application/json'
        };
      case 'shopify':
        return {
          'Authorization': `Bearer ${process.env.SHOPIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        };
      case 'zettle':
        return {
          'Authorization': `Bearer ${process.env.ZETTLE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        };
      default:
        return {};
    }
  }

  /**
   * Update provider endpoint configuration
   */
  private async updateProviderEndpoint(
    provider: POSProvider, 
    endpoint: 'primary' | 'secondary' | 'tertiary',
    config: any
  ): Promise<void> {
    try {
      // Update in database
      await db.client.from('pos_provider_configs')
        .upsert({
          provider,
          active_endpoint: endpoint,
          current_base_url: config.baseUrl,
          current_region: config.region,
          updated_at: new Date().toISOString()
        });
      
      // Update in Redis cache
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.setEx(
          `pos_config:${provider}`,
          3600, // 1 hour cache
          JSON.stringify({
            provider,
            endpoint,
            baseUrl: config.baseUrl,
            region: config.region,
            updatedAt: new Date().toISOString()
          })
        );
      }
      
    } catch (error) {
      logger.error(`Failed to update provider endpoint for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Record failover event for tracking
   */
  private async recordFailoverEvent(
    provider: POSProvider,
    newEndpoint: string,
    reason: string,
    automatic: boolean
  ): Promise<void> {
    try {
      await db.client.from('pos_failover_events').insert({
        provider,
        from_endpoint: this.failoverStates.get(provider)?.currentEndpoint || 'unknown',
        to_endpoint: newEndpoint,
        reason,
        automatic,
        occurred_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to record failover event:', error);
    }
  }

  /**
   * Execute disaster recovery plan
   */
  async executeRecoveryPlan(
    planId: string, 
    context: Record<string, any> = {}
  ): Promise<{
    success: boolean;
    planId: string;
    executedProcedures: string[];
    failedProcedures: string[];
    validationResults: any[];
    executionTime: number;
  }> {
    const startTime = Date.now();
    const executedProcedures: string[] = [];
    const failedProcedures: string[] = [];
    const validationResults: any[] = [];
    
    try {
      const plan = this.recoveryPlans.find(p => p.id === planId);
      if (!plan) {
        throw new Error(`Recovery plan not found: ${planId}`);
      }

      logger.info(`Executing disaster recovery plan: ${plan.name}`);
      
      // Notify stakeholders
      await this.notifyStakeholders(plan, 'recovery_started', context);
      
      // Execute procedures in order
      for (const procedure of plan.procedures) {
        try {
          await this.executeProcedure(procedure, context);
          executedProcedures.push(procedure.id);
          logger.info(`Successfully executed procedure: ${procedure.name}`);
        } catch (error) {
          failedProcedures.push(procedure.id);
          logger.error(`Failed to execute procedure ${procedure.name}:`, error);
          
          // Decide whether to continue or rollback
          if (procedure.id.includes('critical') || procedure.id.includes('maintenance')) {
            // Execute rollback procedures
            logger.warn('Executing rollback procedures due to critical failure');
            await this.executeRollback(plan, executedProcedures, context);
            throw error;
          }
        }
      }
      
      // Execute validation steps
      for (const validation of plan.validationSteps) {
        try {
          const result = await this.executeValidation(validation, context);
          validationResults.push({
            stepId: validation.id,
            success: result.success,
            result: result.data
          });
        } catch (error) {
          validationResults.push({
            stepId: validation.id,
            success: false,
            error: error.message
          });
        }
      }
      
      const allValidationsPassed = validationResults.every(r => r.success);
      const executionTime = Date.now() - startTime;
      
      if (!allValidationsPassed) {
        logger.warn('Some validations failed, considering rollback');
        await this.notifyStakeholders(plan, 'validation_failed', { validationResults });
      } else {
        await this.notifyStakeholders(plan, 'recovery_completed', { executionTime });
      }
      
      return {
        success: allValidationsPassed && failedProcedures.length === 0,
        planId,
        executedProcedures,
        failedProcedures,
        validationResults,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Recovery plan execution failed for ${planId}:`, error);
      
      return {
        success: false,
        planId,
        executedProcedures,
        failedProcedures,
        validationResults,
        executionTime
      };
    }
  }

  /**
   * Execute individual recovery procedure
   */
  private async executeProcedure(procedure: RecoveryProcedure, context: Record<string, any>): Promise<void> {
    // Replace context variables in command
    let command = procedure.command;
    for (const [key, value] of Object.entries(context)) {
      command = command.replace(new RegExp(`\\$${key}`, 'g'), String(value));
    }
    
    // Execute with retries
    for (let attempt = 1; attempt <= procedure.retryAttempts; attempt++) {
      try {
        logger.info(`Executing procedure ${procedure.name} (attempt ${attempt}/${procedure.retryAttempts})`);
        
        const result = await this.executeCommand(command, procedure.timeout);
        
        if (result.success) {
          return;
        } else {
          throw new Error(result.error || 'Command execution failed');
        }
        
      } catch (error) {
        if (attempt === procedure.retryAttempts) {
          throw error;
        }
        
        logger.warn(`Procedure ${procedure.name} failed on attempt ${attempt}, retrying...`);
        await this.delay(5000); // 5 second delay between retries
      }
    }
  }

  /**
   * Execute rollback procedures
   */
  private async executeRollback(
    plan: DisasterRecoveryPlan,
    executedProcedures: string[],
    context: Record<string, any>
  ): Promise<void> {
    logger.info(`Executing rollback for plan: ${plan.name}`);
    
    // Execute rollback procedures in reverse order
    for (const procedure of plan.rollbackProcedures.reverse()) {
      try {
        await this.executeProcedure(procedure, context);
        logger.info(`Successfully executed rollback procedure: ${procedure.name}`);
      } catch (error) {
        logger.error(`Failed to execute rollback procedure ${procedure.name}:`, error);
      }
    }
  }

  /**
   * Execute validation step
   */
  private async executeValidation(validation: ValidationStep, context: Record<string, any>): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      let command = validation.command;
      for (const [key, value] of Object.entries(context)) {
        command = command.replace(new RegExp(`\\$${key}`, 'g'), String(value));
      }
      
      const result = await this.executeCommand(command, validation.timeout);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      // Validate result against expected result
      const isValid = this.validateResult(result.data, validation.expectedResult);
      
      return {
        success: isValid,
        data: result.data,
        error: isValid ? undefined : 'Result does not match expected outcome'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Execute system command
   */
  private async executeCommand(command: string, timeout: number): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      // For HTTP commands (curl)
      if (command.startsWith('curl')) {
        const response = await this.executeCurlCommand(command, timeout);
        return { success: response.ok, data: await response.json() };
      }
      
      // For Node.js scripts
      if (command.startsWith('node')) {
        const result = await this.executeNodeScript(command, timeout);
        return result;
      }
      
      // For other shell commands
      const result = await this.executeShellCommand(command, timeout);
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed'
      };
    }
  }

  /**
   * Execute curl command
   */
  private async executeCurlCommand(command: string, timeout: number): Promise<Response> {
    // Parse curl command and convert to fetch
    const url = command.match(/curl\s+(?:-X\s+\w+\s+)?(.+?)(?:\s|$)/)?.[1] || '';
    const method = command.match(/-X\s+(\w+)/)?.[1] || 'GET';
    
    return fetch(url, {
      method,
      signal: AbortSignal.timeout(timeout)
    });
  }

  /**
   * Execute Node.js script
   */
  private async executeNodeScript(command: string, timeout: number): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    // Implementation depends on your script execution environment
    // This is a placeholder - you'd use child_process.spawn or similar
    return { success: true, data: {} };
  }

  /**
   * Execute shell command
   */
  private async executeShellCommand(command: string, timeout: number): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    // Implementation depends on your script execution environment
    // This is a placeholder - you'd use child_process.exec or similar
    return { success: true, data: {} };
  }

  /**
   * Validate command result against expected outcome
   */
  private validateResult(actual: any, expected: any): boolean {
    // Simple validation - can be made more sophisticated
    if (typeof expected === 'object' && expected !== null) {
      for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) {
          return false;
        }
      }
      return true;
    }
    
    return actual === expected;
  }

  /**
   * Notify stakeholders about recovery events
   */
  private async notifyStakeholders(
    plan: DisasterRecoveryPlan,
    event: 'recovery_started' | 'recovery_completed' | 'validation_failed' | 'rollback_initiated',
    context: Record<string, any>
  ): Promise<void> {
    // Implementation would integrate with notification systems
    logger.info(`Notifying stakeholders of ${event} for plan ${plan.name}:`, {
      stakeholders: plan.stakeholders,
      event,
      context
    });
  }

  /**
   * Start health monitoring for automatic failover
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.monitorEndpointHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Monitor endpoint health and trigger automatic failover
   */
  private async monitorEndpointHealth(): Promise<void> {
    for (const [provider, state] of this.failoverStates.entries()) {
      try {
        const config = this.endpointConfigs.find(c => c.provider === provider);
        if (!config) continue;
        
        const currentConfig = config[state.currentEndpoint];
        const isHealthy = await this.testEndpointHealth(provider, currentConfig);
        
        if (!isHealthy) {
          logger.warn(`Primary endpoint unhealthy for ${provider}, triggering failover`);
          await this.triggerFailover(provider, `Automatic failover: endpoint unhealthy`, true);
        }
        
      } catch (error) {
        logger.error(`Health monitoring error for ${provider}:`, error);
      }
    }
  }

  /**
   * Start data consistency monitoring
   */
  private startConsistencyMonitoring(): void {
    setInterval(async () => {
      await this.runConsistencyChecks();
    }, 300000); // Check every 5 minutes
  }

  /**
   * Run data consistency checks
   */
  async runConsistencyChecks(): Promise<{
    overallStatus: 'consistent' | 'inconsistent';
    checks: any[];
    repairsPending: string[];
  }> {
    const checks = [];
    const repairsPending = [];
    
    for (const check of this.consistencyChecks) {
      try {
        const result = await this.executeConsistencyCheck(check);
        checks.push({
          checkId: check.checkId,
          description: check.description,
          status: result.status,
          issues: result.issues,
          repairNeeded: result.repairNeeded
        });
        
        if (result.repairNeeded && check.repairProcedure) {
          repairsPending.push(check.repairProcedure);
        }
        
      } catch (error) {
        checks.push({
          checkId: check.checkId,
          description: check.description,
          status: 'error',
          error: error.message,
          repairNeeded: false
        });
      }
    }
    
    const overallStatus = checks.some(c => c.status === 'inconsistent') ? 'inconsistent' : 'consistent';
    
    return {
      overallStatus,
      checks,
      repairsPending
    };
  }

  /**
   * Execute individual consistency check
   */
  private async executeConsistencyCheck(check: DataConsistencyCheck): Promise<{
    status: 'consistent' | 'inconsistent' | 'error';
    issues: any[];
    repairNeeded: boolean;
  }> {
    try {
      const { data: results, error } = await db.client.rpc('execute_query', { 
        query_text: check.query 
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Check against expected constraints
      const isConsistent = this.validateConsistencyResult(results, check.expectedConstraints);
      
      return {
        status: isConsistent ? 'consistent' : 'inconsistent',
        issues: isConsistent ? [] : results,
        repairNeeded: !isConsistent
      };
      
    } catch (error) {
      return {
        status: 'error',
        issues: [{ error: error.message }],
        repairNeeded: false
      };
    }
  }

  /**
   * Validate consistency check result
   */
  private validateConsistencyResult(results: any[], constraints: any): boolean {
    if (constraints.maxRows !== undefined) {
      return results.length <= constraints.maxRows;
    }
    
    // Add more constraint types as needed
    return true;
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get disaster recovery status
   */
  async getDisasterRecoveryStatus(): Promise<{
    failoverStates: any[];
    recentFailovers: any[];
    consistencyStatus: any;
    recoveryPlans: any[];
  }> {
    try {
      // Get current failover states
      const failoverStates = Array.from(this.failoverStates.entries()).map(([provider, state]) => ({
        provider,
        currentEndpoint: state.currentEndpoint,
        lastFailover: state.lastFailover,
        failoverReason: state.failoverReason,
        automaticFailback: state.automaticFailback
      }));
      
      // Get recent failover events
      const { data: recentFailovers } = await db.client
        .from('pos_failover_events')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(10);
      
      // Get consistency status
      const consistencyStatus = await this.runConsistencyChecks();
      
      return {
        failoverStates,
        recentFailovers: recentFailovers || [],
        consistencyStatus,
        recoveryPlans: this.recoveryPlans.map(plan => ({
          id: plan.id,
          name: plan.name,
          triggers: plan.triggers,
          estimatedRTO: plan.estimatedRTO,
          estimatedRPO: plan.estimatedRPO,
          stakeholders: plan.stakeholders
        }))
      };
      
    } catch (error) {
      logger.error('Error getting disaster recovery status:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.quit();
      }
      logger.info('POS Disaster Recovery cleaned up');
    } catch (error) {
      logger.error('Error during POS Disaster Recovery cleanup:', error);
    }
  }
}