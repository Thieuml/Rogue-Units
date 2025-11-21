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
    
    console.log('[Looker] Initializing client with:', {
      baseUrl: baseUrl,
      baseUrlValid: baseUrl.startsWith('http'),
      clientId: clientId ? `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 2)}` : 'NOT SET',
      clientSecret: clientSecret ? 'SET (length: ' + clientSecret.length + ')' : 'NOT SET',
    })
    
    // Validate base URL format
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      throw new Error(`LOOKER_API_BASE_URL must start with http:// or https://. Current value: ${baseUrl}`)
    }
    
    const settings = new CustomNodeSettings(baseUrl, clientId, clientSecret)
    const transport = new NodeTransport(settings)
    const session = new NodeSession(settings, transport)
    return new Looker40SDK(session)
  } else {
    console.warn('[Looker] Environment variables not set, trying ini file fallback')
    return LookerNodeSDK.init40()
  }
}

/**
 * Fetch buildings and devices from Looker (single Look)
 * Uses LOOKER_BUILDINGS_LOOK_ID env var (Look ID 161)
 * This single Look contains both buildings and devices data
 * Filters by country code (FR, UK, SG, HK)
 */
export async function fetchBuildingsAndDevices(countryCode: string): Promise<{
  buildings: Array<{
    id: string
    name: string
    address: string
    country: string
  }>
  devices: Array<{
    id: string
    name: string
    buildingId: string
    buildingName: string
    buildingAddress: string
    country: string
  }>
}> {
  console.log('[Looker] Starting fetchBuildingsAndDevices for country:', countryCode)
  
  const sdk = await getLookerClient()
  console.log('[Looker] SDK client initialized')
  
  try {
    const lookId = process.env.LOOKER_BUILDINGS_LOOK_ID
    console.log('[Looker] Look ID from env:', lookId)
    
    if (!lookId) {
      throw new Error('LOOKER_BUILDINGS_LOOK_ID must be set')
    }
    
    // Map country codes to Looker filter values
    const countryFilterMap: Record<string, string> = {
      'FR': 'FR',
      'UK': 'GB', // UK might be stored as GB in Looker
      'SG': 'SG',
      'HK': 'HK',
    }
    
    const lookerCountryCode = countryFilterMap[countryCode] || countryCode
    console.log('[Looker] Using country code:', lookerCountryCode, 'for filter')
    
    // Filter by account billing country code
    // Looker SDK accepts filters as a map in the request
    console.log('[Looker] Calling run_look with:', {
      look_id: lookId,
      filter: 'account.billing_country_code',
      filter_value: lookerCountryCode,
    })
    
    let result
    try {
      result = await (sdk.run_look as any)({
        look_id: lookId,
        result_format: 'json',
        filters: {
          'account.billing_country_code': lookerCountryCode,
        },
      })
      
      console.log('[Looker] Raw result type:', typeof result)
      console.log('[Looker] Raw result sample (first 500 chars):', JSON.stringify(result).substring(0, 500))
      
      // Check if result contains an error - Looker SDK sometimes returns error objects instead of throwing
      if (result && typeof result === 'object') {
        // Check for error property or ok: false
        if ('error' in result) {
          const errorMsg = result.error?.message || JSON.stringify(result.error) || 'Unknown Looker error'
          const errorType = result.error?.type || 'sdk_error'
          console.error('[Looker] API returned error in response:', { errorMsg, errorType, fullResult: result })
          throw new Error(`Looker API error (${errorType}): ${errorMsg}`)
        }
        if (result.ok === false) {
          const errorMsg = result.error?.message || 'Looker API returned ok: false'
          console.error('[Looker] API returned ok: false:', result)
          throw new Error(`Looker API error: ${errorMsg}`)
        }
      }
  } catch (error) {
      console.error('[Looker] Error calling run_look:', error)
      console.error('[Looker] Error type:', typeof error)
      console.error('[Looker] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined,
        stack: error instanceof Error ? error.stack : undefined,
        cause: (error as any)?.cause,
      })
      
      // Check if it's a network/connection error
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase()
        if (errorMsg.includes('fetch failed') || errorMsg.includes('econnrefused') || errorMsg.includes('enotfound') || errorMsg.includes('network')) {
          const baseUrl = process.env.LOOKER_API_BASE_URL || 'NOT SET'
          throw new Error(`Cannot connect to Looker API at ${baseUrl}.\n\nPlease check:\n1. LOOKER_API_BASE_URL is correct (should be like https://yourcompany.cloud.looker.com)\n2. Network connectivity (can you access Looker in browser?)\n3. VPN/network access if required\n4. SSL certificate issues\n\nOriginal error: ${error.message}`)
        }
        if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
          throw new Error(`Looker authentication failed.\n\nPlease check:\n1. LOOKER_CLIENT_ID is correct\n2. LOOKER_CLIENT_SECRET is correct\n3. API credentials have proper permissions\n\nOriginal error: ${error.message}`)
        }
        if (errorMsg.includes('404') || errorMsg.includes('not found')) {
          throw new Error(`Looker Look not found.\n\nPlease check:\n1. LOOKER_BUILDINGS_LOOK_ID=${lookId} exists\n2. You have access to this Look\n\nOriginal error: ${error.message}`)
        }
      }
      throw error
    }
    
    const rows = parseLookerResult(result)
    console.log(`[Looker] Parsed ${rows.length} rows for country ${countryCode}`)
    
    // Debug: Log the first row to see actual field names
    if (rows.length > 0) {
      console.log('[Looker] First row sample:', JSON.stringify(rows[0], null, 2))
      console.log('[Looker] First row keys:', Object.keys(rows[0]))
    }
    
    // Extract unique buildings and all devices
    const buildingsMap = new Map<string, {
      id: string
      name: string
      address: string
      country: string
    }>()
    
    const devices: Array<{
      id: string
      name: string
      buildingId: string
      buildingName: string
      buildingAddress: string
      country: string
    }> = []
    
    rows.forEach((row: any, index: number) => {
      // Extract building info - field names from Look columns
      // Try multiple possible field name formats
      // DEBUG: Log first row to help identify field names
      if (index === 0) {
        console.log('[Looker] DEBUG - First row structure:', {
          allKeys: Object.keys(row),
          sampleValues: Object.fromEntries(
            Object.entries(row).slice(0, 10).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])
          )
        })
      }
      
      // Extract fields using the actual Looker field names
      // Based on Looker response: building.building_id, building.name, building.full_address, device.device_id, device.location
      const buildingId = (
        row['building.building_id']?.toString() ||
        row['building_id']?.toString() ||
        row['Building ID']?.toString() ||
        row['building.id']?.toString() ||
        ''
      )
      const buildingName = (
        row['building.name'] ||
        row['building_name'] ||
        row['Building name'] ||
        row['Building Name'] ||
        ''
      )
      const buildingAddress = (
        row['building.full_address'] ||
        row['building_full_address'] ||
        row['Full address'] ||
        row['Full Address'] ||
        row['full_address'] ||
        ''
      )
      // Extract country - try multiple field name variations
      const rowCountry = (
        row['Country'] || 
        row['country'] || 
        row['Account Country'] ||
        row['account.country'] ||
        row['account_country'] ||
        row['account.billing_country_code'] ||
        row['account_billing_country_code'] ||
        ''
      )
      
      // Normalize country code for comparison
      // Map GB <-> UK for consistency
      let normalizedRowCountry = rowCountry.toUpperCase().trim()
      if (normalizedRowCountry === 'GB') {
        normalizedRowCountry = 'UK'
      }
      
      // Normalize requested country (already mapped GB -> UK in countryFilterMap)
      const normalizedRequestCountry = countryCode.toUpperCase().trim()
      
      // Filter by country - only include rows that match the requested country
      // This is a safety measure in case Looker filter doesn't work correctly
      if (normalizedRowCountry && normalizedRowCountry !== normalizedRequestCountry) {
        // Skip this row if country doesn't match
        if (index < 5) {
          console.log(`[Looker] Skipping row ${index} - country mismatch: row has "${normalizedRowCountry}", requested "${normalizedRequestCountry}" (Looker filter: "${lookerCountryCode}")`)
        }
        return
      }
      
      // Use the normalized country or fallback to requested country
      const country = normalizedRowCountry || countryCode
      const deviceId = (
        row['device.device_id']?.toString() ||
        row['device_id']?.toString() ||
        row['Device ID']?.toString() ||
        row['device.id']?.toString() ||
        ''
      )
      const deviceName = (
        row['device.location'] ||
        row['device_location'] ||
        row['Device Name'] ||
        row['Device Name'] ||
        row['device.name'] ||
        row['device_name'] ||
        ''
      )
      
      // Debug: Log if we can't find required fields
      if (index === 0 && (!buildingId || !buildingName || !deviceId || !deviceName)) {
        console.warn('[Looker] WARNING - Missing fields in first row:', {
          buildingId: buildingId || 'NOT FOUND',
          buildingName: buildingName || 'NOT FOUND',
          deviceId: deviceId || 'NOT FOUND',
          deviceName: deviceName || 'NOT FOUND',
          availableKeys: Object.keys(row)
        })
      }
      
      if (buildingId && !buildingsMap.has(buildingId)) {
        buildingsMap.set(buildingId, {
          id: buildingId,
          name: buildingName,
          address: buildingAddress,
          country: country,
        })
      }
      
      if (deviceId && buildingId) {
        devices.push({
          id: deviceId,
          name: deviceName,
          buildingId: buildingId,
          buildingName: buildingName,
          buildingAddress: buildingAddress,
          country: country,
      })
      }
    })
    
    const extractedData = {
      buildings: Array.from(buildingsMap.values()),
      devices: devices,
    }
    
    console.log(`[Looker] Extracted ${extractedData.buildings.length} unique buildings and ${extractedData.devices.length} devices`)
    
    if (extractedData.buildings.length === 0 && rows.length > 0) {
      console.warn('[Looker] WARNING: No buildings extracted despite having rows. Check field name mapping.')
    }
    if (extractedData.devices.length === 0 && rows.length > 0) {
      console.warn('[Looker] WARNING: No devices extracted despite having rows. Check field name mapping.')
    }
    
    return extractedData
  } catch (error) {
    console.error('[Looker] Error fetching buildings and devices:', error)
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : { error: String(error) }
    console.error('[Looker] Error details:', errorDetails)
    throw error
  }
}

