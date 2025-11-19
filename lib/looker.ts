/**
 * Looker API integration utilities for fetching lift diagnostic data
 */

import { Looker40SDK } from '@looker/sdk'
import { LookerNodeSDK, NodeSession, NodeTransport } from '@looker/sdk-node'
import { ApiSettings, type IApiSection } from '@looker/sdk-rtl'

/**
 * Custom settings that implements IApiSettings interface
 */
class CustomNodeSettings extends ApiSettings {
  private readonly configValues: IApiSection
  
  constructor(baseUrl: string, clientId: string, clientSecret: string) {
    super({ base_url: baseUrl } as any)
    this.configValues = {
      base_url: baseUrl,
      client_id: clientId,
      client_secret: clientSecret,
    }
  }
  
  readConfig(_section?: string): IApiSection {
    return this.configValues
  }
}

/**
 * Initialize Looker SDK client
 */
export async function getLookerClient(): Promise<Looker40SDK> {
  if (process.env.LOOKER_API_BASE_URL && process.env.LOOKER_CLIENT_ID && process.env.LOOKER_CLIENT_SECRET) {
    let baseUrl = process.env.LOOKER_API_BASE_URL.trim()
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1)
    }
    
    const clientId = process.env.LOOKER_CLIENT_ID.trim()
    const clientSecret = process.env.LOOKER_CLIENT_SECRET.trim()
    
    const settings = new CustomNodeSettings(baseUrl, clientId, clientSecret)
    const transport = new NodeTransport(settings)
    const session = new NodeSession(settings, transport)
    return new Looker40SDK(session)
  } else {
    return LookerNodeSDK.init40()
  }
}

/**
 * Fetch buildings from Looker
 * Uses LOOKER_BUILDINGS_LOOK_ID or LOOKER_BUILDINGS_QUERY_ID env var
 */
export async function fetchBuildings(): Promise<any[]> {
  const sdk = await getLookerClient()
  
  try {
    const lookId = process.env.LOOKER_BUILDINGS_LOOK_ID
    const queryId = process.env.LOOKER_BUILDINGS_QUERY_ID
    
    let result
    if (lookId) {
      result = await sdk.run_look({
        look_id: parseInt(lookId),
        result_format: 'json',
      })
    } else if (queryId) {
      result = await sdk.run_query({
        query_id: parseInt(queryId),
        result_format: 'json',
      })
    } else {
      throw new Error('LOOKER_BUILDINGS_LOOK_ID or LOOKER_BUILDINGS_QUERY_ID must be set')
    }
    
    return parseLookerResult(result)
  } catch (error) {
    console.error('[Looker] Error fetching buildings:', error)
    throw error
  }
}

/**
 * Fetch units for a specific building
 * Uses LOOKER_UNITS_LOOK_ID or LOOKER_UNITS_QUERY_ID env var
 */
export async function fetchUnits(buildingId: string): Promise<any[]> {
  const sdk = await getLookerClient()
  
  try {
    const lookId = process.env.LOOKER_UNITS_LOOK_ID
    const queryId = process.env.LOOKER_UNITS_QUERY_ID
    
    let result
    if (lookId) {
      result = await sdk.run_look({
        look_id: parseInt(lookId),
        result_format: 'json',
        filters: { 'building.id': buildingId },
      })
    } else if (queryId) {
      // For queries, we might need to use filters differently
      result = await sdk.run_query({
        query_id: parseInt(queryId),
        result_format: 'json',
        filters: { 'building.id': buildingId },
      })
    } else {
      throw new Error('LOOKER_UNITS_LOOK_ID or LOOKER_UNITS_QUERY_ID must be set')
    }
    
    return parseLookerResult(result)
  } catch (error) {
    console.error('[Looker] Error fetching units:', error)
    throw error
  }
}

/**
 * Fetch visit reports for a unit (last 30-90 days)
 * Uses LOOKER_VISITS_LOOK_ID or LOOKER_VISITS_QUERY_ID env var
 */
