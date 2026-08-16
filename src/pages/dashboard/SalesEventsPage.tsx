import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listEventSpaces, createEventSpace, updateEventSpace, type HotelEventSpace,
  listEvents, getEvent, createEvent, updateEvent, addEventCharge, recordEventPayment, deleteEventCharge,
  getEventPipelineSummary, type HotelEvent, type HotelEventDetail, type EventPipelineSummary,
} from '../../lib/authApi';
import { Section, Field, inputClass } from '../../components/ui';

const EVENT_TYPES = ['wedding', 'conference', 'meeting', 'corporate', 'social', 'other'];
const STATUS_COLOR: Record<string, string> = {
  inquiry: 'text-ivory-dim', tentative: 'text-warning', confirmed: 'text-success', completed: 'text-brass', cancelled: 'text-danger',
};

export default function SalesEventsPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [tab, setTab] = useState<'events' | 'spaces'>('events');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  if (selectedEventId) {
    return <EventDetail businessId={businessId} eventId={selectedEventId} onBack={() => setSelectedEventId(null)} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">Sales & Events</h1>
      <div className="flex gap-2 border-b border-ink-line">
        {(['events', 'spaces'] as const).map((t) => (
          <button type="button" key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-base capitalize ${tab === t ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}>
            {t === 'spaces' ? 'Event Spaces' : 'Events'}
          </button>
        ))}
      </div>
      {tab === 'events' && <EventsTab businessId={businessId} onOpenEvent={setSelectedEventId} />}
      {tab === 'spaces' && <EventSpacesTab businessId={businessId} />}
    </div>
  );
}

function EventsTab({ businessId, onOpenEvent }: { businessId: string; onOpenEvent: (id: string) => void }) {
  const [events, setEvents] = useState<HotelEvent[]>([]);
  const [spaces, setSpaces] = useState<HotelEventSpace[]>([]);
  const [summary, setSummary] = useState<EventPipelineSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showNew, setShowNew] = useState(false);

  function reload() {
    listEvents(businessId, statusFilter ? { status: statusFilter } : undefined).then(setEvents);
    listEventSpaces(businessId).then(setSpaces);
    getEventPipelineSummary(businessId).then(setSummary);
  }
  useEffect(reload, [businessId, statusFilter]);

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {['inquiry', 'tentative', 'confirmed', 'completed', 'cancelled'].map((s) => (
            <button type="button" key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`rounded-lg border p-3 text-left ${statusFilter === s ? 'border-brass bg-brass/10' : 'border-ink-line'}`}>
              <p className={`text-xs uppercase tracking-wide ${STATUS_COLOR[s]}`}>{s}</p>
              <p className="text-xl text-ivory">{summary.byStatus[s] || 0}</p>
            </button>
          ))}
        </div>
      )}
      <Section title="Events (next 90 days)" action={
        <button type="button" onClick={() => setShowNew((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ New event</button>
      }>
        {showNew && <NewEventForm businessId={businessId} spaces={spaces} onDone={() => { setShowNew(false); reload(); }} />}
        <div className="space-y-2">
          {events.map((e) => (
            <button type="button" key={e.id} onClick={() => onOpenEvent(e.id)} className="block w-full rounded-lg border border-ink-line p-3 text-left transition-colors hover:border-brass/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base text-ivory">{e.client_name} <span className="text-sm text-ivory-dim capitalize">· {e.event_type}</span></p>
                  <p className="text-sm text-ivory-dim">
                    {e.event_date} · {e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}
                    {e.hotel_event_spaces?.name && ` · ${e.hotel_event_spaces.name}`}
                    {e.expected_attendance > 0 && ` · ${e.expected_attendance} guests`}
                  </p>
                </div>
                <span className={`text-sm capitalize ${STATUS_COLOR[e.status]}`}>{e.status}</span>
              </div>
            </button>
          ))}
          {events.length === 0 && <p className="text-ivory-dim">No events{statusFilter ? ` with status "${statusFilter}"` : ''}.</p>}
        </div>
      </Section>
    </div>
  );
}

function NewEventForm({ businessId, spaces, onDone }: { businessId: string; spaces: HotelEventSpace[]; onDone: () => void }) {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [eventType, setEventType] = useState('other');
  const [eventSpaceId, setEventSpaceId] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [expectedAttendance, setExpectedAttendance] = useState(0);
  const [status, setStatus] = useState('inquiry');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createEvent(businessId, {
        clientName: clientName.trim(), clientPhone, clientEmail, eventType,
        eventSpaceId: eventSpaceId || null, eventDate, startTime, endTime,
        expectedAttendance, status,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-brass/40 bg-ink-soft p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Client name"><input required value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} /></Field>
        <Field label="Phone"><input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputClass} /></Field>
        <Field label="Email"><input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputClass} /></Field>
        <Field label="Event type">
          <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputClass}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Space (optional)">
          <select value={eventSpaceId} onChange={(e) => setEventSpaceId(e.target.value)} className={inputClass}>
            <option value="">Not assigned yet</option>
            {spaces.map((s) => <option key={s.id} value={s.id}>{s.name} (cap. {s.capacity})</option>)}
          </select>
        </Field>
        <Field label="Expected attendance"><input type="number" min={0} value={expectedAttendance} onFocus={(e) => e.target.select()} onChange={(e) => setExpectedAttendance(Number(e.target.value))} className={inputClass} /></Field>
        <Field label="Date"><input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} /></Field>
        <Field label="Start time"><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} /></Field>
        <Field label="End time"><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} /></Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="inquiry">Inquiry</option>
            <option value="tentative">Tentative</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </Field>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
        {saving ? 'Creating...' : 'Create event'}
      </button>
    </form>
  );
}