/**
 * Fetch visit reports (tasks) for a device (last N days, default 90)
 * Uses LOOKER_VISITS_LOOK_ID (Look ID 162)
 * This Look contains completed tasks with:
 * - Completed Date (task.completed_date)
 * - Engineer Full Name (done_by_engineer.full_name)
 * - Task Type (task.type: REGULAR, BREAKDOWN, REPAIR, etc.)
 * - Device End Status (task_summary.end_status)
 * - Global Comment (task_summary.global_comment)
 * - PDF Report URL (task.pdf_report)
 * - Defect Origin (task_summary.defect_origin)
 * - Component Impacted (task_summary.failure_location)
 * - Problem (task_summary.failure_reasons)
 */
export async function fetchVisitReports(deviceId: string, daysBack: number = 90): Promise<any[]> {
  console.log('[Looker] Starting fetchVisitReports for device:', deviceId, 'daysBack:', daysBack)
  const sdk = await getLookerClient()
  
  try {
    const lookId = process.env.LOOKER_VISITS_LOOK_ID
    
    if (!lookId) {
      throw new Error('LOOKER_VISITS_LOOK_ID must be set (expected Look ID 162)')
    }
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    const startDateStr = startDate.toISOString().split('T')[0]
    
    console.log('[Looker] Fetching visit reports with filters:', {
      lookId,
      deviceId,
      startDate: startDateStr,
      daysBack,
      filterFields: {
        deviceFilter: 'device.device_id',
        dateFilter: 'task.completed_date',
      },
    })
    
    // CRITICAL: Both run_look and run_query with filters don't work reliably in Looker
    // Even when filters are configured in the Look, Looker often ignores dynamic filter values
    // The ONLY reliable solution is to create a new inline query with filters baked in
    
    console.log('[Looker] Creating inline query with filters baked in (bypassing Look filters)...')
    
    // Create an inline query based on Look 162's structure but with our filters
    const result = await (sdk.run_inline_query as any)({
        result_format: 'json',
      body: {
        model: 'maintenance_completion',  // From your LookML
        view: 'task',  // From your LookML
        fields: [
          'device.device_id',
          'task.completed_date',
          'task.task_id',
          'done_by_engineer.full_name',
          'task.type',
          'task_summary.end_status',
          'task_summary.global_comment',
          'task.pdf_report',
          'task_summary.defect_origin',
          'task_summary.failure_reasons',
          'task_summary.failure_location'
        ],
        filters: {
          'device.device_id': deviceId.toString(),
          'task.completed_date': `${daysBack} days`
        },
        sorts: ['task.completed_date desc'],
        limit: '5000'
      }
    })
    
    console.log('[Looker] Inline query executed successfully')
    
    // Check for errors in response FIRST (before parsing) - matches pattern from fetchBuildingsAndDevices
    if (result && typeof result === 'object') {
      if ('error' in result || result.ok === false) {
        const errorMsg = (result as any).error?.message || 'Looker API returned ok: false'
        const errorType = (result as any).error?.type || 'sdk_error'
        console.error('[Looker] API returned error in response:', {
          errorMsg,
          errorType,
          fullResult: result
        })
        throw new Error(`Looker API error (${errorType}): ${errorMsg}`)
      }
    }
    
    // Debug: Verify filters were applied (now that device.device_id is in output)
    const rows = parseLookerResult(result)
    const sampleRows = rows.slice(0, 10)
    const sampleDeviceIds = sampleRows.map((row: any) => 
      row['device.device_id']?.toString() || row['device_id']?.toString() || 'NOT_FOUND'
    )
    const allMatchExpected = sampleDeviceIds.length > 0 && sampleDeviceIds.every(id => id.toString() === deviceId.toString())
    
    console.log('[Looker] Look result:', {
      hasValue: !!result,
      valueLength: rows.length,
      firstRowKeys: sampleRows[0] ? Object.keys(sampleRows[0]) : 'no rows',
      sampleDeviceIds: sampleDeviceIds,
      expectedDeviceId: deviceId,
      filterWorking: allMatchExpected ? '✓ YES' : '✗ NO',
    })
    
    // CRITICAL: If filters aren't working, we MUST fail loudly to prevent data loss
    // Client-side filtering is NOT a safe workaround because:
    // - If there are >5000 total rows, Looker returns only first 5000
    // - Client-side filtering would miss data that's in rows 5001+
    // - This results in silently incomplete data, which is worse than failing
    
    if (rows.length > 0 && !allMatchExpected) {
      const errorMsg = [
        '❌ CRITICAL: Looker query filters are NOT working properly',
        '',
        `Expected device.device_id="${deviceId}" but received data for different devices:`,
        `  ${sampleDeviceIds.slice(0, 5).join(', ')}`,
        '',
        'The query is not filtering correctly despite passing filter parameters.',
        'Without proper filtering, data may be incomplete or missing.',
        '',
        `📊 Current state: Received ${rows.length} rows`,
        rows.length >= 5000 ? '   ⚠️  At maximum row limit (5000) - data is definitely incomplete!' : '',
        '',
        '🔍 Possible causes:',
        '1. The underlying Looker query may not support dynamic filters',
        '2. Filter expression syntax may be incorrect',
        '3. Query may have additional constraints preventing filter from working',
        '',
        '🔧 Troubleshooting steps:',
        '',
        '1. Test the filter manually in Looker:',
        `   - Open Look 162: https://wemaintain.cloud.looker.com/looks/162`,
        `   - Set device.device_id filter to: ${deviceId}`,
        '   - Run and verify it returns only that device\'s data',
        '',
        '2. Check the Look\'s underlying query allows filtering on device.device_id',
        '',
        '3. Verify the filter is not overridden by other constraints',
        '',
        'See LOOKER_FILTER_FIX.md for detailed debugging information.',
      ].filter(Boolean).join('\n')
      
      console.error('[Looker] ' + errorMsg)
      
      throw new Error(
        `Looker filters not configured: Look 162 must have filterable fields for device.device_id and task.completed_date. ` +
        `Received ${rows.length} rows with wrong device IDs (${sampleDeviceIds.slice(0, 3).join(', ')}...) instead of ${deviceId}. ` +
        `Configure Look 162 in Looker before using this application. See logs for detailed instructions.`
      )
    }
    
    console.log(`[Looker] Parsed ${rows.length} visit report rows for device ${deviceId}`)
    
    // Map Look columns to standardized format
    const mappedRows = rows.map((row: any, index: number) => {
      // Extract fields using the actual Looker field names
      const completedDate = (
        row['task.completed_date'] ||
        row['Completed Date'] ||
        row['completed_date'] ||
        row['task_completed_date'] ||
        ''
      )
      const fullName = (
        row['done_by_engineer.full_name'] ||
        row['Full Name'] ||
        row['full_name'] ||
        row['done_by_engineer_full_name'] ||
        ''
      )
      const type = (
        row['task.type'] ||
        row['Type'] ||
        row['type'] ||
        row['task_type'] ||
        ''
      )
      const endStatus = (
        row['task_summary.end_status'] ||
        row['Device End Status'] ||
        row['end_status'] ||
        row['task_summary_end_status'] ||
        ''
      )
      const globalComment = (
        row['task_summary.global_comment'] ||
        row['Global Comment'] ||
        row['global_comment'] ||
        row['task_summary_global_comment'] ||
        ''
      )
      const taskId = (
        row['task.task_id'] ||
        row['task_id'] ||
        row['task_task_id'] ||
        ''
      )
      // Construct PDF URL from task_id
      const pdfReport = taskId 
        ? `https://wemaintain-data-prod.s3.eu-west-1.amazonaws.com/missions/reports/tasks/${taskId}`
        : (
          row['task.pdf_report'] ||
          row['PDF Report'] ||
          row['pdf_report'] ||
          row['task_pdf_report'] ||
          ''
        )
      const origin = (
        row['task_summary.defect_origin'] ||
        row['Origin'] ||
        row['origin'] ||
        row['task_summary_defect_origin'] ||
        ''
      )
      const componentImpacted = (
        row['task_summary.failure_location'] ||
        row['Component Impacted'] ||
        row['component_impacted'] ||
        row['task_summary_failure_location'] ||
        ''
      )
      const problem = (
        row['task_summary.failure_reasons'] ||
        row['Problem'] ||
        row['problem'] ||
        row['task_summary_failure_reasons'] ||
        ''
      )
      
      // Debug: Log first row to help identify field names
      if (index === 0) {
        console.log('[Looker] DEBUG - First visit report row structure:', {
          allKeys: Object.keys(row),
          mappedFields: {
            completedDate,
            taskId,
            fullName,
            type,
            endStatus,
            globalComment: globalComment?.substring(0, 50) + '...',
            pdfReport,
            origin,
            componentImpacted,
            problem,
          }
        })
      }
      
      return {
        date: completedDate,
        completedDate,
        engineer: fullName,
        fullName,
        type: type.toUpperCase() || 'UNKNOWN',
        endStatus,
        globalComment,
        pdfReport,
        origin,
        componentImpacted,
        problem,
        taskId,
        // Combined fault information
        fault: {
          origin,
          componentImpacted,
          problem,
        },
      }
    })
    
    console.log(`[Looker] Mapped ${mappedRows.length} visit reports`)
    return mappedRows
  } catch (error) {
    console.error('[Looker] Error fetching visit reports:', error)
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : { error: String(error) }
    console.error('[Looker] Error details:', errorDetails)
    throw error
  }
}

