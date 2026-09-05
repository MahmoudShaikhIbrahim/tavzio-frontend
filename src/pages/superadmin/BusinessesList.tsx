import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBusinesses } from '../../lib/authApi';
import type { AdminBusiness } from '../../types';

const STATUS_STYLES: Record<string, string> = {
  active: 'text-success border-success/40',
  pending: 'text-brass border-brass/40',
  suspended: 'text-danger border-danger/40',
};

export default function BusinessesList() {
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listBusinesses(search ? { search } : {})
      .then((res) => setBusinesses(res.businesses))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ivory">Businesses</h1>
      </div>

      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-5 w-full max-w-sm rounded-full border border-ink-line bg-ink-soft px-5 py-3 text-base
                   text-ivory placeholder:text-ivory-dim/60 focus:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      />

      <div className="mt-5 overflow-hidden rounded-2xl border border-ink-line shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-base">
          <thead className="bg-ink-soft text-ivory-dim">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Contract countdown</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ivory-dim">Loading...</td></tr>
            )}
            {!loading && businesses.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ivory-dim">No businesses yet.</td></tr>
            )}
            {businesses.map((b) => (
              <tr key={b.id} className="border-t border-ink-line hover:bg-ink-soft/50">
                <td className="px-4 py-3">
                  <Link to={`/admin/super/businesses/${b.id}`} className="flex items-center gap-2.5 rounded text-ivory hover:text-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brass/15 font-display text-xs font-medium text-brass">
                      {b.name.trim()[0]?.toUpperCase() || '?'}
                    </span>
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ivory-dim">/{b.slug}</td>
                <td className="px-4 py-3 text-ivory-dim capitalize">{b.category}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-0.5 text-sm capitalize ${STATUS_STYLES[b.status]}`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {b.contractCountdown ? (
                    <div className="space-y-0.5">
                      <p className={b.contractCountdown.daysToBilling <= 3 ? 'font-medium text-warning' : 'text-ivory-dim'}>
                        Next invoice: {b.contractCountdown.daysToBilling <= 0 ? 'due today' : `${b.contractCountdown.daysToBilling}d`}
                      </p>
                      <p className={b.contractCountdown.daysToExpiry <= b.contractCountdown.expiryWarningDays ? 'font-medium text-danger' : 'text-ivory-dim'}>
                        Contract ends: {b.contractCountdown.daysToExpiry <= 0 ? 'today' : `${b.contractCountdown.daysToExpiry}d`}
                      </p>
                    </div>
                  ) : (
                    <span className="text-ivory-dim/70">No active contract</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
