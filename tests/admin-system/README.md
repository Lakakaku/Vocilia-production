# Admin System Testing Suite

## Overview
Comprehensive testing suite for the AI Feedback Platform admin system, covering authentication flows, business approval workflows, tier management operations, live session monitoring, role-based access controls, permission conflicts, and system failure scenarios.

## Test Structure

### Core Test Files

#### 1. `admin-test-setup.js`
- **Purpose**: Central test configuration and mock data setup
- **Features**:
  - Swedish market business test data with realistic organization numbers
  - 5-tier admin role hierarchy (Super Admin → Platform Admin → Business Manager → Support Agent → Viewer)
  - JWT authentication configuration
  - Mock business data for ICA, Coop, Willys, and other Swedish retailers
  - Test utility functions for admin and business creation

#### 2. `business-approval.test.js` - 48 Tests
- **Focus**: Swedish business approval workflows and regulatory compliance
- **Key Test Areas**:
  - Business registration validation with Swedish organization numbers
  - Tier recommendation algorithms based on business size and sector
  - Approval decision workflows with proper documentation
  - Regulatory compliance checks for Swedish market requirements
  - Multi-step approval processes with role-based authorization

#### 3. `tier-management.test.js` - 35 Tests  
- **Focus**: Business tier operations and lifecycle management
- **Key Test Areas**:
  - 3-tier system management (Starter 20%, Professional 18%, Enterprise 15% commission)
  - Tier upgrade and downgrade workflows
  - Commission rate calculations and fee structures
  - Feature access control based on tier levels
  - Business performance metrics and tier recommendations

#### 4. `session-monitoring.test.js` - 31 Tests
- **Focus**: Live session monitoring and real-time analytics
- **Key Test Areas**:
  - Real-time session tracking across Swedish businesses
  - Performance analytics and business insights
  - Geographic distribution analysis
  - Role-based monitoring dashboard access
  - Session alerts and monitoring thresholds

#### 5. `role-access.test.js` - 42 Tests
- **Focus**: Authentication flows and role-based access control
- **Key Test Areas**:
  - JWT token management and validation
  - 5-tier role hierarchy with proper permission inheritance
  - Session management and security policies
  - Cross-role operation authorization
  - Authentication edge cases and security scenarios

#### 6. `permission-conflicts.test.js` - 38 Tests
- **Focus**: Admin permission conflicts and edge cases
- **Key Test Areas**:
  - Concurrent admin operations and conflict resolution
  - Role transition scenarios and permission updates
  - Complex multi-admin workflow coordination
  - Permission boundary edge cases
  - Emergency admin access and system overrides

#### 7. `system-failures.test.js` - 45 Tests
- **Focus**: System failure scenarios and recovery procedures  
- **Key Test Areas**:
  - Database failure handling with circuit breaker patterns
  - Redis cache failure recovery
  - External service failures (Stripe, AI services)
  - Cascading failure scenarios and graceful degradation
  - Network connectivity issues and retry logic
  - Data consistency and transaction rollback scenarios
  - System monitoring and alerting during failures

## Test Configuration

### Package Dependencies
```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "uuid": "^9.0.1",
    "lodash": "^4.17.21",
    "date-fns": "^2.30.0"
  }
}
```

