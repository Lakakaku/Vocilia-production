# Data Flow Mapping Documentation
## AI Feedback Platform - GDPR Data Processing Map

**Document Version:** 1.0  
**Last Updated:** December 19, 2024  
**Purpose:** GDPR Article 30 Record of Processing Activities  
**Classification:** Internal Use - GDPR Compliance  

---

## 1. Document Overview

### 1.1 Purpose and Scope
This document provides a comprehensive mapping of all personal data flows within the AI Feedback Platform, documenting:
- Data collection points and methods
- Processing activities and purposes
- Data storage locations and retention periods
- Data sharing and transfers
- Security measures and access controls
- GDPR compliance touchpoints

### 1.2 Legal Framework
- **Primary Regulation**: EU General Data Protection Regulation (GDPR)
- **Article 30**: Records of processing activities
- **Article 35**: Data Protection Impact Assessment requirements
- **Swedish Data Protection Law**: Complementary national legislation

### 1.3 Data Controller Information
**AI Feedback Platform AB**  
- **Role**: Joint Controller (with Business Partners)
- **Responsibility**: Platform operations, AI processing, payment distribution
- **Contact**: dpo@ai-feedback-platform.se

---

## 2. System Architecture Overview

### 2.1 High-Level Data Flow
```
Customer → QR Scan → Voice Recording → AI Processing → Reward → Payment
    ↓           ↓            ↓             ↓          ↓        ↓
Consent → Session → Transcript → Analysis → Database → Stripe
    ↓           ↓            ↓             ↓          ↓        ↓
Cookies → Tracking → Anonymize → Store → Retention → Audit
```

### 2.2 System Components
- **Web Application**: Customer interface (Next.js PWA)
- **API Gateway**: Backend services coordination
- **AI Evaluator**: Voice processing and quality analysis
- **Database**: Supabase (PostgreSQL) with GDPR extensions
- **Payment System**: Stripe Connect integration
- **GDPR Module**: Compliance orchestration layer

---

## 3. Data Collection Points

### 3.1 Initial Customer Contact
**Trigger**: QR code scan at business location

**Data Collected**:
- Anonymous customer hash (generated)
- Device fingerprint (limited)
- Timestamp and location ID
- IP address (temporary)
- User agent string

**Legal Basis**: Legitimate interest (service provision)
**Retention**: 36 months (fraud prevention)
**Storage**: Supabase EU (encrypted)

### 3.2 Consent Collection
**Trigger**: First-time user or policy updates

**Data Collected**:
- Consent preferences (voice, analytics, marketing, cookies)
- IP address and user agent
- Consent timestamp and version
- Session context

**Legal Basis**: Legal obligation (GDPR Article 7)
**Retention**: 3 years after withdrawal
**Storage**: `consent_records` table (encrypted)

### 3.3 Voice Data Collection
**Trigger**: Customer provides voice feedback

**Data Collected**:
- Audio recording (temporary - 30 seconds max)
- Voice metadata (duration, quality metrics)
- Processing timestamps

**Legal Basis**: Consent (explicit)
**Retention**: Immediate deletion after processing
**Storage**: Temporary file system → Deleted
**Special Category**: Biometric data (Article 9 GDPR)

### 3.4 Transaction Data
**Trigger**: POS system integration

**Data Collected**:
- Transaction ID (from POS)
- Purchase amount
- Transaction timestamp
- Business location ID

**Legal Basis**: Contract performance
**Retention**: 7 years (accounting law)
**Storage**: `feedback_sessions` table

---

## 4. Processing Activities

### 4.1 Voice Processing Pipeline

#### 4.1.1 Voice to Text Conversion
**Purpose**: Convert customer voice to readable text
**Method**: WhisperX local processing + OpenAI fallback
**Data Subject**: Store customers providing feedback
**Categories**: Voice recordings, transcripts
**Recipients**: Internal AI systems only
**Transfers**: None (local processing)
**Retention**: Voice deleted immediately, transcript anonymized
**Security**: End-to-end encryption, secure deletion

#### 4.1.2 Real-time PII Sanitization
**Purpose**: Remove personal information from transcripts
**Method**: Pattern recognition and anonymization
**Legal Basis**: Legal obligation (data minimization)
**Processing**: Real-time during transcription
**Data Flow**: Raw transcript → PII detection → Anonymized transcript
**Logging**: All PII instances logged for audit

