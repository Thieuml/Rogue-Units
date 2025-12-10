# AI Diagnostics - SSO Setup Quick Checklist

## 🎯 Quick Reference

**Subdomain**: `ai-diagnostics.wemaintain.com`  
**Local Port**: `3002`  
**Google Project**: NEW (separate from MTR Maintenance)  
**Session Strategy**: JWT (no database needed)

---

## 📋 Setup Flow

```
Phase 1: Google Console (Localhost)
   ↓
Phase 2: Local Development & Testing
   ↓
Phase 3: Domain Setup + DNS Wait
   ↓
Phase 4: Production OAuth & Deploy
```

**Why this order?** 
- ✅ Test locally first (no domain dependency)
- ✅ Have working local version while DNS propagates
- ✅ Only add production OAuth once domain is confirmed ready
- ✅ Each phase is independently testable

---

## ✅ Setup Checklist

### Phase 1: Google Cloud Console - Local Setup (15 minutes)

⚠️ **Note**: We'll start with localhost only, add production URIs later when domain is ready

- [ ] **1.1** Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] **1.2** Create NEW project: "AI Diagnostics - WeMaintain"
- [ ] **1.3** Configure OAuth Consent Screen
  - Type: **Internal**
  - App name: `AI Diagnostics - Lift Analysis`
  - Support email: Your @wemaintain.com email
- [ ] **1.4** Create OAuth Client ID
  - Type: **Web application**
  - Name: `AI Diagnostics Web Client`
- [ ] **1.5** Add JavaScript origin (localhost only for now):
  ```
  http://localhost:3002
  ```
- [ ] **1.6** Add Redirect URI (localhost only for now):
  ```
  http://localhost:3002/api/auth/callback/google
  ```
- [ ] **1.7** Copy Client ID and Secret (save securely)
- [ ] **1.8** ⚠️ Keep Google Console tab open - we'll add production URIs later

---

### Phase 2: Local Development Implementation (30 minutes)

- [ ] **2.1** Install NextAuth.js:
  ```bash
  npm install next-auth@latest
  ```

- [ ] **2.2** Generate NEXTAUTH_SECRET:
  ```bash
  openssl rand -base64 32
  ```

- [ ] **2.3** Create `.env.local` with all variables (see full guide)
  - Use `NEXTAUTH_URL=http://localhost:3002`
  - Add Google credentials from Phase 1

- [ ] **2.4** Create these files (copy from full guide):
  - [ ] `lib/auth.ts` - NextAuth configuration
  - [ ] `app/api/auth/[...nextauth]/route.ts` - API handler
  - [ ] `middleware.ts` - Route protection
  - [ ] `app/auth/signin/page.tsx` - Custom sign-in page
  - [ ] `components/SessionProvider.tsx` - Client provider

- [ ] **2.5** Test locally:
  ```bash
  npm run dev
  ```

- [ ] **2.6** Navigate to `http://localhost:3002`

- [ ] **2.7** Verify redirect to sign-in page

- [ ] **2.8** Test sign-in with @wemaintain.com email

- [ ] **2.9** Verify non-@wemaintain.com emails are rejected

- [ ] **2.10** ✅ Local development working - ready for production setup!

---

### Phase 3: Production Domain Setup (10-15 minutes + DNS wait)

- [ ] **3.1** Add custom domain in Vercel:
  - Go to Vercel Dashboard → rogue-units → Settings → Domains
  - Click "Add Domain"
  - Enter: `ai-diagnostics.wemaintain.com`

- [ ] **3.2** Note the DNS instructions from Vercel (usually CNAME)

