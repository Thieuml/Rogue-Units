# V2 Prompt Structure Documentation

## Overview

The V2 prompt is a complete restructuring of the V1 prompt that preserves all heuristics while introducing clear sections and evidence-based constraints.

## Prompt Architecture

### Section 1: Role & Goal
**Purpose**: Define the task and output structure

**Key Elements**:
- Introduces the diagnostic engine role
- Specifies the three-key JSON structure requirement
- **Critical Rule**: Evidence-based constraint
  - All operational/technical content must reference evidenceEventIds
  - Never invent events not in coreAnalysis

**Output**:
```json
{
  "coreAnalysis": { ... },
  "operationalAnalysis": { ... },
  "technicalAnalysis": { ... }
}
```

### Section 2: Data Structures
**Purpose**: Explain input data formats

**Content** (preserved verbatim from V1):
- Visit Reports structure and fields
- CRITICAL: Global Comments analysis emphasis
- Breakdowns/Downtimes structure
- Maintenance Issues structure
- Repair Requests structure

**Why Preserved**:
- This documentation is foundational for understanding the data
- Engineers rely on this to write accurate prompts
- Changes here would break data interpretation

**Lines from V1**: 153-217

### Section 3: Reasoning Workflow
**Purpose**: Step-by-step analysis process

**Steps** (all preserved from V1):

#### Step 1: Build Chronological Event List
- Combine all events from visits, breakdowns, maintenance issues, repair requests
- Sort by date/time
- Assign unique eventIds (new in V2)
- Forms foundation for coreAnalysis.timeline

#### Step 2: Link Parts ↔ Visits ↔ Breakdowns
**CRITICAL HEURISTICS** (all preserved):
- Each part appears ONCE only
- Replacement date window (requestedDate to stateStartDate)
- Visit linking priority:
  1. REPAIR + action words + part keywords (highest confidence)
  2. REPAIR without clear indicators
  3. Other visit + action words + part keywords
  4. Closest date
- Comment analysis (action words + part type keywords)
- Breakdown linking (±2 days, same component)
- Component derivation priority
- Assign unique partIds (new in V2)

#### Step 3: Detect Patterns
**PRESERVED RULES**:
- Only patterns with frequency ≥ 2
- Group by component/problem/origin/time
- Analyze root cause, impact, escalation, correlation
- Assign unique patternIds (new in V2)
- Record evidenceEventIds (new in V2)

#### Step 4: Generate coreAnalysis (NEW)
Build the foundation with:
- timeline (all events with eventIds)
- linkedParts (all parts with partIds, links, confidence)
- patterns (all patterns with patternIds, evidenceEventIds)
- components (aggregations with references)

Use technical language. Single source of truth.

#### Step 5: Generate operationalAnalysis (NEW)
Derive from coreAnalysis:
- narrativeTimeline (plain language story with causality)
- customerSummary (3-4 sentences, no jargon)
- actionLog (what/when/who/outcome)
- currentStatus (status, summary, next steps)

All with evidenceEventIds. Use plain language.

#### Step 6: Generate technicalAnalysis (NEW)
Derive from coreAnalysis:
- patterns (technical details with evidenceEventIds)
- componentDiagnostics (issues, recommendations with evidenceEventIds)
- hypotheses (must have ≥2 evidenceEventIds)
- suggestedChecks
- confidenceLevel

Use technical language.

### Section 4: Parts Replacement Logic
**Purpose**: Explicit heuristics for parts linking

**Content** (preserved verbatim from V1):
- CRITICAL: Each part appears ONCE
- Replacement date window
- Visit linking priority (detailed)
- Comment analysis rules (action words + part keywords)
- High confidence match criteria
- Avoid false matches
- Replacement date assignment
- Breakdown link rules
- Component derivation

**Why Preserved**:
- This is the most refined heuristic from months of iteration
- Parts linking is critical for quality analysis
- Any change here risks breaking parts detection

**Lines from V1**: 219-234

### Section 5: Analysis Guidelines
**Purpose**: Quality and honesty rules

**Content** (preserved from V1):
- Analyze sequence and causalities (emphasis on chronology)
- Cross-reference breakdowns with visits
- Identify recurring patterns
- Use maintenance issues for root causes
- **For Repeated Patterns, go DEEPER**:
  - Analyze WHY (rootCause)
  - Assess IMPACT
  - Track ESCALATION
  - Find CORRELATIONS
  - Only include if frequency ≥ 2
- Be realistic about confidence
- **Express uncertainty** when data is incomplete
- Don't force conclusions

**Why Preserved**:
- These rules ensure honest, high-quality analysis
- Prevents LLM from over-claiming or inventing data
- Maintains trust with users

**Lines from V1**: 292-343

### Section 6: Output Format
**Purpose**: Define exact JSON structure

**NEW in V2**:
- Detailed JSON schema for three sections
- Field-by-field documentation
- Example values
- Constraints (e.g., frequency ≥ 2, evidenceEventIds required)

**Critical Output Rules**:
1. Return ONLY JSON (no markdown, no commentary)
2. ALL evidenceEventIds must be valid (from coreAnalysis.timeline)
3. ALL patterns must have frequency ≥ 2
4. ALL hypotheses must reference ≥ 2 evidenceEventIds
5. customerSummary must be plain language (no jargon)
6. Each part appears exactly once
7. Never invent events

## Evidence-Based Architecture

### The Evidence Chain

```
Raw Data
   ↓
coreAnalysis.timeline (eventIds assigned)
   ↓
operationalAnalysis (references eventIds)
   ↓
technicalAnalysis (references eventIds)
```

