# ML Prompt Extract: Part Replacement Date Identification & Visit Linking

This document extracts the specific prompt instructions for identifying part replacement dates and linking them to visits.

## 1. Core Logic: Parts Replacement Date & Visit Linking

**Location:** Lines 103-109 in `lib/llm-analysis.ts`

```
2. **Link Parts ↔ Visits ↔ Breakdowns Using Date Rules:**
   - **CRITICAL: Each part appears ONCE only in partsReplaced array. Never create duplicate entries for the same part.**
   - **Parts Replacement Date:** Primary = repair request stateStartDate when status = DONE and hasPartAttached = true. If multiple visits have completedDate within 3 days before or on that date, select ONE visit only using this priority: (1) REPAIR visit type, (2) closest date to replacement date. Set linkedToVisit to the selected visit date and update replacementDate to that visit date. If no visit matches, leave linkedToVisit empty.
   - **Parts ↔ Breakdowns:** Link part to most recent breakdown on same/related component that ended +/- 2 days before replacement date (or ongoing at replacement time).
   - **Parts Component Derivation (priority order):** (1) Part name keywords ("door contact", "roller", "controller"), (2) Part family/sub-family, (3) Matching breakdown failureLocations or maintenance issue component.
   - **Breakdowns ↔ Visits:** Find visits during breakdown period (visit date between breakdown startTime and endTime).
   - **Maintenance Issues ↔ Visits:** Find visits on same date or within 1 day.
```

## 2. Explicit Heuristics Section

**Location:** Lines 201-205 in `lib/llm-analysis.ts`

```
**Parts Replacement Logic (Explicit Heuristics):**
- **CRITICAL: Each unique part must appear exactly ONCE in partsReplaced array. Never create duplicate entries for the same part (same partName + repairRequestNumber).**
- **Replacement Date:** Primary = repair request stateStartDate when status = DONE and hasPartAttached = true. If multiple visits have completedDate within 3 days before or on that date, select ONE visit only using this priority: (1) REPAIR visit type, (2) closest date to replacement date. Set linkedToVisit to the selected visit date and update replacementDate to that visit date. If no visit matches, leave linkedToVisit empty.
- **Breakdown Link:** Link part to most recent breakdown on same/related component that ended +/- 2 days before replacement date (or ongoing at replacement time).
- **Component Derivation (priority order):** (1) Part name keywords ("door contact", "roller", "controller"), (2) Part family/sub-family, (3) Matching breakdown failureLocations or maintenance issue component.
```

## 3. Output Format Specification

**Location:** Lines 277-288 in `lib/llm-analysis.ts`

```json
"partsReplaced": [
  {
    "partName": "Name of the part",
    "partFamily": "Family category",
    "partSubFamily": "Sub-family category",
    "replacementDate": "YYYY-MM-DD (from state_start_date_date when status is DONE)",
    "repairRequestNumber": "Request number",
    "component": "Component impacted (derived from part name/family)",
    "linkedToVisit": "Date of ONE related visit if applicable (prioritize REPAIR visits, then closest date; leave empty if no match)",
    "linkedToBreakdown": "Breakdown ID if applicable"
  }
]
```

## 4. Critical Rules

**Location:** Lines 323-327 in `lib/llm-analysis.ts`

```
**CRITICAL RULES FOR partsReplaced:**
- Each unique part (identified by partName + repairRequestNumber) must appear exactly ONCE in partsReplaced array
- Never create duplicate entries for the same part
- Each part links to at most ONE visit (prioritize REPAIR visits, then closest date)
- If multiple visits match, select only the best one using priority rules
```

## 5. Data Source: Repair Requests

**Location:** Lines 186-199 in `lib/llm-analysis.ts`

```
**Repair Requests / Parts Requests:**
These are requests raised by engineers to get parts or technical support. Each request includes:
- Repair Request Number: Unique identifier
- Requested Date: When the request was created
- Description: Engineer's description of what is needed
- Status: Current status (e.g., DONE, IN_PROGRESS, etc.)
- State Start Date: When the request moved to this status (if DONE, this is the completion date)
- Has Tech Support: Whether technical expert support was requested
- Is Chargeable: Whether cost incurs to customer
- Has Part Attached: Whether parts were requested
- Item Type: Type of item requested (part, external_part, Tech support, etc.)
- Part Name: Name of the part (if part was requested)
- Part Family: Family category of the part
- Part Sub Family: Sub-family category of the part
```

## Summary: Key Rules for Part Replacement Date & Visit Linking

### Replacement Date Identification:
1. **Primary source:** `repairRequest.stateStartDate` when `status = DONE` AND `hasPartAttached = true`
2. This date represents when the repair request was completed (part was attached/delivered)

### Visit Linking Logic:
1. **Search window:** Find visits with `completedDate` within **3 days before or on** the replacement date
2. **Selection priority** (if multiple visits match):
   - **Priority 1:** REPAIR visit type
   - **Priority 2:** Closest date to replacement date
3. **Action:** Set `linkedToVisit` to the selected visit date AND update `replacementDate` to match that visit date
4. **Fallback:** If no visit matches within the 3-day window, leave `linkedToVisit` empty

### Critical Constraints:
- Each part (identified by `partName + repairRequestNumber`) appears **exactly ONCE** in the array
- Each part links to **at most ONE visit**
- Never create duplicate entries for the same part





