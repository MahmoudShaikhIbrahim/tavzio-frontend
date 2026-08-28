import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listTables, createTable, updateTable, deleteTable, connectCardToTable, disconnectCardFromTable, mergeTables, unmergeTable,
  listWaitlist, addToWaitlist, seatWaitlistEntry, cancelWaitlistEntry, listCards,
} from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import type { FloorTable, WaitlistEntry, Card } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';
import SectionRequestNotifications from '../../components/SectionRequestNotifications';
import { useConfirm } from '../../components/ConfirmDialog';

const STATUS_COLOR: Record<string, string> = {
  available: 'border-success/50 text-success',
  occupied: 'border-brass text-brass',
  reserved: 'border-warning/50 text-warning',
  cleaning: 'border-ivory-dim/50 text-ivory-dim',
};

// Real, independent tables now - a table exists on its own, whether or
// not it has an NFC card connected yet. Losing or damaging a card no
// longer means losing the table: disconnect the old one, connect a new
// one, everything about the table itself (status, history, identity)
// stays exactly as it was. Same real pattern this codebase already uses
// for hotel rooms, applied here for the first time to restaurant tables.
export default function TableManagementPage() {
  const { user } = useSession();
  const { t } = useT();
  const confirm = useConfirm();
  const businessId = user?.business_id;
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [availableCards, setAvailableCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [showAddWaitlist, setShowAddWaitlist] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);

  function reload() {
    if (!businessId) return;
    listTables(businessId).then(setTables).catch(() => {});
    listWaitlist(businessId).then(setWaitlist).catch(() => {});
    // Real, active cards not already connected to a table (or to a
    // hotel room, or a staff login) - exactly the pool of stands that
    // could actually be wired up to a table right now.
    listCards(businessId).then((cards) => {
      setAvailableCards(cards.filter((c) => c.status === 'active' && !c.linked_user_id && !c.room_id && !c.table_id));
    }).catch(() => {});
  }
  useEffect(() => {
    setLoading(true);
    if (!businessId) return;
    Promise.all([listTables(businessId), listWaitlist(businessId)])
      .then(([tbls, w]) => { setTables(tbls); setWaitlist(w); })
      .finally(() => setLoading(false));
    reload();
    const unsubTables = subscribeToBusinessTable(businessId, 'tables', reload);
    const unsubCards = subscribeToBusinessTable(businessId, 'cards', reload);
    return () => { unsubTables(); unsubCards(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function handleCreateTable(label: string, seatCount: number) {
    if (!businessId || !label.trim()) return;
    await createTable(businessId, { label: label.trim(), seatCount });
    setShowAddTable(false);
    reload();
  }

  async function handleDeleteTable(table: FloorTable) {
    if (!businessId) return;
    if (!(await confirm({ title: t('Delete this table?'), message: `${t('Delete')} "${table.label}"? ${t('This cannot be undone.')}`, confirmLabel: t('Delete'), danger: true }))) return;
    try {
      await deleteTable(businessId, table.id);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('Could not delete this table'));
    }
  }

  async function handleStatusChange(tableId: string, status: FloorTable['status']) {
    if (!businessId) return;
    // Optimistic: the table's border color updates the instant you tap,
    // instead of waiting on a full re-fetch of every table + the whole
    // waitlist just to reflect a single status change.
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status } : t)));
    try {
      await updateTable(businessId, tableId, { status });
    } catch {
      reload();
    }
  }

  async function handleConnectCard(tableId: string, cardId: string) {
    if (!businessId) return;
    setConnectingId(null);
    try {
      await connectCardToTable(businessId, tableId, cardId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('Could not connect that card'));
    }
  }

  async function handleDisconnectCard(table: FloorTable) {
    if (!businessId) return;
    if (!(await confirm({
      title: t('Disconnect this card?'),
      message: `${t('Disconnect the NFC card from')} "${table.label}"? ${t('The table itself stays exactly as it is - you can connect a new or replacement card any time.')}`,
      confirmLabel: t('Disconnect'),
    }))) return;
    await disconnectCardFromTable(businessId, table.id);
    reload();
  }

  async function handleMerge(tableId: string, mergeWithTableId: string) {
    if (!businessId) return;
    setMergingId(null);
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, mergedWithTableId: mergeWithTableId, status: 'occupied' } : t)));
    try {
      await mergeTables(businessId, tableId, mergeWithTableId);
    } catch {
      reload();
    }
  }

  async function handleUnmerge(tableId: string) {
    if (!businessId) return;
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, mergedWithTableId: null } : t)));
    try {
      await unmergeTable(businessId, tableId);
    } catch {
      reload();
    }
  }

  async function handleSeat(entryId: string, tableId: string) {
    if (!businessId) return;
    setWaitlist((prev) => prev.filter((w) => w.id !== entryId));
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status: 'occupied' } : t)));
    try {
      await seatWaitlistEntry(businessId, entryId, tableId);
    } catch {
      reload();
    }
  }

  async function handleCancelWaitlist(entryId: string) {
    if (!businessId) return;
    setWaitlist((prev) => prev.filter((w) => w.id !== entryId));
    try {
      await cancelWaitlistEntry(businessId, entryId);
    } catch {
      reload();
    }
  }

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  const availableTables = tables.filter((t) => t.status === 'available' && !t.mergedWithTableId);

  return (
    <div className="space-y-8">
      <SectionRequestNotifications businessId={businessId} section="tables" />
      <h1 className="font-display text-3xl text-ivory">{t('Table Management')}</h1>

      <Section title={t('Floor plan')} action={
        <button type="button" onClick={() => setShowAddTable((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
          {t('+ Add table')}
        </button>
      }>
        {showAddTable && <AddTableForm onCreate={handleCreateTable} onCancel={() => setShowAddTable(false)} />}
        {loading && <p className="text-ivory-dim">Loading...</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tables.filter((t) => !t.mergedWithTableId).map((table) => {
            const mergedInto = tables.find((tt) => tt.mergedWithTableId === table.id);
            return (
              <div key={table.id} className={`rounded-xl border p-4 ${STATUS_COLOR[table.status]}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-medium text-ivory">{table.label}</p>
                  <button type="button" onClick={() => handleDeleteTable(table)} className="text-xs text-ivory-dim hover:text-danger" title={t('Delete table')}>✕</button>
                </div>
                <p className="text-sm">{t(table.status)}{table.seatCount > 0 && ` · ${table.seatCount} ${t('seats')}`}</p>

                {/* Real, always-visible connection status - the actual
                    point of this whole redesign: a table with no card
                    is a completely normal, valid state, not an error. */}
                {table.card ? (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-ink/40 px-2 py-1.5">
                    <span className="text-xs text-success">{t('Connected')} · {table.card.uid}</span>
                    <button type="button" onClick={() => handleDisconnectCard(table)} className="text-xs text-ivory-dim hover:text-danger">{t('Disconnect')}</button>
                  </div>
                ) : connectingId === table.id ? (
                  <select
                    onChange={(e) => e.target.value && handleConnectCard(table.id, e.target.value)}
                    className="mt-2 w-full rounded border border-brass/40 bg-ink px-2 py-1 text-xs text-ivory"
                    defaultValue=""
                    autoFocus
                  >
                    <option value="">{t('Pick a card to connect...')}</option>
                    {availableCards.map((c) => <option key={c.id} value={c.id}>{c.uid}</option>)}
                  </select>
                ) : (
                  <button type="button" onClick={() => setConnectingId(table.id)} className="mt-2 w-full rounded-lg border border-brass/40 py-1 text-xs text-brass hover:bg-brass/10">
                    {t('+ Connect NFC card')}
                  </button>
                )}

                {table.activeOrders.length > 0 && (
                  <p className="mt-2 text-sm text-ivory-dim">
                    {table.activeOrders.length} {t('order')}{table.activeOrders.length === 1 ? '' : 's'} · AED {table.activeOrders.reduce((s, o) => s + o.total, 0).toFixed(2)}
                  </p>
                )}
                {mergedInto && <p className="mt-1 text-xs text-ivory-dim">+ {t('merged with')} {mergedInto.label}</p>}

                <div className="mt-3 flex flex-wrap gap-1">
                  {(['available', 'occupied', 'reserved', 'cleaning'] as const).map((s) => (
                    <button type="button"
                      key={s}
                      onClick={() => handleStatusChange(table.id, s)}
                      className={`rounded px-2 py-0.5 text-xs ${table.status === s ? 'bg-brass text-ink' : 'border border-ink-line text-ivory-dim'}`}
                    >
                      {t(s)}
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
                      <option value="">{t('Merge with...')}</option>
                      {tables.filter((tt) => tt.id !== table.id && !tt.mergedWithTableId).map((tt) => (
                        <option key={tt.id} value={tt.id}>{tt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <button type="button" onClick={() => setMergingId(table.id)} className="text-xs text-brass hover:underline">{t('Merge table')}</button>
                  )}
                </div>
              </div>
            );
          })}
          {tables.filter((table) => table.mergedWithTableId).map((table) => (
            <div key={table.id} className="rounded-xl border border-ink-line p-4 opacity-60">
              <p className="text-base text-ivory">{table.label}</p>
              <p className="text-sm text-ivory-dim">{t('merged into another table')}</p>
              <button type="button" onClick={() => handleUnmerge(table.id)} className="mt-2 text-xs text-brass hover:underline">{t('Unmerge')}</button>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('Waitlist')} action={
        <button type="button" onClick={() => setShowAddWaitlist((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
          {t('+ Add to waitlist')}
        </button>
      }>
        {showAddWaitlist && (
          <AddWaitlistForm businessId={businessId} onDone={() => { setShowAddWaitlist(false); reload(); }} />
        )}
        <div className="space-y-2">
          {waitlist.filter((w) => w.status === 'waiting').map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3">
              <div>
                <p className="text-base text-ivory">{entry.guest_name} · {t('party of')} {entry.party_size}</p>
                <p className="text-sm text-ivory-dim">{entry.phone} · {t('waiting')} {Math.round((Date.now() - new Date(entry.created_at).getTime()) / 60000)} min</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => e.target.value && handleSeat(entry.id, e.target.value)}
                  className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory"
                  defaultValue=""
                >
                  <option value="">{t('Seat at...')}</option>
                  {availableTables.map((tbl) => <option key={tbl.id} value={tbl.id}>{tbl.label}</option>)}
                </select>
                <button type="button" onClick={() => handleCancelWaitlist(entry.id)} className="text-sm text-danger hover:underline">{t('Cancel')}</button>
              </div>
            </div>
          ))}
          {waitlist.filter((w) => w.status === 'waiting').length === 0 && <p className="text-ivory-dim">{t('Nobody waiting.')}</p>}
        </div>
      </Section>
    </div>
  );
}

// Real, new capability: a table can now be created before any physical
// NFC card exists for it at all - set up your whole floor plan on day
// one, connect cards as they arrive.
function AddTableForm({ onCreate, onCancel }: { onCreate: (label: string, seatCount: number) => void; onCancel: () => void }) {
  const { t } = useT();
  const [label, setLabel] = useState('');
  const [seatCount, setSeatCount] = useState(2);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (label.trim()) onCreate(label, seatCount); }}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4"
    >
      <Field label={t('Table name/number')}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('e.g. Table 5')} required autoFocus className={inputClass} />
      </Field>
      <Field label={t('Seats')}>
        <input type="number" min={1} onFocus={(e) => e.target.select()} value={seatCount} onChange={(e) => setSeatCount(Number(e.target.value))} className={`${inputClass} w-24`} />
      </Field>
      <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">{t('Create')}</button>
      <button type="button" onClick={onCancel} className="text-sm text-ivory-dim hover:text-ivory">{t('Cancel')}</button>
    </form>
  );
}

function AddWaitlistForm({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const { t } = useT();
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
      <Field label={t('Guest name')}>
        <input value={guestName} onChange={(e) => setGuestName(e.target.value)} required className={inputClass} />
      </Field>
      <Field label={t('Party size')}>
        <input type="number" min={1} onFocus={(e) => e.target.select()} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className={`${inputClass} w-24`} />
      </Field>
      <Field label={t('Phone (optional)')}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </Field>
      <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
        {saving ? t('Adding...') : t('Add')}
      </button>
    </form>
  );
}
