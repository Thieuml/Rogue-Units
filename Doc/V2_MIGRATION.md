# V2 Diagnostic Analysis System - Migration Guide

## Overview

The V2 diagnostic analysis system is a major refactoring that preserves all V1 heuristics while introducing a structured, evidence-based architecture with dual views (operational and technical).

## Architecture Changes

### V1 Architecture (Monolithic)
```
Input Data → LLM Prompt → Single Analysis → UI Display
```

### V2 Architecture (Layered)
```
Input Data → LLM Prompt V2 → {
  coreAnalysis (foundation)
    ↓
  ├─→ operationalAnalysis (OPS managers)
  └─→ technicalAnalysis (Technical experts)
} → UI Display
```

## Key Features

### 1. Core Analysis (Foundation)
- **Purpose**: Single source of truth for all diagnostic data
- **Contains**:
  - Timeline with unique eventIds
  - Linked parts with confidence levels
  - Patterns (frequency ≥ 2)
  - Component aggregations
- **Language**: Technical

### 2. Operational Analysis (OPS View)
- **Purpose**: For operations managers and customer-facing communication
- **Contains**:
  - Narrative timeline (plain language)
  - Customer summary (3-4 sentences, no jargon)
  - Action log (what was done, by whom, outcome)
  - Current status with next steps
- **Language**: Plain language, no jargon
- **Constraint**: Must reference evidenceEventIds from coreAnalysis

### 3. Technical Analysis (Expert View)
- **Purpose**: For technical experts and deep diagnostics
- **Contains**:
  - Patterns with technical details
  - Component diagnostics
  - Hypotheses (must have ≥2 evidence events)
  - Suggested checks
  - Confidence level
- **Language**: Technical
- **Constraint**: Must reference evidenceEventIds from coreAnalysis

## Evidence-Based Architecture

**Critical Rule**: All operational and technical content must reference `evidenceEventIds` from `coreAnalysis.timeline`.

This ensures:
- Traceability: Every claim can be traced back to raw data
- Accountability: No invented events or patterns
- Auditability: Clear provenance for all analysis

## Preserved V1 Heuristics

All critical V1 heuristics are preserved in V2:

### Parts Linking
- ✅ Each part appears exactly once
- ✅ Replacement date window logic (requestedDate to stateStartDate)
- ✅ Visit linking priority (REPAIR + comments > REPAIR > other + comments > closest)
- ✅ Comment analysis (action words + part keywords)
- ✅ Component derivation priority

### Causality Analysis
- ✅ Chronological sequence understanding
- ✅ Causal relationship identification
- ✅ Visit comment analysis during breakdowns
- ✅ Cross-referencing patterns

### Pattern Detection
- ✅ Only patterns with frequency ≥ 2
- ✅ Grouping by component/problem/origin/time
- ✅ Root cause/impact/escalation/correlation analysis

### Honesty Rules
- ✅ Don't force conclusions
- ✅ Express uncertainty
- ✅ Don't invent data

## Migration Path

### Phase 1: Development (Week 1)
- [x] Create V2 types and prompt
- [x] Implement feature flag
- [x] Build comparison tool
- [x] Update API routes with adapter

### Phase 2: Testing (Week 2)
- [ ] Run comparison tests on real diagnostic data
- [ ] Validate evidence integrity
- [ ] Fix discrepancies
- [ ] Manual review of V2 outputs

### Phase 3: Soft Launch (Week 3)
- [ ] Deploy with `DIAGNOSTIC_ANALYSIS_VERSION=v1` (default)
- [ ] Test V2 in staging
- [ ] Compare quality metrics

### Phase 4: Gradual Rollout (Week 4)
- [ ] Enable V2 for 10% of diagnostics
- [ ] Monitor for issues
- [ ] A/B test quality

### Phase 5: Full Migration (Week 5+)
- [ ] Enable V2 for all (`DIAGNOSTIC_ANALYSIS_VERSION=v2`)
- [ ] Build new dual-view UI
- [ ] Deprecate V1

## Feature Flag Usage

### Environment Variable
```bash
# .env.local
DIAGNOSTIC_ANALYSIS_VERSION=v1  # Default (current behavior)
# or
DIAGNOSTIC_ANALYSIS_VERSION=v2  # New structured analysis
```

