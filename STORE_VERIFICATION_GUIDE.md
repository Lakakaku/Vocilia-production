# Store Verification Guide for AI Feedback Platform

## Overview
This guide helps store owners verify customer feedback submissions using a simple time and amount matching system. Instead of complex POS integration, stores manually match customer claims against their transaction records.

## System Requirements
- **Time Tolerance**: Customer reports must be within ±2 minutes of actual transaction time
- **Amount Tolerance**: Customer reports must be within ±0.5 SEK of actual transaction amount
- **Both conditions must be met** for approval

## Monthly Process
1. **1st of month**: You receive verification data export from AI Feedback Platform
2. **Review period**: 14 days to verify and approve/reject customer claims
3. **Deadline**: Return completed verification data by 15th of month
4. **Payment**: Invoice for approved cashbacks + 20% platform commission
5. **Late penalty**: If deadline missed, all unreviewed claims auto-approved and billed at full amount

---

## POS System Specific Instructions

### Square POS

#### Exporting Transaction Data
1. Log in to Square Dashboard (squareup.com/dashboard)
2. Go to **Reports** → **Transactions**
3. Set date range for the review period
4. Filter by location if you have multiple stores
5. Click **Export** and choose CSV format
6. Download includes: Date, Time, Amount, Payment Method, Transaction ID

#### Matching Process
1. Open the downloaded transaction CSV
2. For each customer verification:
   - Find transactions within ±2 minutes of reported time
   - Check if amount is within ±0.5 SEK of reported amount
   - Note: Square shows amounts including tax and fees

#### Example Square CSV Columns:
```
Date, Time, Gross Sales, Net Sales, Tax, Tips, Fees, Transaction ID, Payment Method
2024-12-01, 14:28:15, 127.50, 125.00, 2.50, 0.00, 1.20, sq_12345, Card
```

### Shopify POS

#### Exporting Transaction Data
1. Log in to Shopify Admin
2. Go to **Analytics** → **Reports** → **Orders**
3. Click **Export** and select:
   - Format: CSV for Excel
   - Date range: Review period
   - Include: "All order information"

#### Matching Process
1. Open exported orders CSV
2. Look for orders with:
   - Payment status: "Paid"
   - Fulfillment status: "Fulfilled" or "Shipped"
3. Match using "Created at" timestamp and "Total" amount
4. Account for tax in total amount comparison

#### Example Shopify CSV Columns:
```
Name, Email, Created at, Total, Subtotal, Taxes, Payment Status, Fulfillment Status
#1001, customer@email.com, 2024-12-01 14:28:30, 127.50, 125.00, 2.50, paid, fulfilled
```

### Zettle (PayPal)

#### Exporting Transaction Data
1. Log in to Zettle Dashboard
2. Go to **Reports** → **Sales**
3. Select date range for review period
4. Choose **Export to CSV**
5. Include all payment types (card, cash, etc.)

#### Matching Process
1. Use "Date & time" column for time matching
2. Use "Amount" column for amount matching
3. Filter out refunds and voids
4. Note: Zettle shows gross amounts before fees

#### Example Zettle CSV Columns:
```
Date & time, Amount, Currency, Fee, Payment method, Card type, Status, Receipt number
01/12/2024 14:28, 127.50, SEK, 2.15, Card, Visa, Completed, Z-12345
```

### Generic POS System

#### Required Transaction Data
Your POS system export should include:
- **Transaction timestamp** (date and time)
- **Total amount** (including tax)
- **Transaction ID** (for reference)
- **Payment method** (optional but helpful)

#### If Your POS Lacks CSV Export:
1. Check if system has reporting feature
2. Look for transaction history or daily sales report
3. Contact your POS provider for export options
4. As last resort, manually compile transaction list for review period

---

## Verification Spreadsheet Instructions

### Download and Setup
1. Log into your AI Feedback Platform dashboard
2. Go to "Monthly Verification Review"
3. Download the CSV file for the current review period
4. Open in Excel, Google Sheets, or similar spreadsheet software

### Required Columns to Complete
You need to fill out these columns for each row:

| Column | Description | Values |
|--------|-------------|---------|
| `Transaction Found (Y/N)` | Did you find a matching transaction? | Y or N |
| `Verified Amount (SEK)` | Actual transaction amount if found | Number (e.g., 127.00) |
| `Verified Time` | Actual transaction time if found | HH:MM format (e.g., 14:28) |
| `Notes` | Any additional comments | Text |
| `Approve (Y/N)` | Final approval decision | Y or N |

### Step-by-Step Process
For each row in the verification spreadsheet:

1. **Look up the transaction**
   - Check your POS data for transactions around the reported time (±2 minutes)
   - Look for amounts close to reported amount (±0.5 SEK)

2. **If transaction found:**
   - Enter "Y" in "Transaction Found"
   - Enter actual amount in "Verified Amount"
   - Enter actual time in "Verified Time"
   - Check if within tolerance:
     - Time within ±2 minutes → OK
     - Amount within ±0.5 SEK → OK
     - Both OK → Enter "Y" in Approve
     - Either fails → Enter "N" in Approve

