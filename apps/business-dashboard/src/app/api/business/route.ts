import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Simulate API processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock business creation with store code generation for simple verification
    const businessId = `bus_${Date.now()}`;
    const storeCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    
    // Simulate different responses based on verification method
    if (data.verificationMethod === 'simple_verification') {
      // Simple verification - no Stripe account needed
      return NextResponse.json({
        success: true,
        data: {
          business: {
            id: businessId,
            name: data.name,
            email: data.email,
            orgNumber: data.orgNumber,
            verificationMethod: 'simple_verification',
            storeCode: storeCode,
            status: 'active'
          },
          storeCode: storeCode,
          message: `Business created successfully! Your store verification code is: ${storeCode}`
        }
      }, { status: 201 });
    } else {
      // POS integration - simulate Stripe Connect setup
      const stripeAccountId = `acct_${Date.now()}`;
      const onboardingUrl = `https://connect.stripe.com/setup/s/${stripeAccountId}`;
      
      return NextResponse.json({
        success: true,
        data: {
          business: {
            id: businessId,
            name: data.name,
            email: data.email,
            orgNumber: data.orgNumber,
            verificationMethod: 'pos_integration',
            stripeAccountId: stripeAccountId,
            status: 'pending_stripe_onboarding'
          },
          stripeAccountId: stripeAccountId,
          onboardingUrl: onboardingUrl,
          message: 'Business created! Please complete Stripe Connect setup to enable payments.'
        }
      }, { status: 201 });
    }
    
  } catch (error) {
    console.error('Error creating business:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create business. Please try again.'
    }, { status: 500 });
  }
}