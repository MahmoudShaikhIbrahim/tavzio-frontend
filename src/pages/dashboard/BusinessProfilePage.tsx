import { useEffect, useState, type ChangeEvent, type FormEvent, type CSSProperties } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getBusiness, updateBusiness, updateMyTour, listStaff, getBusinessOrganization, appointOrgOwner, leaveOrganization, setOrgOwnerStatus, type BusinessOrganization } from '../../lib/authApi';
import { uploadBusinessImage } from '../../lib/supabaseClient';
import type { AdminBusiness, StaffMember } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';
import { buildBusinessThemeVars } from '../../lib/businessTheme';
import WeeklyHoursEditor, { type WeeklyHours } from '../../components/WeeklyHoursEditor';
import ChangePasswordPage from './ChangePasswordPage';
import { useConfirm } from '../../components/ConfirmDialog';


export default function BusinessProfilePage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [tab, setTab] = useState<'profile' | 'appearance' | 'organization' | 'account'>('profile');
  // Digital Business Card is fully built (Settings tab, super admin
  // multi-card page, public /card/:slug page, QR/vCard, analytics) but
  // hidden from the UI until Apple/Google Wallet is worth building -
  // re-add 'digitalCard' to the tuple below and to TABS_UI to bring it back.

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  const tabLabels: Record<typeof tab, string> = { profile: 'Profile', appearance: 'Appearance', organization: 'Organization', account: 'Account' };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">{t('Business Profile')}</h1>
      <div className="flex gap-2">
        {(['profile', 'appearance', 'organization', 'account'] as const).map((tabKey) => (
          <button type="button" key={tabKey} onClick={() => setTab(tabKey)} className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${tab === tabKey ? 'bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/40 hover:text-ivory'}`}>
            {t(tabLabels[tabKey])}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileForm business={business} businessId={businessId} onSaved={setBusiness} />}
      {tab === 'appearance' && <AppearanceSection business={business} businessId={businessId} onSaved={setBusiness} />}
      {/* Genuinely a Business Profile concern, not a Staff one - who
          manages the shared menu/suppliers/reporting across every
          location this business belongs to has nothing to do with
          managing this one business's own team roster. */}
      {tab === 'organization' && <OrganizationSection businessId={businessId} />}
      {/* Change Password (and Preferred language) live here, not as their
          own settings entry - personal account security and preference,
          not business configuration, so they belong alongside "who am I /
          how do I sign in" rather than mixed into the business's own profile. */}
      {tab === 'account' && (
        <div className="space-y-6">
          <ChangePasswordPage />
          <RestartGuideSection />
        </div>
      )}
    </div>
  );
}

function ProfileForm({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
  const { t } = useT();
  const [name, setName] = useState(business.name);
  const [description, setDescription] = useState(business.description);
  const category = business.category;
  const [logoUrl, setLogoUrl] = useState(business.logo_url);
  const [coverImageUrl, setCoverImageUrl] = useState(business.cover_image_url);
  const [trn, setTrn] = useState(business.trn || '');
  const [tourismDirhamRateAed, setTourismDirhamRateAed] = useState(business.tourism_dirham_rate_aed || 0);
  const [operatingHours, setOperatingHours] = useState<WeeklyHours>(business.operating_hours || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const updated = await updateBusiness(businessId, { name, description, logoUrl, coverImageUrl, trn, tourismDirhamRateAed, operatingHours } as Partial<AdminBusiness>);
    onSaved(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_1.6fr] lg:items-start">
      {/* A live preview, not a form field - the identity being edited
          shown as it will actually appear, rather than asking an owner
          to imagine it from a name field and a URL string. */}
      <div className="lg:sticky lg:top-6">
        <div className="overflow-hidden rounded-2xl border border-brass/30 bg-ink-soft shadow-xl">
          <div className="flex h-28 items-center justify-center border-b border-ink-line bg-ink bg-cover bg-center" style={coverImageUrl ? { backgroundImage: `url(${coverImageUrl})` } : undefined}>
            {!coverImageUrl && <p className="font-mono text-[10px] uppercase tracking-widest text-ivory-dim/30">No cover image</p>}
          </div>
          <div className="flex flex-col items-center px-6 pb-6 pt-0">
            <div className="-mt-10 h-20 w-20 overflow-hidden rounded-full border-4 border-ink-soft bg-ink shadow-lg">
              {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center font-display text-2xl text-brass/50">{name[0]?.toUpperCase() || '?'}</div>}
            </div>
            <p className="mt-3 font-display text-xl text-ivory">{name || t('Business name')}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">{category}</p>
            <p className="mt-3 text-center text-sm leading-relaxed text-ivory-dim">{description || t('Add a description so guests know what to expect.')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Section title={t('Identity')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Name')}>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t('Business type')}>
              <div className="rounded-lg border border-ink-line bg-ink-soft/50 px-3.5 py-2.5 text-base text-ivory-dim">
                <span className="capitalize">{category}</span> <span className="text-xs">{t('(contact Tavzio to change)')}</span>
              </div>
            </Field>
          </div>
          <Field label={t('Description')}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className={inputClass} />
          </Field>
          <div className="mt-4">
            <p className="mb-1 text-sm text-ivory">{t('Opening hours')}</p>
            <p className="mb-2 text-xs text-ivory-dim">{t('Real hours per day - a day left as "No restriction" is treated as always open. Online Booking\'s own time picker follows these unless you set separate booking hours.')}</p>
            <WeeklyHoursEditor value={operatingHours} onChange={setOperatingHours} />
          </div>
        </Section>

        <Section title={t('Media')}>
          <ImageUploadField label={t('Logo')} businessId={businessId} kind="logo" value={logoUrl} onUploaded={setLogoUrl} />
          <ImageUploadField label={t('Cover image')} businessId={businessId} kind="cover" value={coverImageUrl} onUploaded={setCoverImageUrl} />
        </Section>

        <Section title={t('Tax & compliance')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Your TRN (optional)')}>
              <input value={trn} onChange={(e) => setTrn(e.target.value)} placeholder="100000000000003" className={inputClass} />
            </Field>
            {category === 'hotel' && (
              <Field label={t('Tourism Dirham, per room per night (AED)')}>
                <input
                  type="number"
                  min={0}
                  step={1}
                  onFocus={(e) => e.target.select()}
                  value={tourismDirhamRateAed}
                  onChange={(e) => setTourismDirhamRateAed(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            )}
          </div>
          <p className="text-sm text-ivory-dim">
            {t("Your own Tax Registration Number - shown on Tavzio's invoices to you, so you can reclaim VAT on your subscription. Has no effect on your own customers' receipts.")}
          </p>
        </Section>

        <div className="flex items-center gap-3">
          <PrimaryButton disabled={saving}>{saving ? t('Saving...') : t('Save profile')}</PrimaryButton>
          {saved && <p className="text-sm text-success">{t('Saved.')}</p>}
        </div>
      </div>
    </form>
  );
}


function ImageUploadField({ label, businessId, kind, value, onUploaded }: {
  label: string; businessId: string; kind: 'logo' | 'cover'; value: string; onUploaded: (url: string) => void;
}) {
  const { t } = useT();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadBusinessImage(businessId, file, kind);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // allow re-selecting the same file if needed
    }
  }

  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {value && (
          <img
            src={value}
            alt=""
            className={kind === 'logo' ? 'h-14 w-14 rounded-full border border-ink-line object-cover' : 'h-14 w-24 rounded-md border border-ink-line object-cover'}
          />
        )}
        <div className="flex-1">
          <label className="inline-block cursor-pointer rounded-full border border-ink-line px-5 py-3 text-base text-ivory-dim hover:text-ivory">
            {uploading ? t('Uploading...') : value ? t('Replace image') : t('Upload image')}
            <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
          </label>
          {error && <p className="mt-1 text-base text-danger">{error}</p>}
        </div>
      </div>
      <input
        value={value}
        onChange={(e) => onUploaded(e.target.value)}
        placeholder={t('Or paste an image URL directly')}
        className={`${inputClass} mt-2`}
      />
    </Field>
  );
}

// =========================================================================
// Appearance — "1 click, 1 color" for Background/Buttons, one pair for
// the customer-facing pages (Landing/Menu/Bill/Booking), one shared
// business-wide for the owner/staff dashboard. Just sets two hex values
// on businesses.theme - buildBusinessThemeVars derives the full palette
// (including automatic text contrast) from those on the actual pages.
// =========================================================================

function ColorPairPicker({ title, description, background, button, onChange, previewVars }: {
  title: string;
  description: string;
  background: string | null;
  button: string | null;
  onChange: (next: { background: string | null; button: string | null }) => void;
  previewVars: CSSProperties;
}) {
  const { t } = useT();
  const DEFAULT_BG = '#141110';
  const DEFAULT_BUTTON = '#b8925a';

  return (
    <div className="space-y-3 rounded-2xl border border-ink-line p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-medium text-ivory">{title}</p>
          <p className="text-sm text-ivory-dim">{description}</p>
        </div>
        {(background || button) && (
          <button
            type="button"
            onClick={() => onChange({ background: null, button: null })}
            className="shrink-0 text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            {t('Use default')}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex flex-col items-center gap-1.5">
          <span className="text-sm text-ivory-dim">{t('Background')}</span>
          <input
            type="color"
            value={background || DEFAULT_BG}
            onChange={(e) => onChange({ background: e.target.value, button })}
            className="h-11 w-11 cursor-pointer rounded-full border border-ink-line bg-transparent p-0"
          />
        </label>
        <label className="flex flex-col items-center gap-1.5">
          <span className="text-sm text-ivory-dim">{t('Buttons')}</span>
          <input
            type="color"
            value={button || DEFAULT_BUTTON}
            onChange={(e) => onChange({ background, button: e.target.value })}
            className="h-11 w-11 cursor-pointer rounded-full border border-ink-line bg-transparent p-0"
          />
        </label>
        <div className="flex h-11 flex-1 min-w-[8rem] items-center justify-center rounded-lg" style={previewVars}>
          <div className="rounded-lg bg-ink px-4 py-2">
            <span className="rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-ink">{t('Preview')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceSection({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
  const { t } = useT();
  const [customerBackground, setCustomerBackground] = useState(business.theme.customerBackground);
  const [customerButton, setCustomerButton] = useState(business.theme.customerButton);
  const [dashboardBackground, setDashboardBackground] = useState(business.theme.dashboardBackground);
  const [dashboardButton, setDashboardButton] = useState(business.theme.dashboardButton);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const updated = await updateBusiness(businessId, {
        theme: { customerBackground, customerButton, dashboardBackground, dashboardButton },
      } as Partial<AdminBusiness>);
      onSaved(updated);
      // Dashboard colors are shared business-wide - apply immediately for
      // everyone on this device rather than waiting for a fresh login.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save appearance settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={t('Appearance')}
      action={
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-full bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {saving ? t('Saving...') : t('Save')}
        </button>
      }
    >
      <p className="text-base text-ivory-dim">
        {t("One click, one color - matches your own brand across your customer-facing pages and, separately, your team's dashboard. Text color adjusts automatically so it always stays readable.")}
      </p>
      <ColorPairPicker
        title={t('Landing page, Menu & Bill')}
        description={t('Applies everywhere a customer sees after tapping your NFC card.')}
        background={customerBackground}
        button={customerButton}
        onChange={({ background, button }) => { setCustomerBackground(background); setCustomerButton(button); }}
        previewVars={buildBusinessThemeVars(customerBackground, customerButton)}
      />
      <ColorPairPicker
        title={t('Owner/staff dashboard')}
        description={t('Shared for your whole team - not a personal preference.')}
        background={dashboardBackground}
        button={dashboardButton}
        onChange={({ background, button }) => { setDashboardBackground(background); setDashboardButton(button); }}
        previewVars={buildBusinessThemeVars(dashboardBackground, dashboardButton)}
      />
      {error && <p className="text-base text-danger">{error}</p>}
    </Section>
  );
}

// A staff member (or owner) who skipped the tour, or just wants to see
// it from the beginning, gets a real way back to it - this is the
// permanent home for that, confirmed as the right place: inside
// Business Profile, not buried in a settings toggle nobody would think
// to look for. Reloads the page on success rather than trying to
// coordinate with DashboardLayout's tour state directly - the two
// pages don't otherwise share any state, and a full reload guarantees
// the dashboard re-fetches the account fresh (tour_completed_at now
// null) and the tour genuinely restarts from step one.
function RestartGuideSection() {
  const { t } = useT();
  const [restarting, setRestarting] = useState(false);

  async function handleRestart() {
    setRestarting(true);
    try {
      await updateMyTour(false);
      window.location.href = '/admin/dashboard';
    } catch {
      setRestarting(false);
    }
  }

  return (
    <Section title={t('Guided Tour')}>
      <p className="text-base text-ivory-dim">
        {t('Skipped the guided tour, or want to see it again? Restart it here - it walks through the main navigation from the beginning. You can also reopen it anytime from the ? button next to your name.')}
      </p>
      <ActionButton onClick={handleRestart} loading={restarting}>
        {t('Restart guide')}
      </ActionButton>
    </Section>
  );
}

// Moved here from the old Staff page - running more than one location is
// a Business Profile-level concern (which of your locations shares a
// menu/suppliers/reporting, and who manages that), not something that
// belongs mixed into your own team roster. Fetches its own staff list
// (rather than reusing StaffPage's) since this page has no other reason
// to share state with it - the two are genuinely independent now.
function OrganizationSection({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [organization, setOrganization] = useState<BusinessOrganization | null>(null);
  const [orgLoaded, setOrgLoaded] = useState(false);
  const [showAppointForm, setShowAppointForm] = useState(false);
  const [leavingOrg, setLeavingOrg] = useState(false);
  const [leaveOrgError, setLeaveOrgError] = useState('');
  const [togglingOrgOwnerId, setTogglingOrgOwnerId] = useState<string | null>(null);

  function reloadStaff() {
    listStaff(businessId).then(setStaff).catch(() => {});
  }
  useEffect(reloadStaff, [businessId]);
  useEffect(() => {
    getBusinessOrganization(businessId)
      .then((org) => { setOrganization(org); setOrgLoaded(true); })
      .catch(() => setOrgLoaded(true));
  }, [businessId]);

  // Same "don't strand the org" server-side check as leaving an
  // organization uses - works on any role (including the owner's own
  // row), since is_org_owner is a capability layered on top of role, not
  // tied to a specific one (migration 0098).
  async function handleToggleOrgOwner(s: StaffMember) {
    if (togglingOrgOwnerId === s.id) return;
    const next = !s.is_org_owner;
    const message = next
      ? t('Give {name} org-management access? They will manage the shared menu, suppliers, and consolidated reporting for every location in this organization.').replace('{name}', s.name)
      : t('Remove org-management access from {name}? Their regular account stays exactly as it is - only the org piece goes away.').replace('{name}', s.name);
    if (!(await confirm({ title: next ? t('Grant org owner?') : t('Revoke org owner?'), message, danger: !next }))) return;
    setTogglingOrgOwnerId(s.id);
    try {
      await setOrgOwnerStatus(businessId, s.id, next);
      reloadStaff();
      getBusinessOrganization(businessId).then(setOrganization).catch(() => {});
    } catch (err) {
      setLeaveOrgError(err instanceof Error ? err.message : 'Could not update org owner status');
    } finally {
      setTogglingOrgOwnerId(null);
    }
  }

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
      await leaveOrganization(businessId);
      setOrganization(null);
      reloadStaff();
    } catch (err) {
      setLeaveOrgError(err instanceof Error ? err.message : 'Could not leave organization');
    } finally {
      setLeavingOrg(false);
    }
  }

  const orgOwners = staff.filter((s) => s.is_org_owner);

  return (
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
            {t('This business is part of')} <span className="text-ivory">{organization.name}</span>.
          </p>
          {orgOwners.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {orgOwners.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 rounded-full bg-brass/15 px-3 py-1.5 text-sm text-brass">
                  {s.name}
                  <button type="button"
                    disabled={togglingOrgOwnerId === s.id}
                    onClick={() => handleToggleOrgOwner(s)}
                    title={t('Revoke org owner')}
                    className="rounded-full text-brass/70 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-50"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
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
            reloadStaff();
            getBusinessOrganization(businessId).then(setOrganization).catch(() => {});
          }}
        />
      )}
    </Section>
  );
}

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