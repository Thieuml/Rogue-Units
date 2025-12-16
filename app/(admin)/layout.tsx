'use client'

import { Sidebar } from '@/components/Sidebar'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Language } from '@/lib/translations'
import { useSession } from 'next-auth/react'

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [country, setCountryState] = useState<string>('FR')
  const [language, setLanguageState] = useState<Language>('en')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const countryDropdownRef = useRef<HTMLDivElement>(null)

  // Load from localStorage once after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
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

  const setCountry = useCallback((newCountry: string) => {
    setCountryState(newCountry)
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagnostic-country', newCountry)
    }
  }, [])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagnostic-language', newLanguage)
    }
  }

  // Check authentication (but don't redirect on loading)
  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated' || !session?.user?.email) {
      window.location.href = '/api/auth/signin'
      return
    }
  }, [session, status])

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden" suppressHydrationWarning>
      {/* Sidebar persists across admin page navigations */}
      <Sidebar
        country={country}
        onCountryChange={setCountry}
        language={language}
        onLanguageChange={setLanguage}
        countries={COUNTRIES}
        showCountryDropdown={showCountryDropdown}
        setShowCountryDropdown={setShowCountryDropdown}
        countryDropdownRef={countryDropdownRef}
      />
      
      {/* Page content changes but sidebar stays mounted */}
      {status === 'loading' ? (
        <main className="flex-1 overflow-y-auto flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </main>
      ) : (
        children
      )}
    </div>
  )
}

