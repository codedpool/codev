// Next.js 16 proxy (formerly middleware): Clerk session handling + route protection.
import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Everything except the landing page, auth pages, health, and API docs requires a signed-in user.
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)', '/api/health', '/docs', '/openapi.json']);
const isApiRoute = createRouteMatcher(['/api(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  const { userId, redirectToSignIn } = await auth();
  if (userId) return;
  // API callers get a JSON 401 (no HTML redirects into fetch/axios); pages go to sign-in.
  if (isApiRoute(req)) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  return redirectToSignIn({ returnBackUrl: req.url });
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
