/**
 * LLM-based diagnostic analysis service - V2
 * 
 * V2 introduces a structured approach with:
 * - coreAnalysis: Shared foundation with all events, parts, and patterns
 * - operationalAnalysis: OPS-manager view derived from core
 * - technicalAnalysis: Technical expert view derived from core
 * 
 * All analyses must be evidence-based, referencing eventIds from coreAnalysis.
 */

/**
 * Core Timeline Event
 * Every event in the diagnostic timeline with unique ID for referencing
 */
export interface CoreTimelineEvent {
  eventId: string // Unique identifier (e.g., "evt_001")
  date: string // YYYY-MM-DD
  type: 'visit' | 'breakdown' | 'maintenance_issue' | 'part_replacement'
  description: string // What happened
  engineerName?: string // Engineer who performed action (if applicable)
  linkedPartIds?: string[] // References to CoreLinkedPart.partId
  linkedBreakdownId?: string // Reference to breakdown ID
  causality?: string // How this event connects to previous events
  rawData?: {
    // Optional: preserve original data for debugging
    taskId?: string
    breakdownId?: string
    repairRequestNumber?: string
  }
}

/**
 * Core Linked Part
 * Each part replacement with links to visits and breakdowns
 * CRITICAL: Each part appears exactly once (preserved from v1)
 */
export interface CoreLinkedPart {
  partId: string // Unique identifier (e.g., "part_001")
  partName: string
  partFamily?: string
  partSubFamily?: string
  component: string // Derived component (door, motor, controller, etc.)
  replacementDate: string // YYYY-MM-DD (from visit or stateStartDate)
  repairRequestNumber?: string
  linkedVisitEventId?: string // Reference to CoreTimelineEvent.eventId
  linkedBreakdownEventId?: string // Reference to CoreTimelineEvent.eventId
  confidence: 'high' | 'medium' | 'low' // Confidence in the linking
  linkingReason?: string // Why this visit was selected (for debugging)
}

/**
 * Core Pattern
 * Recurring patterns with frequency ≥ 2 (preserved from v1)
 */
export interface CorePattern {
  patternId: string // Unique identifier (e.g., "pat_001")
  description: string // Pattern description
  frequency: number // Must be ≥ 2
  evidenceEventIds: string[] // References to CoreTimelineEvent.eventId
  component?: string // Primary component involved
  rootCause?: string // Deep analysis of why
  impact?: string // Consequences
  escalationPath?: string // How it evolved
  correlation?: string // Connections to other patterns
}

/**
 * Core Component
 * Component-level aggregation of issues and patterns
 */
export interface CoreComponent {
  componentName: string // Component identifier
  issueEventIds: string[] // References to CoreTimelineEvent.eventId
  patternIds: string[] // References to CorePattern.patternId
  breakdownCount: number // Number of breakdowns on this component
  maintenanceIssueCount: number // Number of maintenance issues
}

/**
 * Core Analysis
 * Shared foundation containing all events, parts, patterns, and components
 * This is the single source of truth for both operational and technical views
 */
export interface CoreAnalysis {
  timeline: CoreTimelineEvent[]
  linkedParts: CoreLinkedPart[]
  patterns: CorePattern[]
  components: CoreComponent[]
}

/**
 * Operational Timeline Event
 * Simplified, narrative-focused event for OPS managers
 * Must reference evidenceEventIds from CoreAnalysis
 */
export interface OperationalTimelineEvent {
  date: string // YYYY-MM-DD
  event: string // Brief title
  description: string // Plain language description (no jargon)
  evidenceEventIds: string[] // References to CoreTimelineEvent.eventId
  causality?: string // How this connects to previous events (plain language)
  outcome?: string // Result of the event
  engineer?: string // Who was involved
}

/**
 * Action Log Entry
 * Record of actions taken by engineers
 */
export interface ActionLogEntry {
  date: string // YYYY-MM-DD
  action: string // What was done (plain language)
  performedBy: string // Engineer name
  outcome: string // Result
  evidenceEventIds: string[] // References to CoreTimelineEvent.eventId
}

/**
 * Current Status
 * Overall system status and next steps
 */
export interface CurrentStatus {
  status: 'resolved' | 'monitoring' | 'requires_attention' | 'critical'
  summary: string // Plain language current situation
  nextSteps: string[] // Actionable next steps
  evidenceEventIds: string[] // References to CoreTimelineEvent.eventId
}

/**
 * Operational Analysis
 * OPS manager and customer-facing view
 * All content must be derived from and reference CoreAnalysis
 */