#### 4.1.3 AI Quality Analysis
**Purpose**: Evaluate feedback quality for reward calculation
**Method**: Multi-factor AI analysis (authenticity, concreteness, depth)
**Data Used**: Anonymized transcript + business context
**Legal Basis**: Contract performance
**Processing Time**: < 2 seconds
**Output**: Quality score (0-100) + reasoning

### 4.2 Consent Management Processing

#### 4.2.1 Consent Recording
**Purpose**: Track user consent for various processing activities
**Trigger**: Cookie banner, settings page, API calls
**Data Flow**: 
```
User Choice → Consent Manager → Database → Audit Log
     ↓              ↓              ↓         ↓
Legal Basis → Validation → Storage → Compliance
```

#### 4.2.2 Consent Validation
**Purpose**: Real-time consent checking before processing
**Method**: Database lookup with caching
**Frequency**: Every processing operation
**Response Time**: < 50ms
**Failure Mode**: Deny processing if consent unclear

### 4.3 Data Subject Rights Processing

#### 4.3.1 Data Export (Right to Access)
**Trigger**: Customer data export request
**Processing Flow**:
```
Request → Identity Verification → Data Aggregation → Anonymization → Secure Download
   ↓             ↓                     ↓                ↓              ↓
Audit → Authentication → Database Query → PII Check → Token Generation
```

**Data Included**:
- Feedback session history
- Anonymized transcripts
- Quality scores and rewards
- Consent history
- Processing metadata

**Format**: Structured JSON
**Security**: Token-based download, 30-day expiration
**Processing Time**: Automated within 24 hours

#### 4.3.2 Data Deletion (Right to Erasure)
**Trigger**: Customer deletion request or automated retention
**Processing Flow**:
```
Request → Verification → Deletion Planning → Execution → Confirmation
   ↓           ↓              ↓                ↓            ↓
Legal → Authentication → Scope Definition → Multi-table → Audit Log
```

**Deletion Scope**:
- All feedback sessions
- Voice data (already deleted)
- Session metadata
- Cached data
- Search indexes

**Exceptions**: Legal retention requirements (accounting, AML)
**Verification**: Deletion confirmation with audit trail

---

## 5. Data Storage and Retention

### 5.1 Database Schema

#### 5.1.1 Primary Data Tables
```sql
-- Customer Sessions
feedback_sessions: {
  customer_hash, transaction_data, quality_scores,
  voice_deleted_at, transcript_anonymized_at, gdpr_compliant
}

-- Consent Management  
consent_records: {
  customer_hash, consent_type, granted, ip_address,
  user_agent, consent_version, created_at
}

-- GDPR Requests
data_requests: {
  customer_hash, request_type, status, download_url,
  expires_at, completed_at
}
```

#### 5.1.2 Audit and Compliance Tables
```sql
-- Voice Data Lifecycle
voice_data_tracking: {
  session_id, customer_hash, processing_started_at,
  deleted_at, status
}

-- Comprehensive Audit Trail
gdpr_audit_log: {
  customer_hash, action_type, action_details,
  ip_address, legal_basis, created_at
}

-- Data Retention Management
data_retention_log: {
  data_category, retention_policy, records_processed,
  execution_completed_at
}
```

### 5.2 Retention Schedule

#### 5.2.1 Immediate Deletion (Real-time)
- **Voice recordings**: < 30 seconds after processing
- **Temporary files**: Immediate cleanup after use
- **Session tokens**: After session expiration
- **Error logs with PII**: Daily cleanup

#### 5.2.2 Short-term Retention (< 1 Year)
- **Raw transcripts**: 12 months → anonymization
- **Session cookies**: Browser session or 24 hours
- **Processing logs**: 90 days
- **IP address logs**: 30 days

#### 5.2.3 Medium-term Retention (1-3 Years)
- **Anonymized transcripts**: 3 years
- **Session metadata**: 36 months (fraud prevention)
- **Consent records**: 36 months after withdrawal
- **Audit logs**: 36 months

#### 5.2.4 Long-term Retention (7+ Years)
- **Payment records**: 7 years (Swedish accounting law)
- **Tax documentation**: 7 years
- **Legal compliance data**: As required by law

