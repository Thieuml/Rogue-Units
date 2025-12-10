# WeMaintain Domain & SSO Setup Summary - AI Diagnostics

This document summarizes the setup process for deploying the **AI Diagnostics (Lift Diagnostic Analysis)** application to the `wemaintain.com` domain and configuring Google Workspace SSO authentication.

## Summary of What Was Done

### 1. Domain Configuration (wemaintain.com)

The application was deployed to Vercel and configured to use the custom domain `ai-diagnostics.wemaintain.com`:

- **Production URL**: `https://ai-diagnostics.wemaintain.com`
- **Current Production**: `https://rogue-units.vercel.app` (will migrate to custom domain)
- **Deployment Platform**: Vercel (already configured)
- **Region**: Auto (Vercel Edge Network) - can be configured if needed
- **Framework**: Next.js (auto-detected by Vercel)
- **Local Port**: 3002

**Domain Setup Steps:**
1. Application already deployed to Vercel at `https://rogue-units.vercel.app`
2. Add custom domain `ai-diagnostics.wemaintain.com` in Vercel project settings
3. Configure DNS records (CNAME) to point to Vercel (DNS admin access required)
4. SSL certificate automatically provisioned by Vercel (HTTPS required for SSO)

### 2. Google Workspace SSO Setup

Single Sign-On (SSO) will be configured using NextAuth.js with Google OAuth provider:

**Key Components:**
- **Authentication Library**: NextAuth.js v5 (App Router compatible)
- **Provider**: Google OAuth 2.0
- **Session Strategy**: JWT-based sessions (no database required)
- **Domain Restriction**: Limited to `wemaintain.com` Google Workspace domain

**Implementation Required:**
- Install NextAuth.js and dependencies
- Create NextAuth.js configuration in `lib/auth.ts`
- Add API route handler at `app/api/auth/[...nextauth]/route.ts`
- Add middleware protection (`middleware.ts`) for route authentication
- Optional: Custom sign-in page at `/auth/signin`
- Sessions stored as secure HTTP-only cookies (7-day expiration default)

**No Database Required:**
- Using JWT strategy for simplicity (no Prisma needed)
- Session data stored in encrypted JWT tokens
- Reduces infrastructure complexity

## Complete Environment Variables Setup

### For Local Development (.env.local)

Create a `.env.local` file in the project root with the following variables:

```bash
# ============================================
# NEXT-AUTH CONFIGURATION (SSO)
# ============================================
# IMPORTANT: Use http://localhost:3002 for local development (AI Diagnostics runs on port 3002)
NEXTAUTH_URL=http://localhost:3002
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-generated-secret-key-here

# ============================================
# GOOGLE OAUTH CREDENTIALS
# ============================================
# Get these from Google Cloud Console → APIs & Services → Credentials
# Create a NEW OAuth client for AI Diagnostics project (separate from MTR Maintenance)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Restrict to WeMaintain Google Workspace domain
GOOGLE_WORKSPACE_DOMAIN=wemaintain.com

# ============================================
# LOOKER API CONFIGURATION
# ============================================
LOOKER_API_BASE_URL=https://wemaintain.cloud.looker.com
LOOKER_CLIENT_ID=your_client_id_here
LOOKER_CLIENT_SECRET=your_client_secret_here

# ============================================
# LOOKER LOOK IDs - DATA SOURCES
# ============================================
# Buildings and Devices (single Look containing both)
LOOKER_BUILDINGS_LOOK_ID=161

# Visit Reports
LOOKER_VISITS_LOOK_ID=162

# Breakdowns/Downtimes
LOOKER_BREAKDOWNS_LOOK_ID=163

# Maintenance Issues/Anomalies
LOOKER_MAINTENANCE_ISSUES_LOOK_ID=164

# Repair Requests (Parts)
LOOKER_REPAIR_REQUESTS_LOOK_ID=166

# ============================================
# OPENAI CONFIGURATION
# ============================================
OPENAI_API_KEY=your_openai_api_key_here
# Optional: specify model (defaults to gpt-4-turbo-preview)
# OPENAI_MODEL=gpt-4-turbo-preview

# ============================================
# OPTIONAL - PDF STORAGE
# ============================================
# Enable 30-day PDF storage (default: false)
# ENABLE_STORAGE=true
```

