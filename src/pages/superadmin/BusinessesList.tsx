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
        <Link
          to="/admin/super/businesses/new"
          className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90"
        >
          + Onboard a business
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-5 w-full max-w-sm rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2 text-base
                   text-ivory placeholder:text-ivory-dim/60 focus:border-brass"
      />

      <div className="mt-5 overflow-hidden rounded-xl border border-ink-line">
        <table className="w-full text-left text-base">
          <thead className="bg-ink-soft text-ivory-dim">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ivory-dim">Loading...</td></tr>
            )}
            {!loading && businesses.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ivory-dim">No businesses yet.</td></tr>
            )}
            {businesses.map((b) => (
              <tr key={b.id} className="border-t border-ink-line hover:bg-ink-soft/50">
                <td className="px-4 py-3">
                  <Link to={`/admin/super/businesses/${b.id}`} className="text-ivory hover:text-brass">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
