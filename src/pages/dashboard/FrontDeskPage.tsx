import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listRooms, createRoom, updateRoom, listGuests, createGuest, matchGuestByPhone, updateGuest, getGuestStayHistory, type GuestStayHistory,
  listReservations, createReservation,
  checkInReservation, checkOutReservation, cancelReservation, markReservationNoShow, modifyReservation, transferReservationRoom,
  getFoliosByReservation, addFolioCharge, deleteFolioCharge, recordFolioPayment, recordFolioDeposit, recordFolioRefund, splitFolio,
  recordFolioAdjustment, transferFolioCharge,
  listCards, updateCard, getTourismDirhamReport, type TourismDirhamCharge,
  listBookingGroups, createBookingGroup, updateBookingGroup, deleteBookingGroup,
  listCityLedgerEntries, settleCityLedgerEntry, type CityLedgerEntry,
} from '../../lib/authApi';
import type { HotelRoom, HotelGuest, HotelReservation, HotelFolio, Card, HotelBookingGroup } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

export default function FrontDeskPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [tab, setTab] = useState<'reservations' | 'rooms' | 'groups' | 'guests' | 'city-ledger' | 'tourism-dirham'>('reservations');
  const [openFolioForReservation, setOpenFolioForReservation] = useState<string | null>(null);

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  if (openFolioForReservation) {
    return <FolioView businessId={businessId} reservationId={openFolioForReservation} onClose={() => setOpenFolioForReservation(null)} />;
  }

  const tabLabels: Record<typeof tab, string> = {
    reservations: 'Reservations', rooms: 'Rooms', groups: 'Groups',
    guests: 'Guests', 'city-ledger': 'City Ledger', 'tourism-dirham': 'Tourism Dirham',
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">{t('Front Desk')}</h1>
      <div className="flex gap-2 border-b border-ink-line">
        {(['reservations', 'rooms', 'groups', 'guests', 'city-ledger', 'tourism-dirham'] as const).map((tabKey) => (
          <button type="button" key={tabKey} onClick={() => setTab(tabKey)} className={`px-2.5 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base ${tab === tabKey ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}>
            {t(tabLabels[tabKey])}
          </button>
        ))}
      </div>
      {tab === 'reservations' && <ReservationsTab businessId={businessId} onOpenFolio={setOpenFolioForReservation} />}
      {tab === 'rooms' && <RoomsTab businessId={businessId} />}
      {tab === 'groups' && <BookingGroupsTab businessId={businessId} />}
      {tab === 'guests' && <GuestsTab businessId={businessId} />}
      {tab === 'city-ledger' && <CityLedgerTab businessId={businessId} />}
      {tab === 'tourism-dirham' && <TourismDirhamTab businessId={businessId} />}
    </div>
  );
}

function ReservationsTab({ businessId, onOpenFolio }: { businessId: string; onOpenFolio: (id: string) => void }) {
  const { t } = useT();
  const confirm = useConfirm();
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

  async function handleNoShow(reservationId: string) {
    if (!(await confirm({ title: t('Mark as no-show?'), message: t('Mark this reservation as a no-show?'), confirmLabel: t('Mark no-show'), danger: true }))) return;
    try {
      await markReservationNoShow(businessId, reservationId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not mark no-show');
    }
  }

  async function handleExtendStay(reservationId: string, newCheckOutDate: string) {
    try {
      await modifyReservation(businessId, reservationId, { checkOutDate: newCheckOutDate });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update stay dates');
    }
  }

  async function handleTransferRoom(reservationId: string, newRoomId: string) {
    try {
      await transferReservationRoom(businessId, reservationId, newRoomId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not transfer room');
    }
  }

  const availableRooms = rooms.filter((r) => r.status === 'available');

  return (
    <Section title={t('Reservations')} action={
      <button type="button" onClick={() => setShowNew((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">{t('+ New reservation')}</button>
    }>
      {showNew && <NewReservationForm businessId={businessId} rooms={rooms} onDone={() => { setShowNew(false); reload(); }} />}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      <div className="space-y-2">
        {reservations.map((r) => (
          <div key={r.id} className="rounded-lg border border-ink-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base text-ivory">{r.hotel_guests?.name || t('Guest')} · {r.check_in_date} → {r.check_out_date}</p>
                <p className="text-sm text-ivory-dim">
                  {r.hotel_rooms?.room_number ? `${t('Room')} ${r.hotel_rooms.room_number}` : t('No room assigned')} · {r.adults} {r.adults === 1 ? t('adult') : t('adults')}
                  {r.children > 0 && `, ${r.children} ${r.children === 1 ? t('child') : t('children')}`} · AED {r.rate_aed}/night ·{' '}
                  <span className="text-brass">{r.status}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {r.status === 'confirmed' && (
                  <CheckInControl reservation={r} availableRooms={availableRooms} onCheckIn={handleCheckIn} onCancel={() => handleCancel(r.id)} onNoShow={() => handleNoShow(r.id)} />
                )}
                {r.status === 'checked_in' && (
                  <>
                    <button type="button" onClick={() => onOpenFolio(r.id)} className="text-sm text-brass hover:underline">{t('View folio')}</button>
                    <ExtendStayControl reservation={r} onExtend={handleExtendStay} />
                    <TransferRoomControl reservation={r} availableRooms={availableRooms} onTransfer={handleTransferRoom} />
                    <button type="button" onClick={() => handleCheckOut(r.id)} className="text-sm text-brass hover:underline">{t('Check out')}</button>
                  </>
                )}
                {r.status === 'checked_out' && <button type="button" onClick={() => onOpenFolio(r.id)} className="text-sm text-ivory-dim hover:underline">{t('View folio')}</button>}
                {r.status === 'no_show' && <span className="text-sm text-danger">{t('No-show')}</span>}
              </div>
            </div>
          </div>
        ))}
        {!loading && reservations.length === 0 && <p className="text-ivory-dim">{t('No reservations yet.')}</p>}
      </div>
    </Section>
  );
}

function CheckInControl({ reservation, availableRooms, onCheckIn, onCancel, onNoShow }: { reservation: HotelReservation; availableRooms: HotelRoom[]; onCheckIn: (id: string, roomId?: string) => void; onCancel: () => void; onNoShow: () => void }) {
  const { t } = useT();
  const [roomId, setRoomId] = useState(reservation.room_id || '');
  return (
    <div className="flex items-center gap-2">
      {!reservation.room_id && (
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory">
          <option value="">{t('Assign room...')}</option>
          {availableRooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
        </select>
      )}
      <button type="button" onClick={() => onCheckIn(reservation.id, roomId || undefined)} className="text-sm text-brass hover:underline">{t('Check in')}</button>
      <button type="button" onClick={onNoShow} className="text-sm text-warning hover:underline">{t('No-show')}</button>
      <button type="button" onClick={onCancel} className="text-sm text-danger hover:underline">{t('Cancel')}</button>
    </div>
  );
}

function ExtendStayControl({ reservation, onExtend }: { reservation: HotelReservation; onExtend: (id: string, newCheckOutDate: string) => void }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(reservation.check_out_date);
  if (!editing) {
    return <button type="button" onClick={() => setEditing(true)} className="text-sm text-brass hover:underline">{t('Extend/shorten stay')}</button>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-ink-line bg-ink px-2 py-1 text-xs text-ivory" />
      <button type="button" onClick={() => { onExtend(reservation.id, date); setEditing(false); }} className="text-xs text-brass hover:underline">{t('Save')}</button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-ivory-dim">{t('Cancel')}</button>
    </div>
  );
}

function TransferRoomControl({ reservation, availableRooms, onTransfer }: { reservation: HotelReservation; availableRooms: HotelRoom[]; onTransfer: (id: string, newRoomId: string) => void }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [newRoomId, setNewRoomId] = useState('');
  if (!editing) {
    return <button type="button" onClick={() => setEditing(true)} className="text-sm text-brass hover:underline">{t('Transfer room')}</button>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <select value={newRoomId} onChange={(e) => setNewRoomId(e.target.value)} className="rounded border border-ink-line bg-ink px-2 py-1 text-xs text-ivory">
        <option value="">{t('Move to...')}</option>
        {availableRooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
      </select>
      <button type="button" disabled={!newRoomId} onClick={() => { onTransfer(reservation.id, newRoomId); setEditing(false); setNewRoomId(''); }} className="text-xs text-brass hover:underline disabled:opacity-40">{t('Move')}</button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-ivory-dim">{t('Cancel')}</button>
    </div>
  );
}

function NewReservationForm({ businessId, rooms, onDone }: { businessId: string; rooms: HotelRoom[]; onDone: () => void }) {
  const { t } = useT();
  const [guests, setGuests] = useState<HotelGuest[]>([]);
  const [guestId, setGuestId] = useState('');
  const [groups, setGroups] = useState<HotelBookingGroup[]>([]);
  const [bookingGroupId, setBookingGroupId] = useState('');
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestIdType, setNewGuestIdType] = useState('');
  const [newGuestIdNumber, setNewGuestIdNumber] = useState('');
  const [newGuestNationality, setNewGuestNationality] = useState('');
  const [phoneMatches, setPhoneMatches] = useState<HotelGuest[]>([]);
  const [roomId, setRoomId] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [adults, setAdults] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { listGuests(businessId).then(setGuests); }, [businessId]);
  useEffect(() => { listBookingGroups(businessId).then(setGroups); }, [businessId]);

  // Real duplicate-prevention: as soon as a phone number that already
  // belongs to an existing guest is typed, offer to use that profile
  // instead - this is what stops a repeat guest's history from
  // fragmenting across a fresh blank record every visit, without
  // silently auto-merging anything (staff still choose).
  useEffect(() => {
    if (guestId || newGuestPhone.trim().length < 6) { setPhoneMatches([]); return; }
    const timer = setTimeout(() => {
      matchGuestByPhone(businessId, newGuestPhone.trim()).then(setPhoneMatches).catch(() => setPhoneMatches([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [businessId, newGuestPhone, guestId]);

  function useExistingGuest(guest: HotelGuest) {
    setGuestId(guest.id);
    setPhoneMatches([]);
    setNewGuestName(''); setNewGuestPhone('');
  }

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
        <Field label={t('Guest')}>
          <select value={guestId} onChange={(e) => setGuestId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
            <option value="">{t('New guest')}...</option>
            {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        {!guestId && (
          <>
            <Field label={t('New guest name')}><input value={newGuestName} onChange={(e) => setNewGuestName(e.target.value)} className={inputClass} /></Field>
            <Field label={t('Phone')}><input value={newGuestPhone} onChange={(e) => setNewGuestPhone(e.target.value)} className={inputClass} /></Field>
            {phoneMatches.length > 0 && (
              <div className="w-full rounded-lg border border-warning/40 bg-warning/5 p-3">
                <p className="text-sm text-warning">{t('Already a guest with this phone number:')}</p>
                {phoneMatches.map((g) => (
                  <button type="button" key={g.id} onClick={() => useExistingGuest(g)} className="mt-1 block text-sm text-brass hover:underline">
                    {t('Use')} {g.name}{g.vip ? ` (${t('VIP')})` : ''} {t('instead of creating a new profile')}
                  </button>
                ))}
              </div>
            )}
            {/* Optional at booking time - a fast walk-in check-in
                shouldn't be blocked on passport details, but they're here
                for hotels that do want to capture them up front. */}
            <Field label={t('ID type')}>
              <select value={newGuestIdType} onChange={(e) => setNewGuestIdType(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                <option value="">{t('Not captured')}</option>
                <option value="passport">{t('Passport')}</option>
                <option value="emirates_id">{t('Emirates ID')}</option>
                <option value="national_id">{t('National ID')}</option>
              </select>
            </Field>
            {newGuestIdType && (
              <>
                <Field label={t('ID number')}><input value={newGuestIdNumber} onChange={(e) => setNewGuestIdNumber(e.target.value)} className={inputClass} /></Field>
                <Field label={t('Nationality')}><input value={newGuestNationality} onChange={(e) => setNewGuestNationality(e.target.value)} className={inputClass} /></Field>
              </>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Field label={t('Check-in')}><input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
        <Field label={t('Check-out')}><input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
        <Field label={t('Adults')}><input type="number" min={1} onFocus={(e) => e.target.select()} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={`${inputClass} w-20`} /></Field>
        <Field label={t('Room (optional now)')}>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
            <option value="">{t('Assign later')}</option>
            {rooms.filter((r) => r.status === 'available').map((r) => (
              <option key={r.id} value={r.id}>{r.room_number}{r.cards?.[0] ? '' : ` ${t('(no stand connected)')}`}</option>
            ))}
          </select>
        </Field>
        {groups.length > 0 && (
          <Field label={t('Booking group (optional)')}>
            <select value={bookingGroupId} onChange={(e) => setBookingGroupId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              <option value="">{t('Not part of a group')}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.group_name}</option>)}
            </select>
          </Field>
        )}
      </div>
      {error && <p className="text-base text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
        {saving ? t('Creating...') : t('Create reservation')}
      </button>
    </form>
  );
}

function RoomsTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
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
    if (!(await confirm({ title: t('Disconnect stand?'), message: t('Disconnect this stand from the room? Tapping it will go back to the normal landing page until reconnected.'), confirmLabel: t('Disconnect'), danger: true }))) return;
    await updateCard(businessId, cardId, { roomId: null });
    reload();
  }

  const STATUS_COLOR: Record<string, string> = {
    available: 'border-success/50 text-success', occupied: 'border-brass text-brass',
    dirty: 'border-warning/50 text-warning', maintenance: 'border-ivory-dim/50 text-ivory-dim', out_of_order: 'border-danger/50 text-danger',
  };
  const STATUS_LABEL: Record<string, string> = {
    available: 'Available', occupied: 'Occupied', dirty: 'Dirty', maintenance: 'Maintenance', out_of_order: 'Out of order',
  };

  return (
    <Section title={t('Rooms')} action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">{t('+ Add room')}</button>}>
      {showAdd && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-ink-line p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('Room number')}><input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} required className={inputClass} /></Field>
            <Field label={t('Type')}><input value={roomType} onChange={(e) => setRoomType(e.target.value)} className={inputClass} /></Field>
            <Field label={t('Rate/night (AED)')}><input type="number" min={0} onFocus={(e) => e.target.select()} value={baseRate} onChange={(e) => setBaseRate(Number(e.target.value))} className={`${inputClass} w-32`} /></Field>
          </div>
          {/* Deliberately its own visually distinct row, not the 4th
              field quietly tucked at the end of a flat form - this is
              what actually makes orders, bills, and requests from this
              room's stand work at all, not a cosmetic extra. */}
          <div className="rounded-lg border border-brass/40 bg-ink-soft p-3">
            <Field label={t("Connect this room's NFC stand now")}>
              <select value={newRoomCardId} onChange={(e) => setNewRoomCardId(e.target.value)} className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                <option value="">{t("I'll connect it later from this list")}</option>
                {unassignedCards.map((c) => <option key={c.id} value={c.id}>{c.label || c.uid}</option>)}
              </select>
            </Field>
            <p className="mt-1.5 text-sm text-ivory-dim">
              {t("A room with no stand connected can't receive orders, bills, or requests until one is - you can always connect it later from the room card below, but doing it now saves a step.")}
            </p>
          </div>
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">{t('Add')}</button>
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
                <button type="button" onClick={() => setEditingRoomId(r.id)} className="text-xs text-brass hover:underline">{t('Edit')}</button>
              </div>
              <p className="text-sm">{t(STATUS_LABEL[r.status] || r.status)}</p>
              <p className="text-xs text-ivory-dim">{r.room_type} · AED {r.base_rate_aed}/night</p>

              {connectedCard ? (
                <div className="mt-2 flex items-center justify-between gap-1 border-t border-current/20 pt-2 text-xs">
                  <span className="text-ivory-dim">{t('Stand:')} {connectedCard.label || connectedCard.uid.slice(0, 6)}</span>
                  <button type="button" onClick={() => handleUnlink(connectedCard.id)} className="text-danger hover:underline">{t('Disconnect')}</button>
                </div>
              ) : linkingRoomId === r.id ? (
                <div className="mt-2 border-t border-current/20 pt-2">
                  <select
                    autoFocus
                    onChange={(e) => handleLink(r.id, e.target.value)}
                    defaultValue=""
                    className="w-full rounded border border-ink-line bg-ink px-1.5 py-1 text-xs text-ivory"
                  >
                    <option value="" disabled>{t('Select stand...')}</option>
                    {unassignedCards.map((c) => <option key={c.id} value={c.id}>{c.label || c.uid}</option>)}
                  </select>
                </div>
              ) : (
                <button type="button" onClick={() => setLinkingRoomId(r.id)} className="mt-2 w-full border-t border-current/20 pt-2 text-left text-xs text-brass hover:underline">
                  {t('Connect stand')}
                </button>
              )}
            </div>
          );
        })}
        {rooms.length === 0 && <p className="text-ivory-dim">{t('No rooms yet.')}</p>}
      </div>
    </Section>
  );
}

function RoomEditForm({ businessId, room, onDone, onCancel }: { businessId: string; room: HotelRoom; onDone: () => void; onCancel: () => void }) {
  const { t } = useT();
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
      <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder={t('Room number')} className="w-full rounded border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
      <input value={roomType} onChange={(e) => setRoomType(e.target.value)} placeholder={t('Type')} className="w-full rounded border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
      <input type="number" min={0} value={baseRate} onFocus={(e) => e.target.select()} onChange={(e) => setBaseRate(Number(e.target.value))} placeholder={t('Rate/night (AED)')} className="w-full rounded border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
      <select value={status} onChange={(e) => setStatus(e.target.value as HotelRoom['status'])} className="w-full rounded border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory">
        <option value="available">{t('Available')}</option>
        <option value="occupied">{t('Occupied')}</option>
        <option value="dirty">{t('Dirty')}</option>
        <option value="maintenance">{t('Maintenance')}</option>
        <option value="out_of_order">{t('Out of order')}</option>
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="flex-1 rounded bg-brass px-2 py-1.5 text-xs font-medium text-ink disabled:opacity-50">
          {saving ? t('Saving...') : t('Save')}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded border border-ink-line px-2 py-1.5 text-xs text-ivory-dim">
          {t('Cancel')}
        </button>
      </div>
    </div>
  );
}



function FolioView({ businessId, reservationId, onClose }: { businessId: string; reservationId: string; onClose: () => void }) {
  const { t } = useT();
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

  function selectAllCharges(folioId: string, allChargeIds: string[]) {
    setSelectedIds((prev) => {
      const current = prev[folioId] || [];
      // Toggles as a pair, not a one-way switch - already-all-selected
      // clears instead of doing nothing, so the same control works as
      // both Select All and Clear.
      const next = current.length === allChargeIds.length ? [] : allChargeIds;
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

  if (folios.length === 0) return <p className="text-ivory-dim">{t('Loading folio...')}</p>;

  return (
    <div className="space-y-6">
      <button type="button" onClick={onClose} className="text-sm text-brass hover:underline">{t('← Back to reservations')}</button>
      {folios.map((folio) => (
        <FolioCard
          key={folio.id} businessId={businessId} folio={folio} otherFolios={folios.filter((f) => f.id !== folio.id)}
          selectedIds={selectedIds[folio.id] || []} onToggleCharge={(chargeId) => toggleCharge(folio.id, chargeId)}
          onSelectAll={() => selectAllCharges(folio.id, folio.charges.map((c) => c.id))}
          onSplit={() => startSplit(folio.id)} onReload={reload}
          splitConfirmOpen={splittingFolioId === folio.id}
          onConfirmSplit={(companyName) => confirmSplit(folio.id, companyName)}
          onCancelSplit={() => setSplittingFolioId(null)}
        />
      ))}
    </div>
  );
}

function FolioCard({ businessId, folio, otherFolios, selectedIds, onToggleCharge, onSelectAll, onSplit, onReload, splitConfirmOpen, onConfirmSplit, onCancelSplit }: {
  businessId: string; folio: HotelFolio; otherFolios: HotelFolio[]; selectedIds: string[]; onToggleCharge: (chargeId: string) => void; onSelectAll: () => void; onSplit: () => void; onReload: () => void;
  splitConfirmOpen: boolean; onConfirmSplit: (companyName: string) => void; onCancelSplit: () => void;
}) {
  const { t } = useT();
  const confirm = useConfirm();
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

  async function handleDeleteCharge(chargeId: string) {
    if (!(await confirm({ title: t('Delete charge?'), message: t('Delete this charge? The guest will no longer be billed for it.'), confirmLabel: t('Delete'), danger: true }))) return;
    await deleteFolioCharge(businessId, folio.id, chargeId);
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

  const isSplit = !folio.is_primary;
  const payerLabel = folio.payer_type === 'company' ? `${t('Company ·')} ${folio.company_name}` : t('Guest');
  const statusBadge = folio.status === 'closed' ? { text: t('Closed'), cls: 'border-ink-line text-ivory-dim' }
    : folio.status === 'billed_to_account' ? { text: t('Billed to account'), cls: 'border-warning/50 text-warning' }
    : { text: t('Open'), cls: 'border-success/50 text-success' };

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-soft">
      {/* Header - a real ledger header with distinct badges, not one long
          concatenated string trying to say five things at once. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-line bg-ink px-5 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${isSplit ? 'border-brass/50 text-brass' : 'border-ivory-dim/30 text-ivory-dim'}`}>
            {isSplit ? t('Split folio') : t('Primary folio')}
          </span>
          <span className="font-display text-lg text-ivory">{payerLabel}</span>
          <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${statusBadge.cls}`}>
            {statusBadge.text}
          </span>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ivory-dim/60">{t('Balance')}</p>
          <p className={`font-mono text-2xl tabular-nums ${folio.balance > 0 ? 'text-warning' : 'text-success'}`}>AED {folio.balance.toFixed(2)}</p>
        </div>
      </div>

      <div className="p-5">
        {folio.status === 'billed_to_account' && (
          <p className="mb-3 text-sm text-warning">{t("This folio's balance was billed to")} {folio.company_name || t('the company account')} {t('at checkout - see City Ledger to track collection.')}</p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-ivory-dim/70">{t('Charges & payments')}</p>
          {folio.status === 'open' && folio.charges.length > 0 && (
            <button type="button" onClick={onSelectAll} className="text-xs text-brass hover:underline">
              {selectedIds.length === folio.charges.length ? t('Clear selection') : t('Select all')}
            </button>
          )}
        </div>
        <div className="mt-2 divide-y divide-ink-line rounded-lg border border-ink-line">
          {folio.charges.map((c) => (
            <div key={c.id} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2 text-ivory-dim">
                  {folio.status === 'open' && <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => onToggleCharge(c.id)} className="accent-brass" />}
                  <span className="text-ivory">{c.description}</span>
                  <span className="font-mono text-[10px] uppercase text-ivory-dim/60">{c.charge_type}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`font-mono tabular-nums ${c.amount_aed < 0 ? 'text-success' : 'text-ivory'}`}>{c.amount_aed < 0 ? '-' : ''}AED {Math.abs(c.amount_aed).toFixed(2)}</span>
                  {folio.status === 'open' && otherFolios.length > 0 && (
                    <button type="button" onClick={() => setTransferringChargeId(transferringChargeId === c.id ? null : c.id)} className="text-xs text-brass hover:underline">
                      {t('Transfer')}
                    </button>
                  )}
                  {folio.status === 'open' && (
                    <button type="button" onClick={() => handleDeleteCharge(c.id)} className="text-xs text-danger hover:underline">
                      {t('Delete')}
                    </button>
                  )}
                </span>
              </div>
              {transferringChargeId === c.id && (
                <div className="ml-6 mt-1.5 flex items-center gap-2">
                  <select
                    onChange={(e) => handleTransfer(c.id, e.target.value)}
                    defaultValue=""
                    className="rounded border border-ink-line bg-ink px-2 py-1 text-xs text-ivory"
                  >
                    <option value="" disabled>{t('Move to which folio...')}</option>
                    {otherFolios.map((f) => (
                      <option key={f.id} value={f.id}>{f.is_primary ? t('Primary folio') : f.payer_type === 'company' ? `${t('Company:')} ${f.company_name}` : t('Guest folio')}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
          {folio.charges.length === 0 && <p className="px-3 py-4 text-sm italic text-ivory-dim">{t('No charges yet.')}</p>}
        </div>

        {folio.status === 'open' && (
          <>
            <p className="mt-5 text-xs font-medium uppercase tracking-wide text-ivory-dim/70">{t('Actions')}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <form onSubmit={handleAddCharge} className="flex flex-col gap-2.5 rounded-xl border border-ink-line bg-ink p-4">
                <div>
                  <p className="text-sm font-medium text-ivory">{t('Add charge')}</p>
                  <p className="text-xs text-ivory-dim/70">{t('Bill the guest for something extra (room service, minibar, damage, etc.)')}</p>
                </div>
                <input value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} placeholder={t("What's it for?")} className={inputClass} />
                <input type="number" onFocus={(e) => e.target.select()} value={chargeAmount} onChange={(e) => setChargeAmount(Number(e.target.value))} placeholder={t('Amount AED')} className={`${inputClass} font-mono`} />
                <button type="submit" className="mt-auto w-full rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink">{t('Add charge')}</button>
              </form>
              <form onSubmit={handleRecordPayment} className="flex flex-col gap-2.5 rounded-xl border border-success/25 bg-ink p-4">
                <div>
                  <p className="text-sm font-medium text-ivory">{t('Record payment')}</p>
                  <p className="text-xs text-ivory-dim/70">{t('Log money already collected - cash, card machine, any method')}</p>
                </div>
                <input type="number" onFocus={(e) => e.target.select()} value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} placeholder={t('Amount AED')} className={`${inputClass} font-mono`} />
                <button type="submit" className="mt-auto w-full rounded-lg bg-success/80 px-3 py-2 text-sm font-medium text-ink">{t('Record payment')}</button>
              </form>
              <form onSubmit={handleDeposit} className="flex flex-col gap-2.5 rounded-xl border border-success/25 bg-ink p-4">
                <div>
                  <p className="text-sm font-medium text-ivory">{t('Record deposit')}</p>
                  <p className="text-xs text-ivory-dim/70">{t('Log an advance or security deposit held against the stay')}</p>
                </div>
                <input type="number" onFocus={(e) => e.target.select()} value={depositAmount} onChange={(e) => setDepositAmount(Number(e.target.value))} placeholder={t('Amount AED')} className={`${inputClass} font-mono`} />
                <button type="submit" className="mt-auto w-full rounded-lg bg-success/80 px-3 py-2 text-sm font-medium text-ink">{t('Record deposit')}</button>
              </form>
              <form onSubmit={handleRefund} className="flex flex-col gap-2.5 rounded-xl border border-danger/25 bg-ink p-4">
                <div>
                  <p className="text-sm font-medium text-ivory">{t('Issue refund')}</p>
                  <p className="text-xs text-ivory-dim/70">{t('Send money back to the guest - increases the balance owed')}</p>
                </div>
                <input type="number" onFocus={(e) => e.target.select()} value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value))} placeholder={t('Amount AED')} className={`${inputClass} font-mono`} />
                <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder={t('Reason (required)')} className={inputClass} />
                <button type="submit" className="mt-auto w-full rounded-lg bg-danger/80 px-3 py-2 text-sm font-medium text-ink">{t('Issue refund')}</button>
              </form>
              <form onSubmit={handleAdjustment} className="flex flex-col gap-2.5 rounded-xl border border-ink-line bg-ink p-4">
                <div>
                  <p className="text-sm font-medium text-ivory">{t('Manual adjustment')}</p>
                  <p className="text-xs text-ivory-dim/70">{t('Correct an error - positive adds to the balance, negative credits it')}</p>
                </div>
                <input type="number" onFocus={(e) => e.target.select()} value={adjustAmount} onChange={(e) => setAdjustAmount(Number(e.target.value))} placeholder={t('Amount AED (+/-)')} className={`${inputClass} font-mono`} />
                <input value={adjustDesc} onChange={(e) => setAdjustDesc(e.target.value)} placeholder={t('Description (required)')} className={inputClass} />
                <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder={t('Reason (required)')} className={inputClass} />
                <button type="submit" className="mt-auto w-full rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink">{t('Apply adjustment')}</button>
              </form>
            </div>
            <button type="button" onClick={onSplit} disabled={selectedIds.length === 0} className="mt-3 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-40">
              {t('Split')} {selectedIds.length > 0 ? `${selectedIds.length} ${t('selected charge(s)')}` : t('selected charges')} {t('into new folio')}
            </button>
            {splitConfirmOpen && (
              <div className="mt-2 space-y-2 rounded-lg border border-brass/40 bg-ink p-3">
                <p className="text-sm text-ivory">
                  {t('Moving')} {selectedIds.length} {selectedIds.length === 1 ? t('charge') : t('charges')} (<span className="font-mono">AED{' '}
                  {folio.charges.filter((c) => selectedIds.includes(c.id)).reduce((sum, c) => sum + c.amount_aed, 0).toFixed(2)}</span>) {t('into a new, separate folio.')}
                </p>
                <input
                  value={splitCompanyName}
                  onChange={(e) => setSplitCompanyName(e.target.value)}
                  placeholder={t('Company name (leave blank if this is guest-paid)')}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { onConfirmSplit(splitCompanyName); setSplitCompanyName(''); }} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">
                    {t('Confirm split')}
                  </button>
                  <button type="button" onClick={() => { onCancelSplit(); setSplitCompanyName(''); }} className="text-sm text-ivory-dim">
                    {t('Cancel')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GuestsTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [guests, setGuests] = useState<HotelGuest[]>([]);
  const [search, setSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  function reload() {
    listGuests(businessId, search || undefined).then(setGuests);
  }
  useEffect(reload, [businessId, search]);

  if (selectedGuestId) {
    const guest = guests.find((g) => g.id === selectedGuestId);
    if (guest) {
      return <GuestDetail businessId={businessId} guest={guest} onBack={() => setSelectedGuestId(null)} onSaved={(updated) => { setGuests((prev) => prev.map((g) => (g.id === updated.id ? updated : g))); }} />;
    }
  }

  return (
    <Section title={t('Guests')}>
      <input
        value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search by name...')}
        className="w-full max-w-sm rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {guests.map((g) => (
          <button type="button" key={g.id} onClick={() => setSelectedGuestId(g.id)} className="rounded-lg border border-ink-line p-3 text-left transition-colors hover:border-brass/40">
            <p className="text-base text-ivory">{g.name}{g.vip && <span className="ml-2 rounded-full border border-brass/40 px-2 py-0.5 text-xs text-brass">{t('VIP')}</span>}</p>
            <p className="text-sm text-ivory-dim">{[g.phone, g.email].filter(Boolean).join(' · ') || t('No contact details')}</p>
          </button>
        ))}
        {guests.length === 0 && <p className="text-ivory-dim">{t('No guests found.')}</p>}
      </div>
    </Section>
  );
}

function GuestDetail({ businessId, guest, onBack, onSaved }: { businessId: string; guest: HotelGuest; onBack: () => void; onSaved: (g: HotelGuest) => void }) {
  const { t } = useT();
  const [history, setHistory] = useState<GuestStayHistory | null>(null);
  const [vip, setVip] = useState(guest.vip);
  const [roomPreference, setRoomPreference] = useState(guest.room_preference);
  const [dietaryNotes, setDietaryNotes] = useState(guest.dietary_notes);
  const [notes, setNotes] = useState(guest.notes);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getGuestStayHistory(businessId, guest.id).then(setHistory); }, [businessId, guest.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateGuest(businessId, guest.id, { vip, roomPreference, dietaryNotes, notes });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="text-sm text-brass hover:underline">{t('← Back to guests')}</button>

      <Section title={guest.name}>
        <p className="text-sm text-ivory-dim">{[guest.phone, guest.email].filter(Boolean).join(' · ') || t('No contact details')}{guest.nationality && ` · ${guest.nationality}`}</p>
        {history && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Total stays')}</p>
              <p className="text-xl text-ivory">{history.totalStays}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Total nights')}</p>
              <p className="text-xl text-ivory">{history.totalNights}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Lifetime spend')}</p>
              <p className="text-xl text-brass">AED {history.lifetimeSpendAed.toFixed(2)}</p>
            </div>
          </div>
        )}
      </Section>

      <Section title={t('Preferences')}>
        <label className="flex items-center gap-2 text-sm text-ivory">
          <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} className="accent-brass" />
          {t('VIP guest')}
        </label>
        <Field label={t('Room preference')}><input value={roomPreference} onChange={(e) => setRoomPreference(e.target.value)} placeholder="e.g. High floor, away from elevator" className={inputClass} /></Field>
        <Field label={t('Dietary notes')}><input value={dietaryNotes} onChange={(e) => setDietaryNotes(e.target.value)} placeholder="e.g. Vegetarian, nut allergy" className={inputClass} /></Field>
        <Field label={t('General notes')}><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></Field>
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? t('Saving...') : t('Save preferences')}
        </button>
      </Section>

      <Section title={t('Stay history')}>
        <div className="space-y-2">
          {history?.stays.map((s) => (
            <div key={s.reservationId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2 text-sm">
              <span className="text-ivory">{s.checkInDate} → {s.checkOutDate} · {s.nights} {s.nights === 1 ? t('night') : t('nights')}{s.roomNumber ? ` · ${t('Room')} ${s.roomNumber}` : ''}</span>
              <span className="text-ivory-dim">{s.status.replace('_', ' ')}{s.status === 'checked_out' ? ` · AED ${s.spendAed.toFixed(2)}` : ''}</span>
            </div>
          ))}
          {history && history.stays.length === 0 && <p className="text-ivory-dim">{t('No past stays.')}</p>}
        </div>
      </Section>
    </div>
  );
}

function CityLedgerTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [filter, setFilter] = useState<'unpaid' | 'paid'>('unpaid');
  const [entries, setEntries] = useState<CityLedgerEntry[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [reference, setReference] = useState('');

  function reload() {
    listCityLedgerEntries(businessId, filter).then((r) => { setEntries(r.entries); setTotalOutstanding(r.totalOutstandingAed); });
  }
  useEffect(reload, [businessId, filter]);

  async function handleSettle(entryId: string) {
    await settleCityLedgerEntry(businessId, entryId, { paymentReference: reference });
    setSettlingId(null);
    setReference('');
    reload();
  }

  return (
    <Section title={t('City Ledger')} action={
      <div className="flex rounded-lg border border-ink-line">
        <button type="button" onClick={() => setFilter('unpaid')} className={`px-3 py-1.5 text-sm ${filter === 'unpaid' ? 'bg-brass text-ink' : 'text-ivory-dim'}`}>{t('Outstanding')}</button>
        <button type="button" onClick={() => setFilter('paid')} className={`px-3 py-1.5 text-sm ${filter === 'paid' ? 'bg-brass text-ink' : 'text-ivory-dim'}`}>{t('Settled')}</button>
      </div>
    }>
      <p className="text-sm text-ivory-dim">
        {t("Company-billed folios closed at checkout without payment - what's owed to you by corporate accounts, and what's already been collected.")}
      </p>
      {filter === 'unpaid' && (
        <div className="rounded-xl border border-brass/30 bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-wide text-brass">{t('Total outstanding')}</p>
          <p className="mt-1 font-display text-2xl text-ivory">AED {totalOutstanding.toFixed(2)}</p>
        </div>
      )}
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="rounded-lg border border-ink-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base text-ivory">{e.companyName}{e.guestName ? ` · ${e.guestName}` : ''}</p>
                <p className="text-sm text-ivory-dim">
                  {t('Billed')} {new Date(e.billedAt).toLocaleDateString('en-GB')}
                  {e.daysOutstanding != null && ` · ${e.daysOutstanding} ${e.daysOutstanding === 1 ? t('day') : t('days')} ${t('outstanding')}`}
                  {e.paidAt && ` · ${t('Settled')} ${new Date(e.paidAt).toLocaleDateString('en-GB')}${e.paymentReference ? ` ${t('(ref:')} ${e.paymentReference})` : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-brass">AED {e.amountAed.toFixed(2)}</span>
                {!e.paidAt && (
                  <button type="button" onClick={() => setSettlingId(settlingId === e.id ? null : e.id)} className="text-sm text-brass hover:underline">{t('Mark settled')}</button>
                )}
              </div>
            </div>
            {settlingId === e.id && (
              <div className="mt-2 flex items-center gap-2 border-t border-ink-line pt-2">
                <input value={reference} onChange={(ev) => setReference(ev.target.value)} placeholder={t('Payment reference (optional)')} className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory" />
                <button type="button" onClick={() => handleSettle(e.id)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">{t('Confirm')}</button>
              </div>
            )}
          </div>
        ))}
        {entries.length === 0 && <p className="text-ivory-dim">{filter === 'unpaid' ? t('Nothing outstanding.') : t('Nothing settled yet.')}</p>}
      </div>
    </Section>
  );
}

function TourismDirhamTab({ businessId }: { businessId: string }) {
  const { t } = useT();
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
      title={t('Tourism Dirham')}
      action={
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory" />
          <span className="text-sm text-ivory-dim">{t('to')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory" />
        </div>
      }
    >
      <p className="text-base text-ivory-dim">
        {t("Every Tourism Dirham fee charged at check-in, for DTCM reporting - collected automatically per room-night once a rate is set in Business Profile. Set to AED 0 there if this doesn't apply to you.")}
      </p>
      <div className="rounded-xl border border-brass/30 bg-ink-soft p-4">
        <p className="text-xs uppercase tracking-wide text-brass">{t('Total collected')}</p>
        <p className="mt-1 font-display text-2xl text-ivory">AED {total.toFixed(2)} <span className="text-base text-ivory-dim">({charges.length} {t('charges)')}</span></p>
      </div>
      <div className="space-y-2">
        {charges.map((c) => (
          <div key={c.id} className="flex items-center justify-between text-sm text-ivory-dim">
            <span>
              {c.hotel_folios?.hotel_reservations?.hotel_rooms?.room_number ? `${t('Room')} ${c.hotel_folios.hotel_reservations.hotel_rooms.room_number}` : c.description}
              {c.hotel_folios?.hotel_reservations?.hotel_guests?.name ? ` · ${c.hotel_folios.hotel_reservations.hotel_guests.name}` : ''}
            </span>
            <span>{new Date(c.created_at).toLocaleDateString('en-GB')}</span>
            <span className="text-ivory">AED {Number(c.amount_aed).toFixed(2)}</span>
          </div>
        ))}
        {charges.length === 0 && <p className="text-ivory-dim">{t('No Tourism Dirham charges in this range.')}</p>}
      </div>
    </Section>
  );
}

function BookingGroupsTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
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
    if (!(await confirm({ title: t('Delete group?'), message: `${t('Delete "')}${g.group_name}${t('"? Its reservations stay as they are, just no longer grouped together.')}`, confirmLabel: t('Delete'), danger: true }))) return;
    await deleteBookingGroup(businessId, g.id);
    reload();
  }

  return (
    <Section
      title={t('Booking Groups')}
      action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">{t('+ Add group')}</button>}
    >
      <p className="text-base text-ivory-dim">
        {t('A wedding party, a corporate block - link several reservations under one group so they can be tracked together. Create the group here, then pick it from "Booking group" when creating each reservation.')}
      </p>
      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label={t('Group name')}><input value={groupName} onChange={(e) => setGroupName(e.target.value)} required placeholder="Al Mansoori Wedding" className={inputClass} /></Field>
          <Field label={t('Contact name')}><input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} /></Field>
          <Field label={t('Contact phone')}><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} /></Field>
          <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            {saving ? t('Adding...') : t('Add')}
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
                  <span className="text-ivory-dim">{reservations.length} {reservations.length === 1 ? t('room') : t('rooms')}</span>
                  <button type="button" onClick={() => setEditingId(g.id)} className="text-brass hover:underline">{t('Edit')}</button>
                  <button type="button" onClick={() => handleDelete(g)} className="text-danger hover:underline">{t('Delete')}</button>
                </div>
              </div>
              {(g.contact_name || g.contact_phone) && (
                <p className="text-sm text-ivory-dim">{[g.contact_name, g.contact_phone].filter(Boolean).join(' · ')}</p>
              )}
              {reservations.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-ink-line pt-2 text-sm">
                  {reservations.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-ivory-dim">
                      <span>{r.hotel_guests?.name || t('Unassigned')} {r.hotel_rooms?.room_number ? `· ${t('Room')} ${r.hotel_rooms.room_number}` : ''}</span>
                      <span>{r.status.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <p className="text-ivory-dim">{t('No booking groups yet.')}</p>}
      </div>
    </Section>
  );
}

function BookingGroupEditForm({ businessId, group, onDone, onCancel }: {
  businessId: string; group: HotelBookingGroup; onDone: () => void; onCancel: () => void;
}) {
  const { t } = useT();
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
      <Field label={t('Group name')}><input value={groupName} onChange={(e) => setGroupName(e.target.value)} className={inputClass} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('Contact name')}><input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Contact phone')}><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Contact email')}><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} /></Field>
      </div>
      <Field label={t('Notes')}><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} /></Field>
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? t('Saving...') : t('Save changes')}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-ivory-dim">{t('Cancel')}</button>
      </div>
    </div>
  );
}
