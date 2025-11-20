# Production Diagnostic Fixes

## Issues Fixed

### 1. Date Field Parsing Error
**Problem:** The code was using `v.date` but visit reports use `completedDate` field, causing errors when calculating time since last maintenance.

**Fix:** Updated to check both `v.date` and `v.completedDate`, with proper null/undefined handling and date validation.

**Location:** `app/api/diagnostic/analyze/route.ts` lines 74-88

### 2. Missing Environment Variable Validation
**Problem:** No validation of required environment variables at startup, causing cryptic errors when variables are missing.

**Fix:** Added validation at the start of the analyze route to check for:
- `LOOKER_API_BASE_URL`
- `LOOKER_CLIENT_ID`
- `LOOKER_CLIENT_SECRET`
- `OPENAI_API_KEY`

**Location:** `app/api/diagnostic/analyze/route.ts` lines 9-30

### 3. Improved Error Logging
**Problem:** Errors in production were not providing enough detail for debugging.

**Fix:** 
- Enhanced error logging with stack traces (in development)
- Better error messages for common issues
- JSON parsing error handling with response preview

**Location:** 
- `app/api/diagnostic/analyze/route.ts` lines 120-135
- `lib/llm-analysis.ts` lines 109-116

### 4. OpenAI API Key Validation
**Problem:** No warning when OpenAI API key is missing.

**Fix:** Added warning on module load if API key is not set.

**Location:** `lib/llm-analysis.ts` lines 11-14

## Common Production Issues and Solutions

### Issue: "Failed to analyze diagnostic" 500 Error

**Possible Causes:**

1. **Missing Environment Variables**
   - Check Vercel/Netlify environment variables are set
   - Verify all required variables are present (see DEPLOYMENT.md)

2. **Looker API Connection Issues**
   - Verify `LOOKER_API_BASE_URL` is correct
   - Check `LOOKER_CLIENT_ID` and `LOOKER_CLIENT_SECRET` are valid
   - Ensure Looker API credentials have proper permissions

3. **OpenAI API Issues**
   - Verify `OPENAI_API_KEY` is set and valid
   - Check OpenAI billing/quota status
   - Ensure model `gpt-4o` is available on your plan

4. **Date Parsing Errors**
   - Fixed in this update - should no longer occur

5. **JSON Parsing Errors**
   - LLM may return invalid JSON
   - Error logs now show first 500 chars of response for debugging

### Debugging Steps

1. **Check Vercel Logs:**
   ```bash
   vercel logs [deployment-url]
   ```

2. **Check Environment Variables:**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Verify all variables are set correctly

3. **Test Locally:**
   ```bash
   npm run build
   npm start
   ```
   Then test the diagnostic endpoint

4. **Check API Responses:**
   - Look for error messages in console logs
   - Check for specific error details in API response

## Deployment Checklist

- [ ] All environment variables set in production
- [ ] Looker API credentials verified
- [ ] OpenAI API key verified and has quota
- [ ] Build completes successfully (`npm run build`)
- [ ] Test diagnostic endpoint after deployment
- [ ] Monitor error logs for first few requests

## Monitoring

After deployment, monitor:
- Error rates in Vercel dashboard
- API response times
- OpenAI API usage/quota
- Looker API response times

## Next Steps

If issues persist:
1. Check Vercel function logs for detailed error messages
2. Verify environment variables are correctly set
3. Test Looker API connectivity separately
4. Test OpenAI API connectivity separately
5. Review error logs for specific failure points

