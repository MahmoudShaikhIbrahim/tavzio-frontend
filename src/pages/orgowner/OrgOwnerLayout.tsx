import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import Logo from '../../components/Logo';
import AccountSwitcher from '../../components/AccountSwitcher';
import ChangePasswordPage from '../dashboard/ChangePasswordPage';
import { DashboardLanguageProvider } from '../../lib/i18n/DashboardLanguageContext';

const TABS = [
  { path: 'overview', label: 'Overview' },
  { path: 'menu', label: 'Master Menu' },
  { path: 'suppliers', label: 'Suppliers' },
  { path: 'purchase-orders', label: 'Purchase Orders' },
];

// Deliberately its own layout, not a mode of DashboardLayout - an
// org_owner has no business_id and sees org-wide data, not one
// location's operational screens (no POS, no kitchen, no till). Keeping
// this separate means the business dashboard's logic never has to
// special-case "what if there's no business_id" for this account type.
export default function OrgOwnerLayout() {
  const { user, logout } = useSession();
  const location = useLocation();

  // Same forced-password-change gate DashboardLayout has - an org_owner
  // invited by super_admin starts on a temporary password exactly like
  // any other invited account, and needs the identical "set your own
  // before anything else is reachable" step, not a silently skipped one.
  //
  // Confirmed live bug, fixed here: ChangePasswordPage calls
  // useDashboardLanguage(), which throws if there's no
  // DashboardLanguageProvider above it in the tree - DashboardLayout
  // (the business dashboard) already wraps its entire tree in one, but
  // this org owner layout never did, since ChangePasswordPage was only
  // ever rendered here for this one forced-gate case and that gap was
  // never noticed until an org owner actually hit it. The uncaught
  // throw unmounts the whole React tree with no error boundary to
  // catch it, which is why this rendered as a blank page rather than
  // a visible error - not a network failure, not a missing asset, a
  // real render-time crash every org owner would hit on their very
  // first login after being invited.
  if (user?.must_change_password) {
    return (
      <DashboardLanguageProvider>
        <ChangePasswordPage forced />
      </DashboardLanguageProvider>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-ink-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <div className="flex flex-wrap items-center gap-4 text-base text-ivory-dim">
            <AccountSwitcher />
            <span>{user?.name} · Organization Owner</span>
            <button type="button" onClick={logout} className="rounded hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Sign out</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl items-center gap-1.5 px-6 pt-1.5">
          {TABS.map((t) => (
            <Link
              key={t.path}
              to={`/admin/org/${t.path}`}
              className={`border-b-2 px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                location.pathname.startsWith(`/admin/org/${t.path}`) ? 'border-brass text-ivory' : 'border-transparent text-ivory-dim hover:text-ivory'
              }`}
            >
              {t.label}
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
