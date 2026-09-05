import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listStaff, inviteStaff, deleteStaffAccount, resendStaffInvite, setStaffActive, setStaffSections, setStaffOutlets, setStaffFullAccess, resetAccountPassword, clearStaffPin, listStaffShifts, getBusiness, listHotelOutlets, getBusinessOrganization, appointOrgOwner, leaveOrganization, setOrgOwnerStatus, setMyAvatar, type StaffShift, type BusinessOrganization } from '../../lib/authApi';
import type { StaffMember, HotelOutlet } from '../../types';
import { SECTION_OPTIONS, sectionOptionsFor } from '../../lib/dashboardSections';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';
import { subscribeToBusinessTable, uploadBusinessFile } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import { useConfirm } from '../../components/ConfirmDialog';

export default function StaffPage() {
  const { user } = useSession();
  const { t } = useT();
  const confirm = useConfirm();
  const businessId = user?.business_id;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [inviteSections, setInviteSections] = useState<string[]>(sectionOptionsFor(false).map((o) => o.key));
  const [restrictOnInvite, setRestrictOnInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; tempPassword: string } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState('');
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [togglingFullAccessId, setTogglingFullAccessId] = useState<string | null>(null);
  const [togglingOrgOwnerId, setTogglingOrgOwnerId] = useState<string | null>(null);
  const [editingSectionsFor, setEditingSectionsFor] = useState<string | null>(null);
  const [editingOutletsFor, setEditingOutletsFor] = useState<string | null>(null);
  const [isHotel, setIsHotel] = useState(false);
  const [outlets, setOutlets] = useState<HotelOutlet[]>([]);
  const [organization, setOrganization] = useState<BusinessOrganization | null>(null);
  const [orgLoaded, setOrgLoaded] = useState(false);
  const [showAppointForm, setShowAppointForm] = useState(false);
  const [leavingOrg, setLeavingOrg] = useState(false);
  const [leaveOrgError, setLeaveOrgError] = useState('');

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
      // Silent - the upload button itself simply stops spinning; nothing
      // destructive happened, so there's nothing to roll back.
    } finally {
      setUploadingAvatar(false);
    }
  }

  function reload() {
    if (!businessId) return;
    setLoadError('');
    listStaff(businessId)
      .then((rows) => { setStaff(rows); setLoaded(true); })
      .catch((err) => { setLoadError(err instanceof Error ? err.message : 'Could not load staff'); setLoaded(true); });
  }

  useEffect(reload, [businessId]);
  usePollingFallback(reload, !!businessId);
  // business - a newly invited account, a role/section change made from
  // another tab, a deactivate/reactivate - without waiting for a manual
  // page reload. Full refetch on each event rather than merging the
  // changed row in by hand: listStaff's response shape (assigned_sections,
  // assigned_outlet_ids, full_access, etc.) is exactly what this page
  // already renders from, so reusing it here can't drift out of sync
  // with what a manual reload would show.
  useEffect(() => {
    if (!businessId) return;
    return subscribeToBusinessTable(businessId, 'profiles', reload);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    getBusinessOrganization(businessId)
      .then((org) => { setOrganization(org); setOrgLoaded(true); })
      .catch(() => setOrgLoaded(true));
  }, [businessId]);

  // Outlet assignment is hotel-only (confirmed: restaurants may get this
  // later, not yet) - the outlet list only ever gets fetched when it
  // could actually be used.
  useEffect(() => {
    if (!businessId) return;
    getBusiness(businessId).then((b) => {
      const hotel = b.category === 'hotel';
      setIsHotel(hotel);
      // Re-sync the invite form's default (all-selected) set to the
      // business's real category - without this, a hotel would keep the
      // restaurant-scoped default (set at mount, before this fetch
      // resolves) for the brief window before this effect runs, and
      // "Restrict sections" would offer Tables while quietly missing
      // Front Desk/Housekeeping.
      setInviteSections(sectionOptionsFor(hotel).map((o) => o.key));
      if (hotel) listHotelOutlets(businessId).then(setOutlets);
    }).catch(() => {});
  }, [businessId]);

  if (!businessId) return null;

  // Real fix for a confirmed bug: this had no try/catch at all - a
  // real, common failure (email already registered, or Supabase's own
  // outbound-email rate limit) threw uncaught, execution stopped
  // before setSaving(false) ever ran, and the button was stuck on
  // "Adding..." forever with the actual error only visible in the
  // browser console, invisible to whoever was actually using the form.
  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setInviteError('');
    try {
      await inviteStaff(businessId!, name, email, restrictOnInvite ? inviteSections : null);
      setName(''); setEmail(''); setRestrictOnInvite(false); setInviteSections(sectionOptionsFor(isHotel).map((o) => o.key));
      reload();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not add this staff member');
    } finally {
      setSaving(false);
    }
  }

  function toggleInviteSection(key: string) {
    setInviteSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  // Permanent removal, distinct from Deactivate above - confirmed
  // explicitly since (unlike deactivating) this can't be undone from
  // this account again; a new invite would be a brand new account.
  async function handleDeleteStaff(s: StaffMember) {
    if (!(await confirm({
      title: t('Delete this account?'),
      message: t('Permanently delete {name}\'s account? This cannot be undone - all their history stays on past records, but the account itself is gone. If you just want to block their access, use Deactivate instead.').replace('{name}', s.name),
      confirmLabel: t('Delete account'),
      danger: true,
    }))) return;
    setDeletingId(s.id);
    try {
      await deleteStaffAccount(businessId!, s.id);
      setStaff((prev) => prev.filter((m) => m.id !== s.id));
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not delete this account');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleResetPassword(userId: string) {
    if (!(await confirm({
      title: t('Reset password?'),
      message: t("Reset this account's password? They will be given a new temporary password and forced to set their own on next login."),
      confirmLabel: t('Reset password'),
    }))) return;
    const result = await resetAccountPassword(businessId!, userId);
    setResetResult(result);
  }

  // Same "owner unlocks a locked-out staff member" pattern as password
  // reset above, but genuinely simpler underneath: a PIN is cleared, not
  // replaced - the owner never learns or chooses the new one, the staff
  // member sets their own the next time they take a payment (real
  // first-time-setup flow already built into PaymentModal for exactly
  // this moment).
  async function handleResetPin(userId: string, name: string) {
    if (!(await confirm({
      title: t('Reset PIN?'),
      message: t('Clear {name}\'s POS PIN? They\'ll be asked to set a new one the next time they take a payment.').replace('{name}', name),
      confirmLabel: t('Reset PIN'),
    }))) return;
    await clearStaffPin(businessId!, userId);
  }

  // For someone who never checked their first invite email - sends a
  // fresh one via resendStaffInvite (Gmail API, never touches
  // Supabase's own rate-limited mailer - see notifications.js).
  async function handleResendInvite(userId: string) {
    setResendingId(userId);
    try {
      await resendStaffInvite(businessId!, userId);
      setResendMessage(t('Invite resent.'));
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : 'Could not resend invite');
    } finally {
      setResendingId(null);
    }
  }

  // Granting is a real, server-enforced trust decision (this account
  // will pass every owner-only check across the whole app - billing,
  // contracts, deleting things, all of it) - confirmed explicitly every
  // time, both directions, rather than a silent toggle.
  //
  // Real fix for a confirmed bug: this had no in-flight guard at all -
  // unlike every other action button on this page (delete, resend,
  // deactivate now), nothing disabled the button or gave any feedback
  // while the PATCH was in the air, so a person unsure whether their
  // click registered would click again - firing a second overlapping
  // PATCH with the SAME `next` value computed from the same stale `s`,
  // which can flip the account back to where it started once both
  // responses land, depending on which one wins the race. Now that the
  // dialog itself is a real async component (not the blocking native
  // confirm()), the togglingFullAccessId guard below is what actually
  // prevents a second in-flight request - not the dialog blocking
  // anything - so keep that guard even if this dialog is ever reused
  // elsewhere.
  async function handleToggleFullAccess(s: StaffMember) {
    if (togglingFullAccessId === s.id) return;
    const next = !s.full_access;
    const message = next
      ? t('Give {name} full owner-equivalent access? They will be able to see and do everything you can, including billing, contracts, and staff management.').replace('{name}', s.name)
      : t('Revoke full access from {name}? They will go back to only their assigned sections.').replace('{name}', s.name);
    if (!(await confirm({ title: next ? t('Grant full access?') : t('Revoke full access?'), message, danger: !next }))) return;
    setTogglingFullAccessId(s.id);
    setStaff((prev) => prev.map((m) => (m.id === s.id ? { ...m, full_access: next } : m)));
    try {
      await setStaffFullAccess(businessId!, s.id, next);
    } catch {
      reload();
    } finally {
      setTogglingFullAccessId(null);
    }
  }

  // Same missing-guard bug as full-access above, same fix.
  async function handleToggleActive(s: StaffMember) {
    if (togglingActiveId === s.id) return;
    const next = !s.is_active;
    setTogglingActiveId(s.id);
    setStaff((prev) => prev.map((m) => (m.id === s.id ? { ...m, is_active: next } : m)));
    try {
      await setStaffActive(businessId!, s.id, next);
    } catch {
      reload();
    } finally {
      setTogglingActiveId(null);
    }
  }

  // Real, separate action from Delete - the actual gap the old
  // role-swap design had no answer for: reassigning org management used
  // to mean deleting the whole account just to take away the org piece.
  // Works on any role (including the owner's own row) since is_org_owner
  // is a capability layered on top of role, not tied to a specific one -
  // see migration 0098. Backend re-runs the same "don't strand the org"
  // check leaveOrganization uses, so revoking the last org owner is
  // blocked the same way unlinking the last business is.
  async function handleToggleOrgOwner(s: StaffMember) {
    if (togglingOrgOwnerId === s.id) return;
    const next = !s.is_org_owner;
    const message = next
      ? t('Give {name} org-management access? They will manage the shared menu, suppliers, and consolidated reporting for every location in this organization.').replace('{name}', s.name)
      : t('Remove org-management access from {name}? Their regular account stays exactly as it is - only the org piece goes away.').replace('{name}', s.name);
    if (!(await confirm({ title: next ? t('Grant org owner?') : t('Revoke org owner?'), message, danger: !next }))) return;
    setTogglingOrgOwnerId(s.id);
    try {
      await setOrgOwnerStatus(businessId!, s.id, next);
      reload();
      getBusinessOrganization(businessId!).then(setOrganization).catch(() => {});
    } catch (err) {
      setLeaveOrgError(err instanceof Error ? err.message : 'Could not update org owner status');
    } finally {
      setTogglingOrgOwnerId(null);
    }
  }

  // Self-service unlink - only ever touches this business's own link to
  // the org, same as appointing an org owner only ever touched this
  // business. Blocked server-side (see leaveOrganization/
  // checkWouldOrphanOrgOwners in organizationController.js) if this is
  // the only business hosting an org_owner for this org - the error
  // message from that check is shown as-is, since it already explains
  // exactly what to do (reassign or remove that org owner first).
  async function handleLeaveOrganization() {
    if (!organization) return;
    if (!(await confirm({
      title: t('Leave organization?'),
      message: t('Leave "{orgName}"? This business stops sharing its menu, suppliers, and reporting with the rest of the organization. Nothing about the organization itself is deleted.').replace('{orgName}', organization.name),
      confirmLabel: t('Leave organization'),
      danger: true,
    }))) return;
    setLeavingOrg(true);
    setLeaveOrgError('');
    try {
      await leaveOrganization(businessId!);
      setOrganization(null);
      reload();
    } catch (err) {
      setLeaveOrgError(err instanceof Error ? err.message : 'Could not leave organization');
    } finally {
      setLeavingOrg(false);
    }
  }

  return (
    <div className="space-y-10">
      {resendMessage && (
        <div className="rounded-lg border border-brass/40 bg-ink-soft px-4 py-3">
          <p className="text-base text-ivory">{resendMessage}</p>
          <button type="button" onClick={() => setResendMessage('')} className="mt-1 text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Dismiss')}</button>
        </div>
      )}
      {resetResult && (
        <div className="rounded-lg border border-brass/40 bg-ink-soft p-4">
          <p className="text-base text-ivory">
            {t('New temporary password for')} <span className="text-brass">{resetResult.name}</span>:
          </p>
          <p className="mt-1 select-all rounded bg-ink px-3 py-2 font-mono text-lg text-brass">{resetResult.tempPassword}</p>
          <p className="mt-2 text-sm text-ivory-dim">
            {t("Send this to them directly (not visible again after you leave this page). They'll be required to set their own new password the moment they log in with it.")}
          </p>
          <button type="button" onClick={() => setResetResult(null)} className="mt-2 text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Dismiss')}</button>
        </div>
      )}

      <Section title={t('Team')}>
        {!loaded && <p className="text-ivory-dim">{t('Loading...')}</p>}
        {loadError && <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-danger">{loadError}</p>}
        {loaded && !loadError && staff.length === 0 && (
          <p className="text-ivory-dim">{t('No team members found - something is wrong, since your own owner account should always show up here.')}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => (
            <div key={s.id} className={`rounded-2xl border px-5 py-4 text-base shadow-sm ${s.is_active ? 'border-ink-line' : 'border-ink-line opacity-60'}`}>
              <div className="flex items-start gap-3">
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass/15 font-display text-sm font-medium text-brass">
                    {s.name.trim()[0]?.toUpperCase() || '?'}
                  </span>
                )}
                <div className="min-w-0">
                  {s.id === user?.id && (
                    <label className="mb-0.5 block cursor-pointer text-xs font-medium text-brass hover:underline focus-within:ring-2 focus-within:ring-brass">
                      {uploadingAvatar ? t('Uploading…') : s.avatar_url ? t('Change photo') : t('Add photo')}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingAvatar} onChange={handleAvatarPick} />
                    </label>
                  )}
                  <p className="truncate text-ivory">{s.name}</p>
                  <p className="text-sm text-ivory-dim">{s.role === 'business_owner' ? t('Owner') : t(s.role.replace(/_/g, ' '))}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!s.is_active && <span className="rounded-full border border-danger/40 px-2 py-0.5 text-xs text-danger">{t('deactivated')}</span>}
                    {s.full_access && <span className="rounded-full bg-brass/20 px-2 py-0.5 text-xs text-brass">{t('Full access')}</span>}
                    {s.is_org_owner && <span className="rounded-full bg-brass/20 px-2 py-0.5 text-xs text-brass">{t('Org Owner')}</span>}
                  </div>
                </div>
              </div>
              {s.role === 'staff' && s.full_access && (
                <p className="mt-1 text-sm text-brass">
                  {t('Owner-equivalent access - sees and does everything the owner can, regardless of assigned sections below.')}
                </p>
              )}
              {(s.role === 'org_owner' || s.is_org_owner) && (
                <p className="mt-1 text-sm text-brass">
                  {t('Manages the multi-location organization this business belongs to - shared menu, suppliers, and consolidated reporting across every linked location.')}
                </p>
              )}
              {s.role === 'staff' && !s.full_access && (
                <p className="mt-1 text-sm text-ivory-dim">
                  {s.assigned_sections === null
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
              {/* Real restructure: a wall of plain underlined text links
                  all read with equal weight, whether "Reset PIN" or
                  "Delete account" - small pill chips (the same shape
                  every other action row in this redesign uses) give each
                  action a real tap target and let color alone separate
                  routine actions from destructive ones, the same way a
                  chat app's own settings rows do. */}
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-line pt-3">
                <button type="button" onClick={() => handleResetPassword(s.id)} className="rounded-full border border-ink-line px-2.5 py-1 text-xs text-ivory-dim hover:border-brass/40 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  {t('Reset password')}
                </button>
                <button type="button" onClick={() => handleResetPin(s.id, s.name)} className="rounded-full border border-ink-line px-2.5 py-1 text-xs text-ivory-dim hover:border-brass/40 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  {t('Reset PIN')}
                </button>
                <button type="button" disabled={resendingId === s.id} onClick={() => handleResendInvite(s.id)} className="rounded-full border border-ink-line px-2.5 py-1 text-xs text-ivory-dim hover:border-brass/40 hover:text-ivory disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  {resendingId === s.id ? t('Resending...') : t('Resend invite')}
                </button>
                {organization && (
                  <button type="button"
                    disabled={togglingOrgOwnerId === s.id}
                    onClick={() => handleToggleOrgOwner(s)}
                    className={`rounded-full border px-2.5 py-1 text-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${s.is_org_owner ? 'border-danger/40 text-danger hover:bg-danger/10' : 'border-brass/40 text-brass hover:bg-brass/10'}`}
                  >
                    {togglingOrgOwnerId === s.id ? t('Updating...') : s.is_org_owner ? t('Revoke org owner') : t('Make org owner')}
                  </button>
                )}
                {(s.role === 'staff' || s.role === 'org_owner') && (
                  <>
                    <button type="button"
                      disabled={togglingActiveId === s.id}
                      onClick={() => handleToggleActive(s)}
                      className="rounded-full border border-ink-line px-2.5 py-1 text-xs text-ivory-dim hover:border-brass/40 hover:text-ivory disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                    >
                      {togglingActiveId === s.id ? t('Updating...') : s.is_active ? t('Deactivate') : t('Reactivate')}
                    </button>
                    <button type="button"
                      disabled={deletingId === s.id}
                      onClick={() => handleDeleteStaff(s)}
                      className="rounded-full border border-danger/40 px-2.5 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                    >
                      {deletingId === s.id ? t('Deleting...') : t('Delete account')}
                    </button>
                  </>
                )}
                {s.role === 'staff' && (
                  <>
                    <button type="button"
                      disabled={togglingFullAccessId === s.id}
                      onClick={() => handleToggleFullAccess(s)}
                      className={`rounded-full border px-2.5 py-1 text-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${s.full_access ? 'border-danger/40 text-danger hover:bg-danger/10' : 'border-brass/40 text-brass hover:bg-brass/10'}`}
                    >
                      {togglingFullAccessId === s.id ? t('Updating...') : s.full_access ? t('Revoke full access') : t('Grant full access')}
                    </button>
                    <button type="button"
                      onClick={() => setEditingSectionsFor(editingSectionsFor === s.id ? null : s.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${editingSectionsFor === s.id ? 'border-brass bg-brass/10 text-brass' : 'border-brass/40 text-brass hover:bg-brass/10'}`}
                    >
                      {editingSectionsFor === s.id ? t('Close') : t('Assign sections')}
                    </button>
                    {isHotel && (
                      <button type="button"
                        onClick={() => setEditingOutletsFor(editingOutletsFor === s.id ? null : s.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${editingOutletsFor === s.id ? 'border-brass bg-brass/10 text-brass' : 'border-brass/40 text-brass hover:bg-brass/10'}`}
                      >
                        {editingOutletsFor === s.id ? t('Close') : t('Assign outlets')}
                      </button>
                    )}
                  </>
                )}
              </div>
              {editingSectionsFor === s.id && (
                <SectionAssignmentForm
                  businessId={businessId}
                  staffMember={s}
                  isHotel={isHotel}
                  onSaved={(updated) => {
                    setStaff((prev) => prev.map((m) => (m.id === updated.id ? { ...m, assigned_sections: updated.assigned_sections } : m)));
                    setEditingSectionsFor(null);
                  }}
                />
              )}
              {editingOutletsFor === s.id && (
                <OutletAssignmentForm
                  businessId={businessId}
                  staffMember={s}
                  outlets={outlets}
                  onSaved={(updated) => {
                    setStaff((prev) => prev.map((m) => (m.id === updated.id ? { ...m, assigned_outlet_ids: updated.assigned_outlet_ids } : m)));
                    setEditingOutletsFor(null);
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <p className="text-base text-ivory-dim">
          {t('New staff sign in with their own email and password — no card needed, since staff sign in through the website. The same account can be open on as many devices at once as needed.')}
        </p>
        <form onSubmit={handleInvite} className="space-y-3 border-t border-ink-line pt-4">
          <div className="flex gap-2.5">
            <Field label={t('Name')}><input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
            <Field label={t('Email')}><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ivory">
            <input type="checkbox" checked={restrictOnInvite} onChange={(e) => setRestrictOnInvite(e.target.checked)} className="accent-brass" />
            {t('Restrict which sections they can see, starting from their very first login')}
          </label>
          {restrictOnInvite && (
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-ink-line bg-ink-soft p-3 sm:grid-cols-3">
              {sectionOptionsFor(isHotel).map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm text-ivory">
                  <input type="checkbox" checked={inviteSections.includes(opt.key)} onChange={() => toggleInviteSection(opt.key)} className="accent-brass" />
                  {t(opt.label)}
                </label>
              ))}
            </div>
          )}
          <PrimaryButton disabled={saving}>{saving ? t('Adding...') : t('Add staff')}</PrimaryButton>
        </form>
        {inviteError && <p className="text-sm text-danger">{inviteError}</p>}
      </Section>

      <Section
        title={t('Organization')}
        action={
          orgLoaded && (
            <button type="button" onClick={() => setShowAppointForm((v) => !v)} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              {showAppointForm ? t('Close') : organization ? t('Appoint another org owner') : t('Set up multi-location')}
            </button>
          )
        }
      >
        {!orgLoaded && <p className="text-ivory-dim">{t('Loading...')}</p>}
        {orgLoaded && organization && (
          <div className="space-y-2">
            <p className="text-base text-ivory-dim">
              {t('This business is part of')} <span className="text-ivory">{organization.name}</span>. {t('Shared menu, suppliers, and consolidated reporting are managed from the org owner account(s) listed above in Team.')}
            </p>
            <button type="button" disabled={leavingOrg} onClick={handleLeaveOrganization} className="text-sm text-danger hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              {leavingOrg ? t('Leaving...') : t('Leave organization')}
            </button>
            {leaveOrgError && <p className="text-sm text-danger">{leaveOrgError}</p>}
          </div>
        )}
        {orgLoaded && !organization && (
          <p className="text-base text-ivory-dim">
            {t('Running more than one location? Set up an organization to share a menu, suppliers, and reporting across all of them - you can appoint yourself or someone on your team to manage it.')}
          </p>
        )}
        {showAppointForm && (
          <OrgOwnerAppointForm
            businessId={businessId}
            existingStaff={staff.filter((s) => (s.role === 'staff' || s.role === 'business_owner') && !s.is_org_owner)}
            hasOrganization={!!organization}
            onAppointed={() => {
              setShowAppointForm(false);
              reload();
              getBusinessOrganization(businessId).then(setOrganization).catch(() => {});
            }}
          />
        )}
      </Section>

      <ShiftReportSection businessId={businessId} />
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
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory" />
          <span className="text-sm text-ivory-dim">{t('to')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory" />
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

// Two ways to appoint an org owner: invite someone brand new (same
// email-invite mechanism as adding staff), or promote an existing staff
// member who already has a working login - no second invite email
// needed for someone already on the team, including the owner
// appointing themselves if they're listed as staff on their own login.
// Creating the organization itself (if this business doesn't have one
// yet) happens automatically as part of the same appointOrgOwner call -
// no separate "create org" step for the person filling this out.
function OrgOwnerAppointForm({ businessId, existingStaff, hasOrganization, onAppointed }: {
  businessId: string; existingStaff: StaffMember[]; hasOrganization: boolean; onAppointed: () => void;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<'invite' | 'promote'>(existingStaff.length > 0 ? 'promote' : 'invite');
  const [staffId, setStaffId] = useState(existingStaff[0]?.id || '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'promote') {
        if (!staffId) { setError(t('Choose a team member to promote')); setSaving(false); return; }
        await appointOrgOwner(businessId, { staffId, orgName: orgName || undefined });
      } else {
        await appointOrgOwner(businessId, { name, email, orgName: orgName || undefined });
      }
      onAppointed();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not appoint org owner'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-2xl border border-ink-line bg-ink-soft p-3">
      {!hasOrganization && (
        <Field label={t('Organization name (optional - defaults to this business\'s name)')}>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} />
        </Field>
      )}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-ivory">
          <input type="radio" checked={mode === 'promote'} onChange={() => setMode('promote')} disabled={existingStaff.length === 0} className="accent-brass" />
          {t('Promote an existing team member')}
        </label>
        <label className="flex items-center gap-2 text-sm text-ivory">
          <input type="radio" checked={mode === 'invite'} onChange={() => setMode('invite')} className="accent-brass" />
          {t('Invite someone new')}
        </label>
      </div>
      {mode === 'promote' && (
        existingStaff.length === 0 ? (
          <p className="text-sm text-ivory-dim">{t('No staff accounts to promote yet - add one under Team first, or invite someone new below.')}</p>
        ) : (
          <Field label={t('Team member')}>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={inputClass}>
              {existingStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )
      )}
      {mode === 'invite' && (
        <div className="flex gap-2.5">
          <Field label={t('Name')}><input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
          <Field label={t('Email')}><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
        </div>
      )}
      <PrimaryButton disabled={saving}>{saving ? t('Appointing...') : t('Appoint org owner')}</PrimaryButton>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
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
    <div className="mt-3 space-y-3 rounded-2xl border border-ink-line bg-ink-soft p-3">
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
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {saving ? t('Saving...') : t('Save')}
        </button>
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
// unrestricted as it was. An empty (non-null) selection is deliberately
// allowed and shown distinctly ("None assigned yet") - a real, correct
// state for a brand-new hire not yet cleared for any outlet, not a bug.
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
    <div className="mt-3 space-y-3 rounded-2xl border border-ink-line bg-ink-soft p-3">
      <p className="text-sm text-ivory-dim">
        {t('Only checked outlets can be selected when this account opens a till - e.g. a beach attendant checked only for "Pool Bar" can never open the Lobby\'s till.')}
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
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {saving ? t('Saving...') : t('Save')}
        </button>
        {staffMember.assigned_outlet_ids !== null && (
          <button type="button" onClick={handleClearRestriction} disabled={saving} className="text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            {t('Remove restriction (any outlet)')}
          </button>
        )}
      </div>
    </div>
  );
}