### 5.3 Automated Retention Management
```
Daily Cleanup Process:
├── Voice Data Verification (immediate deletion check)
├── Transcript Anonymization (12-month trigger)
├── Session Data Cleanup (36-month retention)
├── Log File Rotation (90-day cycles)
└── Audit Trail Generation
```

---

## 6. Data Transfers and Sharing

### 6.1 Internal Data Flows

#### 6.1.1 Application Layer Transfers
```
Web App ←→ API Gateway ←→ AI Evaluator
   ↓           ↓              ↓
Database ←→ GDPR Module ←→ Audit System
```

**Security**: TLS 1.3 encryption, mutual authentication
**Access Control**: JWT tokens, role-based permissions
**Monitoring**: All transfers logged and monitored

#### 6.1.2 Database Operations
- **Read Operations**: Customer data retrieval, consent validation
- **Write Operations**: Session creation, consent updates, audit logging
- **Batch Operations**: Data export, retention enforcement
- **Security**: Row-level security, encrypted connections

### 6.2 External Data Transfers

#### 6.2.1 Payment Processing (Stripe Connect)
**Purpose**: Customer reward distribution
**Data Transferred**:
- Customer identifier (anonymous hash)
- Payment amount
- Transaction metadata

**Legal Basis**: Contract performance
**Adequacy**: US adequacy decision + additional safeguards
**Security**: Stripe's PCI DSS Level 1 certification
**Retention**: Stripe's standard retention (7 years)

#### 6.2.2 AI Services (Fallback Only)
**Purpose**: Voice transcription when local processing fails
**Data Transferred**: Audio files (anonymized)
**Providers**: OpenAI Whisper API
**Legal Basis**: Legitimate interest (service continuity)
**Safeguards**: Standard Contractual Clauses
**Data Minimization**: Only when local processing unavailable
**Retention**: Not retained by third party

#### 6.2.3 Infrastructure Providers
**Supabase (Database)**:
- Location: EU (Germany)
- Data: All customer data
- Security: SOC 2 Type II, ISO 27001
- DPA: GDPR-compliant agreement

**Vercel (Hosting)**:
- Location: EU regions
- Data: Application code, logs
- Security: SOC 2 compliance
- Processing: Minimal personal data

### 6.3 Business Partner Data Sharing

#### 6.3.1 Aggregate Analytics (Anonymized)
**Purpose**: Business insights and reporting
**Data Shared**:
- Feedback volume statistics
- Quality score distributions
- Category analysis
- Trend reports

**Anonymization**: No individual customer identification possible
**Legal Basis**: Legitimate interest
**Frequency**: Monthly reports

#### 6.3.2 Individual Session Data
**Purpose**: Transaction matching and verification
**Data Shared**:
- Session timestamp
- Transaction ID correlation
- Quality score
- Reward amount

**Legal Basis**: Contract performance
**Security**: Encrypted API, authenticated access
**Retention**: Same as platform retention policy

---

## 7. Access Controls and Security

### 7.1 Data Access Matrix

#### 7.1.1 Role-Based Access Control
```
Role                | Customer Data | Voice Data | PII | Audit Logs
--------------------|---------------|------------|-----|------------
Customer            | Own only      | None       | Own | None
Business Partner    | Aggregate     | None       | None| Own logs
Platform Admin      | Operational   | None       | Limited | All
DPO                 | Compliance    | Audit only | As needed | All
Developer           | Test data     | None       | None | Dev logs
```

#### 7.1.2 Technical Access Controls
- **Database**: Row-level security, encrypted connections
- **Application**: JWT authentication, role validation
- **API**: Rate limiting, IP whitelisting options
- **Files**: Encrypted storage, secure deletion
- **Logs**: Centralized logging, access monitoring

### 7.2 Security Measures by Data Type

#### 7.2.1 Voice Data (Special Category)
- **Collection**: HTTPS, end-to-end encryption
- **Processing**: Local processing preferred, secure environments
- **Storage**: No persistent storage - immediate deletion
- **Access**: Minimal access, comprehensive logging
- **Deletion**: Cryptographic deletion, verification required

#### 7.2.2 Transcript Data
- **Sanitization**: Real-time PII removal during processing
- **Storage**: Encrypted database, access controlled
- **Anonymization**: Automated after 12 months
- **Access**: Business necessity only
- **Retention**: 3-year maximum with automated deletion

