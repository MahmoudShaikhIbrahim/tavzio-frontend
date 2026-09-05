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
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-full border border-ink-line px-3.5 py-1.5 text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
        Export ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-dropdown" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-dropdown mt-1.5 w-64 space-y-2 rounded-2xl border border-ink-line bg-ink-soft p-3.5 shadow-xl">
            <p className="text-sm text-ivory-dim">Leave blank for everything</p>
            <div className="flex gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-1/2 rounded-full border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-1/2 rounded-full border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => download('csv')} className="flex-1 rounded-full border border-brass/40 px-3 py-1.5 text-sm text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">CSV</button>
              <button type="button" onClick={() => download('pdf')} className="flex-1 rounded-full border border-brass/40 px-3 py-1.5 text-sm text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">PDF</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
