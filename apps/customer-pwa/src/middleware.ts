import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const pathname = request.nextUrl.pathname;

  // Handle business subdomain routing
  if (host === 'business.vocilia.com') {
    // Redirect to main domain with business route
    const url = new URL('/business/login', 'https://vocilia.com');
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