### Why Evidence-Based?

1. **Traceability**: Every claim traces back to raw data
2. **Accountability**: Can't invent facts
3. **Auditability**: Clear provenance
4. **Quality**: Forces LLM to work from facts
5. **Trust**: Users can verify claims

### Validation

The system validates evidence integrity:
- Check all evidenceEventIds exist in coreAnalysis.timeline
- Ensure hypotheses have ≥2 evidence events
- Warn if references are broken

## Comparison with V1

| Aspect | V1 | V2 |
|--------|----|----|
| **Structure** | Monolithic | Layered (3 sections) |
| **Evidence** | Implicit | Explicit with IDs |
| **Views** | Single | Dual (ops + tech) |
| **Traceability** | None | Full (eventIds) |
| **Language** | Mixed | Separated (plain vs tech) |
| **Heuristics** | All | All (preserved) |
| **Parts Logic** | Detailed | Same + confidence |
| **Patterns** | ≥2 frequency | Same + evidenceEventIds |
| **Causality** | Narrative | Structured + narrative |
| **Honesty** | Rules | Same rules |

## Prompt Size

- **V1**: ~800 lines
- **V2**: ~950 lines (15% larger due to structure docs)

The size increase is justified by:
- Clearer organization
- Better documentation
- Evidence requirements
- Dual-view specifications

## Token Usage

Expected token usage (GPT-4o):
- **Input**: ~3000-4000 tokens (prompt + data)
- **Output**: ~2000-3000 tokens (V2 is more structured but similar length)
- **Total**: ~5000-7000 tokens per diagnostic

V2 may use slightly more tokens due to:
- More structured output
- Evidence IDs
- Dual summaries

But this is offset by:
- Single LLM call (not multiple)
- More deterministic output (less retry)

## Prompt Iteration Strategy

### Preserving History

V1 went through many iterations. To preserve this knowledge:

1. **Never Delete V1**: Keep `getSystemPromptV1()` intact
2. **Version Comments**: Document major V2 changes
3. **Heuristic Comments**: Mark preserved V1 sections
4. **Git History**: Commit messages explain changes

### Future V2 Iterations

When updating V2:

1. **Test Against V1**: Run comparison tool before/after
2. **Document Changes**: Add comments explaining why
3. **Validate Evidence**: Ensure integrity checks pass
4. **A/B Test**: Compare quality metrics

### Sectional Updates

The modular structure allows updating sections independently:

- **Update data structures**: Only change Section 2
- **Update parts logic**: Only change Section 4
- **Update output format**: Only change Section 6

This reduces risk of breaking other parts.

## Common Issues and Solutions

### Issue 1: LLM invents events
**Solution**: Emphasize evidence-based rule in Role & Goal section

### Issue 2: Parts linked incorrectly
**Solution**: Review Section 4 heuristics, especially comment analysis

### Issue 3: Patterns with frequency = 1
**Solution**: Reinforce "≥2" rule in Sections 3, 5, and 6

### Issue 4: Broken evidenceEventIds
**Solution**: Add validation reminder in output format section

### Issue 5: Technical jargon in customer summary
**Solution**: Add examples of plain language in output format

### Issue 6: Missing causality
**Solution**: Emphasize causality in Sections 3 and 5

## Prompt Engineering Best Practices

Based on V1 → V2 migration:

1. **Preserve What Works**: Don't rewrite for the sake of it
2. **Structure First**: Organize before changing content
3. **Evidence-Based**: Always require references
4. **Explicit Rules**: State constraints clearly
5. **Examples Help**: Show expected output format
6. **Validate Output**: Check structure and evidence
7. **Iterate Carefully**: Test each change thoroughly
8. **Document Changes**: Future you will thank you

## Testing the Prompt

### Manual Tests
1. Run comparison tool on known diagnostics
2. Check parts linking accuracy
3. Verify pattern detection
4. Validate evidence integrity
5. Review causality depth

### Automated Tests
1. Structure validation (3 keys present)
2. Evidence validation (all IDs valid)
3. Pattern frequency check (all ≥2)
4. Hypothesis evidence check (all ≥2)
5. JSON parse test

### Quality Metrics
- Parts linking accuracy (% correct)
- Pattern detection rate
- Causality depth (avg links per event)
- Confidence calibration (do "high" confidence parts link correctly?)

## Version Control

### Prompt Versions
- `getSystemPromptV1()`: Original, preserved forever
- `getSystemPromptV2()`: New structured version

### Iteration Tracking
- Major changes: New function (e.g., `getSystemPromptV3()`)
- Minor tweaks: Update V2 with comments
- Emergency fixes: Update V2, note in git commit

### Rollback Strategy
- Keep previous version functions
- Feature flag controls which is used
- Easy rollback by changing flag

## Future Improvements

Potential V3 features (do NOT implement now):

1. **Multi-pass reasoning**: Separate thinking from output
2. **Confidence scoring**: Per-event confidence levels
3. **Interactive prompting**: Ask LLM for clarifications
4. **Dynamic sections**: Adjust prompt based on data volume
5. **Chain-of-thought**: Explicit reasoning traces

But remember: V2 already works. Iterate carefully.

## Conclusion

The V2 prompt is a restructuring, not a rewrite. Every V1 heuristic is preserved. The new structure provides:

- **Clarity**: Easier to understand and maintain
- **Evidence**: Traceable claims
- **Flexibility**: Dual views for different audiences
- **Quality**: Same rigor, better organization

When in doubt: Preserve V1 behavior. The prompt has been refined through real-world use. Respect that knowledge.


