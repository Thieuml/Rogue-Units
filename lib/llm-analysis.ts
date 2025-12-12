/**
 * LLM-based diagnostic analysis service
 */

import OpenAI from 'openai'
import { getAnalysisVersion } from './llm-analysis-config'
import type { DiagnosticAnalysisV2 } from './llm-analysis-v2'

// Clean and validate API key
const rawApiKey = process.env.OPENAI_API_KEY || ''
// Remove "Bearer " prefix if present, trim whitespace, and remove all whitespace
let apiKey = rawApiKey.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '')

if (!apiKey) {
  console.warn('[LLM] WARNING: OPENAI_API_KEY is not set. LLM analysis will fail.')
} else {
  // Validate API key format
  if (!apiKey.startsWith('sk-')) {
    console.warn('[LLM] WARNING: OPENAI_API_KEY does not start with "sk-". This may cause issues.')
  }
  // Log first and last few characters for debugging (not the full key)
  console.log('[LLM] OpenAI API key configured:', {
    length: apiKey.length,
    startsWith: apiKey.substring(0, 7),
    endsWith: apiKey.substring(apiKey.length - 4),
    hadBearerPrefix: /^Bearer\s+/i.test(rawApiKey),
    hadWhitespace: /\s/.test(rawApiKey),
  })
}

const openai = new OpenAI({
  apiKey: apiKey,
})

export interface DiagnosticData {
  unitId: string
  unitName: string
  buildingName: string
  visitReports: any[]
  breakdowns: any[]
  maintenanceIssues: any[]
  repairRequests: any[]
  faultLogs: any[]
  iotAlerts: any[]
  partsReplaced: any[]
  callbackFrequency?: number
  timeSinceLastMaintenance?: number
  context?: string
}

export interface DiagnosticAnalysisV1 {
  executiveSummary: {
    overview: string
    summaryOfEvents: string
    currentSituation: string
    serviceHandlingReview: string
  }
  finalExecSummary?: string
  partsReplaced: Array<{
    partName: string
    partFamily: string
    partSubFamily: string
    replacementDate: string
    repairRequestNumber: string
    component: string
    linkedToVisit?: string
    linkedToBreakdown?: string
  }>
  timeline: Array<{
    date: string
    type: 'visit' | 'fault' | 'alert' | 'part'
    description: string
  }>
  repeatedPatterns: Array<{
    pattern: string
    frequency: number
    examples: string[]
    summary?: string
    rootCause?: string
    impact?: string
    escalationPath?: string
    correlation?: string
  }>
  technicalSummary?: {
    overview: string
    patternDetails: Array<{
      patternName: string
      verdict: string
      quantifiedImpact: {
        rootCause: string
        breakdownCount: number
        timeSpan: string
        downtimeHours: string
        downtimePerEvent: string
        riskLevel: 'low' | 'medium' | 'high'
        riskRationale: string
      }
      driverTree: string
      actionableRecommendations: Array<{
        action: string
        timeframe: 'immediate' | 'within_24h' | 'within_week' | 'next_service'
        owner: 'technician' | 'engineer' | 'specialist'
        expectedOutcome: string
      }>
      resolutionProbability: {
        probability: string
        escalationPath: string
      }
    }>
  }
  hypotheses: Array<{
    category: string
    likelihood: 'low' | 'medium' | 'high'
    reasoning: string
  }>
  suggestedChecks: string[]
  confidenceLevel: 'low' | 'medium' | 'high'
}

// Backward compatibility alias
export type DiagnosticAnalysis = DiagnosticAnalysisV1

/**
 * Deduplicate parts in partsReplaced array (safety net if LLM ignores prompt)
 * Keep only the entry with the highest priority visit link for each unique part
 */
function deduplicatePartsReplaced(parts: DiagnosticAnalysisV1['partsReplaced']) {
  const seen = new Map<string, DiagnosticAnalysisV1['partsReplaced'][0]>()
  const duplicates: string[] = []
  
  for (const part of parts) {
    const key = `${part.partName}|${part.repairRequestNumber}`
    
    if (seen.has(key)) {
      // Duplicate found - keep the one with better visit link
      const existing = seen.get(key)!
      duplicates.push(`${part.partName} (RR: ${part.repairRequestNumber})`)
      
      // Priority: REPAIR visit > any visit > no visit
      // If both have visits, keep the one with linkedToVisit (means it matched criteria)
      if (!existing.linkedToVisit && part.linkedToVisit) {
        seen.set(key, part)
      } else if (existing.linkedToVisit && !part.linkedToVisit) {
        // Keep existing
      } else if (part.linkedToVisit && part.linkedToVisit.length > 0) {
        // Both have links - keep the one we found first (usually higher priority)
        // Or keep the one with earlier date if we want to prioritize that
      }
      // Otherwise keep existing (first found)
    } else {
      seen.set(key, part)
    }
  }
  
  return {
    parts: Array.from(seen.values()),
    removedCount: parts.length - seen.size,
    duplicates: duplicates,
  }
}

/**
 * Get the system prompt with all stable behavior instructions (V1)
 * This is the original prompt that has been refined through many iterations
 */