### Jest Configuration
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['./admin-test-setup.js']
};
```

## Running Tests

### All Tests
```bash
npm test
```

### Individual Test Suites
```bash
npm run test:auth          # Authentication and role access tests
npm run test:approval      # Business approval workflow tests  
npm run test:tiers         # Tier management tests
npm run test:monitoring    # Session monitoring tests
npm run test:conflicts     # Permission conflict tests
npm run test:failures      # System failure and recovery tests
```

### Coverage Report
```bash
npm run test:coverage
```

## Mock Data Structure

### Swedish Business Test Data
The test suite includes comprehensive mock data representing the Swedish retail market:

- **ICA Stores**: Maxi, Kvantum, Supermarket, Nära variants
- **Coop Stores**: Coop, Extra, Konsum variants  
- **Willys**: Standard and Hemma formats
- **Other Retailers**: City Gross, Tempo, Pressbyrån, 7-Eleven

Each business includes:
- Valid Swedish organization numbers (10-digit format)
- Realistic business sectors and sizes
- Geographic distribution across Sweden
- Proper VAT registration status
- Contact information with Swedish phone/address formats

### Admin Role Hierarchy
```javascript
const ROLE_HIERARCHY = {
  'super_admin': 100,      // Platform-wide access, user management
  'platform_admin': 80,   // Cross-business operations, system config
  'business_manager': 60, // Business-specific management
  'support_agent': 40,    // Customer support and basic operations
  'viewer': 20            // Read-only dashboard access
};
```

## Test Scenarios Coverage

### Authentication & Authorization (42 tests)
- ✅ JWT token generation and validation
- ✅ Role-based permission enforcement
- ✅ Session management and expiration
- ✅ Cross-role operation authorization
- ✅ Authentication edge cases

### Business Operations (48 tests)
- ✅ Swedish business registration validation
- ✅ Organization number verification
- ✅ Tier recommendation algorithms
- ✅ Approval workflow automation
- ✅ Regulatory compliance checks

### System Management (35 tests)
- ✅ Tier upgrade/downgrade processes
- ✅ Commission rate management
- ✅ Feature access control
- ✅ Performance-based recommendations
- ✅ Business lifecycle management

### Monitoring & Analytics (31 tests)
- ✅ Real-time session tracking
- ✅ Business performance metrics
- ✅ Geographic analytics
- ✅ Role-based dashboard access
- ✅ Alert and threshold management

### Conflict Resolution (38 tests)
- ✅ Concurrent operation handling
- ✅ Role transition management
- ✅ Permission boundary enforcement
- ✅ Multi-admin coordination
- ✅ Emergency access procedures

### Failure & Recovery (45 tests)
- ✅ Database failure scenarios
- ✅ Cache system failures
- ✅ External service outages
- ✅ Network connectivity issues
- ✅ Data consistency maintenance
- ✅ Circuit breaker patterns
- ✅ Graceful degradation
- ✅ Recovery procedures

## Security Considerations

### Data Protection
- All test data uses anonymized Swedish business information
- Personal identifiable information (PII) is mocked or hashed
- Sensitive configuration values use test-specific secrets
- Database connections use isolated test environments

### Authentication Security
- JWT tokens include proper expiration and validation
- Role hierarchy prevents privilege escalation
- Session management includes timeout and revocation
- Multi-factor authentication simulation for admin accounts

### Swedish Compliance
- Organization number validation follows Swedish format requirements
- VAT registration checks comply with Swedish tax authority standards
- Business registration data matches Bolagsverket requirements
- GDPR compliance built into all data handling procedures

## Performance Benchmarks

### Target Metrics
- Authentication operations: < 100ms response time
- Business approval workflows: < 500ms processing time
- Session monitoring queries: < 200ms data retrieval
- System health checks: < 50ms per service check
- Failure recovery: < 30s maximum downtime per service

### Load Testing
The test suite includes performance validation for:
- 100 concurrent admin sessions
- 1000+ business records processing
- Real-time monitoring of 500+ active sessions
- Circuit breaker activation under load
- Database connection pool management

## Continuous Integration

### Pre-commit Hooks
```bash
#!/bin/sh
npm run test:admin
npm run lint:admin-tests  
npm run security:scan
```

### CI Pipeline Integration
```yaml
test_admin_system:
  script:
    - npm install
    - npm run test:admin:coverage
    - npm run test:admin:security
  artifacts:
    reports:
      coverage: coverage/lcov.info
    paths:
      - coverage/
```

## Maintenance & Updates

### Regular Maintenance Tasks
1. **Monthly**: Update Swedish business test data with current market information
2. **Quarterly**: Review and update security test scenarios
3. **Bi-annually**: Validate compliance with Swedish regulatory changes
4. **Annually**: Full security audit and penetration testing simulation

### Test Data Refresh
- Business organization numbers validated against current Swedish registry
- Admin role permissions aligned with current system capabilities
- Mock service endpoints updated to match production API changes
- Performance benchmarks adjusted based on production metrics

## Troubleshooting

### Common Issues

#### Test Authentication Failures
```javascript
// Verify JWT secret configuration
const token = jwt.verify(testToken, ADMIN_TEST_CONFIG.auth.jwtSecret);
```

#### Mock Service Connection Issues  
```javascript
// Check service state configuration
mockDBConnectionState = 'healthy';
mockRedisConnectionState = 'healthy';
```

#### Swedish Data Validation Errors
```javascript
// Validate organization number format
const orgNumberRegex = /^\d{6}-\d{4}$/;
expect(businessData.orgNumber).toMatch(orgNumberRegex);
```

### Debug Mode
Enable detailed test logging:
```bash
DEBUG=admin-tests npm test
```

## Contributing

### Adding New Tests
1. Follow existing test file structure and naming conventions
2. Include proper setup and teardown procedures
3. Use Swedish business context where applicable
4. Add comprehensive error scenarios and edge cases
5. Update this documentation with new test coverage

### Test Standards
- Minimum 90% code coverage for new admin features
- All tests must pass in isolation and in parallel execution
- Mock external dependencies appropriately
- Include both positive and negative test scenarios
- Validate Swedish market compliance requirements

---

**Total Test Coverage**: 239 comprehensive tests across 7 test suites  
**Focus Areas**: Swedish market compliance, role-based security, system resilience  
**Maintenance**: Regularly updated for regulatory and system changes