#### 7.2.3 Customer Identifiers
- **Anonymization**: Customer hash instead of direct identifiers
- **Linkability**: Designed to prevent cross-system tracking
- **Storage**: Encrypted, access controlled
- **Usage**: Limited to session management and fraud prevention

---

## 8. Data Subject Rights Implementation

### 8.1 Rights Exercise Workflow

#### 8.1.1 Request Reception
```
Customer Request → Identity Verification → Rights Assessment → Processing
       ↓                    ↓                   ↓              ↓
   Multi-channel      Customer hash      Legal basis      Automated/Manual
   (Email, API)       validation         analysis         execution
```

#### 8.1.2 Automated Processing
**Right to Access**: 
- Automated data aggregation
- Real-time anonymization
- Secure download generation
- 24-hour processing time

**Right to Rectification**:
- Real-time data updates
- Audit trail generation
- Business partner notification
- Immediate effect

**Right to Erasure**:
- Automated deletion workflows
- Legal retention verification
- Multi-system cleanup
- Confirmation generation

### 8.2 Manual Review Cases
- High-value customer requests (>10,000 SEK total rewards)
- Complex legal retention scenarios
- Cross-border transfer implications
- Dispute resolution cases

---

## 9. Compliance Monitoring and Audit

### 9.1 Continuous Monitoring

#### 9.1.1 Real-time Compliance Checks
- **Consent Validation**: Before every processing operation
- **Voice Data Monitoring**: Continuous deletion verification
- **Access Monitoring**: All data access logged and alerted
- **Retention Compliance**: Daily cleanup verification
- **Security Monitoring**: 24/7 threat detection

#### 9.1.2 Automated Compliance Reporting
```
Daily Reports:
├── Voice data deletion confirmation
├── PII sanitization statistics
├── Consent compliance metrics
├── Data access summaries
└── Security event summaries

Weekly Reports:
├── Data subject rights processing
├── Retention policy enforcement
├── Business partner compliance
└── Risk assessment updates

Monthly Reports:
├── Full compliance dashboard
├── GDPR metrics and KPIs
├── Third-party audit results
└── Improvement recommendations
```

### 9.2 Audit Trail Requirements

#### 9.2.1 Comprehensive Logging
All GDPR-relevant activities logged with:
- **Timestamp**: Precise time of action
- **User/System**: Who performed the action
- **Data Subject**: Customer hash (when applicable)
- **Action Type**: Specific GDPR activity
- **Legal Basis**: Justification for processing
- **IP Address**: Source of request
- **Result**: Success/failure status

#### 9.2.2 Log Retention and Security
- **Retention**: 36 months for GDPR audit logs
- **Security**: Encrypted storage, tamper-evident
- **Access**: DPO and authorized compliance personnel only
- **Backup**: Secure, encrypted backup systems
- **Deletion**: Secure deletion after retention period

---

## 10. Risk Assessment and Mitigation

### 10.1 Privacy Risk Analysis

#### 10.1.1 High-Risk Processing Activities
**Voice Data Processing**:
- **Risk**: Potential PII exposure in voice recordings
- **Likelihood**: Medium (human speech contains PII)
- **Impact**: High (special category data)
- **Mitigation**: Immediate deletion, local processing, minimal access

**Cross-border Transfers**:
- **Risk**: Inadequate protection in third countries
- **Likelihood**: Low (limited transfers, strong safeguards)
- **Impact**: Medium (regulatory penalties)
- **Mitigation**: Adequacy decisions, SCCs, minimal transfers

#### 10.1.2 Medium-Risk Processing Activities
**Customer Profiling**:
- **Risk**: Unintended profiling through feedback analysis
- **Likelihood**: Low (anonymized analysis)
- **Impact**: Medium (customer privacy)
- **Mitigation**: Purpose limitation, consent controls

**Data Retention**:
- **Risk**: Excessive data retention periods
- **Likelihood**: Low (automated retention management)
- **Impact**: Medium (storage minimization)
- **Mitigation**: Automated deletion, regular reviews

### 10.2 Mitigation Strategies

#### 10.2.1 Technical Safeguards
- **Privacy by Design**: Built-in privacy protection
- **Data Minimization**: Collect only necessary data
- **Encryption**: End-to-end encryption for all data
- **Access Controls**: Strict role-based permissions
- **Monitoring**: Continuous compliance monitoring

