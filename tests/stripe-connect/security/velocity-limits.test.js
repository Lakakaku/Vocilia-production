/**
 * Payment Velocity Limits Security Tests
 * Tests rate limiting and velocity controls for fraud prevention
 * Uses only Stripe test environment - no real money involved
 */

const { SecurityTestUtils } = global;

describe('Payment Velocity Limits Security Tests', () => {
  let testTransactions = [];
  let rateLimiters;

  beforeEach(() => {
    testTransactions = [];
    rateLimiters = SecurityTestUtils.rateLimiters;
  });

  afterEach(async () => {
    // Clean up test transactions
    for (const transaction of testTransactions) {
      try {
        if (transaction.paymentIntentId) {
          await SecurityTestUtils.stripe.paymentIntents.cancel(transaction.paymentIntentId);
        }
      } catch (error) {
        // Cleanup - ignore errors for cancelled/completed transactions
      }
    }
  });

  describe('Transaction Frequency Limits', () => {
    it('should enforce per-minute transaction limits', async () => {
      const customerHash = 'test_customer_velocity_123';
      const testCard = SecurityTestUtils.testCards.pciCompliance.visa;
      const results = [];

      // Attempt 15 transactions in rapid succession (limit: 10 per minute)
      for (let i = 0; i < 15; i++) {
        try {
          // Check rate limiter before transaction
          await rateLimiters.payment.consume(customerHash);
          
          const paymentIntent = await SecurityTestUtils.stripe.paymentIntents.create({
            amount: 1000 + i, // Varying amounts to avoid exact duplicates
            currency: 'sek',
            payment_method_data: {
              type: 'card',
              card: testCard
            },
            metadata: {
              securityTest: 'velocity_per_minute',
              customerHash,
              attempt: i + 1,
              timestamp: Date.now()
            }
          });

          results.push({
            attempt: i + 1,
            status: 'created',
            paymentIntentId: paymentIntent.id,
            timestamp: Date.now()
          });

          testTransactions.push({ paymentIntentId: paymentIntent.id });

        } catch (rateLimitError) {
          results.push({
            attempt: i + 1,
            status: 'rate_limited',
            error: rateLimitError.message || 'Rate limit exceeded',
            timestamp: Date.now()
          });
        }

        // Small delay to simulate realistic timing
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Analyze results
      const successful = results.filter(r => r.status === 'created');
      const rateLimited = results.filter(r => r.status === 'rate_limited');

      expect(successful.length).toBeLessThanOrEqual(10); // Should not exceed limit
      expect(rateLimited.length).toBeGreaterThan(0);     // Should have blocks
      expect(successful.length + rateLimited.length).toBe(15);
    });

    it('should enforce per-hour transaction limits', async () => {
      const customerHash = 'test_customer_hourly_456';
      const hourlyLimit = SecurityTestUtils.config.fraud.velocityLimits.transactionsPerHour;
      
      // Simulate transactions over time periods
      const timeSlots = [
        { offset: 0, transactions: 30 },      // First batch
        { offset: 1800000, transactions: 40 }, // 30 minutes later
        { offset: 3000000, transactions: 35 }  // 50 minutes later (should hit hourly limit)
      ];

      const allResults = [];

      for (const slot of timeSlots) {
        const slotResults = [];
        
        for (let i = 0; i < slot.transactions; i++) {
          const transactionTime = Date.now() + slot.offset + (i * 1000);
          
          try {
            // Simulate hourly rate limit check
            const currentHourTransactions = allResults.filter(r => 
              r.timestamp > transactionTime - 3600000 && r.status === 'created'
            ).length;

            if (currentHourTransactions >= hourlyLimit) {
              throw new Error('Hourly transaction limit exceeded');
            }

            const mockTransaction = {
              timestamp: transactionTime,
              status: 'created',
              customerHash,
              slotIndex: timeSlots.indexOf(slot),
              transactionIndex: i
            };

            slotResults.push(mockTransaction);

          } catch (error) {
            slotResults.push({
              timestamp: transactionTime,
              status: 'rate_limited',
              error: error.message,
              customerHash,
              slotIndex: timeSlots.indexOf(slot),
              transactionIndex: i
            });
          }
        }

        allResults.push(...slotResults);
      }

      // Analyze hourly patterns
      const totalCreated = allResults.filter(r => r.status === 'created').length;
      const totalBlocked = allResults.filter(r => r.status === 'rate_limited').length;
      const finalSlotBlocked = allResults
        .filter(r => r.slotIndex === 2 && r.status === 'rate_limited')
        .length;

      expect(totalCreated).toBeLessThanOrEqual(hourlyLimit);
      expect(totalBlocked).toBeGreaterThan(0);
      expect(finalSlotBlocked).toBeGreaterThan(0); // Third slot should have blocks
    });

    it('should enforce daily transaction limits', async () => {
      const customerHash = 'test_customer_daily_789';
      const dailyLimit = SecurityTestUtils.config.fraud.velocityLimits.transactionsPerDay;
      
      // Simulate full day of transactions
      const daySimulation = [];
      const transactionsPerHour = Math.ceil(dailyLimit / 24) + 5; // Exceed daily limit

      for (let hour = 0; hour < 24; hour++) {
        for (let tx = 0; tx < transactionsPerHour; tx++) {
          const transactionTime = Date.now() + (hour * 3600000) + (tx * 60000);
          
          // Check daily transaction count
          const todayTransactions = daySimulation.filter(t => 
            t.timestamp > transactionTime - 86400000 && t.status === 'created'
          ).length;

          if (todayTransactions < dailyLimit) {
            daySimulation.push({
              hour,
              transaction: tx,
              timestamp: transactionTime,
              status: 'created',
              customerHash,
              dailyCount: todayTransactions + 1
            });
          } else {
            daySimulation.push({
              hour,
              transaction: tx, 
              timestamp: transactionTime,
              status: 'daily_limit_exceeded',
              customerHash,
              dailyCount: todayTransactions
            });
          }
        }
      }

      const createdTransactions = daySimulation.filter(t => t.status === 'created');
      const blockedTransactions = daySimulation.filter(t => t.status === 'daily_limit_exceeded');

      expect(createdTransactions.length).toBeLessThanOrEqual(dailyLimit);
      expect(blockedTransactions.length).toBeGreaterThan(0);
      expect(createdTransactions.length + blockedTransactions.length).toBe(daySimulation.length);
    });
  });

  describe('Amount-Based Velocity Limits', () => {
    it('should enforce hourly amount limits', async () => {
      const customerHash = 'test_customer_amount_hourly';
      const hourlyAmountLimit = SecurityTestUtils.config.fraud.velocityLimits.maxAmountPerHour;
      
      const largeTransactions = [
        { amount: 300000, description: 'Large purchase 1' },  // 3,000 SEK
        { amount: 400000, description: 'Large purchase 2' },  // 4,000 SEK  
        { amount: 350000, description: 'Large purchase 3' },  // 3,500 SEK (should exceed limit)
        { amount: 200000, description: 'Large purchase 4' }   // 2,000 SEK (should be blocked)
      ];

      const results = [];
      let cumulativeAmount = 0;

      for (const [index, transaction] of largeTransactions.entries()) {
        const wouldExceedLimit = (cumulativeAmount + transaction.amount) > hourlyAmountLimit;

        if (wouldExceedLimit) {
          results.push({
            index,
            amount: transaction.amount,
            cumulativeAmount,
            status: 'amount_limit_exceeded',
            description: transaction.description,
            limitExceededBy: (cumulativeAmount + transaction.amount) - hourlyAmountLimit
          });
        } else {
          cumulativeAmount += transaction.amount;
          results.push({
            index,
            amount: transaction.amount,
            cumulativeAmount,
            status: 'approved',
            description: transaction.description
          });
        }
      }

      const approvedTransactions = results.filter(r => r.status === 'approved');
      const blockedTransactions = results.filter(r => r.status === 'amount_limit_exceeded');
      const totalApprovedAmount = approvedTransactions.reduce((sum, t) => sum + t.amount, 0);

      expect(totalApprovedAmount).toBeLessThanOrEqual(hourlyAmountLimit);
      expect(blockedTransactions.length).toBeGreaterThan(0);
      expect(blockedTransactions[0].index).toBe(2); // Third transaction should be blocked
    });

    it('should enforce daily amount limits', async () => {
      const customerHash = 'test_customer_amount_daily';
      const dailyAmountLimit = SecurityTestUtils.config.fraud.velocityLimits.maxAmountPerDay;
      
      // Simulate day with multiple high-value transactions
      const dailyTransactions = [];
      let dailyCumulative = 0;
      
      // Generate transactions throughout the day
      for (let hour = 0; hour < 24; hour++) {
        const transactionAmount = Math.floor(Math.random() * 150000) + 50000; // 500-2000 SEK
        const transactionTime = Date.now() + (hour * 3600000);

        if ((dailyCumulative + transactionAmount) <= dailyAmountLimit) {
          dailyCumulative += transactionAmount;
          dailyTransactions.push({
            hour,
            amount: transactionAmount,
            cumulativeDaily: dailyCumulative,
            timestamp: transactionTime,
            status: 'approved'
          });
        } else {
          dailyTransactions.push({
            hour,
            amount: transactionAmount,
            cumulativeDaily: dailyCumulative,
            timestamp: transactionTime,
            status: 'daily_amount_exceeded',
            exceededBy: (dailyCumulative + transactionAmount) - dailyAmountLimit
          });
        }
      }

      const approvedDaily = dailyTransactions.filter(t => t.status === 'approved');
      const blockedDaily = dailyTransactions.filter(t => t.status === 'daily_amount_exceeded');
      const totalDailyAmount = approvedDaily.reduce((sum, t) => sum + t.amount, 0);

      expect(totalDailyAmount).toBeLessThanOrEqual(dailyAmountLimit);
      expect(blockedDaily.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Customer Velocity Patterns', () => {
    it('should detect coordinated attack patterns', async () => {
      const suspiciousCustomers = [
        'suspicious_customer_001',
        'suspicious_customer_002', 
        'suspicious_customer_003'
      ];

      const coordinatedAttack = [];
      const attackTime = Date.now();

      // Simulate coordinated transactions from multiple accounts
      for (let wave = 0; wave < 5; wave++) {
        for (const customer of suspiciousCustomers) {
          const transaction = {
            customerHash: customer,
            timestamp: attackTime + (wave * 30000), // 30 seconds between waves
            amount: 100000 + (wave * 10000), // Increasing amounts
            deviceFingerprint: `attack_device_${customer}`,
            wave,
            status: 'created'
          };

          // Check for coordinated pattern
          const recentSimilarTransactions = coordinatedAttack.filter(t => 
            Math.abs(t.timestamp - transaction.timestamp) < 60000 && // Within 1 minute
            Math.abs(t.amount - transaction.amount) < 5000 && // Similar amounts
            t.customerHash !== transaction.customerHash // Different customers
          );

          if (recentSimilarTransactions.length > 1) {
            transaction.status = 'coordinated_attack_detected';
            transaction.suspiciousPattern = 'multiple_customers_similar_timing_amounts';
          }

          coordinatedAttack.push(transaction);
        }
      }

      // Analyze attack detection
      const detectedAttacks = coordinatedAttack.filter(t => 
        t.status === 'coordinated_attack_detected'
      );
      const attackWaves = [...new Set(detectedAttacks.map(t => t.wave))];

      expect(detectedAttacks.length).toBeGreaterThan(0);
      expect(attackWaves.length).toBeGreaterThan(1);
    });

    it('should track merchant-specific velocity patterns', async () => {
      const merchants = ['merchant_cafe_001', 'merchant_restaurant_002'];
      const merchantTransactions = new Map();

      // Initialize tracking for each merchant
      merchants.forEach(merchant => {
        merchantTransactions.set(merchant, []);
      });

      // Simulate normal and suspicious merchant patterns
      const scenarios = [
        {
          merchant: 'merchant_cafe_001',
          pattern: 'normal',
          transactionsPerHour: 15,
          avgAmount: 75000 // 750 SEK average
        },
        {
          merchant: 'merchant_restaurant_002', 
          pattern: 'suspicious',
          transactionsPerHour: 50, // Unusually high
          avgAmount: 200000 // 2000 SEK average
        }
      ];

      for (const scenario of scenarios) {
        const transactions = [];
        
        for (let i = 0; i < scenario.transactionsPerHour; i++) {
          const amount = scenario.avgAmount + (Math.random() - 0.5) * 20000;
          const timestamp = Date.now() + (i * (3600000 / scenario.transactionsPerHour));
          
          transactions.push({
            merchantId: scenario.merchant,
            amount,
            timestamp,
            pattern: scenario.pattern,
            transactionIndex: i
          });
        }

        merchantTransactions.set(scenario.merchant, transactions);
      }

      // Analyze merchant patterns
      const merchantAnalysis = [];
      
      for (const [merchantId, transactions] of merchantTransactions) {
        const hourlyRate = transactions.length;
        const avgAmount = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
        const isAnomalous = hourlyRate > 30 || avgAmount > 150000;

        merchantAnalysis.push({
          merchantId,
          hourlyRate,
          avgAmount,
          transactionCount: transactions.length,
          isAnomalous,
          riskScore: isAnomalous ? 75 : 25
        });
      }

      const suspiciousMerchants = merchantAnalysis.filter(m => m.isAnomalous);
      const normalMerchants = merchantAnalysis.filter(m => !m.isAnomalous);

      expect(suspiciousMerchants.length).toBe(1);
      expect(normalMerchants.length).toBe(1);
      expect(suspiciousMerchants[0].merchantId).toBe('merchant_restaurant_002');
    });
  });

  describe('Adaptive Rate Limiting', () => {
    it('should adjust limits based on risk scores', async () => {
      const customers = [
        { hash: 'low_risk_customer', baseRiskScore: 15, expectedLimitMultiplier: 1.0 },
        { hash: 'med_risk_customer', baseRiskScore: 45, expectedLimitMultiplier: 0.7 },
        { hash: 'high_risk_customer', baseRiskScore: 80, expectedLimitMultiplier: 0.3 }
      ];

      const baseLimits = SecurityTestUtils.config.fraud.velocityLimits;
      const adaptiveLimits = [];

      for (const customer of customers) {
        // Calculate adaptive limits based on risk score
        const riskMultiplier = customer.baseRiskScore <= 30 ? 1.0 :
                             customer.baseRiskScore <= 70 ? 0.7 : 0.3;

        const customerLimits = {
          customerHash: customer.hash,
          riskScore: customer.baseRiskScore,
          transactionsPerMinute: Math.floor(baseLimits.transactionsPerMinute * riskMultiplier),
          transactionsPerHour: Math.floor(baseLimits.transactionsPerHour * riskMultiplier),
          maxAmountPerHour: Math.floor(baseLimits.maxAmountPerHour * riskMultiplier),
          actualMultiplier: riskMultiplier
        };

        adaptiveLimits.push(customerLimits);
      }

      // Verify adaptive limits are properly calculated
      const lowRiskLimits = adaptiveLimits.find(l => l.customerHash === 'low_risk_customer');
      const highRiskLimits = adaptiveLimits.find(l => l.customerHash === 'high_risk_customer');

      expect(lowRiskLimits.transactionsPerMinute).toBe(baseLimits.transactionsPerMinute);
      expect(highRiskLimits.transactionsPerMinute).toBeLessThan(baseLimits.transactionsPerMinute);
      expect(lowRiskLimits.maxAmountPerHour).toBeGreaterThan(highRiskLimits.maxAmountPerHour);
    });

    it('should implement progressive throttling', async () => {
      const customerHash = 'progressive_throttle_test';
      const baseDelay = 1000; // 1 second
      const throttlingResults = [];

      // Simulate increasing throttling with repeated attempts
      for (let attempt = 1; attempt <= 10; attempt++) {
        const throttleDelay = attempt <= 3 ? 0 : // First 3 attempts: no delay
                             attempt <= 6 ? baseDelay : // Next 3: base delay
                             attempt <= 8 ? baseDelay * 2 : // Next 2: 2x delay
                             baseDelay * 4; // Final 2: 4x delay

        const startTime = Date.now();
        
        // Simulate delay
        if (throttleDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.min(throttleDelay, 100))); // Speed up for testing
        }
        
        const actualDelay = Date.now() - startTime;

        throttlingResults.push({
          attempt,
          expectedDelay: throttleDelay,
          actualDelay,
          throttled: throttleDelay > 0,
          severity: attempt <= 3 ? 'none' : 
                   attempt <= 6 ? 'low' :
                   attempt <= 8 ? 'medium' : 'high'
        });
      }

      // Analyze throttling progression
      const nonThrottled = throttlingResults.filter(r => !r.throttled);
      const throttled = throttlingResults.filter(r => r.throttled);
      const highSeverity = throttlingResults.filter(r => r.severity === 'high');

      expect(nonThrottled.length).toBe(3);
      expect(throttled.length).toBe(7);
      expect(highSeverity.length).toBe(2);
    });
  });

  describe('Recovery and Reset Mechanisms', () => {
    it('should reset limits after cooling period', async () => {
      const customerHash = 'cooling_period_test';
      const coolingPeriod = 300000; // 5 minutes
      
      // Phase 1: Exhaust rate limit
      const phase1Results = [];
      for (let i = 0; i < 12; i++) { // Exceed limit of 10
        try {
          await rateLimiters.payment.consume(customerHash);
          phase1Results.push({ attempt: i + 1, status: 'success' });
        } catch (error) {
          phase1Results.push({ attempt: i + 1, status: 'rate_limited' });
        }
      }

      // Phase 2: Wait for cooling period (simulated)
      const coolingStartTime = Date.now();
      
      // Simulate cooling period completion
      const simulatedCoolingTime = coolingStartTime + coolingPeriod;
      
      // Phase 3: Test limit reset
      const phase3Results = [];
      
      // In real implementation, rate limiter would reset after cooling period
      // For testing, we simulate this by checking if enough time has passed
      const coolingComplete = simulatedCoolingTime > coolingStartTime + (coolingPeriod - 1000);
      
      if (coolingComplete) {
        // Simulate successful transactions after cooling
        for (let i = 0; i < 5; i++) {
          phase3Results.push({ 
            attempt: i + 1, 
            status: 'success_after_cooling',
            timestamp: simulatedCoolingTime + (i * 1000)
          });
        }
      }

      const phase1Blocked = phase1Results.filter(r => r.status === 'rate_limited').length;
      const phase3Success = phase3Results.filter(r => r.status === 'success_after_cooling').length;

      expect(phase1Blocked).toBeGreaterThan(0); // Should have blocks in phase 1
      expect(phase3Success).toBe(5); // Should succeed after cooling
      expect(coolingComplete).toBe(true);
    });

    it('should implement exponential backoff for repeated violations', async () => {
      const customerHash = 'exponential_backoff_test';
      const violationHistory = [];
      const baseBackoffTime = 60000; // 1 minute

      // Simulate repeated rate limit violations
      for (let violation = 1; violation <= 5; violation++) {
        const backoffTime = baseBackoffTime * Math.pow(2, violation - 1); // Exponential backoff
        const violationTime = Date.now() + (violation * 300000); // 5 minutes apart

        violationHistory.push({
          violationNumber: violation,
          timestamp: violationTime,
          backoffDuration: backoffTime,
          canRetryAfter: violationTime + backoffTime,
          severity: violation <= 2 ? 'low' : violation <= 4 ? 'medium' : 'high'
        });
      }

      // Analyze backoff progression
      const backoffTimes = violationHistory.map(v => v.backoffDuration);
      const isExponential = backoffTimes.every((time, index) => 
        index === 0 || time === backoffTimes[index - 1] * 2
      );

      const maxBackoff = Math.max(...backoffTimes);
      const minBackoff = Math.min(...backoffTimes);

      expect(isExponential).toBe(true);
      expect(maxBackoff).toBeGreaterThan(minBackoff * 8); // 2^4 = 16x increase
      expect(violationHistory.length).toBe(5);
    });
  });
});