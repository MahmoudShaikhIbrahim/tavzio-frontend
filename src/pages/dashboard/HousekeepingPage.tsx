import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listRooms, listHousekeepingTasks, createHousekeepingTask, updateHousekeepingTask, getHousekeepingPerformance,
  listMaintenanceTickets, createMaintenanceTicket, updateMaintenanceTicket, getMaintenancePerformance,
  listGuestRequests, updateGuestRequest,
  type HousekeepingTask, type MaintenanceTicket, type GuestServiceRequest, type HousekeepingPerformance, type MaintenancePerformance,
} from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import type { HotelRoom } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

const ROOM_STATUS_STYLE: Record<string, string> = {
  available: 'border-success/40 bg-success/5 text-success',
  occupied: 'border-ink-line bg-ink-soft/40 text-ivory-dim',
  dirty: 'border-warning/40 bg-warning/5 text-warning',
  maintenance: 'border-danger/40 bg-danger/5 text-danger',
  out_of_order: 'border-danger/60 bg-danger/10 text-danger',
};

// Underlying DB values stay snake_case/English - this only translates
// what's actually shown to a person. Replaces every underscore, not
// just the first (the original .replace('_', ' ') here only handled
// one, which silently produced "out of_order" for a status with two
// underscores - harmless in English since it still reads fine, but it
// would never have matched a translation dictionary key correctly).
function statusWord(t: (text: string) => string, raw: string) {
  return t(raw.replace(/_/g, ' '));
}

