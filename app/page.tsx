'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { WeMaintainLogo } from '@/components/WeMaintainLogo'
import { UserMenu } from '@/components/UserMenu'
import { translateStateKey, translateProblemKey } from '@/lib/state-key-translator'

const fetcher = async (url: string) => {
  console.log('[Debug] Fetching URL:', url)
  try {
  const res = await fetch(url)
    console.log('[Debug] Response status:', res.status, res.statusText)
    
  if (!res.ok) {
      const errorText = await res.text()
      console.error('[Debug] Response error:', errorText)
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      throw new Error(errorData.error || `Failed to fetch: ${res.status} ${res.statusText}`)
  }
    
    const json = await res.json()
    console.log('[Debug] Response data:', json)
    return json
  } catch (error) {
    console.error('[Debug] Fetcher error:', error)
    throw error
  }
}

interface Building {
  id: string
  name: string
  address: string
  country: string
}

interface Device {
  id: string
  name: string
  buildingId: string
  buildingName: string
  buildingAddress: string
  country: string
}

interface DiagnosticResult {
  id?: string
  unitId: string
  unitName: string
  buildingName: string
  country?: string
  userId?: string | null
  userName?: string | null
  visitReports: any[]
  breakdowns: any[]
  maintenanceIssues: any[]
  repairRequests?: any[]
  analysis: any
  generatedAt: Date | string
}

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
]

