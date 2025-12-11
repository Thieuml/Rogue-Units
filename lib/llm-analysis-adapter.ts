/**
 * Adapter to convert DiagnosticAnalysisV2 to DiagnosticAnalysisV1
 * 
 * This enables:
 * - Running v2 in production while using v1 UI
 * - Gradual migration from v1 to v2
 * - Testing v2 without breaking existing functionality
 */

import type { DiagnosticAnalysisV1 } from './llm-analysis'
import type { DiagnosticAnalysisV2 } from './llm-analysis-v2'

/**
 * Convert V2 analysis to V1 format
 * Preserves all critical information while adapting structure
 */
export function adaptV2ToV1(v2: DiagnosticAnalysisV2): DiagnosticAnalysisV1 {
  // Use operational executiveSummary (which is now robust and detailed)
  // Convert to new structured format
  const execSumText = v2.operationalAnalysis.executiveSummary || v2.operationalAnalysis.customerSummary || 'No summary available'
  const executiveSummary: DiagnosticAnalysisV1['executiveSummary'] = {
    overview: execSumText.split('. ').slice(0, 2).join('. ') + '.',
    summaryOfEvents: execSumText,
    currentSituation: 'Current status requires review.'
  }
  
  // Convert linked parts from core to v1 format
  const partsReplaced = v2.coreAnalysis.linkedParts.map(part => ({
    partName: part.partName,
    partFamily: part.partFamily || '',
    partSubFamily: part.partSubFamily || '',
    replacementDate: part.replacementDate,
    repairRequestNumber: part.repairRequestNumber || '',
    component: part.component,
    linkedToVisit: part.linkedVisitEventId,
    linkedToBreakdown: part.linkedBreakdownEventId,
  }))
  
  // Convert core timeline to v1 timeline format
  const timeline = v2.coreAnalysis.timeline.map(evt => ({
    date: evt.date,
    type: evt.type as 'visit' | 'fault' | 'alert' | 'part',
    description: evt.description,
  }))
  
  // Convert core patterns to v1 repeated patterns format
  const repeatedPatterns = v2.coreAnalysis.patterns.map(p => ({
    pattern: p.description,
    frequency: p.frequency,
    examples: p.evidenceEventIds || [], // Reference event IDs as examples
    summary: p.rootCause || '',
    rootCause: p.rootCause || '',
    impact: p.impact || '',
    escalationPath: p.escalationPath,
    correlation: p.correlation,
  }))
  
  // Convert technical root cause assessment to v1 hypotheses format
  const hypotheses: Array<{
    category: string
    likelihood: 'low' | 'medium' | 'high'
    reasoning: string
  }> = []
  
  if (v2.technicalAnalysis.rootCauseAssessment) {
    const rca = v2.technicalAnalysis.rootCauseAssessment
    
    // Add most likely cause as high likelihood hypothesis
    if (rca.mostLikelyChain) {
      hypotheses.push({
        category: rca.mostLikelyChain.rootCause,
        likelihood: 'high',
        reasoning: `${rca.mostLikelyChain.causeEffectChain} (Confidence: ${rca.mostLikelyChain.confidence})`
      })
    }
    
    // Add alternative causes as lower likelihood hypotheses
    if (rca.alternativeCauses) {
      rca.alternativeCauses.forEach(alt => {
        hypotheses.push({
          category: alt.cause,
          likelihood: alt.confidence.includes('high') ? 'medium' : 'low',
          reasoning: `${alt.reasoning} (Confidence: ${alt.confidence})`
        })
      })
    }
  }
  
  // Convert recommended actions to v1 suggested checks
  const suggestedChecks: string[] = []
  if (v2.technicalAnalysis.recommendedActions) {
    v2.technicalAnalysis.recommendedActions.forEach(action => {
      suggestedChecks.push(`[${action.timeframe}] ${action.action} (${action.justification})`)
    })
  }
  
  // Add expected outcome as a suggested check
  if (v2.technicalAnalysis.expectedOutcome) {
    suggestedChecks.push(`Expected: ${v2.technicalAnalysis.expectedOutcome.behaviorChange}`)
  }
  
  // Use technical confidence level
  const confidenceLevel = v2.technicalAnalysis.confidenceLevel
  
  return {
    executiveSummary,
    partsReplaced,
    timeline,
    repeatedPatterns,
    hypotheses,
    suggestedChecks,
    confidenceLevel,
  }
}

/**
 * Check if analysis is V2 format
 */
export function isV2Analysis(analysis: DiagnosticAnalysisV1 | DiagnosticAnalysisV2): analysis is DiagnosticAnalysisV2 {
  return 'coreAnalysis' in analysis && 'operationalAnalysis' in analysis && 'technicalAnalysis' in analysis
}

/**
 * Check if analysis is V1 format
 */
export function isV1Analysis(analysis: DiagnosticAnalysisV1 | DiagnosticAnalysisV2): analysis is DiagnosticAnalysisV1 {
  return 'executiveSummary' in analysis && !('coreAnalysis' in analysis)
}

/**
 * Normalize analysis to V1 format (for backward compatibility)
 * If already V1, return as-is
 * If V2, convert to V1
 */
export function normalizeToV1(analysis: DiagnosticAnalysisV1 | DiagnosticAnalysisV2): DiagnosticAnalysisV1 {
  if (isV2Analysis(analysis)) {
    return adaptV2ToV1(analysis)
  }
  return analysis
}


