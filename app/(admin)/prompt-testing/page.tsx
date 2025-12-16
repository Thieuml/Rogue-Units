'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Building {
  id: string
  name: string
  country: string
}

interface Device {
  id: string
  name: string
  buildingId: string
}

export default function PromptTesting() {
  const { data: session } = useSession()
  const [country, setCountry] = useState<string>('FR')
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [buildingSearch, setBuildingSearch] = useState<string>('')
  const [deviceSearch, setDeviceSearch] = useState<string>('')
  const [context, setContext] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [promptAResult, setPromptAResult] = useState<any>(null)
  const [promptBResult, setPromptBResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showBuildingDropdown, setShowBuildingDropdown] = useState(false)
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false)
  
  const buildingInputRef = useRef<HTMLInputElement>(null)
  const deviceInputRef = useRef<HTMLInputElement>(null)
  const buildingDropdownRef = useRef<HTMLDivElement>(null)
  const deviceDropdownRef = useRef<HTMLDivElement>(null)

  // Load saved country from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCountry = localStorage.getItem('diagnostic-country')
      if (savedCountry) {
        setCountry(savedCountry)
      }
    }
  }, [])

  // Update country and reset selections
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry)
    setSelectedBuildingId('')
    setSelectedDeviceId('')
    setBuildingSearch('')
    setDeviceSearch('')
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagnostic-country', newCountry)
    }
  }

  // Fetch buildings and devices (same approach as main page)
  const { data, isLoading: dataLoading } = useSWR<{ buildings: Building[], devices: Device[] }>(
    country ? `/api/buildings?country=${country}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  )

  const allBuildings = data?.buildings || []
  const allDevices = data?.devices || []

  // Filter buildings by search term
  const filteredBuildings = allBuildings.filter((building) =>
    building.name.toLowerCase().includes(buildingSearch.toLowerCase())
  ).slice(0, 50) // Limit to 50 results

  // Filter devices by search term AND selected building
  const filteredDevices = allDevices.filter((device) => {
    // First filter by building if one is selected
    if (selectedBuildingId && device.buildingId !== selectedBuildingId) {
      return false
    }
    // Then filter by search term
    if (deviceSearch.trim()) {
      return device.name.toLowerCase().includes(deviceSearch.toLowerCase())
    }
    return true
  }).slice(0, 50) // Limit to 50 results

  const selectedBuilding = allBuildings.find((b) => b.id === selectedBuildingId)
  const selectedDevice = filteredDevices.find((d) => d.id === selectedDeviceId)

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buildingDropdownRef.current &&
        !buildingDropdownRef.current.contains(event.target as Node) &&
        buildingInputRef.current &&
        !buildingInputRef.current.contains(event.target as Node)
      ) {
        setShowBuildingDropdown(false)
      }
      if (
        deviceDropdownRef.current &&
        !deviceDropdownRef.current.contains(event.target as Node) &&
        deviceInputRef.current &&
        !deviceInputRef.current.contains(event.target as Node)
      ) {
        setShowDeviceDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRunComparison = async () => {
    if (!selectedBuildingId || !selectedDeviceId || !selectedBuilding || !selectedDevice) {
      alert('Please select a building and device')
      return
    }

    setIsLoading(true)
    setError(null)
    setPromptAResult(null)
    setPromptBResult(null)

    try {
      // Run Prompt A (V1)
      console.log('[Testing] Running Prompt A (V1) analysis...')
      const promptAResponse = await fetch('/api/diagnostic/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: selectedDeviceId,
          unitName: selectedDevice.name,
          buildingId: selectedBuildingId,
          buildingName: selectedBuilding.name,
          context: context.trim() || undefined,
          country: country,
          _forceVersion: 'v1',
        }),
      })

      if (!promptAResponse.ok) {
        const promptAError = await promptAResponse.json()
        throw new Error(`Prompt A failed: ${promptAError.error || 'Unknown error'}`)
      }

      const promptAData = await promptAResponse.json()
      setPromptAResult(promptAData)
      console.log('[Testing] Prompt A completed')

      // Run Prompt B (V2)
      console.log('[Testing] Running Prompt B (V2) analysis...')
      const promptBResponse = await fetch('/api/diagnostic/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: selectedDeviceId,
          unitName: selectedDevice.name,
          buildingId: selectedBuildingId,
          buildingName: selectedBuilding.name,
          context: context.trim() || undefined,
          country: country,
          _forceVersion: 'v2',
        }),
      })

      if (!promptBResponse.ok) {
        const promptBError = await promptBResponse.json()
        throw new Error(`Prompt B failed: ${promptBError.error || 'Unknown error'}`)
      }

      const promptBData = await promptBResponse.json()
      setPromptBResult(promptBData)
      console.log('[Testing] Prompt B completed')
    } catch (err) {
      console.error('[Testing] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to run comparison')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Prompt Testing</h1>
          <p className="text-gray-600 mb-8">
            Compare Prompt A and Prompt B diagnostic analysis side by side
          </p>

          {/* Input Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Select Unit</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Building Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Building
                </label>
                <div className="relative">
                  <input
                    ref={buildingInputRef}
                    type="text"
                    value={selectedBuilding?.name || buildingSearch}
                    onChange={(e) => {
                      setBuildingSearch(e.target.value)
                      setShowBuildingDropdown(true)
                      setSelectedBuildingId('')
                      setSelectedDeviceId('')
                    }}
                    onFocus={() => setShowBuildingDropdown(true)}
                    placeholder="Search building..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium placeholder-gray-400"
                    disabled={dataLoading}
                  />
                  {showBuildingDropdown && filteredBuildings.length > 0 && (
                    <div
                      ref={buildingDropdownRef}
                      className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                    >
                      {filteredBuildings.map((building) => (
                        <div
                          key={building.id}
                          onClick={() => {
                            setSelectedBuildingId(building.id)
                            setBuildingSearch('')
                            setShowBuildingDropdown(false)
                            setSelectedDeviceId('')
                            setDeviceSearch('')
                          }}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-900 font-medium"
                        >
                          {building.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {dataLoading && (
                  <p className="text-xs text-gray-500 mt-1">Loading buildings...</p>
                )}
              </div>

              {/* Device Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Device
                </label>
                <div className="relative">
                  <input
                    ref={deviceInputRef}
                    type="text"
                    value={selectedDevice?.name || deviceSearch}
                    onChange={(e) => {
                      setDeviceSearch(e.target.value)
                      setShowDeviceDropdown(true)
                      setSelectedDeviceId('')
                    }}
                    onFocus={() => setShowDeviceDropdown(true)}
                    placeholder="Search device..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium placeholder-gray-400"
                    disabled={!selectedBuildingId || dataLoading}
                  />
                  {showDeviceDropdown && filteredDevices.length > 0 && (
                    <div
                      ref={deviceDropdownRef}
                      className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                    >
                      {filteredDevices.map((device) => (
                        <div
                          key={device.id}
                          onClick={() => {
                            setSelectedDeviceId(device.id)
                            setDeviceSearch('')
                            setShowDeviceDropdown(false)
                          }}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-900 font-medium"
                        >
                          {device.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {!selectedBuildingId && (
                  <p className="text-xs text-gray-500 mt-1">Select a building first</p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Context (optional)
              </label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., Last 30 days, Recent issues"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium placeholder-gray-400"
              />
            </div>

            <button
              onClick={handleRunComparison}
              disabled={isLoading || !selectedBuildingId || !selectedDeviceId}
              className="w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Running Both Prompts...' : 'Run Prompt A vs Prompt B Comparison'}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 font-medium">Error:</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-blue-800 font-medium">Running analyses...</p>
              <p className="text-blue-600 text-sm">This may take 30-60 seconds</p>
            </div>
          )}

          {/* Results Display */}
          {!isLoading && (promptAResult || promptBResult) && (
            <div className="grid grid-cols-2 gap-6">
              {/* Prompt A Column */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Prompt A (V1)</h3>
                      <p className="text-xs text-gray-600">Original monolithic analysis</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                      IN PRODUCTION
                    </span>
                  </div>
                </div>
                <div className="p-4 h-[800px] overflow-y-auto">
                  {promptAResult ? (
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                      {JSON.stringify(promptAResult.analysis, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-gray-500 italic">No Prompt A result yet</p>
                  )}
                </div>
              </div>

              {/* Prompt B Column */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Prompt B (V2)</h3>
                  <p className="text-xs text-gray-600">Structured evidence-based analysis</p>
                </div>
                <div className="p-4 h-[800px] overflow-y-auto">
                  {promptBResult ? (
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                      {JSON.stringify(promptBResult.rawAnalysis || promptBResult.analysis, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-gray-500 italic">No Prompt B result yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          {!isLoading && !promptAResult && !promptBResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">How to use this tool:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Select a country from the sidebar (affects available buildings)</li>
                <li>Search and select a building</li>
                <li>Search and select a device</li>
                <li>Optionally add context (e.g., "Last 30 days")</li>
                <li>Click "Run Prompt A vs Prompt B Comparison"</li>
                <li>Wait for both analyses to complete (30-60 seconds total)</li>
                <li>Scroll through both columns to compare outputs</li>
              </ol>
              <div className="mt-4 pt-4 border-t border-blue-300">
                <p className="text-sm text-blue-800 font-medium mb-1">What to check:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
                  <li>Parts count and linking accuracy</li>
                  <li>Pattern detection (Prompt B should have similar or better)</li>
                  <li>Causality analysis depth</li>
                  <li>Evidence integrity in Prompt B (all eventIds valid)</li>
                  <li>Customer summary quality (plain language vs technical)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
  )
}