### For Production (Vercel Environment Variables)

Set these in **Vercel Dashboard** → **Project Settings** → **Environment Variables**:

**Production Environment Variables:**

```bash
# ============================================
# NEXT-AUTH CONFIGURATION (SSO)
# ============================================
# IMPORTANT: Use https://ai-diagnostics.wemaintain.com for production
NEXTAUTH_URL=https://ai-diagnostics.wemaintain.com
# Generate with: openssl rand -base64 32 (use a different secret than local)
NEXTAUTH_SECRET=your-production-secret-key-here

# ============================================
# GOOGLE OAUTH CREDENTIALS
# ============================================
# Same credentials as local (or separate production credentials)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Restrict to WeMaintain Google Workspace domain
GOOGLE_WORKSPACE_DOMAIN=wemaintain.com

# ============================================
# LOOKER API CONFIGURATION
# ============================================
LOOKER_API_BASE_URL=https://wemaintain.cloud.looker.com
LOOKER_CLIENT_ID=your_client_id_here
LOOKER_CLIENT_SECRET=your_client_secret_here

# ============================================
# LOOKER LOOK IDs - DATA SOURCES
# ============================================
LOOKER_BUILDINGS_LOOK_ID=161
LOOKER_VISITS_LOOK_ID=162
LOOKER_BREAKDOWNS_LOOK_ID=163
LOOKER_MAINTENANCE_ISSUES_LOOK_ID=164
LOOKER_REPAIR_REQUESTS_LOOK_ID=166

# ============================================
# OPENAI CONFIGURATION
# ============================================
OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_MODEL=gpt-4-turbo-preview

# ============================================
# OPTIONAL - PDF STORAGE
# ============================================
# ENABLE_STORAGE=true
```

## Google Cloud Console Configuration

### OAuth Client Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create or Select Project**: Create a NEW project for AI Diagnostics (separate from MTR Maintenance)
   - Project name suggestion: `AI Diagnostics - WeMaintain`
3. **Configure OAuth Consent Screen**:
   - Type: **Internal** (for Google Workspace users only)
   - App name: `AI Diagnostics - Lift Analysis`
   - User support email: Your WeMaintain email
   - Developer contact: Your WeMaintain email
   - Scopes: Default (email, profile, openid)

4. **Create OAuth Client ID**:
   - Application type: **Web application**
   - Name: `AI Diagnostics Web Client`
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3002
     https://ai-diagnostics.wemaintain.com
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:3002/api/auth/callback/google
     https://ai-diagnostics.wemaintain.com/api/auth/callback/google
     ```

5. **Copy Credentials**:
   - Client ID (ends with `.apps.googleusercontent.com`)
   - Client Secret

## Implementation Steps

### Step 1: Install NextAuth.js Dependencies

```bash
npm install next-auth@latest
```

### Step 2: Create NextAuth Configuration

Create `lib/auth.ts`:

```typescript
import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Restrict to WeMaintain domain
      const allowedDomain = process.env.GOOGLE_WORKSPACE_DOMAIN || "wemaintain.com"
      
      if (user.email && user.email.endsWith(`@${allowedDomain}`)) {
        return true
      }
      
      return false // Deny access for non-WeMaintain emails
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin', // Optional: custom sign-in page
  },
}

export default NextAuth(authOptions)
```

### Step 3: Create API Route Handler

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

### Step 4: Add Middleware for Route Protection

Create `middleware.ts` in the project root:

```typescript
import { withAuth } from "next-auth/middleware"

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

// Protect all routes except auth pages and api/auth
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### Step 5: Optional - Create Custom Sign-In Page

Create `app/auth/signin/page.tsx`:

```typescript
'use client'

import { signIn } from "next-auth/react"
import { WeMaintainLogo } from "@/components/WeMaintainLogo"

export default function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-center mb-6">
          <WeMaintainLogo />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-2">AI Diagnostics</h1>
        <p className="text-gray-600 text-center mb-6">
          Lift Diagnostic Analysis System
        </p>
        
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
            <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
            <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
            <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          Only @wemaintain.com accounts
        </p>
      </div>
    </div>
  )
}
```