/**
 * Fetch breakdowns (downtimes) for a device (last N days, default 90)
 * Uses inline query (not Look API) to avoid filter issues
 * This query contains breakdown information with:
 * - Breakdown ID (breakdown.breakdown_id)
 * - Start Time (breakdown.start_time)
 * - End Time (breakdown.end_time) - null if ongoing
 * - Duration in minutes (breakdown.minutes_duration)
 * - Origin (breakdown.origin) - what caused the issue
 * - Failure Locations (breakdown.failure_locations) - component impacted
 * - Internal Comment (breakdown.internal_comment) - OPS tracking
 * - Internal Status (breakdown.internal_status) - OPS status
 * - Visited During Breakdown (breakdown.visited_during_breakdown) - engineer on site
 * - Public Comment (breakdown.public_comment) - customer-facing comment
 */
export async function fetchBreakdowns(deviceId: string, daysBack: number = 90): Promise<any[]> {
  console.log('[Looker] Starting fetchBreakdowns for device:', deviceId, 'daysBack:', daysBack)
  const sdk = await getLookerClient()
  
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    const startDateStr = startDate.toISOString().split('T')[0]
    
    console.log('[Looker] Fetching breakdowns with inline query:', {
      deviceId,
      startDate: startDateStr,
      daysBack,
    })
    
    // Use inline query directly (not Look API) to avoid filter issues
    const result = await (sdk.run_inline_query as any)({
        result_format: 'json',
      body: {
        model: 'maintenance_completion',
        view: 'breakdowns',
        fields: [
          'breakdown.breakdown_id',
          'breakdown.start_time',
          'breakdown.end_time',
          'breakdown.minutes_duration',
          'breakdown.origin',
          'breakdown.failure_locations',
          'breakdown.internal_comment',
          'breakdown.internal_status',
          'breakdown.visited_during_breakdown',
          'breakdown.public_comment',
        ],
        filters: {
          'device.device_id': deviceId.toString(),
          'breakdown.start_date': `${daysBack} days`,
        },
        sorts: ['breakdown.start_time desc'],
        limit: '5000',
      },
    })
    
    console.log('[Looker] Inline query executed successfully')
    
    // Check for errors in response FIRST (before parsing)
    if (result && typeof result === 'object') {
      if ('error' in result || result.ok === false) {
        const errorMsg = (result as any).error?.message || 'Looker API returned ok: false'
        const errorType = (result as any).error?.type || 'sdk_error'
        console.error('[Looker] API returned error in response:', {
          errorMsg,
          errorType,
          fullResult: result,
        })
        throw new Error(`Looker API error (${errorType}): ${errorMsg}`)
      }
    }
    
    const rows = parseLookerResult(result)
    console.log(`[Looker] Parsed ${rows.length} breakdown rows for device ${deviceId}`)
    
    // Map Look columns to standardized format
    const mappedRows = rows.map((row: any, index: number) => {
      const breakdownId = (
        row['breakdown.breakdown_id'] ||
        row['breakdown_id'] ||
        row['Breakdown ID'] ||
        ''
      )
      const startTime = (
        row['breakdown.start_time'] ||
        row['start_time'] ||
        row['Start Time'] ||
        ''
      )
      const endTime = (
        row['breakdown.end_time'] ||
        row['end_time'] ||
        row['End Time'] ||
        null
      )
      const minutesDuration = (
        row['breakdown.minutes_duration'] ||
        row['minutes_duration'] ||
        row['Minutes Duration'] ||
        0
      )
      const origin = (
        row['breakdown.origin'] ||
        row['origin'] ||
        row['Origin'] ||
        ''
      )
      const failureLocations = (
        row['breakdown.failure_locations'] ||
        row['failure_locations'] ||
        row['Failure Locations'] ||
        ''
      )
      const internalComment = (
        row['breakdown.internal_comment'] ||
        row['internal_comment'] ||
        row['Internal Comment'] ||
        ''
      )
      const internalStatus = (
        row['breakdown.internal_status'] ||
        row['internal_status'] ||
        row['Internal Status'] ||
        ''
      )
      const visitedDuringBreakdown = (
        row['breakdown.visited_during_breakdown'] ||
        row['visited_during_breakdown'] ||
        row['Visited During Breakdown'] ||
        false
      )
      const publicComment = (
        row['breakdown.public_comment'] ||
        row['public_comment'] ||
        row['Public Comment'] ||
        ''
      )
      
      if (index === 0) {
        console.log('[Looker] DEBUG - First breakdown row structure:', {
          allKeys: Object.keys(row),
          mappedFields: {
            breakdownId,
            startTime,
            endTime,
            minutesDuration,
            origin,
            failureLocations,
            internalStatus,
            visitedDuringBreakdown,
          },
        })
      }
      
      return {
        breakdownId,
        startTime,
        endTime,
        minutesDuration: parseInt(minutesDuration.toString(), 10) || 0,
        origin,
        failureLocations,
        internalComment,
        internalStatus,
        visitedDuringBreakdown: Boolean(visitedDuringBreakdown),
        publicComment,
        isOngoing: !endTime,
      }
    })
    
    console.log(`[Looker] Mapped ${mappedRows.length} breakdowns`)
    return mappedRows
  } catch (error) {
    console.error('[Looker] Error fetching breakdowns:', error)
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : { error: String(error) }
    console.error('[Looker] Error details:', errorDetails)
    throw error
  }
}

