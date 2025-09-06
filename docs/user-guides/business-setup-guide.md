# Business Setup Guide: AI Feedback Platform

*Transform customer feedback into actionable insights and increased revenue*

## Welcome Business Owners! 🏢

The AI Feedback Platform helps Swedish businesses collect high-quality customer feedback while rewarding customers with cashback. This guide will walk you through setup, integration, and optimization.

---

## Getting Started

### Eligibility Requirements ✅

**Business Requirements:**
- Valid Swedish organization number (org.nr)
- Physical location(s) in Sweden
- Active business operations
- Point-of-sale (POS) system (Square, Shopify POS, Zettle, or manual)

**Documentation Needed:**
- Business registration certificate
- Valid ID for business representative
- Bank account details for payouts
- POS system credentials (if integrating)

### Account Types 📊

**Trial Account (Free for 30 days)**
- 30 free feedback sessions
- Basic analytics dashboard
- Manual transaction verification
- Email support

**Professional Account (2,850 SEK/month)**
- Unlimited feedback sessions
- Advanced analytics and insights
- Automatic POS integration
- Priority support
- Custom QR codes and branding

**Enterprise Account (Custom pricing)**
- Multiple locations support
- Advanced fraud protection
- Dedicated account manager
- Custom integrations
- White-label options

---

## Step 1: Business Registration

### Online Registration 🌐

**Visit:** https://business.aifeedback.se/signup

1. **Business Information**
   ```
   Business Name: Café Aurora Stockholm
   Organization Number: 556123-4567
   Business Type: Restaurant/Café
   Primary Contact Email: owner@cafeaurora.se
   Phone Number: +46-70-123-4567
   ```

2. **Business Address**
   ```
   Street Address: Drottninggatan 123
   City: Stockholm
   Postal Code: 11151
   Country: Sweden
   ```

3. **Business Description**
   - Main products/services
   - Target customers
   - Business hours
   - Special features (WiFi, outdoor seating, etc.)

### Verification Process 🔍

**Automatic Verification (2-5 minutes):**
- Organization number validated against Bolagsverket
- Address verification
- Basic fraud checks

**Manual Review (24-48 hours):**
- Document review
- Business legitimacy check
- Compliance verification

**Approval Notification:**
You'll receive an email when your account is approved and ready for setup.

---

## Step 2: Payment Setup (Stripe Connect)

### Why Stripe Connect? 💳

- Secure, PCI-compliant payment processing
- Instant customer reward payouts
- Automatic commission handling
- Full transaction transparency
- Swedish banking integration

### Setting Up Payments 🏦

1. **Express Account Creation**
   - Click "Setup Payments" in your dashboard
   - Provide business banking details
   - Upload required documents:
     - Business registration
     - Representative ID
     - Bank account verification

2. **Required Information**
   ```
   Business Bank Account:
   - Bank Name: SEB, Handelsbanken, Swedbank, etc.
   - Account Number: XXXX-XXXX-XXXX
   - Routing Code: Bank-specific
   - Account Type: Business
   
   Business Representative:
   - Full Name: [Legal name]
   - Date of Birth: YYYY-MM-DD
   - Phone Number: +46-XX-XXX-XXXX
   - Email: [Contact email]
   ```

3. **Onboarding Completion**
   - Complete Stripe onboarding form
   - Verify bank account (1-2 micro-deposits)
   - Accept terms and conditions
   - Activate payment processing

### Commission Structure 💰

**Standard Rates:**
- Platform commission: 20% of rewards paid
- Example: Customer earns 5 SEK → You pay 1 SEK commission
- Stripe processing fees: ~1.4% + 1.80 SEK per transaction

**Monthly Billing:**
- Commission charges automatically deducted
- Detailed monthly statements provided
- No hidden fees or setup costs

---

## Step 3: Location Setup

### Adding Business Locations 📍

**Single Location Setup:**
1. Go to "Locations" in your dashboard
2. Click "Add Location"
3. Enter location details:
   ```
   Location Name: Main Store
   Address: [Full address]
   Business Hours: Mon-Fri 7:00-18:00
   Special Features: WiFi, Outdoor seating
   Staff Count: 3-5 employees
   ```

**Multiple Locations:**
- Each location gets unique QR codes
- Separate analytics per location
- Centralized management dashboard
- Location-specific staff training

### QR Code Generation 🔲

**Automatic QR Code Creation:**
- Unique QR codes generated for each location
- Expires automatically after 365 days (security)
- Customizable design and branding
- Download in multiple formats (PNG, PDF, SVG)

**QR Code Placement Best Practices:**
- **Restaurants:** On tables, receipts, payment terminals
- **Cafés:** Counter displays, table tents, receipts  
- **Retail:** Checkout counters, customer service areas
- **Multiple sizes:** A4 posters, table cards, receipt inserts