export interface OperationalAnalysis {
  executiveSummary: string // Robust summary with specific issues, dates, technical details, root causes, status
  narrativeTimeline: OperationalTimelineEvent[]
  customerSummary: string // 3-4 sentences, plain language, no jargon
  actionLog: ActionLogEntry[]
  currentStatus: CurrentStatus
}

/**
 * Pattern Analysis (High-Impact Structure)
 * Detailed analysis for each pattern with decisive verdicts and quantified impact
 */
export interface PatternAnalysis {
  patternId: string // Reference to coreAnalysis.patterns[].patternId
  verdict: string // One-sentence decisive statement
  quantifiedImpact: {
    rootCause: string // Specific confirmed/likely root cause
    breakdownCount: number
    timeSpan: string
    downtimeHours: string // Estimated total hours
    downtimePerEvent: string // Average hours per event
    riskLevel: 'low' | 'medium' | 'high'
    riskRationale: string
  }
  driverTree: string // Cause → Effect chain
  actionableRecommendations: Array<{
    action: string
    timeframe: 'immediate' | 'within_24h' | 'within_week' | 'next_service'
    owner: 'technician' | 'engineer' | 'specialist'
    expectedOutcome: string
  }>
  resolutionProbability: {
    probability: string // e.g., "80-90%"
    escalationPath: string
  }
  evidenceEventIds: string[]
}

/**
 * Evidence Summary
 * Structured summary of evidence for technical analysis
 */
export interface EvidenceSummary {
  occurrences: string // e.g., "5 breakdowns"
  timeSpan: string // e.g., "2024-10-01 to 2024-10-22"
  keySymptoms: string[]
  errorCodes: string[]
  evidenceEventIds: string[]
}

/**
 * Root Cause Chain
 * Cause-effect chain showing progression from root cause to consequence
 */
export interface RootCauseChain {
  rootCause: string // Primary root cause
  confidence: string // e.g., "85%"
  causeEffectChain: string // Root → Intermediate → Final consequence
  supportingEvidence: Array<{
    evidence: string
    evidenceEventIds: string[]
  }>
}

/**
 * Alternative Cause
 * Other potential causes to rule out
 */
export interface AlternativeCause {
  cause: string
  confidence: string // Lower confidence %
  reasoning: string
  evidenceEventIds: string[]
}

/**
 * Root Cause Assessment
 * Comprehensive root cause analysis with primary and alternative causes
 */
export interface RootCauseAssessment {
  mostLikelyChain: RootCauseChain
  alternativeCauses: AlternativeCause[]
}

/**
 * Recommended Action
 * Specific, actionable recommendation with timeframe and owner
 */
export interface RecommendedAction {
  priority: number
  action: string // Specific task
  timeframe: 'immediate' | 'within_24h' | 'within_week' | 'next_service'
  owner: 'technician' | 'engineer' | 'specialist' | 'management'
  justification: string // Why this matters
  evidenceEventIds: string[]
}

/**
 * Expected Outcome
 * What should happen after recommended actions are taken
 */
export interface ExpectedOutcome {
  behaviorChange: string // How lift behavior should change
  successProbability: string // % likelihood
  verificationMethod: string // How to confirm fix
  escalationPath: string // Next steps if issue persists
}

/**
 * Component Diagnostic (Enhanced)
 * Technical analysis at component level with detailed recommendations
 */
export interface ComponentDiagnosticEnhanced {
  component: string
  issues: string[]
  evidenceEventIds: string[]
  technicalDetails: string
  recommendations: string[]
}

/**
 * Technical Analysis (Enhanced)
 * Technical expert view with deep insights and actionable recommendations
 * All content must be derived from and reference CoreAnalysis
 */
export interface TechnicalAnalysis {
  executiveSummary: string // 1-2 sentence technical verdict: root cause + consequence
  patternAnalysis: PatternAnalysis[] // Detailed analysis for each pattern from coreAnalysis
  evidenceSummary: EvidenceSummary
  rootCauseAssessment: RootCauseAssessment
  recommendedActions: RecommendedAction[]
  expectedOutcome: ExpectedOutcome
  componentDiagnostics: ComponentDiagnosticEnhanced[]
  confidenceLevel: 'low' | 'medium' | 'high'
}

/**
 * Diagnostic Analysis V2
 * Complete analysis with three complementary views
 */
export interface DiagnosticAnalysisV2 {
  coreAnalysis: CoreAnalysis
  operationalAnalysis: OperationalAnalysis
  technicalAnalysis: TechnicalAnalysis
}

