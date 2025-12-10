/**
 * LLM-based diagnostic analysis service
 */

import OpenAI from 'openai'

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

export interface DiagnosticAnalysis {
  executiveSummary: string
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
  hypotheses: Array<{
    category: string
    likelihood: 'low' | 'medium' | 'high'
    reasoning: string
  }>
  suggestedChecks: string[]
  confidenceLevel: 'low' | 'medium' | 'high'
}

/**
 * Get the system prompt with all stable behavior instructions
 */
function getSystemPrompt(): string {
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
   - **CRITICAL: Each part appears ONCE only in partsReplaced array. Never create duplicate entries for the same part.**
   - **Parts Replacement Date Window:** For repair requests with status = DONE and hasPartAttached = true, the replacement may have occurred anywhere between requestedDate and stateStartDate. DO NOT assume replacementDate = stateStartDate. The actual replacement happened during a visit within this date range.
   - **Parts ↔ Visits Linking:** Find visits with completedDate between repair request requestedDate and stateStartDate (inclusive). Select ONE visit using this priority:
     (1) REPAIR visit type with replacement action words AND part type keywords in globalComment (highest confidence)
     (2) REPAIR visit type without clear replacement indicators
     (3) Other visit type with replacement action words AND part type keywords in globalComment
     (4) Closest date to stateStartDate
   - **CRITICAL: Comment Analysis for Part Replacement:**
     * **Action Words:** Look for replacement-related verbs in globalComment: "replaced", "replacement", "fitted", "supplied", "installed", "changed", "swapped", "fitted new", "supplied and fitted", etc. These indicate part replacement activity.
     * **Part Type Keywords:** Extract key words from part name, part family, and part sub-family (e.g., "battery", "contact", "door", "roller", "controller", "UPS", "power supply", "sensor", "motor"). Check if these keywords appear in the visit's globalComment.
     * **High Confidence Match:** Visit comment contains BOTH action words (replaced/fitted/supplied) AND part type keywords. Example: "Supplied and fitted new UPS battery" matches part "Osram Power supply TFOS02550" because comment has "fitted"/"supplied" (action) and "UPS"/"battery" (part type related to power supply).
     * **Low Confidence/No Match:** If comment has no replacement action words OR no part type keywords, DO NOT link unless no better match exists. Avoid linking parts to visits that are clearly unrelated (e.g., door contact part linked to visit about motor adjustment with no mention of door or contact).
   - **Replacement Date:** Set replacementDate to the selected visit's completedDate. Set linkedToVisit to that visit date. If no visit matches within the date range, use stateStartDate as replacementDate and leave linkedToVisit empty.
   - **Parts ↔ Breakdowns:** Link part to most recent breakdown on same/related component that ended +/- 2 days before replacement date (or ongoing at replacement time).
   - **Parts Component Derivation (priority order):** (1) Part name keywords ("door contact", "roller", "controller"), (2) Part family/sub-family, (3) Matching breakdown failureLocations or maintenance issue component.
   - **Breakdowns ↔ Visits:** Find visits during breakdown period (visit date between breakdown startTime and endTime).
   - **Maintenance Issues ↔ Visits:** Find visits on same date or within 1 day.

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
     * executiveSummary: A concise summary (typically 2-3 sentences, but 5-6 sentences if there are many issues, never more than 10 sentences) that includes:
       - Specific issues/problems identified (e.g., "Doors closing on passengers", "Doors snagging", "Lift B+C doors opening on wrong side")
       - Key technical details when relevant (component names, parameters, settings changed, parts replaced)
       - Important dates/timeline context (when issues occurred, when actions were taken)
       - Root causes or contributing factors identified
       - Current status or outcomes (resolved, ongoing, actions taken)
       - Expert involvement if mentioned in visit comments (engineer names, external experts)
       Focus on the most significant issues and their resolution status. Be specific and technical, referencing actual components, dates, and actions taken.
     * partsReplaced: All parts with their links to visits/breakdowns
     * repeatedPatterns: Only patterns with frequency ≥ 2
     * hypotheses: Likely causes based on patterns and links (reasoning must reference at least two concrete dated events or parts replacements)
     * suggestedChecks: Actionable steps based on findings
     * confidenceLevel: Based on data quality and pattern strength

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
- Comments often contain dates and specific component names that help link parts to components

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
- Most comments include dates within the text itself
- Breakdowns without end_time are still ongoing

**Maintenance Issues / Anomalies:**
These are issues raised during maintenance visits (regular, quarterly, semi-annual). Engineers answer specific questions about each component, and issues are normalized as:
- Component (state_key): The component that has an issue
- Problem (problem_key): The specific problem impacting this component
- Question: The question asked to the engineer
- Answer: The engineer's response
- Follow Up: Whether the issue was resolved during the visit

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
- **CRITICAL: Each unique part must appear exactly ONCE in partsReplaced array. Never create duplicate entries for the same part (same partName + repairRequestNumber).**
- **Replacement Date Window:** For repair requests with status = DONE and hasPartAttached = true, the replacement occurred between requestedDate and stateStartDate. The actual replacement happened during a visit within this window.
- **Visit Linking (Priority Order):**
  (1) REPAIR visit with replacement action words AND part type keywords in globalComment (HIGHEST confidence)
  (2) REPAIR visit without clear replacement indicators
  (3) Other visit type with replacement action words AND part type keywords in globalComment
  (4) Closest date to stateStartDate
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
"Lift B+C experienced doors opening on the wrong side, partly due to a Port Parameter called 'forbidden zones' not being active, which was corrected in mid October. Subsequent reports of doors failing to open were related to lock snags causing floor aborts. WeMaintain adjusted all locks and door mechanics between 6th and 10th November, and the issue appears to have been eradicated."

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

**Output Format:**
Generate the analysis in the following JSON format:
{
  "executiveSummary": "A concise summary (typically 2-3 sentences, but 5-6 sentences if there are many issues, never more than 10 sentences) that includes: (1) Specific issues identified with component/technical details, (2) Key dates and timeline context, (3) Root causes or contributing factors, (4) Actions taken and current status. Reference specific engineers, experts, or technical details when mentioned in visit comments. Example format: '[Issue description] was identified. [Technical detail/component]. [Action taken/date]. [Current status].'",
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
- Each unique part (identified by partName + repairRequestNumber) must appear exactly ONCE in partsReplaced array
- Never create duplicate entries for the same part
- Each part links to at most ONE visit (prioritize REPAIR visits, then closest date)
- If multiple visits match, select only the best one using priority rules`
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
 */
export async function generateDiagnosticAnalysis(
  data: DiagnosticData
): Promise<DiagnosticAnalysis> {
  const systemPrompt = getSystemPrompt()
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
      
      // Validate and ensure all required fields
      return {
        executiveSummary: analysis.executiveSummary || 'No summary available',
        partsReplaced: analysis.partsReplaced || [],
        timeline: analysis.timeline || [],
        repeatedPatterns: analysis.repeatedPatterns || [],
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