### Step 6: Update Layout to Include Session Provider

Update `app/layout.tsx`:

```typescript
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { SessionProvider } from "@/components/SessionProvider"

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  
  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

Create `components/SessionProvider.tsx`:

```typescript
'use client'

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

export function SessionProvider({ children, session }: any) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  )
}
```

### Step 7: Add Sign Out Button (Optional)

You can add a sign-out button to your UI:

```typescript
'use client'

import { signOut, useSession } from "next-auth/react"

export function UserMenu() {
  const { data: session } = useSession()
  
  if (!session) return null
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700">{session.user?.email}</span>
      <button
        onClick={() => signOut()}
        className="text-sm text-red-600 hover:text-red-700"
      >
        Sign out
      </button>
    </div>
  )
}
```

## Step-by-Step Setup Instructions

### Recommended Setup Order

**This guide follows a logical progression:**
1. Set up OAuth for localhost first (independent of domain)
2. Implement and test code locally
3. Set up production domain in Vercel
4. Add production OAuth URIs once domain is ready
5. Deploy and test production

This approach lets you have a fully working local version while waiting for DNS propagation.

---

### Phase 1: Google Cloud Console - Localhost Only

**Goal**: Set up OAuth for local development first (no domain dependency)

1. **Create or Select Project**:
   - Go to https://console.cloud.google.com/
   - Create a NEW project: "AI Diagnostics - WeMaintain"
   - Select this project

2. **Configure OAuth Consent Screen**:
   - Type: **Internal** (for Google Workspace users only)
   - App name: `AI Diagnostics - Lift Analysis`
   - User support email: Your WeMaintain email
   - Developer contact: Your WeMaintain email
   - Scopes: Default (email, profile, openid)

3. **Create OAuth Client ID**:
   - Application type: **Web application**
   - Name: `AI Diagnostics Web Client`
   - **Authorized JavaScript origins** (localhost only for now):
     ```
     http://localhost:3002
     ```
   - **Authorized redirect URIs** (localhost only for now):
     ```
     http://localhost:3002/api/auth/callback/google
     ```
   
4. **Copy Credentials**:
   - Client ID (ends with `.apps.googleusercontent.com`)
   - Client Secret
   - ⚠️ **Keep this Google Console tab open** - we'll add production URIs in Phase 4

---

### Phase 2: Local Development Setup

1. **Install NextAuth.js**:
   ```bash
   npm install next-auth@latest
   ```

2. **Create `.env.local` file**:
   ```bash
   touch .env.local
   ```

3. **Fill in environment variables** (see `.env.local` template above)

4. **Generate NEXTAUTH_SECRET**:
   ```bash
   openssl rand -base64 32
   ```
   Copy the output to `NEXTAUTH_SECRET` in `.env.local`

5. **Implement NextAuth files** (see Implementation Steps above):
   - `lib/auth.ts`
   - `app/api/auth/[...nextauth]/route.ts`
   - `middleware.ts`
   - `app/auth/signin/page.tsx` (optional)
   - `components/SessionProvider.tsx`

6. **Start development server**:
   ```bash
   npm run dev
   ```

7. **Test SSO**:
   - Navigate to `http://localhost:3002`
   - Should redirect to `/auth/signin` (or NextAuth default page)
   - Click "Sign in with Google"
   - Complete authentication flow with @wemaintain.com email

---

### Phase 2: Local Development Setup

**Goal**: Implement SSO and test it locally before touching production

1. **Install NextAuth.js**:
   ```bash
   npm install next-auth@latest
   ```

2. **Create `.env.local` file**:
   ```bash
   touch .env.local
   ```

3. **Fill in environment variables** (see `.env.local` template above):
   - Use `NEXTAUTH_URL=http://localhost:3002`
   - Add Google Client ID and Secret from Phase 1
   - Add all existing Looker and OpenAI variables

4. **Generate NEXTAUTH_SECRET**:
   ```bash
   openssl rand -base64 32
   ```
   Copy the output to `NEXTAUTH_SECRET` in `.env.local`

