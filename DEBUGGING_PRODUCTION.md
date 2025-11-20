# Debugging Production Issues

## Quick Debugging Steps

### 1. Check Vercel Function Logs

The most important step is to check the actual error logs from Vercel:

**Via Vercel Dashboard:**
1. Go to https://vercel.com/dashboard
2. Select your project: `rogue-units`
3. Go to the "Deployments" tab
4. Click on the latest deployment
5. Click on "Functions" tab
6. Find `/api/diagnostic/analyze` function
7. Click on it to see logs
8. Look for error messages starting with `[API]`

**Via Vercel CLI:**
```bash
vercel logs https://rogue-units.vercel.app --follow
```

### 2. Check Environment Variables

Verify all environment variables are set in Vercel:

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Verify these are set:
   - `LOOKER_API_BASE_URL`
   - `LOOKER_CLIENT_ID`
   - `LOOKER_CLIENT_SECRET`
   - `LOOKER_BUILDINGS_LOOK_ID=161`
   - `LOOKER_VISITS_LOOK_ID=162`
   - `LOOKER_BREAKDOWNS_LOOK_ID=163`
   - `LOOKER_MAINTENANCE_ISSUES_LOOK_ID=165`
   - `LOOKER_REPAIR_REQUESTS_LOOK_ID=166`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL=gpt-4o`

### 3. Common Error Patterns

#### Error: "Missing environment variables"
**Solution:** Set all required environment variables in Vercel dashboard

#### Error: "Failed to fetch diagnostic data"
**Possible causes:**
- Looker API credentials incorrect
- Looker API base URL incorrect
- Network connectivity issues
- Looker API rate limiting

**Check logs for:**
- `[Looker] Initializing client with:` - Should show baseUrl and clientId
- `[API] Error fetching visit reports:` - Specific Looker error

#### Error: "Failed to generate LLM analysis"
**Possible causes:**
- OpenAI API key missing or invalid
- OpenAI API quota exceeded
- Model not available (gpt-4o)
- Request timeout (function timeout)

**Check logs for:**
- `[LLM] Attempting to use model:` - Shows which model is being tried
- `[LLM] Error with model:` - Specific OpenAI error
- `OpenAI API quota exceeded` - Billing issue

#### Error: "Failed to parse LLM response as JSON"
**Possible causes:**
- LLM returned invalid JSON
- Response too large
- Model hallucination

**Check logs for:**
- `[LLM] Response content (first 500 chars):` - Shows what LLM returned

### 4. Test Individual Components

#### Test Looker Connection:
```bash
# In Vercel function logs, look for:
[Looker] Initializing client with: { baseUrl: '...', ... }
```

#### Test Data Fetching:
Look for logs like:
```
[API] Fetched data: X visits, Y breakdowns, Z maintenance issues, W repair requests
```

#### Test LLM:
Look for logs like:
```
[LLM] Attempting to use model: gpt-4o
[LLM] Successfully generated analysis using model: gpt-4o
```

### 5. Function Timeout Issues

Vercel free tier has a 10-second timeout for serverless functions. If your diagnostic takes longer:

**Symptoms:**
- Request fails after ~10 seconds
- No error in logs, just timeout

**Solutions:**
1. Upgrade to Vercel Pro (60-second timeout)
2. Optimize data fetching (reduce date range)
3. Add timeout handling in code

### 6. Check Error Response Format

The API now returns detailed error information:

```json
{
  "error": "Failed to analyze diagnostic",
  "details": "Specific error message",
  "errorType": "ErrorName"
}
```

Check the browser console Network tab → Response to see the exact error.

### 7. Enable Debug Mode

To see more detailed logs, you can temporarily add:

```typescript
console.log('[DEBUG] Environment check:', {
  hasLookerUrl: !!process.env.LOOKER_API_BASE_URL,
  hasLookerId: !!process.env.LOOKER_CLIENT_ID,
  hasLookerSecret: !!process.env.LOOKER_CLIENT_SECRET,
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
})
```

### 8. Test Locally First

Before deploying, test locally:

```bash
npm run build
npm start
# Then test the endpoint locally
```

This helps catch issues before they reach production.

## Getting Help

If the issue persists:

1. **Collect logs:**
   - Copy all `[API]` log entries from Vercel
   - Copy error response from browser console
   - Note the exact error message

2. **Check:**
   - Environment variables are set correctly
   - Looker API credentials are valid
   - OpenAI API key is valid and has quota
   - Function timeout hasn't been exceeded

3. **Share:**
   - Error message from API response
   - Relevant log entries from Vercel
   - Environment variable names (not values!)

## Recent Fixes Applied

- ✅ Date parsing error fixed (handles both `date` and `completedDate`)
- ✅ Environment variable validation added
- ✅ Enhanced error logging at each step
- ✅ Better error messages in API responses
- ✅ JSON parsing error handling with response preview

These fixes should help identify the exact failure point in production.

