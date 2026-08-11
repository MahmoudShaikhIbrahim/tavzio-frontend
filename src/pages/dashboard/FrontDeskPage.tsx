import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listRooms, createRoom, listGuests, createGuest, listReservations, createReservation,
  checkInReservation, checkOutReservation, cancelReservation,
  getFoliosByReservation, addFolioCharge, recordFolioPayment, recordFolioDeposit, recordFolioRefund, splitFolio,
} from '../../lib/authApi';
import type { HotelRoom, HotelGuest, HotelReservation, HotelFolio } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

export default function FrontDeskPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [tab, setTab] = useState<'reservations' | 'rooms'>('reservations');
  const [openFolioForReservation, setOpenFolioForReservation] = useState<string | null>(null);

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  if (openFolioForReservation) {
    return <FolioView businessId={businessId} reservationId={openFolioForReservation} onClose={() => setOpenFolioForReservation(null)} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">Front Desk</h1>
      <div className="flex gap-2 border-b border-ink-line">
        {(['reservations', 'rooms'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-base capitalize ${tab === t ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'reservations' && <ReservationsTab businessId={businessId} onOpenFolio={setOpenFolioForReservation} />}
      {tab === 'rooms' && <RoomsTab businessId={businessId} />}
    </div>
  );
}

function ReservationsTab({ businessId, onOpenFolio }: { businessId: string; onOpenFolio: (id: string) => void }) {
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  function reload() {
    listReservations(businessId).then(setReservations);
    listRooms(businessId).then(setRooms);
  }
  useEffect(() => { setLoading(true); Promise.all([listReservations(businessId), listRooms(businessId)]).then(([r, rm]) => { setReservations(r); setRooms(rm); }).finally(() => setLoading(false)); }, [businessId]);

  async function handleCheckIn(reservationId: string, roomId?: string) {
    try {
      await checkInReservation(businessId, reservationId, roomId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not check in');
    }
  }

  async function handleCheckOut(reservationId: string) {
    try {
      await checkOutReservation(businessId, reservationId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not check out');
    }
  }

  async function handleCancel(reservationId: string) {
    await cancelReservation(businessId, reservationId);
    reload();
  }

  const availableRooms = rooms.filter((r) => r.status === 'available');

  return (
    <Section title="Reservations" action={
      <button onClick={() => setShowNew((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ New reservation</button>
    }>
      {showNew && <NewReservationForm businessId={businessId} rooms={rooms} onDone={() => { setShowNew(false); reload(); }} />}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      <div className="space-y-2">
        {reservations.map((r) => (
          <div key={r.id} className="rounded-lg border border-ink-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base text-ivory">{r.hotel_guests?.name || 'Guest'} · {r.check_in_date} → {r.check_out_date}</p>
                <p className="text-sm text-ivory-dim">
                  {r.hotel_rooms?.room_number ? `Room ${r.hotel_rooms.room_number}` : 'No room assigned'} · {r.adults} adult{r.adults === 1 ? '' : 's'}
                  {r.children > 0 && `, ${r.children} child${r.children === 1 ? '' : 'ren'}`} · AED {r.rate_aed}/night ·{' '}
                  <span className="text-brass">{r.status}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {r.status === 'confirmed' && (
                  <CheckInControl reservation={r} availableRooms={availableRooms} onCheckIn={handleCheckIn} onCancel={() => handleCancel(r.id)} />
                )}
                {r.status === 'checked_in' && (
                  <>
                    <button onClick={() => onOpenFolio(r.id)} className="text-sm text-brass hover:underline">View folio</button>
                    <button onClick={() => handleCheckOut(r.id)} className="text-sm text-brass hover:underline">Check out</button>
                  </>
                )}
                {r.status === 'checked_out' && <button onClick={() => onOpenFolio(r.id)} className="text-sm text-ivory-dim hover:underline">View folio</button>}
              </div>
            </div>
          </div>
        ))}
        {!loading && reservations.length === 0 && <p className="text-ivory-dim">No reservations yet.</p>}
      </div>
    </Section>
  );
}

function CheckInControl({ reservation, availableRooms, onCheckIn, onCancel }: { reservation: HotelReservation; availableRooms: HotelRoom[]; onCheckIn: (id: string, roomId?: string) => void; onCancel: () => void }) {
  const [roomId, setRoomId] = useState(reservation.room_id || '');
  return (
    <div className="flex items-center gap-2">
      {!reservation.room_id && (
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory">
          <option value="">Assign room...</option>
          {availableRooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
        </select>
      )}
      <button onClick={() => onCheckIn(reservation.id, roomId || undefined)} className="text-sm text-brass hover:underline">Check in</button>
      <button onClick={onCancel} className="text-sm text-danger hover:underline">Cancel</button>
    </div>
  );
}

function NewReservationForm({ businessId, rooms, onDone }: { businessId: string; rooms: HotelRoom[]; onDone: () => void }) {
  const [guests, setGuests] = useState<HotelGuest[]>([]);
  const [guestId, setGuestId] = useState('');
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [adults, setAdults] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { listGuests(businessId).then(setGuests); }, [businessId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let finalGuestId = guestId;
      if (!finalGuestId && newGuestName.trim()) {
        const guest = await createGuest(businessId, { name: newGuestName.trim(), phone: newGuestPhone });
        finalGuestId = guest.id;
      }
      if (!finalGuestId) { setError('Select or add a guest'); setSaving(false); return; }
      await createReservation(businessId, { guestId: finalGuestId, roomId: roomId || null, checkInDate, checkOutDate, adults });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create reservation');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-ink-line p-4">
      <div className="flex flex-wrap gap-3">
        <Field label="Guest">
          <select value={guestId} onChange={(e) => setGuestId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
            <option value="">New guest...</option>
            {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        {!guestId && (
          <>
            <Field label="New guest name"><input value={newGuestName} onChange={(e) => setNewGuestName(e.target.value)} className={inputClass} /></Field>
            <Field label="Phone"><input value={newGuestPhone} onChange={(e) => setNewGuestPhone(e.target.value)} className={inputClass} /></Field>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Field label="Check-in"><input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
        <Field label="Check-out"><input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
        <Field label="Adults"><input type="number" min={1} onFocus={(e) => e.target.select()} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={`${inputClass} w-20`} /></Field>
        <Field label="Room (optional now)">
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
            <option value="">Assign later</option>
            {rooms.filter((r) => r.status === 'available').map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
          </select>
        </Field>
      </div>
      {error && <p className="text-base text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
        {saving ? 'Creating...' : 'Create reservation'}
      </button>
    </form>
  );
}

function RoomsTab({ businessId }: { businessId: string }) {
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('standard');
  const [baseRate, setBaseRate] = useState(0);

  function reload() { listRooms(businessId).then(setRooms); }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!roomNumber.trim()) return;
    await createRoom(businessId, { roomNumber, roomType, baseRateAed: baseRate });
    setRoomNumber(''); setBaseRate(0); setShowAdd(false);
    reload();
  }

  const STATUS_COLOR: Record<string, string> = {
    available: 'border-success/50 text-success', occupied: 'border-brass text-brass',
    dirty: 'border-warning/50 text-warning', maintenance: 'border-ivory-dim/50 text-ivory-dim', out_of_order: 'border-danger/50 text-danger',
  };

  return (
    <Section title="Rooms" action={<button onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ Add room</button>}>
      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label="Room number"><input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} required className={inputClass} /></Field>
          <Field label="Type"><input value={roomType} onChange={(e) => setRoomType(e.target.value)} className={inputClass} /></Field>
          <Field label="Rate/night (AED)"><input type="number" min={0} onFocus={(e) => e.target.select()} value={baseRate} onChange={(e) => setBaseRate(Number(e.target.value))} className={`${inputClass} w-32`} /></Field>
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Add</button>
        </form>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rooms.map((r) => (
          <div key={r.id} className={`rounded-lg border p-3 ${STATUS_COLOR[r.status]}`}>
            <p className="text-base text-ivory">{r.room_number}</p>
            <p className="text-sm capitalize">{r.status}</p>
            <p className="text-xs text-ivory-dim">{r.room_type} · AED {r.base_rate_aed}/night</p>
          </div>
        ))}
        {rooms.length === 0 && <p className="text-ivory-dim">No rooms yet.</p>}
      </div>
    </Section>
  );
}


function FolioView({ businessId, reservationId, onClose }: { businessId: string; reservationId: string; onClose: () => void }) {
  const [folios, setFolios] = useState<HotelFolio[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, string[]>>({});

  function reload() {
    getFoliosByReservation(businessId, reservationId).then(setFolios).catch(() => setFolios([]));
  }
  useEffect(reload, [businessId, reservationId]);

  function toggleCharge(folioId: string, chargeId: string) {
    setSelectedIds((prev) => {
      const current = prev[folioId] || [];
      const next = current.includes(chargeId) ? current.filter((id) => id !== chargeId) : [...current, chargeId];
      return { ...prev, [folioId]: next };
    });
  }

  async function handleSplit(folioId: string) {
    const chargeIds = selectedIds[folioId] || [];
    if (chargeIds.length === 0) { alert('Select at least one charge to split off'); return; }
    const companyName = prompt('Company name (leave blank if guest-paid split):') || '';
    await splitFolio(businessId, folioId, chargeIds, companyName ? 'company' : 'guest', companyName);
    setSelectedIds((prev) => ({ ...prev, [folioId]: [] }));
    reload();
  }

  if (folios.length === 0) return <p className="text-ivory-dim">Loading folio...</p>;

  return (
    <div className="space-y-6">
      <button onClick={onClose} className="text-sm text-brass hover:underline">← Back to reservations</button>
      {folios.map((folio) => (
        <FolioCard key={folio.id} businessId={businessId} folio={folio} selectedIds={selectedIds[folio.id] || []} onToggleCharge={(chargeId) => toggleCharge(folio.id, chargeId)} onSplit={() => handleSplit(folio.id)} onReload={reload} />
      ))}
    </div>
  );
}

function FolioCard({ businessId, folio, selectedIds, onToggleCharge, onSplit, onReload }: {
  businessId: string; folio: HotelFolio; selectedIds: string[]; onToggleCharge: (chargeId: string) => void; onSplit: () => void; onReload: () => void;
}) {
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');

  async function handleAddCharge(e: React.FormEvent) {
    e.preventDefault();
    if (!chargeDesc.trim() || !chargeAmount) return;
    await addFolioCharge(businessId, folio.id, { description: chargeDesc, amountAed: chargeAmount });
    setChargeDesc(''); setChargeAmount(0);
    onReload();
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentAmount) return;
    await recordFolioPayment(businessId, folio.id, paymentAmount);
    setPaymentAmount(0);
    onReload();
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!depositAmount) return;
    await recordFolioDeposit(businessId, folio.id, depositAmount);
    setDepositAmount(0);
    onReload();
  }

  async function handleRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!refundAmount || !refundReason.trim()) { alert('A reason is required for every refund'); return; }
    await recordFolioRefund(businessId, folio.id, refundAmount, refundReason);
    setRefundAmount(0); setRefundReason('');
    onReload();
  }

  return (
    <Section title={`${folio.is_primary ? 'Primary folio' : 'Split folio'} - ${folio.payer_type === 'company' ? `Company: ${folio.company_name}` : 'Guest'}${folio.status === 'closed' ? ' (closed)' : ''}`}>
      <div className="space-y-2">
        {folio.charges.map((c) => (
          <label key={c.id} className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2 text-ivory-dim">
              {folio.status === 'open' && <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => onToggleCharge(c.id)} className="accent-brass" />}
              {c.description} <span className="text-xs uppercase text-ivory-dim/60">({c.charge_type})</span>
            </span>
            <span className={c.amount_aed < 0 ? 'text-success' : 'text-ivory'}>{c.amount_aed < 0 ? '-' : ''}AED {Math.abs(c.amount_aed).toFixed(2)}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-between border-t border-ink-line pt-3 text-lg">
        <span className="text-ivory">Balance</span>
        <span className={folio.balance > 0 ? 'text-warning' : 'text-success'}>AED {folio.balance.toFixed(2)}</span>
      </div>

      {folio.status === 'open' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <form onSubmit={handleAddCharge} className="space-y-2 rounded-lg border border-ink-line p-3">
              <p className="text-sm text-ivory-dim">Add charge</p>
              <input value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} placeholder="Description" className={inputClass} />
              <input type="number" onFocus={(e) => e.target.select()} value={chargeAmount} onChange={(e) => setChargeAmount(Number(e.target.value))} placeholder="Amount AED" className={inputClass} />
              <button type="submit" className="w-full rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink">Add</button>
            </form>
            <form onSubmit={handleRecordPayment} className="space-y-2 rounded-lg border border-ink-line p-3">
              <p className="text-sm text-ivory-dim">Record payment</p>
              <input type="number" onFocus={(e) => e.target.select()} value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} placeholder="Amount AED" className={inputClass} />
              <button type="submit" className="w-full rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink">Record payment</button>
            </form>
            <form onSubmit={handleDeposit} className="space-y-2 rounded-lg border border-ink-line p-3">
              <p className="text-sm text-ivory-dim">Record deposit</p>
              <input type="number" onFocus={(e) => e.target.select()} value={depositAmount} onChange={(e) => setDepositAmount(Number(e.target.value))} placeholder="Amount AED" className={inputClass} />
              <button type="submit" className="w-full rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink">Record deposit</button>
            </form>
            <form onSubmit={handleRefund} className="space-y-2 rounded-lg border border-ink-line p-3">
              <p className="text-sm text-ivory-dim">Issue refund</p>
              <input type="number" onFocus={(e) => e.target.select()} value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value))} placeholder="Amount AED" className={inputClass} />
              <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason (required)" className={inputClass} />
              <button type="submit" className="w-full rounded-lg bg-danger/80 px-3 py-2 text-sm font-medium text-ink">Issue refund</button>
            </form>
          </div>
          <button onClick={onSplit} disabled={selectedIds.length === 0} className="rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-40">
            Split {selectedIds.length > 0 ? `${selectedIds.length} selected charge(s)` : 'selected charges'} into new folio
          </button>
        </>
      )}
    </Section>
  );
}
