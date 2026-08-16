import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listRooms, listHousekeepingTasks, createHousekeepingTask, updateHousekeepingTask, getHousekeepingPerformance,
  listMaintenanceTickets, createMaintenanceTicket, updateMaintenanceTicket, getMaintenancePerformance,
  listGuestRequests, updateGuestRequest,
  type HousekeepingTask, type MaintenanceTicket, type GuestServiceRequest, type HousekeepingPerformance, type MaintenancePerformance,
} from '../../lib/authApi';
import type { HotelRoom } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

const ROOM_STATUS_STYLE: Record<string, string> = {
  available: 'border-success/40 bg-success/5 text-success',
  occupied: 'border-ink-line bg-ink-soft/40 text-ivory-dim',
  dirty: 'border-warning/40 bg-warning/5 text-warning',
  maintenance: 'border-danger/40 bg-danger/5 text-danger',
  out_of_order: 'border-danger/60 bg-danger/10 text-danger',
};

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
          <button type="button" key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-base capitalize ${tab === t ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}>
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
  const [performance, setPerformance] = useState<HousekeepingPerformance | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [taskType, setTaskType] = useState('cleaning');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  function reload() {
    listHousekeepingTasks(businessId).then(setTasks);
    listRooms(businessId).then(setRooms);
    getHousekeepingPerformance(businessId, 7).then(setPerformance);
  }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    await createHousekeepingTask(businessId, { roomId, taskType, priority });
    setShowAdd(false);
    setPriority('normal');
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

  const roomCounts = rooms.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-6">
      <Section title="Room status">
        <div className="flex flex-wrap gap-3 text-sm text-ivory-dim">
          {Object.entries(roomCounts).map(([status, count]) => (
            <span key={status} className="capitalize">{count} {status.replace('_', ' ')}</span>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {rooms.map((r) => (
            <div key={r.id} className={`rounded-lg border px-2 py-3 text-center ${ROOM_STATUS_STYLE[r.status] || 'border-ink-line text-ivory-dim'}`}>
              <p className="text-base font-medium">{r.room_number}</p>
              <p className="text-[10px] uppercase tracking-wide">{r.status.replace('_', ' ')}</p>
            </div>
          ))}
          {rooms.length === 0 && <p className="text-ivory-dim">No rooms set up yet.</p>}
        </div>
      </Section>

      <Section title="Housekeeping Tasks" action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ New task</button>}>
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
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Add</button>
          </form>
        )}
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${t.priority === 'urgent' && t.status !== 'done' ? 'border-danger/40 bg-danger/5' : 'border-ink-line'}`}>
              <div>
                <p className="text-base text-ivory">
                  Room {t.hotel_rooms?.room_number} · {t.task_type.replace('_', ' ')}
                  {t.priority === 'urgent' && <span className="ml-2 rounded-full border border-danger/40 px-2 py-0.5 text-xs text-danger">Urgent</span>}
                </p>
                <p className="text-sm text-ivory-dim">{t.status.replace('_', ' ')}</p>
              </div>
              {t.status !== 'done' && (
                <div className="flex gap-2">
                  {t.status === 'pending' && <button type="button" onClick={() => handleStatus(t.id, 'in_progress')} className="text-sm text-brass hover:underline">Start</button>}
                  <button type="button" onClick={() => handleStatus(t.id, 'done')} className="text-sm text-success hover:underline">Mark done</button>
                </div>
              )}
            </div>
          ))}
          {tasks.length === 0 && <p className="text-ivory-dim">No housekeeping tasks.</p>}
        </div>
      </Section>

      {performance && performance.taskCount > 0 && (
        <Section title="Turnover performance (7 days)">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Tasks completed</p>
              <p className="text-xl text-ivory">{performance.completedCount} / {performance.taskCount}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Avg time in queue</p>
              <p className="text-xl text-ivory">{performance.avgQueueTimeMins != null ? `${performance.avgQueueTimeMins} min` : 'n/a'}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Avg clean time</p>
              <p className="text-xl text-brass">{performance.avgCleanTimeMins != null ? `${performance.avgCleanTimeMins} min` : 'n/a'}</p>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function MaintenanceTab({ businessId }: { businessId: string }) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [performance, setPerformance] = useState<MaintenancePerformance | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [roomId, setRoomId] = useState('');
  const [takeRoomOutOfService, setTakeRoomOutOfService] = useState(true);
  const [estimatedCost, setEstimatedCost] = useState('');

  function reload() {
    listMaintenanceTickets(businessId).then(setTickets);
    listRooms(businessId).then(setRooms);
    getMaintenancePerformance(businessId, 30).then(setPerformance);
  }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createMaintenanceTicket(businessId, {
      title, priority, roomId: roomId || null,
      takeRoomOutOfService: !!roomId && takeRoomOutOfService,
      estimatedCostAed: estimatedCost ? Number(estimatedCost) : null,
    });
    setTitle(''); setRoomId(''); setEstimatedCost(''); setShowAdd(false);
    reload();
  }

  async function handleStatus(ticketId: string, status: 'open' | 'in_progress' | 'resolved') {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
    try {
      await updateMaintenanceTicket(businessId, ticketId, { status });
      reload(); // room status may have changed (restored to 'dirty' on resolve) - refresh for real state
    } catch {
      reload();
    }
  }

  const PRIORITY_COLOR: Record<string, string> = { low: 'text-ivory-dim', normal: 'text-ivory', high: 'text-warning', urgent: 'text-danger' };

  return (
    <div className="space-y-6">
      <Section title="Maintenance Tickets" action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ New ticket</button>}>
        {showAdd && (
          <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-ink-line p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} /></Field>
              <Field label="Priority">
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                  <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </Field>
              <Field label="Room (optional)">
                <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                  <option value="">No specific room</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                </select>
              </Field>
              <Field label="Estimated cost (AED, optional)">
                <input type="number" min={0} value={estimatedCost} onFocus={(e) => e.target.select()} onChange={(e) => setEstimatedCost(e.target.value)} className={`${inputClass} w-32`} />
              </Field>
            </div>
            {roomId && (
              <label className="flex items-center gap-2 text-sm text-ivory">
                <input type="checkbox" checked={takeRoomOutOfService} onChange={(e) => setTakeRoomOutOfService(e.target.checked)} className="accent-brass" />
                Take this room out of service until resolved (blocks check-in - recommended)
              </label>
            )}
            <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Add</button>
          </form>
        )}
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3">
              <div>
                <p className="text-base text-ivory">
                  {t.title}{t.hotel_rooms?.room_number && ` · Room ${t.hotel_rooms.room_number}`}
                  {t.took_room_out_of_service && t.status !== 'resolved' && <span className="ml-2 rounded-full border border-danger/40 px-2 py-0.5 text-xs text-danger">Room out of service</span>}
                </p>
                <p className={`text-sm ${PRIORITY_COLOR[t.priority]}`}>
                  {t.priority} · {t.status}
                  {(t.estimated_cost_aed || t.actual_cost_aed) && ` · ${t.actual_cost_aed != null ? `AED ${t.actual_cost_aed} actual` : `AED ${t.estimated_cost_aed} estimated`}`}
                </p>
              </div>
              {t.status !== 'resolved' && (
                <div className="flex gap-2">
                  {t.status === 'open' && <button type="button" onClick={() => handleStatus(t.id, 'in_progress')} className="text-sm text-brass hover:underline">Start</button>}
                  <button type="button" onClick={() => handleStatus(t.id, 'resolved')} className="text-sm text-success hover:underline">Resolve</button>
                </div>
              )}
            </div>
          ))}
          {tickets.length === 0 && <p className="text-ivory-dim">No maintenance tickets.</p>}
        </div>
      </Section>

      {performance && performance.ticketCount > 0 && (
        <Section title="Maintenance performance (30 days)">
          {performance.urgentOpenCount > 0 && <p className="text-sm text-danger">{performance.urgentOpenCount} urgent ticket(s) still open.</p>}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Resolved</p>
              <p className="text-xl text-ivory">{performance.resolvedCount} / {performance.ticketCount}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Avg time to start</p>
              <p className="text-xl text-ivory">{performance.avgQueueTimeMins != null ? `${performance.avgQueueTimeMins} min` : 'n/a'}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Avg repair time</p>
              <p className="text-xl text-ivory">{performance.avgRepairTimeMins != null ? `${performance.avgRepairTimeMins} min` : 'n/a'}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Total cost</p>
              <p className="text-xl text-brass">AED {performance.totalActualCostAed.toFixed(2)}</p>
            </div>
          </div>
        </Section>
      )}
    </div>
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
                {r.status === 'pending' && <button type="button" onClick={() => handleStatus(r.id, 'in_progress')} className="text-sm text-brass hover:underline">Start</button>}
                <button type="button" onClick={() => handleStatus(r.id, 'done')} className="text-sm text-success hover:underline">Mark done</button>
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && <p className="text-ivory-dim">No guest requests.</p>}
      </div>
    </Section>
  );
}
