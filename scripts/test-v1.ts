/**
 * Quick test to verify V1 is preserved and working
 * Tests the generateDiagnosticAnalysisV1 function directly
 */

import 'dotenv/config'
import { generateDiagnosticAnalysisV1 } from '../lib/llm-analysis'
import type { DiagnosticData } from '../lib/llm-analysis'

// Minimal test data
const TEST_DATA: DiagnosticData = {
  unitId: 'test-123',
  unitName: 'Test Lift',
  buildingName: 'Test Building',
  visitReports: [
    {
      completedDate: '2024-12-01',
      fullName: 'Test Engineer',
      type: 'REGULAR',
      endStatus: 'working',
      globalComment: 'Routine check completed',
    },
  ],
  breakdowns: [],
  maintenanceIssues: [],
  repairRequests: [],
  faultLogs: [],
  iotAlerts: [],
  partsReplaced: [],
  context: 'Test diagnostic',
}

async function testV1() {
  console.log('🧪 Testing V1 Analysis (Preserved)...\n')
  
  try {
    const result = await generateDiagnosticAnalysisV1(TEST_DATA)
    
    console.log('✅ V1 Analysis Completed Successfully\n')
    console.log('📊 Structure Validation:')
    console.log(`  - executiveSummary: ${result.executiveSummary ? '✅' : '❌'}`)
    console.log(`  - partsReplaced: ${Array.isArray(result.partsReplaced) ? '✅' : '❌'}`)
    console.log(`  - timeline: ${Array.isArray(result.timeline) ? '✅' : '❌'}`)
    console.log(`  - repeatedPatterns: ${Array.isArray(result.repeatedPatterns) ? '✅' : '❌'}`)
    console.log(`  - hypotheses: ${Array.isArray(result.hypotheses) ? '✅' : '❌'}`)
    console.log(`  - suggestedChecks: ${Array.isArray(result.suggestedChecks) ? '✅' : '❌'}`)
    console.log(`  - confidenceLevel: ${result.confidenceLevel ? '✅' : '❌'}`)
    
    console.log('\n📝 Sample Output:')
    const execSumText = typeof result.executiveSummary === 'string' 
      ? result.executiveSummary 
      : result.executiveSummary.summaryOfEvents
    console.log(`  Executive Summary: "${execSumText.substring(0, 100)}..."`)
    console.log(`  Parts Replaced: ${result.partsReplaced.length}`)
    console.log(`  Timeline Events: ${result.timeline.length}`)
    console.log(`  Patterns: ${result.repeatedPatterns.length}`)
    console.log(`  Confidence: ${result.confidenceLevel}`)
    
    console.log('\n✅ V1 is preserved and working correctly!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ V1 Test Failed:', error)
    process.exit(1)
  }
}

testV1()