function EventSpacesTab({ businessId }: { businessId: string }) {
  const [spaces, setSpaces] = useState<HotelEventSpace[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [description, setDescription] = useState('');

  function reload() {
    listEventSpaces(businessId).then(setSpaces);
  }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createEventSpace(businessId, { name: name.trim(), capacity, hourlyRateAed: hourlyRate, description });
    setName(''); setCapacity(0); setHourlyRate(0); setDescription(''); setShowAdd(false);
    reload();
  }

  return (
    <Section title="Event Spaces" action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ Add space</button>}>
      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Grand Ballroom" className={inputClass} /></Field>
          <Field label="Capacity"><input type="number" min={0} value={capacity} onFocus={(e) => e.target.select()} onChange={(e) => setCapacity(Number(e.target.value))} className={`${inputClass} w-24`} /></Field>
          <Field label="Rate (AED/hour)"><input type="number" min={0} value={hourlyRate} onFocus={(e) => e.target.select()} onChange={(e) => setHourlyRate(Number(e.target.value))} className={`${inputClass} w-32`} /></Field>
          <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></Field>
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Add</button>
        </form>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {spaces.map((s) => (
          <div key={s.id} className={`rounded-xl border p-4 ${s.active ? 'border-ink-line' : 'border-ink-line opacity-50'}`}>
            <div className="flex items-center justify-between">
              <p className="text-base text-ivory">{s.name}</p>
              <button type="button" onClick={() => updateEventSpace(businessId, s.id, { active: !s.active }).then(reload)} className="text-sm text-ivory-dim hover:text-ivory">
                {s.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
            <p className="text-sm text-ivory-dim">Capacity {s.capacity} · AED {s.hourly_rate_aed}/hour</p>
            {s.description && <p className="mt-1 text-sm text-ivory-dim">{s.description}</p>}
          </div>
        ))}
        {spaces.length === 0 && <p className="text-ivory-dim">No event spaces yet - add one above.</p>}
      </div>
    </Section>
  );
}

