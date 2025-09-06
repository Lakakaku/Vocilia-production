# POS Verification Guide for Simple Customer Feedback System

## Overview

This guide helps store staff verify customer transactions for the simple verification feedback system. Customers provide three pieces of information that you need to verify:

- **Purchase Time** (within ±2 minutes of actual transaction)
- **Purchase Amount** (within ±0.5 SEK of actual transaction)  
- **Customer Phone Number** (for payment via Swish)

## Verification Tolerance

- **Time Tolerance:** ±2 minutes from reported time
- **Amount Tolerance:** ±0.5 SEK from reported amount
- **Phone Number:** Must be valid Swedish mobile number

## Square POS Verification

### Step 1: Access Transaction History
1. Log into your Square Dashboard at `squareup.com`
2. Navigate to **Transactions** in the left sidebar
3. Click on **All Transactions**

### Step 2: Filter Transactions
1. Set date range to the verification period (usually previous month)
2. Filter by **Location** if you have multiple stores
3. Filter by **Payment Method** to exclude refunds/voids

### Step 3: Verify Each Customer Entry
1. Download our verification CSV from the monthly email
2. For each customer entry:
   - Find transactions within ±2 minutes of reported time
   - Check if any transaction amount is within ±0.5 SEK
   - Mark as **VERIFIED** if match found
   - Mark as **REJECTED** if no match found

### Step 4: Export for Records
1. Click **Export** to download Square transaction report
2. Save both files for your records

---

## Shopify POS Verification

### Step 1: Access Order History
1. Log into your Shopify Admin at `[yourstore].myshopify.com/admin`
2. Go to **Orders** section
3. Filter by **POS** location

### Step 2: Set Date Range
1. Use the date picker to select verification period
2. Apply filters for **Paid orders only**
3. Sort by **Order date** (newest first)

### Step 3: Verify Customer Entries
1. Open our verification CSV
2. For each reported transaction:
   - Check order time against customer reported time (±2 min)
   - Compare order total against reported amount (±0.5 SEK)
   - Note: Include tax in your comparison
   - Mark verification status in CSV

### Step 4: Documentation
1. Export filtered orders: **More actions → Export orders**
2. Keep export file with verification CSV

---

## Zettle (PayPal) Verification

### Step 1: Open Zettle Go App
1. Open Zettle Go app on your tablet/phone
2. Tap on **Sales** at the bottom
3. Select **Sales history**

### Step 2: Filter by Date
1. Tap the **Calendar** icon
2. Select verification period dates
3. Apply **Location filter** if needed

### Step 3: Manual Verification
1. Go through each customer entry in our CSV
2. Scroll through Zettle transactions for matching:
   - Time window: ±2 minutes
   - Amount window: ±0.5 SEK
3. Mark **VERIFIED** or **REJECTED** in CSV

### Step 4: Export Data (Optional)
1. Email yourself the sales report
2. Use for additional verification if needed

---

## Generic/Traditional Cash Register Verification

### Step 1: Gather Daily Reports
1. Print **Z-reports** (end-of-day summaries) for verification period
2. Collect receipt copies if available
3. Review cash register journal tapes

### Step 2: Manual Cross-Reference
1. For each customer entry in verification CSV:
   - Find register transactions around reported time (±2 min)
   - Look for matching amounts (±0.5 SEK)
   - Check multiple payment methods (cash, card, mobile pay)

### Step 3: Documentation
1. Note verification method used
2. Keep copies of supporting documents
3. Mark each entry as verified or rejected

---

## Verification Best Practices

### ✅ DO Verify
- Transactions within time/amount tolerance
- Different payment methods for same amount
- Round numbers that might include/exclude tax
- Transactions just before/after business hours

### ❌ DO Reject
- No matching transaction found
- Time difference > 2 minutes
- Amount difference > 0.5 SEK  
- Duplicate phone numbers (same day)
- Transactions outside business hours
- Suspicious patterns (too many from same phone)

### 🔍 Red Flags to Watch For
- Multiple verifications from same phone number
- Perfect round numbers (might be fake)
- Transactions at exactly opening/closing time
- Very high amounts compared to typical sales
- Phone numbers that don't match area demographics

---

## Verification Process Checklist

### Before Starting (Monthly - 1st of each month)
- [ ] Receive verification CSV from AI Feedback Platform
- [ ] Access your POS system transaction history
- [ ] Set date range to previous month
- [ ] Prepare workspace with both systems open

### During Verification (Within 14 days)
- [ ] Review each customer entry systematically
- [ ] Apply ±2 minute time tolerance
- [ ] Apply ±0.5 SEK amount tolerance
- [ ] Mark each entry as VERIFIED or REJECTED
- [ ] Add notes for borderline cases
- [ ] Double-check high-value transactions

### After Verification (Before deadline)
- [ ] Review rejected entries once more
- [ ] Export supporting documentation
- [ ] Upload completed CSV to dashboard
- [ ] Confirm submission receipt
- [ ] File documents for records

---

## FAQ

### Q: What if a transaction is exactly 2.5 minutes outside the window?
A: **Reject it.** The tolerance is strict to prevent fraud.

### Q: Should I include tax in amount comparison?
A: **Yes.** Compare the total amount the customer paid including all taxes and fees.

### Q: What if I find multiple transactions that could match?
A: **Verify it.** If any transaction within the time/amount window matches, mark as verified.

### Q: Customer says they paid cash but I only see card transactions?
A: **Check carefully.** Verify all payment methods. If no match found, reject.

### Q: What happens if I miss the 14-day deadline?
A: **Automatic billing.** You'll be charged for all entries (including potentially fake ones). Always submit on time.

### Q: Can I verify transactions after the deadline?
A: **No.** Once the deadline passes, the system processes payments automatically.

---

## Support Contact

If you need help with verification:
- **Email:** support@ai-feedback-platform.se
- **Phone:** +46 8 XXX XXX XX  
- **Dashboard:** business.ai-feedback-platform.se

**Remember: When in doubt, verify. It's better to approve a legitimate customer than reject them.**

---

*Last updated: December 2024*