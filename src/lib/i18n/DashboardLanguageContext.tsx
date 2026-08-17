import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSession } from '../../hooks/useSession';
import { t as translate } from './navTranslations';

interface DashboardLanguageContextValue {
  language: string;
  setLanguage: (code: string) => void;
  t: (text: string) => string;
  isRtl: boolean;
}

const DashboardLanguageContext = createContext<DashboardLanguageContextValue | null>(null);

// Real fix for "changing language needs a refresh": useSession()'s own
// user object is cached for up to 20 seconds and only re-fetched on a
// fresh mount, so a component that was already on screen when the
// language changed had no way to find out - mutating that cache
// directly wouldn't have re-rendered anything either, since React only
// re-renders on state or context changes, not on an external module
// variable being mutated. A real Context, provided once here and read
// by every translated page through useT(), fixes both problems at
// once: setLanguage() below is real React state, so calling it
// re-renders every single consumer immediately, everywhere, with no
// reload involved.
export function DashboardLanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [language, setLanguageState] = useState('en');

  // Syncs from the account's saved preference once it loads (or when a
  // different account's session takes over via Account Switcher) - the
  // starting point, not the only way this value can change.
  useEffect(() => {
    if (user?.preferred_language) setLanguageState(user.preferred_language);
  }, [user?.preferred_language]);

  const isRtl = language === 'ar' || language === 'ur';

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRtl, language]);

  function setLanguage(code: string) {
    // Optimistic and immediate - the whole dashboard switches the
    // instant someone picks a language, before the save to the account
    // even finishes. If that save fails, ChangePasswordPage surfaces
    // its own error separately; the visual switch itself never blocks
    // on the network.
    setLanguageState(code);
  }

  return (
    <DashboardLanguageContext.Provider value={{ language, setLanguage, t: (text: string) => translate(text, language), isRtl }}>
      {children}
    </DashboardLanguageContext.Provider>
  );
}

export function useDashboardLanguage() {
  const ctx = useContext(DashboardLanguageContext);
  if (!ctx) throw new Error('useDashboardLanguage must be used within DashboardLanguageProvider');
  return ctx;
}
