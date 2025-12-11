/**
 * Comparison tool for V1 vs V2 diagnostic analysis
 * 
 * Usage:
 *   npm run compare-versions
 * 
 * This script:
 * 1. Tests both v1 and v2 on sample diagnostic data
 * 2. Compares outputs to ensure v2 preserves v1 heuristics
 * 3. Validates evidence integrity in v2
 */

import 'dotenv/config'
import { generateDiagnosticAnalysisV1 } from '../lib/llm-analysis'
import { generateDiagnosticAnalysisV2 } from '../lib/llm-prompt-v2'
import { validateEvidenceIntegrity } from '../lib/llm-analysis-v2'
import type { DiagnosticData } from '../lib/llm-analysis'

// Sample diagnostic data for testing
// Replace with real data from your database for actual testing
const SAMPLE_DATA: DiagnosticData = {
  unitId: 'test-unit-123',
  unitName: 'Test Lift A',
  buildingName: 'Test Building',
  visitReports: [
    {
      completedDate: '2024-12-01',
      fullName: 'John Smith',
      type: 'REGULAR',
      endStatus: 'working',
      globalComment: 'Routine maintenance completed. All systems operational.',
      origin: null,
      componentImpacted: null,
      problem: null,
    },
    {
      completedDate: '2024-12-05',
      fullName: 'Jane Doe',
      type: 'REPAIR',
      endStatus: 'working',
      globalComment: 'Supplied and fitted new UPS battery. System tested OK.',
      origin: 'Power failure',
      componentImpacted: 'Power Supply',
      problem: 'Battery degraded',
    },
  ],
  breakdowns: [
    {
      breakdownId: 'bd-001',
      startTime: '2024-12-04T10:30:00Z',
      endTime: '2024-12-05T14:00:00Z',
      minutesDuration: 1590,
      origin: 'Power failure',
      failureLocations: ['Power Supply'],
      internalStatus: 'Resolved',
      visitedDuringBreakdown: true,
      publicComment: 'Lift temporarily out of service',
      internalComment: 'UPS battery failed, replacement needed',
    },
  ],
  maintenanceIssues: [
    {
      completedDate: '2024-12-01',
      type: 'REGULAR',
      stateKey: 'power_supply',
      problemKey: 'battery_low',
      question: 'Battery condition?',
      answer: 'Battery showing signs of degradation',
      followUp: false,
    },
  ],
  repairRequests: [
    {
      repairRequestNumber: 'RR-001',
      requestedDate: '2024-12-04',
      description: 'UPS battery replacement needed',
      status: 'DONE',
      stateStartDate: '2024-12-05',
      hasTechSupport: false,
      isChargeable: true,
      hasPartAttached: true,
      itemType: 'PART',
      partName: 'Osram Power supply TFOS02550',
      partFamily: 'Power',
      partSubFamily: 'UPS Battery',
    },
  ],
  faultLogs: [],
  iotAlerts: [],
  partsReplaced: [],
  callbackFrequency: 0,
  timeSinceLastMaintenance: 5,
  context: 'Last 30 days',
}