// Helper function to extract GB translation from part name
function extractGBTranslation(partName: string | null | undefined): string {
  if (!partName) return 'Part'
  
  // If it's already a plain string, return it
  if (typeof partName === 'string' && !partName.trim().startsWith('{') && !partName.trim().startsWith('"')) {
    return partName
  }
  
  // Try to parse as JSON
  try {
    let parsed: any
    if (typeof partName === 'string') {
      // Remove quotes if it's a JSON string
      const cleaned = partName.trim().replace(/^["']|["']$/g, '')
      parsed = JSON.parse(cleaned)
    } else {
      parsed = partName
    }
    
    // Check if it has translations array
    if (parsed && typeof parsed === 'object' && parsed.translations && Array.isArray(parsed.translations)) {
      // Find en-GB translation: translations is array of [["en-GB","Name"], ...]
      const gbTranslation = parsed.translations.find((t: any) => 
        Array.isArray(t) && t.length >= 2 && t[0] === 'en-GB'
      )
      if (gbTranslation && Array.isArray(gbTranslation) && gbTranslation[1]) {
        return String(gbTranslation[1])
      }
      // Fallback to first translation if en-GB not found
      const firstTranslation = parsed.translations.find((t: any) => 
        Array.isArray(t) && t.length >= 2 && t[1]
      )
      if (firstTranslation && Array.isArray(firstTranslation) && firstTranslation[1]) {
        return String(firstTranslation[1])
      }
    }
  } catch {
    // Not JSON or parsing failed, return as-is
  }
  
  return String(partName || 'Part')
}

// Helper function to format visit type for display
function formatVisitType(type: string): string {
  if (!type) return 'Visit'
  const upper = type.toUpperCase()
  if (upper.includes('BREAKDOWN') || upper.includes('CALLOUT')) return 'Breakdown Visit'
  if (upper.includes('REPAIR')) return 'Repair Visit'
  if (upper.includes('REGULAR') || upper.includes('MAINTENANCE')) return 'Maintenance Visit'
  if (upper.includes('QUARTERLY')) return 'Quarterly Visit'
  if (upper.includes('SEMI_ANNUAL')) return 'Semi-Annual Visit'
  return type
}

// Helper function to format date - only show time if it's not midnight/unknown
function formatEventDate(dateStr: string, includeTime: boolean = true): string {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  // If time is midnight (00:00) or very early (01:00), likely means time is unknown
  // Only show date in that case
  if (!includeTime || (hours === 0 && minutes === 0) || (hours === 1 && minutes === 0)) {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    })
  }
  
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Helper function to calculate days back from context or default
function getDaysBack(context: string | undefined): number {
  if (!context) return 90
  const lower = context.toLowerCase()
  if (lower.includes('last 2 weeks') || lower.includes('last two weeks')) return 14
  if (lower.includes('last week') || lower.includes('last 1 week')) return 7
  if (lower.includes('last month') || lower.includes('last 1 month')) return 30
  if (lower.includes('last 2 months') || lower.includes('last two months')) return 60
  if (lower.includes('last 3 months') || lower.includes('last three months')) return 90
  if (lower.includes('last 6 months') || lower.includes('last six months')) return 180
  return 90
}

export default function Home() {
  const { data: session } = useSession()
  // Initialize country from localStorage or default to FR
  const [country, setCountryState] = useState<string>('FR')
  
  // Load saved country from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('diagnostic-country')
      if (saved && saved !== country) {
        setCountryState(saved)
      }
    }
  }, [])
  
  // Wrapper to persist country changes
  const setCountry = (newCountry: string) => {
    setCountryState(newCountry)
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagnostic-country', newCountry)
    }
  }
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [buildingSearch, setBuildingSearch] = useState<string>('')
  const [deviceSearch, setDeviceSearch] = useState<string>('')
  const [context, setContext] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null)
  const [showBuildingDropdown, setShowBuildingDropdown] = useState(false)
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false)
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [showRecentResults, setShowRecentResults] = useState(false)
  const [recentResults, setRecentResults] = useState<DiagnosticResult[]>([])
  const [activeTab, setActiveTab] = useState<'summary' | 'visits' | 'analysis' | 'components'>('summary')
  
  // Check for view=recent query parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('view') === 'recent') {
        setShowRecentResults(true)
        setDiagnosticResult(null)
        // Clean up URL
        window.history.replaceState({}, '', '/')
      }
    }
  }, [])
  
  // Optimistic admin check - remember if user was admin to prevent flickering
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  
  // Initialize from localStorage FIRST for instant render (no flicker)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('isAdmin')
      if (stored === 'true') {
        setIsAdmin(true)
      }
    }
  }, [])
  
  useEffect(() => {
    if (session?.user?.email) {
      const adminStatus = session.user.email === 'matthieu@wemaintain.com'
      setIsAdmin(adminStatus)
      // Store in localStorage for persistence across page loads
      if (typeof window !== 'undefined') {
        localStorage.setItem('isAdmin', String(adminStatus))
      }
    }
    // Note: We DON'T set isAdmin to false if session is undefined
    // This prevents flickering during navigation when session is temporarily unavailable
  }, [session?.user?.email])
  
  // Filter states
  const [showMyDiagnostics, setShowMyDiagnostics] = useState(false)
  const [dateFilterStart, setDateFilterStart] = useState<string>('')
  const [dateFilterEnd, setDateFilterEnd] = useState<string>('')
  const [unitFilter, setUnitFilter] = useState<string>('')
  
  const buildingInputRef = useRef<HTMLInputElement>(null)
  const deviceInputRef = useRef<HTMLInputElement>(null)
  const buildingDropdownRef = useRef<HTMLDivElement>(null)
  const deviceDropdownRef = useRef<HTMLDivElement>(null)
  const countryDropdownRef = useRef<HTMLDivElement>(null)
  
  // Fetch buildings and devices for selected country
  // SWR automatically refetches when country changes because it's part of the URL key
  const { data: data, isLoading: dataLoading, error: dataError } = useSWR<{ buildings: Building[], devices: Device[] }>(
    country ? `/api/buildings?country=${country}` : null, // Only fetch when country is set
    fetcher,
    {
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: true, // Refetch on reconnect
      onError: (error) => {
        console.error('[Debug] SWR Error:', error)
      },
      onSuccess: (data) => {
        console.log('[Debug] SWR Success: Fetched', data.buildings?.length || 0, 'buildings and', data.devices?.length || 0, 'devices for country', country)
      },
    }
  )
  
  // Debug: Log data when it loads
  useEffect(() => {
    console.log('[Debug] Data state:', { 
      hasData: !!data, 
      isLoading: dataLoading, 
      hasError: !!dataError,
      country 
    })
    
    if (data) {
      console.log('[Debug] Buildings loaded:', data.buildings?.length || 0)
      console.log('[Debug] Devices loaded:', data.devices?.length || 0)
      if (data.buildings && data.buildings.length > 0) {
        console.log('[Debug] First building sample:', data.buildings[0])
      } else {
        console.warn('[Debug] No buildings in data:', data)
      }
      if (data.devices && data.devices.length > 0) {
        console.log('[Debug] First device sample:', data.devices[0])
      } else {
        console.warn('[Debug] No devices in data:', data)
      }
    }
    if (dataError) {
      console.error('[Debug] Error loading data:', dataError)
      console.error('[Debug] Error details:', {
        message: dataError.message,
        stack: dataError.stack,
        name: dataError.name,
      })
    }
  }, [data, dataError, dataLoading, country])
  
  // Load recent results from API with filters
  // Use useCallback to ensure it uses the latest country value
  const loadRecentDiagnostics = useCallback(() => {
    const params = new URLSearchParams()
    params.append('country', country)
    
    if (showMyDiagnostics) {
      params.append('userId', 'me')
    }
    
    if (dateFilterStart) {
      params.append('startDate', dateFilterStart)
    }
    
    if (dateFilterEnd) {
      params.append('endDate', dateFilterEnd)
    }
    
    if (unitFilter.trim()) {
      params.append('unitName', unitFilter.trim())
    }
    
    console.log('[UI] Fetching recent diagnostics with filters:', params.toString(), 'for country:', country)
    fetch(`/api/diagnostic/recent?${params.toString()}`)
      .then(res => {
        console.log('[UI] Recent diagnostics response status:', res.status)
        return res.json()
      })
        .then(data => {
        console.log('[UI] Recent diagnostics data received:', {
          hasResults: !!data.results,
          resultsCount: data.results?.length || 0,
          country: country,
        })
        if (data.results) {
          setRecentResults(data.results)
          console.log('[UI] Set recent results:', data.results.length, 'items for country', country)
        } else {
          console.warn('[UI] No results in response:', data)
          setRecentResults([])
          }
        })
        .catch(err => {
        console.error('[UI] Error loading recent results:', err)
        setRecentResults([])
      })
  }, [country, showMyDiagnostics, dateFilterStart, dateFilterEnd, unitFilter])
  
  // Delete a diagnostic result
  const handleDeleteDiagnostic = async (diagnosticId: string) => {
    try {
      console.log('[UI] Deleting diagnostic:', diagnosticId)
      const response = await fetch(`/api/diagnostic/delete?id=${diagnosticId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete diagnostic')
      }
      
      const result = await response.json()
      console.log('[UI] Diagnostic deleted successfully:', result)
      
      // Reload the recent diagnostics list
      loadRecentDiagnostics()
      
      // If the deleted diagnostic is currently being viewed, close it
      if (diagnosticResult && diagnosticResult.id === diagnosticId) {
        setDiagnosticResult(null)
      }
    } catch (error) {
      console.error('[UI] Error deleting diagnostic:', error)
      alert(`Failed to delete diagnostic: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  useEffect(() => {
    if (showRecentResults) {
      console.log('[UI] Loading diagnostics - showRecentResults:', showRecentResults, 'country:', country)
      loadRecentDiagnostics()
    }
  }, [showRecentResults, loadRecentDiagnostics])
  
  // Log when showRecentResults changes
  useEffect(() => {
    console.log('[UI] showRecentResults changed:', showRecentResults)
    console.log('[UI] recentResults count:', recentResults.length)
    if (showRecentResults) {
      console.log('[UI] Recent results to display:', recentResults)
    }
  }, [showRecentResults, recentResults])
  
  // Reset selections when country changes
  useEffect(() => {
    setSelectedBuildingId('')
    setSelectedDeviceId('')
    setBuildingSearch('')
    setDeviceSearch('')
    setShowBuildingDropdown(false)
    setShowDeviceDropdown(false)
  }, [country])
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      
      // Check building dropdown
      if (
        showBuildingDropdown &&
        buildingDropdownRef.current &&
        !buildingDropdownRef.current.contains(target) &&
        buildingInputRef.current &&
        !buildingInputRef.current.contains(target)
      ) {
        setShowBuildingDropdown(false)
      }
      
      // Check device dropdown
      if (
        showDeviceDropdown &&
        deviceDropdownRef.current &&
        !deviceDropdownRef.current.contains(target) &&
        deviceInputRef.current &&
        !deviceInputRef.current.contains(target)
      ) {
        setShowDeviceDropdown(false)
      }
      
      // Check country dropdown
      if (
        showCountryDropdown &&
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(target)
      ) {
        setShowCountryDropdown(false)
      }
    }
    
    if (showBuildingDropdown || showDeviceDropdown || showCountryDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showBuildingDropdown, showDeviceDropdown, showCountryDropdown])
  
  // Filter buildings by search term (name or address)
  const filteredBuildings = useMemo(() => {
    if (!data?.buildings) return []
    if (!buildingSearch.trim()) return data.buildings.slice(0, 50) // Show first 50 when no search
    
    const search = buildingSearch.toLowerCase()
    return data.buildings.filter(b => 
      b.name.toLowerCase().includes(search) ||
      b.address.toLowerCase().includes(search)
    ).slice(0, 50)
  }, [data?.buildings, buildingSearch])
  
  // Filter devices by search term (name) and selected building
  const filteredDevices = useMemo(() => {
    if (!data?.devices) return []
    
    let devices = data.devices
    if (selectedBuildingId) {
      devices = devices.filter(d => d.buildingId === selectedBuildingId)
    }
    
    // Always include the selected device if it exists, even if it doesn't match filters
    const selectedDeviceInList = selectedDeviceId ? devices.find(d => d.id === selectedDeviceId) : null
    
    if (!deviceSearch.trim()) {
      // When no search, show ALL devices for the building (no limit)
      // But ensure selected device is at the top if it exists
      if (selectedDeviceInList) {
        // Remove selected device from list if it's there, then add it at the top
        const otherDevices = devices.filter(d => d.id !== selectedDeviceId)
        return [selectedDeviceInList, ...otherDevices]
      }
      return devices
    }
    
    const search = deviceSearch.toLowerCase()
    const filtered = devices.filter(d => d.name.toLowerCase().includes(search))
    
    // If selected device exists and matches search, ensure it's included
    if (selectedDeviceInList && selectedDeviceInList.name.toLowerCase().includes(search)) {
      // Remove selected device from filtered list if it's there, then add it at the top
      const otherFiltered = filtered.filter(d => d.id !== selectedDeviceId)
      return [selectedDeviceInList, ...otherFiltered]
    }
    
    // Also include selected device even if it doesn't match search (user might have selected it before searching)
    if (selectedDeviceInList && !filtered.find(d => d.id === selectedDeviceId)) {
      return [selectedDeviceInList, ...filtered]
    }
    
    return filtered
  }, [data?.devices, selectedBuildingId, deviceSearch, selectedDeviceId])
  
  // Get selected building and device
  const selectedBuilding = data?.buildings.find(b => b.id === selectedBuildingId)
  const selectedDevice = filteredDevices.find(d => d.id === selectedDeviceId)
  
  
  const handleBuildingSelect = (building: Building) => {
    setSelectedBuildingId(building.id)
    setBuildingSearch(`${building.name} - ${building.address}`)
    setShowBuildingDropdown(false)
    setSelectedDeviceId('') // Reset device when building changes
    setDeviceSearch('')
  }
  
  const handleDeviceSelect = (device: Device) => {
    setSelectedDeviceId(device.id)
    setDeviceSearch(device.name)
    setShowDeviceDropdown(false)
  }
  
  const handleAnalyze = async () => {
    if (!selectedBuildingId || !selectedDeviceId || !selectedBuilding || !selectedDevice) {
      alert('Please select a building and device')
      return
    }
    
    setIsLoading(true)
    setDiagnosticResult(null)
    
    try {
      const response = await fetch('/api/diagnostic/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: selectedDeviceId,
          unitName: selectedDevice.name,
          buildingId: selectedBuildingId,
          buildingName: selectedBuilding.name,
          context: context.trim() || undefined,
          country: country,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to analyze diagnostic')
      }
      
      const result = await response.json()
      setDiagnosticResult({
        unitId: selectedDeviceId,
        unitName: selectedDevice.name,
        buildingName: selectedBuilding.name,
        visitReports: result.visitReports || [],
        breakdowns: result.breakdowns || [],
        maintenanceIssues: result.maintenanceIssues || [],
        repairRequests: result.repairRequests || [],
        analysis: result.analysis,
        generatedAt: new Date(),
      })
      
      // Set active tab to Analysis when diagnostic completes
      setActiveTab('analysis')
      
      // Refresh recent results
      loadRecentDiagnostics()
    } catch (error) {
      console.error('Error analyzing diagnostic:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to analyze diagnostic'}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleGeneratePDF = async () => {
    if (!diagnosticResult) return
    
    setIsGeneratingPDF(true)
    
    try {
      // Use existing diagnostic data instead of re-fetching
      const response = await fetch('/api/diagnostic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: diagnosticResult.unitId,
          unitName: diagnosticResult.unitName,
          buildingId: selectedBuildingId,
          buildingName: diagnosticResult.buildingName,
          context: context.trim() || undefined,
          // Pass existing data to avoid re-fetching
          visitReports: diagnosticResult.visitReports,
          breakdowns: diagnosticResult.breakdowns,
          maintenanceIssues: diagnosticResult.maintenanceIssues,
          repairRequests: diagnosticResult.repairRequests || [],
          analysis: diagnosticResult.analysis,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }
      
      // Download PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `diagnostic_${diagnosticResult.unitName}_${diagnosticResult.unitId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to generate PDF'}`)
    } finally {
      setIsGeneratingPDF(false)
    }
  }
  
  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col h-screen flex-shrink-0 relative z-10">
        <div className="p-6 border-b border-slate-700">
          <WeMaintainLogo />
        </div>
        <nav className="flex-1 p-4 overflow-y-auto relative z-10">
          <div className="space-y-2">
            {/* Country Selection - Above Navigation */}
            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Country
              </div>
              <div className="relative" ref={countryDropdownRef}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowCountryDropdown(!showCountryDropdown)
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-sm font-medium bg-slate-700 text-white hover:bg-slate-600 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>
                    {COUNTRIES.find(c => c.code === country)?.name} ({country})
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showCountryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setCountry(c.code)
                          setShowCountryDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                          country === c.code
                            ? 'bg-slate-600 text-white'
                            : 'text-slate-300 hover:bg-slate-600 hover:text-white'
                        }`}
                      >
                        {c.name} ({c.code})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Navigation
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                // Close any open dropdowns
                setShowBuildingDropdown(false)
                setShowDeviceDropdown(false)
                setShowCountryDropdown(false)
                setShowRecentResults(false)
                setDiagnosticResult(null)
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              onMouseDown={(e) => {
                // Ensure click works even during loading
                e.stopPropagation()
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors relative z-10 ${
                !showRecentResults && !diagnosticResult ? 'bg-slate-700' : 'hover:bg-slate-700'
              }`}
              style={{ pointerEvents: 'auto' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path fillRule="evenodd" clipRule="evenodd" d="M15.7692 1.85001L19.65 5.73077V20C19.65 21.1358 18.7693 22.0659 17.6535 22.1446L17.5 22.15H6.49998C5.36419 22.15 4.4341 21.2693 4.35537 20.1535L4.34998 20V4.00001C4.34998 2.86422 5.23068 1.93413 6.34643 1.8554L6.49998 1.85001H15.7692ZM14.549 3.15001H6.49998C6.06664 3.15001 5.70905 3.47427 5.6566 3.89338L5.64998 4.00001V20C5.64998 20.4333 5.97424 20.7909 6.39335 20.8434L6.49998 20.85H17.5C17.9333 20.85 18.2909 20.5257 18.3434 20.1066L18.35 20L18.349 7.15001H16.2C15.3367 7.15001 14.6282 6.48699 14.556 5.64237L14.55 5.50001L14.549 3.15001ZM15.849 3.76901L15.85 5.50001C15.85 5.66914 15.9699 5.81026 16.1294 5.8429L16.2 5.85001H17.93L15.849 3.76901Z" fill="currentColor"/>
                <path d="M10.2 10H14.64C14.8388 10 15 10.1612 15 10.36V14.8M13.8 11.2L9 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span>Launch New Diagnostic</span>
            </a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                // Close any open dropdowns
                setShowBuildingDropdown(false)
                setShowDeviceDropdown(false)
                setShowCountryDropdown(false)
                setShowRecentResults(true)
                setDiagnosticResult(null)
                // Scroll to top to show recent results
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              onMouseDown={(e) => {
                // Ensure click works even during loading
                e.stopPropagation()
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors relative z-10 ${
                showRecentResults ? 'bg-slate-700' : 'hover:bg-slate-700'
              }`}
              style={{ pointerEvents: 'auto' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path fillRule="evenodd" clipRule="evenodd" d="M15 2.20001C15.6351 2.20001 16.15 2.71488 16.15 3.35001L16.149 4.00001H18C18.8633 4.00001 19.5718 4.66303 19.6439 5.50764L19.65 5.65001V20.65C19.65 21.5133 18.987 22.2218 18.1424 22.294L18 22.3H6.00001C5.1367 22.3 4.42825 21.637 4.35606 20.7924L4.35001 20.65V5.65001C4.35001 4.7867 5.01302 4.07825 5.85764 4.00607L6.00001 4.00001H7.85001V3.35001C7.85001 2.75723 8.29852 2.2692 8.8747 2.20676L9.00001 2.20001H15ZM16.15 5.85001C16.15 6.48514 15.6351 7.00001 15 7.00001H9.00001C8.36488 7.00001 7.85001 6.48514 7.85001 5.85001V5.30001H6.00001C5.83087 5.30001 5.68975 5.41999 5.65712 5.57948L5.65001 5.65001V20.65C5.65001 20.8191 5.76998 20.9603 5.92947 20.9929L6.00001 21H18C18.1691 21 18.3103 20.88 18.3429 20.7205L18.35 20.65V5.65001C18.35 5.48088 18.23 5.33976 18.0705 5.30712L18 5.30001H16.149L16.15 5.85001ZM8.25001 16.3C8.66422 16.3 9.00001 16.6358 9.00001 17.05C9.00001 17.4642 8.66422 17.8 8.25001 17.8C7.83579 17.8 7.50001 17.4642 7.50001 17.05C7.50001 16.6358 7.83579 16.3 8.25001 16.3ZM16 16.4C16.359 16.4 16.65 16.691 16.65 17.05C16.65 17.3764 16.4095 17.6465 16.0961 17.693L16 17.7H11C10.641 17.7 10.35 17.409 10.35 17.05C10.35 16.7237 10.5905 16.4535 10.904 16.4071L11 16.4H16ZM8.25001 12.825C8.66422 12.825 9.00001 13.1608 9.00001 13.575C9.00001 13.9892 8.66422 14.325 8.25001 14.325C7.83579 14.325 7.50001 13.9892 7.50001 13.575C7.50001 13.1608 7.83579 12.825 8.25001 12.825ZM16 12.925C16.359 12.925 16.65 13.216 16.65 13.575C16.65 13.9014 16.4095 14.1715 16.0961 14.218L16 14.225H11C10.641 14.225 10.35 13.934 10.35 13.575C10.35 13.2487 10.5905 12.9785 10.904 12.9321L11 12.925H16ZM8.25001 9.35001C8.66422 9.35001 9.00001 9.6858 9.00001 10.1C9.00001 10.5142 8.66422 10.85 8.25001 10.85C7.83579 10.85 7.50001 10.5142 7.50001 10.1C7.50001 9.6858 7.83579 9.35001 8.25001 9.35001ZM16 9.45001C16.359 9.45001 16.65 9.74103 16.65 10.1C16.65 10.4264 16.4095 10.6965 16.0961 10.743L16 10.75H11C10.641 10.75 10.35 10.459 10.35 10.1C10.35 9.77366 10.5905 9.50349 10.904 9.45706L11 9.45001H16ZM14.85 3.50001H9.15001V5.70001H14.85V3.50001Z" fill="currentColor"/>
              </svg>
              <span>Recent Diagnostics</span>
            </a>
          </div>
          
          {/* Admin Tools Section - Only visible to matthieu@wemaintain.com */}
          {isAdmin && (
            <div className="pb-4 mt-4">
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Admin</div>
              <div className="space-y-2">
                <a
                  href="/prompt-testing"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium hover:bg-slate-700 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path fillRule="evenodd" clipRule="evenodd" d="M6.41792 13.8132C6.53697 13.8986 6.67554 13.9585 6.82564 13.9849C6.88226 13.9948 6.94052 14 6.99998 14C7.24814 14 7.47518 13.9096 7.64998 13.76V13.76C7.86423 13.5766 8.00001 13.3042 8.00001 13C8.00001 12.6959 7.86423 12.4234 7.64998 12.24V12.24C7.62813 12.2213 7.60546 12.2035 7.58204 12.1868C7.46563 12.1033 7.33057 12.0442 7.18431 12.017C7.12457 12.0058 7.06297 12 7.00001 12C6.44773 12 6.00001 12.4477 6.00001 13C6.00001 13.3351 6.16487 13.6318 6.41792 13.8132ZM6.34998 10.7932C5.39627 11.0736 4.70001 11.9555 4.70001 13C4.70001 14.0445 5.39627 14.9264 6.34998 15.2069L6.34998 20C6.34998 20.359 6.64099 20.65 6.99998 20.65C7.35896 20.65 7.64998 20.359 7.64998 20L7.64998 15.2069C8.60372 14.9264 9.30001 14.0445 9.30001 13C9.30001 11.9555 8.60372 11.0736 7.64998 10.7931L7.64998 4.00001C7.64998 3.64102 7.35896 3.35001 6.99998 3.35001C6.64099 3.35001 6.34998 3.64102 6.34998 4.00001L6.34998 10.7932Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M16.4179 16.8132C16.5351 16.8972 16.6711 16.9566 16.8185 16.9836C16.8774 16.9944 16.938 17 17 17C17.2481 17 17.4752 16.9096 17.65 16.76V16.76C17.8642 16.5766 18 16.3042 18 16C18 15.6959 17.8642 15.4234 17.65 15.24V15.24C17.6281 15.2213 17.6055 15.2035 17.582 15.1868C17.4656 15.1033 17.3305 15.0442 17.1842 15.0169C17.1245 15.0058 17.0629 15 17 15C16.4477 15 16 15.4477 16 16C16 16.3351 16.1649 16.6318 16.4179 16.8132ZM16.35 13.7932C15.3963 14.0736 14.7 14.9555 14.7 16C14.7 17.0445 15.3963 17.9264 16.35 18.2069L16.35 20C16.35 20.359 16.641 20.65 17 20.65C17.359 20.65 17.65 20.359 17.65 20L17.65 18.2069C18.6037 17.9264 19.3 17.0445 19.3 16C19.3 14.9555 18.6037 14.0736 17.65 13.7931L17.65 4.00001C17.65 3.64102 17.359 3.35001 17 3.35001C16.641 3.35001 16.35 3.64102 16.35 4.00001L16.35 13.7932Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.4904 8.86059C11.5549 8.89885 11.624 8.93007 11.6967 8.95319C11.7924 8.9836 11.8943 9 12 9C12.2481 9 12.4752 8.90961 12.65 8.75997V8.76C12.8642 8.57659 13 8.30416 13 8.00001C13 7.69586 12.8642 7.42343 12.65 7.24002V7.24003C12.5844 7.18392 12.5115 7.13613 12.4329 7.09832C12.4054 7.0851 12.3773 7.07311 12.3485 7.0624C12.24 7.02205 12.1226 7.00001 12 7.00001C11.4477 7.00001 11 7.44773 11 8.00001C11 8.36617 11.1968 8.68636 11.4904 8.86059ZM11.35 5.79316C10.3963 6.07363 9.70001 6.95551 9.70001 8.00001C9.70001 9.04452 10.3963 9.9264 11.35 10.2069L11.35 20C11.35 20.359 11.641 20.65 12 20.65C12.359 20.65 12.65 20.359 12.65 20L12.65 10.2069C13.6037 9.92644 14.3 9.04454 14.3 8.00001C14.3 6.95548 13.6037 6.07358 12.65 5.79313L12.65 4.00001C12.65 3.64102 12.359 3.35001 12 3.35001C11.641 3.35001 11.35 3.64102 11.35 4.00001L11.35 5.79316Z" fill="currentColor"/>
                  </svg>
                  <span>Prompt Testing</span>
                </a>
                <a
                  href="/usage-analytics"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium hover:bg-slate-700 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Usage Analytics</span>
                </a>
              </div>
            </div>
          )}
        </nav>
        {/* User Menu at Bottom */}
        <UserMenu />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-4xl mx-auto">
          {/* Recent Results View - Show first if selected */}
          {showRecentResults && !diagnosticResult && (
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-6 text-gray-900">Recent Diagnostics</h1>
              
              {/* Filter Controls */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* My Diagnostics Toggle */}
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showMyDiagnostics}
                        onChange={(e) => setShowMyDiagnostics(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">My Diagnostics</span>
                    </label>
                  </div>
                  
                  {/* Start Date Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={dateFilterStart}
                      onChange={(e) => setDateFilterStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* End Date Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={dateFilterEnd}
                      onChange={(e) => setDateFilterEnd(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Unit Name Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Unit Name</label>
                    <input
                      type="text"
                      value={unitFilter}
                      onChange={(e) => setUnitFilter(e.target.value)}
                      placeholder="Search by unit name..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* Clear Filters Button */}
                {(showMyDiagnostics || dateFilterStart || dateFilterEnd || unitFilter) && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setShowMyDiagnostics(false)
                        setDateFilterStart('')
                        setDateFilterEnd('')
                        setUnitFilter('')
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
              
              <div className="mb-4 text-sm text-gray-600">
                Found {recentResults.length} diagnostic{recentResults.length !== 1 ? 's' : ''} for {COUNTRIES.find(c => c.code === country)?.name}
              </div>
              {recentResults.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center text-gray-500">
                  <p className="mb-2">No recent diagnostics found</p>
                  <p className="text-xs text-gray-400">
                    Generate a diagnostic report to see it here. Reports are stored for 7 days.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentResults.map((result, idx) => {
                    console.log(`[UI] Rendering recent result ${idx + 1}:`, {
                      unitName: result.unitName,
                      unitId: result.unitId,
                      visitReports: result.visitReports?.length || 0,
                      breakdowns: result.breakdowns?.length || 0,
                      hasAnalysis: !!result.analysis,
                      generatedAt: result.generatedAt,
                    })
                    
                    return (
                      <div
                        key={result.unitId || idx}
                        className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer relative"
                        onClick={() => {
                          console.log('[UI] Clicked on recent diagnostic:', result.unitName)
                          setDiagnosticResult(result)
                          setShowRecentResults(false)
                          setActiveTab('analysis') // Land on Analysis tab when opening existing diagnostic
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 text-lg mb-1">{result.unitName}</h3>
                            <p className="text-sm text-gray-600 mb-2">{result.buildingName}</p>
                            <div className="flex flex-wrap gap-6 text-xs text-gray-500 items-center">
                              {/* Visits */}
                              {result.visitReports && result.visitReports.length > 0 && (
                                <span className="flex items-center gap-1.5">
                                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M14.15 0C14.509 0 14.8 0.291015 14.8 0.65L14.799 1.5H16.65C18.1136 1.5 19.3 2.68645 19.3 4.15V17.15C19.3 18.6136 18.1136 19.8 16.65 19.8H2.65C1.18645 19.8 0 18.6136 0 17.15V4.15C0 2.68645 1.18645 1.5 2.65 1.5H4.5V0.65C4.5 0.291015 4.79102 0 5.15 0C5.50899 0 5.8 0.291015 5.8 0.65V1.5H13.5V0.65C13.5 0.291015 13.791 0 14.15 0ZM18 7.299H1.3V17.15C1.3 17.8956 1.90442 18.5 2.65 18.5H16.65C17.3956 18.5 18 17.8956 18 17.15V7.299ZM6.15 14C6.50899 14 6.8 14.291 6.8 14.65C6.8 15.009 6.50899 15.3 6.15 15.3H4.65C4.29102 15.3 4 15.009 4 14.65C4 14.291 4.29102 14 4.65 14H6.15ZM10.4 14C10.759 14 11.05 14.291 11.05 14.65C11.05 15.009 10.759 15.3 10.4 15.3H8.9C8.54101 15.3 8.25 15.009 8.25 14.65C8.25 14.291 8.54101 14 8.9 14H10.4ZM14.65 14C15.009 14 15.3 14.291 15.3 14.65C15.3 15.009 15.009 15.3 14.65 15.3H13.15C12.791 15.3 12.5 15.009 12.5 14.65C12.5 14.291 12.791 14 13.15 14H14.65ZM10.4 10C10.759 10 11.05 10.291 11.05 10.65C11.05 11.009 10.759 11.3 10.4 11.3H8.9C8.54101 11.3 8.25 11.009 8.25 10.65C8.25 10.291 8.54101 10 8.9 10H10.4ZM6.15 10C6.50899 10 6.8 10.291 6.8 10.65C6.8 11.009 6.50899 11.3 6.15 11.3H4.65C4.29102 11.3 4 11.009 4 10.65C4 10.291 4.29102 10 4.65 10H6.15ZM14.65 10C15.009 10 15.3 10.291 15.3 10.65C15.3 11.009 15.009 11.3 14.65 11.3H13.15C12.791 11.3 12.5 11.009 12.5 10.65C12.5 10.291 12.791 10 13.15 10H14.65ZM4.5 2.8H2.65C1.90442 2.8 1.3 3.40442 1.3 4.15V5.999H18V4.15C18 3.40442 17.3956 2.8 16.65 2.8H14.799L14.8 3.65C14.8 4.00899 14.509 4.3 14.15 4.3C13.791 4.3 13.5 4.00899 13.5 3.65V2.8H5.8V3.65C5.8 4.00899 5.50899 4.3 5.15 4.3C4.79102 4.3 4.5 4.00899 4.5 3.65V2.8Z" fill="currentColor"/>
                                  </svg>
                                  <span>{result.visitReports.length} visit{result.visitReports.length !== 1 ? 's' : ''}</span>
                                </span>
                              )}
                              
                              {/* Breakdowns */}
                              {result.breakdowns && result.breakdowns.length > 0 && (
                                <span className="flex items-center gap-1.5">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M11.1898 5C13.3145 5 15.2071 6.34269 15.909 8.34799L16.8257 10.9666L19.3295 11.2309C21.4162 11.4511 23 13.2109 23 15.3091V17C23 18.1046 22.1046 19 21 19L20.6105 19.0005C20.3707 20.5023 19.0694 21.65 17.5 21.65C15.9303 21.65 14.6287 20.5018 14.3894 18.9995H9.61062C9.37128 20.5018 8.06973 21.65 6.5 21.65C4.93062 21.65 3.62929 20.5023 3.38954 19.0005L3 19C1.89543 19 1 18.1046 1 17V7.5C1 6.11929 2.11929 5 3.5 5H11.1898ZM6.5 16.65C5.47827 16.65 4.65 17.4783 4.65 18.5C4.65 19.5217 5.47827 20.35 6.5 20.35C7.52173 20.35 8.35 19.5217 8.35 18.5C8.35 17.4783 7.52173 16.65 6.5 16.65ZM17.5 16.65C16.4783 16.65 15.65 17.4783 15.65 18.5C15.65 19.5217 16.4783 20.35 17.5 20.35C18.5217 20.35 19.35 19.5217 19.35 18.5C19.35 17.4783 18.5217 16.65 17.5 16.65ZM8.772 6.3H3.5C2.83726 6.3 2.3 6.83726 2.3 7.5V17C2.3 17.3866 2.6134 17.7 3 17.7L3.4525 17.6999C3.80654 16.3477 5.03676 15.35 6.5 15.35C7.96324 15.35 9.19345 16.3477 9.54749 17.6999H14.4525C14.8065 16.3477 16.0368 15.35 17.5 15.35C18.9632 15.35 20.1935 16.3477 20.5475 17.6999L21 17.7C21.3866 17.7 21.7 17.3866 21.7 17V15.3091L21.694 15.15H20C19.6737 15.15 19.4035 14.9095 19.357 14.5961L19.35 14.5C19.35 14.141 19.641 13.85 20 13.85L21.2902 13.8501C20.8491 13.1283 20.089 12.6183 19.1931 12.5237L15.8707 12.173L15.863 12.153L10.3078 11.7645C9.49422 11.7075 8.85253 11.0674 8.77985 10.2698L8.77299 10.1185L8.772 6.3ZM11.1898 6.3H10.072L10.073 10.1185C10.073 10.2761 10.1775 10.4106 10.3228 10.4539L10.3986 10.4676L15.396 10.817L14.682 8.77751C14.1626 7.29359 12.7621 6.3 11.1898 6.3ZM8.25 2.5C8.94036 2.5 9.5 3.05964 9.5 3.75V4.16667H7V3.75C7 3.05964 7.55964 2.5 8.25 2.5Z" fill="currentColor"/>
                                  </svg>
                                  <span>{result.breakdowns.length} breakdown{result.breakdowns.length !== 1 ? 's' : ''}</span>
                                </span>
                              )}
                              
                              {/* Repair Requests */}
                              {result.repairRequests && result.repairRequests.length > 0 && (() => {
                                // Count unique repair requests (deduplicate by repairRequestNumber)
                                // The query returns one row per item, so we need to count unique repair requests
                                const uniqueRepairRequests = new Set(
                                  result.repairRequests
                                    .map((rr: any) => rr.repairRequestNumber)
                                    .filter((num: string) => num) // Filter out empty/null numbers
                                )
                                const uniqueCount = uniqueRepairRequests.size
                                return uniqueCount > 0 ? (
                                  <span className="flex items-center gap-1.5">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                                      <path fillRule="evenodd" clipRule="evenodd" d="M15.8448 2.35001C16.7222 2.35001 17.5732 2.54526 18.3484 2.91629L19.1768 3.31283L15.3995 7.08966L16.9103 8.60053L20.6872 4.82315L21.0837 5.65161C21.4547 6.42677 21.65 7.27777 21.65 8.1552C21.65 11.3613 19.0509 13.9604 15.8448 13.9604C15.4622 13.9604 15.0842 13.9233 14.7147 13.8503L7.85983 20.7047C6.59938 21.9651 4.55577 21.9651 3.29532 20.7047C2.03486 19.4442 2.03486 17.4006 3.2953 16.1402L10.1496 9.28525L10.1017 9.0066C10.0605 8.72647 10.0396 8.44212 10.0396 8.1552C10.0396 4.94908 12.6387 2.35001 15.8448 2.35001ZM15.8448 3.65001C13.3566 3.65001 11.3396 5.66705 11.3396 8.1552C11.3396 8.55382 11.3912 8.94501 11.492 9.32217L11.5889 9.68445L4.21456 17.0594C3.46178 17.8122 3.46178 19.0327 4.21456 19.7854C4.96733 20.5382 6.18782 20.5382 6.94061 19.7854L14.3155 12.4111L14.6778 12.508C15.055 12.6088 15.4462 12.6604 15.8448 12.6604C18.3329 12.6604 20.35 10.6433 20.35 8.1552C20.35 7.80192 20.3094 7.45475 20.2303 7.11866L16.9104 10.4391L13.5609 7.08959L16.8813 3.76966C16.5452 3.69058 16.1981 3.65001 15.8448 3.65001ZM5.74998 17.5C6.16419 17.5 6.49998 17.8358 6.49998 18.25C6.49998 18.6642 6.16419 19 5.74998 19C5.33576 19 4.99998 18.6642 4.99998 18.25C4.99998 17.8358 5.33576 17.5 5.74998 17.5Z" fill="currentColor"/>
                                    </svg>
                                    <span>{uniqueCount} repair request{uniqueCount !== 1 ? 's' : ''}</span>
                                  </span>
                                ) : null
                              })()}
                              
                              {/* Parts Replaced */}
                              {result.analysis?.partsReplaced && result.analysis.partsReplaced.length > 0 && (
                                <span className="flex items-center gap-1.5">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M15.2999 2.9218L16.0323 3.22518C16.8495 3.56367 17.2544 4.48633 16.9504 5.31666L16.4572 6.6653C16.7687 6.92547 17.0561 7.21211 17.3166 7.52183L18.6673 7.0287C19.4973 6.72533 20.419 7.12978 20.7577 7.94601L21.0609 8.6765C21.4002 9.49427 21.0336 10.4341 20.2303 10.8061L18.9262 11.4103C18.9601 11.8051 18.9602 12.2025 18.9259 12.5984L20.2339 13.2058C21.0364 13.578 21.4026 14.5168 21.0641 15.334L20.7621 16.063C20.4236 16.8802 19.5008 17.2851 18.6704 16.9809L17.3123 16.4839C17.0575 16.7859 16.7777 17.0649 16.4761 17.3184L16.9731 18.6728C17.2781 19.504 16.8727 20.4278 16.0545 20.7661L15.3236 21.0682C14.9565 21.22 14.5534 21.2332 14.1478 21.1L14.0064 21.0437C13.652 20.8816 13.3642 20.599 13.1969 20.2388L12.5868 18.9265C12.1937 18.9601 11.798 18.9601 11.4038 18.9261L10.7964 20.235C10.4241 21.0374 9.48536 21.4035 8.66817 21.065L7.93575 20.7616C7.11856 20.4232 6.71365 19.5005 7.01767 18.6702L7.51457 17.3111C7.21691 17.0598 6.94159 16.7842 6.69105 16.4873L5.32772 16.9851C4.4977 17.2884 3.57604 16.884 3.23732 16.0678L2.93418 15.3373C2.59482 14.5195 2.96138 13.5797 3.76463 13.2077L5.07467 12.6005C5.04022 12.2067 5.03949 11.8103 5.07293 11.4153L3.76109 10.8062C2.95862 10.434 2.59244 9.49517 2.93095 8.67792L3.2329 7.94896C3.57142 7.13171 4.49418 6.72681 5.32462 7.03099L6.67887 7.52657C6.93319 7.22391 7.21257 6.94423 7.51388 6.69006L7.01926 5.34183C6.71425 4.51065 7.11962 3.58688 7.93783 3.24859L8.66872 2.94641C9.48539 2.60876 10.4231 2.97448 10.7955 3.77593L11.399 5.07475C11.6881 5.04943 11.9788 5.04229 12.2692 5.05352L12.5595 5.07087L13.1717 3.75177C13.544 2.94941 14.4827 2.58331 15.2999 2.9218ZM14.3509 4.29898L13.3353 6.48733L12.8526 6.41324C12.274 6.3244 11.6872 6.32714 11.1117 6.41939L10.6264 6.49716L9.61655 4.32373C9.53756 4.15373 9.33865 4.07615 9.16542 4.14777L8.43453 4.44996C8.26097 4.52172 8.17498 4.71767 8.2397 4.89403L9.06596 7.14625L8.6693 7.43501C8.19286 7.78185 7.77326 8.20129 7.426 8.68077L7.13772 9.0788L4.87768 8.25174C4.70149 8.1872 4.50575 8.27309 4.43394 8.44645L4.132 9.17541C4.06019 9.34877 4.13787 9.54791 4.30832 9.62697L6.4929 10.6413L6.4166 11.1255C6.32432 11.7112 6.32594 12.3055 6.41935 12.8883L6.4972 13.3741L4.31109 14.3872C4.14067 14.4662 4.06291 14.6655 4.1349 14.839L4.43804 15.5695C4.50989 15.7426 4.70539 15.8284 4.88168 15.764L7.14788 14.9366L7.4362 15.3324C7.7801 15.8044 8.19528 16.2206 8.66954 16.5659L9.06572 16.8543L8.23852 19.1169C8.17401 19.2931 8.2599 19.4888 8.43324 19.5606L9.16566 19.864C9.33901 19.9358 9.53813 19.8581 9.61712 19.6879L10.6303 17.5045L11.1155 17.5818C11.7002 17.675 12.2937 17.6746 12.8759 17.5826L13.3601 17.5061L14.3758 19.6909C14.4115 19.7679 14.4717 19.827 14.513 19.8471L14.5851 19.8764C14.6641 19.9021 14.7484 19.8993 14.8269 19.8669L15.5578 19.5647C15.7313 19.4929 15.8173 19.297 15.7526 19.1207L14.9232 16.8604L15.3213 16.5718C15.7984 16.226 16.2187 15.8075 16.5669 15.329L16.8554 14.9324L19.1174 15.7602C19.2935 15.8247 19.4893 15.7388 19.5611 15.5655L19.863 14.8365C19.9348 14.6632 19.8572 14.464 19.6867 14.385L17.504 13.3715L17.5815 12.8863C17.6752 12.2999 17.6747 11.7048 17.5821 11.121L17.5052 10.6359L19.6839 9.62652C19.8544 9.5476 19.9321 9.34824 19.8601 9.17478L19.557 8.44428C19.4851 8.27114 19.2896 8.18535 19.1134 8.24978L16.8581 9.07317L16.5699 8.67612C16.2185 8.19191 15.7923 7.76623 15.3043 7.41524L14.904 7.12736L15.7295 4.86992C15.7941 4.69374 15.7082 4.49802 15.5348 4.42622L14.8024 4.12284C14.6291 4.05104 14.4299 4.1287 14.3509 4.29898ZM13.3968 8.62786C15.2592 9.39929 16.1436 11.5344 15.3721 13.3968C14.6007 15.2592 12.4656 16.1436 10.6032 15.3722C8.74079 14.6007 7.85639 12.4656 8.62782 10.6032C9.39925 8.74083 11.5344 7.85643 13.3968 8.62786ZM9.82886 11.1007C9.33219 12.2998 9.9016 13.6745 11.1007 14.1711C12.2997 14.6678 13.6744 14.0984 14.1711 12.8993C14.6678 11.7002 14.0984 10.3256 12.8993 9.8289C11.7002 9.33223 10.3255 9.90164 9.82886 11.1007Z" fill="currentColor"/>
                                  </svg>
                                  <span>{result.analysis.partsReplaced.length} part{result.analysis.partsReplaced.length !== 1 ? 's' : ''} replaced</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                              {(() => {
                                const date = new Date(result.generatedAt)
                                const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                const userName = result.userName || 'Unknown'
                                return `${dateStr}, ${timeStr}, by ${userName}`
                              })()}
                            </p>
                          </div>
                          <div className="ml-4">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                        
                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation() // Prevent card click
                            if (!result.id) {
                              console.error('[UI] Cannot delete diagnostic: missing ID')
                              return
                            }
                            const confirmDelete = window.confirm(`Are you sure you want to delete this diagnostic?\n\n${result.unitName} - ${result.buildingName}\n\nThis action cannot be undone.`)
                            if (confirmDelete) {
                              handleDeleteDiagnostic(result.id)
                            }
                          }}
                          className="absolute bottom-2 right-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete diagnostic"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M18.8286 5.04036C19.0824 5.2942 19.0824 5.70575 18.8286 5.9596L12.9231 11.865L18.8286 17.7702C19.057 17.9987 19.0799 18.3549 18.8971 18.6089L18.8286 18.6895C18.5748 18.9433 18.1632 18.9433 17.9094 18.6895L12.0041 12.784L6.09872 18.6895C5.84488 18.9433 5.43333 18.9433 5.17949 18.6895C4.92565 18.4356 4.92565 18.0241 5.17949 17.7702L11.0851 11.865L5.17949 5.9596C4.95103 5.73114 4.92818 5.37493 5.11095 5.12092L5.17949 5.04036C5.43333 4.78652 5.84488 4.78652 6.09872 5.04036L12.0041 10.946L17.9094 5.04036C18.1632 4.78652 18.5748 4.78652 18.8286 5.04036Z" fill="currentColor"/>
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          
          {/* Diagnostic Form - Only show when not viewing recent results and no diagnostic result */}
          {!showRecentResults && !diagnosticResult && (
            <>
              <h1 className="text-3xl font-bold mb-8 text-gray-900">Lift Diagnostic Summary</h1>
      
      {/* Building Selection */}
          <div className="mb-6 relative">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Building</label>
              {dataLoading && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading buildings for {COUNTRIES.find(c => c.code === country)?.name}...
                </span>
              )}
              {!dataLoading && data?.buildings && (
                <span className="text-xs text-gray-500">
                  {data.buildings.length} building{data.buildings.length !== 1 ? 's' : ''} in {COUNTRIES.find(c => c.code === country)?.name}
                </span>
              )}
            </div>
            <div className="relative" ref={buildingDropdownRef}>
              <input
                ref={buildingInputRef}
                type="text"
                value={buildingSearch}
          onChange={(e) => {
                  setBuildingSearch(e.target.value)
                  setShowBuildingDropdown(true)
                }}
                onFocus={() => {
                  // Show dropdown when focusing, even if no search term
                  if (data?.buildings && data.buildings.length > 0) {
                    setShowBuildingDropdown(true)
                  }
                }}
                onClick={() => {
                  // Also show on click
                  if (data?.buildings && data.buildings.length > 0) {
                    setShowBuildingDropdown(true)
                  }
                }}
                placeholder={`Type building name or address... (${COUNTRIES.find(c => c.code === country)?.name})`}
                className="w-full p-3 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {showBuildingDropdown && data?.buildings && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredBuildings.length > 0 ? (
                    <>
                      {!buildingSearch.trim() && (
                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                          {filteredBuildings.length} buildings available
                        </div>
                      )}
                      {filteredBuildings.map((building) => (
                        <button
                          key={building.id}
                          onClick={() => handleBuildingSelect(building)}
                          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900 text-sm">{building.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{building.address}</div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-sm">
                      No buildings found matching "{buildingSearch}"
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedBuilding && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: {selectedBuilding.name}
              </p>
            )}
      </div>
      
          {/* Device Selection */}
          <div className="mb-6 relative">
            <label className="block text-sm font-medium mb-2 text-gray-700">Device</label>
            <div className="relative" ref={deviceDropdownRef}>
              <input
                ref={deviceInputRef}
                type="text"
                value={deviceSearch}
                onChange={(e) => {
                  setDeviceSearch(e.target.value)
                  setShowDeviceDropdown(true)
                }}
                onFocus={() => {
                  // Show dropdown when focusing, even if no search term
                  if (selectedBuildingId && data?.devices) {
                    const buildingDevices = data.devices.filter(d => d.buildingId === selectedBuildingId)
                    if (buildingDevices.length > 0) {
                      setShowDeviceDropdown(true)
                    }
                  }
                }}
                onClick={() => {
                  // Also show on click
                  if (selectedBuildingId && data?.devices) {
                    const buildingDevices = data.devices.filter(d => d.buildingId === selectedBuildingId)
                    if (buildingDevices.length > 0) {
                      setShowDeviceDropdown(true)
                    }
                  }
                }}
                placeholder={selectedBuildingId ? "Type device name..." : "Select a building first"}
                className={`w-full p-3 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!selectedBuildingId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                disabled={!selectedBuildingId}
              />
              {showDeviceDropdown && selectedBuildingId && data?.devices && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredDevices.length > 0 ? (
                    <>
                      {!deviceSearch.trim() && (
                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                          {filteredDevices.length} devices available
                        </div>
                      )}
                      {filteredDevices.map((device) => (
                        <button
                          key={device.id}
                          onClick={() => handleDeviceSelect(device)}
                          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900 text-sm">{device.name}</div>
                          {device.buildingName && (
                            <div className="text-xs text-gray-500 mt-0.5">{device.buildingName}</div>
                          )}
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-sm">
                      {deviceSearch.trim() 
                        ? `No devices found matching "${deviceSearch}"`
                        : 'No devices available for this building'}
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedDevice && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: {selectedDevice.name}
              </p>
            )}
      </div>
      
      {/* Context Input */}
      <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  What are you looking for? (Optional)
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. dig into the recurring car door issues, general overview of recent failures..."
                  className="w-full p-3 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={3}
        />
      </div>
      
              {/* Analyze Button */}
              {!diagnosticResult && (
                <>
      <button
                    onClick={handleAnalyze}
                    disabled={!selectedBuildingId || !selectedDeviceId || isLoading}
                    className="w-full py-3 px-4 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Analyzing...' : 'Launch Diagnostic'}
      </button>
      
                  {isLoading && (
                    <div className="mt-8 flex flex-col items-center justify-center">
                      <div className="w-full max-w-md mb-6">
                        <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{
                              animation: 'progress 20s linear forwards',
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-gray-600 font-medium">Inspecting the unit, please wait...</p>
                      <p className="text-sm text-gray-500 mt-2">This may take up to 20 seconds</p>
        </div>
                  )}
                </>
              )}
            </>
          )}
      
      {/* Diagnostic Results */}
      {diagnosticResult && (
        <div className="mt-6 space-y-6">
          {/* Navigation Bar */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setDiagnosticResult(null)
                    setShowRecentResults(false)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Launch New Diagnostic
                </button>
                <button
                  onClick={() => {
                    setDiagnosticResult(null)
                    setShowRecentResults(true)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Recent Diagnostics
                </button>
              </div>
              <button
                onClick={() => {
                  setDiagnosticResult(null)
                  setShowRecentResults(false)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Diagnostic Results
                </h2>
                <p className="text-sm text-gray-600">
                  {diagnosticResult.unitName} - {diagnosticResult.buildingName}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Generated: {diagnosticResult.generatedAt.toLocaleString()}
                </p>
              </div>
            </div>
            
            {/* Summary Stats */}
            {(() => {
              // Calculate unique repair requests count
              const uniqueRepairRequests = diagnosticResult.repairRequests && diagnosticResult.repairRequests.length > 0
                ? new Set(
                    diagnosticResult.repairRequests
                      .map((rr: any) => rr.repairRequestNumber)
                      .filter((num: string) => num)
                  ).size
                : 0
              
              return (
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <div className="flex flex-wrap gap-6 text-sm text-gray-600 items-center">
                    {/* Visits */}
                    {diagnosticResult.visitReports && diagnosticResult.visitReports.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                          <path fillRule="evenodd" clipRule="evenodd" d="M14.15 0C14.509 0 14.8 0.291015 14.8 0.65L14.799 1.5H16.65C18.1136 1.5 19.3 2.68645 19.3 4.15V17.15C19.3 18.6136 18.1136 19.8 16.65 19.8H2.65C1.18645 19.8 0 18.6136 0 17.15V4.15C0 2.68645 1.18645 1.5 2.65 1.5H4.5V0.65C4.5 0.291015 4.79102 0 5.15 0C5.50899 0 5.8 0.291015 5.8 0.65V1.5H13.5V0.65C13.5 0.291015 13.791 0 14.15 0ZM18 7.299H1.3V17.15C1.3 17.8956 1.90442 18.5 2.65 18.5H16.65C17.3956 18.5 18 17.8956 18 17.15V7.299ZM6.15 14C6.50899 14 6.8 14.291 6.8 14.65C6.8 15.009 6.50899 15.3 6.15 15.3H4.65C4.29102 15.3 4 15.009 4 14.65C4 14.291 4.29102 14 4.65 14H6.15ZM10.4 14C10.759 14 11.05 14.291 11.05 14.65C11.05 15.009 10.759 15.3 10.4 15.3H8.9C8.54101 15.3 8.25 15.009 8.25 14.65C8.25 14.291 8.54101 14 8.9 14H10.4ZM14.65 14C15.009 14 15.3 14.291 15.3 14.65C15.3 15.009 15.009 15.3 14.65 15.3H13.15C12.791 15.3 12.5 15.009 12.5 14.65C12.5 14.291 12.791 14 13.15 14H14.65ZM10.4 10C10.759 10 11.05 10.291 11.05 10.65C11.05 11.009 10.759 11.3 10.4 11.3H8.9C8.54101 11.3 8.25 11.009 8.25 10.65C8.25 10.291 8.54101 10 8.9 10H10.4ZM6.15 10C6.50899 10 6.8 10.291 6.8 10.65C6.8 11.009 6.50899 11.3 6.15 11.3H4.65C4.29102 11.3 4 11.009 4 10.65C4 10.291 4.29102 10 4.65 10H6.15ZM14.65 10C15.009 10 15.3 10.291 15.3 10.65C15.3 11.009 15.009 11.3 14.65 11.3H13.15C12.791 11.3 12.5 11.009 12.5 10.65C12.5 10.291 12.791 10 13.15 10H14.65ZM4.5 2.8H2.65C1.90442 2.8 1.3 3.40442 1.3 4.15V5.999H18V4.15C18 3.40442 17.3956 2.8 16.65 2.8H14.799L14.8 3.65C14.8 4.00899 14.509 4.3 14.15 4.3C13.791 4.3 13.5 4.00899 13.5 3.65V2.8H5.8V3.65C5.8 4.00899 5.50899 4.3 5.15 4.3C4.79102 4.3 4.5 4.00899 4.5 3.65V2.8Z" fill="currentColor"/>
                        </svg>
                        <span className="font-medium">{diagnosticResult.visitReports.length} visit{diagnosticResult.visitReports.length !== 1 ? 's' : ''}</span>
                      </span>
                    )}
                    
                    {/* Breakdowns */}
                    {diagnosticResult.breakdowns && diagnosticResult.breakdowns.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                          <path fillRule="evenodd" clipRule="evenodd" d="M11.1898 5C13.3145 5 15.2071 6.34269 15.909 8.34799L16.8257 10.9666L19.3295 11.2309C21.4162 11.4511 23 13.2109 23 15.3091V17C23 18.1046 22.1046 19 21 19L20.6105 19.0005C20.3707 20.5023 19.0694 21.65 17.5 21.65C15.9303 21.65 14.6287 20.5018 14.3894 18.9995H9.61062C9.37128 20.5018 8.06973 21.65 6.5 21.65C4.93062 21.65 3.62929 20.5023 3.38954 19.0005L3 19C1.89543 19 1 18.1046 1 17V7.5C1 6.11929 2.11929 5 3.5 5H11.1898ZM6.5 16.65C5.47827 16.65 4.65 17.4783 4.65 18.5C4.65 19.5217 5.47827 20.35 6.5 20.35C7.52173 20.35 8.35 19.5217 8.35 18.5C8.35 17.4783 7.52173 16.65 6.5 16.65ZM17.5 16.65C16.4783 16.65 15.65 17.4783 15.65 18.5C15.65 19.5217 16.4783 20.35 17.5 20.35C18.5217 20.35 19.35 19.5217 19.35 18.5C19.35 17.4783 18.5217 16.65 17.5 16.65ZM8.772 6.3H3.5C2.83726 6.3 2.3 6.83726 2.3 7.5V17C2.3 17.3866 2.6134 17.7 3 17.7L3.4525 17.6999C3.80654 16.3477 5.03676 15.35 6.5 15.35C7.96324 15.35 9.19345 16.3477 9.54749 17.6999H14.4525C14.8065 16.3477 16.0368 15.35 17.5 15.35C18.9632 15.35 20.1935 16.3477 20.5475 17.6999L21 17.7C21.3866 17.7 21.7 17.3866 21.7 17V15.3091L21.694 15.15H20C19.6737 15.15 19.4035 14.9095 19.357 14.5961L19.35 14.5C19.35 14.141 19.641 13.85 20 13.85L21.2902 13.8501C20.8491 13.1283 20.089 12.6183 19.1931 12.5237L15.8707 12.173L15.863 12.153L10.3078 11.7645C9.49422 11.7075 8.85253 11.0674 8.77985 10.2698L8.77299 10.1185L8.772 6.3ZM11.1898 6.3H10.072L10.073 10.1185C10.073 10.2761 10.1775 10.4106 10.3228 10.4539L10.3986 10.4676L15.396 10.817L14.682 8.77751C14.1626 7.29359 12.7621 6.3 11.1898 6.3ZM8.25 2.5C8.94036 2.5 9.5 3.05964 9.5 3.75V4.16667H7V3.75C7 3.05964 7.55964 2.5 8.25 2.5Z" fill="currentColor"/>
                        </svg>
                        <span className="font-medium">{diagnosticResult.breakdowns.length} breakdown{diagnosticResult.breakdowns.length !== 1 ? 's' : ''}</span>
                      </span>
                    )}
                    
                    {/* Repair Requests */}
                    {uniqueRepairRequests > 0 && (
                      <span className="flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                          <path fillRule="evenodd" clipRule="evenodd" d="M15.8448 2.35001C16.7222 2.35001 17.5732 2.54526 18.3484 2.91629L19.1768 3.31283L15.3995 7.08966L16.9103 8.60053L20.6872 4.82315L21.0837 5.65161C21.4547 6.42677 21.65 7.27777 21.65 8.1552C21.65 11.3613 19.0509 13.9604 15.8448 13.9604C15.4622 13.9604 15.0842 13.9233 14.7147 13.8503L7.85983 20.7047C6.59938 21.9651 4.55577 21.9651 3.29532 20.7047C2.03486 19.4442 2.03486 17.4006 3.2953 16.1402L10.1496 9.28525L10.1017 9.0066C10.0605 8.72647 10.0396 8.44212 10.0396 8.1552C10.0396 4.94908 12.6387 2.35001 15.8448 2.35001ZM15.8448 3.65001C13.3566 3.65001 11.3396 5.66705 11.3396 8.1552C11.3396 8.55382 11.3912 8.94501 11.492 9.32217L11.5889 9.68445L4.21456 17.0594C3.46178 17.8122 3.46178 19.0327 4.21456 19.7854C4.96733 20.5382 6.18782 20.5382 6.94061 19.7854L14.3155 12.4111L14.6778 12.508C15.055 12.6088 15.4462 12.6604 15.8448 12.6604C18.3329 12.6604 20.35 10.6433 20.35 8.1552C20.35 7.80192 20.3094 7.45475 20.2303 7.11866L16.9104 10.4391L13.5609 7.08959L16.8813 3.76966C16.5452 3.69058 16.1981 3.65001 15.8448 3.65001ZM5.74998 17.5C6.16419 17.5 6.49998 17.8358 6.49998 18.25C6.49998 18.6642 6.16419 19 5.74998 19C5.33576 19 4.99998 18.6642 4.99998 18.25C4.99998 17.8358 5.33576 17.5 5.74998 17.5Z" fill="currentColor"/>
                        </svg>
                        <span className="font-medium">{uniqueRepairRequests} repair request{uniqueRepairRequests !== 1 ? 's' : ''}</span>
                      </span>
                    )}
                    
                    {/* Parts Replaced */}
                    {diagnosticResult.analysis?.partsReplaced && diagnosticResult.analysis.partsReplaced.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                          <path fillRule="evenodd" clipRule="evenodd" d="M15.2999 2.9218L16.0323 3.22518C16.8495 3.56367 17.2544 4.48633 16.9504 5.31666L16.4572 6.6653C16.7687 6.92547 17.0561 7.21211 17.3166 7.52183L18.6673 7.0287C19.4973 6.72533 20.419 7.12978 20.7577 7.94601L21.0609 8.6765C21.4002 9.49427 21.0336 10.4341 20.2303 10.8061L18.9262 11.4103C18.9601 11.8051 18.9602 12.2025 18.9259 12.5984L20.2339 13.2058C21.0364 13.578 21.4026 14.5168 21.0641 15.334L20.7621 16.063C20.4236 16.8802 19.5008 17.2851 18.6704 16.9809L17.3123 16.4839C17.0575 16.7859 16.7777 17.0649 16.4761 17.3184L16.9731 18.6728C17.2781 19.504 16.8727 20.4278 16.0545 20.7661L15.3236 21.0682C14.9565 21.22 14.5534 21.2332 14.1478 21.1L14.0064 21.0437C13.652 20.8816 13.3642 20.599 13.1969 20.2388L12.5868 18.9265C12.1937 18.9601 11.798 18.9601 11.4038 18.9261L10.7964 20.235C10.4241 21.0374 9.48536 21.4035 8.66817 21.065L7.93575 20.7616C7.11856 20.4232 6.71365 19.5005 7.01767 18.6702L7.51457 17.3111C7.21691 17.0598 6.94159 16.7842 6.69105 16.4873L5.32772 16.9851C4.4977 17.2884 3.57604 16.884 3.23732 16.0678L2.93418 15.3373C2.59482 14.5195 2.96138 13.5797 3.76463 13.2077L5.07467 12.6005C5.04022 12.2067 5.03949 11.8103 5.07293 11.4153L3.76109 10.8062C2.95862 10.434 2.59244 9.49517 2.93095 8.67792L3.2329 7.94896C3.57142 7.13171 4.49418 6.72681 5.32462 7.03099L6.67887 7.52657C6.93319 7.22391 7.21257 6.94423 7.51388 6.69006L7.01926 5.34183C6.71425 4.51065 7.11962 3.58688 7.93783 3.24859L8.66872 2.94641C9.48539 2.60876 10.4231 2.97448 10.7955 3.77593L11.399 5.07475C11.6881 5.04943 11.9788 5.04229 12.2692 5.05352L12.5595 5.07087L13.1717 3.75177C13.544 2.94941 14.4827 2.58331 15.2999 2.9218ZM14.3509 4.29898L13.3353 6.48733L12.8526 6.41324C12.274 6.3244 11.6872 6.32714 11.1117 6.41939L10.6264 6.49716L9.61655 4.32373C9.53756 4.15373 9.33865 4.07615 9.16542 4.14777L8.43453 4.44996C8.26097 4.52172 8.17498 4.71767 8.2397 4.89403L9.06596 7.14625L8.6693 7.43501C8.19286 7.78185 7.77326 8.20129 7.426 8.68077L7.13772 9.0788L4.87768 8.25174C4.70149 8.1872 4.50575 8.27309 4.43394 8.44645L4.132 9.17541C4.06019 9.34877 4.13787 9.54791 4.30832 9.62697L6.4929 10.6413L6.4166 11.1255C6.32432 11.7112 6.32594 12.3055 6.41935 12.8883L6.4972 13.3741L4.31109 14.3872C4.14067 14.4662 4.06291 14.6655 4.1349 14.839L4.43804 15.5695C4.50989 15.7426 4.70539 15.8284 4.88168 15.764L7.14788 14.9366L7.4362 15.3324C7.7801 15.8044 8.19528 16.2206 8.66954 16.5659L9.06572 16.8543L8.23852 19.1169C8.17401 19.2931 8.2599 19.4888 8.43324 19.5606L9.16566 19.864C9.33901 19.9358 9.53813 19.8581 9.61712 19.6879L10.6303 17.5045L11.1155 17.5818C11.7002 17.675 12.2937 17.6746 12.8759 17.5826L13.3601 17.5061L14.3758 19.6909C14.4115 19.7679 14.4717 19.827 14.513 19.8471L14.5851 19.8764C14.6641 19.9021 14.7484 19.8993 14.8269 19.8669L15.5578 19.5647C15.7313 19.4929 15.8173 19.297 15.7526 19.1207L14.9232 16.8604L15.3213 16.5718C15.7984 16.226 16.2187 15.8075 16.5669 15.329L16.8554 14.9324L19.1174 15.7602C19.2935 15.8247 19.4893 15.7388 19.5611 15.5655L19.863 14.8365C19.9348 14.6632 19.8572 14.464 19.6867 14.385L17.504 13.3715L17.5815 12.8863C17.6752 12.2999 17.6747 11.7048 17.5821 11.121L17.5052 10.6359L19.6839 9.62652C19.8544 9.5476 19.9321 9.34824 19.8601 9.17478L19.557 8.44428C19.4851 8.27114 19.2896 8.18535 19.1134 8.24978L16.8581 9.07317L16.5699 8.67612C16.2185 8.19191 15.7923 7.76623 15.3043 7.41524L14.904 7.12736L15.7295 4.86992C15.7941 4.69374 15.7082 4.49802 15.5348 4.42622L14.8024 4.12284C14.6291 4.05104 14.4299 4.1287 14.3509 4.29898ZM13.3968 8.62786C15.2592 9.39929 16.1436 11.5344 15.3721 13.3968C14.6007 15.2592 12.4656 16.1436 10.6032 15.3722C8.74079 14.6007 7.85639 12.4656 8.62782 10.6032C9.39925 8.74083 11.5344 7.85643 13.3968 8.62786ZM9.82886 11.1007C9.33219 12.2998 9.9016 13.6745 11.1007 14.1711C12.2997 14.6678 13.6744 14.0984 14.1711 12.8993C14.6678 11.7002 14.0984 10.3256 12.8993 9.8289C11.7002 9.33223 10.3255 9.90164 9.82886 11.1007Z" fill="currentColor"/>
                        </svg>
                        <span className="font-medium">{diagnosticResult.analysis.partsReplaced.length} part{diagnosticResult.analysis.partsReplaced.length !== 1 ? 's' : ''} replaced</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}
            
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6 flex justify-between items-center">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'analysis'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Analysis
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'summary'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setActiveTab('visits')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'visits'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Visit Reports ({diagnosticResult.visitReports.length})
                </button>
                <button
                  onClick={() => setActiveTab('components')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'components'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Components History
                </button>
              </nav>
              {/* Generate PDF Button - in tabs area */}
              <button
                onClick={handleGeneratePDF}
                disabled={isGeneratingPDF}
                className="py-2 px-4 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isGeneratingPDF ? 'Generating PDF...' : 'Generate PDF Report (WIP)'}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'summary' && (
              <>
                {/* Timeline */}
                {(diagnosticResult.visitReports.length > 0 || diagnosticResult.breakdowns.length > 0) && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Last {getDaysBack(context)} days timeline
                    </h3>
                    <div className="relative pl-8">
                      {/* Main continuous timeline line */}
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-300"></div>
                      
                      <div className="space-y-4">
                        {(() => {
                          // Build timeline: breakdowns with their related visits nested
                          const allEvents: Array<{
                            type: 'visit' | 'breakdown'
                            date: Date
                            endDate?: Date
                            data: any
                            relatedVisits?: any[]
                            endedByVisit?: any
                          }> = []
                          
                          // Process breakdowns and their related visits
                          diagnosticResult.breakdowns.forEach((bd: any) => {
                            const startDate = bd.startTime ? new Date(bd.startTime) : null
                            const endDate = bd.endTime ? new Date(bd.endTime) : null
                            if (!startDate) return
                            
                            // Find visits that occurred during this breakdown
                            // Exclude maintenance visits (REGULAR, QUARTERLY, SEMI_ANNUAL) - they should never be linked to breakdowns
                            const relatedVisits = diagnosticResult.visitReports.filter((visit: any) => {
                              const visitDate = visit.date || visit.completedDate
                              if (!visitDate) return false
                              const vDate = new Date(visitDate)
                              
                              // Exclude maintenance visits
                              const visitType = (visit.type || '').toUpperCase()
                              if (visitType.includes('REGULAR') || 
                                  visitType.includes('QUARTERLY') || 
                                  visitType.includes('SEMI_ANNUAL') ||
                                  visitType.includes('MAINTENANCE')) {
                                return false
                              }
                              
                              return vDate >= startDate && (!endDate || vDate <= endDate)
                            })
                            
                            // Determine which visit ended the breakdown (if any)
                            // Usually the last visit that marked the unit as "working" or "in_service"
                            let endedByVisit: any = null
                            if (endDate && relatedVisits.length > 0) {
                              // Find visit closest to end date that marked unit as working
                              const workingVisits = relatedVisits.filter((v: any) => 
                                v.endStatus?.toLowerCase().includes('working') || 
                                v.endStatus?.toLowerCase().includes('in_service')
                              )
                              if (workingVisits.length > 0) {
                                // Sort by date and find the one closest to breakdown end
                                workingVisits.sort((a: any, b: any) => {
                                  const aDate = new Date(a.date || a.completedDate).getTime()
                                  const bDate = new Date(b.date || b.completedDate).getTime()
                                  return Math.abs(aDate - endDate.getTime()) - Math.abs(bDate - endDate.getTime())
                                })
                                endedByVisit = workingVisits[0]
                              }
                            }
                            
                            allEvents.push({
                              type: 'breakdown',
                              date: startDate,
                              endDate: endDate || undefined,
                              data: bd,
                              relatedVisits,
                              endedByVisit,
                            })
                          })
                          
                          // Add visits that aren't tied to breakdowns
                          diagnosticResult.visitReports.forEach((visit: any) => {
                            const date = visit.date || visit.completedDate
                            if (!date) return
                            const visitDate = new Date(date)
                            
                            // Check if this visit is already included in a breakdown
                            // Maintenance visits should never be linked to breakdowns
                            const visitType = (visit.type || '').toUpperCase()
                            const isMaintenanceVisit = visitType.includes('REGULAR') || 
                                                      visitType.includes('QUARTERLY') || 
                                                      visitType.includes('SEMI_ANNUAL') ||
                                                      visitType.includes('MAINTENANCE')
                            
                            const isInBreakdown = !isMaintenanceVisit && diagnosticResult.breakdowns.some((bd: any) => {
                              const startDate = bd.startTime ? new Date(bd.startTime) : null
                              const endDate = bd.endTime ? new Date(bd.endTime) : null
                              if (!startDate) return false
                              return visitDate >= startDate && (!endDate || visitDate <= endDate)
                            })
                            
                            if (!isInBreakdown) {
                              allEvents.push({
                                type: 'visit',
                                date: visitDate,
                                data: visit,
                              })
                            }
                          })
                          
                          // Sort by date (most recent first)
                          allEvents.sort((a, b) => b.date.getTime() - a.date.getTime())
                          
                          return allEvents.map((event, idx) => {
                            const isOngoing = event.type === 'breakdown' && !event.endDate
                            const duration = event.type === 'breakdown' && event.data.minutesDuration
                              ? `${Math.floor(event.data.minutesDuration / 60)}h ${event.data.minutesDuration % 60}m`
                              : null
                            
                            return (
                              <div key={idx} className="relative">
                                {/* Breakdown card */}
                                {event.type === 'breakdown' && (
                                  <>
                                    <div className="relative flex items-start">
                                      {/* Timeline dot - on main timeline */}
                                      <div className={`absolute -left-8 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-20 ${
                                        isOngoing ? 'bg-red-500 animate-pulse' : 'bg-red-400'
                                      }`}></div>
                                      
                                      {/* Breakdown card - colored background */}
                                      <div className={`flex-1 rounded-lg p-3 shadow-sm border-l-4 ${
                                        isOngoing
                                          ? 'bg-red-50 border-red-500'
                                          : 'bg-orange-50 border-orange-400'
                                      }`}>
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-200 text-red-800">
                                            {isOngoing ? 'ONGOING BREAKDOWN' : 'BREAKDOWN'}
                                          </span>
                                          {duration && (
                                            <span className="text-xs text-gray-600 font-medium">{duration}</span>
                                          )}
                                          <span className="text-xs text-gray-600">
                                            {formatEventDate(event.date.toISOString(), true)}
                                            {event.endDate && (
                                              <span className="text-gray-500">
                                                {' → '}
                                                {formatEventDate(event.endDate.toISOString(), true)}
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                        
                                        <div className="text-xs text-gray-700 space-y-0.5">
                                          {event.data.origin && (
                                            <p><strong>Origin:</strong> {event.data.origin}</p>
                                          )}
                                          {event.data.failureLocations && (
                                            <p><strong>Component:</strong> {translateStateKey(event.data.failureLocations)}</p>
                                          )}
                                          {event.data.publicComment && (
                                            <p className="text-gray-600 break-words"><strong>Comment:</strong> {event.data.publicComment}</p>
                                          )}
                                          {event.data.internalComment && (
                                            <p className="text-gray-500 break-words italic"><strong>Internal:</strong> {event.data.internalComment}</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Related visits - nested under breakdown */}
                                    {event.relatedVisits && event.relatedVisits.length > 0 && (
                                      <div className="relative mt-3 ml-8">
                                        {/* Vertical line extending down from main dot through all nested items */}
                                        <div className="absolute -left-8 top-0 w-0.5 bg-gray-300" style={{ height: '100%' }}></div>
                                        
                                        <div className="space-y-3">
                                          {event.relatedVisits.map((visit: any, vIdx: number) => {
                                            const visitDate = visit.date || visit.completedDate
                                            const isEndingVisit = event.endedByVisit && 
                                              (visit.date || visit.completedDate) === (event.endedByVisit.date || event.endedByVisit.completedDate)
                                            
                                            return (
                                              <div key={vIdx} className="relative flex items-start">
                                                {/* Horizontal connecting line from vertical line to dot */}
                                                <div className="absolute -left-8 top-2 w-4 h-0.5 bg-gray-300"></div>
                                                
                                                {/* Nested timeline dot */}
                                                <div className="absolute -left-4 top-2 w-2.5 h-2.5 rounded-full border-2 border-white bg-blue-400 shadow-sm z-10"></div>
                                                
                                                {/* Visit card - white background, consistent styling */}
                                                <div className="flex-1 rounded-lg p-2.5 border border-gray-200 bg-white shadow-sm">
                                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                                      {formatVisitType(visit.type || 'VISIT')}
                                                    </span>
                                                    {isEndingVisit && (
                                                      <span className="text-xs text-green-600 font-medium">✓ Ended breakdown</span>
                                                    )}
                                                    <span className="text-xs text-gray-600">
                                                      {formatEventDate(visitDate, false)}
                                                    </span>
                                                  </div>
                                                  
                                                  <div className="text-xs text-gray-700 space-y-0.5">
                                                    <p><strong>{visit.engineer || visit.fullName || 'N/A'}</strong> • {visit.endStatus || 'N/A'}</p>
                                                    {(visit.comment || visit.globalComment) && (
                                                      <p className="text-gray-600 break-words">{visit.comment || visit.globalComment}</p>
                                                    )}
                                        {/* Show maintenance issues */}
                                        {diagnosticResult.maintenanceIssues?.filter((issue: any) => {
                                          const issueDate = issue.completedDate
                                          if (!issueDate) return false
                                          const iDate = new Date(issueDate)
                                          const vDate = new Date(visitDate)
                                          return Math.abs(iDate.getTime() - vDate.getTime()) < 24 * 60 * 60 * 1000 // Same day
                                        }).slice(0, 2).map((issue: any, iIdx: number) => (
                                          <p key={iIdx} className="text-black text-xs break-words flex items-start gap-1">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5">
                                              <path d="M9.10835 1.28513C9.49052 1.49532 9.80505 1.80985 10.0152 2.19201L14.724 10.7533C15.3361 11.8664 14.9301 13.2649 13.8171 13.877C13.4775 14.0638 13.0962 14.1618 12.7087 14.1618H3.29121C2.02096 14.1618 0.991211 13.132 0.991211 11.8618C0.991211 11.4742 1.08914 11.0929 1.27591 10.7533L5.98464 2.19201C6.5968 1.079 7.99534 0.672972 9.10835 1.28513ZM7.12372 2.81851L2.41499 11.3798C2.33379 11.5275 2.29121 11.6933 2.29121 11.8618C2.29121 12.414 2.73893 12.8618 3.29121 12.8618H12.7087C12.8772 12.8618 13.0429 12.8192 13.1906 12.738C13.6745 12.4718 13.851 11.8638 13.5849 11.3798L8.87616 2.81851C8.78477 2.65235 8.64802 2.5156 8.48186 2.42421C7.99794 2.15806 7.38988 2.33459 7.12372 2.81851ZM7.99994 9.92539C8.44177 9.92539 8.79994 10.2836 8.79994 10.7254C8.79994 11.1672 8.44177 11.5254 7.99994 11.5254C7.55811 11.5254 7.19994 11.1672 7.19994 10.7254C7.19994 10.2836 7.55811 9.92539 7.99994 9.92539ZM7.99994 4.72539C8.32629 4.72539 8.59647 4.9659 8.64289 5.27934L8.64994 5.37539V8.30832C8.64994 8.6673 8.35892 8.95832 7.99994 8.95832C7.67359 8.95832 7.40341 8.71781 7.35699 8.40437L7.34994 8.30832V5.37539C7.34994 5.0164 7.64095 4.72539 7.99994 4.72539Z" fill="#DC2626"/>
                                            </svg>
                                            <span>{translateStateKey(issue.stateKey || '')}{issue.problemKey ? `: ${translateProblemKey(issue.problemKey)}` : ''}</span>
                                          </p>
                                        ))}
                                                    {/* Show parts from analysis partsReplaced (only if explicitly linked to this visit) */}
                                                    {diagnosticResult.analysis?.partsReplaced?.filter((part: any) => {
                                                      // Only show parts that are explicitly linked to THIS specific visit
                                                      // linkedToVisit should match the visit date exactly
                                                      if (!part.linkedToVisit) return false
                                                      
                                                      // Normalize both dates to compare (handle different formats)
                                                      const partLinkedDate = new Date(part.linkedToVisit).toDateString()
                                                      const thisVisitDate = new Date(visitDate).toDateString()
                                                      
                                                      return partLinkedDate === thisVisitDate
                                                    }).slice(0, 2).map((part: any, pIdx: number) => (
                                                      <p key={`part-${pIdx}`} className="text-black text-xs break-words">
                                                        🔧 Part replaced: {part.partName || 'Part'}
                                                      </p>
                                                    ))}
                                                  </div>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                                
                                {/* Standalone visit (not tied to breakdown) */}
                                {event.type === 'visit' && (
                                  <div className="relative flex items-start">
                                    {/* Timeline dot - on main timeline */}
                                    <div className="absolute -left-8 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-20 bg-blue-500"></div>
                                    
                                    {/* Visit card - white background, consistent styling */}
                                    <div className="flex-1 rounded-lg p-2.5 border border-gray-200 bg-white shadow-sm">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                          {formatVisitType(event.data.type || 'VISIT')}
                                        </span>
                                        <span className="text-xs text-gray-600">
                                          {formatEventDate(event.date.toISOString(), false)}
                                        </span>
                                      </div>
                                      
                                      <div className="text-xs text-gray-700 space-y-0.5">
                                        <p><strong>{event.data.engineer || event.data.fullName || 'N/A'}</strong> • {event.data.endStatus || 'N/A'}</p>
                                        {(event.data.comment || event.data.globalComment) && (
                                          <p className="text-gray-600 break-words">{event.data.comment || event.data.globalComment}</p>
                                        )}
                                        {/* Show maintenance issues */}
                                        {diagnosticResult.maintenanceIssues?.filter((issue: any) => {
                                          const issueDate = issue.completedDate
                                          if (!issueDate) return false
                                          const iDate = new Date(issueDate)
                                          const visitDate = event.date
                                          return Math.abs(iDate.getTime() - visitDate.getTime()) < 24 * 60 * 60 * 1000 // Same day
                                        }).slice(0, 2).map((issue: any, iIdx: number) => (
                                          <p key={iIdx} className="text-black text-xs break-words flex items-start gap-1">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5">
                                              <path d="M9.10835 1.28513C9.49052 1.49532 9.80505 1.80985 10.0152 2.19201L14.724 10.7533C15.3361 11.8664 14.9301 13.2649 13.8171 13.877C13.4775 14.0638 13.0962 14.1618 12.7087 14.1618H3.29121C2.02096 14.1618 0.991211 13.132 0.991211 11.8618C0.991211 11.4742 1.08914 11.0929 1.27591 10.7533L5.98464 2.19201C6.5968 1.079 7.99534 0.672972 9.10835 1.28513ZM7.12372 2.81851L2.41499 11.3798C2.33379 11.5275 2.29121 11.6933 2.29121 11.8618C2.29121 12.414 2.73893 12.8618 3.29121 12.8618H12.7087C12.8772 12.8618 13.0429 12.8192 13.1906 12.738C13.6745 12.4718 13.851 11.8638 13.5849 11.3798L8.87616 2.81851C8.78477 2.65235 8.64802 2.5156 8.48186 2.42421C7.99794 2.15806 7.38988 2.33459 7.12372 2.81851ZM7.99994 9.92539C8.44177 9.92539 8.79994 10.2836 8.79994 10.7254C8.79994 11.1672 8.44177 11.5254 7.99994 11.5254C7.55811 11.5254 7.19994 11.1672 7.19994 10.7254C7.19994 10.2836 7.55811 9.92539 7.99994 9.92539ZM7.99994 4.72539C8.32629 4.72539 8.59647 4.9659 8.64289 5.27934L8.64994 5.37539V8.30832C8.64994 8.6673 8.35892 8.95832 7.99994 8.95832C7.67359 8.95832 7.40341 8.71781 7.35699 8.40437L7.34994 8.30832V5.37539C7.34994 5.0164 7.64095 4.72539 7.99994 4.72539Z" fill="#DC2626"/>
                                            </svg>
                                            <span>{translateStateKey(issue.stateKey || '')}{issue.problemKey ? `: ${translateProblemKey(issue.problemKey)}` : ''}</span>
                                          </p>
                                        ))}
                                        {/* Show parts from analysis partsReplaced (only if explicitly linked to this visit) */}
                                        {diagnosticResult.analysis?.partsReplaced?.filter((part: any) => {
                                          // Only show parts that are explicitly linked to THIS specific visit
                                          // linkedToVisit should match the visit date exactly
                                          if (!part.linkedToVisit) return false
                                          
                                          // Normalize both dates to compare (handle different formats)
                                          const partLinkedDate = new Date(part.linkedToVisit).toDateString()
                                          const thisVisitDate = new Date(event.date).toDateString()
                                          
                                          return partLinkedDate === thisVisitDate
                                        }).slice(0, 2).map((part: any, pIdx: number) => (
                                          <p key={`part-${pIdx}`} className="text-black text-xs break-words">
                                            🔧 Part replaced: {part.partName || 'Part'}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'visits' && (
              <>
                {/* Visit Reports Table */}
                {diagnosticResult.visitReports.length > 0 && (
                  <div className="mb-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engineer</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">PDF</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {diagnosticResult.visitReports.map((visit: any, idx: number) => {
                            // Find maintenance issues for this visit
                            const visitIssues = diagnosticResult.maintenanceIssues?.filter((issue: any) => {
                              const visitDate = visit.date || visit.completedDate
                              const issueDate = issue.completedDate
                              if (visitDate && issueDate) {
                                const visitDateStr = visitDate.substring(0, 10)
                                const issueDateStr = issueDate.substring(0, 10)
                                return visitDateStr === issueDateStr && 
                                       (visit.type?.toUpperCase() === issue.type?.toUpperCase() || 
                                        issue.type?.toUpperCase().includes('REGULAR') || 
                                        issue.type?.toUpperCase().includes('QUARTERLY') ||
                                        issue.type?.toUpperCase().includes('SEMI_ANNUAL'))
                              }
                              return false
                            }) || []
                            
                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {formatEventDate(visit.date || visit.completedDate || '', false)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                  {visit.engineer || visit.fullName || 'N/A'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                                    visit.type?.toLowerCase().includes('breakdown') || visit.type?.toLowerCase().includes('callout')
                                      ? 'bg-red-100 text-red-800'
                                      : visit.type?.toLowerCase().includes('regular') || visit.type?.toLowerCase().includes('maintenance')
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {formatVisitType(visit.type || 'N/A')}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                                    visit.endStatus?.toLowerCase() === 'in_service' || visit.endStatus?.toLowerCase() === 'working'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {visit.endStatus || 'N/A'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {visitIssues.length > 0 ? (
                                    <div className="space-y-1">
                                      {visitIssues.slice(0, 2).map((issue: any, issueIdx: number) => (
                                        <div key={issueIdx} className="text-xs">
                                          <span className="font-medium text-orange-700">
                                            {translateStateKey(issue.stateKey || 'Component')}
                                          </span>
                                          {issue.problemKey && (
                                            <span className="text-gray-600">: {translateProblemKey(issue.problemKey)}</span>
                                          )}
                                          {issue.followUp && (
                                            <span className={`ml-1 text-xs ${
                                              issue.followUp.toLowerCase().includes('resolved') || issue.followUp.toLowerCase().includes('yes')
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                            }`}>
                                              {issue.followUp.toLowerCase().includes('resolved') || issue.followUp.toLowerCase().includes('yes') ? '✓' : '✗'}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                      {visitIssues.length > 2 && (
                                        <div className="text-xs text-gray-500">
                                          +{visitIssues.length - 2} more
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                  {visit.pdfReport ? (
                                    <a
                                      href={visit.pdfReport}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-block text-gray-600 hover:text-blue-600 transition-colors"
                                      title="Download PDF Report"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path fillRule="evenodd" clipRule="evenodd" d="M14 10.35C14.3263 10.35 14.5965 10.5905 14.6429 10.9039L14.65 11V13C14.65 13.8633 13.987 14.5717 13.1423 14.6439L13 14.65H2.99998C2.13667 14.65 1.42821 13.987 1.35603 13.1423L1.34998 13V11C1.34998 10.641 1.64099 10.35 1.99998 10.35C2.32633 10.35 2.5965 10.5905 2.64293 10.9039L2.64998 11V13C2.64998 13.1691 2.76995 13.3102 2.92944 13.3429L2.99998 13.35H13C13.1691 13.35 13.3102 13.23 13.3429 13.0705L13.35 13V11C13.35 10.641 13.641 10.35 14 10.35ZM7.99998 1.84998C8.32633 1.84998 8.5965 2.09048 8.64293 2.40392L8.64998 2.49998L8.64898 8.23398L10.5658 6.51621C10.833 6.27645 11.244 6.29867 11.4837 6.56584C11.6995 6.8063 11.7031 7.16322 11.5069 7.40699L11.4341 7.48374L8.43411 10.176C8.21457 10.373 7.89443 10.3949 7.65254 10.2416L7.56584 10.176L4.56584 7.48374C4.29867 7.24398 4.27645 6.83302 4.51621 6.56584C4.732 6.32538 5.08645 6.28334 5.34996 6.45212L5.43411 6.51621L7.34898 8.23498L7.34998 2.49998C7.34998 2.14099 7.64099 1.84998 7.99998 1.84998Z" fill="currentColor"/>
                                      </svg>
                                    </a>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {activeTab === 'analysis' && (
              <>
                {/* Final Executive Summary */}
                {diagnosticResult.analysis?.finalExecSummary && (
                  <div className="mb-8 rounded-lg overflow-hidden border border-[#73A1FF]" style={{ background: 'linear-gradient(to bottom, #D8D8EF 0%, #ffffff 100%)' }}>
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">Executive Summary</h3>
                      <p className="text-gray-700 leading-relaxed text-sm">
                        {diagnosticResult.analysis.finalExecSummary.replace(/at Unit /gi, '').replace(/at /gi, '')}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Operational Summary */}
                {diagnosticResult.analysis?.executiveSummary && (
                  <div className="mb-12 border-l-4 border-[#73A1FF]">
                    <div className="mb-6 rounded-lg overflow-hidden" style={{ background: 'linear-gradient(to right, #D8D8EF 0%, #ffffff 100%)' }}>
                      <div className="p-5 pl-8">
                        <h3 className="text-xl font-semibold text-gray-900">Operational Summary</h3>
                      </div>
                    </div>
                    
                    {typeof diagnosticResult.analysis.executiveSummary === 'object' ? (
                      <div className="pl-8 space-y-5">
                        {/* Overview */}
                        {diagnosticResult.analysis.executiveSummary.overview && (
                          <div className="rounded-lg border-l-4 border-[#73A1FF] p-4" style={{ backgroundColor: 'rgba(216, 216, 239, 0.3)' }}>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">Overview</h4>
                            <p className="text-gray-700 leading-relaxed text-sm">
                              {diagnosticResult.analysis.executiveSummary.overview.replace(/at Unit /gi, '').replace(/at /gi, '')}
                            </p>
                          </div>
                        )}
                        
                        {/* Summary of Events */}
                        {diagnosticResult.analysis.executiveSummary.summaryOfEvents && (
                          <div className="rounded-lg border-l-4 border-[#73A1FF] p-4" style={{ backgroundColor: 'rgba(216, 216, 239, 0.3)' }}>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">Summary of Events</h4>
                            <p className="text-gray-700 leading-relaxed text-sm">
                              {diagnosticResult.analysis.executiveSummary.summaryOfEvents.replace(/at Unit /gi, '').replace(/at /gi, '')}
                            </p>
                          </div>
                        )}
                        
                        {/* Current Situation */}
                        {diagnosticResult.analysis.executiveSummary.currentSituation && (
                          <div className="rounded-lg border-l-4 border-[#73A1FF] p-4" style={{ backgroundColor: 'rgba(216, 216, 239, 0.3)' }}>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">Current Situation and Next Steps</h4>
                            <p className="text-gray-700 leading-relaxed text-sm">
                              {diagnosticResult.analysis.executiveSummary.currentSituation.replace(/at Unit /gi, '').replace(/at /gi, '')}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pl-8">
                        <p className="text-gray-700 leading-relaxed text-sm">
                          {diagnosticResult.analysis.executiveSummary.replace(/at Unit /gi, '').replace(/at /gi, '')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Technical Summary */}
                {diagnosticResult.analysis?.technicalSummary && (
                  <div className="mb-12">
                    <div className="mb-6 rounded-lg overflow-hidden border-t-4 border-[#6D709C]" style={{ background: 'linear-gradient(to right, #D8D8EF 0%, #ffffff 100%)' }}>
                      <div className="p-5">
                        <h3 className="text-xl font-semibold text-gray-900">Technical Summary</h3>
                      </div>
                    </div>
                    
                    {/* Overview */}
                    {diagnosticResult.analysis.technicalSummary.overview && (
                      <p className="text-gray-700 leading-relaxed text-sm mb-8">{diagnosticResult.analysis.technicalSummary.overview}</p>
                    )}
                    
                    {/* Pattern Details */}
                    {diagnosticResult.analysis.technicalSummary.patternDetails && diagnosticResult.analysis.technicalSummary.patternDetails.length > 0 && (
                      <div className="space-y-6">
                        {diagnosticResult.analysis.technicalSummary.patternDetails.map((pattern: any, idx: number) => (
                          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow" style={{ backgroundColor: 'rgba(216, 216, 239, 0.2)' }}>
                            <div className="border-t-4 border-[#73A1FF]">
                              {/* Pattern Name */}
                              <div className="p-5" style={{ backgroundColor: 'rgba(109, 112, 156, 0.1)' }}>
                                <h4 className="text-lg font-semibold text-gray-900">{pattern.patternName}</h4>
                              </div>
                              
                              <div className="p-6 bg-white space-y-6">
                                {/* Verdict */}
                                <div className="pb-5 border-b border-gray-200" style={{ backgroundColor: 'rgba(216, 216, 239, 0.15)' }}>
                                  <p className="text-gray-700 leading-relaxed text-sm p-3">{pattern.verdict}</p>
                                </div>
                                
                                {/* Quantified Impact */}
                                {pattern.quantifiedImpact && (
                                  <div className="pb-5 border-b border-gray-200">
                                    <h5 className="text-base font-semibold text-gray-900 mb-3">Quantified Impact</h5>
                                    <div className="text-sm text-gray-700 space-y-2">
                                      <p><strong>Breakdowns:</strong> {pattern.quantifiedImpact.breakdownCount} over {pattern.quantifiedImpact.timeSpan}</p>
                                      <p><strong>Downtime:</strong> {pattern.quantifiedImpact.downtimeHours} total ({pattern.quantifiedImpact.downtimePerEvent} per event)</p>
                                      <div className="flex items-center gap-2">
                                        <strong>Risk Level:</strong>
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                          pattern.quantifiedImpact.riskLevel.toLowerCase() === 'high' 
                                            ? 'bg-red-100 text-red-800'
                                            : pattern.quantifiedImpact.riskLevel.toLowerCase() === 'medium'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-green-100 text-green-800'
                                        }`}>
                                          {pattern.quantifiedImpact.riskLevel.toUpperCase()}
                                        </span>
                                        <span className="text-gray-600">- {pattern.quantifiedImpact.riskRationale}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Root Cause Analysis */}
                                {pattern.driverTree && (
                                  <div className="pb-5 border-b border-gray-200 border-l-4 border-[#73A1FF] pl-4">
                                    <h5 className="text-base font-semibold text-gray-900 mb-2">Root Cause Analysis</h5>
                                    <p className="text-sm text-gray-700 mb-2">{pattern.driverTree.replace(/^Defective materials? →?\s*/i, '').replace(/^Defective materials? and \w+ →?\s*/i, '')}</p>
                                    {diagnosticResult.analysis?.hypotheses && diagnosticResult.analysis.hypotheses.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-gray-200">
                                        {diagnosticResult.analysis.hypotheses.map((hyp: any, hypIdx: number) => (
                                          <p key={hypIdx} className="text-sm text-gray-700 mt-1">
                                            <span className="font-medium">{hyp.category} ({hyp.likelihood} likelihood):</span> {hyp.reasoning}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Actionable Recommendations */}
                                {pattern.actionableRecommendations && pattern.actionableRecommendations.length > 0 && (
                                  <div className="pb-5 border-b border-gray-200">
                                    <h5 className="text-base font-semibold text-gray-900 mb-3">Actionable Recommendations</h5>
                                    <div className="space-y-4">
                                      {pattern.actionableRecommendations.map((rec: any, recIdx: number) => (
                                        <div key={recIdx} className="rounded-lg border border-gray-200 p-4" style={{ backgroundColor: 'rgba(216, 216, 239, 0.15)' }}>
                                          <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#73A1FF] text-white flex items-center justify-center text-xs font-semibold">
                                              {recIdx + 1}
                                            </div>
                                            <div className="flex-1">
                                              <p className="font-medium text-gray-900 mb-2">{rec.action}</p>
                                              <p className="text-sm text-gray-600 mb-1">
                                                <strong>Timeframe:</strong> <span className="font-medium">{rec.timeframe.replace(/_/g, ' ')}</span>
                                              </p>
                                              <p className="text-sm text-gray-600"><strong>Expected:</strong> {rec.expectedOutcome}</p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Resolution Probability */}
                                {pattern.resolutionProbability && (
                                  <div>
                                    <h5 className="text-base font-semibold text-gray-900 mb-3">Probability of Resolution</h5>
                                    <div className="space-y-2">
                                      <p className="text-sm text-gray-700"><strong>Success Rate:</strong> {pattern.resolutionProbability.probability}</p>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                          className="bg-[#73A1FF] h-2 rounded-full transition-all"
                                          style={{ width: pattern.resolutionProbability.probability }}
                                        ></div>
                                      </div>
                                      <p className="text-sm text-gray-700 mt-3"><strong>If issue persists:</strong> {pattern.resolutionProbability.escalationPath}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Fallback: Show Repeated Patterns if Technical Summary not available */}
                {!diagnosticResult.analysis?.technicalSummary && diagnosticResult.analysis?.repeatedPatterns && diagnosticResult.analysis.repeatedPatterns.length > 0 && (
                  <div className="mb-12">
                    <div className="mb-6 rounded-lg overflow-hidden border-t-4 border-yellow-400" style={{ background: 'linear-gradient(to right, #FEF3C7 0%, #ffffff 100%)' }}>
                      <div className="p-5">
                        <h3 className="text-xl font-semibold text-gray-900">Repeated Patterns</h3>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {diagnosticResult.analysis.repeatedPatterns.map((pattern: any, idx: number) => (
                        <div key={idx} className="border border-yellow-300 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow" style={{ backgroundColor: 'rgba(254, 243, 199, 0.3)' }}>
                          <p className="font-semibold text-gray-900 mb-3 text-base">
                            {pattern.pattern} ({pattern.frequency} occurrences)
                          </p>
                          {pattern.summary && (
                            <p className="text-sm text-gray-700 mb-3 leading-relaxed">{pattern.summary}</p>
                          )}
                          {pattern.rootCause && (
                            <p className="text-sm text-gray-700 mb-2 border-l-3 border-yellow-400 pl-3"><strong>Root Cause:</strong> {pattern.rootCause}</p>
                          )}
                          {pattern.impact && (
                            <p className="text-sm text-gray-700 mb-2 border-l-3 border-yellow-400 pl-3"><strong>Impact:</strong> {pattern.impact}</p>
                          )}
                          {pattern.escalationPath && (
                            <p className="text-sm text-gray-700 mb-2 border-l-3 border-yellow-400 pl-3"><strong>Escalation:</strong> {pattern.escalationPath}</p>
                          )}
                          {pattern.correlation && (
                            <p className="text-sm text-gray-700 mb-2 border-l-3 border-yellow-400 pl-3"><strong>Correlation:</strong> {pattern.correlation}</p>
                          )}
                          {pattern.examples && pattern.examples.length > 0 && (
                            <ul className="list-disc list-inside text-sm text-gray-700 mt-3 ml-4 space-y-1">
                              {pattern.examples.slice(0, 3).map((example: string, exIdx: number) => (
                                <li key={exIdx}>{example}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Hypotheses - Only show if Technical Summary not available */}
                {!diagnosticResult.analysis?.technicalSummary && diagnosticResult.analysis?.hypotheses && diagnosticResult.analysis.hypotheses.length > 0 && (
                  <div className="mb-12">
                    <div className="mb-6 rounded-lg overflow-hidden border-t-4 border-[#73A1FF]" style={{ background: 'linear-gradient(to right, #D8D8EF 0%, #ffffff 100%)' }}>
                      <div className="p-5">
                        <h3 className="text-xl font-semibold text-gray-900">Likely Causes</h3>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {diagnosticResult.analysis.hypotheses.map((hypothesis: any, idx: number) => (
                        <div key={idx} className="border border-[#73A1FF] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow" style={{ backgroundColor: 'rgba(216, 216, 239, 0.2)' }}>
                          <p className="font-semibold text-gray-900 mb-2 text-base">
                            {hypothesis.category} ({hypothesis.likelihood} likelihood)
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">{hypothesis.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
              </>
            )}

            {activeTab === 'components' && (
              <>
                {/* Components History */}
                <div className="mb-6">
                  {(() => {
                    // Build comprehensive component map with all details
                    const componentsMap = new Map<string, {
                      component: string
                      faults: Array<{ component: string; problem: string; date: string; resolved: boolean }>
                      breakdowns: Array<{ breakdownId: string; date: string; duration: string }>
                      partsReplaced: Array<{ partName: string; replacementDate: string; requestNumber: string }>
                    }>()

                    // From maintenance issues (faults)
                    diagnosticResult.maintenanceIssues?.forEach((issue: any) => {
                      const component = translateStateKey(issue.stateKey || '')
                      if (component && component !== 'N/A') {
                        const existing = componentsMap.get(component) || { 
                          component, 
                          faults: [], 
                          breakdowns: [], 
                          partsReplaced: [] 
                        }
                        existing.faults.push({
                          component: translateStateKey(issue.stateKey || ''),
                          problem: issue.problemKey ? translateProblemKey(issue.problemKey) : '',
                          date: issue.completedDate || '',
                          resolved: issue.followUp === true || issue.followUp?.toLowerCase().includes('resolved') || issue.followUp?.toLowerCase().includes('yes')
                        })
                        componentsMap.set(component, existing)
                      }
                    })

                    // From breakdowns
                    diagnosticResult.breakdowns?.forEach((bd: any) => {
                      if (bd.failureLocations) {
                        const component = translateStateKey(bd.failureLocations)
                        if (component && component !== 'N/A') {
                          const existing = componentsMap.get(component) || { 
                            component, 
                            faults: [], 
                            breakdowns: [], 
                            partsReplaced: [] 
                          }
                          const duration = bd.minutesDuration 
                            ? `${Math.floor(bd.minutesDuration / 60)}h ${bd.minutesDuration % 60}m`
                            : 'N/A'
                          existing.breakdowns.push({
                            breakdownId: bd.breakdownId || '',
                            date: bd.startTime || '',
                            duration
                          })
                          componentsMap.set(component, existing)
                        }
                      }
                    })

                    // Link parts to components
                    diagnosticResult.analysis?.partsReplaced?.forEach((part: any) => {
                      const componentName = part.component || ''
                      if (componentName && componentName !== 'N/A') {
                        // Try to find matching component (exact match or partial match)
                        let matchedComponent: string | null = null
                        
                        // First try exact match
                        if (componentsMap.has(componentName)) {
                          matchedComponent = componentName
                        } else {
                          // Try partial match - check if component name contains part component or vice versa
                          for (const [compName] of Array.from(componentsMap.entries())) {
                            const compLower = compName.toLowerCase()
                            const partCompLower = componentName.toLowerCase()
                            if (compLower.includes(partCompLower) || partCompLower.includes(compLower)) {
                              matchedComponent = compName
                              break
                            }
                          }
                        }
                        
                        if (matchedComponent) {
                          const existing = componentsMap.get(matchedComponent)!
                          existing.partsReplaced.push({
                            partName: part.partName || 'N/A',
                            replacementDate: part.replacementDate || '',
                            requestNumber: part.repairRequestNumber || ''
                          })
                        } else {
                          // Create new entry for component with only parts replaced
                          componentsMap.set(componentName, {
                            component: componentName,
                            faults: [],
                            breakdowns: [],
                            partsReplaced: [{
                              partName: part.partName || 'N/A',
                              replacementDate: part.replacementDate || '',
                              requestNumber: part.repairRequestNumber || ''
                            }]
                          })
                        }
                      }
                    })

                    const components = Array.from(componentsMap.values()).sort((a, b) => {
                      const aTotal = a.faults.length + a.breakdowns.length + a.partsReplaced.length
                      const bTotal = b.faults.length + b.breakdowns.length + b.partsReplaced.length
                      return bTotal - aTotal
                    })

                    if (components.length > 0) {
                      return (
                        <div className="space-y-6">
                          {components.map((comp, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4">{comp.component}</h4>
                              
                              {/* Related Faults */}
                              {comp.faults.length > 0 && (
                                <div className="mb-4">
                                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Related Faults ({comp.faults.length})</h5>
                                  <div className="space-y-2">
                                    {comp.faults.map((fault, fIdx) => (
                                      <div key={fIdx} className="text-sm text-gray-600 pl-4 border-l-2 border-orange-200">
                                        <div className="flex items-start gap-2">
                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5">
                                            <path d="M9.10835 1.28513C9.49052 1.49532 9.80505 1.80985 10.0152 2.19201L14.724 10.7533C15.3361 11.8664 14.9301 13.2649 13.8171 13.877C13.4775 14.0638 13.0962 14.1618 12.7087 14.1618H3.29121C2.02096 14.1618 0.991211 13.132 0.991211 11.8618C0.991211 11.4742 1.08914 11.0929 1.27591 10.7533L5.98464 2.19201C6.5968 1.079 7.99534 0.672972 9.10835 1.28513ZM7.12372 2.81851L2.41499 11.3798C2.33379 11.5275 2.29121 11.6933 2.29121 11.8618C2.29121 12.414 2.73893 12.8618 3.29121 12.8618H12.7087C12.8772 12.8618 13.0429 12.8192 13.1906 12.738C13.6745 12.4718 13.851 11.8638 13.5849 11.3798L8.87616 2.81851C8.78477 2.65235 8.64802 2.5156 8.48186 2.42421C7.99794 2.15806 7.38988 2.33459 7.12372 2.81851ZM7.99994 9.92539C8.44177 9.92539 8.79994 10.2836 8.79994 10.7254C8.79994 11.1672 8.44177 11.5254 7.99994 11.5254C7.55811 11.5254 7.19994 11.1672 7.19994 10.7254C7.19994 10.2836 7.55811 9.92539 7.99994 9.92539ZM7.99994 4.72539C8.32629 4.72539 8.59647 4.9659 8.64289 5.27934L8.64994 5.37539V8.30832C8.64994 8.6673 8.35892 8.95832 7.99994 8.95832C7.67359 8.95832 7.40341 8.71781 7.35699 8.40437L7.34994 8.30832V5.37539C7.34994 5.0164 7.64095 4.72539 7.99994 4.72539Z" fill="#DC2626"/>
                                          </svg>
                                          <div className="flex-1">
                                            <span className="font-medium">{fault.component}</span>
                                            {fault.problem && <span className="text-gray-600">: {fault.problem}</span>}
                                            {fault.date && (
                                              <span className="text-gray-500 ml-2">({formatEventDate(fault.date, false)})</span>
                                            )}
                                            {fault.resolved && (
                                              <span className="text-green-600 ml-2 text-xs">✓ Resolved</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Related Breakdowns */}
                              {comp.breakdowns.length > 0 && (
                                <div className="mb-4">
                                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Related Breakdowns ({comp.breakdowns.length})</h5>
                                  <div className="space-y-2">
                                    {comp.breakdowns.map((bd, bIdx) => (
                                      <div key={bIdx} className="text-sm text-gray-600 pl-4 border-l-2 border-red-200">
                                        <div>
                                          <span className="font-medium">Breakdown</span>
                                          {bd.date && (
                                            <span className="text-gray-500 ml-2">({formatEventDate(bd.date, false)})</span>
                                          )}
                                          {bd.duration && bd.duration !== 'N/A' && (
                                            <span className="text-gray-500 ml-2">- Duration: {bd.duration}</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Parts Replaced */}
                              {comp.partsReplaced.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Parts Replaced ({comp.partsReplaced.length})</h5>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Part</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Replacement Date</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request Number</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {comp.partsReplaced.map((part, pIdx) => (
                                          <tr key={pIdx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                              {part.partName}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-600">
                                              {part.replacementDate ? formatEventDate(part.replacementDate, false) : 'N/A'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-500">
                                              {part.requestNumber || 'N/A'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {comp.faults.length === 0 && comp.breakdowns.length === 0 && comp.partsReplaced.length === 0 && (
                                <p className="text-sm text-gray-500">No related data for this component.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return (
                      <div className="text-center py-8 text-gray-500">
                        No component history available for this period.
                      </div>
                    )
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
        </div>
    </main>
    </div>
  )
}
