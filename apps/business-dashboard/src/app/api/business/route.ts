import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // This mock API route has been replaced by the real authentication system.
  // Business creation now happens during signup via the real backend API.
  
  return NextResponse.json({
    success: false,
    error: {
      code: 'DEPRECATED_ENDPOINT',
      message: 'This endpoint is deprecated. Please create your business account via the signup page.'
    }
  }, { status: 410 }); // 410 Gone
}