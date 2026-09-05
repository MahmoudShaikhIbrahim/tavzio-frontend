import { useEffect, useState } from 'react';
import {
  listSuperAdminDigitalCards, createSuperAdminDigitalCard, updateSuperAdminDigitalCard, deleteSuperAdminDigitalCard,
} from '../../lib/authApi';
import type { DigitalCard } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';

const BASE = import.meta.env.VITE_API_BASE_URL || '';
const SITE = window.location.origin;

export default function SuperAdminDigitalCardsPage() {
  const confirm = useConfirm();
  const [cards, setCards] = useState<DigitalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'person' | 'business'>('person');

  function reload() {
    setLoading(true);
    listSuperAdminDigitalCards().then(setCards).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createSuperAdminDigitalCard({ name: newName.trim(), cardType: newType });
      setNewName('');
      reload();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(card: DigitalCard) {
    if (!(await confirm({ title: 'Delete card?', message: `Delete "${card.name}"? This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    await deleteSuperAdminDigitalCard(card.id);
    reload();
  }

  async function handleToggleStatus(card: DigitalCard) {
    const next = card.status === 'active' ? 'inactive' : 'active';
    await updateSuperAdminDigitalCard(card.id, { status: next } as never);
    reload();
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-ivory">Digital Business Cards</h1>
      <p className="mt-1 text-base text-ivory-dim">
        Yours only - create a card for yourself, a teammate, or any professional identity. Normal Tavzio businesses each get exactly one card of their own, managed from their own Business Profile settings, not from here.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-ink-line p-3 shadow-sm">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className="flex-1 min-w-[10rem] rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory" />
        <select value={newType} onChange={(e) => setNewType(e.target.value as typeof newType)} className="rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          <option value="person">Person</option>
          <option value="business">Business</option>
        </select>
        <button type="button" disabled={creating || !newName.trim()} onClick={handleCreate} className="rounded-full bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {creating ? 'Creating...' : '+ Create New Card'}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {cards.map((card) => (
          <div key={card.id} className="rounded-2xl border border-ink-line p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-medium text-ivory">{card.name} {card.title && <span className="text-ivory-dim">· {card.title}</span>}</p>
                <p className="text-sm text-ivory-dim">
                  {card.card_type} ·{' '}
                  <span className={card.status === 'active' ? 'text-success' : 'text-ivory-dim'}>{card.status === 'active' ? 'Live' : 'Not published'}</span>
                  {' '}· {SITE}/card/{card.slug}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href={`/admin/super/digital-cards/${card.id}`} className="text-sm text-brass hover:underline">Edit</a>
                <a href={`${SITE}/card/${card.slug}`} target="_blank" rel="noreferrer" className="text-sm text-brass hover:underline">Preview</a>
                <a href={`${BASE}/api/public/cards/${card.slug}/qr.png`} target="_blank" rel="noreferrer" className="text-sm text-brass hover:underline">QR</a>
                <button type="button" onClick={() => navigator.clipboard.writeText(`${SITE}/card/${card.slug}`)} className="text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Copy link</button>
                <button type="button" onClick={() => handleToggleStatus(card)} className="text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  {card.status === 'active' ? 'Unpublish' : 'Publish'}
                </button>
                <button type="button" onClick={() => handleDelete(card)} className="text-sm text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Delete</button>
              </div>
            </div>
          </div>
        ))}
        {!loading && cards.length === 0 && <p className="text-base text-ivory-dim">No cards yet - create your first one above.</p>}
      </div>
    </div>
  );
}
