# Create Test Business Account - FREE

## 🎯 **Overview**
This guide shows you how to create a **FREE fake business account** for testing the AI Feedback Platform without any real business commitments, costs, or setup requirements.

---

## 🚀 **Quick Start (2 minutes)**

### **Step 1: Create Your Test Business**
```bash
npm run create-test-business
```

This will create:
- ✅ Fake Swedish business account ("Test Café Stockholm")
- ✅ Business location with address
- ✅ 5 QR codes for testing
- ✅ 5 sample feedback sessions with realistic data
- ✅ 30 free trial feedbacks remaining

### **Step 2: Access Your Business Dashboard**
1. **URL:** http://localhost:3001
2. **Login with:** The business ID printed in the terminal
3. **Or use email:** test@testcafe.se

### **Step 3: Test Customer Feedback Flow**
1. **URL:** http://localhost:3010
2. **Use QR token:** Printed in terminal output
3. **Test transaction:** Use the transaction ID from terminal

---

## 🏪 **What You Get (Completely Free)**

### **Fake Swedish Business Profile:**
- **Business Name:** Test Café Stockholm
- **Organization Number:** 559999-0001 (fake but valid format)
- **Email:** test@testcafe.se
- **Phone:** +46701234567
- **Address:** Testgatan 123, Stockholm
- **Tier:** Small (20% commission rate)
- **Trial:** 30 free feedback sessions

### **Sample Data Included:**
- **5 QR Codes** for testing customer scans
- **5 Feedback Sessions** with realistic Swedish customer feedback
- **Quality Scores** ranging from 78-95 (demonstrating the scoring system)
- **Categories** including service, product, atmosphere
- **Reward Calculations** showing actual cashback amounts

### **Full Platform Access:**
- ✅ Real-time analytics dashboard
- ✅ AI-generated business insights  
- ✅ Staff performance tracking
- ✅ ROI calculator and reporting
- ✅ Export functionality (CSV, PDF, Excel)
- ✅ Fraud detection monitoring

---

## 🎮 **Testing Scenarios You Can Try**

### **1. Business Owner Experience**
- View analytics dashboard with 5 completed feedback sessions
- See categorized feedback (Service: 4 mentions, Product: 5 mentions)
- Review AI-generated insights and recommendations
- Check staff performance (mentions of "Anna" in feedback)
- Export data to Excel/CSV for analysis

### **2. Customer Feedback Journey**
- Scan QR code (use the QR token from terminal output)
- Verify fake transaction (use provided transaction ID)
- Complete voice feedback conversation with AI
- Receive quality score and cashback reward calculation
- See instant payout simulation

### **3. Admin Monitoring**
- Monitor system performance and uptime
- View fraud detection in action
- See real-time session processing
- Review security and compliance status

---

## 🔧 **Customization Options**

### **Create Multiple Test Businesses**
Run the script multiple times to create different business types:
```bash
# Edit scripts/create-test-business.ts before running
npm run create-test-business
```

### **Customize Your Test Business**
Edit `scripts/create-test-business.ts` to change:
- Business name and contact details
- Business type (café, restaurant, retail)
- Location and address
- Sample feedback content
- Quality scores and rewards

### **Add More Sample Data**
Modify the script to generate:
- More feedback sessions
- Different customer scenarios  
- Various quality score ranges
- Different business contexts

---

## 📊 **Sample Business Data**

### **Generated Feedback Examples:**
1. **Score 85:** "Excellent coffee and friendly staff. Love the atmosphere!"
2. **Score 92:** "Amazing latte art and the pastries are fresh. Anna was very helpful."
3. **Score 78:** "Good coffee but seating is limited during lunch hours."
4. **Score 88:** "Great place for meetings. WiFi is fast and coffee is consistently good."
5. **Score 95:** "Best oat milk cappuccino in Stockholm! Clean and modern interior."

### **Calculated Rewards:**
- Based on 250 SEK average purchase
- Rewards range from 23-29 SEK (9-12% cashback)
- Platform commission: 20% of rewards
- Net business benefit simulation included

---

## 🎯 **What This Demonstrates**

### **For Business Owners:**
- How the analytics dashboard provides actionable insights
- Quality-based reward system in action
- Staff performance tracking with customer mentions
- Category analysis for operational improvements

### **For Customers:**
- Simple 3-minute feedback process
- Quality scoring with transparent criteria
- Instant reward calculation and payment
- Natural AI conversation experience

### **For Technical Users:**
- Database structure and relationships
- API endpoints and data flow
- Security and fraud detection systems
- Integration capabilities

---

## 🔄 **Resetting Test Data**

### **Clean Slate (Start Over):**
1. Delete the test business from database
2. Run the script again for fresh data
3. Or modify the script to create different scenarios

### **Add More Test Data:**
```bash
# Run multiple times with different business names
npm run create-test-business
```

---

## 🆓 **Why This is Completely Free**

### **No Real Business Required:**
- Fake Swedish organization number
- Test email and phone numbers
- Simulated payment processing
- Demo-only data (no real customers)

### **No Platform Costs:**
- No setup fees
- No monthly charges  
- No commission on fake transactions
- Uses test/demo infrastructure

### **No Commitments:**
- Delete anytime
- No contracts or agreements
- Pure testing and demonstration
- Educational purposes only

---

## 🎬 **Demo Flow with Test Business**

### **Perfect for Sales Demonstrations:**
1. Show prospects the business dashboard with realistic data
2. Walk through customer journey with test QR codes
3. Demonstrate AI scoring with sample feedback
4. Calculate real ROI using business-specific numbers
5. Show fraud protection and security features

### **Great for Development Testing:**
1. Test new features with realistic business data
2. Validate database relationships and queries
3. Performance test with multiple feedback sessions
4. UI/UX testing with Swedish business context
5. Integration testing with POS and payment systems

---

## 📞 **Support**

If you have issues creating your test business account:
1. Check that the development server is running (`npm run dev`)
2. Verify database connection (Supabase)
3. Ensure environment variables are set
4. Check terminal output for specific error messages

**This test business account gives you full access to explore the AI Feedback Platform capabilities without any cost, commitment, or real business requirements!**

---

## 🎉 **Ready to Try?**

```bash
# Create your free test business account now:
npm run create-test-business

# Then access your dashboard at:
# http://localhost:3001
```

**Experience the complete AI Feedback Platform with realistic Swedish business data - completely free!**