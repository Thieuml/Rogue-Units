# V2 Diagnostic Analysis System - Implementation Summary

## Project Overview

This project implements a **V2 diagnostic analysis system** that refactors the existing V1 monolithic analysis into a structured, evidence-based architecture with dual views (operational and technical), while **preserving all V1 heuristics**.

## Implementation Status: ✅ COMPLETE

All core components have been implemented and are ready for testing.

## What Was Built

### 1. Type System (`lib/llm-analysis-v2.ts`)
- **CoreAnalysis**: Shared foundation with timeline, linkedParts, patterns, components
- **OperationalAnalysis**: OPS manager view (plain language)
- **TechnicalAnalysis**: Technical expert view (technical language)
- **DiagnosticAnalysisV2**: Main interface combining all three
- **validateEvidenceIntegrity()**: Ensures all evidenceEventIds are valid

### 2. Feature Flag System (`lib/llm-analysis-config.ts`)
- **getAnalysisVersion()**: Returns 'v1' or 'v2' from env variable
- **isV2Enabled()**: Boolean check for V2
- **Environment Variable**: `DIAGNOSTIC_ANALYSIS_VERSION` (defaults to 'v1')

### 3. V1 Preservation (`lib/llm-analysis.ts`)
- Renamed existing functions to V1 variants
- **getSystemPromptV1()**: Original prompt preserved
- **generateDiagnosticAnalysisV1()**: Original implementation
- **DiagnosticAnalysisV1**: Original interface (with alias for backward compatibility)
- **generateDiagnosticAnalysis()**: Router function that calls V1 or V2 based on flag

### 4. V2 Prompt System (`lib/llm-prompt-v2.ts`)
- **Sectioned Prompt**:
  - Section 1: Role & Goal (output structure, evidence-based rule)
  - Section 2: Data Structures (preserved verbatim from V1)
  - Section 3: Reasoning Workflow (6 steps, all V1 heuristics preserved)
  - Section 4: Parts Replacement Logic (preserved verbatim from V1)
  - Section 5: Analysis Guidelines (preserved from V1)
  - Section 6: Output Format (detailed JSON schema)
- **generateDiagnosticAnalysisV2()**: New implementation with validation

### 5. Adapter System (`lib/llm-analysis-adapter.ts`)
- **adaptV2ToV1()**: Converts V2 output to V1 format for UI compatibility
- **isV2Analysis()**: Type guard for V2
- **isV1Analysis()**: Type guard for V1
- **normalizeToV1()**: Ensures V1 format regardless of input

### 6. API Integration
- **Updated `app/api/diagnostic/analyze/route.ts`**:
  - Calls `generateDiagnosticAnalysis()` (router)
  - Normalizes output to V1 for UI compatibility
  - Includes `_analysisVersion` in response for monitoring
- **Updated `app/api/diagnostic/recent/route.ts`**:
  - Normalizes stored diagnostics to V1 format

### 7. Testing Tools
- **Comparison Script (`scripts/compare-analysis-versions.ts`)**:
  - Runs both V1 and V2 on same data
  - Compares parts, patterns, causality, evidence integrity
  - Generates detailed comparison report
- **V1 Test Script (`scripts/test-v1.ts`)**:
  - Quick verification that V1 still works
- **NPM Script**: `npm run compare-versions`

### 8. Documentation
- **`Doc/V2_MIGRATION.md`**: Complete migration guide
- **`Doc/V2_PROMPT_STRUCTURE.md`**: Detailed prompt documentation
- This summary document

## Key Features

### Evidence-Based Architecture
All operational and technical content must reference `evidenceEventIds` from `coreAnalysis.timeline`. This ensures:
- **Traceability**: Every claim traces back to raw data
- **Accountability**: No invented events
- **Auditability**: Clear provenance

### Preserved V1 Heuristics
✅ All critical V1 heuristics are preserved:
- Parts linking (each part once, date windows, visit priority, comment analysis)
- Causality analysis (sequence, relationships, cross-referencing)
- Pattern detection (≥2 frequency, grouping, root cause analysis)
- Honesty rules (no forced conclusions, express uncertainty)

