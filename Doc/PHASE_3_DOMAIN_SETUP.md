# Phase 3: Domain Setup - Step-by-Step Guide

## 🎯 Goal
Add custom domain `ai-diagnostics.wemaintain.com` to your Vercel project and configure DNS.

---

## Method 1: Vercel Dashboard (Recommended)

### Step 1: Access Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Sign in with your GitHub account (if not already signed in)
3. Find your project: **rogue-units** (or whatever your project is named)
4. Click on the project to open it

### Step 2: Add Custom Domain

1. In your project dashboard, click on **Settings** (top navigation)
2. Click on **Domains** in the left sidebar
3. In the "Domains" section, you'll see:
   - Current domains (probably `rogue-units.vercel.app`)
   - An input field to add a new domain
4. Enter: `ai-diagnostics.wemaintain.com`
5. Click **Add** or **Add Domain**

### Step 3: Configure DNS

Vercel will show you DNS configuration instructions. You'll see something like:

**Option A: CNAME Record (Most Common)**
```
Type: CNAME
Name: ai-diagnostics
Value: cname.vercel-dns.com
```

**Option B: A Record (If CNAME not supported)**
```
Type: A
Name: ai-diagnostics
Value: 76.76.21.21 (or similar IP)
```

**What to do:**

1. **If you have DNS access:**
   - Log into your DNS provider (Google Workspace Admin, Cloudflare, Route53, etc.)
   - Add the record as shown by Vercel
   - Save the changes

2. **If you DON'T have DNS access:**
   - Contact your WeMaintain IT admin
   - Send them this information:
     ```
     Domain: ai-diagnostics.wemaintain.com
     Type: CNAME
     Name: ai-diagnostics
     Value: cname.vercel-dns.com
     ```
   - Ask them to add this DNS record

### Step 4: Wait for DNS Propagation

1. **In Vercel Dashboard:**
   - Go back to Settings → Domains
   - You'll see `ai-diagnostics.wemaintain.com` with status:
     - ⏳ **Pending** - DNS not yet propagated
     - ✅ **Ready** - Domain is active and SSL certificate issued
     - ❌ **Invalid Configuration** - DNS record incorrect

2. **Check DNS Propagation:**
   ```bash
   # Check if DNS is resolving
   nslookup ai-diagnostics.wemaintain.com
   
   # Or use dig
   dig ai-diagnostics.wemaintain.com
   
   # Should show CNAME pointing to Vercel
   ```

3. **Typical Timeline:**
   - ⚡ **Fast**: 5-10 minutes
   - 🕐 **Normal**: 15-30 minutes
   - 🐌 **Slow**: Up to 48 hours (rare)

### Step 5: Verify Domain is Ready

Once Vercel shows **"Ready"** status:

1. **Test HTTPS:**
   ```bash
   curl -I https://ai-diagnostics.wemaintain.com
   ```
   Should return `200 OK` or `301/302 redirect`

2. **Test in Browser:**
   - Navigate to `https://ai-diagnostics.wemaintain.com`
   - Should show your application (without SSO yet)
   - Should have valid SSL certificate (🔒 lock icon)

3. **Check SSL Certificate:**
   - Click the lock icon in browser
   - Should show "Certificate is valid"
   - Issued by: Let's Encrypt or Vercel

---

## Method 2: Vercel CLI (Alternative)

If you prefer command line:

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Link Project (if not already linked)

```bash
cd /Users/matthieu/Documents/Cursor_Projects/Rogue_Units_Analysis
vercel link
```

### Step 4: Add Domain

```bash
vercel domains add ai-diagnostics.wemaintain.com
```

### Step 5: Follow DNS Instructions

The CLI will output DNS configuration. Follow the same DNS steps as Method 1.

---

## Troubleshooting

### Domain Shows "Invalid Configuration"

**Possible causes:**
1. DNS record not added yet
2. DNS record incorrect (typo in value)
3. DNS propagation not complete

**Solutions:**
- Double-check DNS record matches exactly what Vercel shows
- Wait a few more minutes for propagation
- Verify DNS record using `nslookup` or `dig`

### Domain Shows "Pending" for a Long Time

**Check:**
1. DNS record is correctly configured
2. DNS propagation status:
   ```bash
   nslookup ai-diagnostics.wemaintain.com
   ```
3. Contact DNS provider if record isn't showing

### SSL Certificate Not Issued

**Usually resolves automatically:**
- Wait 5-10 minutes after DNS is ready
- Vercel automatically provisions SSL certificates
- If stuck, try removing and re-adding the domain

### Domain Points to Wrong Place

**Check:**
1. DNS record value is correct
2. No conflicting records (A vs CNAME)
3. DNS cache cleared (try incognito mode)

---

## Verification Checklist

After completing Phase 3, verify:

- [ ] Domain added in Vercel Dashboard → Settings → Domains
- [ ] DNS record added (CNAME or A record)
- [ ] Vercel shows domain status as **"Ready"**
- [ ] `nslookup ai-diagnostics.wemaintain.com` resolves correctly
- [ ] `https://ai-diagnostics.wemaintain.com` loads in browser
- [ ] SSL certificate is valid (🔒 lock icon)
- [ ] Application loads (even without SSO yet)

---

## Next Steps

Once domain is **"Ready"** in Vercel:

✅ **Phase 3 Complete!**  
➡️ **Proceed to Phase 4**: Add production OAuth URIs and deploy SSO

---

## Quick Reference

**Domain**: `ai-diagnostics.wemaintain.com`  
**DNS Type**: CNAME (usually)  
**DNS Value**: `cname.vercel-dns.com` (check Vercel for exact value)  
**Vercel Dashboard**: https://vercel.com/dashboard  
**Status Check**: Settings → Domains → Check status

---

## Need Help?

- **DNS Issues**: Contact WeMaintain IT admin
- **Vercel Issues**: Check Vercel dashboard logs or support
- **SSL Issues**: Usually auto-resolves, wait 10 minutes after DNS ready