async function main() {
  console.log('🔄 V1 vs V2 Analysis Comparison\n')
  console.log('═'.repeat(60))
  
  try {
    // Generate V1 analysis
    console.log('\n📊 Running V1 Analysis...')
    const startV1 = Date.now()
    const v1Result = await generateDiagnosticAnalysisV1(SAMPLE_DATA)
    const durationV1 = Date.now() - startV1
    console.log(`✅ V1 completed in ${durationV1}ms`)
    
    // Generate V2 analysis
    console.log('\n📊 Running V2 Analysis...')
    const startV2 = Date.now()
    const v2Result = await generateDiagnosticAnalysisV2(SAMPLE_DATA)
    const durationV2 = Date.now() - startV2
    console.log(`✅ V2 completed in ${durationV2}ms`)
    
    console.log('\n' + '═'.repeat(60))
    console.log('📈 COMPARISON REPORT')
    console.log('═'.repeat(60))
    
    // Compare parts
    console.log('\n🔧 PARTS REPLACED:')
    console.log(`  V1: ${v1Result.partsReplaced.length} parts`)
    console.log(`  V2: ${v2Result.coreAnalysis.linkedParts.length} parts`)
    
    if (v1Result.partsReplaced.length !== v2Result.coreAnalysis.linkedParts.length) {
      console.warn('  ⚠️  Part count mismatch!')
    } else {
      console.log('  ✅ Part counts match')
    }
    
    // List parts
    console.log('\n  V1 Parts:')
    v1Result.partsReplaced.forEach(p => {
      console.log(`    - ${p.partName} (${p.component}) on ${p.replacementDate}`)
    })
    
    console.log('\n  V2 Parts:')
    v2Result.coreAnalysis.linkedParts.forEach(p => {
      console.log(`    - ${p.partName} (${p.component}) on ${p.replacementDate} [${p.confidence} confidence]`)
    })
    
    // Compare patterns
    console.log('\n🔁 PATTERNS (≥2 occurrences):')
    const v1Patterns = v1Result.repeatedPatterns.filter(p => p.frequency >= 2)
    const v2Patterns = v2Result.coreAnalysis.patterns.filter(p => p.frequency >= 2)
    console.log(`  V1: ${v1Patterns.length} patterns`)
    console.log(`  V2: ${v2Patterns.length} patterns`)
    
    if (v1Patterns.length !== v2Patterns.length) {
      console.warn('  ⚠️  Pattern count mismatch!')
    } else {
      console.log('  ✅ Pattern counts match')
    }
    
    // List patterns
    if (v1Patterns.length > 0) {
      console.log('\n  V1 Patterns:')
      v1Patterns.forEach(p => {
        console.log(`    - ${p.pattern} (${p.frequency}x)`)
      })
    }
    
    if (v2Patterns.length > 0) {
      console.log('\n  V2 Patterns:')
      v2Patterns.forEach(p => {
        console.log(`    - ${p.description} (${p.frequency}x)`)
      })
    }
    
    // Check causality analysis
    console.log('\n🔗 CAUSALITY ANALYSIS:')
    const v1ExecSumText = typeof v1Result.executiveSummary === 'string' 
      ? v1Result.executiveSummary 
      : v1Result.executiveSummary.summaryOfEvents
    const v1HasCausality = v1ExecSumText.toLowerCase().includes('because') || 
                          v1ExecSumText.toLowerCase().includes('due to')
    const v2TimelineWithCausality = v2Result.coreAnalysis.timeline.filter(e => e.causality).length
    const v2NarrativeWithCausality = v2Result.operationalAnalysis.narrativeTimeline.filter(e => e.causality).length
    
    console.log(`  V1 summary has causality: ${v1HasCausality ? '✅' : '❌'}`)
    console.log(`  V2 timeline events: ${v2Result.coreAnalysis.timeline.length}`)
    console.log(`  V2 events with causality: ${v2TimelineWithCausality} (${Math.round(v2TimelineWithCausality / v2Result.coreAnalysis.timeline.length * 100)}%)`)
    console.log(`  V2 narrative events with causality: ${v2NarrativeWithCausality}`)
    
    // Validate evidence integrity
    console.log('\n✅ EVIDENCE INTEGRITY (V2):')
    const validation = validateEvidenceIntegrity(v2Result)
    if (validation.valid) {
      console.log('  ✅ All evidenceEventIds are valid')
    } else {
      console.error('  ❌ Evidence integrity validation failed:')
      validation.errors.forEach(err => console.error(`    - ${err}`))
    }
    
    // Compare hypotheses
    console.log('\n🔬 ROOT CAUSE ASSESSMENT:')
    console.log(`  V1: ${v1Result.hypotheses.length} hypotheses`)
    if (v2Result.technicalAnalysis.rootCauseAssessment) {
      const rca = v2Result.technicalAnalysis.rootCauseAssessment
      console.log(`  V2 Most Likely: ${rca.mostLikelyChain.rootCause} (${rca.mostLikelyChain.confidence})`)
      console.log(`  V2 Alternatives: ${rca.alternativeCauses.length} alternative causes`)
    }
    
    // Compare suggested checks / recommended actions
    console.log('\n🔍 RECOMMENDED ACTIONS:')
    console.log(`  V1: ${v1Result.suggestedChecks.length} checks`)
    if (v2Result.technicalAnalysis.recommendedActions) {
      console.log(`  V2: ${v2Result.technicalAnalysis.recommendedActions.length} prioritized actions`)
    }
    
    // Compare confidence
    console.log('\n📊 CONFIDENCE LEVEL:')
    console.log(`  V1: ${v1Result.confidenceLevel}`)
    console.log(`  V2: ${v2Result.technicalAnalysis.confidenceLevel}`)
    
    // V2 specific features
    console.log('\n🆕 V2 NEW FEATURES:')
    console.log(`  Core components tracked: ${v2Result.coreAnalysis.components.length}`)
    console.log(`  Operational narrative events: ${v2Result.operationalAnalysis.narrativeTimeline.length}`)
    console.log(`  Action log entries: ${v2Result.operationalAnalysis.actionLog.length}`)
    console.log(`  Current status: ${v2Result.operationalAnalysis.currentStatus.status}`)
    console.log(`  Component diagnostics: ${v2Result.technicalAnalysis.componentDiagnostics.length}`)
    
    // Display summaries for comparison
    console.log('\n' + '═'.repeat(60))
    console.log('📝 SUMMARIES')
    console.log('═'.repeat(60))
    
    console.log('\nV1 Executive Summary:')
    console.log('─'.repeat(60))
    if (typeof v1Result.executiveSummary === 'string') {
      console.log(v1Result.executiveSummary)
    } else {
      console.log('Overview:', v1Result.executiveSummary.overview)
      console.log('\nSummary of Events:', v1Result.executiveSummary.summaryOfEvents)
      console.log('\nCurrent Situation:', v1Result.executiveSummary.currentSituation)
    }
    
    console.log('\n\nV2 Operational Executive Summary:')
    console.log('─'.repeat(60))
    console.log(v2Result.operationalAnalysis.executiveSummary)
    
    console.log('\n\nV2 Customer Summary:')
    console.log('─'.repeat(60))
    console.log(v2Result.operationalAnalysis.customerSummary)
    
    console.log('\n\nV2 Technical Executive Summary:')
    console.log('─'.repeat(60))
    console.log(v2Result.technicalAnalysis.executiveSummary)
    
    console.log('\n\nV2 Current Status:')
    console.log('─'.repeat(60))
    console.log(`Status: ${v2Result.operationalAnalysis.currentStatus.status}`)
    console.log(`Summary: ${v2Result.operationalAnalysis.currentStatus.summary}`)
    console.log(`Next steps: ${v2Result.operationalAnalysis.currentStatus.nextSteps.join(', ')}`)
    
    console.log('\n' + '═'.repeat(60))
    console.log('✅ COMPARISON COMPLETE')
    console.log('═'.repeat(60))
    
  } catch (error) {
    console.error('\n❌ ERROR:', error)
    process.exit(1)
  }
}

main()