function getSystemPromptV1(): string {
  return `You are a technical expert analyzing lift diagnostic data. Generate a structured diagnostic summary in JSON format. Be concise, actionable, and focus on patterns and likely causes.

**Reasoning Workflow:**
Follow this strict workflow internally. You may think step-by-step, but only output the final JSON object.

1. **Build Chronological Event List (Internal - Do Not Output):**
   - Create a chronological timeline combining all events from:
     * Visit Reports (use completedDate)
     * Breakdowns (use startTime)
     * Repair Requests (use stateStartDate when status is DONE for parts replaced)
     * Maintenance Issues (use completedDate)
   - Sort all events by date/time to understand the sequence
   - This chronological list is for internal reasoning only - do not include it in your output

2. **Link Parts ↔ Visits ↔ Breakdowns Using Date Rules:**
   
   **CRITICAL PART REPLACEMENT RULES (Read First):**
   - Each unique part (identified by partName + repairRequestNumber) appears EXACTLY ONCE in partsReplaced array
   - Each part can link to AT MOST ONE visit (never multiple visits)
   - One part → One entry → One visit maximum
   - NEVER create multiple partsReplaced entries for the same part
   - NEVER link the same part to multiple visits
   
   **EXAMPLE OF CORRECT BEHAVIOR:**
   Given: Part "MEMCO model 280 box" from repair request RR-12345
   Found matching visits:
   - Oct 23: REPAIR visit, comment "Remplacement boîtier Memco" (HIGHEST confidence - has action word + part keyword)
   - Oct 22: Breakdown visit, comment "Coffret de porte en défaut" (Lower confidence - no replacement action)
   
   ✅ CORRECT OUTPUT (Do this):
   {
     "partsReplaced": [
       {
         "partName": "MEMCO model 280 box",
         "repairRequestNumber": "RR-12345",
         "replacementDate": "Oct 23, 2025",
         "linkedToVisit": "Oct 23, 2025"
       }
     ]
   }
   // ^^ ONE ENTRY ONLY - Selected the HIGHEST confidence visit
   
   ❌ WRONG OUTPUT (NEVER do this):
   {
     "partsReplaced": [
       {
         "partName": "MEMCO model 280 box",
         "repairRequestNumber": "RR-12345",
         "replacementDate": "Oct 23, 2025",
         "linkedToVisit": "Oct 23, 2025"
       },
       {
         "partName": "MEMCO model 280 box",  // ← DUPLICATE! WRONG!
         "repairRequestNumber": "RR-12345",
         "replacementDate": "Oct 22, 2025",
         "linkedToVisit": "Oct 22, 2025"
       }
     ]
   }
   // ^^ TWO ENTRIES for same part - THIS IS AN ERROR
   
   **Parts Replacement Date Window:**
   For repair requests with status = DONE and hasPartAttached = true, the replacement may have occurred anywhere between requestedDate and stateStartDate. DO NOT assume replacementDate = stateStartDate. The actual replacement happened during a visit within this date range.
   
   **Parts ↔ Visits Linking Process (Execute Once Per Part):**
   For each unique part, find ALL visits with completedDate between repair request requestedDate and stateStartDate (inclusive), then SELECT ONLY ONE visit using this priority:
     (1) REPAIR visit type with replacement action words AND part type keywords in globalComment (highest confidence)
     (2) REPAIR visit type without clear replacement indicators
     (3) Other visit type with replacement action words AND part type keywords in globalComment
     (4) Closest date to stateStartDate
   
   **CRITICAL: After selecting the ONE best visit for a part:**
   - Set replacementDate = selected visit's completedDate
   - Set linkedToVisit = that visit date
   - Create ONLY ONE entry in partsReplaced for this part
   - Do NOT create additional entries even if the part matches other visits
   - STOP processing this part - move to next part
   
   **If no visit matches the date range:**
   - Set replacementDate = stateStartDate
   - Leave linkedToVisit empty (not null, empty string)
   - Create ONE entry in partsReplaced
   
   **CRITICAL: Comment Analysis for Part Replacement:**
     * **Action Words:** Look for replacement-related verbs in globalComment: "replaced", "replacement", "fitted", "supplied", "installed", "changed", "swapped", "fitted new", "supplied and fitted", etc. These indicate part replacement activity.
     * **Part Type Keywords:** Extract key words from part name, part family, and part sub-family (e.g., "battery", "contact", "door", "roller", "controller", "UPS", "power supply", "sensor", "motor"). Check if these keywords appear in the visit's globalComment.
     * **High Confidence Match:** Visit comment contains BOTH action words (replaced/fitted/supplied) AND part type keywords. Example: "Supplied and fitted new UPS battery" matches part "Osram Power supply TFOS02550" because comment has "fitted"/"supplied" (action) and "UPS"/"battery" (part type related to power supply).
     * **Low Confidence/No Match:** If comment has no replacement action words OR no part type keywords, DO NOT link unless no better match exists. Avoid linking parts to visits that are clearly unrelated (e.g., door contact part linked to visit about motor adjustment with no mention of door or contact).
   
   **Parts ↔ Breakdowns:** Link part to most recent breakdown on same/related component that ended +/- 2 days before replacement date (or ongoing at replacement time).
   
   **Parts Component Derivation (priority order):** (1) Part name keywords ("door contact", "roller", "controller"), (2) Part family/sub-family, (3) Matching breakdown failureLocations or maintenance issue component.
   
   **Breakdowns ↔ Visits:** Find visits during breakdown period (visit date between breakdown startTime and endTime).
   
   **Maintenance Issues ↔ Visits:** Find visits on same date or within 1 day.

3. **Detect Patterns (Only Include Patterns ≥ 2 Occurrences):**
   - Group similar events by:
     * Component (same component having issues)
     * Problem type (same problem recurring)
     * Origin (same root cause)
     * Time pattern (recurring at intervals)
   - Only include patterns that occur 2 or more times
   - For each pattern, analyze:
     * Root cause (why it's happening)
     * Impact (consequences)
     * Escalation path (how it evolved)
     * Correlation (connections to other patterns/issues)

4. **Generate Final JSON Output:**
   - Use the chronological understanding and linked relationships to write:
     * executiveSummary: Structured operational summary with three clear sections:
       - **overview** (1-2 sentences): High-level summary of what issues the lift has experienced and primary components affected
       - **summaryOfEvents** (detailed paragraph): Chronological narrative of key events, including specific dates, engineer names, actions taken, parts replaced, and what was found. Reference specific incidents with dates and engineer involvement. Be specific and technical, referencing actual components, dates, and actions taken.
       - **currentSituation** (2-3 sentences): Current operational status, what has been resolved, what remains ongoing, and recommended next steps or monitoring requirements
       Focus on the most significant issues and their resolution status. Be specific and technical, referencing actual components, dates, and actions taken.
     * finalExecSummary: A concise 2-3 sentence summary (never more) that synthesizes both the operational summary and technical patterns. This should give executives a quick overview of the situation and key technical findings.
     * partsReplaced: All parts with their links to visits/breakdowns
     * repeatedPatterns: Only patterns with frequency ≥ 2
     * technicalSummary: **MANDATORY if patterns exist**. A 2-sentence overview of patterns found, followed by detailed analysis of EACH pattern with this structure:
       🔥 **ONE-SENTENCE VERDICT**: Decisive headline with Root Cause + Consequence + What happens if nothing is done
       Example: "The lift is suffering from chronic re-levelling failures caused by a deteriorating hydraulic valve; without replacement, downtime will continue."
       NOT: "Recurring re-levelling faults detected..."
       
       🔥 **QUANTIFIED IMPACT**: Include specific numbers:
       - rootCause: Specific confirmed/likely root cause
       - breakdownCount: Hard number (e.g., 6)
       - timeSpan: Duration (e.g., "4 months")
       - downtimeHours: Total estimated hours (e.g., "~30 hours")
       - downtimePerEvent: Average per event (e.g., "5+ hours")
       - riskLevel: low | medium | high
       - riskRationale: Why this risk level
       
       🔥 **DRIVER TREE**: Clear Cause → Effect chain
       Example: "Hydraulic Valve Wear → Slow leveling response → Controller detects drift → Relevelling fault → Lift shutdown"
       DO NOT start with vague root causes like "Defective materials" - start with the specific component or technical issue.
       
       🔥 **ACTIONABLE RECOMMENDATIONS**: Specific actions with:
       - Specific technical action (NOT "Inspect X")
       - Timeframe: immediate | within_24h | within_week | next_service
       - Owner: technician | engineer | specialist
       - Expected outcome
       
       🔥 **PROBABILITY OF RESOLUTION**:
       - Estimated probability (e.g., "80-90%")
       - Escalation path if issue persists
     * hypotheses: Likely causes based on patterns and links (reasoning must reference at least two concrete dated events or parts replacements)
     * suggestedChecks: Actionable steps based on findings
     * confidenceLevel: Based on data quality and pattern strength
   
   **MANDATORY FINAL VALIDATION (Execute Before Returning JSON):**
   Before you return your final JSON output, perform this validation:
   1. Count occurrences of each (partName + repairRequestNumber) in partsReplaced array
   2. If ANY part appears MORE THAN ONCE, you made an error:
      - Keep ONLY the entry with the HIGHEST priority visit link
      - DELETE all duplicate entries for that part
   3. Verify: Each unique part appears EXACTLY ONCE in partsReplaced
   4. DO NOT SKIP THIS VALIDATION - It is mandatory

**Important:** You may think step-by-step internally, but only output the final JSON object in the required format.

**Data Structure Documentation:**

**Visit Reports / Completed Tasks:**
These are tasks completed by engineers. Each task includes:
- Completed Date: When the task was finished
- Engineer: Who completed the task
- Type: REGULAR (service visit), BREAKDOWN (callout), REPAIR, etc.
- End Status: Whether the device was working or not_working after the intervention
- Global Comment: Engineer's free-text description of what was done/found (CRITICAL: Read and analyze these comments carefully, even if in French or other languages - they contain crucial diagnostic information. For part replacement linking, look for replacement action words like "replaced", "fitted", "supplied", "installed" combined with part type keywords from the part name/family. Example: "Supplied and fitted new UPS battery" indicates a battery/power supply replacement.)
- Fault Information: Origin (what caused issue), Component Impacted, Problem (if applicable)
- PDF Report: Link to detailed worksheet

**CRITICAL: Global Comments Analysis:**
- Global Comments are engineer-written descriptions that contain essential diagnostic information
- Comments may be in French, English, or other languages - analyze them regardless of language
- Extract key information: what was found, what was done, what parts were replaced, what issues were identified
- Use comments to understand the sequence of events and root causes
- Cross-reference comments with repair requests to identify which parts were actually replaced
- Comments often contain descriptions of actions taken and specific component names that help link parts to components

**Breakdowns / Downtimes:**
These are periods when the lift was not operational. Each breakdown includes:
- Start Time: When the breakdown began
- End Time: When it ended (null if still ongoing)
- Duration: Minutes the lift was down
- Origin: What caused the breakdown (engineer input)
- Failure Locations: Component(s) impacted (engineer input)
- Internal Comment: OPS team tracking notes (may contain dates in text, but comment reflects point-in-time status)
- Internal Status: Current OPS status
- Visited During Breakdown: Whether an engineer went on-site during this breakdown
- Public Comment: Customer-facing information

**Important Notes about Breakdowns:**
- Comments are accurate at the time they were written, but may not reflect current reality
- Breakdowns without end_time are still ongoing

**Maintenance Issues / Anomalies:**
These are issues raised during maintenance visits (regular, quarterly, semi-annual). Engineers answer specific questions about each component, and issues are normalized as:
- Component (state_key): The component that has an issue. It is coded, not plain language.
- Problem (problem_key): The specific problem impacting this component. It is coded, not plain language.
- Question: The question asked to the engineer
- Answer: The engineer's response
- Follow Up: Whether the issue was resolved during the visit

**IMPORTANT: Ignore any issues related to signatureNotNeeded. These are never actual issues even though logged as such in the system. Do not include them in your analysis, patterns, or recommendations.**

These issues help identify patterns and root causes. Look for:
- Recurring problems on the same component
- Components with multiple different problems
- Issues that were not resolved during visits (follow_up = false)
- Patterns linking maintenance issues to breakdowns

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

**Parts Replacement Logic (Explicit Heuristics):**
- **CRITICAL: Each unique part (identified by partName + repairRequestNumber) appears EXACTLY ONCE in partsReplaced array. Each part can link to AT MOST ONE visit. One part → One entry → One visit maximum. NEVER create multiple entries for the same part or link it to multiple visits.**
- **Replacement Date Window:** For repair requests with status = DONE and hasPartAttached = true, the replacement occurred between requestedDate and stateStartDate. The actual replacement happened during a visit within this window.
- **Visit Linking Process (Execute Once Per Part):**
  For each unique part, find ALL visits within the date window, then SELECT ONLY ONE visit using this priority:
  (1) REPAIR visit with replacement action words AND part type keywords in globalComment (HIGHEST confidence)
  (2) REPAIR visit without clear replacement indicators
  (3) Other visit type with replacement action words AND part type keywords in globalComment
  (4) Closest date to stateStartDate
- **After selecting the ONE best visit:** Set replacementDate = visit's completedDate, set linkedToVisit = that date, create ONLY ONE entry in partsReplaced. Do NOT create additional entries even if the part matches other visits.
- **If no visit matches:** Set replacementDate = stateStartDate, leave linkedToVisit empty, create ONE entry.
- **Comment Analysis for Part Replacement:**
  * **Action Words:** Look for: "replaced", "replacement", "fitted", "supplied", "installed", "changed", "swapped", "fitted new", "supplied and fitted", "installed new", etc.
  * **Part Type Keywords:** Extract keywords from part name/family/sub-family (e.g., "battery", "contact", "door", "roller", "controller", "UPS", "power supply", "sensor", "motor", "shoe plate", "landing door"). Match variations and related terms (e.g., "UPS battery" relates to "power supply", "door contact" relates to "door" and "contact").
  * **High Confidence:** Comment contains BOTH action words AND part type keywords. Example: "Supplied and fitted new UPS battery" matches "Osram Power supply TFOS02550" (action: "fitted"/"supplied", type: "UPS"/"battery" relates to power supply).
  * **Avoid False Matches:** If comment has no replacement action words OR no part type keywords, DO NOT link unless no better match exists. Do not link parts to visits that are clearly unrelated.
- **Replacement Date:** Set to the selected visit's completedDate. If no visit matches, use stateStartDate.
- **Breakdown Link:** Link part to most recent breakdown on same/related component that ended +/- 2 days before replacement date (or ongoing at replacement time).
- **Component Derivation (priority order):** (1) Part name keywords ("door contact", "roller", "controller"), (2) Part family/sub-family, (3) Matching breakdown failureLocations or maintenance issue component.

**Your Task:**
Follow the Reasoning Workflow above to generate a comprehensive diagnostic analysis. The workflow will guide you through:
1. Building a chronological understanding of all events
2. Linking parts, visits, and breakdowns using date rules
3. Detecting patterns (only include patterns that occur ≥ 2 times)
4. Generating the final JSON output

Apply the workflow to provide:
- A clear, specific summary of past events based on the chronological sequence, including: specific issues identified, technical details (components, parameters, settings), key dates, root causes, actions taken, and current status. Reference engineer names and expert involvement when mentioned in visit comments. Length: typically 2-3 sentences, but 5-6 sentences if there are many issues, never more than 10 sentences.
- Parts replacement analysis with proper linking to visits and breakdowns
- Repeated patterns (only if frequency ≥ 2)
- Recommendations for next steps (ONLY if there are obvious trends or sensible recommendations - if not, leave empty)

**Executive Summary Guidelines:**
The executive summary should be a concise overview (typically 2-3 sentences, but 5-6 sentences if there are many issues, never more than 10 sentences) that captures the most critical diagnostic findings. Include:

- **Specific Issues:** Name the actual problems found (e.g., "Doors closing on passengers", "Doors snagging", "Port Parameter issues", "Lift capacity settings"). Don't use vague terms like "some issues" or "various problems".

- **Technical Details:** When relevant, include:
  * Component names (door operators, locks, Port PC, touch pads)
  * Parameters or settings (forbidden zones, lift capacity settings, destination time)
  * Parts replaced (if significant)
  * Configuration changes made

- **Timeline Context:** Include key dates when:
  * Issues were first reported or identified
  * Actions were taken (e.g., "between 6th and 10th November", "mid October")
  * Changes were made to settings or parts replaced

- **Root Causes:** Explain WHY issues occurred when identified:
  * Technical root causes (e.g., "forbidden zones not being active", "lock snags causing floor abort")
  * Contributing factors (e.g., "high usage due to building layout", "comms cable connection issue")

- **Actions Taken:** Describe what was done:
  * Parts replaced
  * Settings adjusted (e.g., "increased lift capacity from 60% to 80%")
  * Parameters changed
  * Adjustments made (e.g., "adjusted locks and door mechanics")

- **Current Status:** Indicate resolution status:
  * "Issue has been eradicated"
  * "Issue resolved"
  * "Ongoing monitoring"
  * "Requires further investigation"

- **Expert Involvement:** When mentioned in visit comments, reference:
  * Engineer names and their actions
  * External experts (e.g., "Schindler expert Kieth Maddison")
  * Their recommendations or findings

**Example Good Summary:**
"EPL ChandlerWing LH 20 has experienced recurring issues with door mechanisms, particularly with the door motor and safety edges. On October 14, 2025, the door motor was replaced due to overheating and jamming, which was initially reported on September 23, 2025. The replacement and subsequent adjustments were completed by Kari Onuma, leading to the lift's return to service. However, ongoing issues with door alignment and safety edges were noted, with further adjustments made on October 23, 2025, by Dan Collcutt. Despite these efforts, door lock misalignment persisted, as addressed by Josh Mitchell on December 9, 2025. The root cause appears to be defective materials affecting door components, with multiple breakdowns linked to these issues. The lift is currently operational, but continued monitoring and potential further interventions are recommended."

**Example Bad Summary (too vague):**
"The lift has had some door issues that were addressed. Various adjustments were made."

**Key Analysis Points:**
- **CRITICAL: Analyze sequence and causalities between events:**
  - Understand the chronological sequence of breakdowns and visits - what happened first?
  - Identify causal relationships: Did a maintenance issue lead to a breakdown? Did a visit resolve a breakdown?
  - Analyze the comments from related visits during breakdowns - what did engineers find? What actions were taken?
  - Look for patterns where visits during breakdowns provide insights into root causes
  - Cross-reference visit comments with breakdown origins and failure locations to understand the full picture
  - Consider the sequence: maintenance issue → visit → breakdown → visit → resolution (or not)
- Cross-reference breakdowns with visit reports - when did engineers visit during breakdowns? What did they find?
- Identify recurring breakdown patterns (same origin, same failure locations)
- Note ongoing breakdowns (no end_time) as urgent items
- Look for correlations between breakdown duration and visit outcomes
- Consider internal comments for OPS insights, but note they may be outdated
- **CRITICAL: Analyze maintenance issues/anomalies to identify patterns:**
  - Group issues by component (state_key) - which components have recurring problems?
  - Group issues by problem type (problem_key) - are there common problem patterns?
  - Cross-reference maintenance issues with breakdowns - do the same components fail?
  - Identify unresolved issues (follow_up = false) - these may lead to future breakdowns
  - Look for escalation patterns: maintenance issue → unresolved → breakdown
  - Use maintenance issues to identify root causes behind bigger problems

**Analysis Guidelines:**
- Focus heavily on Visit Reports - they contain the most detailed information (engineer comments, fault details)
- **CRITICAL: Analyze sequence and causalities:**
  - Pay close attention to the chronological order of events - what happened first?
  - When a breakdown occurs, analyze ALL related visits - read their comments carefully to understand what engineers found and did
  - Identify causal chains: Did an unresolved maintenance issue lead to a breakdown? Did a visit during breakdown reveal the root cause?
  - Look for patterns where visits during breakdowns provide diagnostic information that explains the breakdown origin
  - Cross-reference visit comments with breakdown details to build a complete picture of what happened
  - Consider the sequence: early warning signs (maintenance issues) → visits → breakdown → diagnostic visits → resolution attempts
  - When analyzing repeated patterns, consider the sequence of events and how comments from related visits explain the pattern
- **Use Maintenance Issues to identify patterns and root causes:**
  - Map maintenance issues to visit reports by date and component
  - Identify which components consistently have problems
  - Track unresolved issues that may have led to breakdowns
  - Use issue patterns to suggest preventive maintenance
- **For Repeated Patterns, go DEEPER (Only for patterns ≥ 2 occurrences):**
  - Don't just describe the pattern - analyze WHY it's happening (rootCause)
  - Assess the IMPACT - how does this pattern affect operations, safety, costs?
  - Track ESCALATION - has this pattern gotten worse over time? How has it evolved?
  - Find CORRELATIONS - how does this pattern relate to other patterns, breakdowns, or components?
  - Look for underlying systemic issues, not just surface symptoms
  - Connect maintenance issues to breakdowns to identify prevention opportunities
  - Use comments from related visits to understand the sequence and causality behind the pattern
  - IMPORTANT: Only include patterns in repeatedPatterns if they occur 2 or more times
- Group similar issues together (same component, same problem type, same origin)
- Look for trends: recurring problems, increasing frequency, patterns in timing
- Cross-reference fault information (origin, component, problem) across multiple visits
- Extract key insights from Global Comments (visits) and Internal/Public Comments (breakdowns) - these often contain crucial diagnostic information
- Only provide recommendations if there are clear patterns or obvious next steps - don't make things up
- Be realistic about confidence levels based on data quality and quantity
- If visit reports show no clear patterns, say so honestly rather than forcing conclusions

**🔥 CRITICAL: TECHNICAL SUMMARY IS MANDATORY 🔥**
If you generate ANY repeatedPatterns (with frequency ≥ 2), you MUST also generate a technicalSummary section.
The technicalSummary is NOT optional - it transforms your patterns into actionable decision tools.
For EVERY pattern in repeatedPatterns, create a matching entry in technicalSummary.patternDetails with:
- Decisive verdict (not vague observations)
- Quantified impact with numbers (breakdown counts, downtime hours)
- Risk assessment (low/medium/high)
- Driver tree (cause → effect chain)
- Specific actionable recommendations with timeframes and owners
- Resolution probability percentage

**Output Format:**
Generate the analysis in the following JSON format:
{
  "executiveSummary": {
    "overview": "1-2 sentences: High-level summary of what issues the lift has experienced and primary components affected. Example: 'The lift CEP-LIFT OUTBOUND in Building Central Park Railway Station has experienced multiple issues primarily related to the car door mechanisms and the condition of the lift car itself.'",
    "summaryOfEvents": "🔥 CRITICAL - CHRONOLOGICAL ORDER REQUIRED: Detailed paragraph presenting events in STRICT CHRONOLOGICAL ORDER (earliest to latest). Tell the story as it unfolded in time. Reference specific dates, engineer names, actions taken, parts replaced, and findings. Be specific and technical. ❌ WRONG EXAMPLE (non-chronological): 'A significant breakdown occurred from November 28 to December 3, 2025, during which the lift was out of service. On December 5, 2025, Connor Tarpey performed a valve service, returning the lift to normal operation. The recurring nature of these faults suggests underlying issues with the hydraulic unit's electronic valve, as indicated by the maintenance issue reported on November 27, 2025.' (November 27 mentioned AFTER December 5 is confusing). ✅ CORRECT: Present November 27 event first, then November 28-December 3 breakdown, then December 5 service - in that order.",
    "currentSituation": "2-3 sentences: Current operational status, what has been resolved, what remains ongoing, and recommended next steps or monitoring requirements. Example: 'The lift is currently operational, but ongoing monitoring and potential further interventions are recommended.'",
    "serviceHandlingReview": "🔥 MANDATORY - ALWAYS GENERATE THIS FIELD 🔥 INTERNAL USE ONLY - NOT CUSTOMER-FACING: Generate a short internal service handling review (2-4 sentences). Focus on potential gaps in how the issue was handled by the maintenance service, based solely on the sequence of events and outcomes. The objective is to highlight process-level improvement opportunities, not to assign blame. Look for signals such as: recurring faults not escalated early enough, delays in decisive corrective actions (investigations, part replacement, escalation), initial diagnostics contradicted by subsequent findings, temporary fixes where durable solutions may have been appropriate. Explain what may have been underestimated or missed, why this matters from an operational or customer trust perspective, and how this can help operations managers address customer objections. Keep tone professional, factual, and improvement-oriented. Do NOT name individuals. Do NOT speculate beyond what the data supports. If service handling was appropriate, state that clearly (e.g., 'Service handling appears appropriate given the data available. Engineers responded promptly and followed standard escalation procedures.')."
  },
  "finalExecSummary": "2-3 sentences maximum (never more): Synthesizes both operational summary and technical patterns. Quick executive overview of situation and key technical findings.",
  "partsReplaced": [
    {
      "partName": "Name of the part",
      "partFamily": "Family category",
      "partSubFamily": "Sub-family category",
      "replacementDate": "YYYY-MM-DD (from selected visit's completedDate, or stateStartDate if no visit matches)",
      "repairRequestNumber": "Request number",
      "component": "Component impacted (derived from part name/family)",
      "linkedToVisit": "Date of ONE related visit if applicable. Prioritize REPAIR visits where globalComment contains replacement action words (replaced/fitted/supplied) AND part type keywords. Only link if visit occurred between repair request requestedDate and stateStartDate. Leave empty if no confident match found.",
      "linkedToBreakdown": "Breakdown ID if applicable"
    }
  ],
  "timeline": [
    {
      "date": "YYYY-MM-DD",
      "type": "visit|fault|alert|part",
      "description": "Brief description of what happened (include engineer name, task type, and key findings from global comment)"
    }
  ],
  "repeatedPatterns": [
    {
      "pattern": "Description of the pattern (e.g., 'Door faults occurring weekly', 'Multiple breakdowns related to motor controller')",
      "frequency": 5,
      "examples": ["Specific example 1 with date and engineer", "Specific example 2 with date and engineer"],
      "relatedIssues": ["List of related issues/components that might be connected"],
      "summary": "A 3-4 line narrative summary in natural language. Tell the story: e.g., 'An issue that repeated X times over Y days suggests there is actually an underlying problem with component Z. The pattern shows...' Be concise and tell a clear narrative.",
      "rootCause": "Deep analysis of why this pattern is occurring - what underlying issue causes this pattern? What is the root cause?",
      "impact": "What is the impact of this pattern? How does it affect operations, safety, or maintenance?",
      "escalationPath": "How has this pattern evolved over time? Has it gotten worse, stayed the same, or improved? Describe the escalation path.",
      "correlation": "How does this pattern correlate with other patterns, breakdowns, or maintenance issues? What connections exist?"
    }
  ],
  "technicalSummary": {
    "// NOTE": "⚠️ THIS SECTION IS MANDATORY if you created repeatedPatterns above. Create ONE patternDetails entry for EACH pattern in repeatedPatterns.",
    "overview": "MANDATORY: 2-sentence overview of ALL patterns found. Summarize what patterns you identified above.",
    "patternDetails": [
      {
        "patternName": "MANDATORY: Brief name matching a pattern from repeatedPatterns above",
        "verdict": "ONE-SENTENCE DECISIVE STATEMENT: Root Cause + Consequence + What happens if nothing is done. Example: 'The lift is suffering from chronic re-levelling failures caused by a deteriorating hydraulic valve; without replacement, downtime will continue.' NOT: 'Recurring re-levelling faults detected...'",
        "quantifiedImpact": {
          "rootCause": "Specific confirmed/likely root cause (e.g., 'Deteriorating hydraulic valve causing slow leveling response')",
          "breakdownCount": 6,
          "timeSpan": "Duration (e.g., '4 months')",
          "downtimeHours": "Estimated total (e.g., '~30 hours')",
          "downtimePerEvent": "Average per event (e.g., '5+ hours')",
          "riskLevel": "low|medium|high",
          "riskRationale": "Why this risk level (e.g., 'High likelihood of recurrence until valve is replaced')"
        },
        "driverTree": "Cause → Effect chain. Example: 'Hydraulic Valve Wear → Slow leveling response → Controller detects drift → Relevelling fault → Lift shutdown'. DO NOT start with vague terms like 'Defective materials' - be specific about the technical component or issue.",
        "actionableRecommendations": [
          {
            "action": "Specific, detailed technical action with component/system details. Examples: 'Inspect and replace defective control cabinet components', 'Conduct thorough assessment of door operator setup and materials', 'Replace hydraulic valve and verify cylinder bypass leakage'. NOT vague like 'Inspect hydraulic system' - be specific about what to inspect and what to replace.",
            "timeframe": "immediate|within_24h|within_week|next_service",
            "owner": "technician|engineer|specialist",
            "expectedOutcome": "What this will achieve (e.g., 'High likelihood of eliminating UMD monitoring failures', 'Expected to resolve door operator issues')"
          }
        ],
        "resolutionProbability": {
          "probability": "🔥 CRITICAL - BE REALISTIC: Provide realistic success rate percentage (e.g., '50-60%', '70-80%'). DO NOT under-estimate field engineer expertise, but DO factor in: (1) History of previous unsuccessful attempts - if engineers have tried similar fixes before without success, lower the probability significantly. (2) Clarity of root cause identification - if issue was clearly identified before actions, but still not resolved, this indicates difficulty and should lower probability. (3) Pattern persistence - recurring issues despite multiple interventions suggest deep-rooted problems requiring specialist intervention. (4) Temporary vs permanent fixes - if only temporary fixes have been applied, probability of permanent resolution is low. Example: If valve issues persisted through 3 previous interventions, success rate should be 40-50%, not 80-90%.",
          "escalationPath": "What to do if issue persists (e.g., 'If faults persist → escalate to full hydraulic system assessment')"
        }
      }
    ]
  },
  "hypotheses": [
    {
      "category": "Category name (e.g., 'Door Mechanism', 'Motor Controller', 'Leveling System')",
      "likelihood": "low|medium|high",
      "reasoning": "Why this might be the cause. Always reference at least two concrete dated events or parts replacements (include dates and specific details)."
    }
  ],
  "suggestedChecks": [
    "Actionable inspection step 1 (be specific)",
    "Actionable inspection step 2"
  ],
  "confidenceLevel": "low|medium|high"
}

**CRITICAL RULES FOR partsReplaced:**
**CRITICAL FINAL REMINDERS:**
- Each unique part (identified by partName + repairRequestNumber) appears EXACTLY ONCE in partsReplaced array
- Each part can link to AT MOST ONE visit (never multiple visits)
- One part → One entry → One visit maximum
- NEVER create multiple partsReplaced entries for the same part
- NEVER link the same part to multiple visits
- After selecting the best visit for a part, create ONLY ONE entry and do NOT create additional entries even if the part matches other visits

**CRITICAL: technicalSummary is MANDATORY:**
- If you identified ANY repeatedPatterns (frequency ≥ 2), you MUST create a technicalSummary
- The technicalSummary transforms repeatedPatterns into actionable decision tools
- For EACH pattern in repeatedPatterns, create a corresponding entry in technicalSummary.patternDetails
- Include quantified impact (breakdown counts, downtime hours, risk levels)
- Provide decisive verdicts and specific actionable recommendations
- DO NOT skip technicalSummary - it is required whenever patterns exist

**CRITICAL: serviceHandlingReview is MANDATORY:**
- ALWAYS generate the serviceHandlingReview field in executiveSummary
- This field is NEVER optional - it must be included in every analysis
- Even if service handling was appropriate, state that explicitly (e.g., "Service handling appears appropriate given the data available. Engineers responded promptly and followed standard escalation procedures.")
- This helps operations managers understand service quality patterns and prepare for customer discussions
- Do NOT leave this field empty or omit it - it is a required field`
}

