/**
 * Utility functions for parsing date ranges from user context
 */

/**
 * Parse date range from user context text
 * Examples:
 * - "last 2 weeks" -> 14
 * - "last week" -> 7
 * - "last 30 days" -> 30
 * - "last month" -> 30
 * - "last 3 months" -> 90
 * - "last year" -> 365
 * - "focus on issues in the last 2 weeks" -> 14
 * Default: 90 days
 */
export function parseDaysFromContext(context: string | undefined): number {
  if (!context) {
    return 90 // Default: last 90 days
  }
  
  const lowerContext = context.toLowerCase()
  
  // Patterns to match
  const patterns = [
    { regex: /last\s+(\d+)\s+weeks?/i, multiplier: 7 },
    { regex: /last\s+week/i, multiplier: 7 },
    { regex: /(\d+)\s+weeks?/i, multiplier: 7 },
    { regex: /last\s+(\d+)\s+months?/i, multiplier: 30 },
    { regex: /last\s+month/i, multiplier: 30 },
    { regex: /(\d+)\s+months?/i, multiplier: 30 },
    { regex: /last\s+(\d+)\s+days?/i, multiplier: 1 },
    { regex: /(\d+)\s+days?/i, multiplier: 1 },
    { regex: /last\s+year/i, multiplier: 365 },
    { regex: /(\d+)\s+years?/i, multiplier: 365 },
  ]
  
  for (const pattern of patterns) {
    const match = lowerContext.match(pattern.regex)
    if (match) {
      const number = match[1] ? parseInt(match[1], 10) : 1
      const days = number * pattern.multiplier
      // Cap at reasonable limits: minimum 1 day, maximum 2 years
      return Math.max(1, Math.min(days, 730))
    }
  }
  
  // Default to 90 days if no pattern matches
  return 90
}













