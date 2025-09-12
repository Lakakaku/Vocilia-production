import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BusinessContextData, ContextValidationResult } from '../../../../business-types/context';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Temporarily disabled authentication for testing
// interface AuthenticatedUser {
//   id: string;
//   email: string;
//   business: {
//     id: string;
//     name: string;
//   };
// }

// async function authenticateUser(request: NextRequest): Promise<AuthenticatedUser | null> {
//   try {
//     const authHeader = request.headers.get('Authorization');
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return null;
//     }

//     const token = authHeader.replace('Bearer ', '');
    
//     // Verify token with backend API
//     const authResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Content-Type': 'application/json',
//       },
//     });

//     if (!authResponse.ok) {
//       return null;
//     }

//     const authData = await authResponse.json();
//     if (!authData.success) {
//       return null;
//     }

//     return authData.data.user;
//   } catch (error) {
//     console.error('Authentication error:', error);
//     return null;
//   }
// }

function validateContextData(contextData: Partial<BusinessContextData>): ContextValidationResult {
  const missingFields: string[] = [];
  const suggestions: string[] = [];
  let completionScore = 0;
  let totalChecks = 0;

  // Validate layout
  if (!contextData.layout) {
    missingFields.push('layout');
  } else {
    totalChecks += 3;
    if (!contextData.layout.departments || contextData.layout.departments.length === 0) {
      missingFields.push('layout.departments');
      suggestions.push('Lägg till åtminstone en avdelning för bättre AI-analys');
    } else {
      completionScore++;
    }

    if (!contextData.layout.checkouts || contextData.layout.checkouts < 1) {
      missingFields.push('layout.checkouts');
      suggestions.push('Ange antal kassor');
    } else {
      completionScore++;
    }

    if (!contextData.layout.specialAreas || contextData.layout.specialAreas.length === 0) {
      suggestions.push('Överväg att lägga till specialområden om tillämpligt');
    } else {
      completionScore++;
    }
  }

  // Validate staff
  if (!contextData.staff || !contextData.staff.employees || contextData.staff.employees.length === 0) {
    totalChecks++;
    missingFields.push('staff.employees');
    suggestions.push('Lägg till personalnamn för bättre verifiering av autentisk feedback');
  } else {
    totalChecks++;
    completionScore++;
  }

  // Validate products
  if (!contextData.products) {
    missingFields.push('products');
  } else {
    totalChecks += 2;
    if (!contextData.products.categories || contextData.products.categories.length === 0) {
      missingFields.push('products.categories');
      suggestions.push('Lägg till produktkategorier för bättre feedback-kategorisering');
    } else {
      completionScore++;
    }

    if (!contextData.products.popularItems || contextData.products.popularItems.length === 0) {
      suggestions.push('Lägg till populära produkter för bättre feedback-relevans');
    } else {
      completionScore++;
    }
  }

  // Validate operations
  if (!contextData.operations) {
    missingFields.push('operations');
  } else {
    totalChecks += 2;
    const hasValidHours = contextData.operations.hours && 
      Object.values(contextData.operations.hours).some(hours => hours.open || hours.close);
    
    if (!hasValidHours) {
      missingFields.push('operations.hours');
      suggestions.push('Ange öppettider för tidsmässig validering av feedback');
    } else {
      completionScore++;
    }

    if (!contextData.operations.peakTimes || contextData.operations.peakTimes.length === 0) {
      suggestions.push('Lägg till information om topptider för bättre kontext');
    } else {
      completionScore++;
    }
  }

  const finalScore = totalChecks > 0 ? Math.round((completionScore / totalChecks) * 100) : 0;

  return {
    isValid: missingFields.length === 0,
    completionScore: finalScore,
    missingFields,
    suggestions
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get business_id from query params (required for now)
    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get('business_id');
    
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'business_id parameter is required' },
        { status: 400 }
      );
    }

    // Fetch business context data from Supabase
    const { data: business, error } = await supabase
      .from('businesses')
      .select('id, name, context_data, updated_at')
      .eq('id', businessId)
      .single();

    if (error) {
      console.error('Error fetching business context:', error);
      if (error.code === 'PGRST116') {
        // Business not found
        return NextResponse.json(
          { success: false, error: 'Business not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to fetch context data' },
        { status: 500 }
      );
    }

    // Return the context data, or empty structure if none exists
    const contextData = business?.context_data || {
      layout: {
        departments: [],
        checkouts: 1,
        selfCheckout: false,
        specialAreas: []
      },
      staff: { employees: [] },
      products: { categories: [], seasonal: [], notOffered: [], popularItems: [] },
      operations: {
        hours: {
          monday: { open: '', close: '', closed: false },
          tuesday: { open: '', close: '', closed: false },
          wednesday: { open: '', close: '', closed: false },
          thursday: { open: '', close: '', closed: false },
          friday: { open: '', close: '', closed: false },
          saturday: { open: '', close: '', closed: false },
          sunday: { open: '', close: '', closed: true }
        },
        peakTimes: [],
        challenges: [],
        improvements: [],
        commonProcedures: []
      },
      customerPatterns: {
        commonQuestions: [],
        frequentComplaints: [],
        seasonalPatterns: [],
        positivePatterns: [],
        customerDemographics: []
      }
    };

    return NextResponse.json({
      success: true,
      data: contextData,
      businessName: business?.name,
      lastUpdated: business?.updated_at
    });

  } catch (error) {
    console.error('Context GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get business_id from query params (required for now)
    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get('business_id');
    
    // TODO: Re-enable authentication once Railway API is stable
    // if (!businessId) {
    //   const user = await authenticateUser(request);
    //   if (!user) {
    //     return NextResponse.json(
    //       { success: false, error: 'Unauthorized' },
    //       { status: 401 }
    //     );
    //   }
    //   businessId = user.business.id;
    // }
    
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'business_id parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { contextData, incrementalUpdate = false } = body;

    if (!contextData) {
      return NextResponse.json(
        { success: false, error: 'Context data is required' },
        { status: 400 }
      );
    }

    let finalContextData = contextData;

    // If incremental update, merge with existing data
    if (incrementalUpdate) {
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('context_data')
        .eq('id', businessId)
        .single();

      if (existingBusiness?.context_data) {
        finalContextData = {
          ...existingBusiness.context_data,
          ...contextData,
          lastUpdated: new Date().toISOString(),
          version: (existingBusiness.context_data.version || 0) + 1
        };
      }
    } else {
      // Full update
      finalContextData = {
        ...contextData,
        lastUpdated: new Date().toISOString(),
        version: (contextData.version || 0) + 1
      };
    }

    // Validate the context data
    const validationResult = validateContextData(finalContextData);

    // Update context data in Supabase
    const { error } = await supabase
      .from('businesses')
      .update({ 
        context_data: finalContextData,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);

    if (error) {
      console.error('Database update error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save context data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: finalContextData,
      validationResult,
      message: 'Context data saved successfully'
    });

  } catch (error) {
    console.error('Context PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get business_id from query params (required for now)
    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get('business_id');
    
    // TODO: Re-enable authentication once Railway API is stable
    // if (!businessId) {
    //   const user = await authenticateUser(request);
    //   if (!user) {
    //     return NextResponse.json(
    //       { success: false, error: 'Unauthorized' },
    //       { status: 401 }
    //     );
    //   }
    //   businessId = user.business.id;
    // }
    
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'business_id parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'validate':
        const validationResult = validateContextData(data);
        return NextResponse.json({
          success: true,
          validationResult
        });

      case 'import':
        // Handle context data import
        const { contextData, overwriteExisting = false, selectedCategories = [] } = data;
        
        if (!contextData) {
          return NextResponse.json(
            { success: false, error: 'Context data is required for import' },
            { status: 400 }
          );
        }

        let importData = contextData;

        if (!overwriteExisting) {
          // Get existing data and merge
          const { data: existingBusiness } = await supabase
            .from('businesses')
            .select('context_data')
            .eq('id', businessId)
            .single();

          if (existingBusiness?.context_data) {
            importData = { ...existingBusiness.context_data };
            
            // Only import selected categories
            selectedCategories.forEach((category: string) => {
              if (contextData[category]) {
                importData[category] = contextData[category];
              }
            });
          }
        }

        // Add metadata
        importData.lastUpdated = new Date().toISOString();
        importData.version = (importData.version || 0) + 1;

        // Save imported data
        const { error: importError } = await supabase
          .from('businesses')
          .update({ 
            context_data: importData,
            updated_at: new Date().toISOString()
          })
          .eq('id', businessId);

        if (importError) {
          console.error('Import error:', importError);
          return NextResponse.json(
            { success: false, error: 'Failed to import context data' },
            { status: 500 }
          );
        }

        const importValidationResult = validateContextData(importData);

        return NextResponse.json({
          success: true,
          data: importData,
          validationResult: importValidationResult,
          message: 'Context data imported successfully'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Context POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}