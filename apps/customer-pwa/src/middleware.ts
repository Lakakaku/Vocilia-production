import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const pathname = request.nextUrl.pathname;

  // Handle business subdomain routing
  if (host === 'business.vocilia.com') {
    // If already on a business route, allow it
    if (pathname.startsWith('/business/')) {
      return NextResponse.next();
    }
    
    // Otherwise redirect to business login
    const url = new URL('/business/login', request.url);
    return NextResponse.redirect(url);
  }

  // For main domain, continue normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};