3. **If no transaction found:**
   - Enter "N" in "Transaction Found"
   - Enter "N" in Approve
   - Add note explaining why (e.g., "No transaction found at reported time")

### Examples

#### Example 1: Valid Match
```
Customer Report: 14:30, 127.50 SEK, Phone: +46701234567
POS Transaction: 14:28, 127.00 SEK, Card payment
Result: Transaction Found = Y, Verified Amount = 127.00, Verified Time = 14:28, Approve = Y
Notes: "Perfect match within tolerance"
```

#### Example 2: Time Out of Tolerance
```
Customer Report: 14:30, 127.50 SEK
POS Transaction: 14:34, 127.50 SEK
Result: Transaction Found = Y, Verified Amount = 127.50, Verified Time = 14:34, Approve = N
Notes: "Time difference 4 minutes exceeds ±2 minute tolerance"
```

#### Example 3: Amount Out of Tolerance
```
Customer Report: 14:30, 127.50 SEK
POS Transaction: 14:29, 128.50 SEK
Result: Transaction Found = Y, Verified Amount = 128.50, Verified Time = 14:29, Approve = N
Notes: "Amount difference 1.00 SEK exceeds ±0.5 SEK tolerance"
```

#### Example 4: No Match Found
```
Customer Report: 14:30, 127.50 SEK
POS Records: No transactions between 14:28-14:32 for ~127 SEK
Result: Transaction Found = N, Approve = N
Notes: "No matching transaction found in POS records"
```

---

## Fraud Detection Tips

### Red Flags to Watch For
- **Round amounts**: Claims like 100.00, 200.00, 500.00 SEK (may indicate guessing)
- **Same phone number**: Multiple high-value claims from same phone number
- **Off-hours transactions**: Claims during closed hours
- **Duplicate amounts**: Multiple identical amounts from different customers
- **Perfect amounts**: Claims that match common price points exactly

### Suspicious Patterns
- Customer reports transaction during store closure
- Amount doesn't match any items in your typical price range
- Same customer phone number appears multiple times with high amounts
- Transaction time doesn't align with typical customer flow patterns

### When to Reject
- Time tolerance exceeded (±2 minutes)
- Amount tolerance exceeded (±0.5 SEK)
- No matching transaction found in your records
- Suspicious fraud indicators
- Customer provided incorrect store code

---

## Upload and Finalization

### Completing the Process
1. **Save your completed spreadsheet** as CSV format
2. **Log back into AI Feedback Platform dashboard**
3. **Go to "Monthly Verification Review"**
4. **Upload your completed CSV file**
5. **Review the summary** of approved/rejected verifications
6. **Confirm submission** before deadline (15th of month)

### What Happens Next
- **Approved verifications**: Customers receive cashback via Swish
- **Rejected verifications**: Customers receive explanation (optional)
- **Your invoice**: Generated for total approved amount + 20% platform commission
- **Payment due**: 30 days from invoice date
- **Feedback release**: Customer feedback becomes available in your dashboard

### If You Miss the Deadline
- All unreviewed verifications automatically approved
- You're billed for full amount (including potentially fraudulent claims)
- No manual review option until next month
- **Important**: Set calendar reminders for review deadlines!

---

## Support and Troubleshooting

### Common Issues

**Q: My POS doesn't export the right date format**
A: Convert dates to YYYY-MM-DD HH:MM format in your spreadsheet before matching

**Q: Transaction amounts include/exclude tax - which do I use?**  
A: Use the total amount charged to customer (including tax and fees)

**Q: Customer reported amount slightly off due to rounding**
A: If within ±0.5 SEK tolerance, approve. If outside tolerance, reject.

**Q: Multiple transactions match the reported time and amount**
A: Choose the transaction closest in time. Add note about which transaction ID you selected.

**Q: I can't find some transactions in my POS data**
A: Check if your export includes all payment methods (card, cash, mobile). Some POS systems separate different payment types.

### Contact Support
- **Email**: support@ai-feedback-platform.com
- **Dashboard Help**: Click "Help" button in verification review section
- **Phone**: Available during business hours for urgent deadline issues

---

## Quick Reference Checklist

### Monthly Review Checklist
- [ ] Download verification CSV from dashboard (by 2nd of month)
- [ ] Export transaction data from POS system for review period
- [ ] Match each verification against POS records
- [ ] Complete all required columns in verification spreadsheet
- [ ] Check for fraud indicators and suspicious patterns
- [ ] Upload completed CSV to dashboard
- [ ] Confirm submission before 15th of month deadline
- [ ] Set reminder for next month's review

### Tolerance Quick Reference
- ✅ **Time**: Within ±2 minutes = APPROVE
- ✅ **Amount**: Within ±0.5 SEK = APPROVE  
- ❌ **Time**: Outside ±2 minutes = REJECT
- ❌ **Amount**: Outside ±0.5 SEK = REJECT
- ❌ **No transaction found** = REJECT

### Emergency Contacts
- **Deadline Extension**: support@ai-feedback-platform.com
- **Technical Issues**: tech-support@ai-feedback-platform.com
- **Billing Questions**: billing@ai-feedback-platform.com

Remember: The goal is to verify legitimate customer feedback while preventing fraud. When in doubt, err on the side of caution and reject suspicious claims.