import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listRooms, createRoom, updateRoom, listGuests, createGuest, listReservations, createReservation,
  checkInReservation, checkOutReservation, cancelReservation,
  getFoliosByReservation, addFolioCharge, recordFolioPayment, recordFolioDeposit, recordFolioRefund, splitFolio,
  recordFolioAdjustment, transferFolioCharge,
  listCards, updateCard, getTourismDirhamReport, type TourismDirhamCharge,
  listBookingGroups, createBookingGroup, updateBookingGroup, deleteBookingGroup,
} from '../../lib/authApi';
import type { HotelRoom, HotelGuest, HotelReservation, HotelFolio, Card, HotelBookingGroup } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

export default function FrontDeskPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [tab, setTab] = useState<'reservations' | 'rooms' | 'groups' | 'tourism-dirham'>('reservations');
  const [openFolioForReservation, setOpenFolioForReservation] = useState<string | null>(null);

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  if (openFolioForReservation) {
    return <FolioView businessId={businessId} reservationId={openFolioForReservation} onClose={() => setOpenFolioForReservation(null)} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">Front Desk</h1>
      <div className="flex gap-2 border-b border-ink-line">
        {(['reservations', 'rooms', 'groups', 'tourism-dirham'] as const).map((t) => (
          <button type="button" key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-base capitalize ${tab === t ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}>
            {t === 'tourism-dirham' ? 'Tourism Dirham' : t}
          </button>
        ))}
      </div>
      {tab === 'reservations' && <ReservationsTab businessId={businessId} onOpenFolio={setOpenFolioForReservation} />}
      {tab === 'rooms' && <RoomsTab businessId={businessId} />}
      {tab === 'groups' && <BookingGroupsTab businessId={businessId} />}
      {tab === 'tourism-dirham' && <TourismDirhamTab businessId={businessId} />}
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
      <button type="button" onClick={() => setShowNew((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ New reservation</button>
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
                    <button type="button" onClick={() => onOpenFolio(r.id)} className="text-sm text-brass hover:underline">View folio</button>
                    <button type="button" onClick={() => handleCheckOut(r.id)} className="text-sm text-brass hover:underline">Check out</button>
                  </>
                )}
                {r.status === 'checked_out' && <button type="button" onClick={() => onOpenFolio(r.id)} className="text-sm text-ivory-dim hover:underline">View folio</button>}
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
      <button type="button" onClick={() => onCheckIn(reservation.id, roomId || undefined)} className="text-sm text-brass hover:underline">Check in</button>
      <button type="button" onClick={onCancel} className="text-sm text-danger hover:underline">Cancel</button>
    </div>
  );
}

