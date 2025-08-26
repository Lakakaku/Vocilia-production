# Data Processing Agreement (DPA)
## AI Feedback Platform - Business Partnership

**Effective Date:** December 19, 2024  
**Version:** 1.0  
**Agreement Type:** Controller-Processor Agreement under GDPR Article 28  

---

## 1. Parties and Definitions

### 1.1 Parties
**Controller (Business Partner)**  
Name: [BUSINESS_NAME]  
Organization Number: [BUSINESS_ORG_NUMBER]  
Address: [BUSINESS_ADDRESS]  
Contact: [BUSINESS_CONTACT]  

**Processor (AI Feedback Platform)**  
Name: AI Feedback Platform AB  
Organization Number: [PLATFORM_ORG_NUMBER]  
Address: [PLATFORM_ADDRESS]  
Contact: dpo@ai-feedback-platform.se  

### 1.2 Definitions
- **Controller**: The Business Partner who determines the purposes and means of processing personal data
- **Processor**: AI Feedback Platform who processes personal data on behalf of the Controller
- **Personal Data**: Any information relating to identified or identifiable customers
- **Processing**: Any operation performed on personal data (collection, recording, storage, etc.)
- **Data Subject**: The individual customers providing feedback
- **Sub-processor**: Third party engaged by Processor to assist with processing activities

---

## 2. Scope and Purpose

### 2.1 Processing Scope
This DPA governs the processing of personal data by AI Feedback Platform on behalf of the Business Partner for the following purposes:
- Voice feedback collection and analysis
- Customer reward calculation and distribution
- Fraud prevention and security monitoring
- Service improvement and analytics (with consent)

### 2.2 Data Categories
Personal data categories processed under this agreement:
- **Voice data**: Audio recordings (temporarily) and transcriptions
- **Customer identifiers**: Anonymous customer hashes and device fingerprints
- **Transaction data**: Purchase amounts, transaction IDs, timestamps
- **Technical data**: IP addresses, user agents, session information
- **Consent data**: Cookie preferences and data processing consents

### 2.3 Data Subject Categories
- Customers of the Business Partner who participate in voice feedback sessions
- Visitors to Business Partner locations who scan QR codes
- Users of the AI Feedback Platform interface

---

## 3. Processor Obligations

### 3.1 Processing Instructions
AI Feedback Platform shall:
- Process personal data only on documented instructions from the Business Partner
- Immediately inform the Business Partner if instructions violate GDPR or other data protection laws
- Not process data for own purposes beyond service provision
- Implement appropriate technical and organizational measures

### 3.2 Confidentiality
AI Feedback Platform ensures that:
- All personnel processing personal data are bound by confidentiality obligations
- Access is granted only to authorized personnel on a need-to-know basis
- Confidentiality obligations survive termination of this agreement
- Regular training on data protection and confidentiality is provided

### 3.3 Data Security Measures

#### 3.3.1 Technical Measures
- **Encryption**: AES-256 encryption at rest, TLS 1.3 in transit
- **Access Control**: Multi-factor authentication, role-based permissions
- **Network Security**: Firewalls, intrusion detection, secure network architecture
- **Data Segregation**: Logical separation of each Business Partner's data
- **Backup Security**: Encrypted backups with secure key management

#### 3.3.2 Organizational Measures
- **Security Policies**: Comprehensive information security policies
- **Staff Training**: Regular GDPR and security awareness training
- **Access Management**: Formal procedures for granting/revoking access
- **Incident Response**: 24/7 monitoring and incident response procedures
- **Security Audits**: Annual third-party security assessments

### 3.4 Data Retention and Deletion

#### 3.4.1 Retention Schedule
- **Voice recordings**: Deleted within 30 seconds of processing completion
- **Voice transcripts**: Anonymized after 12 months, deleted after 3 years
- **Customer session data**: Retained for 36 months for fraud prevention
- **Payment records**: Retained for 7 years per Swedish accounting law
- **Consent records**: Retained for 3 years after consent withdrawal

#### 3.4.2 Deletion Procedures
- Automated deletion processes with audit logging
- Secure deletion methods ensuring data cannot be recovered
- Confirmation of deletion provided to Business Partner upon request
- Emergency deletion capabilities for privacy incidents

---

## 4. Sub-processing

### 4.1 Authorized Sub-processors
The Business Partner hereby authorizes the use of the following sub-processors:

#### 4.1.1 Infrastructure Sub-processors
- **Supabase** (Database hosting) - EU/Sweden, GDPR compliant
- **Vercel** (Web hosting) - EU region, GDPR compliant
- **Railway** (Backend services) - EU region, GDPR compliant

#### 4.1.2 Service Sub-processors
- **Stripe Connect** (Payment processing) - US with adequacy decision
- **WhisperX** (Voice transcription) - Local processing, no data sharing
- **Ollama/OpenAI** (AI analysis) - Anonymized data only, US with SCCs

