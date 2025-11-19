'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch')
  }
  return res.json()
}

interface Building {
  id: string
  name: string
  [key: string]: any
}

interface Unit {
  id: string
  name: string
  [key: string]: any
}

interface RecentSelection {
  buildingId: string
  buildingName: string
  unitId: string
  unitName: string
  timestamp: number
}

export default function Home() {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('')
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [context, setContext] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [preview, setPreview] = useState<string>('')
  const [recentSelections, setRecentSelections] = useState<RecentSelection[]>([])
  
  // Fetch buildings
  const { data: buildingsData, isLoading: buildingsLoading } = useSWR<{ buildings: Building[] }>(
    '/api/buildings',
    fetcher
  )
  
  // Fetch units when building is selected
  const { data: unitsData, isLoading: unitsLoading } = useSWR<{ units: Unit[] }>(
    selectedBuildingId ? `/api/units?buildingId=${selectedBuildingId}` : null,
    fetcher
  )
  
  // Load recent selections from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentSelections')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as RecentSelection[]
        setRecentSelections(parsed.slice(0, 5)) // Keep only last 5
      } catch (e) {
        console.error('Error loading recent selections:', e)
      }
    }
  }, [])
  
  // Get selected building and unit names
  const selectedBuilding = buildingsData?.buildings.find(b => b.id === selectedBuildingId)
  const selectedUnit = unitsData?.units.find(u => u.id === selectedUnitId)
  
  // Generate preview when unit is selected
  useEffect(() => {
    if (selectedUnitId && selectedUnit) {
      fetch('/api/diagnostic/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: selectedUnitId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.preview) {
            setPreview(data.preview)
          }
        })
        .catch(err => {
          console.error('Error generating preview:', err)
        })
    } else {
      setPreview('')
    }
  }, [selectedUnitId, selectedUnit])
  
  const handleRecentSelection = (recent: RecentSelection) => {
    setSelectedBuildingId(recent.buildingId)
    setSelectedUnitId(recent.unitId)
    setContext('')
  }
  
  const handleGenerate = async () => {
    if (!selectedBuildingId || !selectedUnitId || !selectedBuilding || !selectedUnit) {
      alert('Please select a building and unit')
      return
    }
    
    setIsGenerating(true)
    
    try {
      const response = await fetch('/api/diagnostic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: selectedUnitId,
          unitName: selectedUnit.name,
          buildingId: selectedBuildingId,
          buildingName: selectedBuilding.name,
          context: context.trim() || undefined,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate diagnostic')
      }
      
      // Download PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `diagnostic_${selectedUnit.name}_${selectedUnitId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      // Save to recent selections
      const newRecent: RecentSelection = {
        buildingId: selectedBuildingId,
        buildingName: selectedBuilding.name,
        unitId: selectedUnitId,
        unitName: selectedUnit.name,
        timestamp: Date.now(),
      }
      
      const updated = [
        newRecent,
        ...recentSelections.filter(
          r => !(r.buildingId === newRecent.buildingId && r.unitId === newRecent.unitId)
        ),
      ].slice(0, 5)
      
      setRecentSelections(updated)
      localStorage.setItem('recentSelections', JSON.stringify(updated))
      
      // Reset form
      setContext('')
      alert('Diagnostic PDF generated successfully!')
    } catch (error) {
      console.error('Error generating diagnostic:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to generate diagnostic'}`)
    } finally {
      setIsGenerating(false)
    }
  }
  
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Lift Diagnostic Summary</h1>
      
      {/* Recent Selections */}
      {recentSelections.length > 0 && (
        <div className="mb-6 p-4 bg-gray-100 rounded-lg">
          <h2 className="text-sm font-semibold mb-2 text-gray-600">Recent Selections</h2>
          <div className="flex flex-wrap gap-2">
            {recentSelections.map((recent, idx) => (
              <button
                key={idx}
                onClick={() => handleRecentSelection(recent)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                {recent.buildingName} - {recent.unitName}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Building Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Building</label>
        <select
          value={selectedBuildingId}
          onChange={(e) => {
            setSelectedBuildingId(e.target.value)
            setSelectedUnitId('') // Reset unit when building changes
          }}
          className="w-full p-2 border border-gray-300 rounded"
          disabled={buildingsLoading}
        >
          <option value="">Select a building...</option>
          {buildingsData?.buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name || building.id}
            </option>
          ))}
        </select>
      </div>
      
      {/* Unit Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Unit</label>
        <select
          value={selectedUnitId}
          onChange={(e) => setSelectedUnitId(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          disabled={!selectedBuildingId || unitsLoading}
        >
          <option value="">Select a unit...</option>
          {unitsData?.units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name || unit.id}
            </option>
          ))}
        </select>
      </div>
      
      {/* Context Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Additional Context (Optional)
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g., 'door issues', 'noisy ascent', etc."
          className="w-full p-2 border border-gray-300 rounded"
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          Add brief context to help tailor the analysis
        </p>
      </div>
      
      {/* Preview */}
      {preview && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">{preview}</p>
        </div>
      )}
      
      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!selectedBuildingId || !selectedUnitId || isGenerating}
        className="w-full py-3 px-4 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isGenerating ? 'Generating PDF...' : 'Generate Diagnostic PDF'}
      </button>
      
      {isGenerating && (
        <p className="mt-4 text-center text-gray-600">
          This may take up to 20 seconds...
        </p>
      )}
    </main>
  )
}

