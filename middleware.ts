import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// TEMPORARY: Bypass SSO if BYPASS_SSO env var is set to 'true'
// Remove this bypass once Google Workspace SSO is configured
const BYPASS_SSO = process.env.BYPASS_SSO === 'true'

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname
    
    // If bypass is enabled, allow all requests
    if (BYPASS_SSO) {
      return NextResponse.next()
    }
    
    // Always allow sign-in page and API auth routes
    if (pathname === '/auth/signin' || pathname.startsWith('/api/auth/')) {
      return NextResponse.next()
    }
    
    // Otherwise, use normal authentication
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        
        // If bypass is enabled, always authorize
        if (BYPASS_SSO) {
          return true
        }
        
        // Always allow sign-in page and API routes (including auth API)
        if (pathname === '/auth/signin' || pathname.startsWith('/api/')) {
          return true
        }
        
        // Otherwise, require valid token
        return !!token
      },
    },
    // Note: pages.signIn is configured in lib/auth.ts, don't duplicate here
  }
)

// Protect all routes except auth pages and api/auth
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth routes)
     * - auth/signin (sign-in page - must be accessible)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!api/auth|auth/signin|_next/static|_next/image|favicon.ico).*)',
  ],
}