### Physical Setup Tips 💡

**High-Visibility Locations:**
- Near point of sale
- On customer tables
- Receipt integration
- Staff recommendation areas

**Clear Instructions:**
```
Swedish Text:
"Ge oss feedback och få belöning!
Scanna QR-koden med din telefon
→ Dela din upplevelse
→ Få cashback direkt"

English Text:
"Share feedback, get rewarded!
Scan with your phone camera
→ Share your experience  
→ Receive instant cashback"
```

---

## Step 4: POS Integration

### Supported POS Systems 🖥️

**Fully Integrated:**
- **Square** - Automatic transaction sync
- **Shopify POS** - Real-time verification
- **Zettle (PayPal)** - Swedish banking optimized

**Manual Integration:**
- Any POS system via manual entry
- Receipt-based verification
- Staff-assisted validation

### Integration Setup 🔧

**Square Integration:**
1. Connect Square account in dashboard
2. Authorize API access
3. Select location(s) to sync
4. Test transaction verification
5. Train staff on process

**API Configuration:**
```json
{
  "pos_provider": "square",
  "location_id": "L7HXY8Z2R3456",
  "webhook_url": "https://api.aifeedback.se/webhooks/square",
  "sync_interval": "real-time",
  "transaction_retention": "30_days"
}
```

**Verification Options:**
- Automatic (recommended): Transactions sync automatically
- Semi-automatic: Staff confirms transactions
- Manual: Customers enter transaction details

### Manual Verification Process 📝

**For businesses without POS integration:**

1. **Staff Training Required:**
   - How to help customers with transaction IDs
   - Where to find transaction details on receipts
   - How to resolve verification issues

2. **Receipt Requirements:**
   - Clear transaction ID
   - Date and time stamp
   - Total amount (including tax)
   - Location identifier

3. **Customer Support:**
   - Help customers locate transaction information
   - Assist with amount discrepancies
   - Contact platform support for issues

---

## Step 5: Staff Training

### Training Materials 📚

**Staff Training Video (15 minutes):**
- Platform overview and benefits
- Customer interaction guidelines
- Technical troubleshooting
- Common questions and answers

**Training Checklist:**
```
□ Understand the feedback process
□ Know how to help customers with QR codes
□ Can explain transaction verification
□ Understand reward system basics
□ Know who to contact for support
□ Practice handling common questions
```

### Customer Interaction Guidelines 👥

**Encouraging Feedback:**
✅ **Do:**
- "Vi värdesätter din feedback - scanna QR-koden för belöning!"
- "Would you like to share feedback and earn cashback?"
- Explain the process if customers seem confused
- Provide help with technical issues

❌ **Don't:**
- Pressure customers to give positive feedback
- Suggest what customers should say
- Get involved in the feedback content
- Promise specific reward amounts

### Common Customer Questions 💬

**Q: "How much will I earn?"**
A: "Det beror på kvaliteten på din feedback - vanligtvis 3-12% av köpet."
*(It depends on your feedback quality - usually 3-12% of purchase)*

