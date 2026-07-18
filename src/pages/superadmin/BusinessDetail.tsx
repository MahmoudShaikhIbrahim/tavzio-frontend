import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  getBusiness, setBusinessStatus, deleteBusiness, updateBusinessFeatures,
  listCards, createCards, updateCard, deleteCard,
  listStaff, inviteStaff, setStaffActive,
  getPosIntegration, upsertPosIntegration,
  getPaymentStatus,
  listCustomButtons, createCustomButton, updateCustomButton, deleteCustomButton,
} from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { Field, inputClass } from '../../components/ui';
import type { AdminBusiness, Card, StaffMember, PosIntegration, PosPurpose, PosProvider, CustomButton } from '../../types';

export default function BusinessDetail() {
  const { businessId } = useParams<{ businessId: string }>();
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [busy, setBusy] = useState(false);

  function reload() {
    if (!businessId) return;
    getBusiness(businessId).then(setBusiness);
    listCards(businessId).then(setCards);
    listStaff(businessId).then(setStaff);
  }

  useEffect(reload, [businessId]);

  // Live sync - a rename or status change made from the owner/staff side
  // shows up here instantly.
  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'cards', () => listCards(businessId).then(setCards));
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); reload(); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-ivory">{business.name}</h1>
            <p className="text-base text-ivory-dim">tavzio.com/{business.slug}</p>
          </div>
          <span className="rounded-full border border-brass/40 px-2.5 py-0.5 text-sm capitalize text-brass">
            {business.status}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          {business.status !== 'active' && (
            <ActionButton disabled={busy} onClick={() => withBusy(() => setBusinessStatus(businessId, 'active').then(() => {}))}>
              Activate
            </ActionButton>
          )}
          {business.status === 'active' && (
            <ActionButton disabled={busy} onClick={() => withBusy(() => setBusinessStatus(businessId, 'suspended').then(() => {}))}>
              Suspend
            </ActionButton>
          )}
          <ActionButton
            danger
            disabled={busy}
            onClick={() => {
              if (confirm(`Delete ${business.name}? This cannot be undone.`)) {
                withBusy(() => deleteBusiness(businessId).then(() => { window.location.href = '/admin/super/businesses'; }));
              }
            }}
          >
            Delete
          </ActionButton>
        </div>
      </div>

      {/* Every feature - entitlements you grant, per business. Owner/staff
          have identical self-service controls in their own dashboard now -
          this is here for help/override, not the only place it lives. */}
      <FeaturesSection businessId={businessId} business={business} onChange={reload} />

      {/* POS integration - one section per purpose, only shown once relevant */}
      {business.features?.ordering?.submission && (
        <PosIntegrationSection businessId={businessId} purpose="ordering" providers={['foodics', 'square', 'loyverse', 'custom']} />
      )}
      {business.features?.booking?.submission && (
        <PosIntegrationSection businessId={businessId} purpose="booking" providers={['zenoti', 'fresha', 'square', 'custom']} />
      )}

      {/* Payment (Tap Payments) - owner-only credentials, read-only status here */}
      <PaymentStatusSection businessId={businessId} />

      {/* Custom buttons - full parity with owner/staff */}
      <CustomButtonsSection businessId={businessId} />

      {/* Staff */}
      <Section title="Staff">
        <StaffTable staff={staff} businessId={businessId} onChange={reload} busy={busy} setBusy={setBusy} />
        <InviteStaffForm businessId={businessId} onDone={reload} />
      </Section>

      {/* Table / customer-facing cards only - old admin/owner login cards
          (from before that feature was removed entirely) are deliberately
          excluded here, since they no longer serve any function and don't
          belong in a list of physical table cards. */}
      <Section title={`Table / customer cards (${cards.filter((c) => !c.linked_user_id).length})`}>
        <div className="space-y-1.5">
          {cards.filter((c) => !c.linked_user_id).map((c) => <CardRow key={c.id} card={c} businessId={businessId} onChange={reload} />)}
          {cards.filter((c) => !c.linked_user_id).length === 0 && <p className="text-base text-ivory-dim">No cards yet.</p>}
        </div>
        <AddCardsForm businessId={businessId} onDone={reload} />
      </Section>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-line p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ivory">{title}</h2>
        {action}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, danger }: { children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3.5 py-2 text-base disabled:opacity-50 ${
        danger ? 'border-danger/40 text-danger hover:bg-danger/10' : 'border-brass/40 text-brass hover:bg-brass/10'
      }`}
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-3">
      <div>
        <p className="text-base text-ivory">{label}</p>
        {description && <p className="text-base text-ivory-dim">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`shrink-0 rounded-lg border px-3.5 py-2 text-base disabled:opacity-50 ${
          checked ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'
        }`}
      >
        {checked ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

function FeaturesSection({ businessId, business, onChange }: {
  businessId: string; business: AdminBusiness; onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const ordering = business.features?.ordering;
  const booking = business.features?.booking;

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    await updateBusinessFeatures(businessId, body);
    setSaving(false);
    onChange();
  }

  return (
    <Section title="Features">
      <p className="text-base text-ivory-dim">
        Owner and staff can now toggle all of this themselves too, from
        their own Settings tab — this is here for help or override, not the
        only place it lives anymore.
      </p>

      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-brass">Ordering</p>
        <div className="space-y-2">
          <ToggleRow label="Menu view" description="Customers can browse the menu after tapping."
            checked={!!ordering?.menuView} onChange={(v) => patch({ ordering: { menuView: v } })} disabled={saving} />
          <ToggleRow label="Order submission" description="Customers can actually place an order - Tavzio's own order screen always works, no POS needed."
            checked={!!ordering?.submission} onChange={(v) => patch({ ordering: { submission: v } })} disabled={saving} />
          <ToggleRow label="POS integration" description="Push orders into a connected POS, on top of Tavzio's own screen."
            checked={!!ordering?.posIntegration} onChange={(v) => patch({ ordering: { posIntegration: v } })} disabled={saving} />
          <ToggleRow label="Call waiter" description="Only useful with order submission or POS integration on."
            checked={!!ordering?.callWaiter} onChange={(v) => patch({ ordering: { callWaiter: v } })} disabled={saving || !ordering?.submission} />
          <ToggleRow label="Request bill" description="Only useful with order submission or POS integration on."
            checked={!!ordering?.requestBill} onChange={(v) => patch({ ordering: { requestBill: v } })} disabled={saving || !ordering?.submission} />
        </div>
      </div>

      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-brass">Booking</p>
        <div className="space-y-2">
          <ToggleRow label="Booking page" description="Customers can browse services after tapping."
            checked={!!booking?.menuView} onChange={(v) => patch({ booking: { menuView: v } })} disabled={saving} />
          <ToggleRow label="Booking submission" description="Customers can request an appointment - staff confirm/decline."
            checked={!!booking?.submission} onChange={(v) => patch({ booking: { submission: v } })} disabled={saving} />
          <ToggleRow label="Booking integration" description="Push bookings into a connected system (Zenoti, etc.)."
            checked={!!booking?.integration} onChange={(v) => patch({ booking: { integration: v } })} disabled={saving} />
        </div>
      </div>

      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-brass">Other</p>
        <div className="space-y-2">
          <ToggleRow label="Loyalty program" checked={!!business.features?.loyalty}
            onChange={(v) => patch({ loyalty: v })} disabled={saving} />
          <ToggleRow label="Staff accounts" description="Small businesses that never need a second account can leave this off."
            checked={!!business.features?.staffAccounts} onChange={(v) => patch({ staffAccounts: v })} disabled={saving} />
        </div>
      </div>
    </Section>
  );
}

const PROVIDER_LABEL: Record<PosProvider, string> = {
  foodics: 'Foodics',
  square: 'Square',
  zenoti: 'Zenoti',
  loyverse: 'Loyverse',
  fresha: 'Fresha (no confirmed API - will fail until Fresha grants access)',
  tap: 'Tap Payments',
  custom: 'Custom (no-code connector)',
};

function PosIntegrationSection({ businessId, purpose, providers }: {
  businessId: string; purpose: PosPurpose; providers: PosProvider[];
}) {
  const [integration, setIntegration] = useState<PosIntegration | null>(null);
  const [provider, setProvider] = useState<PosProvider>(providers[0]);
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPosIntegration(businessId, purpose as 'ordering' | 'booking').then((data) => {
      setIntegration(data);
      if (data) {
        setProvider(data.provider);
        setEnabled(data.enabled);
        setConfig(data.config || {});
      }
      setLoaded(true);
    });
  }, [businessId, purpose]);

  async function handleSave() {
    setSaving(true);
    const updated = await upsertPosIntegration(businessId, purpose as 'ordering' | 'booking', provider, enabled, config);
    setIntegration(updated);
    setSaving(false);
  }

  if (!loaded) return null;

  const fieldsFor: Record<PosProvider, { key: string; label: string }[]> = {
    foodics: [{ key: 'accessToken', label: 'Access token' }, { key: 'branchId', label: 'Branch ID' }],
    square: [{ key: 'accessToken', label: 'Access token' }, { key: 'locationId', label: 'Location ID' }],
    zenoti: [{ key: 'apiKey', label: 'API key' }, { key: 'centerId', label: 'Center ID' }],
    loyverse: [{ key: 'accessToken', label: 'Access token' }, { key: 'storeId', label: 'Store ID' }],
    fresha: [],
    tap: [{ key: 'secretKey', label: 'Secret key' }],
    custom: [
      { key: 'endpoint', label: 'Endpoint URL' },
      { key: 'authHeaderName', label: 'Auth header name (e.g. Authorization)' },
      { key: 'authHeaderValue', label: 'Auth header value (e.g. Bearer abc123)' },
      { key: 'bodyTemplate', label: 'Body template ({{table}}, {{note}}, {{total}}, {{items}})' },
      { key: 'responseIdPath', label: 'Response ID path (e.g. data.id)' },
    ],
  };

  return (
    <Section title={`POS integration — ${purpose}`}>
      {integration?.status && (
        <p className="text-base">
          Status: <span className={integration.status === 'connected' ? 'text-success' : integration.status === 'error' ? 'text-danger' : 'text-ivory-dim'}>
            {integration.status}
          </span>
        </p>
      )}

      <div className="space-y-3 rounded-lg border border-ink-line p-3">
        <Field label="Provider">
          <select value={provider} onChange={(e) => setProvider(e.target.value as PosProvider)} className={inputClass}>
            {providers.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
          </select>
        </Field>

        {provider === 'fresha' ? (
          <p className="text-base text-ivory-dim">
            No confirmed public API exists for Fresha - enabling this will fail until
            Fresha grants private/partner API access. Contact them directly first.
          </p>
        ) : (
          fieldsFor[provider].map((f) =>
            f.key === 'bodyTemplate' ? (
              <Field key={f.key} label={f.label}>
                <textarea
                  value={config[f.key] || ''}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                  rows={4}
                  placeholder='{"table": {{table}}, "total": {{total}}, "items": {{items}}}'
                  className={`${inputClass} font-mono text-base`}
                />
              </Field>
            ) : (
              <Field key={f.key} label={f.label}>
                <input
                  value={config[f.key] || ''}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                  className={inputClass}
                />
              </Field>
            )
          )
        )}

        <label className="flex items-center gap-2 text-base text-ivory-dim">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brass" />
          Enabled
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save integration'}
        </button>
      </div>
    </Section>
  );
}

// Read-only for super_admin, deliberately - the owner sets up their own Tap
// Payments credentials from their own Settings; this is just a status
// check for support purposes, never the secret key itself.
function PaymentStatusSection({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<{ enabled: boolean; status: string } | null>(null);

  useEffect(() => {
    getPaymentStatus(businessId).then(setStatus);
  }, [businessId]);

  return (
    <Section title="Payments (Tap Payments)">
      <p className="text-base text-ivory-dim">
        Set up by the owner directly, from their own Settings — the secret
        key is never visible here, only whether it's connected.
      </p>
      <p className="text-base">
        Status: <span className={status?.enabled ? 'text-success' : 'text-ivory-dim'}>
          {status?.enabled ? `connected (${status.status})` : 'not connected'}
        </span>
      </p>
    </Section>
  );
}

const ICON_OPTIONS = ['Link', 'Star', 'Gift', 'Music', 'ShoppingBag', 'Heart', 'Phone', 'Mail', 'Globe', 'MapPin', 'Camera', 'Ticket'];

function CustomButtonsSection({ businessId }: { businessId: string }) {
  const [buttons, setButtons] = useState<CustomButton[]>([]);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    listCustomButtons(businessId).then(setButtons);
  }
  useEffect(reload, [businessId]);

  return (
    <Section
      title="Custom buttons"
      action={
        <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
          + Add button
        </button>
      }
    >
      <p className="text-base text-ivory-dim">
        Beyond the fixed 7 links - a brand-new button with its own label,
        icon, and link. Owner and staff can manage these too.
      </p>
      {showForm && <CustomButtonForm businessId={businessId} onDone={() => { setShowForm(false); reload(); }} />}
      <div className="space-y-1.5">
        {buttons.map((b) => <CustomButtonRow key={b.id} button={b} businessId={businessId} onChange={reload} />)}
        {buttons.length === 0 && <p className="text-base text-ivory-dim">No custom buttons yet.</p>}
      </div>
    </Section>
  );
}

function CustomButtonForm({ businessId, existing, onDone }: { businessId: string; existing?: CustomButton; onDone: () => void }) {
  const [label, setLabel] = useState(existing?.label || '');
  const [icon, setIcon] = useState(existing?.icon || 'Link');
  const [url, setUrl] = useState(existing?.url || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (existing) {
      await updateCustomButton(businessId, existing.id, { label, icon, url });
    } else {
      await createCustomButton(businessId, { label, icon, url });
    }
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-3 rounded-lg border border-ink-line p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label"><input required value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} /></Field>
        <Field label="Icon">
          <select value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass}>
            {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
      </div>
      <Field label="URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputClass} /></Field>
      <button disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink disabled:opacity-50">
        {saving ? 'Saving...' : existing ? 'Save changes' : 'Add button'}
      </button>
    </form>
  );
}

function CustomButtonRow({ button, businessId, onChange }: { button: CustomButton; businessId: string; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <CustomButtonForm businessId={businessId} existing={button} onDone={() => { setEditing(false); onChange(); }} />;

  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-2 text-base">
      <span className="text-ivory">{button.label} <span className="text-ivory-dim">· {button.icon}</span></span>
      <div className="flex items-center gap-2">
        <ActionButton onClick={() => updateCustomButton(businessId, button.id, { enabled: !button.enabled }).then(onChange)}>
          {button.enabled ? 'On' : 'Off'}
        </ActionButton>
        <ActionButton onClick={() => setEditing(true)}>Edit</ActionButton>
        <ActionButton danger onClick={() => deleteCustomButton(businessId, button.id).then(onChange)}>Delete</ActionButton>
      </div>
    </div>
  );
}

function StaffTable({ staff, businessId, onChange, busy, setBusy }: {
  staff: StaffMember[]; businessId: string; onChange: () => void; busy: boolean; setBusy: (b: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      {staff.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-2 text-base">
          <span className="text-ivory">{s.name} <span className="text-ivory-dim">· {s.role.replace('_', ' ')}</span></span>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await setStaffActive(businessId, s.id, !s.is_active);
              setBusy(false);
              onChange();
            }}
            className="text-base text-ivory-dim hover:text-ivory"
          >
            {s.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      ))}
    </div>
  );
}

function InviteStaffForm({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await inviteStaff(businessId, name, email);
    setName(''); setEmail('');
    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
      <input placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
      <button disabled={loading} className="shrink-0 rounded-lg bg-brass px-3.5 py-2 text-base font-medium text-ink disabled:opacity-50">
        Add staff
      </button>
    </form>
  );
}

function AddCardsForm({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const [count, setCount] = useState(1);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await createCards(businessId, count, label);
    setLabel('');
    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex gap-2 border-t border-ink-line pt-3">
      <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))}
        className="w-20 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
      <input placeholder="Label (e.g. Table 4)" value={label} onChange={(e) => setLabel(e.target.value)}
        className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
      <button disabled={loading} className="shrink-0 rounded-lg bg-brass px-3.5 py-2 text-base font-medium text-ink disabled:opacity-50">
        Add
      </button>
    </form>
  );
}

function CardRow({ card, businessId, onChange }: { card: Card; businessId: string; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(card.label);
  const [copied, setCopied] = useState(false);
  const tapUrl = `${window.location.origin}/t/${card.uid}`;

  async function saveLabel() {
    await updateCard(businessId, card.id, { label });
    setEditing(false);
    onChange();
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(tapUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-line px-3.5 py-2 text-base">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {editing ? (
          <>
            <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus
              className="w-40 rounded border border-brass/40 bg-ink px-2 py-1 text-base text-ivory" />
            <button onClick={saveLabel} className="text-base text-brass hover:underline">Save</button>
            <button onClick={() => { setEditing(false); setLabel(card.label); }} className="text-base text-ivory-dim hover:text-ivory">Cancel</button>
          </>
        ) : (
          <>
            <span className="truncate text-ivory">{card.label || 'Untitled'}</span>
            <span className="shrink-0 font-mono text-base text-ivory-dim">{card.uid}</span>
            <button onClick={() => setEditing(true)} className="shrink-0 text-base text-brass hover:underline">Rename</button>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={copyUrl} className="rounded border border-ink-line px-2 py-1 text-base text-ivory-dim hover:text-ivory">
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
        <select
          value={card.status}
          onChange={(e) => updateCard(businessId, card.id, { status: e.target.value }).then(onChange)}
          className="rounded border border-ink-line bg-ink px-2 py-1 text-base text-ivory-dim"
        >
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="lost">lost</option>
          <option value="disabled">disabled</option>
        </select>
        <button
          onClick={() => {
            if (confirm(`Permanently delete this card? If the physical chip still exists, it will stop working entirely - only do this for a genuinely broken or lost card.`)) {
              deleteCard(businessId, card.id).then(onChange);
            }
          }}
          className="rounded border border-danger/40 px-2 py-1 text-base text-danger hover:bg-danger/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
