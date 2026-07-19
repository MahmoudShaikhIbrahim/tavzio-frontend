import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { getInbox, updateMyTheme } from '../../lib/authApi';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme } from '../../lib/ThemeContext';

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
      <header className="border-b border-ink-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-6">
            <span className="font-mono text-[11px] uppercase tracking-wider text-brass">Tavzio · Platform</span>
            <nav className="flex gap-4 text-base">
              <Link
                to="/admin/super/businesses"
                className={location.pathname.startsWith('/admin/super/businesses') ? 'text-ivory' : 'text-ivory-dim hover:text-ivory'}
              >
                Businesses
              </Link>
              <Link
                to="/admin/super/messages"
                className={`flex items-center gap-1.5 ${location.pathname.startsWith('/admin/super/messages') ? 'text-ivory' : 'text-ivory-dim hover:text-ivory'}`}
              >
                Messages
                {unreadTotal > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brass text-[9px] font-medium text-ink">
                    {unreadTotal}
                  </span>
                )}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-base text-ivory-dim">
            <ThemeToggle onChange={(mode) => updateMyTheme(mode).catch(() => {})} />
            <span>{user?.name}</span>
            <button onClick={logout} className="hover:text-ivory">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