### 4.2 Sub-processor Obligations
AI Feedback Platform ensures that:
- All sub-processors are bound by equivalent data protection obligations
- Appropriate contracts are in place with all sub-processors
- Regular audits are conducted of sub-processor compliance
- Business Partner is notified of any changes to sub-processors

### 4.3 Sub-processor Changes
- **New Sub-processors**: 30 days advance notice to Business Partner
- **Objection Rights**: Business Partner may object within 15 days
- **Alternative Solutions**: Good faith effort to provide alternatives if objection raised
- **Termination Rights**: Business Partner may terminate if no suitable alternative

---

## 5. Data Subject Rights

### 5.1 Rights Facilitation
AI Feedback Platform will assist the Business Partner in fulfilling data subject rights:

#### 5.1.1 Access Rights
- Provide data extracts within 14 days of Business Partner request
- Include all personal data categories processed
- Deliver in structured, machine-readable format (JSON/CSV)
- Ensure data is accurately anonymized where required

#### 5.1.2 Rectification and Erasure
- Correct inaccurate data within 7 days of notification
- Delete data upon validated erasure request within 30 days
- Provide confirmation of corrections/deletions
- Update consent preferences in real-time

#### 5.1.3 Restriction and Objection
- Implement processing restrictions within 24 hours
- Maintain restricted data separately from active processing
- Respect objections to processing based on legitimate interests
- Document all restrictions and objections with audit trail

### 5.2 Response Procedures
- **Direct Requests**: Forward data subject requests received directly to Business Partner
- **Response Time**: Support Business Partner to meet GDPR deadlines
- **Technical Assistance**: Provide technical support for complex requests
- **Cost Structure**: No additional charges for standard data subject requests

---

## 6. Personal Data Breaches

### 6.1 Breach Detection
AI Feedback Platform maintains:
- 24/7 automated monitoring and alerting systems
- Regular security assessments and penetration testing
- Staff training on breach identification and response
- Clear escalation procedures for potential breaches

### 6.2 Breach Notification
Upon detecting a breach affecting Business Partner data:
- **Immediate notification**: Within 2 hours of breach discovery
- **Detailed report**: Within 24 hours including:
  - Nature and scope of the breach
  - Categories and approximate number of affected individuals
  - Likely consequences of the breach
  - Measures taken or proposed to address the breach

### 6.3 Breach Response
AI Feedback Platform will:
- Take immediate measures to contain the breach
- Cooperate fully with Business Partner's breach response
- Assist with regulatory notification if required
- Provide ongoing updates until breach is fully resolved
- Document all actions taken for compliance purposes

### 6.4 Post-Breach Actions
- Root cause analysis within 30 days
- Implementation of preventive measures
- Update security procedures as necessary
- Lessons learned documentation and staff retraining

---

## 7. Data Transfers

### 7.1 Geographic Restrictions
- **Primary Processing**: European Union (Sweden, Germany)
- **Backup Storage**: EU regions only
- **Data Center Locations**: EU-based infrastructure exclusively

### 7.2 Third Country Transfers
Limited transfers outside EU with appropriate safeguards:
- **Stripe Connect**: US with adequacy decision + additional contractual safeguards
- **OpenAI API**: US with Standard Contractual Clauses (anonymized data only)
- **Emergency Support**: Exceptional circumstances only with explicit approval

### 7.3 Transfer Safeguards
- Standard Contractual Clauses (SCCs) for all non-adequate countries
- Regular assessment of transfer impact assessments
- Additional technical safeguards (encryption, pseudonymization)
- Ongoing monitoring of third country privacy law developments

---

## 8. Audits and Compliance

### 8.1 Audit Rights
Business Partner has the right to:
- Conduct annual audits of AI Feedback Platform's data processing
- Review security measures and compliance procedures
- Access relevant documentation and policies
- Interview key personnel involved in data processing

### 8.2 Audit Procedures
- **Notice Period**: 30 days advance notice for routine audits
- **Emergency Audits**: 48 hours notice for breach-related audits
- **Scope Definition**: Mutually agreed audit scope and procedures
- **Confidentiality**: Audit findings treated as confidential information

### 8.3 Compliance Monitoring
AI Feedback Platform provides:
- **Monthly Reports**: Data processing statistics and compliance metrics
- **Quarterly Reviews**: Security posture and risk assessment updates
- **Annual Certification**: Third-party security and privacy certifications
- **Continuous Monitoring**: Real-time compliance dashboard access

### 8.4 Compliance Assistance
AI Feedback Platform assists with:
- Data Protection Impact Assessments (DPIAs)
- Supervisory authority inquiries and investigations
- Privacy certification processes
- GDPR compliance documentation and evidence

---

