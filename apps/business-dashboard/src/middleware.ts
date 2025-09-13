import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/supabase-js';

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Create a NextResponse so we can modify cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  
  // Skip middleware for static files and API routes (except onboarding API)
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/') ||
    (pathname.startsWith('/api/') && !pathname.startsWith('/api/business/onboarding'))
  ) {
    return response;
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return response;
  }

  // Create Supabase client to check session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ybrbeejvjbccqmewczte.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmJlZWp2amJjY3FtZXdjenRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODk1NjYsImV4cCI6MjA3Mjc2NTU2Nn0.HYaafhJJwhOJxJ38xQTQzRfZNiJaJUNjrqO9LnGVUFA',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options?: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );
  
  // Check if we have a session
  const { data: { session } } = await supabase.auth.getSession();
  
  // For protected routes, check if user is authenticated
  if (!session && PROTECTED_ROUTES.includes(pathname)) {
    // Redirect unauthenticated users to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated but trying to access protected routes,
  // the component-level checks will handle onboarding redirect
  return response;
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