import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findClosestMatch } from '../lib/fuzzyMatch';

interface PaletteItem {
  path: string;
  label: string;
  kind?: 'page' | 'action';
  keywords?: string;
}

// Real "type any page name, or what you're trying to do" search, not
// just a page filter - opens over everything (Cmd/Ctrl+K, the
// universal convention for exactly this), searches every reachable
// page AND every real task at once, and jumps straight there on Enter
// or a click. Only ever receives items already filtered through the
// same tabAllowed()/ownerOnly rules the real nav uses, so this never
// surfaces a page or action the current account can't actually reach.
export default function CommandPalette({ items, actions = [], t, onNavigate }: { items: PaletteItem[]; actions?: PaletteItem[]; t: (s: string) => string; onNavigate?: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Autofocus needs a tick - the input doesn't exist in the DOM yet
      // in the same render pass that flips `open` to true.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const allItems = [...items, ...actions];
  const q = query.trim().toLowerCase();
  const results = q
    ? allItems
        .filter((i) => t(i.label).toLowerCase().includes(q) || i.keywords?.toLowerCase().includes(q))
        .sort((a, b) => {
          const aDirect = t(a.label).toLowerCase().includes(q) ? 0 : 1;
          const bDirect = t(b.label).toLowerCase().includes(q) ? 0 : 1;
          return aDirect - bDirect;
        })
    : allItems;

  // Real "did you mean" - only computed when there's a genuine typo
  // situation (a real query with zero substring matches), and only
  // ever suggests something that's actually close, never a random
  // guess dressed up as a suggestion.
  const suggestion = q && results.length === 0
    ? findClosestMatch(query, allItems, (i) => t(i.label))
    : null;

  function go(item: PaletteItem) {
    onNavigate?.(item.path);
    navigate(`/admin/dashboard/${item.path}`);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) go(results[activeIndex]);
      else if (suggestion) go(suggestion);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-ink-line px-3.5 py-2 text-sm text-ivory-dim transition-colors hover:border-brass/40 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        {t('Search...')}
      </button>

      {open && (
        <div className="fixed inset-0 z-modal flex items-start justify-center bg-ink/80 px-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-ink-line bg-ink-soft shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-ink-line px-4 py-3.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ivory-dim"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder={t('Search pages or type what you want to do...')}
                className="w-full bg-transparent text-base text-ivory placeholder:text-ivory-dim/60 focus:outline-none"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && !suggestion && <p className="px-3 py-6 text-center text-sm text-ivory-dim">{t('Nothing found.')}</p>}
              {results.length === 0 && suggestion && (
                <button
                  type="button"
                  onClick={() => go(suggestion)}
                  className="block w-full rounded-xl px-3 py-3 text-start text-base text-ivory hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-inset"
                >
                  <span className="text-ivory-dim">{t('Did you mean')} </span>
                  <span className="font-medium text-brass">{t(suggestion.label)}</span>
                  <span className="text-ivory-dim">?</span>
                </button>
              )}
              {results.map((item, i) => (
                <button
                  type="button"
                  key={`${item.kind || 'page'}-${item.label}`}
                  onClick={() => go(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-inset ${
                    i === activeIndex ? 'bg-brass/10 text-brass' : 'text-ivory hover:bg-ink'
                  }`}
                >
                  <span>{t(item.label)}</span>
                  {item.kind === 'action' && (
                    <span className="shrink-0 rounded-full border border-ink-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-ivory-dim">{t('Action')}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
