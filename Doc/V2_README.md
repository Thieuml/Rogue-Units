# V2 Diagnostic Analysis - Quick Start Guide

## 🎯 What is V2?

V2 is a **restructured diagnostic analysis system** that preserves all V1 heuristics while introducing:
- **Evidence-based architecture**: Every claim traces back to raw data
- **Dual views**: Operational (plain language) + Technical (expert analysis)
- **Single source of truth**: CoreAnalysis shared by both views

**Key Point**: V1 is preserved and remains the default. V2 is opt-in via feature flag.

## 🚀 Quick Start

### 1. Check Current Version
```bash
# V1 is the default (if variable not set or set to 'v1')
echo $DIAGNOSTIC_ANALYSIS_VERSION
```

### 2. Enable V2 (Optional)
```bash
# In .env.local
DIAGNOSTIC_ANALYSIS_VERSION=v2
```

### 3. Test Both Versions
```bash
# Compare V1 vs V2 on sample data
npm run compare-versions
```

## 📁 File Overview

### Core Files
- **`lib/llm-analysis.ts`**: V1 preserved + router
- **`lib/llm-analysis-v2.ts`**: V2 types + validation
- **`lib/llm-prompt-v2.ts`**: V2 prompt (all V1 heuristics preserved)
- **`lib/llm-analysis-config.ts`**: Feature flag
- **`lib/llm-analysis-adapter.ts`**: V2→V1 conversion for UI

### Modified Files
- **`app/api/diagnostic/analyze/route.ts`**: Uses router, normalizes to V1
- **`app/api/diagnostic/recent/route.ts`**: Normalizes stored data to V1

### Test Files
- **`scripts/compare-analysis-versions.ts`**: Compare V1 vs V2
- **`scripts/test-v1.ts`**: Verify V1 still works

### Documentation
- **`Doc/V2_MIGRATION.md`**: Full migration guide
- **`Doc/V2_PROMPT_STRUCTURE.md`**: Prompt documentation
- **`Doc/V2_IMPLEMENTATION_SUMMARY.md`**: Implementation details

## 🔍 Understanding the Architecture

### V1 (Current Default)
```
Input → LLM V1 → DiagnosticAnalysisV1 → UI
```

### V2 (New)
```
Input → LLM V2 → DiagnosticAnalysisV2 {
  coreAnalysis (foundation)
    ├─→ operationalAnalysis (plain language)
    └─→ technicalAnalysis (technical)
} → Adapter → DiagnosticAnalysisV1 → UI
```

### Why the Adapter?
The adapter converts V2 to V1 format so the UI continues working without changes. This allows:
- ✅ Running V2 in production before UI updates
- ✅ Easy rollback if issues arise
- ✅ Gradual migration

## 🧪 Testing

### 1. Verify V1 Still Works
```bash
npm run tsx scripts/test-v1.ts
```

Expected output:
```
✅ V1 Analysis Completed Successfully
📊 Structure Validation:
  - executiveSummary: ✅
  - partsReplaced: ✅
  - timeline: ✅
  - repeatedPatterns: ✅
  ...
```

### 2. Compare V1 vs V2
```bash
npm run compare-versions
```

This runs both versions on the same data and shows:
- Parts count comparison
- Patterns comparison (≥2 frequency)
- Causality analysis
- Evidence integrity (V2 only)
- Summaries side-by-side

### 3. Test in Your App
```bash
# Set V2 in .env.local
DIAGNOSTIC_ANALYSIS_VERSION=v2

# Run dev server
npm run dev

# Generate a diagnostic
# Check API response for _analysisVersion field
```

## 📊 API Changes

### Request (Unchanged)
```typescript
POST /api/diagnostic/analyze
{
  unitId: "123",
  unitName: "Lift A",
  buildingId: "456",
  buildingName: "Building X",
  country: "FR",
  context: "Last 30 days"
}
```

### Response (Backward Compatible)
```typescript
{
  visitReports: [...],
  breakdowns: [...],
  maintenanceIssues: [...],
  repairRequests: [...],
  analysis: {
    // Always DiagnosticAnalysisV1 format (adapted if V2)
    executiveSummary: "...",
    partsReplaced: [...],
    timeline: [...],
    repeatedPatterns: [...],
    hypotheses: [...],
    suggestedChecks: [...],
    confidenceLevel: "medium"
  },
  _analysisVersion: "v1" // or "v2" - for monitoring
}
```

**Key Point**: The UI always receives V1 format, regardless of which version generated it.

## 🔧 Development Workflow

### Updating V1 (Stable)
1. Edit `lib/llm-analysis.ts`
2. Modify `getSystemPromptV1()` or `generateDiagnosticAnalysisV1()`
3. Test: `npm run tsx scripts/test-v1.ts`
4. Deploy

