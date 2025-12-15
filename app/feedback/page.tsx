'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { WeMaintainLogo } from '@/components/WeMaintainLogo'
import { UserMenu } from '@/components/UserMenu'
import { Language, useTranslation } from '@/lib/translations'
import LanguageToggle from '@/components/LanguageToggle'

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
]

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
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  
  // Country state (for consistency with other admin pages)
  const [country, setCountryState] = useState<string>('FR')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const countryDropdownRef = useRef<HTMLDivElement>(null)
  
  // Optimistic admin check
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  
  // Language state
  const [language, setLanguageState] = useState<Language>('en')
  const { t } = useTranslation(language)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Country setter with persistence
  const setCountry = useCallback((newCountry: string) => {
    setCountryState(newCountry)
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagnostic-country', newCountry)
    }
  }, [])

  // Initialize from localStorage FIRST for instant render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('isAdmin')
      if (stored === 'true') {
        setIsAdmin(true)
      }
      const savedLanguage = localStorage.getItem('diagnostic-language') as Language
      if (savedLanguage === 'en' || savedLanguage === 'fr') {
        setLanguageState(savedLanguage)
      }
      const savedCountry = localStorage.getItem('diagnostic-country')
      if (savedCountry) {
        setCountryState(savedCountry)
      }
    }
  }, [])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagnostic-language', newLanguage)
    }
  }

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return
      
      if (status === 'unauthenticated' || !session?.user?.email) {
        window.location.href = '/api/auth/signin'
        return
      }

      // Store admin status
      if (typeof window !== 'undefined') {
        localStorage.setItem('isAdmin', 'true')
      }
      setIsAdmin(true)
    }

    checkAuth()
  }, [session, status])

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

  if (status === 'loading' || isAdmin === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col h-screen flex-shrink-0 relative z-10">
        <div className="px-6 py-4 border-b border-slate-700">
          <WeMaintainLogo />
          <div className="mt-2 flex justify-end">
            <div className="text-[10px]">
              <LanguageToggle language={language} onLanguageChange={setLanguage} />
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto relative z-10">
          <div className="space-y-2">
            {/* Country Selection - Above Navigation */}
            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {t('nav.country')}
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
            
            <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mt-9">
              {t('nav.navigation')}
            </div>
            <a
              href="/"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium hover:bg-slate-700 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path fillRule="evenodd" clipRule="evenodd" d="M15.7692 1.85001L19.65 5.73077V20C19.65 21.1358 18.7693 22.0659 17.6535 22.1446L17.5 22.15H6.49998C5.36419 22.15 4.4341 21.2693 4.35537 20.1535L4.34998 20V4.00001C4.34998 2.86422 5.23068 1.93413 6.34643 1.8554L6.49998 1.85001H15.7692ZM14.549 3.15001H6.49998C6.06664 3.15001 5.70905 3.47427 5.6566 3.89338L5.64998 4.00001V20C5.64998 20.4333 5.97424 20.7909 6.39335 20.8434L6.49998 20.85H17.5C17.9333 20.85 18.2909 20.5257 18.3434 20.1066L18.35 20L18.349 7.15001H16.2C15.3367 7.15001 14.6282 6.48699 14.556 5.64237L14.55 5.50001L14.549 3.15001ZM15.849 3.76901L15.85 5.50001C15.85 5.66914 15.9699 5.81026 16.1294 5.8429L16.2 5.85001H17.93L15.849 3.76901Z" fill="currentColor"/>
                <path d="M10.2 10H14.64C14.8388 10 15 10.1612 15 10.36V14.8M13.8 11.2L9 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span>{t('nav.newDiagnostic')}</span>
            </a>
            <a
              href="/?view=recent"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium hover:bg-slate-700 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path fillRule="evenodd" clipRule="evenodd" d="M15 2.20001C15.6351 2.20001 16.15 2.71488 16.15 3.35001L16.149 4.00001H18C18.8633 4.00001 19.5718 4.66303 19.6439 5.50764L19.65 5.65001V20.65C19.65 21.5133 18.987 22.2218 18.1424 22.294L18 22.3H6.00001C5.1367 22.3 4.42825 21.637 4.35606 20.7924L4.35001 20.65V5.65001C4.35001 4.7867 5.01302 4.07825 5.85764 4.00607L6.00001 4.00001H7.85001V3.35001C7.85001 2.75723 8.29852 2.2692 8.8747 2.20676L9.00001 2.20001H15ZM16.15 5.85001C16.15 6.48514 15.6351 7.00001 15 7.00001H9.00001C8.36488 7.00001 7.85001 6.48514 7.85001 5.85001V5.30001H6.00001C5.83087 5.30001 5.68975 5.41999 5.65712 5.57948L5.65001 5.65001V20.65C5.65001 20.8191 5.76998 20.9603 5.92947 20.9929L6.00001 21H18C18.1691 21 18.3103 20.88 18.3429 20.7205L18.35 20.65V5.65001C18.35 5.48088 18.23 5.33976 18.0705 5.30712L18 5.30001H16.149L16.15 5.85001ZM8.25001 16.3C8.66422 16.3 9.00001 16.6358 9.00001 17.05C9.00001 17.4642 8.66422 17.8 8.25001 17.8C7.83579 17.8 7.50001 17.4642 7.50001 17.05C7.50001 16.6358 7.83579 16.3 8.25001 16.3ZM16 16.4C16.359 16.4 16.65 16.691 16.65 17.05C16.65 17.3764 16.4095 17.6465 16.0961 17.693L16 17.7H11C10.641 17.7 10.35 17.409 10.35 17.05C10.35 16.7237 10.5905 16.4535 10.904 16.4071L11 16.4H16ZM8.25001 12.825C8.66422 12.825 9.00001 13.1608 9.00001 13.575C9.00001 13.9892 8.66422 14.325 8.25001 14.325C7.83579 14.325 7.50001 13.9892 7.50001 13.575C7.50001 13.1608 7.83579 12.825 8.25001 12.825ZM16 12.925C16.359 12.925 16.65 13.216 16.65 13.575C16.65 13.9014 16.4095 14.1715 16.0961 14.218L16 14.225H11C10.641 14.225 10.35 13.934 10.35 13.575C10.35 13.2487 10.5905 12.9785 10.904 12.9321L11 12.925H16ZM8.25001 9.35001C8.66422 9.35001 9.00001 9.6858 9.00001 10.1C9.00001 10.5142 8.66422 10.85 8.25001 10.85C7.83579 10.85 7.50001 10.5142 7.50001 10.1C7.50001 9.6858 7.83579 9.35001 8.25001 9.35001ZM16 9.45001C16.359 9.45001 16.65 9.74103 16.65 10.1C16.65 10.4264 16.4095 10.6965 16.0961 10.743L16 10.75H11C10.641 10.75 10.35 10.459 10.35 10.1C10.35 9.77366 10.5905 9.50349 10.904 9.45706L11 9.45001H16ZM14.85 3.50001H9.15001V5.70001H14.85V3.50001Z" fill="currentColor"/>
              </svg>
              <span>{t('nav.recentDiagnostics')}</span>
            </a>
          </div>
          
          {/* Admin Tools Section */}
          {isAdmin && (
            <div className="pb-4 mt-6">
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {t('nav.adminTools')}
              </div>
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
                  <span>{t('nav.promptTesting')}</span>
                </a>
                <a
                  href="/usage-analytics"
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors ${
                    pathname === '/usage-analytics' ? 'bg-slate-700' : 'hover:bg-slate-700'
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{t('nav.usageAnalytics')}</span>
                </a>
                <a
                  href="/feedback"
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors ${
                    pathname === '/feedback' ? 'bg-slate-700' : 'hover:bg-slate-700'
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M21 11.5C21 16.7 16.97 21 12 21C10.66 21 9.39 20.71 8.25 20.19L3 21.5L4.82 16.83C3.67 15.5 3 13.79 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 11.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Feedback</span>
                </a>
                </div>
              </div>
            )}
        </nav>
        <div className="mt-auto">
          <UserMenu />
        </div>
      </aside>

      {/* Main Content */}
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
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Unit, building, or diagnostic ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Sentiment Filter */}
              <div>
                <label htmlFor="sentiment" className="block text-sm font-medium text-gray-700 mb-1">
                  Sentiment
                </label>
                <select
                  id="sentiment"
                  value={sentimentFilter}
                  onChange={(e) => setSentimentFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All</option>
                  <option value="positive">Positive</option>
                  <option value="negative">Negative</option>
                </select>
              </div>

              {/* Section Filter */}
              <div>
                <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-1">
                  Section
                </label>
                <select
                  id="section"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Sections</option>
                  {uniqueSections.map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12 text-gray-600">
              Loading feedback...
            </div>
          )}

          {/* Empty State */}
          {!loading && feedback.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-gray-600 text-lg">No feedback yet</p>
              <p className="text-gray-500 text-sm mt-2">Feedback will appear here once users start providing it</p>
            </div>
          )}

          {/* Feedback List */}
          {!loading && filteredDiagnostics.length === 0 && feedback.length > 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
              No feedback matches your filters
            </div>
          )}

          {!loading && filteredDiagnostics.length > 0 && (
            <div className="space-y-6">
              {filteredDiagnostics.map(([diagnosticId, data]) => (
                <div key={diagnosticId} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Diagnostic Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {data.diagnostic.unitName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {data.diagnostic.buildingName} • {data.diagnostic.country}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Generated {formatDate(data.diagnostic.generatedAt)}
                          {data.diagnostic.userName && ` by ${data.diagnostic.userName}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                          {data.items.length} feedback
                        </span>
                        <a
                          href={`/?diagnosticId=${diagnosticId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                        >
                          View Diagnostic
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Items */}
                  <div className="divide-y divide-gray-200">
                    {data.items.map((item) => (
                      <div key={item.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            {/* Section & Sentiment */}
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                                {item.sectionLabel}
                              </span>
                              <span className={`px-2.5 py-0.5 text-xs font-medium rounded ${
                                item.sentiment === 'positive'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {item.sentiment === 'positive' ? '👍 Positive' : '👎 Negative'}
                              </span>
                              {item.category && (
                                <span className="text-xs text-gray-600">
                                  • {getCategoryLabel(item.category)}
                                </span>
                              )}
                            </div>

                            {/* Comment */}
                            {item.comment && (
                              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                                {item.comment}
                              </p>
                            )}

                            {/* Meta */}
                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                              <span>{item.userName}</span>
                              <span>•</span>
                              <span>{formatDate(item.createdAt)}</span>
                            </div>
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteFeedback(item.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Delete feedback"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

