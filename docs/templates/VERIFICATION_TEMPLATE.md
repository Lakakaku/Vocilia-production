# Excel Verification Template Documentation

## Overview
This document describes the Excel verification template that stores receive monthly to verify customer feedback transactions.

## Template Structure

### Sheet 1: Customer Verifications
**Columns provided by platform:**
- A: `Verification ID` - Unique identifier
- B: `Customer Phone` - Masked for privacy (last 4 digits shown)
- C: `Reported Time` - When customer says they purchased
- D: `Reported Amount` - Amount customer claims they paid
- E: `Submitted At` - When feedback was submitted
- F: `Feedback Quality` - AI quality score (0-100)

**Columns for store to complete:**
- G: `Verification Status` - Dropdown: VERIFIED / REJECTED / UNCLEAR
- H: `Matching Transaction Time` - Actual POS transaction time
- I: `Matching Transaction Amount` - Actual POS transaction amount  
- J: `Payment Method` - How customer paid (Card/Cash/Mobile)
- K: `Notes` - Optional comments
- L: `Reviewer Name` - Staff member who verified

**Auto-calculated columns:**
- M: `Time Difference` - Minutes between reported and actual
- N: `Amount Difference` - SEK difference between reported and actual
- O: `Within Tolerance` - Auto YES/NO based on ±2min, ±0.5 SEK
- P: `Confidence Score` - Calculated verification confidence

### Sheet 2: Your POS Transactions
**For reference - paste your exported POS data:**
- A: `Transaction Time`
- B: `Transaction Amount`  
- C: `Payment Method`
- D: `Transaction ID`
- E: `Customer Info` (if available)

### Sheet 3: Verification Summary
**Auto-generated summary:**
- Total verifications received
- Verified count
- Rejected count  
- Unclear count
- Total customer payout
- Total store cost (payout + 20% commission)
- Estimated processing fee

## Excel Formulas Used

### Time Difference Calculation
```excel
=ABS((H2-C2)*24*60)
```
Calculates absolute difference in minutes between reported and actual transaction time.

### Amount Difference Calculation
```excel
=ABS(I2-D2)
```
Calculates absolute difference in SEK between reported and actual amounts.

### Tolerance Check
```excel
=IF(AND(M2<=2,N2<=0.5),"YES","NO")
```
Automatically checks if transaction falls within ±2 minutes and ±0.5 SEK tolerance.

### Confidence Score
```excel
=IF(O2="YES",
  100-((M2/2)*30)-((N2/0.5)*20),
  0
)
```
Calculates confidence score (0-100) based on how close the match is to perfect.

### Conditional Formatting Rules

1. **Time Difference (Column M):**
   - Green: ≤ 2 minutes
   - Yellow: 2-5 minutes  
   - Red: > 5 minutes

2. **Amount Difference (Column N):**
   - Green: ≤ 0.5 SEK
   - Yellow: 0.5-2 SEK
   - Red: > 2 SEK

3. **Within Tolerance (Column O):**
   - Green background: "YES"
   - Red background: "NO"

4. **Verification Status (Column G):**
   - Green: "VERIFIED"
   - Red: "REJECTED"
   - Orange: "UNCLEAR"

## Data Validation

### Dropdown Lists
- **Verification Status:** VERIFIED, REJECTED, UNCLEAR
- **Payment Method:** Card, Cash, Swish, Other

### Input Validation
- **Matching Transaction Time:** Must be valid date/time format
- **Matching Transaction Amount:** Must be positive number
- **Time entries:** Must be within reasonable business hours

## Usage Instructions

### 1. Import Your POS Data
1. Export transactions from your POS system for the verification period
2. Copy and paste the data into Sheet 2 ("Your POS Transactions")
3. Ensure time format matches Excel standards

### 2. Verify Each Entry
1. Start with Sheet 1 ("Customer Verifications")
2. For each row, look for matching transaction in Sheet 2
3. If found within tolerance:
   - Select "VERIFIED" from dropdown
   - Enter actual transaction time and amount
   - Note payment method
4. If no match found:
   - Select "REJECTED" from dropdown
   - Leave other fields blank or add notes

### 3. Review Auto-Calculations
1. Check the "Within Tolerance" column for automatic YES/NO
2. Review confidence scores (aim for >80 for VERIFIED entries)
3. Use conditional formatting colors as guidance

### 4. Final Review
1. Check Sheet 3 ("Verification Summary") for totals
2. Ensure all entries have a verification status
3. Review any "UNCLEAR" entries more carefully
4. Add reviewer names for audit trail

### 5. Submit Results
1. Save the completed Excel file
2. Upload to the business dashboard
3. Or email to verification@ai-feedback-platform.se

## Tips for Efficient Verification

### Use Excel Features
- **Filter:** Filter POS data by time range around customer reports
- **Sort:** Sort both sheets by time for easier matching
- **Find:** Use Ctrl+F to search for specific amounts
- **Multiple Windows:** Open two Excel windows to view both sheets

### Common Matching Scenarios
- **Exact Match:** Same time and amount = High confidence
- **Close Match:** Within tolerance = Verify with notes
- **Multiple Candidates:** If several transactions could match, pick closest
- **No Match:** Check for data entry errors first, then reject

### Quality Checks
- Look for patterns (multiple entries from same phone)
- Verify high-value transactions extra carefully  
- Check that business hours align with reported times
- Ensure payment methods make sense for your store

## Troubleshooting

### Formula Errors
- **#VALUE!:** Check date/time formats are consistent
- **#REF!:** Don't delete any columns, only add data
- **#DIV/0!:** Ensure no empty cells in amount columns

### Data Issues
- **Wrong time format:** Use YYYY-MM-DD HH:MM:SS format
- **Decimal separator:** Use comma (,) for Swedish Excel, period (.) for US
- **Currency format:** Enter amounts as numbers, not text

### Common Questions
- **Q: Can I add extra columns?** A: Yes, but don't delete existing ones
- **Q: What if my POS uses different time zones?** A: Convert to local time
- **Q: Should I round amounts?** A: No, use exact amounts from POS

## File Naming Convention
When saving your completed verification:
`Verification_[BusinessName]_[YYYY-MM]_[SubmissionDate].xlsx`

Example: `Verification_CafeStockholm_2024-12_2024-12-15.xlsx`

---

*This template streamlines the verification process and ensures accurate, auditable results.*