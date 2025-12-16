'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface FeedbackItem {
  id: string
  diagnosticId: string
  section: string
  sectionLabel: string
  sentiment: 'positive' | 'negative'
  category?: string
  comment?: string
  userId: string
  userName: string
  createdAt: string
  diagnostic: {
    id: string
    unitName: string
    buildingName: string
    generatedAt: string
    userId?: string
    userName?: string
    country: string
  }
}

export default function FeedbackPage() {
  const { data: session } = useSession()
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [sectionFilter, setSectionFilter] = useState('all')

  // Load feedback
  useEffect(() => {
    if (!session?.user?.email) return

    const loadFeedback = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/feedback')
        if (!response.ok) {
          throw new Error('Failed to load feedback')
        }
        const data = await response.json()
        setFeedback(data)
      } catch (err) {
        console.error('Error loading feedback:', err)
        setError(err instanceof Error ? err.message : 'Failed to load feedback')
      } finally {
        setLoading(false)
      }
    }

    loadFeedback()
  }, [session])

  // Delete feedback
  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return

    try {
      const response = await fetch('/api/feedback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete feedback')
      }

      // Remove from local state
      setFeedback(prev => prev.filter(f => f.id !== feedbackId))
    } catch (err) {
      console.error('Error deleting feedback:', err)
      alert('Failed to delete feedback')
    }
  }

  // Group feedback by diagnostic
  const groupedFeedback = feedback.reduce((acc, item) => {
    if (!acc[item.diagnosticId]) {
      acc[item.diagnosticId] = {
        diagnostic: item.diagnostic,
        items: []
      }
    }
    acc[item.diagnosticId].items.push(item)
    return acc
  }, {} as Record<string, { diagnostic: any; items: FeedbackItem[] }>)

  // Filter feedback
  const filteredDiagnostics = Object.entries(groupedFeedback).filter(([_, data]) => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchesSearch = 
        data.diagnostic.unitName.toLowerCase().includes(term) ||
        data.diagnostic.buildingName.toLowerCase().includes(term) ||
        data.diagnostic.id.toLowerCase().includes(term)
      
      if (!matchesSearch) return false
    }

    // Sentiment filter
    if (sentimentFilter !== 'all') {
      const hasSentiment = data.items.some(item => item.sentiment === sentimentFilter)
      if (!hasSentiment) return false
    }

    // Section filter
    if (sectionFilter !== 'all') {
      const hasSection = data.items.some(item => item.section === sectionFilter)
      if (!hasSection) return false
    }

    return true
  })

  // Get unique sections for filter
  const uniqueSections = Array.from(new Set(feedback.map(f => f.section)))

  // Calculate stats
  const totalFeedback = feedback.length
  const positiveFeedback = feedback.filter(f => f.sentiment === 'positive').length
  const negativeFeedback = feedback.filter(f => f.sentiment === 'negative').length
  const thisWeekFeedback = feedback.filter(f => {
    const feedbackDate = new Date(f.createdAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return feedbackDate >= weekAgo
  }).length

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Category labels
  const getCategoryLabel = (category?: string) => {
    const labels: Record<string, string> = {
      'inaccurate': 'Contains inaccuracies',
      'too_confident': 'Too confident / not cautious enough',
      'misses_patterns': 'Misses important patterns',
      'too_long': 'Too long or hard to scan',
      'too_vague': 'Too vague',
      'not_realistic': 'Recommendations not realistic',
      'avoids_handling': 'Avoids addressing handling issues',
      'accurate': 'Accurate and trustworthy',
      'clear_summary': 'Clear summary',
      'right_detail': 'Right level of detail',
      'actionable': 'Actionable next steps',
      'useful_ops': 'Useful for OPS decisions'
    }
    return category ? labels[category] || category : ''
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Feedback Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Feedback</div>
            <div className="text-3xl font-bold text-gray-900">{totalFeedback}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">This Week</div>
            <div className="text-3xl font-bold text-gray-900">{thisWeekFeedback}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Positive</div>
            <div className="text-3xl font-bold text-green-600">{positiveFeedback}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Negative</div>
            <div className="text-3xl font-bold text-red-600">{negativeFeedback}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                id="search"
                placeholder="Unit name, building, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Sentiment Filter */}
            <div>
              <label htmlFor="sentiment" className="block text-sm font-medium text-gray-700 mb-2">
                Sentiment
              </label>
              <select
                id="sentiment"
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="all">All</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
              </select>
            </div>

            {/* Section Filter */}
            <div>
              <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-2">
                Section
              </label>
              <select
                id="section"
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="all">All Sections</option>
                {uniqueSections.map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loading/Error States */}
        {loading && (
          <div className="text-center py-8 text-gray-600">Loading feedback...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
            {error}
          </div>
        )}

        {/* Feedback List */}
        {!loading && filteredDiagnostics.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            No feedback found matching your filters.
          </div>
        )}

        {!loading && filteredDiagnostics.map(([diagnosticId, data]) => (
          <div key={diagnosticId} className="bg-white rounded-lg shadow mb-6 overflow-hidden">
            {/* Diagnostic Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {data.diagnostic.unitName}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {data.diagnostic.buildingName} • {data.diagnostic.country}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Generated: {formatDate(data.diagnostic.generatedAt)}
                    {data.diagnostic.userName && ` • By: ${data.diagnostic.userName}`}
                  </p>
                </div>
                <a
                  href={`/?diagnosticId=${diagnosticId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium whitespace-nowrap ml-4"
                >
                  View Diagnostic →
                </a>
              </div>
            </div>

            {/* Feedback Items */}
            <div className="divide-y divide-gray-200">
              {data.items.map((item) => (
                <div key={item.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Sentiment Badge */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.sentiment === 'positive' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.sentiment === 'positive' ? '👍 Positive' : '👎 Negative'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {item.sectionLabel}
                        </span>
                      </div>

                      {/* Category */}
                      {item.category && (
                        <div className="text-sm text-gray-700 mb-2">
                          <span className="font-medium">Category:</span> {getCategoryLabel(item.category)}
                        </div>
                      )}

                      {/* Comment */}
                      {item.comment && (
                        <div className="text-sm text-gray-700 bg-gray-50 rounded p-3 mb-2">
                          {item.comment}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="text-xs text-gray-500">
                        {item.userName} • {formatDate(item.createdAt)}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteFeedback(item.id)}
                      className="ml-4 text-red-600 hover:text-red-800 text-sm"
                      title="Delete feedback"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