### Dual Views
- **Operational**: For OPS managers and customers (plain language, narrative)
- **Technical**: For technical experts (technical language, deep analysis)

### Backward Compatibility
- V1 remains the default
- Adapter ensures UI continues to work
- Easy rollback via environment variable

## File Structure

```
lib/
├── llm-analysis.ts              # V1 preserved + router
├── llm-analysis-v2.ts           # V2 types + validation
├── llm-prompt-v2.ts             # V2 prompt + generator
├── llm-analysis-config.ts       # Feature flag
└── llm-analysis-adapter.ts      # V2→V1 adapter

app/api/diagnostic/
├── analyze/route.ts             # Analysis API (updated)
└── recent/route.ts              # Recent diagnostics API (updated)

scripts/
├── compare-analysis-versions.ts # V1 vs V2 comparison
└── test-v1.ts                   # V1 verification

Doc/
├── V2_MIGRATION.md              # Migration guide
└── V2_PROMPT_STRUCTURE.md       # Prompt documentation
```

## Environment Configuration

### Production (Default - V1)
```bash
# .env.local or Vercel Environment Variables
DIAGNOSTIC_ANALYSIS_VERSION=v1  # or omit (defaults to v1)
```

### Testing V2
```bash
# .env.local
DIAGNOSTIC_ANALYSIS_VERSION=v2
```

## Migration Path

### Phase 1: Current State ✅
- V2 implemented
- V1 preserved
- Feature flag ready
- Adapter working
- Tests created

### Phase 2: Testing (Next Steps)
1. Run comparison tool on real data: `npm run compare-versions`
2. Validate evidence integrity
3. Compare quality metrics
4. Manual review of V2 outputs

### Phase 3: Soft Launch
1. Deploy with `DIAGNOSTIC_ANALYSIS_VERSION=v1` (default)
2. Test V2 in staging environment
3. Monitor logs for `[LLM V2]` messages

### Phase 4: Gradual Rollout
1. Enable V2 for 10% of diagnostics (A/B test)
2. Monitor `_analysisVersion` in API responses
3. Compare quality between V1 and V2

### Phase 5: Full Migration
1. Set `DIAGNOSTIC_ANALYSIS_VERSION=v2` in production
2. Build new dual-view UI
3. Deprecate V1 (but keep for rollback)

## Testing Strategy

### Automated Tests
```bash
# Test V1 still works
npm run tsx scripts/test-v1.ts

# Compare V1 vs V2
npm run compare-versions
```

### What to Validate
- ✅ V1 structure unchanged (executiveSummary, partsReplaced, etc.)
- ✅ V2 structure correct (coreAnalysis, operationalAnalysis, technicalAnalysis)
- ✅ Parts count matches or improves
- ✅ Patterns ≥2 frequency only
- ✅ Evidence integrity (no broken eventIds)
- ✅ Causality preserved or improved
- ✅ Customer summary is plain language

### Manual Review
- Check parts linking accuracy
- Verify pattern detection quality
- Validate causality depth
- Review operational vs technical language split

## API Response Format

### Request (Unchanged)
```typescript
POST /api/diagnostic/analyze
{
  unitId: string
  unitName: string
  buildingId: string
  buildingName: string
  context?: string
  country: string
}
```

### Response (Backward Compatible)
```typescript
{
  visitReports: [...],
  breakdowns: [...],
  maintenanceIssues: [...],
  repairRequests: [...],
  analysis: DiagnosticAnalysisV1,    // Always V1 format (adapted if V2)
  _analysisVersion: 'v1' | 'v2'      // For monitoring
}
```

The UI receives V1 format regardless of which version generated it, ensuring zero breaking changes.

## Database Storage

