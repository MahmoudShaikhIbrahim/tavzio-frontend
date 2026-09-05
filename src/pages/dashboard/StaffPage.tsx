import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listStaff, inviteStaff, deleteStaffAccount, resendStaffInvite, setStaffActive, setStaffSections, setStaffOutlets, setStaffFullAccess, resetAccountPassword, clearStaffPin, listStaffShifts, getBusiness, listHotelOutlets, setMyAvatar, type StaffShift } from '../../lib/authApi';
import type { StaffMember, HotelOutlet } from '../../types';
import { SECTION_OPTIONS, sectionOptionsFor } from '../../lib/dashboardSections';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';
import { subscribeToBusinessTable, uploadBusinessFile } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import { useConfirm } from '../../components/ConfirmDialog';

// Real restructure, inspired by how a real POS/staff-management product
// (Toast, Petpooja, Lightspeed) actually lays this out: a compact roster
// - one or two lines per person, nothing more - with every real detail
// (contact info, permissions, status, photo) one tap away in a side
// panel, instead of a wall of cards each carrying every action chip at
// once whether you need it right now or not.
export default function StaffPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isHotel, setIsHotel] = useState(false);
  const [outlets, setOutlets] = useState<HotelOutlet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingStaff, setAddingStaff] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  function reload() {
    if (!businessId) return;
    setLoadError('');
    listStaff(businessId)
      .then((rows) => { setStaff(rows); setLoaded(true); })
      .catch((err) => { setLoadError(err instanceof Error ? err.message : 'Could not load staff'); setLoaded(true); });
  }

  useEffect(reload, [businessId]);
  usePollingFallback(reload, !!businessId);
  useEffect(() => {
    if (!businessId) return;
    return subscribeToBusinessTable(businessId, 'profiles', reload);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    getBusiness(businessId).then((b) => {
      const hotel = b.category === 'hotel';
      setIsHotel(hotel);
      if (hotel) listHotelOutlets(businessId).then(setOutlets);
    }).catch(() => {});
  }, [businessId]);

  // Self-service only, same as the backend enforces: a person sets their
  // own picture so a manager can recognize their face at a glance -
  // never someone else's, not even for an owner looking at a staff row.
  async function handleAvatarPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !businessId || !user) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadBusinessFile(businessId, file, `avatars/${user.id}-${Date.now()}`);
      await setMyAvatar(businessId, user.id, url);
      setStaff((prev) => prev.map((s) => (s.id === user.id ? { ...s, avatar_url: url } : s)));
    } catch {
      // Silent - the upload control itself simply stops spinning.
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (!businessId) return null;

  const openStaff = staff.find((s) => s.id === openId) || null;

  return (
    <div className="space-y-8">
      <Section
        title={t('Staff')}
        action={
          <button type="button" onClick={() => setAddingStaff((v) => !v)} className="rounded-full bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            {addingStaff ? t('Close') : `+ ${t('Add staff')}`}
          </button>
        }
      >
        {addingStaff && (
          <InviteStaffForm
            businessId={businessId}
            isHotel={isHotel}
            onInvited={() => { setAddingStaff(false); reload(); }}
          />
        )}

        {!loaded && <p className="text-ivory-dim">{t('Loading...')}</p>}
        {loadError && <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-danger">{loadError}</p>}
        {loaded && !loadError && staff.length === 0 && (
          <p className="text-ivory-dim">{t('No team members found - something is wrong, since your own owner account should always show up here.')}</p>
        )}

        {/* One or two lines per person - name, role, status, a section
            count at a glance - everything else lives in the detail panel
            a tap away, not competing for space in this list. */}
        <div className="overflow-hidden rounded-2xl border border-ink-line">
          {staff.map((s, i) => {
            const sectionCount = s.assigned_sections === null ? t('All') : String(s.assigned_sections.length);
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => setOpenId(s.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-inset ${
                  i > 0 ? 'border-t border-ink-line' : ''
                } ${s.is_active ? '' : 'opacity-50'}`}
              >
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brass/15 font-display text-sm font-medium text-brass">
                    {s.name.trim()[0]?.toUpperCase() || '?'}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base text-ivory">{s.name}</p>
                  <p className="truncate text-sm text-ivory-dim">{s.role === 'business_owner' ? t('Owner') : t(s.role.replace(/_/g, ' '))}</p>
                </div>
                <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  {s.full_access && <span className="rounded-full bg-brass/15 px-2 py-0.5 text-xs text-brass">{t('Full access')}</span>}
                  {s.is_org_owner && <span className="rounded-full bg-brass/15 px-2 py-0.5 text-xs text-brass">{t('Org Owner')}</span>}
                  {s.role === 'staff' && !s.full_access && (
                    <span className="rounded-full border border-ink-line px-2 py-0.5 text-xs text-ivory-dim">{sectionCount} {t('sections')}</span>
                  )}
                </div>
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.is_active ? 'bg-brass' : 'bg-ivory-dim/40'}`} title={s.is_active ? t('Active') : t('Deactivated')} />
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="shrink-0 text-ivory-dim rtl:rotate-180"><path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            );
          })}
        </div>
      </Section>

      <ShiftReportSection businessId={businessId} />

      {openStaff && (
        <StaffDetailPanel
          businessId={businessId}
          staffMember={openStaff}
          currentUserId={user?.id}
          isHotel={isHotel}
          outlets={outlets}
          uploadingAvatar={uploadingAvatar}
          onAvatarPick={handleAvatarPick}
          onClose={() => setOpenId(null)}
          onUpdated={(updated) => setStaff((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)))}
          onDeleted={(id) => { setStaff((prev) => prev.filter((m) => m.id !== id)); setOpenId(null); }}
        />
      )}
    </div>
  );
}

