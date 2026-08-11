import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listFloorTables, updateTableStatus, mergeTables, unmergeTable,
  listWaitlist, addToWaitlist, seatWaitlistEntry, cancelWaitlistEntry,
} from '../../lib/authApi';
import type { FloorTable, WaitlistEntry } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

const STATUS_COLOR: Record<string, string> = {
  available: 'border-success/50 text-success',
  occupied: 'border-brass text-brass',
  reserved: 'border-warning/50 text-warning',
  cleaning: 'border-ivory-dim/50 text-ivory-dim',
};

export default function TableManagementPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [showAddWaitlist, setShowAddWaitlist] = useState(false);

  function reload() {
    if (!businessId) return;
    listFloorTables(businessId).then(setTables);
    listWaitlist(businessId).then(setWaitlist);
  }
  useEffect(() => {
    setLoading(true);
    Promise.all([businessId ? listFloorTables(businessId) : Promise.resolve([]), businessId ? listWaitlist(businessId) : Promise.resolve([])])
      .then(([t, w]) => { setTables(t); setWaitlist(w); })
      .finally(() => setLoading(false));
  }, [businessId]);

  async function handleStatusChange(cardId: string, tableStatus: string) {
    if (!businessId) return;
    await updateTableStatus(businessId, cardId, { tableStatus });
    reload();
  }

  async function handleMerge(cardId: string, mergeWithCardId: string) {
    if (!businessId) return;
    await mergeTables(businessId, cardId, mergeWithCardId);
    setMergingId(null);
    reload();
  }

  async function handleUnmerge(cardId: string) {
    if (!businessId) return;
    await unmergeTable(businessId, cardId);
    reload();
  }

  async function handleSeat(entryId: string, cardId: string) {
    if (!businessId) return;
    await seatWaitlistEntry(businessId, entryId, cardId);
    reload();
  }

  async function handleCancelWaitlist(entryId: string) {
    if (!businessId) return;
    await cancelWaitlistEntry(businessId, entryId);
    reload();
  }

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  const availableTables = tables.filter((t) => t.table_status === 'available' && !t.merged_with_card_id);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-ivory">Table Management</h1>

      <Section title="Floor plan">
        {loading && <p className="text-ivory-dim">Loading...</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tables.filter((t) => !t.merged_with_card_id).map((table) => {
            const mergedInto = tables.find((t) => t.merged_with_card_id === table.id);
            return (
              <div key={table.id} className={`rounded-xl border p-4 ${STATUS_COLOR[table.table_status]}`}>
                <p className="text-base font-medium text-ivory">{table.label || 'Unnamed'}</p>
                <p className="text-sm">{table.table_status}{table.seat_count > 0 && ` · ${table.seat_count} seats`}</p>
                {table.activeOrders.length > 0 && (
                  <p className="mt-1 text-sm text-ivory-dim">
                    {table.activeOrders.length} order{table.activeOrders.length === 1 ? '' : 's'} · AED {table.activeOrders.reduce((s, o) => s + o.total, 0).toFixed(2)}
                  </p>
                )}
                {mergedInto && <p className="mt-1 text-xs text-ivory-dim">+ merged with {mergedInto.label}</p>}

                <div className="mt-3 flex flex-wrap gap-1">
                  {(['available', 'occupied', 'reserved', 'cleaning'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(table.id, s)}
                      className={`rounded px-2 py-0.5 text-xs ${table.table_status === s ? 'bg-brass text-ink' : 'border border-ink-line text-ivory-dim'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="mt-2">
                  {mergingId === table.id ? (
                    <select
                      onChange={(e) => e.target.value && handleMerge(table.id, e.target.value)}
                      className="w-full rounded border border-ink-line bg-ink px-2 py-1 text-xs text-ivory"
                      defaultValue=""
                    >
                      <option value="">Merge with...</option>
                      {tables.filter((t) => t.id !== table.id && !t.merged_with_card_id).map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  ) : (
                    <button onClick={() => setMergingId(table.id)} className="text-xs text-brass hover:underline">Merge table</button>
                  )}
                </div>
              </div>
            );
          })}
          {tables.filter((t) => t.merged_with_card_id).map((table) => (
            <div key={table.id} className="rounded-xl border border-ink-line p-4 opacity-60">
              <p className="text-base text-ivory">{table.label}</p>
              <p className="text-sm text-ivory-dim">merged into another table</p>
              <button onClick={() => handleUnmerge(table.id)} className="mt-2 text-xs text-brass hover:underline">Unmerge</button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Waitlist" action={
        <button onClick={() => setShowAddWaitlist((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
          + Add to waitlist
        </button>
      }>
        {showAddWaitlist && (
          <AddWaitlistForm businessId={businessId} onDone={() => { setShowAddWaitlist(false); reload(); }} />
        )}
        <div className="space-y-2">
          {waitlist.filter((w) => w.status === 'waiting').map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3">
              <div>
                <p className="text-base text-ivory">{entry.guest_name} · party of {entry.party_size}</p>
                <p className="text-sm text-ivory-dim">{entry.phone} · waiting {Math.round((Date.now() - new Date(entry.created_at).getTime()) / 60000)} min</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => e.target.value && handleSeat(entry.id, e.target.value)}
                  className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory"
                  defaultValue=""
                >
                  <option value="">Seat at...</option>
                  {availableTables.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <button onClick={() => handleCancelWaitlist(entry.id)} className="text-sm text-danger hover:underline">Cancel</button>
              </div>
            </div>
          ))}
          {waitlist.filter((w) => w.status === 'waiting').length === 0 && <p className="text-ivory-dim">Nobody waiting.</p>}
        </div>
      </Section>
    </div>
  );
}

function AddWaitlistForm({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const [guestName, setGuestName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return;
    setSaving(true);
    await addToWaitlist(businessId, { guestName, partySize, phone });
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
      <Field label="Guest name">
        <input value={guestName} onChange={(e) => setGuestName(e.target.value)} required className={inputClass} />
      </Field>
      <Field label="Party size">
        <input type="number" min={1} onFocus={(e) => e.target.select()} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className={`${inputClass} w-24`} />
      </Field>
      <Field label="Phone (optional)">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </Field>
      <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
        {saving ? 'Adding...' : 'Add'}
      </button>
    </form>
  );
}
