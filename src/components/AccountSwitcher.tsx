import { useEffect, useState } from 'react';
import { useSession } from '../hooks/useSession';
import { listLinkedAccounts, switchAccount as switchAccountApi, type LinkedAccount } from '../lib/authApi';
import { setSession } from '../lib/session';

// Only renders anything if this account actually has a linked account -
// most accounts never will, so this stays invisible for the common case
// rather than cluttering every header with an empty switcher.
export default function AccountSwitcher() {
  const { user } = useSession();
  const [links, setLinks] = useState<LinkedAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (user) listLinkedAccounts().then(setLinks).catch(() => {});
  }, [user]);

  async function handleSwitch(targetProfileId: string, targetRole: string) {
    setSwitching(true);
    try {
      const { accessToken, refreshToken } = await switchAccountApi(targetProfileId);
      setSession(accessToken, undefined, refreshToken);
      // A full reload, not a client-side route change - every piece of
      // state in this app (session, business context, feature flags)
      // needs to reflect the new account from a clean start, not carry
      // over anything cached from the old one. Destination depends on
      // the TARGET account's role, not the one you're switching from -
      // hardcoding this to /admin/dashboard would silently send an
      // org_owner or super_admin account to a page that immediately
      // bounces them via RequireRole.
      window.location.href = targetRole === 'super_admin' ? '/admin/super/businesses' : targetRole === 'org_owner' ? '/admin/org' : '/admin/dashboard';
    } catch {
      setSwitching(false);
    }
  }

  if (links.length === 0) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-sm text-ivory-dim hover:text-ivory">
        Switch account ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-ink-line bg-ink-soft p-1.5 shadow-lg">
          {links.map((link) => (
            <button
              type="button"
              key={link.linkId}
              onClick={() => handleSwitch(link.account.id, link.account.role)}
              disabled={switching}
              className="block w-full rounded px-2.5 py-2 text-left text-sm text-ivory hover:bg-ink disabled:opacity-50"
            >
              <span className="block">{link.account.name}</span>
              <span className="block text-xs text-ivory-dim">
                {link.account.businesses?.name || (link.account.role === 'org_owner' ? 'Organization' : link.account.role === 'business_owner' ? 'Admin' : link.account.role)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
