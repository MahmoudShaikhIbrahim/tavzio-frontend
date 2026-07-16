import { useState } from 'react';
import { LANGUAGES } from '../lib/i18n/types';
import { useLanguage } from '../lib/i18n/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-xs text-ivory-dim hover:text-ivory"
      >
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <span className="text-[10px]">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-20 mt-1.5 w-40 overflow-hidden rounded-lg border border-ink-line bg-ink-soft shadow-xl">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLanguage(l.code); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink ${
                  l.code === language ? 'text-brass' : 'text-ivory'
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