5. **Implement NextAuth files** (see Implementation Steps section above for full code):
   - `lib/auth.ts` - NextAuth configuration
   - `app/api/auth/[...nextauth]/route.ts` - API route handler
   - `middleware.ts` - Route protection
   - `app/auth/signin/page.tsx` - Custom sign-in page (optional but recommended)
   - `components/SessionProvider.tsx` - Session provider wrapper

6. **Start development server**:
   ```bash
   npm run dev
   ```

7. **Test SSO locally**:
   - Navigate to `http://localhost:3002`
   - Should redirect to `/auth/signin` page
   - Click "Sign in with Google"
   - Sign in with your @wemaintain.com email
   - Should redirect back to main page
   - Verify session persists after page refresh
   - Test that non-@wemaintain.com emails are rejected

8. **✅ Checkpoint**: Local SSO working before proceeding to production

---

### Phase 3: Production Domain Setup

**Goal**: Set up custom domain and wait for DNS propagation

1. **Add Custom Domain in Vercel**:
   - Go to Vercel Dashboard → Your Project (rogue-units) → Settings → Domains
   - Click "Add Domain"
   - Enter: `ai-diagnostics.wemaintain.com`
   - Vercel will show DNS instructions

2. **Configure DNS Records**:
   - Contact IT admin if you don't have DNS access
   - Add CNAME record as shown in Vercel:
     ```
     Type: CNAME
     Name: ai-diagnostics.wemaintain.com
     Value: cname.vercel-dns.com (or as shown in Vercel)
     ```

3. **Wait for DNS Propagation**:
   - Check Vercel domain status - should show "Ready"
   - Usually takes 5-10 minutes, can take up to 48 hours
   - SSL certificate will be automatically provisioned by Vercel
   - You can check DNS propagation: `nslookup ai-diagnostics.wemaintain.com`

4. **Verify Domain**:
   - Once Vercel shows "Ready", try accessing `https://ai-diagnostics.wemaintain.com`
   - Should show your current app (without SSO yet)

5. **✅ Checkpoint**: Domain accessible before adding production OAuth

---

### Phase 4: Production OAuth & Deployment

**Goal**: Add production URIs to OAuth and deploy SSO to production

1. **Update Google Cloud Console OAuth Client**:
   - Go back to Google Cloud Console → OAuth Client from Phase 1
   - Click "Edit" on your OAuth Client
   - **Add production JavaScript origin**:
     ```
     https://ai-diagnostics.wemaintain.com
     ```
   - **Add production Redirect URI**:
     ```
     https://ai-diagnostics.wemaintain.com/api/auth/callback/google
     ```
   - Save changes

2. **Generate Production Secret**:
   ```bash
   openssl rand -base64 32
   ```
   ⚠️ **Important**: Use a DIFFERENT secret than local!

3. **Set Environment Variables in Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add or update these variables:
     - `NEXTAUTH_URL=https://ai-diagnostics.wemaintain.com`
     - `NEXTAUTH_SECRET=` (new secret from step 2, different from local)
     - `GOOGLE_CLIENT_ID=` (same as local, from Phase 1)
     - `GOOGLE_CLIENT_SECRET=` (same as local, from Phase 1)
     - `GOOGLE_WORKSPACE_DOMAIN=wemaintain.com`
   - ✅ Verify all existing variables are still set (Looker, OpenAI, etc.)

4. **Deploy to Production**:
   ```bash
   git add .
   git commit -m "Add SSO authentication with NextAuth.js"
   git push origin main
   ```
   - Vercel will automatically deploy (2-3 minutes)

5. **Test Production SSO**:
   - Navigate to `https://ai-diagnostics.wemaintain.com`
   - Should redirect to sign-in page
   - Click "Sign in with Google"
   - Sign in with @wemaintain.com email
   - Should redirect to main page
   - Verify session persists after page refresh
   - Test that non-@wemaintain.com emails are rejected

6. **✅ Complete**: Production SSO is live!

---

### Why This Order?

This sequence ensures:
1. ✅ You can fully test SSO locally without any domain dependencies
2. ✅ You have a working local version while waiting for DNS propagation
3. ✅ You don't add production OAuth URIs before the domain is ready
4. ✅ Each phase is independently testable and can be troubleshot separately
5. ✅ Safer deployment - test locally first, then production