/**
 * Validate evidence integrity
 * Ensures all referenced eventIds exist in coreAnalysis.timeline
 */
export function validateEvidenceIntegrity(analysis: DiagnosticAnalysisV2): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const validEventIds = new Set(analysis.coreAnalysis.timeline.map(e => e.eventId))
  const validPartIds = new Set(analysis.coreAnalysis.linkedParts.map(p => p.partId))
  const validPatternIds = new Set(analysis.coreAnalysis.patterns.map(p => p.patternId))

  // Check operational timeline
  if (analysis.operationalAnalysis?.narrativeTimeline) {
    analysis.operationalAnalysis.narrativeTimeline.forEach((evt, idx) => {
      if (evt.evidenceEventIds) {
        evt.evidenceEventIds.forEach(id => {
          if (!validEventIds.has(id)) {
            errors.push(`Operational timeline event ${idx}: Invalid evidenceEventId "${id}"`)
          }
        })
      }
    })
  }

  // Check action log
  if (analysis.operationalAnalysis?.actionLog) {
    analysis.operationalAnalysis.actionLog.forEach((action, idx) => {
      if (action.evidenceEventIds) {
        action.evidenceEventIds.forEach(id => {
          if (!validEventIds.has(id)) {
            errors.push(`Action log entry ${idx}: Invalid evidenceEventId "${id}"`)
          }
        })
      }
    })
  }

  // Check current status
  if (analysis.operationalAnalysis?.currentStatus?.evidenceEventIds) {
    analysis.operationalAnalysis.currentStatus.evidenceEventIds.forEach(id => {
      if (!validEventIds.has(id)) {
        errors.push(`Current status: Invalid evidenceEventId "${id}"`)
      }
    })
  }

  // Check evidence summary
  if (analysis.technicalAnalysis?.evidenceSummary?.evidenceEventIds) {
    analysis.technicalAnalysis.evidenceSummary.evidenceEventIds.forEach(id => {
      if (!validEventIds.has(id)) {
        errors.push(`Evidence summary: Invalid evidenceEventId "${id}"`)
      }
    })
  }

  // Check pattern analysis
  if (analysis.technicalAnalysis?.patternAnalysis) {
    analysis.technicalAnalysis.patternAnalysis.forEach((pattern, idx) => {
      if (pattern.evidenceEventIds) {
        pattern.evidenceEventIds.forEach(id => {
          if (!validEventIds.has(id)) {
            errors.push(`Pattern analysis ${idx}: Invalid evidenceEventId "${id}"`)
          }
        })
      }
    })
  }

  // Check root cause assessment
  if (analysis.technicalAnalysis?.rootCauseAssessment) {
    const rca = analysis.technicalAnalysis.rootCauseAssessment
    
    // Check most likely chain supporting evidence
    if (rca.mostLikelyChain?.supportingEvidence) {
      rca.mostLikelyChain.supportingEvidence.forEach((evidence, idx) => {
        if (evidence.evidenceEventIds) {
          evidence.evidenceEventIds.forEach(id => {
            if (!validEventIds.has(id)) {
              errors.push(`Root cause assessment - most likely chain evidence ${idx}: Invalid evidenceEventId "${id}"`)
            }
          })
        }
      })
    }

    // Check alternative causes
    if (rca.alternativeCauses) {
      rca.alternativeCauses.forEach((alt, idx) => {
        if (alt.evidenceEventIds) {
          alt.evidenceEventIds.forEach(id => {
            if (!validEventIds.has(id)) {
              errors.push(`Alternative cause ${idx}: Invalid evidenceEventId "${id}"`)
            }
          })
        }
      })
    }
  }

  // Check recommended actions
  if (analysis.technicalAnalysis?.recommendedActions) {
    analysis.technicalAnalysis.recommendedActions.forEach((action, idx) => {
      if (action.evidenceEventIds) {
        action.evidenceEventIds.forEach(id => {
          if (!validEventIds.has(id)) {
            errors.push(`Recommended action ${idx}: Invalid evidenceEventId "${id}"`)
          }
        })
      }
    })
  }

  // Check component diagnostics
  if (analysis.technicalAnalysis?.componentDiagnostics) {
    analysis.technicalAnalysis.componentDiagnostics.forEach((comp, idx) => {
      if (comp.evidenceEventIds) {
        comp.evidenceEventIds.forEach(id => {
          if (!validEventIds.has(id)) {
            errors.push(`Component diagnostic ${idx}: Invalid evidenceEventId "${id}"`)
          }
        })
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors
  }
}


