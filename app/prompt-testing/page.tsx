'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { WeMaintainLogo } from '@/components/WeMaintainLogo'
import { UserMenu } from '@/components/UserMenu'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'BE', name: 'Belgium' },
]

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
  const pathname = usePathname()
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
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [showBuildingDropdown, setShowBuildingDropdown] = useState(false)
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false)
  
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

  const countryDropdownRef = useRef<HTMLDivElement>(null)
  const buildingInputRef = useRef<HTMLInputElement>(null)
  const deviceInputRef = useRef<HTMLInputElement>(null)
  const buildingDropdownRef = useRef<HTMLDivElement>(null)
  const deviceDropdownRef = useRef<HTMLDivElement>(null)

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
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCountryDropdown(false)
      }
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
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Same as main page */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <WeMaintainLogo />
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {/* Country Selection */}
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
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setCountry(c.code)
                          setSelectedBuildingId('')
                          setSelectedDeviceId('')
                          setBuildingSearch('')
                          setDeviceSearch('')
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
              href="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors ${
                pathname === '/' ? 'bg-slate-700' : 'hover:bg-slate-700'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path fillRule="evenodd" clipRule="evenodd" d="M15.7692 1.85001L19.65 5.73077V20C19.65 21.1358 18.7693 22.0659 17.6535 22.1446L17.5 22.15H6.49998C5.36419 22.15 4.4341 21.2693 4.35537 20.1535L4.34998 20V4.00001C4.34998 2.86422 5.23068 1.93413 6.34643 1.8554L6.49998 1.85001H15.7692ZM14.549 3.15001H6.49998C6.06664 3.15001 5.70905 3.47427 5.6566 3.89338L5.64998 4.00001V20C5.64998 20.4333 5.97424 20.7909 6.39335 20.8434L6.49998 20.85H17.5C17.9333 20.85 18.2909 20.5257 18.3434 20.1066L18.35 20L18.349 7.15001H16.2C15.3367 7.15001 14.6282 6.48699 14.556 5.64237L14.55 5.50001L14.549 3.15001ZM15.849 3.76901L15.85 5.50001C15.85 5.66914 15.9699 5.81026 16.1294 5.8429L16.2 5.85001H17.93L15.849 3.76901Z" fill="currentColor"/>
                <path d="M10.2 10H14.64C14.8388 10 15 10.1612 15 10.36V14.8M13.8 11.2L9 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span>Launch New Diagnostic</span>
            </a>
            <a
              href="/?view=recent"
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors hover:bg-slate-700`}
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
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors ${
                    pathname === '/prompt-testing' ? 'bg-slate-700' : 'hover:bg-slate-700'
                  }`}
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
        <UserMenu />
      </aside>

      {/* Main Content */}
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
    </div>
  )
}
