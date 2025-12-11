# Developer Testing Page

## Overview

The Developer Testing page provides a side-by-side comparison tool for V1 and V2 diagnostic analysis outputs.

## Access

Navigate to **Developer Testing** in the sidebar menu, or go directly to `/developer-testing`.

## Features

### 1. Country Selection (Sidebar)
- **Location**: In the sidebar, same as main app
- **Options**: FR (France), UK (United Kingdom), BE (Belgium)
- **Effect**: Filters available buildings
- **Persistence**: Selection stays consistent across testing

### 2. Unit Selection
- **Building**: Search and select from available buildings (filtered by country)
- **Device**: Search and select from available devices (filtered by building)
- **Context**: Optional context (e.g., "Last 30 days")

### 2. Parallel Analysis
The page runs **both V1 and V2 analyses simultaneously** on the same data:
- Forces V1 analysis using `_forceVersion: 'v1'` parameter
- Forces V2 analysis using `_forceVersion: 'v2'` parameter
- Runs both analyses in parallel for speed
- Uses same country context as main app

### 3. Side-by-Side Display
- **Left Column**: V1 output (original monolithic analysis)
- **Right Column**: V2 output (structured evidence-based analysis)
- Each column has independent scrolling
- JSON output formatted for readability

## How It Works

### Frontend (`app/developer-testing/page.tsx`)
1. User selects country from sidebar (same as main app)
2. User searches and selects building (filtered by country)
3. User searches and selects device (filtered by building)
4. User optionally adds context
5. User clicks "Run V1 vs V2 Comparison"
6. Frontend makes **two API calls**:
   - First call with `_forceVersion: 'v1'`
   - Second call with `_forceVersion: 'v2'`
7. Displays both results in side-by-side columns

**Key Implementation Details**:
- Uses SWR for data fetching (same as main app)
- Single endpoint `/api/buildings?country=XX` returns both buildings and devices
- Searchable dropdowns with click-outside-to-close behavior
- Country selection resets building and device selection

### Backend (`app/api/diagnostic/analyze/route.ts`)
1. Receives `_forceVersion` parameter
2. Temporarily overrides `DIAGNOSTIC_ANALYSIS_VERSION` environment variable
3. Calls `generateDiagnosticAnalysis()` with forced version
4. Restores original environment variable
5. Returns analysis with `_analysisVersion` field

### Version Forcing
```typescript
// In API request body
{
  unitId: "123",
  unitName: "Lift A",
  // ... other fields
  _forceVersion: "v1" // or "v2"
}
```

The API then:
```typescript
const forcedVersion = _forceVersion === 'v1' || _forceVersion === 'v2' ? _forceVersion : null
const version = forcedVersion || getAnalysisVersion()

// Temporarily override for this request
if (forcedVersion) {
  const originalEnv = process.env.DIAGNOSTIC_ANALYSIS_VERSION
  process.env.DIAGNOSTIC_ANALYSIS_VERSION = forcedVersion
  // ... run analysis ...
  // Restore original
}
```

## What to Check

### 1. Structure Validation
- **V1**: Should have `executiveSummary`, `partsReplaced`, `timeline`, etc.
- **V2**: Should have `coreAnalysis`, `operationalAnalysis`, `technicalAnalysis`

### 2. Parts Linking
- Count should match or V2 should be better
- Check `confidence` levels in V2
- Verify `linkedVisitEventId` and `linkedBreakdownEventId` are present

### 3. Patterns
- Both should have similar patterns
- All patterns should have `frequency >= 2`
- V2 patterns should have `evidenceEventIds`

### 4. Causality
- V1: Check if `executiveSummary` mentions causal relationships
- V2: Check `causality` field in timeline events
- V2: Check `causality` in operational narrative timeline

### 5. Evidence Integrity (V2 only)
- All `evidenceEventIds` should reference valid `eventId` from `coreAnalysis.timeline`
- Hypotheses should have at least 2 evidence events
- No broken references

### 6. Language Quality
- **V1**: Mixed technical and plain language
- **V2 Operational**: Plain language, no jargon
- **V2 Technical**: Technical language with depth