export default function HousekeepingPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [tab, setTab] = useState<'housekeeping' | 'maintenance' | 'requests'>('housekeeping');

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">{t('Housekeeping & Maintenance')}</h1>
      <div className="flex gap-2 border-b border-ink-line">
        {(['housekeeping', 'maintenance', 'requests'] as const).map((tabKey) => (
          <button type="button" key={tabKey} onClick={() => setTab(tabKey)} className={`px-2.5 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base capitalize ${tab === tabKey ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
            {tabKey === 'requests' ? t('Guest Requests') : t(tabKey)}
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
  const { t } = useT();
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [performance, setPerformance] = useState<HousekeepingPerformance | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [taskType, setTaskType] = useState('cleaning');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  function reload() {
    listHousekeepingTasks(businessId).then(setTasks).catch(() => {});
    listRooms(businessId).then(setRooms).catch(() => {});
    getHousekeepingPerformance(businessId, 7).then(setPerformance).catch(() => {});
  }
  useEffect(reload, [businessId]);
  usePollingFallback(reload, !!businessId);
  useEffect(() => {
    const unsubTasks = subscribeToBusinessTable(businessId, 'housekeeping_tasks', reload);
    return unsubTasks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    await createHousekeepingTask(businessId, { roomId, taskType, priority });
    setShowAdd(false);
    setPriority('normal');
    reload();
  }

  async function handleStatus(taskId: string, status: 'pending' | 'in_progress' | 'done') {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));
    try {
      await updateHousekeepingTask(businessId, taskId, status);
    } catch {
      reload();
    }
  }

  const roomCounts = rooms.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-6">
      <Section title={t('Room status')}>
        <div className="flex flex-wrap gap-3 text-sm text-ivory-dim">
          {Object.entries(roomCounts).map(([status, count]) => (
            <span key={status} className="capitalize">{count} {statusWord(t, status)}</span>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {rooms.map((r) => (
            <div key={r.id} className={`rounded-lg border px-2 py-3 text-center ${ROOM_STATUS_STYLE[r.status] || 'border-ink-line text-ivory-dim'}`}>
              <p className="text-base font-medium">{r.room_number}</p>
              <p className="text-[10px] uppercase tracking-wide">{statusWord(t, r.status)}</p>
            </div>
          ))}
          {rooms.length === 0 && <p className="text-ivory-dim">{t('No rooms set up yet.')}</p>}
        </div>
      </Section>

      <Section title={t('Housekeeping Tasks')} action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('+ New task')}</button>}>
        {showAdd && (
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
            <Field label={t('Room')}>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                <option value="">{t('Select room...')}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
              </select>
            </Field>
            <Field label={t('Task type')}>
              <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                <option value="cleaning">{t('Cleaning')}</option>
                <option value="turndown">{t('Turndown')}</option>
                <option value="inspection">{t('Inspection')}</option>
                <option value="deep_clean">{t('Deep clean')}</option>
              </select>
            </Field>
            <Field label={t('Priority')}>
              <select value={priority} onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                <option value="normal">{t('Normal')}</option>
                <option value="urgent">{t('Urgent')}</option>
              </select>
            </Field>
            <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Add')}</button>
          </form>
        )}
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${task.priority === 'urgent' && task.status !== 'done' ? 'border-danger/40 bg-danger/5' : 'border-ink-line'}`}>
              <div>
                <p className="text-base text-ivory">
                  {t('Room')} {task.hotel_rooms?.room_number} · {statusWord(t, task.task_type)}
                  {task.priority === 'urgent' && <span className="ml-2 rounded-full border border-danger/40 px-2 py-0.5 text-xs text-danger">{t('Urgent')}</span>}
                </p>
                <p className="text-sm text-ivory-dim">{statusWord(t, task.status)}</p>
              </div>
              {task.status !== 'done' && (
                <div className="flex gap-2">
                  {task.status === 'pending' && <button type="button" onClick={() => handleStatus(task.id, 'in_progress')} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Start')}</button>}
                  <button type="button" onClick={() => handleStatus(task.id, 'done')} className="text-sm text-success hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Mark done')}</button>
                </div>
              )}
            </div>
          ))}
          {tasks.length === 0 && <p className="text-ivory-dim">{t('No housekeeping tasks.')}</p>}
        </div>
      </Section>

      {performance && performance.taskCount > 0 && (
        <Section title={t('Turnover performance (7 days)')}>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Tasks completed')}</p>
              <p className="text-xl text-ivory">{performance.completedCount} / {performance.taskCount}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Avg time in queue')}</p>
              <p className="text-xl text-ivory">{performance.avgQueueTimeMins != null ? `${performance.avgQueueTimeMins} min` : t('n/a')}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Avg clean time')}</p>
              <p className="text-xl text-brass">{performance.avgCleanTimeMins != null ? `${performance.avgCleanTimeMins} min` : t('n/a')}</p>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function MaintenanceTab({ businessId }: { businessId: string }) {
  const { t } = useT();
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
    listMaintenanceTickets(businessId).then(setTickets).catch(() => {});
    listRooms(businessId).then(setRooms).catch(() => {});
    getMaintenancePerformance(businessId, 30).then(setPerformance).catch(() => {});
  }
  useEffect(reload, [businessId]);
  usePollingFallback(reload, !!businessId);

  useEffect(() => {
    const unsubTickets = subscribeToBusinessTable(businessId, 'maintenance_tickets', reload);
    return unsubTickets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

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
    setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status } : ticket)));
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
      <Section title={t('Maintenance Tickets')} action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('+ New ticket')}</button>}>
        {showAdd && (
          <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-ink-line p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t('Title')}><input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} /></Field>
              <Field label={t('Priority')}>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  <option value="low">{t('Low')}</option><option value="normal">{t('Normal')}</option><option value="high">{t('High')}</option><option value="urgent">{t('Urgent')}</option>
                </select>
              </Field>
              <Field label={t('Room (optional)')}>
                <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  <option value="">{t('No specific room')}</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                </select>
              </Field>
              <Field label={t('Estimated cost (AED, optional)')}>
                <input type="number" min={0} value={estimatedCost} onFocus={(e) => e.target.select()} onChange={(e) => setEstimatedCost(e.target.value)} className={`${inputClass} w-32`} />
              </Field>
            </div>
            {roomId && (
              <label className="flex items-center gap-2 text-sm text-ivory">
                <input type="checkbox" checked={takeRoomOutOfService} onChange={(e) => setTakeRoomOutOfService(e.target.checked)} className="accent-brass" />
                {t('Take this room out of service until resolved (blocks check-in - recommended)')}
              </label>
            )}
            <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Add')}</button>
          </form>
        )}
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3">
              <div>
                <p className="text-base text-ivory">
                  {ticket.title}{ticket.hotel_rooms?.room_number && ` · ${t('Room')} ${ticket.hotel_rooms.room_number}`}
                  {ticket.took_room_out_of_service && ticket.status !== 'resolved' && <span className="ml-2 rounded-full border border-danger/40 px-2 py-0.5 text-xs text-danger">{t('Room out of service')}</span>}
                </p>
                <p className={`text-sm ${PRIORITY_COLOR[ticket.priority]}`}>
                  {statusWord(t, ticket.priority)} · {statusWord(t, ticket.status)}
                  {(ticket.estimated_cost_aed || ticket.actual_cost_aed) && ` · ${ticket.actual_cost_aed != null ? `AED ${ticket.actual_cost_aed} ${t('actual')}` : `AED ${ticket.estimated_cost_aed} ${t('estimated')}`}`}
                </p>
              </div>
              {ticket.status !== 'resolved' && (
                <div className="flex gap-2">
                  {ticket.status === 'open' && <button type="button" onClick={() => handleStatus(ticket.id, 'in_progress')} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Start')}</button>}
                  <button type="button" onClick={() => handleStatus(ticket.id, 'resolved')} className="text-sm text-success hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Resolve')}</button>
                </div>
              )}
            </div>
          ))}
          {tickets.length === 0 && <p className="text-ivory-dim">{t('No maintenance tickets.')}</p>}
        </div>
      </Section>

      {performance && performance.ticketCount > 0 && (
        <Section title={t('Maintenance performance (30 days)')}>
          {performance.urgentOpenCount > 0 && <p className="text-sm text-danger">{performance.urgentOpenCount} {t('urgent ticket(s) still open.')}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Resolved')}</p>
              <p className="text-xl text-ivory">{performance.resolvedCount} / {performance.ticketCount}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Avg time to start')}</p>
              <p className="text-xl text-ivory">{performance.avgQueueTimeMins != null ? `${performance.avgQueueTimeMins} min` : t('n/a')}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Avg repair time')}</p>
              <p className="text-xl text-ivory">{performance.avgRepairTimeMins != null ? `${performance.avgRepairTimeMins} min` : t('n/a')}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Total cost')}</p>
              <p className="text-xl text-brass">AED {performance.totalActualCostAed.toFixed(2)}</p>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function GuestRequestsTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [requests, setRequests] = useState<GuestServiceRequest[]>([]);

  function reload() { listGuestRequests(businessId).then(setRequests).catch(() => {}); }
  useEffect(reload, [businessId]);
  usePollingFallback(reload, !!businessId);

  useEffect(() => {
    const unsubRequests = subscribeToBusinessTable(businessId, 'guest_service_requests', reload);
    return unsubRequests;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function handleStatus(requestId: string, status: 'pending' | 'in_progress' | 'done') {
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status } : r)));
    try {
      await updateGuestRequest(businessId, requestId, status);
    } catch {
      reload();
    }
  }

  return (
    <Section title={t('Guest Requests')}>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3">
            <div>
              <p className="text-base text-ivory">{t('Room')} {r.hotel_rooms?.room_number} · {t(r.request_type)}</p>
              {r.note && <p className="text-sm text-ivory-dim">{r.note}</p>}
              <p className="text-sm text-ivory-dim">{statusWord(t, r.status)}</p>
            </div>
            {r.status !== 'done' && (
              <div className="flex gap-2">
                {r.status === 'pending' && <button type="button" onClick={() => handleStatus(r.id, 'in_progress')} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Start')}</button>}
                <button type="button" onClick={() => handleStatus(r.id, 'done')} className="text-sm text-success hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Mark done')}</button>
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && <p className="text-ivory-dim">{t('No guest requests.')}</p>}
      </div>
    </Section>
  );
}
