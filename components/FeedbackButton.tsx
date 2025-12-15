'use client'

import { useState, useEffect } from 'react'
import { FeedbackModal } from './FeedbackModal'
import { Language } from '@/lib/translations'

interface FeedbackButtonProps {
  diagnosticId: string
  section: string
  sectionLabel: string
  existingFeedback?: {
    id: string
    sentiment: 'positive' | 'negative'
    category?: string
    comment?: string
  } | null
  onFeedbackSubmitted?: () => void
  language?: Language
}

export function FeedbackButton({
  diagnosticId,
  section,
  sectionLabel,
  existingFeedback,
  onFeedbackSubmitted,
  language = 'en'
}: FeedbackButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSentiment, setSelectedSentiment] = useState<'positive' | 'negative' | null>(null)
  const [currentFeedback, setCurrentFeedback] = useState(existingFeedback)

  // Update currentFeedback when existingFeedback prop changes (when diagnostic changes)
  useEffect(() => {
    console.log('[FeedbackButton] Existing feedback changed for section:', section, existingFeedback)
    setCurrentFeedback(existingFeedback)
  }, [existingFeedback, section])

  const handleThumbClick = (sentiment: 'positive' | 'negative') => {
    setSelectedSentiment(sentiment)
    setIsModalOpen(true)
  }

  const handleFeedbackSubmitted = (feedback: any) => {
    setCurrentFeedback({
      id: feedback.id,
      sentiment: feedback.sentiment,
      category: feedback.category,
      comment: feedback.comment
    })
    setIsModalOpen(false)
    if (onFeedbackSubmitted) {
      onFeedbackSubmitted()
    }
  }

  const hasPositiveFeedback = currentFeedback?.sentiment === 'positive'
  const hasNegativeFeedback = currentFeedback?.sentiment === 'negative'

  return (
    <>
      <div className="flex items-center gap-0.5">
        {/* Thumbs Up */}
        <button
          onClick={() => handleThumbClick('positive')}
          className={`p-1.5 rounded transition-colors ${
            hasPositiveFeedback
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
          }`}
          title="This section is helpful"
          aria-label="Thumbs up"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={hasPositiveFeedback ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
        </button>

        {/* Thumbs Down */}
        <button
          onClick={() => handleThumbClick('negative')}
          className={`p-1.5 rounded transition-colors ${
            hasNegativeFeedback
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
          }`}
          title="This section needs improvement"
          aria-label="Thumbs down"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={hasNegativeFeedback ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
          </svg>
        </button>
      </div>

      {isModalOpen && selectedSentiment && (
        <FeedbackModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          diagnosticId={diagnosticId}
          section={section}
          sectionLabel={sectionLabel}
          initialSentiment={selectedSentiment}
          existingFeedback={currentFeedback}
          onFeedbackSubmitted={handleFeedbackSubmitted}
          language={language}
        />
      )}
    </>
  )
}

