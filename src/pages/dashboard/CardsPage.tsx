import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listCards, updateCard } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import type { Card } from '../../types';
import { Section } from '../../components/ui';

export default function CardsPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [cards, setCards] = useState<Card[]>([]);

  function reload() {
    if (businessId) listCards(businessId).then(setCards);
  }

  useEffect(reload, [businessId]);

  // Live sync - a rename or status change from super admin (or another
  // staff member) shows up here instantly, not just on next page load.
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
    <Section title={`Table / customer cards (${customerCards.length})`}>
      <p className="text-base text-ivory-dim">
        Rename a card, or change its status if one's lost — new cards are
        created by the platform operator, since it's them who physically
        programs the chip.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {customerCards.map((c) => <CardRow key={c.id} card={c} businessId={businessId} onChange={reload} />)}
        {customerCards.length === 0 && <p className="text-base text-ivory-dim">No cards yet.</p>}
      </div>
    </Section>
  );
}

function CardRow({ card, businessId, onChange }: { card: Card; businessId: string; onChange: () => void }) {
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-line px-3.5 py-2 text-base">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {editing ? (
          <>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              className="w-40 rounded border border-brass/40 bg-ink px-2 py-1 text-base text-ivory"
            />
            <button onClick={saveLabel} className="text-base text-brass hover:underline">Save</button>
            <button onClick={() => { setEditing(false); setLabel(card.label); }} className="text-base text-ivory-dim hover:text-ivory">Cancel</button>
          </>
        ) : (
          <>
            <span className="truncate text-ivory">{card.label || 'Untitled'}</span>
            <span className="shrink-0 font-mono text-base text-ivory-dim">{card.uid}</span>
            <button onClick={() => setEditing(true)} className="shrink-0 text-base text-brass hover:underline">Rename</button>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={copyUrl} className="rounded border border-ink-line px-2 py-1 text-base text-ivory-dim hover:text-ivory">
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
        <select
          value={card.status}
          onChange={(e) => updateCard(businessId, card.id, { status: e.target.value }).then(onChange)}
          className="rounded border border-ink-line bg-ink px-2 py-1 text-base text-ivory-dim"
        >
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="lost">lost</option>
          <option value="disabled">disabled</option>
        </select>
      </div>
    </div>
  );
}