### In Code
```typescript
import { getAnalysisVersion, isV2Enabled } from '@/lib/llm-analysis-config'

const version = getAnalysisVersion() // 'v1' or 'v2'
const isV2 = isV2Enabled() // boolean
```

## Adapter Pattern

The adapter pattern allows V2 to run while the UI still expects V1 format:

```typescript
import { normalizeToV1 } from '@/lib/llm-analysis-adapter'

// Generate V2 analysis
const analysisV2 = await generateDiagnosticAnalysis(data)

// Convert to V1 for UI compatibility
const analysisV1 = normalizeToV1(analysisV2)
```

This enables:
- Running V2 in production before UI changes
- Gradual migration
- Easy rollback if issues arise

## Testing

### Comparison Tool
```bash
npm run compare-versions
```

This tool:
1. Runs both V1 and V2 on sample data
2. Compares:
   - Parts count and details
   - Patterns (≥2 frequency)
   - Causality analysis
   - Evidence integrity
3. Generates detailed comparison report

### What to Check
- ✅ Part counts match (or V2 has better linking)
- ✅ Pattern frequencies are similar
- ✅ Causality is preserved or improved
- ✅ No broken evidenceEventIds in V2
- ✅ Hypotheses have ≥2 evidence events
- ✅ Customer summary is plain language
- ✅ Technical details are preserved

## API Changes

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
  analysis: DiagnosticAnalysisV1, // Always V1 format (adapted if needed)
  _analysisVersion: 'v1' | 'v2'   // For monitoring
}
```

The response always returns V1 format (via adapter) to maintain UI compatibility during transition.

## Database Storage

### Storage Format
- V1 diagnostics store `DiagnosticAnalysisV1`
- V2 diagnostics store `DiagnosticAnalysisV2`
- The `analysis` field in Prisma accepts both (JSON)

### Retrieval
- API automatically adapts stored V2 to V1 for UI
- Both formats work seamlessly

## Monitoring

### What to Monitor
1. **Analysis Version Distribution**
   - Track `_analysisVersion` in responses
   - Monitor V1 vs V2 usage

2. **Evidence Integrity (V2)**
   - Check for broken eventId references
   - Validate hypothesis evidence counts

3. **Quality Metrics**
   - Parts linking accuracy
   - Pattern detection rate
   - Causality depth
   - User feedback

4. **Performance**
   - LLM response time (V1 vs V2)
   - Token usage
   - Error rates

## Rollback Plan

If issues arise:

1. **Immediate**: Set `DIAGNOSTIC_ANALYSIS_VERSION=v1`
2. **Redeploy**: Push updated .env to Vercel
3. **Investigate**: Use comparison tool to identify issues
4. **Fix**: Update V2 prompt or types
5. **Retry**: Test in staging before re-enabling

## Future: Dual-View UI

Once V2 is stable, build new UI with:

### Tabs
- **Summary**: Overview with key metrics
- **Operations View**: For OPS managers (from operationalAnalysis)
- **Technical View**: For experts (from technicalAnalysis)
- **Timeline**: Combined narrative timeline

### Features
- Toggle between operational and technical language
- Click on evidence links to see raw data
- Export operational summary for customers
- Export technical analysis for internal review

## FAQ

### Q: Will V2 change existing diagnostics?
**A**: No. V1 remains default until you explicitly enable V2.

### Q: Can I run both V1 and V2 simultaneously?
**A**: Yes, using A/B testing on the feature flag. Store both versions and compare.

### Q: What if V2 generates invalid JSON?
**A**: The system validates structure and falls back gracefully. Monitor logs.

### Q: How do I know if V2 is working correctly?
**A**: Run `npm run compare-versions` to see detailed comparison.

### Q: Will the UI break if I enable V2?
**A**: No. The adapter ensures V1 format is always returned to the UI.

### Q: How do I update the V2 prompt?
**A**: Edit `lib/llm-prompt-v2.ts`. V1 remains unchanged for safety.

### Q: Can I revert to V1 quickly?
**A**: Yes. Just set `DIAGNOSTIC_ANALYSIS_VERSION=v1` and redeploy.

## Support

For issues or questions:
1. Check logs for `[LLM V2]` messages
2. Run comparison tool to diagnose
3. Review evidence integrity validation
4. Check API response `_analysisVersion` field

## Version History

- **V1**: Original monolithic analysis (current production)
- **V2**: Structured evidence-based analysis with dual views (new)







