/**
 * Configuration for diagnostic analysis versioning
 * 
 * Manages the feature flag for v1/v2 analysis system
 */

export type AnalysisVersion = 'v1' | 'v2'

/**
 * Get the current analysis version from environment variable
 * Defaults to 'v1' for backward compatibility
 */
export function getAnalysisVersion(): AnalysisVersion {
  const version = process.env.DIAGNOSTIC_ANALYSIS_VERSION || 'v1'
  
  if (version !== 'v1' && version !== 'v2') {
    console.warn(`[Analysis Config] Invalid DIAGNOSTIC_ANALYSIS_VERSION "${version}", defaulting to v1`)
    return 'v1'
  }
  
  return version
}

/**
 * Check if v2 is enabled
 */
export function isV2Enabled(): boolean {
  return getAnalysisVersion() === 'v2'
}

/**
 * Log the current analysis version (for debugging)
 */
export function logAnalysisVersion(): void {
  const version = getAnalysisVersion()
  console.log(`[Analysis Config] Using diagnostic analysis version: ${version}`)
}