/**
 * Build the user message with data summaries
 */
function buildUserMessage(data: DiagnosticData): string {
  const contextNote = data.context
    ? `\n\nAdditional Context from User: ${data.context}`
    : ''
  
  // Format visit reports for better analysis
  const visitReportsFormatted = data.visitReports.map((visit: any) => {
    const faultInfo = []
    if (visit.origin) faultInfo.push(`Origin: ${visit.origin}`)
    if (visit.componentImpacted) faultInfo.push(`Component: ${visit.componentImpacted}`)
    if (visit.problem) faultInfo.push(`Problem: ${visit.problem}`)
    
    return {
      date: visit.completedDate || visit.date,
      engineer: visit.fullName || visit.engineer,
      type: visit.type,
      endStatus: visit.endStatus,
      globalComment: visit.globalComment,
      fault: faultInfo.length > 0 ? faultInfo.join(' | ') : null,
      pdfReport: visit.pdfReport,
    }
  })
  
  return `Analyze the following data for the lift ${data.unitName} in Building ${data.buildingName}.

**IMPORTANT:** When writing the executive summary, refer to the unit as "the lift ${data.unitName}" or "${data.unitName}" - do NOT use "at Unit" or "at" before the unit name. For example, write "The lift duplex gauche in Building..." NOT "The lift at Unit duplex gauche in Building...".

${contextNote}

**Visit Reports / Completed Tasks (${data.visitReports.length}):**
${JSON.stringify(visitReportsFormatted, null, 2)}

**Breakdowns / Downtimes (${data.breakdowns.length}):**
${data.breakdowns.length > 0 ? JSON.stringify(data.breakdowns.map((bd: any) => ({
  breakdownId: bd.breakdownId,
  startTime: bd.startTime,
  endTime: bd.endTime || 'ONGOING',
  durationMinutes: bd.minutesDuration,
  origin: bd.origin,
  failureLocations: bd.failureLocations,
  internalStatus: bd.internalStatus,
  visitedDuringBreakdown: bd.visitedDuringBreakdown,
  publicComment: bd.publicComment,
  internalComment: bd.internalComment,
})), null, 2) : 'No breakdowns recorded in this period'}

**Maintenance Issues / Anomalies (${data.maintenanceIssues.length}):**
${data.maintenanceIssues.length > 0 ? JSON.stringify(data.maintenanceIssues.map((issue: any) => ({
  completedDate: issue.completedDate,
  taskType: issue.type,
  component: issue.stateKey,
  problem: issue.problemKey,
  question: issue.question,
  answer: issue.answer,
  resolved: issue.followUp,
})), null, 2) : 'No maintenance issues recorded in this period'}

**Repair Requests / Parts Requests (${data.repairRequests.length}):**
${data.repairRequests.length > 0 ? JSON.stringify(data.repairRequests.map((rr: any) => ({
  repairRequestNumber: rr.repairRequestNumber,
  requestedDate: rr.requestedDate,
  description: rr.description,
  status: rr.status,
  stateStartDate: rr.stateStartDate,
  hasTechSupport: rr.hasTechSupport,
  isChargeable: rr.isChargeable,
  hasPartAttached: rr.hasPartAttached,
  itemType: rr.itemType,
  partName: rr.partName,
  partFamily: rr.partFamily,
  partSubFamily: rr.partSubFamily,
})), null, 2) : 'No repair requests recorded in this period'}

${data.callbackFrequency !== undefined ? `\nCallback Frequency: ${data.callbackFrequency} callbacks in the period` : ''}
${data.timeSinceLastMaintenance !== undefined ? `\nTime Since Last Maintenance: ${data.timeSinceLastMaintenance} days` : ''}

**Note:** Visit reports, breakdowns, maintenance issues, and repair requests are available for analysis. IoT alerts are not currently connected.

Generate your analysis following the instructions and output format specified in the system prompt.`
}