**Q: "Is this safe?"**
A: "Ja, det är säkert och GDPR-kompatibelt. Ingen personlig information sparas."
*(Yes, it's secure and GDPR compliant. No personal information is stored)*

**Q: "How long does it take?"**
A: "Cirka 2-3 minuter total, och betalningen kommer inom 5 minuter."
*(About 2-3 minutes total, payment arrives within 5 minutes)*

---

## Step 6: Dashboard Overview

### Main Dashboard Features 📊

**Daily Summary:**
- Feedback sessions today
- Average quality score
- Total rewards paid
- Top feedback categories

**Analytics Sections:**

1. **Performance Metrics**
   - Quality score trends
   - Customer satisfaction ratings
   - Feedback volume by time/day
   - Staff performance insights

2. **Customer Insights**
   - Common praise themes
   - Improvement opportunities
   - Sentiment analysis
   - Customer recommendations

3. **Financial Overview**
   - Rewards paid vs revenue impact
   - ROI calculations
   - Commission charges
   - Monthly summaries

### Understanding Your Data 📈

**Quality Score Interpretation:**
- **85-100:** Exceptional experience
- **70-84:** Very good, minor improvements possible
- **55-69:** Good, some specific issues to address
- **40-54:** Fair, significant improvements needed
- **0-39:** Poor, immediate attention required

**Feedback Categories:**
- **Service:** Staff friendliness, speed, knowledge
- **Product Quality:** Food/drink taste, presentation, temperature
- **Atmosphere:** Ambiance, cleanliness, comfort
- **Value:** Pricing, portions, overall worth
- **Experience:** Overall satisfaction, likelihood to return

### Acting on Feedback 🎯

**High-Impact Improvements:**
1. **Staff Training:** Address service-related feedback
2. **Product Quality:** Focus on most-mentioned items
3. **Operational Changes:** Fix systemic issues
4. **Environment:** Improve atmosphere based on feedback

**ROI Tracking:**
- Monitor quality scores after implementing changes
- Track customer return rates
- Calculate revenue impact of improvements
- Measure long-term customer satisfaction trends

---

## Step 7: Optimization Strategies

### Maximizing Feedback Quality 🎯

**Business Context Optimization:**
```json
{
  "business_specialties": [
    "artisan coffee",
    "fresh pastries", 
    "vegan options"
  ],
  "known_strengths": [
    "excellent coffee quality",
    "friendly staff",
    "cozy atmosphere"
  ],
  "improvement_areas": [
    "morning queue times",
    "WiFi connectivity"
  ],
  "staff_highlights": [
    {"name": "Anna", "role": "Barista"},
    {"name": "Erik", "role": "Manager"}
  ]
}
```

**This helps the AI:**
- Validate authentic customer experiences
- Identify specific staff mentions
- Recognize genuine observations
- Detect fraudulent feedback

### Increasing Feedback Volume 📈

**QR Code Optimization:**
- Place codes where customers naturally look
- Use clear, multilingual instructions
- Make codes easily scannable (good lighting)
- Replace codes regularly (security)

**Staff Encouragement:**
- Mention feedback during checkout
- Explain benefits to customers
- Provide quick technical help
- Share success stories

**Incentive Programs:**
- Special promotions for feedback participants
- Loyalty program integration
- Staff bonuses for feedback volume
- Customer appreciation events

### Fraud Prevention 🛡️

**Red Flags to Watch For:**
- Unusually high reward claims
- Generic, non-specific feedback
- Multiple similar reviews
- Reviews mentioning things you don't offer

**Best Practices:**
- Monitor your feedback dashboard daily
- Report suspicious patterns immediately
- Train staff to recognize unusual behavior
- Maintain clear QR code placement

---

## Billing & Pricing

### Understanding Your Costs 💰

**Commission Structure:**
```
Customer Purchase: 50.00 SEK
Customer Quality Score: 89% (Excellent)
Customer Reward: 5.50 SEK (11%)
Your Commission: 1.10 SEK (20% of reward)
Net Cost to You: 1.10 SEK
```

**Monthly Statement Example:**
```
Total Customer Rewards Paid: 2,847 SEK
Platform Commission (20%): 569 SEK
Stripe Processing Fees: 127 SEK
Total Monthly Cost: 696 SEK

Total Feedback Sessions: 127
Average Cost per Feedback: 5.48 SEK
```

### ROI Calculation 📊

**Typical Business Impact:**
- 15-25% increase in customer satisfaction scores
- 10-18% increase in repeat visits
- 8-15% improvement in online reviews
- 12-20% increase in word-of-mouth referrals

**Example ROI Calculation:**
```
Monthly Investment: 696 SEK
Customer Lifetime Value Increase: 15%
Average Customer Value: 45 SEK per visit
Increased Visits per Month: 38
Additional Revenue: 1,710 SEK
Net ROI: 1,014 SEK (145% return)
```

---

## Troubleshooting

### Common Issues & Solutions 🔧

**Low Feedback Volume:**
- Check QR code placement and visibility
- Train staff to encourage participation
- Verify QR codes haven't expired
- Ensure POS integration is working

**Poor Quality Scores:**
- Review feedback for recurring themes
- Address operational issues mentioned
- Train staff based on feedback
- Improve business context information

**Payment Issues:**
- Verify Stripe account is active
- Check bank account details
- Ensure sufficient funds for commissions
- Contact support for processing delays

**Technical Problems:**
- Test QR codes regularly
- Verify POS integration status
- Check internet connectivity
- Update business information if changed

### Getting Support 📞

**Support Channels:**
- Email: business-support@aifeedback.se
- Phone: +46-8-123-456-78 (Mon-Fri 9-17)
- Live Chat: business.aifeedback.se
- Emergency: 24/7 email for critical issues

**Response Times:**
- General inquiries: 4-8 hours
- Technical issues: 2-4 hours
- Payment problems: 1-2 hours
- Critical outages: 30 minutes

---

## Advanced Features

### Multi-Location Management 🏢

**Centralized Dashboard:**
- View all locations in one interface
- Compare performance across sites
- Centralized staff management
- Bulk QR code generation

**Location-Specific Analytics:**
- Individual performance metrics
- Local customer insights
- Competitive analysis by area
- Location-based improvement recommendations

### Custom Integrations ⚙️

**Enterprise API Access:**
- Custom POS integrations
- Third-party analytics tools
- CRM system connections
- Custom reporting solutions

**Webhook Configuration:**
```json
{
  "events": [
    "feedback.completed",
    "payment.processed", 
    "fraud.detected",
    "quality.threshold_reached"
  ],
  "endpoint": "https://your-system.com/webhooks",
  "authentication": "bearer_token"
}
```

### White-Label Options 🏷️

**Custom Branding:**
- Your logo on customer interface
- Custom color schemes
- Branded QR codes
- Custom domain names

**Partnership Programs:**
- Referral bonuses for new businesses
- Volume discounts for chains
- Co-marketing opportunities
- Industry-specific packages

---

## Legal & Compliance

### GDPR Compliance 🛡️

**Data Protection:**
- Customer voice data deleted within 24 hours
- Minimal personal data collection
- Secure data processing
- Right to erasure compliance

**Your Responsibilities:**
- Include feedback collection in privacy policy
- Inform customers about data processing
- Maintain records of consent
- Report data breaches if applicable

### Terms of Service Summary ⚖️

**Business Obligations:**
- Provide genuine service to customers
- Not manipulate or incentivize specific feedback
- Pay commissions promptly
- Comply with Swedish consumer protection laws

**Platform Rights:**
- Quality score decisions are final
- Right to suspend accounts for policy violations
- Commission rate adjustments with 30-day notice
- Platform improvements and feature updates

---

## Success Stories

### Case Study: Café Aurora Stockholm ☕

**Background:**
- Small café with 3 staff members
- 50-80 customers daily
- Struggling with inconsistent service quality

**Implementation:**
- Joined platform in Month 1
- Placed QR codes on all tables
- Trained staff in 1 afternoon session
- Integrated with Square POS

**Results after 3 months:**
- **647 feedback sessions** collected
- **Average quality score: 78.2** (up from 65)
- **Customer satisfaction: +23%**
- **Repeat visits: +31%**
- **Monthly revenue: +18%** (4,200 SEK increase)
- **Platform cost: 892 SEK/month**
- **ROI: 471%** return on investment

**Key Improvements Made:**
1. **Staff Training:** Based on feedback mentioning slow service
2. **Menu Changes:** Removed unpopular items, improved favorites  
3. **WiFi Upgrade:** Multiple customers mentioned connectivity issues
4. **Morning Rush:** Added second barista during peak hours

**Owner Quote:**
*"The feedback platform transformed how we understand our customers. Instead of guessing what they want, we know exactly what to improve. The ROI speaks for itself."*

---

## Getting Started Checklist

### Pre-Launch Checklist ✅

```
Business Setup:
□ Account created and verified
□ Payment processing activated (Stripe)
□ Location(s) added to platform
□ QR codes generated and printed
□ Staff training completed

Technical Setup:
□ POS integration tested (if applicable)
□ QR codes placed in optimal locations
□ Transaction verification working
□ Dashboard access confirmed
□ Support contacts saved

Launch Preparation:
□ Staff ready to help customers
□ Troubleshooting guide available
□ First-day monitoring planned
□ Customer explanation materials ready
```

### First Week Goals 🎯

**Day 1-3:** Focus on technical functionality
- Monitor for technical issues
- Help customers with process
- Collect initial feedback data

**Day 4-7:** Optimize customer experience
- Adjust QR code placement if needed
- Refine staff interactions
- Address common questions

**Week 2+:** Analyze and improve
- Review quality score trends
- Implement feedback suggestions
- Optimize reward generation

---

## Contact & Support

### Business Support Team 📧

**General Support:**
- Email: business-support@aifeedback.se
- Phone: +46-8-123-456-78
- Hours: Monday-Friday 9:00-17:00 CET

**Technical Support:**
- Email: tech@aifeedback.se  
- Emergency: +46-70-987-6543
- 24/7 for critical system issues

**Account Management:**
- Email: accounts@aifeedback.se
- Dedicated manager for Enterprise accounts
- Monthly check-ins and optimization reviews

### Resources 📚

**Online Resources:**
- Business Portal: business.aifeedback.se
- Video Tutorials: help.aifeedback.se/videos
- API Documentation: developers.aifeedback.se
- Community Forum: forum.aifeedback.se

**Training Materials:**
- Staff training videos (Swedish/English)
- Customer instruction templates
- QR code design templates
- Best practices guides

---

*Last Updated: October 26, 2024*  
*Version: 2.1*  
*© 2024 AI Feedback Platform AB*

**Ready to get started?** Visit business.aifeedback.se or email business-support@aifeedback.se