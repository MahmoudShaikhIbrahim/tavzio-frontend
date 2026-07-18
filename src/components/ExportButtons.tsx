import { useState } from 'react';
import { downloadExport } from '../lib/authApi';

export default function ExportButtons({ businessId, kind }: { businessId: string; kind: 'orders' | 'bookings' | 'payments' }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState(false);

  function download(format: 'csv' | 'pdf') {
    downloadExport(businessId, kind, format, {
      from: from ? new Date(from).toISOString() : undefined,
      // Include the whole "to" day, not just its midnight - otherwise
      // picking today's date would exclude everything that happened today.
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    });
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory">
        Export ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-20 mt-1.5 w-64 space-y-2 rounded-lg border border-ink-line bg-ink-soft p-3 shadow-xl">
            <p className="text-sm text-ivory-dim">Leave blank for everything</p>
            <div className="flex gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-1/2 rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-1/2 rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => download('csv')} className="flex-1 rounded-lg border border-brass/40 px-3 py-1.5 text-sm text-brass hover:bg-brass/10">CSV</button>
              <button onClick={() => download('pdf')} className="flex-1 rounded-lg border border-brass/40 px-3 py-1.5 text-sm text-brass hover:bg-brass/10">PDF</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