function EventDetail({ businessId, eventId, onBack }: { businessId: string; eventId: string; onBack: () => void }) {
  const [event, setEvent] = useState<HotelEventDetail | null>(null);
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState(0);
  const [chargeType, setChargeType] = useState('other');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [error, setError] = useState('');

  function reload() {
    getEvent(businessId, eventId).then(setEvent);
  }
  useEffect(reload, [businessId, eventId]);

  async function handleStatusChange(status: string) {
    setError('');
    try {
      await updateEvent(businessId, eventId, { status });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function handleAddCharge(e: React.FormEvent) {
    e.preventDefault();
    if (!chargeDesc.trim() || !chargeAmount) return;
    await addEventCharge(businessId, eventId, { description: chargeDesc, amountAed: chargeAmount, chargeType });
    setChargeDesc(''); setChargeAmount(0);
    reload();
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentAmount) return;
    await recordEventPayment(businessId, eventId, { amountAed: paymentAmount });
    setPaymentAmount(0);
    reload();
  }

  async function handleDeleteCharge(chargeId: string) {
    await deleteEventCharge(businessId, eventId, chargeId);
    reload();
  }

  if (!event) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="text-sm text-brass hover:underline">&larr; Back to events</button>

      <Section title={event.client_name}>
        <p className="text-sm text-ivory-dim">
          {event.event_date} · {event.start_time.slice(0, 5)}–{event.end_time.slice(0, 5)}
          {event.hotel_event_spaces?.name && ` · ${event.hotel_event_spaces.name}`}
          {event.expected_attendance > 0 && ` · ${event.expected_attendance} guests`}
        </p>
        <p className="text-sm text-ivory-dim">{[event.client_phone, event.client_email].filter(Boolean).join(' · ')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ivory-dim">Status:</span>
          {['inquiry', 'tentative', 'confirmed', 'completed', 'cancelled'].map((s) => (
            <button type="button" key={s} onClick={() => handleStatusChange(s)}
              className={`rounded-full border px-3 py-1 text-sm capitalize ${event.status === s ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim hover:text-ivory'}`}>
              {s}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between border-t border-ink-line pt-3 text-lg">
          <span className="text-ivory">Balance</span>
          <span className={event.balance > 0 ? 'text-warning' : 'text-success'}>AED {event.balance.toFixed(2)}</span>
        </div>
      </Section>

      <Section title="Charges & payments">
        <div className="space-y-2">
          {event.charges.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2 text-sm">
              <span className="text-ivory-dim">{c.description} <span className="text-xs uppercase text-ivory-dim/60">({c.charge_type})</span></span>
              <span className="flex items-center gap-2">
                <span className={c.amount_aed < 0 ? 'text-success' : 'text-ivory'}>{c.amount_aed < 0 ? '-' : ''}AED {Math.abs(c.amount_aed).toFixed(2)}</span>
                <button type="button" onClick={() => handleDeleteCharge(c.id)} className="text-xs text-danger hover:underline">Delete</button>
              </span>
            </div>
          ))}
          {event.charges.length === 0 && <p className="text-ivory-dim">No charges yet.</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <form onSubmit={handleAddCharge} className="space-y-2 rounded-lg border border-ink-line p-3">
            <p className="text-sm text-ivory-dim">Add charge</p>
            <input value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} placeholder="Description" className={inputClass} />
            <select value={chargeType} onChange={(e) => setChargeType(e.target.value)} className={inputClass}>
              <option value="venue">Venue rental</option>
              <option value="catering">Catering</option>
              <option value="av_equipment">AV equipment</option>
              <option value="service">Service charge</option>
              <option value="other">Other</option>
            </select>
            <input type="number" onFocus={(e) => e.target.select()} value={chargeAmount} onChange={(e) => setChargeAmount(Number(e.target.value))} placeholder="Amount AED" className={inputClass} />
            <button type="submit" className="w-full rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink">Add</button>
          </form>
          <form onSubmit={handlePayment} className="space-y-2 rounded-lg border border-ink-line p-3">
            <p className="text-sm text-ivory-dim">Record payment</p>
            <input type="number" onFocus={(e) => e.target.select()} value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} placeholder="Amount AED" className={inputClass} />
            <button type="submit" className="w-full rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink">Record payment</button>
          </form>
        </div>
      </Section>
    </div>
  );
}
