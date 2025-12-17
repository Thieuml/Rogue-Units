'use client'

import { Language } from '@/lib/translations'

interface LanguageToggleProps {
  language: Language
  onLanguageChange: (language: Language) => void
}

export default function LanguageToggle({ language, onLanguageChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button
        onClick={() => onLanguageChange('en')}
        className={`text-[10px] font-medium transition-colors ${
          language === 'en'
            ? 'text-white bg-blue-600 px-1.5 py-0.5 rounded'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => onLanguageChange('fr')}
        className={`text-[10px] font-medium transition-colors ${
          language === 'fr'
            ? 'text-white bg-blue-600 px-1.5 py-0.5 rounded'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        FR
      </button>
    </div>
  )
}