#### 10.2.2 Organizational Safeguards
- **Training**: Regular GDPR training for all staff
- **Policies**: Comprehensive privacy policies and procedures
- **Reviews**: Quarterly privacy impact assessments
- **Audits**: Annual third-party privacy audits
- **Incident Response**: Tested breach response procedures

---

## 11. International Transfers

### 11.1 Transfer Mechanisms

#### 11.1.1 Adequacy Decisions
**United States (Stripe Connect)**:
- EU-US Data Privacy Framework adequacy decision
- Additional contractual safeguards
- Limited to payment processing only
- Regular adequacy assessment monitoring

#### 11.1.2 Standard Contractual Clauses
**OpenAI (Fallback AI Processing)**:
- EU Standard Contractual Clauses (SCCs)
- Transfer Impact Assessment completed
- Additional technical safeguards (encryption)
- Minimal data, anonymous processing only

### 11.2 Transfer Safeguards

#### 11.2.1 Technical Measures
- **Encryption**: AES-256 encryption for all transfers
- **Pseudonymization**: Customer data anonymized before transfer
- **Access Controls**: Strict recipient access limitations
- **Monitoring**: All transfers logged and monitored

#### 11.2.2 Legal Safeguards
- **Contractual Protection**: GDPR-compliant contracts
- **Regular Reviews**: Annual transfer assessment
- **Suspension Rights**: Ability to suspend transfers
- **Alternative Providers**: EU-based alternatives identified

---

## 12. Data Processing Record (Article 30)

### 12.1 Processing Activity Record

**Controller**: AI Feedback Platform AB  
**Joint Controllers**: Business Partners (per location)  
**DPO Contact**: dpo@ai-feedback-platform.se  

#### 12.1.1 Voice Feedback Processing
**Purpose**: Customer feedback collection and analysis for reward distribution  
**Legal Basis**: Consent (voice processing) + Contract (reward calculation)  
**Categories of Data Subjects**: Store customers  
**Categories of Data**: Voice recordings, transcripts, quality scores  
**Recipients**: Internal systems, Stripe Connect (payment), Business Partners (aggregated)  
**Third Country Transfers**: US (Stripe - adequacy decision)  
**Retention**: Voice data - immediate deletion, Other data - up to 36 months  
**Security Measures**: Encryption, access controls, immediate voice deletion  

#### 12.1.2 Consent Management Processing
**Purpose**: GDPR compliance, consent tracking and validation  
**Legal Basis**: Legal obligation (GDPR compliance)  
**Categories of Data Subjects**: All platform users  
**Categories of Data**: Consent preferences, IP addresses, timestamps  
**Recipients**: Internal compliance systems  
**Third Country Transfers**: None  
**Retention**: 36 months after consent withdrawal  
**Security Measures**: Encrypted storage, access controls, audit logging  

#### 12.1.3 Customer Analytics Processing
**Purpose**: Service improvement and business analytics  
**Legal Basis**: Consent (analytics cookies)  
**Categories of Data Subjects**: Consenting users only  
**Categories of Data**: Anonymous usage patterns, performance metrics  
**Recipients**: Internal analytics, Business Partners (aggregated)  
**Third Country Transfers**: None  
**Retention**: 24 months, anonymized after 12 months  
**Security Measures**: Anonymization, aggregation, consent validation  

---

## 13. Conclusion and Maintenance

### 13.1 Document Maintenance
**Review Frequency**: Quarterly or upon system changes  
**Update Triggers**: New processing activities, legal changes, security updates  
**Approval Process**: DPO review, legal validation, management approval  
**Version Control**: Complete version history maintained  

### 13.2 Continuous Improvement
**Monitoring**: Real-time compliance dashboard  
**Feedback**: Regular privacy team reviews  
**Benchmarking**: Industry best practice comparison  
**Innovation**: Privacy-enhancing technology adoption  

### 13.3 Stakeholder Communication
**Internal**: Regular compliance training and updates  
**External**: Privacy policy updates, customer notifications  
**Regulatory**: Proactive supervisory authority engagement  
**Business Partners**: Regular compliance reviews and reports  

---

**Document Control**
- **Created**: December 19, 2024
- **Version**: 1.0
- **Next Review**: March 19, 2025
- **Owner**: Data Protection Officer
- **Classification**: Internal Use - GDPR Compliance

*This data flow mapping serves as the official record of processing activities for AI Feedback Platform in accordance with GDPR Article 30 requirements.*