/**
 * LLM-based diagnostic analysis service
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface DiagnosticData {
  unitId: string
  unitName: string
  buildingName: string
  visitReports: any[]
  faultLogs: any[]
  iotAlerts: any[]
  partsReplaced: any[]
  callbackFrequency?: number
  timeSinceLastMaintenance?: number
  context?: string
}

export interface DiagnosticAnalysis {
  executiveSummary: string
  timeline: Array<{
    date: string
    type: 'visit' | 'fault' | 'alert' | 'part'
    description: string
  }>
  repeatedPatterns: Array<{
    pattern: string
    frequency: number
    examples: string[]
  }>
  hypotheses: Array<{
    category: string
    likelihood: 'low' | 'medium' | 'high'
    reasoning: string
  }>
  suggestedChecks: string[]
  optionalPartsToCheck: string[]
  confidenceLevel: 'low' | 'medium' | 'high'
}

/**
 * Generate diagnostic analysis using LLM
 */
export async function generateDiagnosticAnalysis(
  data: DiagnosticData
): Promise<DiagnosticAnalysis> {
  const prompt = buildPrompt(data)
  
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
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
    
    const analysis = JSON.parse(responseContent) as DiagnosticAnalysis
    
    // Validate and ensure all required fields
    return {
      executiveSummary: analysis.executiveSummary || 'No summary available',
      timeline: analysis.timeline || [],
      repeatedPatterns: analysis.repeatedPatterns || [],
      hypotheses: analysis.hypotheses || [],
      suggestedChecks: analysis.suggestedChecks || [],
      optionalPartsToCheck: analysis.optionalPartsToCheck || [],
      confidenceLevel: analysis.confidenceLevel || 'medium',
    }
  } catch (error) {
    console.error('[LLM] Error generating analysis:', error)
    throw error
  }
}

/**
 * Build the prompt for LLM analysis
 */
function buildPrompt(data: DiagnosticData): string {
  const contextNote = data.context
    ? `\n\nAdditional Context: ${data.context}`
    : ''
  
  return `Analyze the following lift diagnostic data for Unit ${data.unitName} in Building ${data.buildingName}.

${contextNote}

**Visit Reports (${data.visitReports.length}):**
${JSON.stringify(data.visitReports, null, 2)}

**Fault Logs (${data.faultLogs.length}):**
${JSON.stringify(data.faultLogs, null, 2)}

**IoT Alerts (${data.iotAlerts.length}):**
${JSON.stringify(data.iotAlerts, null, 2)}

**Parts Replaced (${data.partsReplaced.length}):**
${JSON.stringify(data.partsReplaced, null, 2)}

${data.callbackFrequency !== undefined ? `\nCallback Frequency: ${data.callbackFrequency} callbacks in the period` : ''}
${data.timeSinceLastMaintenance !== undefined ? `\nTime Since Last Maintenance: ${data.timeSinceLastMaintenance} days` : ''}

Generate a diagnostic analysis in the following JSON format:
{
  "executiveSummary": "A 2-3 sentence summary of the lift's recent behavior and main concerns",
  "timeline": [
    {
      "date": "YYYY-MM-DD",
      "type": "visit|fault|alert|part",
      "description": "Brief description"
    }
  ],
  "repeatedPatterns": [
    {
      "pattern": "Description of the pattern (e.g., 'Door faults occurring weekly')",
      "frequency": 5,
      "examples": ["Example 1", "Example 2"]
    }
  ],
  "hypotheses": [
    {
      "category": "Category name (e.g., 'Door Mechanism', 'Leveling System')",
      "likelihood": "low|medium|high",
      "reasoning": "Why this might be the cause"
    }
  ],
  "suggestedChecks": [
    "Actionable inspection step 1",
    "Actionable inspection step 2"
  ],
  "optionalPartsToCheck": [
    "Part name 1",
    "Part name 2"
  ],
  "confidenceLevel": "low|medium|high"
}

Focus on:
- Identifying repeated issues and patterns
- Suggesting likely root causes based on the data
- Providing actionable next steps for technicians
- Being realistic about confidence levels based on data quality`
}