- [ ] **3.3** Configure DNS (contact IT admin if you don't have access):
  ```
  Type: CNAME
  Name: ai-diagnostics.wemaintain.com
  Value: cname.vercel-dns.com (or as shown in Vercel)
  ```

- [ ] **3.4** Wait for DNS propagation and SSL provisioning
  - Check Vercel: Domain status should show "Ready"
  - Usually takes 5-10 minutes, can take up to 48 hours
  - SSL certificate will be automatically provisioned

- [ ] **3.5** Verify domain is accessible:
  ```bash
  # Should resolve to Vercel
  nslookup ai-diagnostics.wemaintain.com
  ```

- [ ] **3.6** ✅ Domain ready - now we can add production OAuth!

---

### Phase 4: Production OAuth & Deployment (20 minutes)

- [ ] **4.1** Go back to Google Cloud Console (OAuth Client from Phase 1)

- [ ] **4.2** Add production JavaScript origin:
  ```
  https://ai-diagnostics.wemaintain.com
  ```

- [ ] **4.3** Add production Redirect URI:
  ```
  https://ai-diagnostics.wemaintain.com/api/auth/callback/google
  ```

- [ ] **4.4** Save changes in Google Console

- [ ] **4.5** Generate NEW production secret:
  ```bash
  openssl rand -base64 32
  ```

- [ ] **4.6** Set all environment variables in Vercel:
  - Go to Vercel → rogue-units → Settings → Environment Variables
  - Add/Update:
    - `NEXTAUTH_URL=https://ai-diagnostics.wemaintain.com`
    - `NEXTAUTH_SECRET=` (new secret from 4.5 - different from local!)
    - `GOOGLE_CLIENT_ID=` (from Phase 1)
    - `GOOGLE_CLIENT_SECRET=` (from Phase 1)
    - `GOOGLE_WORKSPACE_DOMAIN=wemaintain.com`
  - ✅ Verify all existing vars are still set (Looker, OpenAI, etc.)

- [ ] **4.7** Commit and deploy SSO code:
  ```bash
  git add .
  git commit -m "Add SSO authentication with NextAuth.js"
  git push origin main
  ```

- [ ] **4.8** Wait for Vercel deployment to complete (2-3 minutes)

- [ ] **4.9** Navigate to `https://ai-diagnostics.wemaintain.com`

- [ ] **4.10** Verify redirect to sign-in page

- [ ] **4.11** Test sign-in with @wemaintain.com email

- [ ] **4.12** Verify session persists after page refresh

- [ ] **4.13** Test non-@wemaintain.com email is rejected

- [ ] **4.14** ✅ Production SSO complete!

---

## 🚨 Common Issues & Quick Fixes

| Issue | Fix |
|-------|-----|
| "Redirect URI mismatch" | Verify exact URI in Google Console (no trailing slash, correct port) |
| "Access Denied" | Check email ends with @wemaintain.com |
| Domain not accessible | Wait for DNS propagation (up to 48h, usually minutes) |
| Can't sign in locally | Verify port 3002 in NEXTAUTH_URL and redirect URI |
| Session not persisting | Check NEXTAUTH_SECRET is set and NEXTAUTH_URL matches environment |

---

## 📋 Environment Variables Quick Reference

### Local (.env.local)
```bash
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=<generate-with-openssl>
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
GOOGLE_WORKSPACE_DOMAIN=wemaintain.com
# ... + all existing Looker and OpenAI vars
```

### Production (Vercel)
```bash
NEXTAUTH_URL=https://ai-diagnostics.wemaintain.com
NEXTAUTH_SECRET=<different-from-local>
GOOGLE_CLIENT_ID=<same-as-local>
GOOGLE_CLIENT_SECRET=<same-as-local>
GOOGLE_WORKSPACE_DOMAIN=wemaintain.com
# ... + all existing Looker and OpenAI vars
```

---

## 📚 Full Documentation

See [WEMAINTAIN_DOMAIN_SSO_SETUP.md](./WEMAINTAIN_DOMAIN_SSO_SETUP.md) for:
- Complete code examples
- Detailed implementation steps
- Security considerations
- Troubleshooting guide

---

## ⏱️ Estimated Time

- **Phase 1 (Google Console - Localhost)**: 15 minutes
- **Phase 2 (Local Development & Testing)**: 30 minutes
- **Phase 3 (Domain Setup)**: 10-15 minutes + DNS propagation wait
- **Phase 4 (Production OAuth & Deploy)**: 20 minutes
- **Total Active Time**: ~75 minutes
- **Total with DNS Wait**: 75 minutes to 2 days (DNS usually takes 5-10 minutes)

---

## 💡 Why This Order?

1. **Start with localhost** - Test everything locally first without domain dependencies
2. **Get domain ready** - Set up domain and wait for DNS while you have working local version
3. **Add production OAuth last** - Only add production URIs once domain is confirmed working
4. **Safer approach** - Each phase is independently testable

This approach means you can have a fully working local version while waiting for DNS propagation!

---

## 🆘 Need Help?

- **Domain/DNS**: Contact WeMaintain IT admin
- **Google Workspace**: Contact WeMaintain Google admin
- **Code issues**: See full setup guide for code examples
- **Vercel issues**: Check deployment logs in Vercel Dashboard

