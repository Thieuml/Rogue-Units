# SSO Bypass - Temporary Development Mode

## Overview

A temporary bypass has been added to allow development while Google Workspace SSO is being configured. This is **clean and easy to remove** once SSO is ready.

---

## How to Enable Bypass

### Local Development (.env.local)

Add this line to your `.env.local` file:

```bash
# TEMPORARY: Bypass SSO for development
BYPASS_SSO=true
```

**Note**: For client-side components, also add:
```bash
NEXT_PUBLIC_BYPASS_SSO=true
```

### Production (Vercel)

**⚠️ DO NOT enable bypass in production!** This is for local development only.

---

## How It Works

When `BYPASS_SSO=true`:
- ✅ Middleware allows all requests (no authentication required)
- ✅ Sign-in page redirects automatically
- ✅ UserMenu shows "SSO Bypassed (Dev Mode)" indicator
- ✅ All routes are accessible without authentication

---

## How to Disable Bypass (Re-enable SSO)

### Option 1: Remove Environment Variable

Simply remove or comment out the bypass flag:

```bash
# BYPASS_SSO=true  # Commented out - SSO enabled
```

### Option 2: Set to False

```bash
BYPASS_SSO=false
```

---

## Files Modified for Bypass

The bypass is implemented in these files (marked with `TEMPORARY` comments):

1. **`middleware.ts`** - Checks `BYPASS_SSO` env var
2. **`app/layout.tsx`** - Skips session fetch when bypassed
3. **`components/UserMenu.tsx`** - Shows bypass indicator
4. **`app/auth/signin/page.tsx`** - Handles bypass redirect

All bypass code is clearly marked with:
```typescript
// TEMPORARY: Bypass SSO if BYPASS_SSO env var is set to 'true'
// Remove this bypass once Google Workspace SSO is configured
```

---

## Removing Bypass Code (After SSO is Ready)

Once Google Workspace SSO is configured and tested, you can remove the bypass code:

### Step 1: Remove Environment Variables

Remove from `.env.local`:
```bash
# Remove these lines:
BYPASS_SSO=true
NEXT_PUBLIC_BYPASS_SSO=true
```

### Step 2: Clean Up Code

Search for `TEMPORARY` or `BYPASS_SSO` in:
- `middleware.ts`
- `app/layout.tsx`
- `components/UserMenu.tsx`
- `app/auth/signin/page.tsx`

Remove all bypass-related code blocks.

### Step 3: Test

1. Remove bypass env vars
2. Restart dev server
3. Verify redirect to sign-in page
4. Test authentication flow

---

## Current Status

✅ **Bypass implemented** - Ready for development  
⏳ **Waiting for**: Google Workspace SSO configuration  
📝 **Next step**: Remove bypass once SSO is ready  

---

## Security Note

⚠️ **Never commit `.env.local` with `BYPASS_SSO=true`**  
⚠️ **Never enable bypass in production**  
⚠️ **Remove bypass code before production deployment**

The bypass is intended for **local development only** while waiting for SSO setup.