function NewReservationForm({ businessId, rooms, onDone }: { businessId: string; rooms: HotelRoom[]; onDone: () => void }) {
  const [guests, setGuests] = useState<HotelGuest[]>([]);
  const [guestId, setGuestId] = useState('');
  const [groups, setGroups] = useState<HotelBookingGroup[]>([]);
  const [bookingGroupId, setBookingGroupId] = useState('');
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestIdType, setNewGuestIdType] = useState('');
  const [newGuestIdNumber, setNewGuestIdNumber] = useState('');
  const [newGuestNationality, setNewGuestNationality] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [adults, setAdults] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { listGuests(businessId).then(setGuests); }, [businessId]);
  useEffect(() => { listBookingGroups(businessId).then(setGroups); }, [businessId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let finalGuestId = guestId;
      if (!finalGuestId && newGuestName.trim()) {
        const guest = await createGuest(businessId, {
          name: newGuestName.trim(),
          phone: newGuestPhone,
          idDocumentType: newGuestIdType || undefined,
          idDocumentNumber: newGuestIdNumber || undefined,
          nationality: newGuestNationality || undefined,
        });
        finalGuestId = guest.id;
      }
      if (!finalGuestId) { setError('Select or add a guest'); setSaving(false); return; }
      await createReservation(businessId, { guestId: finalGuestId, roomId: roomId || null, checkInDate, checkOutDate, adults, bookingGroupId: bookingGroupId || null });
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
            {/* Optional at booking time - a fast walk-in check-in
                shouldn't be blocked on passport details, but they're here
                for hotels that do want to capture them up front. */}
            <Field label="ID type">
              <select value={newGuestIdType} onChange={(e) => setNewGuestIdType(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                <option value="">Not captured</option>
                <option value="passport">Passport</option>
                <option value="emirates_id">Emirates ID</option>
                <option value="national_id">National ID</option>
              </select>
            </Field>
            {newGuestIdType && (
              <>
                <Field label="ID number"><input value={newGuestIdNumber} onChange={(e) => setNewGuestIdNumber(e.target.value)} className={inputClass} /></Field>
                <Field label="Nationality"><input value={newGuestNationality} onChange={(e) => setNewGuestNationality(e.target.value)} className={inputClass} /></Field>
              </>
            )}
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
            {rooms.filter((r) => r.status === 'available').map((r) => (
              <option key={r.id} value={r.id}>{r.room_number}{r.cards?.[0] ? '' : ' (no stand connected)'}</option>
            ))}
          </select>
        </Field>
        {groups.length > 0 && (
          <Field label="Booking group (optional)">
            <select value={bookingGroupId} onChange={(e) => setBookingGroupId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              <option value="">Not part of a group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.group_name}</option>)}
            </select>
          </Field>
        )}
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
  const [cards, setCards] = useState<Card[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('standard');
  const [baseRate, setBaseRate] = useState(0);
  const [newRoomCardId, setNewRoomCardId] = useState('');
  const [linkingRoomId, setLinkingRoomId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  function reload() {
    listRooms(businessId).then(setRooms);
    listCards(businessId).then(setCards);
  }
  useEffect(reload, [businessId]);

  // Unassigned = active, not linked to any room, and not someone's admin
  // login card - the actual pool of physical stands available to connect.
  const unassignedCards = cards.filter((c) => c.status === 'active' && !c.linked_user_id && !rooms.some((r) => r.cards?.some((rc) => rc.id === c.id)));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!roomNumber.trim()) return;
    await createRoom(businessId, { roomNumber, roomType, baseRateAed: baseRate, cardId: newRoomCardId || undefined });
    setRoomNumber(''); setBaseRate(0); setNewRoomCardId(''); setShowAdd(false);
    reload();
  }

  async function handleLink(roomId: string, cardId: string) {
    if (!cardId) return;
    await updateCard(businessId, cardId, { roomId });
    setLinkingRoomId(null);
    reload();
  }

  async function handleUnlink(cardId: string) {
    if (!confirm('Disconnect this stand from the room? Tapping it will go back to the normal landing page until reconnected.')) return;
    await updateCard(businessId, cardId, { roomId: null });
    reload();
  }

  const STATUS_COLOR: Record<string, string> = {
    available: 'border-success/50 text-success', occupied: 'border-brass text-brass',
    dirty: 'border-warning/50 text-warning', maintenance: 'border-ivory-dim/50 text-ivory-dim', out_of_order: 'border-danger/50 text-danger',
  };

  return (
    <Section title="Rooms" action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ Add room</button>}>
      {showAdd && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-ink-line p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Room number"><input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} required className={inputClass} /></Field>
            <Field label="Type"><input value={roomType} onChange={(e) => setRoomType(e.target.value)} className={inputClass} /></Field>
            <Field label="Rate/night (AED)"><input type="number" min={0} onFocus={(e) => e.target.select()} value={baseRate} onChange={(e) => setBaseRate(Number(e.target.value))} className={`${inputClass} w-32`} /></Field>
          </div>
          {/* Deliberately its own visually distinct row, not the 4th
              field quietly tucked at the end of a flat form - this is
              what actually makes orders, bills, and requests from this
              room's stand work at all, not a cosmetic extra. */}
          <div className="rounded-lg border border-brass/40 bg-ink-soft p-3">
            <Field label="Connect this room's NFC stand now">
              <select value={newRoomCardId} onChange={(e) => setNewRoomCardId(e.target.value)} className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                <option value="">I'll connect it later from this list</option>
                {unassignedCards.map((c) => <option key={c.id} value={c.id}>{c.label || c.uid}</option>)}
              </select>
            </Field>
            <p className="mt-1.5 text-sm text-ivory-dim">
              A room with no stand connected can't receive orders, bills, or requests until one is - you can
              always connect it later from the room card below, but doing it now saves a step.
            </p>
          </div>
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Add</button>
        </form>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rooms.map((r) => {
          const connectedCard = r.cards?.[0];
          if (editingRoomId === r.id) {
            return <RoomEditForm key={r.id} businessId={businessId} room={r} onDone={() => { setEditingRoomId(null); reload(); }} onCancel={() => setEditingRoomId(null)} />;
          }
          return (
            <div key={r.id} className={`rounded-lg border p-3 ${STATUS_COLOR[r.status]}`}>
              <div className="flex items-start justify-between gap-1">
                <p className="text-base text-ivory">{r.room_number}</p>
                <button type="button" onClick={() => setEditingRoomId(r.id)} className="text-xs text-brass hover:underline">Edit</button>
              </div>
              <p className="text-sm capitalize">{r.status}</p>
              <p className="text-xs text-ivory-dim">{r.room_type} · AED {r.base_rate_aed}/night</p>

              {connectedCard ? (
                <div className="mt-2 flex items-center justify-between gap-1 border-t border-current/20 pt-2 text-xs">
                  <span className="text-ivory-dim">Stand: {connectedCard.label || connectedCard.uid.slice(0, 6)}</span>
                  <button type="button" onClick={() => handleUnlink(connectedCard.id)} className="text-danger hover:underline">Disconnect</button>
                </div>
              ) : linkingRoomId === r.id ? (
                <div className="mt-2 border-t border-current/20 pt-2">
                  <select
                    autoFocus
                    onChange={(e) => handleLink(r.id, e.target.value)}
                    defaultValue=""
                    className="w-full rounded border border-ink-line bg-ink px-1.5 py-1 text-xs text-ivory"
                  >
                    <option value="" disabled>Select stand...</option>
                    {unassignedCards.map((c) => <option key={c.id} value={c.id}>{c.label || c.uid}</option>)}
                  </select>
                </div>
              ) : (
                <button type="button" onClick={() => setLinkingRoomId(r.id)} className="mt-2 w-full border-t border-current/20 pt-2 text-left text-xs text-brass hover:underline">
                  + Connect stand
                </button>
              )}
            </div>
          );
        })}
        {rooms.length === 0 && <p className="text-ivory-dim">No rooms yet.</p>}
      </div>
    </Section>
  );
}