## 9. Term and Termination

### 9.1 Agreement Term
- **Effective Date**: Date of Business Partner onboarding
- **Duration**: Continues for duration of main service agreement
- **Renewal**: Automatic renewal with service agreement
- **Amendment**: Material changes require written agreement

### 9.2 Termination Events
This DPA terminates upon:
- Expiration or termination of main service agreement
- Mutual written agreement of both parties
- Material breach not cured within 30 days of notice
- Legal requirements making processing impossible

### 9.3 Post-Termination Obligations
Upon termination, AI Feedback Platform will:
- **Data Return**: Provide complete data export within 30 days
- **Data Deletion**: Securely delete all personal data within 60 days
- **Confirmation**: Provide written confirmation of data deletion
- **Exception**: Retain data only as required by law with justification

### 9.4 Survival Provisions
The following provisions survive termination:
- Confidentiality obligations (indefinite)
- Security breach notification (2 years)
- Audit rights (1 year for ongoing investigations)
- Limitation of liability (applicable limitation period)

---

## 10. Liability and Indemnification

### 10.1 Limitation of Liability
- AI Feedback Platform's liability limited to direct damages only
- Maximum liability: 12 months of service fees or €100,000, whichever is higher
- No liability for consequential, indirect, or punitive damages
- Exceptions: Willful misconduct, fraud, or gross negligence

### 10.2 Indemnification
AI Feedback Platform will indemnify Business Partner for:
- Claims arising from AI Feedback Platform's breach of GDPR
- Unauthorized disclosure of personal data by AI Feedback Platform
- Processing personal data outside scope of this DPA
- Security breaches caused by AI Feedback Platform's negligence

### 10.3 Insurance Coverage
AI Feedback Platform maintains:
- **Cyber Liability Insurance**: Minimum €5,000,000 coverage
- **Professional Indemnity**: Minimum €2,000,000 coverage
- **General Liability**: Minimum €1,000,000 coverage
- **Coverage Evidence**: Certificates provided annually

---

## 11. Miscellaneous Provisions

### 11.1 Governing Law
This DPA is governed by:
- **Primary Law**: Swedish data protection law and GDPR
- **Contract Law**: Swedish contract law
- **Dispute Resolution**: Swedish courts or agreed arbitration
- **Language**: Swedish version legally binding

### 11.2 Amendment and Modification
- Material changes require written agreement signed by both parties
- Minor updates may be made with 30 days notice
- Legal requirement changes effective immediately upon notice
- Version control maintained for all amendments

### 11.3 Severability
- Invalid provisions do not affect validity of remaining agreement
- Invalid provisions replaced with valid provisions of similar effect
- Interpretation consistent with GDPR requirements
- Good faith cooperation to resolve any ambiguities

### 11.4 Entire Agreement
This DPA together with the main service agreement constitutes the entire agreement regarding data processing. It supersedes all prior agreements, representations, and understandings between the parties regarding data processing.

---

## 12. Contact Information and Signatures

### 12.1 Business Partner Contact
**Data Controller Representative:**  
Name: [BUSINESS_CONTACT_NAME]  
Title: [BUSINESS_CONTACT_TITLE]  
Email: [BUSINESS_CONTACT_EMAIL]  
Phone: [BUSINESS_CONTACT_PHONE]  

### 12.2 AI Feedback Platform Contact
**Data Protection Officer:**  
Name: [DPO_NAME]  
Title: Data Protection Officer  
Email: dpo@ai-feedback-platform.se  
Phone: [DPO_PHONE]  

**Legal Contact:**  
Name: [LEGAL_CONTACT_NAME]  
Title: Legal Counsel  
Email: legal@ai-feedback-platform.se  
Phone: [LEGAL_PHONE]  

### 12.3 Emergency Contacts
**Security Incidents:** security@ai-feedback-platform.se  
**Privacy Emergencies:** emergency-privacy@ai-feedback-platform.se  
**24/7 Hotline:** [EMERGENCY_PHONE]  

---

**SIGNATURES**

**Business Partner (Data Controller):**

Signature: _________________________  
Name: [BUSINESS_SIGNATORY_NAME]  
Title: [BUSINESS_SIGNATORY_TITLE]  
Date: _____________________  

**AI Feedback Platform AB (Data Processor):**

Signature: _________________________  
Name: [PLATFORM_SIGNATORY_NAME]  
Title: Chief Executive Officer  
Date: _____________________  

---

**ATTACHMENTS**

- Annex A: Technical and Organizational Security Measures
- Annex B: Sub-processor List and Contacts
- Annex C: Data Categories and Processing Activities
- Annex D: Standard Contractual Clauses (where applicable)

---

*This Data Processing Agreement is prepared in accordance with GDPR Article 28 requirements and Swedish data protection law. Legal review recommended before execution.*