/**
 * Fetch maintenance issues/anomalies raised during maintenance visits (last N days, default 90)
 * Uses inline query (not Look API) to avoid filter issues
 * This query contains issues raised during regular/quarterly/semi-annual maintenance visits:
 * - Completed Date (task.completed_date)
 * - Task Type (task.type: REGULAR, QUARTERLY, SEMI_ANNUAL)
 * - Question (task_questions.question_en) - question shown to engineer
 * - Answer (task_answers.answer_en) - answer from engineer
 * - Problem Key (task_answers.problem_key) - problem impacting the component
 * - State Key (task_answers.state_key) - component impacted
 * - Follow Up (task_answers.follow_up) - whether resolved in the visit
 */
export async function fetchMaintenanceIssues(deviceId: string, daysBack: number = 90): Promise<any[]> {
  console.log('[Looker] Starting fetchMaintenanceIssues for device:', deviceId, 'daysBack:', daysBack)
  const sdk = await getLookerClient()
  
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    const startDateStr = startDate.toISOString().split('T')[0]
    
    console.log('[Looker] Fetching maintenance issues with inline query:', {
      deviceId,
      startDate: startDateStr,
      daysBack,
    })
    
    // Use inline query directly (not Look API) to avoid filter issues
    const result = await (sdk.run_inline_query as any)({
        result_format: 'json',
      body: {
        model: 'maintenance_completion',
        view: 'task',
        fields: [
          'task.task_id',
          'task.completed_date',
          'task.type',
          'task_questions.question_en',
          'task_answers.answer_en',
          'task_answers.problem_key',
          'task_answers.state_key',
          'task_answers.follow_up',
        ],
        filters: {
          'device.device_id': deviceId.toString(),
          'task.completed_date': `${daysBack} days`,
          'task_answers.problem_key': '-EMPTY', // Only get issues with problems (not empty) - Looker syntax: -EMPTY means "not empty"
        },
        sorts: ['task.completed_date desc'],
        limit: '5000',
      },
    })
    
    console.log('[Looker] Inline query executed successfully')
    
    // Check for errors in response FIRST (before parsing)
    if (result && typeof result === 'object') {
      if ('error' in result || result.ok === false) {
        const errorMsg = (result as any).error?.message || 'Looker API returned ok: false'
        const errorType = (result as any).error?.type || 'sdk_error'
        console.error('[Looker] API returned error in response:', {
          errorMsg,
          errorType,
          fullResult: result,
        })
        throw new Error(`Looker API error (${errorType}): ${errorMsg}`)
      }
    }
    
    const rows = parseLookerResult(result)
    console.log(`[Looker] Parsed ${rows.length} maintenance issue rows for device ${deviceId}`)
    
    // Map Look columns to standardized format
    const mappedRows = rows.map((row: any, index: number) => {
      const taskId = (
        row['task.task_id'] ||
        row['task_id'] ||
        row['Task ID'] ||
        ''
      )
      const completedDate = (
        row['task.completed_date'] ||
        row['completed_date'] ||
        row['Completed Date'] ||
        ''
      )
      const type = (
        row['task.type'] ||
        row['type'] ||
        row['Type'] ||
        ''
      )
      const question = (
        row['task_questions.question_en'] ||
        row['question_en'] ||
        row['Question'] ||
        ''
      )
      const answer = (
        row['task_answers.answer_en'] ||
        row['answer_en'] ||
        row['Answer'] ||
        ''
      )
      const problemKey = (
        row['task_answers.problem_key'] ||
        row['problem_key'] ||
        row['Problem Key'] ||
        ''
      )
      const stateKey = (
        row['task_answers.state_key'] ||
        row['state_key'] ||
        row['State Key'] ||
        ''
      )
      const followUp = (
        row['task_answers.follow_up'] ||
        row['follow_up'] ||
        row['Follow Up'] ||
        ''
      )
      
      if (index === 0) {
        console.log('[Looker] DEBUG - First maintenance issue row structure:', {
          allKeys: Object.keys(row),
          mappedFields: {
            taskId,
            completedDate,
            type,
            question: question.substring(0, 50),
            answer: answer.substring(0, 50),
            problemKey,
            stateKey,
            followUp,
          },
        })
      }
      
      return {
        taskId,
        completedDate,
        type: type.toUpperCase() || 'UNKNOWN',
        question,
        answer,
        problemKey,
        stateKey,
        followUp,
        // Combined issue information
        issue: {
          component: stateKey,
          problem: problemKey,
          question,
          answer,
          resolved: followUp?.toLowerCase().includes('resolved') || followUp?.toLowerCase().includes('yes'),
        },
      }
    })
    
    console.log(`[Looker] Mapped ${mappedRows.length} maintenance issues`)
    return mappedRows
  } catch (error) {
    console.error('[Looker] Error fetching maintenance issues:', error)
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : { error: String(error) }
    console.error('[Looker] Error details:', errorDetails)
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
      result = await (sdk.run_look as any)({
        look_id: lookId,
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'fault.date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else if (queryId) {
      result = await (sdk.run_query as any)({
        query_id: queryId,
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
      result = await (sdk.run_look as any)({
        look_id: lookId,
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'alert.date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else if (queryId) {
      result = await (sdk.run_query as any)({
        query_id: queryId,
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
      result = await (sdk.run_look as any)({
        look_id: lookId,
        result_format: 'json',
        filters: {
          'unit.id': unitId,
          'part.replaced_date': `>=${startDate.toISOString().split('T')[0]}`,
        },
      })
    } else if (queryId) {
      result = await (sdk.run_query as any)({
        query_id: queryId,
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
 * Fetch repair requests for a device
 * Uses LOOKER_REPAIR_REQUESTS_LOOK_ID (Look ID 166)
 * Uses direct query (not Looker API) for reliable filtering
 */
export async function fetchRepairRequests(deviceId: string, daysBack: number = 90): Promise<any[]> {
  console.log('[Looker] Starting fetchRepairRequests for device:', deviceId, 'daysBack:', daysBack)
  const sdk = await getLookerClient()

  try {
    console.log('[Looker] Creating inline query for repair requests with filters:', {
      deviceId,
      daysBack,
      filterFields: {
        deviceFilter: 'device.device_id',
        dateFilter: 'repair_request.requested_date',
        statusFilter: 'repair_request.status',
        typeFilter: 'request_item.type',
      },
    })

    const result = await (sdk.run_inline_query as any)({
      result_format: 'json',
      body: {
        model: 'repairs', // From your LookML
        view: 'repair_requests', // From your LookML (explore: repair_requests)
        fields: [
          'repair_request.repair_request_number',
          'repair_request.requested_date',
          'repair_request.description',
          'repair_request.status',
          'state_changes.state_start_date_date',
          'repair_request.has_tech_support',
          'repair_request.is_chargeable',
          'request_item.has_part_attached',
          'request_item.type',
          'part.name',
          'part.family',
          'part.sub_family',
          'device.device_id', // Include device_id to verify filter
        ],
        filters: {
          'device.device_id': deviceId.toString(),
          'repair_request.requested_date': `${daysBack} days`, // Use days format like other queries (e.g., "90 days")
          'repair_request.status': '-CANCELLED,-DENIED,-"QUOTE_TO_SIGN_BY_CUSTOMER"', // Fixed filters
          'request_item.type': '-"MAN_HOUR"', // Fixed filter
        },
        sorts: ['repair_request.repair_request_number desc'],
        limit: '500'
      }
    })

    console.log('[Looker] Inline repair requests query executed successfully')

    if (result && typeof result === 'object') {
      if ('error' in result || result.ok === false) {
        const errorMsg = (result as any).error?.message || 'Looker API returned ok: false'
        const errorType = (result as any).error?.type || 'sdk_error'
        console.error('[Looker] API returned error in repair requests response:', {
          errorMsg,
          errorType,
          fullResult: result
        })
        throw new Error(`Looker API error (${errorType}): ${errorMsg}`)
      }
    }

    const rows = parseLookerResult(result)

    const sampleRows = rows.slice(0, 10)
    const sampleDeviceIds = sampleRows.map((row: any) =>
      row['device.device_id']?.toString() || row['device_id']?.toString() || 'NOT_FOUND'
    )
    const allMatchExpected = sampleDeviceIds.length > 0 && sampleDeviceIds.every(id => id.toString() === deviceId.toString())

    console.log('[Looker] Repair Requests Look result:', {
      hasValue: !!result,
      valueLength: rows.length,
      firstRowKeys: sampleRows[0] ? Object.keys(sampleRows[0]) : 'no rows',
      sampleDeviceIds: sampleDeviceIds,
      expectedDeviceId: deviceId,
      filterWorking: allMatchExpected ? '✓ YES' : '✗ NO',
    })

    if (rows.length > 0 && !allMatchExpected) {
      const errorMsg = [
        '❌ CRITICAL: Looker repair requests query filters are NOT working properly',
        '',
        `Expected device.device_id="${deviceId}" but received data for different devices:`,
        `  ${sampleDeviceIds.slice(0, 5).join(', ')}`,
        '',
        'The repair requests query is not filtering correctly despite passing filter parameters.',
        'Without proper filtering, data may be incomplete or missing.',
        '',
        `📊 Current state: Received ${rows.length} rows`,
        rows.length >= 500 ? '   ⚠️  At maximum row limit (500) - data is definitely incomplete!' : '',
      ].filter(Boolean).join('\n')

      console.error('[Looker] ' + errorMsg)

      throw new Error(
        `Looker filters not configured: Look 166 must have filterable fields for device.device_id and repair_request.requested_date. ` +
        `Received ${rows.length} rows with wrong device IDs (${sampleDeviceIds.slice(0, 3).join(', ')}...) instead of ${deviceId}. ` +
        `Configure Look 166 in Looker before using this application.`
      )
    }

    console.log(`[Looker] Parsed ${rows.length} repair request rows for device ${deviceId}`)

    const mappedRows = rows.map((row: any, index: number) => {
      const repairRequestNumber = row['repair_request.repair_request_number'] || ''
      const requestedDate = row['repair_request.requested_date'] || ''
      const description = row['repair_request.description'] || ''
      const status = row['repair_request.status'] || ''
      const stateStartDate = row['state_changes.state_start_date_date'] || ''
      const hasTechSupport = row['repair_request.has_tech_support'] || false
      const isChargeable = row['repair_request.is_chargeable'] || false
      const hasPartAttached = row['request_item.has_part_attached'] || false
      const itemType = row['request_item.type'] || ''
      // Extract part name - handle translations format: "translations":[["en-GB","Name"]]
      const partNameRaw = row['part.name'] || ''
      let partName = ''
      
      // Helper function to extract en-GB translation
      const extractGBTranslation = (value: any): string => {
        if (!value) return ''
        
        // If it's already a string, try to parse as JSON
        if (typeof value === 'string') {
          // Check if it looks like JSON
          if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(value)
              return extractGBTranslation(parsed)
            } catch {
              // Not valid JSON, return as-is
              return value
            }
          }
          return value
        }
        
        // If it's an object with translations property
        if (value && typeof value === 'object') {
          if (value.translations && Array.isArray(value.translations)) {
            // Find en-GB translation: translations is array of [["en-GB","Name"], ...]
            const gbTranslation = value.translations.find((t: any) => 
              Array.isArray(t) && t.length >= 2 && t[0] === 'en-GB'
            )
            if (gbTranslation && Array.isArray(gbTranslation) && gbTranslation[1]) {
              return String(gbTranslation[1])
            }
            // Fallback to first translation if en-GB not found
            const firstTranslation = value.translations.find((t: any) => 
              Array.isArray(t) && t.length >= 2 && t[1]
            )
            if (firstTranslation && Array.isArray(firstTranslation) && firstTranslation[1]) {
              return String(firstTranslation[1])
            }
          }
          // If object but no translations, try to stringify
          return String(value)
        }
        
        return String(value || '')
      }
      
      partName = extractGBTranslation(partNameRaw)
      
      const partFamily = row['part.family'] || ''
      const partSubFamily = row['part.sub_family'] || ''

      if (index === 0) {
        console.log('[Looker] DEBUG - First repair request row structure:', {
          allKeys: Object.keys(row),
          mappedFields: {
            repairRequestNumber, requestedDate, description, status, stateStartDate,
            hasTechSupport, isChargeable, hasPartAttached, itemType,
            partName, partFamily, partSubFamily
          }
        })
      }

      return {
        repairRequestNumber,
        requestedDate,
        description,
        status,
        stateStartDate,
        hasTechSupport,
        isChargeable,
        hasPartAttached,
        itemType,
        partName,
        partFamily,
        partSubFamily,
      }
    })

    console.log(`[Looker] Mapped ${mappedRows.length} repair requests`)
    return mappedRows
  } catch (error) {
    console.error('[Looker] Error fetching repair requests:', error)
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : { error: String(error) }
    console.error('[Looker] Error details:', errorDetails)
    throw error
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
    // Handle Looker SDK response format: { ok: true, value: [...] }
    if ('value' in result && Array.isArray(result.value)) {
      return result.value
    } else if ('data' in result) {
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

