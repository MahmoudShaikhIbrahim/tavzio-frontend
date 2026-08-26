import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import type { ThemeMode } from '../lib/ThemeContext';
import { listLinkedAccounts, switchAccount as switchAccountApi, type LinkedAccount } from '../lib/authApi';
import { setSession } from '../lib/session';

// Real consolidation - Business Profile, name/role, sign out, theme, and
// account switching used to be five separate items spread across the
// header, competing for space and reading as visually messy. One avatar
// trigger, one dropdown, everything related to "this account" lives
// together - the same real pattern virtually every real SaaS dashboard
// uses for exactly this cluster of items.
export default function AccountMenu({
  name, role, onSignOut, onThemeChange, t,
}: {
  name: string; role: string; onSignOut: () => void; onThemeChange: (mode: ThemeMode) => void; t: (s: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<LinkedAccount[]>([]);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listLinkedAccounts().then(setLinks).catch(() => {});
  }, []);

  async function handleSwitch(targetProfileId: string, targetRole: string) {
    setSwitching(true);
    try {
      const { accessToken, refreshToken } = await switchAccountApi(targetProfileId);
      setSession(accessToken, undefined, refreshToken);
      // Full reload, not a client-side route change - every piece of
      // state (session, business context, feature flags) needs to
      // reflect the new account from a clean start.
      window.location.href = targetRole === 'super_admin' ? '/admin/super/businesses' : targetRole === 'org_owner' ? '/admin/org' : '/admin/dashboard';
    } catch {
      setSwitching(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initial = name?.trim()?.[0]?.toUpperCase() || '?';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${name} · ${role}`}
        className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-all duration-150 active:scale-[0.92] ${
          open ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim hover:border-brass/50 hover:text-ivory'
        }`}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-dropdown mt-2 w-64 overflow-hidden rounded-xl border border-ink-line bg-ink-soft shadow-2xl shadow-black/50">
          <div className="border-b border-ink-line px-4 py-3">
            <p className="text-base text-ivory">{name}</p>
            <p className="text-sm text-ivory-dim">{role}</p>
          </div>

          <div className="p-1.5">
            <Link
              to="/admin/dashboard/settings/business-profile"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2.5 py-2.5 text-base text-ivory hover:bg-ink"
            >
              {t('Business Profile')}
            </Link>
            <div className="flex items-center justify-between px-2.5 py-2.5">
              <span className="text-base text-ivory-dim">{t('Theme')}</span>
              <ThemeToggle onChange={onThemeChange} />
            </div>
            {links.length > 0 && (
              <>
                <p className="px-2.5 pb-1 pt-2 text-xs uppercase tracking-wide text-ivory-dim/70">{t('Switch account')}</p>
                {links.map((link) => (
                  <button
                    type="button"
                    key={link.linkId}
                    onClick={() => handleSwitch(link.account.id, link.account.role)}
                    disabled={switching}
                    className="block w-full rounded-lg px-2.5 py-2 text-start hover:bg-ink disabled:opacity-50"
                  >
                    <span className="block text-base text-ivory">{link.account.name}</span>
                    <span className="block text-sm text-ivory-dim">
                      {link.account.businesses?.name || (link.account.role === 'org_owner' ? t('Organization') : link.account.role === 'business_owner' ? t('Owner') : link.account.role)}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="border-t border-ink-line p-1.5">
            <button
              type="button"
              onClick={onSignOut}
              className="block w-full rounded-lg px-2.5 py-2.5 text-start text-base text-danger hover:bg-danger/10"
            >
              {t('Sign out')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