## Use Cases

### 1. Quality Assurance
Compare outputs to ensure V2 preserves V1 quality:
- Same parts identified?
- Similar patterns detected?
- Causality preserved?

### 2. Debugging
If V2 produces unexpected results:
- Run side-by-side comparison
- Identify where V2 diverges from V1
- Check evidence integrity
- Review prompt sections

### 3. Prompt Engineering
When updating V2 prompt:
1. Run comparison before changes
2. Make prompt changes in `lib/llm-prompt-v2.ts`
3. Run comparison again
4. Verify improvements without regressions

### 4. A/B Testing
Compare analysis quality:
- Parts linking accuracy
- Pattern detection depth
- Causality explanation clarity
- Customer summary readability

## Tips

### Scrolling
- Each column scrolls independently
- Use `Ctrl+F` (or `Cmd+F`) to search within JSON
- Collapse/expand JSON sections manually if needed

### Performance
- Both analyses run in parallel
- Total time: ~30-60 seconds
- V1 and V2 typically take similar time

### Data Selection
For best comparison results:
- Choose units with rich history (visits, breakdowns, parts)
- Use consistent context (e.g., always "Last 30 days")
- Test on various unit types (high activity vs low activity)

### Interpreting Results

#### Parts Count Difference
- **V2 Higher**: V2 improved parts linking (good)
- **V1 Higher**: V2 missed parts (investigate comment analysis)
- **Same**: Expected behavior

#### Pattern Count Difference
- **V2 Higher**: V2 detected more patterns (good if valid)
- **V1 Higher**: V2 filtered out patterns with frequency < 2 (expected)
- **Same**: Expected behavior

#### Output Size
- **V2 Larger**: More structured data (expected)
- **V2 Much Larger**: Check for evidence duplication
- **V2 Smaller**: Check if data is missing

## Limitations

1. **UI Only Shows JSON**: No visual comparison of specific fields
   - **Workaround**: Use `Ctrl+F` to search for specific keys

2. **No Diff Highlighting**: Can't see exact differences
   - **Workaround**: Copy both outputs to a diff tool

3. **No History**: Can't save or compare previous runs
   - **Workaround**: Copy JSON to external file

4. **No Metrics**: No automatic quality scoring
   - **Workaround**: Manual review using checklist

## Future Enhancements

Potential improvements (not yet implemented):

1. **Visual Diff**: Highlight differences between V1 and V2
2. **Field-Level Comparison**: Compare specific fields (parts, patterns, etc.)
3. **Metrics Dashboard**: Automatic quality scoring
4. **History Tracking**: Save and compare multiple runs
5. **Export**: Download comparison results as JSON/PDF
6. **Batch Testing**: Run comparison on multiple units
7. **Evidence Visualization**: Click eventIds to see raw data

## Troubleshooting

### Both Analyses Fail
- Check OpenAI API key is set
- Check Looker API credentials
- Verify unit exists in database

### Only V2 Fails
- Check V2 prompt syntax in `lib/llm-prompt-v2.ts`
- Review logs for `[LLM V2]` error messages
- Validate evidence integrity

### Results Look Identical
- Check if adapter is being applied to V2
- Verify `_forceVersion` parameter is working
- Check logs for version indicators

### Page Won't Load
- Check for React errors in browser console
- Verify `/api/looker/buildings` endpoint works
- Check authentication (sign in required)

## Security Note

This page is for **internal development only**. It:
- Requires authentication (same as main app)
- Forces specific analysis versions (bypasses feature flag)
- Should not be exposed in production without additional access controls

Consider adding role-based access (admin/developer only) before production deployment.

## Related Documentation

- **V2_MIGRATION.md**: Full migration guide
- **V2_PROMPT_STRUCTURE.md**: Prompt engineering details
- **V2_README.md**: Quick start for developers
- **V2_IMPLEMENTATION_SUMMARY.md**: Technical implementation

---

**Created**: December 10, 2024
**Purpose**: V1 vs V2 comparison for quality assurance and debugging

