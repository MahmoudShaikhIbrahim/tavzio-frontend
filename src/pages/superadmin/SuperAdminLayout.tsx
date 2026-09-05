import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { getInbox, updateMyTheme } from '../../lib/authApi';
import ThemeToggle from '../../components/ThemeToggle';
import Logo from '../../components/Logo';
import { useTheme } from '../../lib/ThemeContext';

const TABS = [
  { path: 'businesses', label: 'Businesses' },
  { path: 'contracts', label: 'Contracts' },
  { path: 'organizations', label: 'Organizations' },
  { path: 'leads', label: 'Leads' },
  { path: 'messages', label: 'Messages' },
  { path: 'audit-report', label: 'Audit Report' },
  { path: 'billing-settings', label: 'Billing Settings' },
  { path: 'demo-settings', label: 'Demo Settings' },
  { path: 'account', label: 'My Account' },
];

export default function SuperAdminLayout() {
  const { user, logout } = useSession();
  const location = useLocation();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const { setMode } = useTheme();

  useEffect(() => {
    if (user?.theme_preference) setMode(user.theme_preference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.theme_preference]);

  useEffect(() => {
    getInbox().then((threads) => setUnreadTotal(threads.reduce((sum, t) => sum + t.unreadCount, 0)));
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-ink">
      {/* Logo/account bar only - Businesses, Leads, Messages, and Billing
          Settings moved down into the same tab row every other page in
          the system uses, instead of living up next to the logo. */}
      <header className="border-b border-ink-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <div className="flex flex-wrap items-center gap-4 text-base text-ivory-dim">
            <ThemeToggle onChange={(mode) => updateMyTheme(mode).catch(() => {})} />
            <span>{user?.name} · Super Admin</span>
            <button type="button" onClick={logout} className="rounded hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Sign out</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-6 pb-3 pt-1.5" style={{ scrollbarWidth: 'thin' }}>
          {TABS.map((t) => {
            const active = location.pathname.startsWith(`/admin/super/${t.path}`);
            return (
              <Link
                key={t.path}
                to={`/admin/super/${t.path}`}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                  active ? 'bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/40 hover:text-ivory'
                }`}
              >
                {t.label}
                {t.path === 'messages' && unreadTotal > 0 && (
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium ${active ? 'bg-ink text-brass' : 'bg-brass text-ink'}`}>
                    {unreadTotal}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