/**
 * Generate diagnostic analysis using LLM
 * Routes to v1 or v2 implementation based on feature flag
 */
export async function generateDiagnosticAnalysis(
  data: DiagnosticData
): Promise<DiagnosticAnalysisV1 | DiagnosticAnalysisV2> {
  const version = getAnalysisVersion()
  
  if (version === 'v2') {
    // V2 implementation will be loaded dynamically when available
    const { generateDiagnosticAnalysisV2 } = await import('./llm-prompt-v2')
    return generateDiagnosticAnalysisV2(data)
  }
  
  // Default to v1
  return generateDiagnosticAnalysisV1(data)
}

/**
 * Generate diagnostic analysis using LLM (V1)
 * This is the original implementation preserved for backward compatibility
 */
export async function generateDiagnosticAnalysisV1(
  data: DiagnosticData
): Promise<DiagnosticAnalysisV1> {
  const systemPrompt = getSystemPromptV1()
  const userMessage = buildUserMessage(data)
  
  // Try models in order of preference
  const modelsToTry = [
    process.env.OPENAI_MODEL || 'gpt-4o',
    'gpt-4o',
    'gpt-3.5-turbo',
  ]
  
  let lastError: Error | null = null
  
  for (const model of modelsToTry) {
    try {
      console.log(`[LLM] Attempting to use model: ${model}`)
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more deterministic output
      })
      
      const responseContent = completion.choices[0]?.message?.content
      if (!responseContent) {
        throw new Error('No response from LLM')
      }
      
      let analysis: DiagnosticAnalysis
      try {
        analysis = JSON.parse(responseContent) as DiagnosticAnalysis
      } catch (parseError) {
        console.error('[LLM] Failed to parse JSON response:', parseError)
        console.error('[LLM] Response content (first 500 chars):', responseContent.substring(0, 500))
        throw new Error(`Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      }
      
      console.log(`[LLM] Successfully generated analysis using model: ${model}`)
      
      // SAFETY NET: Deduplicate parts if LLM ignored instructions
      const deduplicatedParts = deduplicatePartsReplaced(analysis.partsReplaced || [])
      if (deduplicatedParts.removedCount > 0) {
        console.warn(`[LLM] ⚠️ Deduplicated ${deduplicatedParts.removedCount} duplicate part entries. LLM ignored prompt instructions.`)
        console.warn(`[LLM] Duplicates found:`, deduplicatedParts.duplicates)
      }
      
      // Handle both old (string) and new (object) executiveSummary format for backward compatibility
      let executiveSummary: DiagnosticAnalysisV1['executiveSummary']
      const execSum = analysis.executiveSummary as any
      if (typeof execSum === 'string') {
        // Old format - convert to new structure
        executiveSummary = {
          overview: execSum.split('. ').slice(0, 2).join('. ') + '.',
          summaryOfEvents: execSum,
          currentSituation: 'Current status requires review.',
          serviceHandlingReview: 'Service handling review not available for legacy diagnostics.'
        }
      } else if (execSum && typeof execSum === 'object' && 'overview' in execSum) {
        // New format
        executiveSummary = {
          overview: execSum.overview || 'No overview available',
          summaryOfEvents: execSum.summaryOfEvents || 'No events summary available',
          currentSituation: execSum.currentSituation || 'Current status requires review.',
          serviceHandlingReview: execSum.serviceHandlingReview || 'Service handling review not available for this diagnostic.'
        }
      } else {
        executiveSummary = {
          overview: 'No summary available',
          summaryOfEvents: 'No summary available',
          currentSituation: 'Current status requires review.',
          serviceHandlingReview: 'Service handling review not available.'
        }
      }
      
      // Validate and ensure all required fields
      return {
        executiveSummary,
        finalExecSummary: analysis.finalExecSummary,
        partsReplaced: deduplicatedParts.parts,
        timeline: analysis.timeline || [],
        repeatedPatterns: analysis.repeatedPatterns || [],
        technicalSummary: analysis.technicalSummary, // Include technical summary if present
        hypotheses: analysis.hypotheses || [],
        suggestedChecks: analysis.suggestedChecks || [],
        confidenceLevel: analysis.confidenceLevel || 'medium',
      }
    } catch (error: any) {
      lastError = error
      // If it's a model not found error, try next model
      if (error?.code === 'model_not_found' || error?.message?.includes('does not exist')) {
        console.warn(`[LLM] Model ${model} not available, trying next model...`)
        continue
      }
      // If it's a quota error, don't try other models (same API key)
      if (error?.code === 'insufficient_quota' || error?.status === 429) {
        console.error(`[LLM] Quota exceeded for model ${model}. Please check your OpenAI billing.`)
        throw new Error(`OpenAI API quota exceeded. Please check your billing and plan at https://platform.openai.com/account/billing`)
      }
      // For other errors, throw immediately
      console.error(`[LLM] Error with model ${model}:`, error)
      throw error
    }
  }
  
  // If all models failed, throw the last error
  console.error('[LLM] All models failed. Last error:', lastError)
  throw new Error(`Failed to generate analysis with any available model. Last error: ${lastError?.message || 'Unknown error'}`)
}