function RoomEditForm({ businessId, room, onDone, onCancel }: { businessId: string; room: HotelRoom; onDone: () => void; onCancel: () => void }) {
  const [roomNumber, setRoomNumber] = useState(room.room_number);
  const [roomType, setRoomType] = useState(room.room_type);
  const [baseRate, setBaseRate] = useState(room.base_rate_aed);
  const [status, setStatus] = useState(room.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await updateRoom(businessId, room.id, { roomNumber, roomType, baseRateAed: baseRate, status });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this room');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-brass/40 bg-ink-soft p-3">
      <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Room number" className="w-full rounded border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
      <input value={roomType} onChange={(e) => setRoomType(e.target.value)} placeholder="Type" className="w-full rounded border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
      <input type="number" min={0} value={baseRate} onFocus={(e) => e.target.select()} onChange={(e) => setBaseRate(Number(e.target.value))} placeholder="Rate/night" className="w-full rounded border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
      <select value={status} onChange={(e) => setStatus(e.target.value as HotelRoom['status'])} className="w-full rounded border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory">
        <option value="available">Available</option>
        <option value="occupied">Occupied</option>
        <option value="dirty">Dirty</option>
        <option value="maintenance">Maintenance</option>
        <option value="out_of_order">Out of order</option>
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="flex-1 rounded bg-brass px-2 py-1.5 text-xs font-medium text-ink disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded border border-ink-line px-2 py-1.5 text-xs text-ivory-dim">
          Cancel
        </button>
      </div>
    </div>
  );
}



