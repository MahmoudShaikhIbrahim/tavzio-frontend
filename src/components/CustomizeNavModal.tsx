interface NavCustomizeItem {
  path: string;
  label: string;
}

// Real, focused popup - genuinely separate from the actual nav bar and
// Settings dropdown, which now always render their normal browsing UI
// and never transform into an editing state in place. That in-place
// transformation was the actual core of the old UX problem: the same
// small strip of screen space tried to be both "the real navigation"
// and "an editor for the real navigation" depending on a toggle, with
// the Settings dropdown also force-open the whole time - cramped, and
// never gave a clear sense of being in a distinct editing mode.
//
// Vertical lists, not the old horizontal grid with left/right arrows -
// matching the same real pattern already used for reordering menu
// categories and items. Top-to-bottom position unambiguously means
// first-to-last on its own; a wrapping grid has no natural reading
// direction, which was the real reason "1" and "last" ever felt
// unclear in the first place, not a labeling problem.
export default function CustomizeNavModal({
  mainTabs, settingsItems, hiddenTabs, onMove, onHide, onRestore, onDone, t,
}: {
  mainTabs: NavCustomizeItem[];
  settingsItems: NavCustomizeItem[];
  hiddenTabs: NavCustomizeItem[];
  onMove: (scope: NavCustomizeItem[], path: string, direction: -1 | 1) => void;
  onHide: (path: string) => void;
  onRestore: (path: string) => void;
  onDone: () => void;
  t: (s: string) => string;
}) {
  function List({ title, items }: { title: string; items: NavCustomizeItem[] }) {
    return (
      <div>
        <p className="mb-2 text-sm font-medium text-ivory">{t(title)}</p>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.path} className="flex items-center gap-3 rounded-lg border border-ink-line bg-ink px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brass/15 font-mono text-sm text-brass">{i + 1}</span>
              <span className="flex-1 text-base text-ivory">{t(item.label)}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button"
                  onClick={() => onMove(items, item.path, -1)}
                  disabled={i === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-ivory-dim hover:bg-ink-soft hover:text-ivory disabled:opacity-20"
                  aria-label={t('Move up')}
                  title={t('Move up')}
                >
                  ↑
                </button>
                <button type="button"
                  onClick={() => onMove(items, item.path, 1)}
                  disabled={i === items.length - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-ivory-dim hover:bg-ink-soft hover:text-ivory disabled:opacity-20"
                  aria-label={t('Move down')}
                  title={t('Move down')}
                >
                  ↓
                </button>
                <button type="button"
                  onClick={() => onHide(item.path)}
                  className="ms-1 rounded-lg border border-ink-line px-2.5 py-1.5 text-xs text-ivory-dim hover:border-danger hover:text-danger"
                >
                  {t('Hide')}
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-ivory-dim">{t('Nothing here.')}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto bg-ink/80 px-4 py-8" onClick={onDone}>
      <div
        className="w-full max-w-lg rounded-2xl border border-ink-line bg-ink-soft shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-ink-line p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-ivory">{t('Customize navigation')}</h2>
            <button type="button" onClick={onDone} className="rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90">
              {t('Done')}
            </button>
          </div>
          {/* The real, explicit visual explanation this whole redesign
              was actually about - a numbered badge on every row plus
              this one line removes any doubt about which end is which. */}
          <p className="mt-3 flex items-center gap-2 text-sm text-ivory-dim">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass/15 text-xs text-brass">1</span>
            {t('shows first in your navigation bar. Use ↑ / ↓ to reorder - changes save instantly.')}
          </p>
        </div>

        <div className="max-h-[60vh] space-y-6 overflow-y-auto p-5">
          <List title="Main tabs" items={mainTabs} />
          <List title="Settings menu" items={settingsItems} />

          {hiddenTabs.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-ivory">{t('Hidden')}</p>
              <div className="flex flex-wrap gap-2">
                {hiddenTabs.map((tab) => (
                  <button
                    key={tab.path}
                    type="button"
                    onClick={() => onRestore(tab.path)}
                    className="rounded-full border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:border-brass hover:text-ivory"
                  >
                    + {t(tab.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
