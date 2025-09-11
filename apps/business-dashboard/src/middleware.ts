import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require onboarding check
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/onboarding',
  '/api/business/onboarding',
  '/api/auth'
];

// Routes that should redirect to onboarding if not completed
const PROTECTED_ROUTES = [
  '/',
  '/feedback',
  '/verification',
  '/locations',
  '/users',
  '/templates',
  '/reports',
  '/trial'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes (except onboarding API)
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/') ||
    (pathname.startsWith('/api/') && !pathname.startsWith('/api/business/onboarding'))
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // For protected routes, check if user is authenticated
  const accessToken = request.cookies.get('ai-feedback-access-token');
  
  if (!accessToken && PROTECTED_ROUTES.includes(pathname)) {
    // Redirect unauthenticated users to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated but trying to access protected routes,
  // the component-level checks will handle onboarding redirect
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};