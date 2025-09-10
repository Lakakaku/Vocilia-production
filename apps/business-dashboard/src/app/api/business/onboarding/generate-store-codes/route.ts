import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const GenerateCodesSchema = z.object({
  storeCount: z.number().min(1).max(100),
  storeNames: z.array(z.string()).optional()
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { storeCount, storeNames } = GenerateCodesSchema.parse(body);

    // Get business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, store_count')
      .eq('email', session.user.email)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Check if business already has store codes
    const { data: existingCodes, error: existingError } = await supabase
      .from('store_codes')
      .select('id, code, name')
      .eq('business_id', business.id);

    if (existingError) {
      console.error('Error checking existing codes:', existingError);
      return NextResponse.json({ error: 'Error checking existing codes' }, { status: 500 });
    }

    if (existingCodes && existingCodes.length >= storeCount) {
      return NextResponse.json({
        success: true,
        message: 'Store codes already exist',
        storeCodes: existingCodes
      });
    }

    // Generate new store codes
    const storeCodes = [];
    const existingCodeValues = new Set((existingCodes || []).map((c: any) => c.code));
    
    for (let i = 0; i < storeCount; i++) {
      let storeCode;
      let attempts = 0;
      
      // Generate unique store code
      do {
        storeCode = generateStoreCode();
        attempts++;
        
        if (attempts > 50) {
          throw new Error('Unable to generate unique store code');
        }
      } while (existingCodeValues.has(storeCode));
      
      existingCodeValues.add(storeCode);
      
      const storeName = storeNames && storeNames[i] 
        ? storeNames[i] 
        : storeCount === 1 
          ? 'Main Store'
          : `Store ${i + 1}`;

      storeCodes.push({
        business_id: business.id,
        code: storeCode,
        name: storeName,
        is_active: true,
        expires_at: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString() // 6 months
      });
    }

    // Insert store codes
    const { data: insertedCodes, error: insertError } = await supabase
      .from('store_codes')
      .insert(storeCodes)
      .select();

    if (insertError) {
      console.error('Error inserting store codes:', insertError);
      return NextResponse.json({ error: 'Error generating store codes' }, { status: 500 });
    }

    // Also create business locations for each store code
    const businessLocations = insertedCodes.map((code: any) => ({
      business_id: business.id,
      name: code.name,
      qr_code_url: `https://vocilia.com/feedback/${code.code}`,
      active: true
    }));

    const { error: locationError } = await supabase
      .from('business_locations')
      .insert(businessLocations);

    if (locationError) {
      console.error('Error creating business locations:', locationError);
      // Don't fail for this - locations can be created separately
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${insertedCodes.length} store codes`,
      storeCodes: insertedCodes
    });

  } catch (error) {
    console.error('Error in generate store codes API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateStoreCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Utility function to check if store code exists
async function storeCodeExists(code: string, supabase: any): Promise<boolean> {
  const { data, error } = await supabase
    .from('store_codes')
    .select('id')
    .eq('code', code)
    .limit(1);
    
  if (error) {
    console.error('Error checking store code existence:', error);
    return false;
  }
  
  return data && data.length > 0;
}