function FolioView({ businessId, reservationId, onClose }: { businessId: string; reservationId: string; onClose: () => void }) {
  const [folios, setFolios] = useState<HotelFolio[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, string[]>>({});
  // Which folio's split confirmation is currently open, if any - a
  // real, cancelable step now, not an immediate-commit prompt().
  const [splittingFolioId, setSplittingFolioId] = useState<string | null>(null);

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

  function startSplit(folioId: string) {
    if ((selectedIds[folioId] || []).length === 0) { alert('Select at least one charge to split off'); return; }
    setSplittingFolioId(folioId);
  }

  async function confirmSplit(folioId: string, companyName: string) {
    const chargeIds = selectedIds[folioId] || [];
    await splitFolio(businessId, folioId, chargeIds, companyName.trim() ? 'company' : 'guest', companyName.trim());
    setSelectedIds((prev) => ({ ...prev, [folioId]: [] }));
    setSplittingFolioId(null);
    reload();
  }

  if (folios.length === 0) return <p className="text-ivory-dim">Loading folio...</p>;

  return (
    <div className="space-y-6">
      <button type="button" onClick={onClose} className="text-sm text-brass hover:underline">← Back to reservations</button>
      <div className="rounded-lg border border-brass/30 bg-ink-soft p-4 text-sm text-ivory-dim">
        <p className="text-ivory">What is a folio?</p>
        <p className="mt-1">
          A guest's running bill for their whole stay - every charge (room rate, room service, minibar, spa, etc.)
          and every payment or deposit lands here as it happens. "Add Charge" logs something new they owe; use
          Split if part of the bill (e.g. a company-paid portion) needs to be billed separately. It settles
          automatically at checkout.
        </p>
      </div>
      {folios.map((folio) => (
        <FolioCard
          key={folio.id} businessId={businessId} folio={folio} otherFolios={folios.filter((f) => f.id !== folio.id)}
          selectedIds={selectedIds[folio.id] || []} onToggleCharge={(chargeId) => toggleCharge(folio.id, chargeId)}
          onSplit={() => startSplit(folio.id)} onReload={reload}
          splitConfirmOpen={splittingFolioId === folio.id}
          onConfirmSplit={(companyName) => confirmSplit(folio.id, companyName)}
          onCancelSplit={() => setSplittingFolioId(null)}
        />
      ))}
    </div>
  );
}

function FolioCard({ businessId, folio, otherFolios, selectedIds, onToggleCharge, onSplit, onReload, splitConfirmOpen, onConfirmSplit, onCancelSplit }: {
  businessId: string; folio: HotelFolio; otherFolios: HotelFolio[]; selectedIds: string[]; onToggleCharge: (chargeId: string) => void; onSplit: () => void; onReload: () => void;
  splitConfirmOpen: boolean; onConfirmSplit: (companyName: string) => void; onCancelSplit: () => void;
}) {
  const [splitCompanyName, setSplitCompanyName] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustDesc, setAdjustDesc] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [transferringChargeId, setTransferringChargeId] = useState<string | null>(null);

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

  async function handleAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustAmount || !adjustDesc.trim() || !adjustReason.trim()) { alert('Description and reason are both required for an adjustment'); return; }
    await recordFolioAdjustment(businessId, folio.id, adjustAmount, adjustDesc, adjustReason);
    setAdjustAmount(0); setAdjustDesc(''); setAdjustReason('');
    onReload();
  }

  async function handleTransfer(chargeId: string, toFolioId: string) {
    if (!toFolioId) return;
    await transferFolioCharge(businessId, folio.id, chargeId, toFolioId);
    setTransferringChargeId(null);
    onReload();
  }

  return (
    <Section title={`${folio.is_primary ? 'Primary folio' : 'Split folio'} - ${folio.payer_type === 'company' ? `Company: ${folio.company_name}` : 'Guest'}${folio.status === 'closed' ? ' (closed)' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-ivory-dim/70">Charges &amp; payments</p>
      <div className="space-y-2">
        {folio.charges.map((c) => (
          <div key={c.id}>
            <label className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2 text-ivory-dim">
                {folio.status === 'open' && <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => onToggleCharge(c.id)} className="accent-brass" />}
                {c.description} <span className="text-xs uppercase text-ivory-dim/60">({c.charge_type})</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={c.amount_aed < 0 ? 'text-success' : 'text-ivory'}>{c.amount_aed < 0 ? '-' : ''}AED {Math.abs(c.amount_aed).toFixed(2)}</span>
                {folio.status === 'open' && otherFolios.length > 0 && (
                  <button type="button" onClick={() => setTransferringChargeId(transferringChargeId === c.id ? null : c.id)} className="text-xs text-brass hover:underline">
                    Transfer
                  </button>
                )}
              </span>
            </label>
            {transferringChargeId === c.id && (
              <div className="ml-6 mt-1 flex items-center gap-2">
                <select
                  onChange={(e) => handleTransfer(c.id, e.target.value)}
                  defaultValue=""
                  className="rounded border border-ink-line bg-ink px-2 py-1 text-xs text-ivory"
                >
                  <option value="" disabled>Move to which folio...</option>
                  {otherFolios.map((f) => (
                    <option key={f.id} value={f.id}>{f.is_primary ? 'Primary folio' : f.payer_type === 'company' ? `Company: ${f.company_name}` : 'Guest folio'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
        {folio.charges.length === 0 && <p className="text-sm italic text-ivory-dim">No charges yet.</p>}
      </div>
      <div className="flex justify-between border-t border-ink-line pt-3 text-lg">
        <span className="text-ivory">Balance</span>
        <span className={folio.balance > 0 ? 'text-warning' : 'text-success'}>AED {folio.balance.toFixed(2)}</span>
      </div>

      {folio.status === 'open' && (
        <>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ivory-dim/70">Actions</p>
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
            <form onSubmit={handleAdjustment} className="space-y-2 rounded-lg border border-ink-line p-3">
              <p className="text-sm text-ivory-dim">Manual adjustment (+/-)</p>
              <input type="number" onFocus={(e) => e.target.select()} value={adjustAmount} onChange={(e) => setAdjustAmount(Number(e.target.value))} placeholder="Amount AED - negative to credit" className={inputClass} />
              <input value={adjustDesc} onChange={(e) => setAdjustDesc(e.target.value)} placeholder="Description (required)" className={inputClass} />
              <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Reason (required)" className={inputClass} />
              <button type="submit" className="w-full rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink">Apply adjustment</button>
            </form>
          </div>
          <button type="button" onClick={onSplit} disabled={selectedIds.length === 0} className="rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-40">
            Split {selectedIds.length > 0 ? `${selectedIds.length} selected charge(s)` : 'selected charges'} into new folio
          </button>
          {splitConfirmOpen && (
            <div className="space-y-2 rounded-lg border border-brass/40 bg-ink-soft p-3">
              <p className="text-sm text-ivory">
                Moving {selectedIds.length} charge{selectedIds.length === 1 ? '' : 's'} (AED{' '}
                {folio.charges.filter((c) => selectedIds.includes(c.id)).reduce((sum, c) => sum + c.amount_aed, 0).toFixed(2)}) into a new, separate folio.
              </p>
              <input
                value={splitCompanyName}
                onChange={(e) => setSplitCompanyName(e.target.value)}
                placeholder="Company name (leave blank if this is guest-paid)"
                className={inputClass}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => { onConfirmSplit(splitCompanyName); setSplitCompanyName(''); }} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">
                  Confirm split
                </button>
                <button type="button" onClick={() => { onCancelSplit(); setSplitCompanyName(''); }} className="text-sm text-ivory-dim">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function TourismDirhamTab({ businessId }: { businessId: string }) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // first of this month - the natural default range for a DTCM-style report
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [charges, setCharges] = useState<TourismDirhamCharge[]>([]);
  const [total, setTotal] = useState(0);

  function reload() {
    getTourismDirhamReport(businessId, { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }).then((r) => {
      setCharges(r.charges);
      setTotal(r.total);
    });
  }
  useEffect(reload, [businessId, from, to]);

  return (
    <Section
      title="Tourism Dirham"
      action={
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory" />
          <span className="text-sm text-ivory-dim">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory" />
        </div>
      }
    >
      <p className="text-base text-ivory-dim">
        Every Tourism Dirham fee charged at check-in, for DTCM reporting - collected automatically per room-night
        once a rate is set in Business Profile. Set to AED 0 there if this doesn't apply to you.
      </p>
      <div className="rounded-xl border border-brass/30 bg-ink-soft p-4">
        <p className="text-xs uppercase tracking-wide text-brass">Total collected</p>
        <p className="mt-1 font-display text-2xl text-ivory">AED {total.toFixed(2)} <span className="text-base text-ivory-dim">({charges.length} charges)</span></p>
      </div>
      <div className="space-y-2">
        {charges.map((c) => (
          <div key={c.id} className="flex items-center justify-between text-sm text-ivory-dim">
            <span>
              {c.hotel_folios?.hotel_reservations?.hotel_rooms?.room_number ? `Room ${c.hotel_folios.hotel_reservations.hotel_rooms.room_number}` : c.description}
              {c.hotel_folios?.hotel_reservations?.hotel_guests?.name ? ` · ${c.hotel_folios.hotel_reservations.hotel_guests.name}` : ''}
            </span>
            <span>{new Date(c.created_at).toLocaleDateString('en-GB')}</span>
            <span className="text-ivory">AED {Number(c.amount_aed).toFixed(2)}</span>
          </div>
        ))}
        {charges.length === 0 && <p className="text-ivory-dim">No Tourism Dirham charges in this range.</p>}
      </div>
    </Section>
  );
}

function BookingGroupsTab({ businessId }: { businessId: string }) {
  const [groups, setGroups] = useState<HotelBookingGroup[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reload() { listBookingGroups(businessId).then(setGroups); }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setSaving(true);
    try {
      await createBookingGroup(businessId, { groupName: groupName.trim(), contactName, contactPhone });
      setGroupName(''); setContactName(''); setContactPhone(''); setShowAdd(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(g: HotelBookingGroup) {
    if (!confirm(`Delete "${g.group_name}"? Its reservations stay as they are, just no longer grouped together.`)) return;
    await deleteBookingGroup(businessId, g.id);
    reload();
  }

  return (
    <Section
      title="Booking Groups"
      action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ Add group</button>}
    >
      <p className="text-base text-ivory-dim">
        A wedding party, a corporate block - link several reservations under one group so they can be tracked
        together. Create the group here, then pick it from "Booking group" when creating each reservation.
      </p>
      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label="Group name"><input value={groupName} onChange={(e) => setGroupName(e.target.value)} required placeholder="Al Mansoori Wedding" className={inputClass} /></Field>
          <Field label="Contact name"><input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} /></Field>
          <Field label="Contact phone"><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} /></Field>
          <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add'}
          </button>
        </form>
      )}
      <div className="space-y-3">
        {groups.map((g) => {
          if (editingId === g.id) {
            return <BookingGroupEditForm key={g.id} businessId={businessId} group={g} onDone={() => { setEditingId(null); reload(); }} onCancel={() => setEditingId(null)} />;
          }
          const reservations = g.hotel_reservations || [];
          return (
            <div key={g.id} className="rounded-lg border border-ink-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base text-ivory">{g.group_name}</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-ivory-dim">{reservations.length} room{reservations.length === 1 ? '' : 's'}</span>
                  <button type="button" onClick={() => setEditingId(g.id)} className="text-brass hover:underline">Edit</button>
                  <button type="button" onClick={() => handleDelete(g)} className="text-danger hover:underline">Delete</button>
                </div>
              </div>
              {(g.contact_name || g.contact_phone) && (
                <p className="text-sm text-ivory-dim">{[g.contact_name, g.contact_phone].filter(Boolean).join(' · ')}</p>
              )}
              {reservations.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-ink-line pt-2 text-sm">
                  {reservations.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-ivory-dim">
                      <span>{r.hotel_guests?.name || 'Unassigned'} {r.hotel_rooms?.room_number ? `· Room ${r.hotel_rooms.room_number}` : ''}</span>
                      <span className="capitalize">{r.status.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <p className="text-ivory-dim">No booking groups yet.</p>}
      </div>
    </Section>
  );
}

function BookingGroupEditForm({ businessId, group, onDone, onCancel }: {
  businessId: string; group: HotelBookingGroup; onDone: () => void; onCancel: () => void;
}) {
  const [groupName, setGroupName] = useState(group.group_name);
  const [contactName, setContactName] = useState(group.contact_name || '');
  const [contactPhone, setContactPhone] = useState(group.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(group.contact_email || '');
  const [notes, setNotes] = useState(group.notes || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBookingGroup(businessId, group.id, { groupName, contactName, contactPhone, contactEmail, notes });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-brass/40 bg-ink-soft p-4">
      <Field label="Group name"><input value={groupName} onChange={(e) => setGroupName(e.target.value)} className={inputClass} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Contact name"><input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} /></Field>
        <Field label="Contact phone"><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} /></Field>
        <Field label="Contact email"><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} /></Field>
      </div>
      <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} /></Field>
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-ivory-dim">Cancel</button>
      </div>
    </div>
  );
}