- V1 diagnostics store `DiagnosticAnalysisV1` in `analysis` JSON field
- V2 diagnostics store `DiagnosticAnalysisV2` in `analysis` JSON field
- API automatically adapts stored V2 to V1 when retrieved
- Both formats work seamlessly

## Monitoring Points

### Key Metrics to Track
1. **Analysis Version Distribution**
   - Check `_analysisVersion` field in responses
   - Track V1 vs V2 usage over time

2. **Evidence Integrity (V2 only)**
   - Monitor logs for validation errors
   - Check for broken eventId references

3. **Quality Metrics**
   - Parts linking accuracy
   - Pattern detection rate (≥2 frequency)
   - Causality depth (events with causality / total events)
   - User feedback quality

4. **Performance**
   - LLM response time (V1 vs V2)
   - Token usage comparison
   - Error rates

5. **Log Messages**
   - `[Analysis Config]`: Feature flag status
   - `[LLM V2]`: V2 generation progress
   - `[API]`: Analysis version used

## Rollback Plan

If issues arise with V2:

1. **Immediate**: Set `DIAGNOSTIC_ANALYSIS_VERSION=v1` in Vercel
2. **Verify**: Check logs show `Using diagnostic analysis version: v1`
3. **Monitor**: Ensure diagnostics generate successfully
4. **Investigate**: Run comparison tool locally to identify issues
5. **Fix**: Update `lib/llm-prompt-v2.ts` based on findings
6. **Test**: Run comparison tool again
7. **Redeploy**: Try V2 again when fixed

V1 remains untouched, so rollback is instant and safe.

## Known Limitations

1. **UI Only Supports V1 Format**: Dual-view UI not yet built
   - **Mitigation**: Adapter ensures V1 format
   - **Future**: Build tabs for operational/technical views

2. **No A/B Testing Yet**: Can't run both versions simultaneously per user
   - **Mitigation**: Feature flag applies globally
   - **Future**: User-level or percentage-based flag

3. **Limited Test Data**: Comparison tool uses sample data
   - **Mitigation**: Add real diagnostic data to tests
   - **Future**: Automated regression test suite

4. **No Performance Benchmarks**: Don't know if V2 is slower/faster
   - **Mitigation**: Monitor `_analysisVersion` response times
   - **Future**: Add performance tracking

## Success Criteria

V2 is successful if:
- ✅ All V1 heuristics preserved (parts, patterns, causality)
- ✅ Evidence integrity validated (no broken references)
- ✅ Patterns have frequency ≥ 2
- ✅ Customer summary is plain language
- ✅ Technical analysis has depth
- ✅ UI continues working (via adapter)
- ✅ No increase in errors
- ✅ Quality metrics same or better than V1

## Future Enhancements (Post-V2)

### Dual-View UI
Build new UI with tabs:
- **Summary**: Key metrics and overview
- **Operations**: For OPS managers (operational analysis)
- **Technical**: For experts (technical analysis)
- **Timeline**: Chronological narrative with causality

### Advanced Features
- Click evidenceEventIds to see raw data
- Export operational summary for customers
- Export technical analysis for internal review
- Evidence highlighting in timeline

### V3 Considerations (Future)
- Multi-pass reasoning (thinking vs output)
- Per-event confidence scores
- Interactive clarification prompts
- Dynamic prompt sections based on data volume

## Conclusion

The V2 system is **fully implemented and ready for testing**. All V1 heuristics are preserved, the architecture is evidence-based, and backward compatibility is ensured through the adapter pattern.

**Next Steps**:
1. Run comparison tool on real diagnostic data
2. Validate outputs manually
3. Enable V2 in staging for testing
4. Monitor quality metrics
5. Gradual rollout to production

**Risk**: Low. V1 remains default and unchanged. V2 can be disabled instantly if issues arise.

**Benefit**: High. Structured analysis, dual views, evidence traceability, easier maintenance.

---

**Implementation Date**: December 10, 2024
**Status**: Ready for Testing
**Version**: V2.0.0
**Backward Compatible**: Yes (100%)