// Collapsed by default behind "+ Add staff" - the roster itself is the
// primary view; inviting someone is a real but occasional action, not
// something that should permanently take up a third of the page.
function InviteStaffForm({ businessId, isHotel, onInvited }: { businessId: string; isHotel: boolean; onInvited: () => void }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [inviteSections, setInviteSections] = useState<string[]>(sectionOptionsFor(isHotel).map((o) => o.key));
  const [restrictOnInvite, setRestrictOnInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');

  function toggleInviteSection(key: string) {
    setInviteSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setInviteError('');
    try {
      await inviteStaff(businessId, name, email, restrictOnInvite ? inviteSections : null);
      onInvited();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not add this staff member');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleInvite} className="space-y-3 rounded-2xl border border-ink-line bg-ink-soft p-4">
      <p className="text-sm text-ivory-dim">
        {t('New staff sign in with their own email and password — no card needed. The same account can be open on as many devices at once as needed.')}
      </p>
      <div className="flex gap-2.5">
        <Field label={t('Name')}><input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Email')}><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ivory">
        <input type="checkbox" checked={restrictOnInvite} onChange={(e) => setRestrictOnInvite(e.target.checked)} className="accent-brass" />
        {t('Restrict which sections they can see, starting from their very first login')}
      </label>
      {restrictOnInvite && (
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-ink-line bg-ink p-3 sm:grid-cols-3">
          {sectionOptionsFor(isHotel).map((opt) => (
            <label key={opt.key} className="flex items-center gap-2 text-sm text-ivory">
              <input type="checkbox" checked={inviteSections.includes(opt.key)} onChange={() => toggleInviteSection(opt.key)} className="accent-brass" />
              {t(opt.label)}
            </label>
          ))}
        </div>
      )}
      <PrimaryButton disabled={saving}>{saving ? t('Adding...') : t('Add staff')}</PrimaryButton>
      {inviteError && <p className="text-sm text-danger">{inviteError}</p>}
    </form>
  );
}

// The actual detail view every row opens into - a slide-over panel, not
// a modal stacked on top of the roster, so closing it always lands back
// on the exact same scroll position in the list. Overview and
// Permissions are genuinely separate concerns (who they are / what
// they're allowed to see) so they get their own tabs rather than one
// long scroll of both mixed together.
function StaffDetailPanel({ businessId, staffMember, currentUserId, isHotel, outlets, uploadingAvatar, onAvatarPick, onClose, onUpdated, onDeleted }: {
  businessId: string; staffMember: StaffMember; currentUserId?: string; isHotel: boolean; outlets: HotelOutlet[];
  uploadingAvatar: boolean; onAvatarPick: (e: ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void; onUpdated: (updated: StaffMember) => void; onDeleted: (id: string) => void;
}) {
  const { t } = useT();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'overview' | 'permissions'>('overview');
  const [busy, setBusy] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const s = staffMember;
  const canManage = s.role === 'staff' || s.role === 'org_owner';

  async function handleResetPassword() {
    if (!(await confirm({
      title: t('Reset password?'),
      message: t("Reset this account's password? They will be given a new temporary password and forced to set their own on next login."),
      confirmLabel: t('Reset password'),
    }))) return;
    const result = await resetAccountPassword(businessId, s.id);
    setResetResult(result.tempPassword);
  }

  async function handleResetPin() {
    if (!(await confirm({
      title: t('Reset PIN?'),
      message: t('Clear {name}\'s POS PIN? They\'ll be asked to set a new one the next time they take a payment.').replace('{name}', s.name),
      confirmLabel: t('Reset PIN'),
    }))) return;
    await clearStaffPin(businessId, s.id);
    setMessage(t('PIN cleared.'));
  }

  async function handleResendInvite() {
    setBusy('resend');
    try {
      await resendStaffInvite(businessId, s.id);
      setMessage(t('Invite resent.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend invite');
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleActive() {
    const next = !s.is_active;
    setBusy('active');
    try {
      const updated = await setStaffActive(businessId, s.id, next);
      onUpdated(updated);
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleFullAccess() {
    const next = !s.full_access;
    const message = next
      ? t('Give {name} full owner-equivalent access? They will be able to see and do everything you can, including billing, contracts, and staff management.').replace('{name}', s.name)
      : t('Revoke full access from {name}? They will go back to only their assigned sections.').replace('{name}', s.name);
    if (!(await confirm({ title: next ? t('Grant full access?') : t('Revoke full access?'), message, danger: !next }))) return;
    setBusy('fullAccess');
    try {
      await setStaffFullAccess(businessId, s.id, next);
      onUpdated({ ...s, full_access: next });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!(await confirm({
      title: t('Delete this account?'),
      message: t('Permanently delete {name}\'s account? This cannot be undone - all their history stays on past records, but the account itself is gone. If you just want to block their access, use Deactivate instead.').replace('{name}', s.name),
      confirmLabel: t('Delete account'),
      danger: true,
    }))) return;
    setBusy('delete');
    try {
      await deleteStaffAccount(businessId, s.id);
      onDeleted(s.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this account');
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex justify-end bg-ink/70" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-s border-ink-line bg-ink-soft shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-line p-5">
          <div className="flex items-center gap-3">
            {s.avatar_url ? (
              <img src={s.avatar_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brass/15 font-display text-xl font-medium text-brass">
                {s.name.trim()[0]?.toUpperCase() || '?'}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-xl text-ivory">{s.name}</p>
              <p className="text-sm text-ivory-dim">{s.role === 'business_owner' ? t('Owner') : t(s.role.replace(/_/g, ' '))}</p>
              <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${s.is_active ? 'text-brass' : 'text-ivory-dim'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.is_active ? 'bg-brass' : 'bg-ivory-dim/40'}`} />
                {s.is_active ? t('Active') : t('Deactivated')}
              </p>
              {s.id === currentUserId && (
                <label className="mt-1 block cursor-pointer text-xs font-medium text-brass hover:underline focus-within:ring-2 focus-within:ring-brass">
                  {uploadingAvatar ? t('Uploading…') : s.avatar_url ? t('Change photo') : t('Add photo')}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingAvatar} onChange={onAvatarPick} />
                </label>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Close')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ivory-dim hover:bg-ink hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">✕</button>
        </div>

        <div className="flex gap-2 border-b border-ink-line px-5 py-3">
          {(['overview', 'permissions'] as const).map((tabKey) => (
            <button
              type="button"
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                tab === tabKey ? 'bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/40 hover:text-ivory'
              }`}
            >
              {tabKey === 'overview' ? t('Overview') : t('Permissions')}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 p-5">
          {message && <p className="rounded-2xl border border-brass/40 bg-brass/10 px-4 py-2.5 text-sm text-brass">{message}</p>}
          {error && <p className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}
          {resetResult && (
            <div className="rounded-2xl border border-brass/40 bg-ink p-4">
              <p className="text-sm text-ivory">{t('New temporary password')}:</p>
              <p className="mt-1 select-all rounded-xl bg-ink-soft px-3 py-2 font-mono text-lg text-brass">{resetResult}</p>
              <p className="mt-2 text-xs text-ivory-dim">{t("Send this to them directly - it won't be shown again.")}</p>
            </div>
          )}

          {tab === 'overview' && (
            <>
              {s.role === 'staff' && s.full_access && (
                <p className="text-sm text-brass">{t('Owner-equivalent access - sees and does everything the owner can, regardless of assigned sections.')}</p>
              )}
              {(s.role === 'org_owner' || s.is_org_owner) && (
                <p className="text-sm text-brass">{t('Manages the multi-location organization this business belongs to.')}</p>
              )}
              {s.role === 'staff' && !s.full_access && (
                <p className="text-sm text-ivory-dim">
                  {t('Sections:')} {s.assigned_sections === null
                    ? t('Sees everything')
                    : s.assigned_sections.length === 0
                      ? t('No sections assigned yet')
                      : s.assigned_sections.map((key) => t(SECTION_OPTIONS.find((o) => o.key === key)?.label || key)).join(', ')}
                </p>
              )}
              {isHotel && s.role === 'staff' && (
                <p className="text-sm text-ivory-dim">
                  {t('Outlets:')} {s.assigned_outlet_ids === null
                    ? t('Any outlet')
                    : s.assigned_outlet_ids.length === 0
                      ? t('None assigned yet')
                      : s.assigned_outlet_ids.map((id) => outlets.find((o) => o.id === id)?.name || id).join(', ')}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5 border-t border-ink-line pt-4">
                <button type="button" onClick={handleResetPassword} className="rounded-full border border-ink-line px-2.5 py-1 text-xs text-ivory-dim hover:border-brass/40 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  {t('Reset password')}
                </button>
                <button type="button" onClick={handleResetPin} className="rounded-full border border-ink-line px-2.5 py-1 text-xs text-ivory-dim hover:border-brass/40 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  {t('Reset PIN')}
                </button>
                <button type="button" disabled={busy === 'resend'} onClick={handleResendInvite} className="rounded-full border border-ink-line px-2.5 py-1 text-xs text-ivory-dim hover:border-brass/40 hover:text-ivory disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  {busy === 'resend' ? t('Resending...') : t('Resend invite')}
                </button>
                {canManage && (
                  <>
                    <button type="button" disabled={busy === 'active'} onClick={handleToggleActive} className="rounded-full border border-ink-line px-2.5 py-1 text-xs text-ivory-dim hover:border-brass/40 hover:text-ivory disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                      {busy === 'active' ? t('Updating...') : s.is_active ? t('Deactivate') : t('Reactivate')}
                    </button>
                    <button type="button" disabled={busy === 'delete'} onClick={handleDelete} className="rounded-full border border-danger/40 px-2.5 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">
                      {busy === 'delete' ? t('Deleting...') : t('Delete account')}
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {tab === 'permissions' && (
            s.role !== 'staff' ? (
              <p className="text-sm text-ivory-dim">{t('Permissions only apply to staff accounts.')}</p>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  disabled={busy === 'fullAccess'}
                  onClick={handleToggleFullAccess}
                  className={`w-full rounded-full border px-3.5 py-2 text-sm font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                    s.full_access ? 'border-danger/40 text-danger hover:bg-danger/10' : 'border-brass/40 text-brass hover:bg-brass/10'
                  }`}
                >
                  {busy === 'fullAccess' ? t('Updating...') : s.full_access ? t('Revoke full access') : t('Grant full access')}
                </button>
                {!s.full_access && (
                  <>
                    <SectionAssignmentForm businessId={businessId} staffMember={s} isHotel={isHotel} onSaved={onUpdated} />
                    {isHotel && <OutletAssignmentForm businessId={businessId} staffMember={s} outlets={outlets} onSaved={onUpdated} />}
                  </>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// Hours worked, per staff member, over a chosen range - clock-in/out is
// only useful to an owner if it turns into an actual report they can
// read at a glance and hand to payroll.
function ShiftReportSection({ businessId }: { businessId?: string }) {
  const { t } = useT();
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  function reload() {
    if (!businessId) return;
    listStaffShifts(businessId, { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }).then(setShifts).catch(() => {});
  }
  useEffect(reload, [businessId, from, to]);

  if (!businessId) return null;

  const totalsByStaff = shifts.reduce<Record<string, { name: string; hours: number }>>((acc, s) => {
    const name = s.profiles?.name || t('Unknown');
    if (!acc[s.staff_id]) acc[s.staff_id] = { name, hours: 0 };
    acc[s.staff_id].hours += s.hours || 0;
    return acc;
  }, {});

  return (
    <Section
      title={t('Time Clock')}
      action={
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-full border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass" />
          <span className="text-sm text-ivory-dim">{t('to')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-full border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass" />
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.values(totalsByStaff).map((staffTotal) => (
          <div key={staffTotal.name} className="rounded-2xl border border-ink-line px-4 py-3 shadow-sm">
            <p className="text-base text-ivory">{staffTotal.name}</p>
            <p className="text-sm text-brass">{staffTotal.hours.toFixed(1)} hrs</p>
          </div>
        ))}
        {Object.keys(totalsByStaff).length === 0 && <p className="text-ivory-dim">{t('No shifts in this range.')}</p>}
      </div>

      <div className="space-y-2">
        {shifts.map((s) => (
          <div key={s.id} className="flex items-center justify-between text-sm text-ivory-dim">
            <span>{s.profiles?.name || t('Unknown')}</span>
            <span>
              {new Date(s.clock_in_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              {' → '}
              {s.clock_out_at ? new Date(s.clock_out_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : t('still clocked in')}
            </span>
            <span className="text-ivory">{s.hours != null ? `${s.hours.toFixed(2)} hrs` : '—'}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// A staff account with `assigned_sections: null` (the default) sees
// everything - opening this form for the first time starts every box
// checked, so simply closing without changing anything leaves that
// account exactly as unrestricted as it was.
function SectionAssignmentForm({ businessId, staffMember, isHotel, onSaved }: {
  businessId: string; staffMember: StaffMember; isHotel: boolean; onSaved: (updated: StaffMember) => void;
}) {
  const { t } = useT();
  const [selected, setSelected] = useState<string[]>(
    staffMember.assigned_sections ?? sectionOptionsFor(isHotel).map((o) => o.key)
  );
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await setStaffSections(businessId, staffMember.id, selected);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearRestriction() {
    setSaving(true);
    try {
      const updated = await setStaffSections(businessId, staffMember.id, null);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ink-line bg-ink p-3.5">
      <p className="text-sm text-ivory-dim">{t("Only checked sections will appear on this account's dashboard.")}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {sectionOptionsFor(isHotel).map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-sm text-ivory">
            <input type="checkbox" checked={selected.includes(opt.key)} onChange={() => toggle(opt.key)} className="accent-brass" />
            {t(opt.label)}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <ActionButton onClick={handleSave} loading={saving}>{t('Save')}</ActionButton>
        {staffMember.assigned_sections !== null && (
          <button type="button" onClick={handleClearRestriction} disabled={saving} className="text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            {t('Remove restriction (sees everything)')}
          </button>
        )}
      </div>
    </div>
  );
}

// Same "null = unrestricted" convention as SectionAssignmentForm above -
// opening this for the first time starts every outlet checked, so
// closing without changing anything leaves the account exactly as
// unrestricted as it was.
function OutletAssignmentForm({ businessId, staffMember, outlets, onSaved }: {
  businessId: string; staffMember: StaffMember; outlets: HotelOutlet[]; onSaved: (updated: StaffMember) => void;
}) {
  const { t } = useT();
  const [selected, setSelected] = useState<string[]>(
    staffMember.assigned_outlet_ids ?? outlets.map((o) => o.id)
  );
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await setStaffOutlets(businessId, staffMember.id, selected);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearRestriction() {
    setSaving(true);
    try {
      const updated = await setStaffOutlets(businessId, staffMember.id, null);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ink-line bg-ink p-3.5">
      <p className="text-sm text-ivory-dim">
        {t('Only checked outlets can be selected when this account opens a till.')}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {outlets.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm text-ivory">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} className="accent-brass" />
            {o.name}
          </label>
        ))}
        {outlets.length === 0 && <p className="text-sm text-ivory-dim">{t('No outlets set up yet - add some under F&B Outlets & Services first.')}</p>}
      </div>
      <div className="flex items-center gap-3">
        <ActionButton onClick={handleSave} loading={saving}>{t('Save')}</ActionButton>
        {staffMember.assigned_outlet_ids !== null && (
          <button type="button" onClick={handleClearRestriction} disabled={saving} className="text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            {t('Remove restriction (any outlet)')}
          </button>
        )}
      </div>
    </div>
  );
}
