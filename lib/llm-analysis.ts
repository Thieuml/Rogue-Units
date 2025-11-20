/**
 * LLM-based diagnostic analysis service
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Validate OpenAI API key on module load
if (!process.env.OPENAI_API_KEY) {
  console.warn('[LLM] WARNING: OPENAI_API_KEY is not set. LLM analysis will fail.')
}

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
 * Generate diagnostic analysis using LLM
 */
export async function generateDiagnosticAnalysis(
  data: DiagnosticData
): Promise<DiagnosticAnalysis> {
  const prompt = buildPrompt(data)
  
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
            content: `You are a technical expert analyzing lift diagnostic data. Generate a structured diagnostic summary in JSON format. Be concise, actionable, and focus on patterns and likely causes.`,
          },
          {
            role: 'user',
            content: prompt,
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

/**
 * Build the prompt for LLM analysis
 */
function buildPrompt(data: DiagnosticData): string {
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
  
  return `You are a technical expert analyzing lift diagnostic data. Analyze the following data for Unit ${data.unitName} in Building ${data.buildingName}.

${contextNote}

**Visit Reports / Completed Tasks (${data.visitReports.length}):**
These are tasks completed by engineers. Each task includes:
- Completed Date: When the task was finished
- Engineer: Who completed the task
- Type: REGULAR (service visit), BREAKDOWN (callout), REPAIR, etc.
- End Status: Whether the device was working or not_working after the intervention
- Global Comment: Engineer's free-text description of what was done/found (CRITICAL: Read and analyze these comments carefully, even if in French or other languages - they contain crucial diagnostic information)
- Fault Information: Origin (what caused issue), Component Impacted, Problem (if applicable)
- PDF Report: Link to detailed worksheet

**CRITICAL: Global Comments Analysis:**
- Global Comments are engineer-written descriptions that contain essential diagnostic information
- Comments may be in French, English, or other languages - analyze them regardless of language
- Extract key information: what was found, what was done, what parts were replaced, what issues were identified
- Use comments to understand the sequence of events and root causes
- Cross-reference comments with repair requests to identify which parts were actually replaced
- Comments often contain dates and specific component names that help link parts to components

${JSON.stringify(visitReportsFormatted, null, 2)}

**Breakdowns / Downtimes (${data.breakdowns.length}):**
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

**Important Notes:**
- Comments are accurate at the time they were written, but may not reflect current reality
- Most comments include dates within the text itself
- Breakdowns without end_time are still ongoing

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

**CRITICAL ANALYSIS TASKS FOR REPAIR REQUESTS:**
1. **Extract parts information:**
   - Parse part names to clearly identify which parts were requested/replaced
   - Use part family and sub-family to categorize components
   - Identify when parts were actually replaced (use state_start_date_date when status is DONE)
   - Link parts to specific components based on part names and families

2. **Derive replacement dates:**
   - When status is DONE and has_part_attached is true, the state_start_date_date indicates when the request was completed (this is the replacement date)
   - IMPORTANT: The replacement date is the state_start_date_date when status is DONE, NOT the requested_date
   - Cross-reference repair request dates with visit dates to understand the sequence
   - Match repair requests to visits by comparing state_start_date_date (when part was replaced) with visit completion dates
   - Use visit global comments to verify which parts were actually replaced - comments often mention part names and replacement dates
   - Example: If a repair request has status DONE, state_start_date_date = "2025-11-13", and has_part_attached = true, then the part was replaced on 2025-11-13

3. **Link repair requests to visits:**
   - Match repair requests to repair visits by date proximity
   - Understand the flow: breakdown → repair request → part delivery → repair visit → resolution
   - Use repair request descriptions to understand what was needed and why

4. **Identify replaced parts:**
   - List all unique parts that were replaced (status DONE, has_part_attached = true)
   - Group by part family/sub-family to identify component categories
   - Note the dates when each part was replaced

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

**Note:** Visit reports, breakdowns, maintenance issues, and repair requests are available for analysis. IoT alerts are not currently connected.

${data.callbackFrequency !== undefined ? `\nCallback Frequency: ${data.callbackFrequency} callbacks in the period` : ''}
${data.timeSinceLastMaintenance !== undefined ? `\nTime Since Last Maintenance: ${data.timeSinceLastMaintenance} days` : ''}

**Your Task:**
Generate a comprehensive diagnostic analysis that provides:
1. A clear summary of past events (chronological overview) - correlate visits with breakdowns when engineers visited during breakdowns
2. First-level analysis detecting trends and grouping similar/related issues - look for patterns between breakdowns and visit reports
3. **Parts replacement analysis:**
   - Extract and list all parts that were replaced during the period (from repair requests with status DONE and has_part_attached = true)
   - Identify the components impacted by these replacements:
     * Parse part names to identify components (e.g., "Door Contact" → "Door Locks", "Door Contact")
     * Use part families and sub-families to map to components
     * Cross-reference with breakdown failure locations and maintenance issue components
     * Use visit global comments to identify which components were affected (comments often mention both the part replaced and the component)
   - Link parts to repair visits and breakdowns:
     * Match repair request state_start_date_date (replacement date) with visit completion dates
     * Link to breakdowns that occurred before the replacement (the breakdown likely caused the need for replacement)
   - Note the replacement dates: Use state_start_date_date when status is DONE as the replacement date
   - Example: "Fermator Door Contact EDC" replaced on 2025-11-13 should be linked to "Door Locks" or "Door Contact" component
4. Recommendations for next steps (ONLY if there are obvious trends or sensible recommendations - if not, leave empty)

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

Generate the analysis in the following JSON format:
{
  "executiveSummary": "A 2-3 sentence summary of the lift's recent behavior, main concerns, and overall status",
  "partsReplaced": [
    {
      "partName": "Name of the part",
      "partFamily": "Family category",
      "partSubFamily": "Sub-family category",
      "replacementDate": "YYYY-MM-DD (from state_start_date_date when status is DONE)",
      "repairRequestNumber": "Request number",
      "component": "Component impacted (derived from part name/family)",
      "linkedToVisit": "Date of related visit if applicable",
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
      "reasoning": "Why this might be the cause, referencing specific visit reports and patterns"
    }
  ],
  "suggestedChecks": [
    "Actionable inspection step 1 (be specific)",
    "Actionable inspection step 2"
  ],
  "confidenceLevel": "low|medium|high"
}

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
- **For Repeated Patterns, go DEEPER:**
  - Don't just describe the pattern - analyze WHY it's happening (rootCause)
  - Assess the IMPACT - how does this pattern affect operations, safety, costs?
  - Track ESCALATION - has this pattern gotten worse over time? How has it evolved?
  - Find CORRELATIONS - how does this pattern relate to other patterns, breakdowns, or components?
  - Look for underlying systemic issues, not just surface symptoms
  - Connect maintenance issues to breakdowns to identify prevention opportunities
  - Use comments from related visits to understand the sequence and causality behind the pattern
- Group similar issues together (same component, same problem type, same origin)
- Look for trends: recurring problems, increasing frequency, patterns in timing
- Cross-reference fault information (origin, component, problem) across multiple visits
- Extract key insights from Global Comments (visits) and Internal/Public Comments (breakdowns) - these often contain crucial diagnostic information
- Only provide recommendations if there are clear patterns or obvious next steps - don't make things up
- Be realistic about confidence levels based on data quality and quantity
- If visit reports show no clear patterns, say so honestly rather than forcing conclusions`
}

