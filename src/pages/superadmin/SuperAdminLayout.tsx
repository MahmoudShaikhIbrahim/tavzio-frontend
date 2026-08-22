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
          <Logo className="h-9 w-auto" />
          <div className="flex flex-wrap items-center gap-4 text-base text-ivory-dim">
            <ThemeToggle onChange={(mode) => updateMyTheme(mode).catch(() => {})} />
            <span>{user?.name} · Super Admin</span>
            <button type="button" onClick={logout} className="hover:text-ivory">Sign out</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl items-center gap-1.5 px-6 pt-1.5 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.path}
              to={`/admin/super/${t.path}`}
              className={`relative shrink-0 flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-base ${
                location.pathname.startsWith(`/admin/super/${t.path}`)
                  ? 'border-brass text-ivory'
                  : 'border-transparent text-ivory-dim hover:text-ivory'
              }`}
            >
              {t.label}
              {t.path === 'messages' && unreadTotal > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brass text-[9px] font-medium text-ink">
                  {unreadTotal}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
