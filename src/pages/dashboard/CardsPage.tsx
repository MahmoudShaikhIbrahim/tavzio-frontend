import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listCards, updateCard } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import type { Card } from '../../types';
import { Section } from '../../components/ui';

export default function CardsPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [cards, setCards] = useState<Card[]>([]);

  function reload() {
    if (businessId) listCards(businessId).then(setCards).catch(() => {});
  }

  useEffect(reload, [businessId]);
  usePollingFallback(reload, !!businessId);
  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'cards', reload);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  if (!businessId) return null;

  // Old admin/owner login cards (from before that feature was removed
  // entirely) are deliberately excluded - they no longer serve any
  // function and don't belong in a list of physical table cards.
  const customerCards = cards.filter((c) => !c.linked_user_id);

  return (
    <Section title={`${t('Table / customer cards')} (${customerCards.length})`}>
      <p className="text-base text-ivory-dim">
        {t("Rename a card, or change its status if one's lost — new cards are created by the platform operator, since it's them who physically programs the chip.")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {customerCards.map((c) => <CardRow key={c.id} card={c} cards={cards} businessId={businessId} onCardsChange={setCards} onChange={reload} />)}
        {customerCards.length === 0 && <p className="text-base text-ivory-dim">{t('No cards yet.')}</p>}
      </div>
    </Section>
  );
}

function CardRow({ card, cards, businessId, onCardsChange, onChange }: { card: Card; cards: Card[]; businessId: string; onCardsChange: (c: Card[]) => void; onChange: () => void }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(card.label);
  const [copied, setCopied] = useState(false);

  const tapUrl = `${window.location.origin}/t/${card.uid}`;

  async function saveLabel() {
    await updateCard(businessId, card.id, { label });
    setEditing(false);
    onChange();
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(tapUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-line px-5 py-4 text-base sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {editing ? (
          <>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              className="w-40 rounded border border-brass/40 bg-ink px-2 py-1 text-base text-ivory"
            />
            <button type="button" onClick={saveLabel} className="text-base text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Save')}</button>
            <button type="button" onClick={() => { setEditing(false); setLabel(card.label); }} className="text-base text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Cancel')}</button>
          </>
        ) : (
          <>
            <span className="truncate text-ivory">{card.label || t('Untitled')}</span>
            <span className="shrink-0 font-mono text-base text-ivory-dim">{card.uid}</span>
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-base text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Rename')}</button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copyUrl} className="rounded border border-ink-line px-2 py-1 text-base text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {copied ? t('Copied!') : t('Copy URL')}
        </button>
        <select
          value={card.status}
          onChange={(e) => {
            const status = e.target.value as Card['status'];
            onCardsChange(cards.map((c) => (c.id === card.id ? { ...c, status } : c)));
            updateCard(businessId, card.id, { status }).catch(onChange);
          }}
          className="rounded border border-ink-line bg-ink px-2 py-1 text-base text-ivory-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          <option value="active">{t('active')}</option>
          <option value="inactive">{t('inactive')}</option>
          <option value="lost">{t('lost')}</option>
          <option value="disabled">{t('disabled')}</option>
        </select>
      </div>
    </div>
  );
}
