import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listRooms, listHousekeepingTasks, createHousekeepingTask, updateHousekeepingTask,
  listMaintenanceTickets, createMaintenanceTicket, updateMaintenanceTicket,
  listGuestRequests, updateGuestRequest,
  type HousekeepingTask, type MaintenanceTicket, type GuestServiceRequest,
} from '../../lib/authApi';
import type { HotelRoom } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

export default function HousekeepingPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [tab, setTab] = useState<'housekeeping' | 'maintenance' | 'requests'>('housekeeping');

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">Housekeeping & Maintenance</h1>
      <div className="flex gap-2 border-b border-ink-line">
        {(['housekeeping', 'maintenance', 'requests'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-base capitalize ${tab === t ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}>
            {t === 'requests' ? 'Guest Requests' : t}
          </button>
        ))}
      </div>
      {tab === 'housekeeping' && <HousekeepingTab businessId={businessId} />}
      {tab === 'maintenance' && <MaintenanceTab businessId={businessId} />}
      {tab === 'requests' && <GuestRequestsTab businessId={businessId} />}
    </div>
  );
}

function HousekeepingTab({ businessId }: { businessId: string }) {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [taskType, setTaskType] = useState('cleaning');

  function reload() {
    listHousekeepingTasks(businessId).then(setTasks);
    listRooms(businessId).then(setRooms);
  }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    await createHousekeepingTask(businessId, { roomId, taskType });
    setShowAdd(false);
    reload();
  }

  async function handleStatus(taskId: string, status: 'pending' | 'in_progress' | 'done') {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await updateHousekeepingTask(businessId, taskId, status);
    } catch {
      reload();
    }
  }

  return (
    <Section title="Housekeeping Tasks" action={<button onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ New task</button>}>
      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label="Room">
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              <option value="">Select room...</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
            </select>
          </Field>
          <Field label="Task type">
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              <option value="cleaning">Cleaning</option>
              <option value="turndown">Turndown</option>
              <option value="inspection">Inspection</option>
              <option value="deep_clean">Deep clean</option>
            </select>
          </Field>
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Add</button>
        </form>
      )}
      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3">
            <div>
              <p className="text-base text-ivory">Room {t.hotel_rooms?.room_number} · {t.task_type.replace('_', ' ')}</p>
              <p className="text-sm text-ivory-dim">{t.status}</p>
            </div>
            {t.status !== 'done' && (
              <div className="flex gap-2">
                {t.status === 'pending' && <button onClick={() => handleStatus(t.id, 'in_progress')} className="text-sm text-brass hover:underline">Start</button>}
                <button onClick={() => handleStatus(t.id, 'done')} className="text-sm text-success hover:underline">Mark done</button>
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && <p className="text-ivory-dim">No housekeeping tasks.</p>}
      </div>
    </Section>
  );
}

function MaintenanceTab({ businessId }: { businessId: string }) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');

  function reload() { listMaintenanceTickets(businessId).then(setTickets); }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createMaintenanceTicket(businessId, { title, priority });
    setTitle(''); setShowAdd(false);
    reload();
  }

  async function handleStatus(ticketId: string, status: 'open' | 'in_progress' | 'resolved') {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
    try {
      await updateMaintenanceTicket(businessId, ticketId, { status });
    } catch {
      reload();
    }
  }

  const PRIORITY_COLOR: Record<string, string> = { low: 'text-ivory-dim', normal: 'text-ivory', high: 'text-warning', urgent: 'text-danger' };

  return (
    <Section title="Maintenance Tickets" action={<button onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ New ticket</button>}>
      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} /></Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </Field>
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Add</button>
        </form>
      )}
      <div className="space-y-2">
        {tickets.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3">
            <div>
              <p className="text-base text-ivory">{t.title}{t.hotel_rooms?.room_number && ` · Room ${t.hotel_rooms.room_number}`}</p>
              <p className={`text-sm ${PRIORITY_COLOR[t.priority]}`}>{t.priority} · {t.status}</p>
            </div>
            {t.status !== 'resolved' && (
              <div className="flex gap-2">
                {t.status === 'open' && <button onClick={() => handleStatus(t.id, 'in_progress')} className="text-sm text-brass hover:underline">Start</button>}
                <button onClick={() => handleStatus(t.id, 'resolved')} className="text-sm text-success hover:underline">Resolve</button>
              </div>
            )}
          </div>
        ))}
        {tickets.length === 0 && <p className="text-ivory-dim">No maintenance tickets.</p>}
      </div>
    </Section>
  );
}

function GuestRequestsTab({ businessId }: { businessId: string }) {
  const [requests, setRequests] = useState<GuestServiceRequest[]>([]);

  function reload() { listGuestRequests(businessId).then(setRequests); }
  useEffect(reload, [businessId]);

  async function handleStatus(requestId: string, status: 'pending' | 'in_progress' | 'done') {
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status } : r)));
    try {
      await updateGuestRequest(businessId, requestId, status);
    } catch {
      reload();
    }
  }

  return (
    <Section title="Guest Requests">
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3">
            <div>
              <p className="text-base text-ivory">Room {r.hotel_rooms?.room_number} · {r.request_type}</p>
              {r.note && <p className="text-sm text-ivory-dim">{r.note}</p>}
              <p className="text-sm text-ivory-dim">{r.status}</p>
            </div>
            {r.status !== 'done' && (
              <div className="flex gap-2">
                {r.status === 'pending' && <button onClick={() => handleStatus(r.id, 'in_progress')} className="text-sm text-brass hover:underline">Start</button>}
                <button onClick={() => handleStatus(r.id, 'done')} className="text-sm text-success hover:underline">Mark done</button>
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && <p className="text-ivory-dim">No guest requests.</p>}
      </div>
    </Section>
  );
}