export async function fetchVisitReports(unitId: string, daysBack: number = 90): Promise<any[]> {
  const sdk = await getLookerClient()
  
  try {
    const lookId = process.env.LOOKER_VISITS_LOOK_ID
    const queryId = process.env.LOOKER_VISITS_QUERY_ID
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    
    let result
    if (lookId) {
      result = await sdk.run_look({
        look_id: parseInt(lookId),
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'visit.date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else if (queryId) {
      result = await sdk.run_query({
        query_id: parseInt(queryId),
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'visit.date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else {
      throw new Error('LOOKER_VISITS_LOOK_ID or LOOKER_VISITS_QUERY_ID must be set')
    }
    
    return parseLookerResult(result)
  } catch (error) {
    console.error('[Looker] Error fetching visit reports:', error)
    throw error
  }
}

/**
 * Fetch fault logs for a unit (last 30-90 days)
 * Uses LOOKER_FAULTS_LOOK_ID or LOOKER_FAULTS_QUERY_ID env var
 */
export async function fetchFaultLogs(unitId: string, daysBack: number = 90): Promise<any[]> {
  const sdk = await getLookerClient()
  
  try {
    const lookId = process.env.LOOKER_FAULTS_LOOK_ID
    const queryId = process.env.LOOKER_FAULTS_QUERY_ID
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    
    let result
    if (lookId) {
      result = await sdk.run_look({
        look_id: parseInt(lookId),
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'fault.date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else if (queryId) {
      result = await sdk.run_query({
        query_id: parseInt(queryId),
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'fault.date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else {
      throw new Error('LOOKER_FAULTS_LOOK_ID or LOOKER_FAULTS_QUERY_ID must be set')
    }
    
    return parseLookerResult(result)
  } catch (error) {
    console.error('[Looker] Error fetching fault logs:', error)
    throw error
  }
}

/**
 * Fetch IoT alerts for a unit
 * Uses LOOKER_IOT_ALERTS_LOOK_ID or LOOKER_IOT_ALERTS_QUERY_ID env var
 */
export async function fetchIoTAlerts(unitId: string, daysBack: number = 90): Promise<any[]> {
  const sdk = await getLookerClient()
  
  try {
    const lookId = process.env.LOOKER_IOT_ALERTS_LOOK_ID
    const queryId = process.env.LOOKER_IOT_ALERTS_QUERY_ID
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    
    let result
    if (lookId) {
      result = await sdk.run_look({
        look_id: parseInt(lookId),
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'alert.date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else if (queryId) {
      result = await sdk.run_query({
        query_id: parseInt(queryId),
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'alert.date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else {
      // IoT alerts are optional, return empty array if not configured
      return []
    }
    
    return parseLookerResult(result)
  } catch (error) {
    console.error('[Looker] Error fetching IoT alerts:', error)
    // Return empty array on error since IoT alerts are optional
    return []
  }
}

/**
 * Fetch parts replaced for a unit (last 30-90 days)
 * Uses LOOKER_PARTS_LOOK_ID or LOOKER_PARTS_QUERY_ID env var
 */
export async function fetchPartsReplaced(unitId: string, daysBack: number = 90): Promise<any[]> {
  const sdk = await getLookerClient()
  
  try {
    const lookId = process.env.LOOKER_PARTS_LOOK_ID
    const queryId = process.env.LOOKER_PARTS_QUERY_ID
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    
    let result
    if (lookId) {
      result = await sdk.run_look({
        look_id: parseInt(lookId),
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'part.replaced_date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else if (queryId) {
      result = await sdk.run_query({
        query_id: parseInt(queryId),
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'part.replaced_date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else {
      // Parts are optional, return empty array if not configured
      return []
    }
    
    return parseLookerResult(result)
  } catch (error) {
    console.error('[Looker] Error fetching parts:', error)
    return []
  }
}

/**
 * Parse Looker result into array format
 */
function parseLookerResult(result: any): any[] {
  if (typeof result === 'string') {
    return JSON.parse(result)
  } else if (Array.isArray(result)) {
    return result
  } else if (result && typeof result === 'object') {
    if ('data' in result) {
      return Array.isArray(result.data) ? result.data : []
    } else if ('rows' in result) {
      return Array.isArray(result.rows) ? result.rows : []
    } else if ('values' in result) {
      return Array.isArray(result.values) ? result.values : []
    } else {
      const arrayKeys = Object.keys(result).filter(key => Array.isArray((result as any)[key]))
      if (arrayKeys.length > 0) {
        return (result as any)[arrayKeys[0]]
      } else {
        return [result]
      }
    }
  }
  return []
}