**Warning**: V1 changes affect production immediately (it's the default).

### Updating V2 (Experimental)
1. Edit `lib/llm-prompt-v2.ts`
2. Modify prompt sections or `generateDiagnosticAnalysisV2()`
3. Test: `npm run compare-versions`
4. Validate evidence integrity
5. Set `DIAGNOSTIC_ANALYSIS_VERSION=v2` locally
6. Test in dev environment
7. Deploy (V2 only active if flag is set)

**Benefit**: V2 changes are safe - only affect users who opt-in.

## 🎛️ Feature Flag Control

### Where to Set
- **Local**: `.env.local`
- **Vercel**: Environment Variables in dashboard

### Values
- `v1` or unset: Use V1 (default, stable)
- `v2`: Use V2 (new, experimental)

### Rollback
If V2 causes issues:
1. Set `DIAGNOSTIC_ANALYSIS_VERSION=v1` in Vercel
2. Redeploy (or wait for automatic pickup)
3. All new diagnostics use V1
4. Previous diagnostics unaffected (both formats supported)

## 📈 Monitoring

### Check Version in Use
Look for log messages:
```
[Analysis Config] Using diagnostic analysis version: v1
[LLM V2] Generating diagnostic analysis...
[API] Stored diagnostic for ... (version: v2)
```

### API Response
Check `_analysisVersion` field:
```json
{
  "analysis": { ... },
  "_analysisVersion": "v2"
}
```

### Evidence Integrity (V2 only)
In development, validation runs automatically:
```
[LLM V2] Evidence integrity validated successfully
```

Or warnings:
```
[LLM V2] Evidence integrity validation failed: [...]
```

## 🔍 Troubleshooting

### V1 Returns Errors
- **Check**: OpenAI API key is set
- **Check**: `OPENAI_MODEL` env variable (defaults to gpt-4o)
- **Test**: Run `npm run tsx scripts/test-v1.ts`

### V2 Returns Errors
- **Check**: Same as V1 (uses same OpenAI setup)
- **Check**: Validation logs for structure issues
- **Test**: Run `npm run compare-versions`
- **Fallback**: Set `DIAGNOSTIC_ANALYSIS_VERSION=v1`

### Evidence Validation Fails (V2)
- **Check**: Prompt section 6 (output format)
- **Check**: LLM is following evidenceEventIds rules
- **Note**: Validation only warns in dev, doesn't block

### Adapter Issues
- **Check**: `lib/llm-analysis-adapter.ts` mapping
- **Test**: Call `adaptV2ToV1()` manually with sample V2 data
- **Verify**: UI receives all expected V1 fields

## 📚 Deep Dive Documentation

For complete details, see:
- **Migration Guide**: `Doc/V2_MIGRATION.md`
- **Prompt Structure**: `Doc/V2_PROMPT_STRUCTURE.md`
- **Implementation Summary**: `Doc/V2_IMPLEMENTATION_SUMMARY.md`

## ✅ Checklist for Production Deploy

Before enabling V2 in production:

- [ ] Run `npm run compare-versions` on real data
- [ ] Manually review 5-10 V2 outputs
- [ ] Check parts linking accuracy
- [ ] Verify patterns have frequency ≥ 2
- [ ] Validate evidence integrity
- [ ] Test UI with V2 (via adapter)
- [ ] Set `DIAGNOSTIC_ANALYSIS_VERSION=v2` in staging
- [ ] Monitor staging for 24-48 hours
- [ ] Check error rates and response times
- [ ] Get user feedback on quality
- [ ] Document any issues found
- [ ] Plan rollback procedure

## 🚦 Migration Timeline

### Phase 1: Testing (Current)
- V2 implemented, V1 preserved
- Test locally with comparison tool
- Manual quality review

### Phase 2: Staging
- Deploy with V1 as default
- Enable V2 in staging environment
- Monitor logs and quality

### Phase 3: Gradual Rollout
- Enable V2 for 10% of users
- A/B test quality metrics
- Collect feedback

### Phase 4: Full Migration
- Enable V2 for all users
- Build dual-view UI
- Deprecate V1 (but keep for rollback)

## 💡 Best Practices

### When Working with V1
- ✅ Test changes immediately (V1 is production)
- ✅ Review logs before deploying
- ✅ Keep changes minimal and focused
- ⚠️ Don't break existing heuristics

### When Working with V2
- ✅ Test with comparison tool
- ✅ Validate evidence integrity
- ✅ Check adapter still works
- ✅ Compare quality with V1
- ⚠️ Preserve all V1 heuristics

### Prompt Engineering
- ✅ Document why you're changing something
- ✅ Test before committing
- ✅ Keep sections modular (easy to update)
- ⚠️ Don't remove V1 heuristics

## 🤝 Contributing

### Adding New Features to V2
1. Edit `lib/llm-prompt-v2.ts`
2. Update types in `lib/llm-analysis-v2.ts` if needed
3. Update adapter in `lib/llm-analysis-adapter.ts` if new fields
4. Test with `npm run compare-versions`
5. Document in prompt structure doc

### Fixing Issues
1. Identify if issue is in V1 or V2
2. Fix in appropriate file
3. Test the fixed version
4. Deploy (V1 fixes go live immediately, V2 only if flag is set)

### Improving Documentation
- Update `Doc/V2_MIGRATION.md` for process changes
- Update `Doc/V2_PROMPT_STRUCTURE.md` for prompt changes
- Update this README for developer workflow changes

## 📞 Support

For questions or issues:
1. Check logs for `[LLM V2]` and `[Analysis Config]` messages
2. Run comparison tool to diagnose: `npm run compare-versions`
3. Review documentation in `Doc/` folder
4. Check API response `_analysisVersion` field

---

**Last Updated**: December 10, 2024
**Version**: V2.0.0
**Status**: Ready for Testing


