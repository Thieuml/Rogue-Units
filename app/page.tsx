'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import useSWR from 'swr'
import { WeMaintainLogo } from '@/components/WeMaintainLogo'
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
  unitId: string
  unitName: string
  buildingName: string
  visitReports: any[]
  breakdowns: any[]
  maintenanceIssues: any[]
  repairRequests?: any[]
  analysis: any
  generatedAt: Date
}

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
]

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
  const [country, setCountry] = useState<string>('FR')
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
  const [showRecentResults, setShowRecentResults] = useState(false)
  const [recentResults, setRecentResults] = useState<DiagnosticResult[]>([])
  const [activeTab, setActiveTab] = useState<'summary' | 'visits' | 'analysis' | 'components'>('summary')
  
  const buildingInputRef = useRef<HTMLInputElement>(null)
  const deviceInputRef = useRef<HTMLInputElement>(null)
  const buildingDropdownRef = useRef<HTMLDivElement>(null)
  const deviceDropdownRef = useRef<HTMLDivElement>(null)
  
  // Fetch buildings and devices for selected country
  const { data: data, isLoading: dataLoading, error: dataError } = useSWR<{ buildings: Building[], devices: Device[] }>(
    `/api/buildings?country=${country}`,
    fetcher,
    {
      onError: (error) => {
        console.error('[Debug] SWR Error:', error)
      },
      onSuccess: (data) => {
        console.log('[Debug] SWR Success:', data)
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
  
  // Load recent results from API
  useEffect(() => {
    console.log('[UI] Fetching recent diagnostics...')
    fetch('/api/diagnostic/recent')
      .then(res => {
        console.log('[UI] Recent diagnostics response status:', res.status)
        return res.json()
      })
        .then(data => {
        console.log('[UI] Recent diagnostics data received:', {
          hasResults: !!data.results,
          resultsCount: data.results?.length || 0,
          results: data.results,
        })
        if (data.results) {
          setRecentResults(data.results)
          console.log('[UI] Set recent results:', data.results.length, 'items')
        } else {
          console.warn('[UI] No results in response:', data)
          setRecentResults([])
          }
        })
        .catch(err => {
        console.error('[UI] Error loading recent results:', err)
        setRecentResults([])
      })
  }, [])
  
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
    }
    
    if (showBuildingDropdown || showDeviceDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showBuildingDropdown, showDeviceDropdown])
  
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
    
    if (!deviceSearch.trim()) return devices.slice(0, 50) // Show first 50 when no search
    
    const search = deviceSearch.toLowerCase()
    return devices.filter(d => d.name.toLowerCase().includes(search)).slice(0, 50)
  }, [data?.devices, selectedBuildingId, deviceSearch])
  
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
      fetch('/api/diagnostic/recent')
        .then(res => res.json())
        .then(data => {
          if (data.results) {
            setRecentResults(data.results)
          }
        })
        .catch(err => console.error('Error refreshing recent results:', err))
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <WeMaintainLogo />
        </div>
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <div className="px-3 py-2 text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Navigation
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setShowRecentResults(false)
                setDiagnosticResult(null)
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className={`block px-3 py-2 rounded-md text-white font-medium ${
                !showRecentResults && !diagnosticResult ? 'bg-slate-700' : 'hover:bg-slate-700'
              }`}
            >
              Lift Diagnostic
            </a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setShowRecentResults(true)
                setDiagnosticResult(null)
                // Scroll to top to show recent results
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className={`block px-3 py-2 rounded-md text-white font-medium ${
                showRecentResults ? 'bg-slate-700' : 'hover:bg-slate-700'
              }`}
            >
              Recent Diagnostics
            </a>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-4xl mx-auto">
          {/* Recent Results View - Show first if selected */}
          {showRecentResults && !diagnosticResult && (
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-4 text-gray-900">Recent Diagnostics (Last 7 Days)</h1>
              <div className="mb-4 text-sm text-gray-600">
                Found {recentResults.length} recent diagnostic{recentResults.length !== 1 ? 's' : ''}
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
                        className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          console.log('[UI] Clicked on recent diagnostic:', result.unitName)
                          setDiagnosticResult(result)
                          setShowRecentResults(false)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 text-lg mb-1">{result.unitName}</h3>
                            <p className="text-sm text-gray-600 mb-2">{result.buildingName}</p>
                            <div className="flex gap-4 text-xs text-gray-500">
                              <span>{result.visitReports?.length || 0} visits</span>
                              <span>{result.breakdowns?.length || 0} breakdowns</span>
                              {result.analysis && (
                                <span className="text-green-600">✓ Analysis available</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                              Generated: {new Date(result.generatedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="ml-4">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
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
              
              {/* Country Selection */}
              <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-700">Country</label>
            <div className="flex gap-2">
              {COUNTRIES.map((c) => (
              <button
                  key={c.code}
                  onClick={() => setCountry(c.code)}
                  className={`px-4 py-2 rounded font-medium transition-colors ${
                    country === c.code
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  {c.name} ({c.code})
              </button>
            ))}
          </div>
        </div>
      
      {/* Building Selection */}
          <div className="mb-6 relative">
            <label className="block text-sm font-medium mb-2 text-gray-700">Building</label>
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
                placeholder="Type building name or address..."
                className="w-full p-3 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={dataLoading}
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
                className="w-full p-3 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!selectedBuildingId || dataLoading}
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
                      <div className="mb-4">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-spin">
                          <path d="M16.5 8.35C25.4194 8.35 32.65 15.5806 32.65 24.5C32.65 26.7172 32.2032 28.8301 31.3947 30.7535C34.6231 33.0752 39.3247 36.4561 45.4979 40.8951C46.8431 41.8624 47.1494 43.737 46.1821 45.0822L46.1649 45.106L45.4953 46.0182C44.5216 47.3445 42.6613 47.6392 41.3254 46.6786C35.1678 42.2507 30.4745 38.8759 27.2456 36.554C24.392 39.1022 20.6267 40.65 16.5 40.65C7.5806 40.65 0.35 33.4194 0.35 24.5C0.35 15.5806 7.5806 8.35 16.5 8.35ZM33.3651 33.7719L30.687 37.4275C33.6332 39.546 37.4323 42.2779 42.0844 45.6231C42.8414 46.1675 43.8956 46.0005 44.4473 45.2489L45.1169 44.3368C45.1218 44.33 45.1218 44.33 45.1267 44.3233C45.6748 43.561 45.5012 42.4987 44.7389 41.9506C40.1042 38.6178 36.3129 35.8916 33.3651 33.7719ZM16.5 9.65C8.29857 9.65 1.65 16.2986 1.65 24.5C1.65 32.7014 8.29857 39.35 16.5 39.35C24.7014 39.35 31.35 32.7014 31.35 24.5C31.35 16.2986 24.7014 9.65 16.5 9.65ZM16.5 10.85C24.0387 10.85 30.15 16.9613 30.15 24.5C30.15 32.0387 24.0387 38.15 16.5 38.15C8.96131 38.15 2.85 32.0387 2.85 24.5C2.85 16.9613 8.96131 10.85 16.5 10.85ZM16.5 12.15C9.67928 12.15 4.15 17.6793 4.15 24.5C4.15 31.3207 9.67928 36.85 16.5 36.85C23.3207 36.85 28.85 31.3207 28.85 24.5C28.85 17.6793 23.3207 12.15 16.5 12.15ZM30.8303 31.9491L30.7362 32.1326C30.0478 33.4137 29.1916 34.5913 28.1969 35.6358C28.6451 35.9591 29.1239 36.3035 29.6322 36.669L32.3087 33.0122C31.7851 32.6357 31.2923 32.2813 30.8303 31.9491ZM20.6526 30.4252C20.7564 30.7689 20.562 31.1316 20.2183 31.2355C18.8247 31.6565 17.4281 31.8675 16.0304 31.8675C14.6326 31.8675 13.236 31.6565 11.8424 31.2355C11.4987 31.1316 11.3043 30.7689 11.4081 30.4252C11.512 30.0816 11.8747 29.8872 12.2183 29.991C13.4914 30.3756 14.7614 30.5675 16.0304 30.5675C17.2993 30.5675 18.5693 30.3756 19.8424 29.991C20.186 29.8872 20.5487 30.0816 20.6526 30.4252ZM11.8599 20.5739C13.7155 21.3615 14.5812 23.5043 13.7936 25.3599C13.0059 27.2155 10.8631 28.0812 9.00754 27.2936C7.15195 26.5059 6.28621 24.3631 7.07387 22.5075C7.86152 20.652 10.0043 19.7862 11.8599 20.5739ZM23.9965 19.988C25.7244 21.0262 26.2835 23.2686 25.2453 24.9965C24.207 26.7244 21.9646 27.2835 20.2367 26.2453C18.5088 25.207 17.9497 22.9646 18.988 21.2367C20.0262 19.5088 22.2686 18.9497 23.9965 19.988ZM8.27052 23.0155C7.7634 24.2102 8.3208 25.5898 9.51549 26.0969C10.7102 26.604 12.0898 26.0466 12.5969 24.8519C13.104 23.6572 12.5466 22.2776 11.3519 21.7705C10.1572 21.2634 8.77764 21.8208 8.27052 23.0155ZM20.1023 21.9063C19.4338 23.0188 19.7938 24.4625 20.9063 25.131C22.0188 25.7994 23.4625 25.4394 24.131 24.327C24.7994 23.2145 24.4394 21.7707 23.327 21.1023C22.2145 20.4338 20.7707 20.7938 20.1023 21.9063ZM10.4215 22.299C10.8028 22.4608 10.9807 22.9011 10.8188 23.2824C10.657 23.6637 10.2167 23.8416 9.83538 23.6797C9.45409 23.5179 9.2762 23.0776 9.43805 22.6963C9.5999 22.315 10.0402 22.1371 10.4215 22.299ZM22.332 21.4961C22.6871 21.7094 22.8019 22.1702 22.5886 22.5252C22.3753 22.8803 21.9145 22.9952 21.5595 22.7818C21.2044 22.5685 21.0895 22.1077 21.3029 21.7527C21.5162 21.3976 21.977 21.2828 22.332 21.4961ZM3.15 5C3.50899 5 3.8 5.29102 3.8 5.65L3.799 7.5H5.65C6.00899 7.5 6.3 7.79101 6.3 8.15C6.3 8.50898 6.00899 8.8 5.65 8.8H3.799L3.8 10.65C3.8 11.009 3.50899 11.3 3.15 11.3C2.79101 11.3 2.5 11.009 2.5 10.65L2.499 8.8H0.65C0.291015 8.8 0 8.50898 0 8.15C0 7.79101 0.291015 7.5 0.65 7.5H2.499L2.5 5.65C2.5 5.29102 2.79101 5 3.15 5ZM23.75 6C24.1642 6 24.5 6.33579 24.5 6.75C24.5 7.16421 24.1642 7.5 23.75 7.5C23.3358 7.5 23 7.16421 23 6.75C23 6.33579 23.3358 6 23.75 6ZM17.65 0C18.009 0 18.3 0.291015 18.3 0.65L18.299 2H19.65C20.009 2 20.3 2.29101 20.3 2.65C20.3 3.00899 20.009 3.3 19.65 3.3L18.299 3.299L18.3 4.65C18.3 5.00899 18.009 5.3 17.65 5.3C17.291 5.3 17 5.00899 17 4.65L16.999 3.299L15.65 3.3C15.291 3.3 15 3.00899 15 2.65C15 2.29101 15.291 2 15.65 2H16.999L17 0.65C17 0.291015 17.291 0 17.65 0ZM9 1C9.55229 1 10 1.44772 10 2C10 2.55228 9.55229 3 9 3C8.44771 3 8 2.55228 8 2C8 1.44772 8.44771 1 9 1Z" fill="black"/>
                        </svg>
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
                                                    {/* Show parts from repair requests */}
                                                    {diagnosticResult.repairRequests?.filter((rr: any) => {
                                                      if (!rr.hasPartAttached || rr.status !== 'DONE') return false
                                                      const rrDate = rr.stateStartDate || rr.requestedDate
                                                      if (!rrDate) return false
                                                      const rrDateObj = new Date(rrDate)
                                                      const vDate = new Date(visitDate)
                                                      return Math.abs(rrDateObj.getTime() - vDate.getTime()) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
                                                    }).slice(0, 2).map((rr: any, rIdx: number) => (
                                                      <p key={`rr-${rIdx}`} className="text-black text-xs break-words flex items-start gap-1">
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5">
                                                          <path d="M9.10835 1.28513C9.49052 1.49532 9.80505 1.80985 10.0152 2.19201L14.724 10.7533C15.3361 11.8664 14.9301 13.2649 13.8171 13.877C13.4775 14.0638 13.0962 14.1618 12.7087 14.1618H3.29121C2.02096 14.1618 0.991211 13.132 0.991211 11.8618C0.991211 11.4742 1.08914 11.0929 1.27591 10.7533L5.98464 2.19201C6.5968 1.079 7.99534 0.672972 9.10835 1.28513ZM7.12372 2.81851L2.41499 11.3798C2.33379 11.5275 2.29121 11.6933 2.29121 11.8618C2.29121 12.414 2.73893 12.8618 3.29121 12.8618H12.7087C12.8772 12.8618 13.0429 12.8192 13.1906 12.738C13.6745 12.4718 13.851 11.8638 13.5849 11.3798L8.87616 2.81851C8.78477 2.65235 8.64802 2.5156 8.48186 2.42421C7.99794 2.15806 7.38988 2.33459 7.12372 2.81851ZM7.99994 9.92539C8.44177 9.92539 8.79994 10.2836 8.79994 10.7254C8.79994 11.1672 8.44177 11.5254 7.99994 11.5254C7.55811 11.5254 7.19994 11.1672 7.19994 10.7254C7.19994 10.2836 7.55811 9.92539 7.99994 9.92539ZM7.99994 4.72539C8.32629 4.72539 8.59647 4.9659 8.64289 5.27934L8.64994 5.37539V8.30832C8.64994 8.6673 8.35892 8.95832 7.99994 8.95832C7.67359 8.95832 7.40341 8.71781 7.35699 8.40437L7.34994 8.30832V5.37539C7.34994 5.0164 7.64095 4.72539 7.99994 4.72539Z" fill="#DC2626"/>
                                                        </svg>
                                                        <span>🔧 Part replaced: {rr.partName || 'Part'} {rr.partFamily ? `(${rr.partFamily})` : ''}</span>
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
                                        {/* Show parts from repair requests */}
                                        {diagnosticResult.repairRequests?.filter((rr: any) => {
                                          if (!rr.hasPartAttached || rr.status !== 'DONE') return false
                                          const rrDate = rr.stateStartDate || rr.requestedDate
                                          if (!rrDate) return false
                                          const rrDateObj = new Date(rrDate)
                                          const visitDate = event.date
                                          return Math.abs(rrDateObj.getTime() - visitDate.getTime()) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
                                        }).slice(0, 2).map((rr: any, rIdx: number) => (
                                          <p key={`rr-${rIdx}`} className="text-black text-xs break-words flex items-start gap-1">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5">
                                              <path d="M9.10835 1.28513C9.49052 1.49532 9.80505 1.80985 10.0152 2.19201L14.724 10.7533C15.3361 11.8664 14.9301 13.2649 13.8171 13.877C13.4775 14.0638 13.0962 14.1618 12.7087 14.1618H3.29121C2.02096 14.1618 0.991211 13.132 0.991211 11.8618C0.991211 11.4742 1.08914 11.0929 1.27591 10.7533L5.98464 2.19201C6.5968 1.079 7.99534 0.672972 9.10835 1.28513ZM7.12372 2.81851L2.41499 11.3798C2.33379 11.5275 2.29121 11.6933 2.29121 11.8618C2.29121 12.414 2.73893 12.8618 3.29121 12.8618H12.7087C12.8772 12.8618 13.0429 12.8192 13.1906 12.738C13.6745 12.4718 13.851 11.8638 13.5849 11.3798L8.87616 2.81851C8.78477 2.65235 8.64802 2.5156 8.48186 2.42421C7.99794 2.15806 7.38988 2.33459 7.12372 2.81851ZM7.99994 9.92539C8.44177 9.92539 8.79994 10.2836 8.79994 10.7254C8.79994 11.1672 8.44177 11.5254 7.99994 11.5254C7.55811 11.5254 7.19994 11.1672 7.19994 10.7254C7.19994 10.2836 7.55811 9.92539 7.99994 9.92539ZM7.99994 4.72539C8.32629 4.72539 8.59647 4.9659 8.64289 5.27934L8.64994 5.37539V8.30832C8.64994 8.6673 8.35892 8.95832 7.99994 8.95832C7.67359 8.95832 7.40341 8.71781 7.35699 8.40437L7.34994 8.30832V5.37539C7.34994 5.0164 7.64095 4.72539 7.99994 4.72539Z" fill="#DC2626"/>
                                            </svg>
                                            <span>🔧 Part replaced: {rr.partName || 'Part'} {rr.partFamily ? `(${rr.partFamily})` : ''}</span>
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
                {/* Summary */}
                {diagnosticResult.analysis?.executiveSummary && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Summary</h3>
                    <p className="text-gray-700 leading-relaxed">
                      {diagnosticResult.analysis.executiveSummary.replace(/at Unit /gi, '').replace(/at /gi, '')}
                    </p>
                  </div>
                )}
                
                {/* Repeated Patterns */}
                {diagnosticResult.analysis?.repeatedPatterns && diagnosticResult.analysis.repeatedPatterns.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Repeated Patterns</h3>
                    <div className="space-y-3">
                      {diagnosticResult.analysis.repeatedPatterns.map((pattern: any, idx: number) => (
                        <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="font-semibold text-gray-900 mb-2">
                            {pattern.pattern} ({pattern.frequency} occurrences)
                          </p>
                          {pattern.summary && (
                            <p className="text-sm text-gray-700 mb-2 leading-relaxed">{pattern.summary}</p>
                          )}
                          {pattern.rootCause && (
                            <p className="text-sm text-gray-700 mb-1"><strong>Root Cause:</strong> {pattern.rootCause}</p>
                          )}
                          {pattern.impact && (
                            <p className="text-sm text-gray-700 mb-1"><strong>Impact:</strong> {pattern.impact}</p>
                          )}
                          {pattern.escalationPath && (
                            <p className="text-sm text-gray-700 mb-1"><strong>Escalation:</strong> {pattern.escalationPath}</p>
                          )}
                          {pattern.correlation && (
                            <p className="text-sm text-gray-700 mb-1"><strong>Correlation:</strong> {pattern.correlation}</p>
                          )}
                          {pattern.examples && pattern.examples.length > 0 && (
                            <ul className="list-disc list-inside text-sm text-gray-700 mt-2 ml-4">
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
                
                {/* Hypotheses */}
                {diagnosticResult.analysis?.hypotheses && diagnosticResult.analysis.hypotheses.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Likely Causes</h3>
                    <div className="space-y-3">
                      {diagnosticResult.analysis.hypotheses.map((hypothesis: any, idx: number) => (
                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="font-medium text-gray-900 mb-1">
                            {hypothesis.category} ({hypothesis.likelihood} likelihood)
                          </p>
                          <p className="text-sm text-gray-700">{hypothesis.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Suggested Checks */}
                {diagnosticResult.analysis?.suggestedChecks && diagnosticResult.analysis.suggestedChecks.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Suggested Next Checks</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {diagnosticResult.analysis.suggestedChecks.map((check: string, idx: number) => (
                        <li key={idx}>{check}</li>
                      ))}
                    </ul>
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