## Key Differences: Local vs Production

| Configuration | Local Development | Production |
|--------------|------------------|------------|
| `NEXTAUTH_URL` | `http://localhost:3002` | `https://ai-diagnostics.wemaintain.com` |
| `NEXTAUTH_SECRET` | Different secret | Different secret (must be unique) |
| Session Cookie | `next-auth.session-token` | `__Secure-next-auth.session-token` |
| Protocol | HTTP | HTTPS (required) |
| Domain Restriction | `wemaintain.com` | `wemaintain.com` |
| Port | 3002 | N/A (standard 443 for HTTPS) |
| Session Storage | JWT (no database) | JWT (no database) |

## Key Differences from MTR Maintenance Project

| Aspect | MTR Maintenance | AI Diagnostics |
|--------|----------------|----------------|
| **Subdomain** | `mtr-maintenance.wemaintain.com` | `ai-diagnostics.wemaintain.com` |
| **Local Port** | 3004 | 3002 |
| **Google Project** | MTR Maintenance Tracking | AI Diagnostics (NEW - separate project) |
| **OAuth Client** | MTR Web Client | AI Diagnostics Web Client (NEW) |
| **Session Strategy** | Database (Prisma + PostgreSQL) | JWT (no database required) |
| **Database** | Required (PostgreSQL) | Not required |
| **Dependencies** | NextAuth + Prisma + DB | NextAuth only |
| **Complexity** | Higher (database management) | Lower (stateless JWT) |

## Security Considerations

1. **Never commit secrets**: `.env.local` should be in `.gitignore` (already configured)
2. **Use HTTPS in production**: Required for secure cookies
3. **Different secrets**: Use different `NEXTAUTH_SECRET` for local and production
4. **Domain restriction**: `GOOGLE_WORKSPACE_DOMAIN=wemaintain.com` restricts access
5. **OAuth consent screen**: Set to "Internal" for Google Workspace only
6. **Rotate secrets**: Change `NEXTAUTH_SECRET` periodically
7. **JWT strategy**: No database = less attack surface, but tokens can't be revoked until expiry
8. **Session duration**: Default 7 days - adjust based on security requirements

## Troubleshooting

### Common Issues

**"Redirect URI mismatch" error:**
- Verify redirect URI in Google Cloud Console exactly matches:
  - Local: `http://localhost:3002/api/auth/callback/google`
  - Production: `https://ai-diagnostics.wemaintain.com/api/auth/callback/google`
- No trailing slashes allowed
- Must use correct port (3002, not 3000 or 3004)

**"Access Denied" error:**
- Check `GOOGLE_WORKSPACE_DOMAIN=wemaintain.com` is set correctly
- Verify user's email ends with `@wemaintain.com`
- Check OAuth consent screen is set to "Internal"
- Ensure signIn callback in `lib/auth.ts` has correct domain check

**Session not persisting:**
- Verify `NEXTAUTH_SECRET` is set and consistent
- Check `NEXTAUTH_URL` matches current environment
- Ensure cookies are enabled in browser
- Verify HTTPS is used in production
- Check browser console for cookie errors

**Wrong redirect after login:**
- Ensure `NEXTAUTH_URL` matches the environment you're running in
- Don't use production URL when running locally
- Use `http://localhost:3002` (not `127.0.0.1:3002`)

**"Cannot find module 'next-auth'" error:**
- Run `npm install next-auth@latest`
- Delete `node_modules` and `package-lock.json`, then `npm install`

**Domain not accessible:**
- Wait for DNS propagation (can take up to 48 hours, usually minutes)
- Verify CNAME record is correctly configured
- Check Vercel domain status shows "Ready"

**Google OAuth not working with new project:**
- Ensure OAuth consent screen is configured
- Verify redirect URIs are added to the NEW Google Cloud project
- Check that OAuth client credentials match in `.env.local`

## Verification Checklist

### Prerequisites
- [ ] Have access to WeMaintain Google Workspace admin console (or know who does)
- [ ] Have access to Vercel project (rogue-units)
- [ ] Have access to WeMaintain DNS settings (or contact IT admin)

