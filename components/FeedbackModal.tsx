'use client'

import { useState, useEffect } from 'react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  diagnosticId: string
  section: string
  sectionLabel: string
  initialSentiment: 'positive' | 'negative'
  existingFeedback?: {
    id: string
    sentiment: 'positive' | 'negative'
    category?: string
    comment?: string
  } | null
  onFeedbackSubmitted: (feedback: any) => void
}

const NEGATIVE_CATEGORIES = [
  { value: 'inaccurate', label: 'Contains inaccuracies' },
  { value: 'too_confident', label: 'Too confident / not cautious enough' },
  { value: 'misses_patterns', label: 'Misses important patterns' },
  { value: 'too_long', label: 'Too long or hard to scan' },
  { value: 'too_vague', label: 'Too vague' },
  { value: 'not_realistic', label: 'Recommendations not realistic' },
  { value: 'avoids_handling', label: 'Avoids addressing handling issues' },
]

const POSITIVE_CATEGORIES = [
  { value: 'accurate', label: 'Accurate and trustworthy' },
  { value: 'clear_summary', label: 'Clear summary' },
  { value: 'right_detail', label: 'Right level of detail' },
  { value: 'actionable', label: 'Actionable next steps' },
  { value: 'useful_ops', label: 'Useful for OPS decisions' },
]

export function FeedbackModal({
  isOpen,
  onClose,
  diagnosticId,
  section,
  sectionLabel,
  initialSentiment,
  existingFeedback,
  onFeedbackSubmitted
}: FeedbackModalProps) {
  const [sentiment] = useState(initialSentiment)
  const [category, setCategory] = useState(existingFeedback?.category || '')
  const [comment, setComment] = useState(existingFeedback?.comment || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = sentiment === 'positive' ? POSITIVE_CATEGORIES : NEGATIVE_CATEGORIES

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCategory(existingFeedback?.category || '')
      setComment(existingFeedback?.comment || '')
      setError(null)
    }
  }, [isOpen, existingFeedback])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diagnosticId,
          section,
          sectionLabel,
          sentiment,
          category: category || null,
          comment: comment.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit feedback')
      }

      const feedback = await response.json()
      onFeedbackSubmitted(feedback)
      onClose()
    } catch (err) {
      console.error('Error submitting feedback:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Provide Feedback</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Section Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Section
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-900 border border-gray-200">
              {sectionLabel}
            </div>
          </div>

          {/* Sentiment Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Rating
            </label>
            <div className="flex items-center gap-2">
              {sentiment === 'positive' ? (
                <>
                  <div className="p-2 bg-green-100 text-green-700 rounded">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-green-700">Helpful</span>
                </>
              ) : (
                <>
                  <div className="p-2 bg-red-100 text-red-700 rounded">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-red-700">Needs Improvement</span>
                </>
              )}
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              What best describes your feedback? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
            >
              <option value="" className="text-gray-500">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value} className="text-gray-900">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              Additional details <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Please share any specific details that could help us improve..."
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

