import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listStaff, inviteStaff, deleteStaffAccount, resendStaffInvite, setStaffActive, setStaffSections, setStaffOutlets, setStaffFullAccess, resetAccountPassword, listStaffShifts, getBusiness, listHotelOutlets, type StaffShift } from '../../lib/authApi';
import type { StaffMember, HotelOutlet } from '../../types';
import { SECTION_OPTIONS, sectionOptionsFor } from '../../lib/dashboardSections';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';

export default function StaffPage() {
  const { user } = useSession();
  const { t } = useT();
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
  const [editingSectionsFor, setEditingSectionsFor] = useState<string | null>(null);
  const [editingOutletsFor, setEditingOutletsFor] = useState<string | null>(null);
  const [isHotel, setIsHotel] = useState(false);
  const [outlets, setOutlets] = useState<HotelOutlet[]>([]);

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  function reload() {
    if (!businessId) return;
    setLoadError('');
    listStaff(businessId)
      .then((rows) => { setStaff(rows); setLoaded(true); })
      .catch((err) => { setLoadError(err instanceof Error ? err.message : 'Could not load staff'); setLoaded(true); });
  }

  useEffect(reload, [businessId]);

  // Live-updates the Team list on any staff/owner profile change for this
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
    if (!confirm(t('Permanently delete {name}\'s account? This cannot be undone - all their history stays on past records, but the account itself is gone. If you just want to block their access, use Deactivate instead.').replace('{name}', s.name))) return;
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
    if (!confirm(t("Reset this account's password? They will be given a new temporary password and forced to set their own on next login."))) return;
    const result = await resetAccountPassword(businessId!, userId);
    setResetResult(result);
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
  // responses land, depending on which one wins the race. The confirm()
  // dialog blocks the UI thread, so it can't be what's producing repeat
  // requests - only a second real click after the first one returns can.
  async function handleToggleFullAccess(s: StaffMember) {
    if (togglingFullAccessId === s.id) return;
    const next = !s.full_access;
    const message = next
      ? t('Give {name} full owner-equivalent access? They will be able to see and do everything you can, including billing, contracts, and staff management.').replace('{name}', s.name)
      : t('Revoke full access from {name}? They will go back to only their assigned sections.').replace('{name}', s.name);
    if (!confirm(message)) return;
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

  return (
    <div className="space-y-10">
      {resendMessage && (
        <div className="rounded-lg border border-brass/40 bg-ink-soft px-4 py-3">
          <p className="text-base text-ivory">{resendMessage}</p>
          <button type="button" onClick={() => setResendMessage('')} className="mt-1 text-sm text-ivory-dim hover:text-ivory">{t('Dismiss')}</button>
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
          <button type="button" onClick={() => setResetResult(null)} className="mt-2 text-sm text-ivory-dim hover:text-ivory">{t('Dismiss')}</button>
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
            <div key={s.id} className="rounded-lg border border-ink-line px-5 py-4 text-base">
              <div className="flex items-center justify-between">
                <span className="text-ivory">
                  {s.name} <span className="text-ivory-dim">· {s.role === 'business_owner' ? t('Owner') : t(s.role.replace(/_/g, ' '))}</span>
                  {!s.is_active && <span className="ml-2 text-base text-danger">{t('deactivated')}</span>}
                  {s.full_access && <span className="ml-2 rounded-full bg-brass/20 px-2 py-0.5 text-sm text-brass">{t('Full access')}</span>}
                </span>
              </div>
              {s.role === 'staff' && s.full_access && (
                <p className="mt-1 text-sm text-brass">
                  {t('Owner-equivalent access - sees and does everything the owner can, regardless of assigned sections below.')}
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
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <button type="button" onClick={() => handleResetPassword(s.id)} className="text-sm text-ivory-dim hover:text-ivory">
                  {t('Reset password')}
                </button>
                <button type="button" disabled={resendingId === s.id} onClick={() => handleResendInvite(s.id)} className="text-sm text-ivory-dim hover:text-ivory disabled:opacity-50">
                  {resendingId === s.id ? t('Resending...') : t('Resend invite')}
                </button>
                {s.role === 'staff' && (
                  <>
                    <button type="button"
                      disabled={togglingActiveId === s.id}
                      onClick={() => handleToggleActive(s)}
                      className="text-sm text-ivory-dim hover:text-ivory disabled:opacity-50"
                    >
                      {togglingActiveId === s.id ? t('Updating...') : s.is_active ? t('Deactivate') : t('Reactivate')}
                    </button>
                    <button type="button"
                      disabled={deletingId === s.id}
                      onClick={() => handleDeleteStaff(s)}
                      className="text-sm text-danger hover:underline disabled:opacity-50"
                    >
                      {deletingId === s.id ? t('Deleting...') : t('Delete account')}
                    </button>
                    <button type="button"
                      disabled={togglingFullAccessId === s.id}
                      onClick={() => handleToggleFullAccess(s)}
                      className={`text-sm hover:underline disabled:opacity-50 ${s.full_access ? 'text-danger' : 'text-brass'}`}
                    >
                      {togglingFullAccessId === s.id ? t('Updating...') : s.full_access ? t('Revoke full access') : t('Grant full access')}
                    </button>
                    <button type="button"
                      onClick={() => setEditingSectionsFor(editingSectionsFor === s.id ? null : s.id)}
                      className="text-sm text-brass hover:underline"
                    >
                      {editingSectionsFor === s.id ? t('Close') : t('Assign sections')}
                    </button>
                    {isHotel && (
                      <button type="button"
                        onClick={() => setEditingOutletsFor(editingOutletsFor === s.id ? null : s.id)}
                        className="text-sm text-brass hover:underline"
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
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-ink-line bg-ink-soft p-3 sm:grid-cols-3">
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
    listStaffShifts(businessId, { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }).then(setShifts);
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
          <div key={staffTotal.name} className="rounded-lg border border-ink-line px-4 py-3">
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
    <div className="mt-3 space-y-3 rounded-lg border border-ink-line bg-ink-soft p-3">
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
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? t('Saving...') : t('Save')}
        </button>
        {staffMember.assigned_sections !== null && (
          <button type="button" onClick={handleClearRestriction} disabled={saving} className="text-sm text-ivory-dim hover:text-ivory">
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
    <div className="mt-3 space-y-3 rounded-lg border border-ink-line bg-ink-soft p-3">
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
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? t('Saving...') : t('Save')}
        </button>
        {staffMember.assigned_outlet_ids !== null && (
          <button type="button" onClick={handleClearRestriction} disabled={saving} className="text-sm text-ivory-dim hover:text-ivory">
            {t('Remove restriction (any outlet)')}
          </button>
        )}
      </div>
    </div>
  );
}
