import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { LANGUAGES, type LanguageCode } from './types';
import { TRANSLATIONS } from './translations';

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  isRtl: boolean;
  t: (key: keyof typeof TRANSLATIONS.en, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_PREFIX = 'tavzio_lang_';

// Language is remembered per-business (like the loyalty phone number),
// not globally - a customer visiting two different businesses might
// reasonably want a different language for each, and there's no reason
// to force one choice across every business they've ever tapped.
export function LanguageProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + slug);
    return (LANGUAGES.find((l) => l.code === saved)?.code as LanguageCode) || 'en';
  });

  const meta = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    // Real RTL support, not just translated text - the whole page's
    // layout direction actually flips for Arabic/Urdu, letting Tailwind's
    // built-in rtl:/ltr: variants take effect wherever they're used.
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, meta.rtl]);

  function setLanguage(code: LanguageCode) {
    setLanguageState(code);
    localStorage.setItem(STORAGE_PREFIX + slug, code);
  }

  function t(key: keyof typeof TRANSLATIONS.en, vars?: Record<string, string | number>) {
    let str = TRANSLATIONS[language][key] || TRANSLATIONS.en[key];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.split(`{${k}}`).join(String(v));
      }
    }
    return str;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRtl: meta.rtl, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