### Local Development
- [ ] NextAuth.js installed (`npm install next-auth@latest`)
- [ ] `.env.local` file created with all required variables
- [ ] `NEXTAUTH_URL=http://localhost:3002` (port 3002, not 3000 or 3004)
- [ ] `NEXTAUTH_SECRET` generated and set (use `openssl rand -base64 32`)
- [ ] Google OAuth credentials configured in NEW Google Cloud project
- [ ] All NextAuth files created:
  - [ ] `lib/auth.ts`
  - [ ] `app/api/auth/[...nextauth]/route.ts`
  - [ ] `middleware.ts`
  - [ ] `app/auth/signin/page.tsx` (optional but recommended)
  - [ ] `components/SessionProvider.tsx`
- [ ] Can start dev server: `npm run dev`
- [ ] Can navigate to `http://localhost:3002`
- [ ] Redirects to sign-in page
- [ ] Can sign in with Google using @wemaintain.com email
- [ ] Non-@wemaintain.com emails are rejected

### Google Cloud Console Setup
- [ ] NEW Google Cloud project created: "AI Diagnostics - WeMaintain"
- [ ] OAuth consent screen configured (Internal, for WeMaintain Workspace)
- [ ] OAuth Web Client created: "AI Diagnostics Web Client"
- [ ] JavaScript origins added:
  - [ ] `http://localhost:3002`
  - [ ] `https://ai-diagnostics.wemaintain.com`
- [ ] Redirect URIs added:
  - [ ] `http://localhost:3002/api/auth/callback/google`
  - [ ] `https://ai-diagnostics.wemaintain.com/api/auth/callback/google`
- [ ] Client ID and Secret copied to `.env.local`

### Production (Vercel)
- [ ] All environment variables set in Vercel project settings
- [ ] `NEXTAUTH_URL=https://ai-diagnostics.wemaintain.com` (production URL)
- [ ] Production `NEXTAUTH_SECRET` generated (different from local)
- [ ] Same Google OAuth credentials as local (or separate production credentials)
- [ ] Custom domain `ai-diagnostics.wemaintain.com` added in Vercel
- [ ] DNS CNAME record configured: `ai-diagnostics.wemaintain.com → cname.vercel-dns.com`
- [ ] Domain shows "Ready" status in Vercel
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Code deployed to Vercel (push to main or `vercel --prod`)
- [ ] Can access `https://ai-diagnostics.wemaintain.com`
- [ ] Redirects to sign-in page
- [ ] Can sign in with Google using @wemaintain.com email
- [ ] Only `@wemaintain.com` emails can sign in
- [ ] Session persists after page refresh

## Additional Resources

- [NextAuth.js Documentation (v5)](https://next-auth.js.org/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Vercel Custom Domains Guide](https://vercel.com/docs/concepts/projects/domains)
- [AI Diagnostics Deployment Guide](../DEPLOYMENT.md) - General deployment instructions
- [AI Diagnostics Setup Guide](../SETUP.md) - Environment setup

## Summary

This setup guide covers:

1. **Domain Configuration**: Migrating from `rogue-units.vercel.app` to `ai-diagnostics.wemaintain.com`
2. **Google Workspace SSO**: Implementing NextAuth.js with JWT sessions (no database required)
3. **Separate Google Project**: Creating a NEW OAuth client specifically for AI Diagnostics
4. **Security**: Domain restriction to @wemaintain.com emails only
5. **Implementation**: Complete code examples for all required files

### Next Steps After Setup

1. Test authentication thoroughly in local development
2. Coordinate with IT admin for DNS configuration
3. Add custom domain in Vercel
4. Set all production environment variables in Vercel
5. Deploy and test production authentication
6. Update any documentation or internal links to use new domain
7. Consider adding user profile display and sign-out button to UI
8. Monitor authentication logs in Vercel for any issues

### Getting Help

- **Domain/DNS issues**: Contact WeMaintain IT admin
- **Google Workspace issues**: Contact WeMaintain Google Workspace admin
- **Vercel issues**: Check Vercel dashboard logs or contact Vercel support
- **NextAuth issues**: Check NextAuth.js documentation or GitHub issues
- **Code issues**: Review implementation files against examples in this document

