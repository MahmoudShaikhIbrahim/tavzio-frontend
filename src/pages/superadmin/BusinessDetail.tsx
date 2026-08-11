import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  getBusiness, setBusinessStatus, deleteBusiness, updateBusiness, updateBusinessFeatures,
  listCards, createCards, updateCard, deleteCard,
  listStaff, inviteStaff, setStaffActive,
  getPosIntegration, upsertPosIntegration,
  getPaymentStatus,
  listCustomButtons, createCustomButton, updateCustomButton, deleteCustomButton,
  listReceipts, createReceipt, voidReceipt, downloadReceiptPdf,
  createContract, sendContract, listContracts, previewContract, generateContractReceipt, resetAccountPassword,
} from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { Field, inputClass } from '../../components/ui';
import type { AdminBusiness, Card, StaffMember, PosIntegration, PosPurpose, PosProvider, CustomButton, BillingReceipt, BillingReceiptLineItem, Contract } from '../../types';

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

        <BusinessTypeEditor business={business} businessId={businessId} onSaved={setBusiness} />
        <OwnerPasswordReset business={business} businessId={businessId} />

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

      {/* Billing receipts - issued to this business, one at a time */}
      <ContractsSection businessId={businessId} />
      <ReceiptsSection businessId={businessId} />

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
        <div className="space-y-4">
          {cards.filter((c) => !c.linked_user_id).map((c) => <CardRow key={c.id} card={c} cards={cards} businessId={businessId} onCardsChange={setCards} onChange={reload} />)}
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
      className={`rounded-lg border px-5 py-4 text-base disabled:opacity-50 ${
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
        className={`shrink-0 rounded-lg border px-5 py-4 text-base disabled:opacity-50 ${
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
  // Never actually offered here - this section only ever lists ordering/
  // booking providers (see PosIntegrationSection's `providers` prop).
  // Printing lives in its own owner-only settings page, not this
  // super_admin POS picker. Only present so the exhaustive PosProvider
  // record below still type-checks.
  printnode: 'PrintNode',
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
    // Never actually offered here - same reason as PROVIDER_LABEL above.
    printnode: [],
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

const BUSINESS_TYPES = ['restaurant', 'cafe', 'retail', 'hotel', 'salon', 'clinic', 'gym', 'other'];

// Business Type determines which product architecture a business gets
// (restaurant/F&B vs the hotel PMS+F&B system) - locked after
// onboarding everywhere except here, since changing it is a structural
// operation with real consequences, not a normal profile edit.
function BusinessTypeEditor({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(business.category);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (value === business.category) { setEditing(false); return; }
    if (!confirm(`Change Business Type from "${business.category}" to "${value}"? This changes which features and dashboard this business gets.`)) return;
    setSaving(true);
    try {
      const updated = await updateBusiness(businessId, { category: value } as Partial<AdminBusiness>);
      onSaved(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-sm">
      <span className="text-ivory-dim">Business Type:</span>
      {editing ? (
        <>
          <select value={value} onChange={(e) => setValue(e.target.value)} className="rounded border border-ink-line bg-ink px-2 py-1 text-ivory">
            {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={handleSave} disabled={saving} className="text-brass hover:underline">{saving ? 'Saving...' : 'Save'}</button>
          <button onClick={() => { setValue(business.category); setEditing(false); }} className="text-ivory-dim hover:underline">Cancel</button>
        </>
      ) : (
        <>
          <span className="capitalize text-ivory">{business.category}</span>
          <button onClick={() => setEditing(true)} className="text-brass hover:underline">Change</button>
        </>
      )}
    </div>
  );
}

// The super admin's fix for "the owner is locked out and can't get
// back in" - the same problem existed on this side too, since the
// only password-changing capability that existed before was for a
// user changing their own password while already logged in.
function OwnerPasswordReset({ business, businessId }: { business: AdminBusiness; businessId: string }) {
  const [result, setResult] = useState<{ name: string; tempPassword: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (!confirm(`Reset the owner's password for ${business.name}? They'll get a new temporary password and must set their own on next login.`)) return;
    setResetting(true);
    try {
      const res = await resetAccountPassword(businessId, business.owner);
      setResult(res);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="mt-2">
      {result ? (
        <div className="rounded-lg border border-brass/40 bg-ink-soft p-3 text-sm">
          <p className="text-ivory">New temporary password:</p>
          <p className="mt-1 select-all rounded bg-ink px-2.5 py-1.5 font-mono text-base text-brass">{result.tempPassword}</p>
          <button onClick={() => setResult(null)} className="mt-1 text-ivory-dim hover:text-ivory">Dismiss</button>
        </div>
      ) : (
        <button onClick={handleReset} disabled={resetting} className="text-sm text-brass hover:underline disabled:opacity-50">
          {resetting ? 'Resetting...' : "Reset owner's password"}
        </button>
      )}
    </div>
  );
}

function ContractsSection({ businessId }: { businessId: string }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');

  function reload() {
    listContracts(businessId).then(setContracts);
  }
  useEffect(reload, [businessId]);

  async function handlePreview(contractId: string) {
    if (previewingId === contractId) { setPreviewingId(null); return; }
    const res = await previewContract(businessId, contractId);
    setPreviewText(res.text);
    setPreviewingId(contractId);
  }

  async function handleGenerateReceipt(contractId: string) {
    try {
      const receipt = await generateContractReceipt(businessId, contractId);
      alert(`Receipt ${receipt.receipt_number} generated${receipt.ziinaError ? ` (no payment link: ${receipt.ziinaError})` : ''}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not generate receipt');
    }
  }

  async function handleSend(contractId: string) {
    try {
      const res = await sendContract(businessId, contractId);
      alert(res.message);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not send contract');
    }
  }

  return (
    <Section
      title="Contracts"
      action={
        <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
          + New contract
        </button>
      }
    >
      <p className="text-base text-ivory-dim">
        Every contract is a fixed 1-year term - only the payment frequency changes. Send it for the owner to
        e-sign inside their dashboard; once signed, generate installment receipts against it as payments come due.
      </p>
      {showForm && <ContractForm businessId={businessId} onDone={() => setShowForm(false)} onReload={reload} />}
      <div className="space-y-3">
        {contracts.map((c) => (
          <div key={c.id} className="rounded-lg border border-ink-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-medium text-ivory">{c.contract_number}</p>
                <p className="text-sm text-ivory-dim">
                  {c.start_date} → {c.end_date} · {c.payment_frequency} · AED {c.annual_total_aed.toFixed(2)}/yr ·{' '}
                  <span className={c.status === 'signed' || c.status === 'active' ? 'text-success' : 'text-ivory-dim'}>{c.status}</span>
                  {c.signed_by_name && ` · signed by ${c.signed_by_name}`}
                </p>
              </div>
              <div className="flex gap-2">
                {c.status === 'draft' && (
                  <button onClick={() => handleSend(c.id)} className="text-sm text-brass hover:underline">
                    Send to client
                  </button>
                )}
                <button onClick={() => handlePreview(c.id)} className="text-sm text-brass hover:underline">
                  {previewingId === c.id ? 'Hide' : 'Preview'}
                </button>
                {(c.status === 'signed' || c.status === 'active') && (
                  <button onClick={() => handleGenerateReceipt(c.id)} className="text-sm text-brass hover:underline">
                    Generate next receipt
                  </button>
                )}
              </div>
            </div>
            {previewingId === c.id && (
              <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-soft p-4 text-sm text-ivory-dim">{previewText}</pre>
            )}
          </div>
        ))}
        {contracts.length === 0 && <p className="text-base text-ivory-dim">No contracts yet.</p>}
      </div>
    </Section>
  );
}

function ContractForm({ businessId, onDone, onReload }: { businessId: string; onDone: () => void; onReload: () => void }) {
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [standsCount, setStandsCount] = useState(0);
  const [systemFeeOverride, setSystemFeeOverride] = useState('');
  const [cardPriceOverride, setCardPriceOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createContract(businessId, {
        startDate,
        paymentFrequency,
        standsCount,
        systemFeeOverride: systemFeeOverride ? Number(systemFeeOverride) : undefined,
        cardPriceOverride: cardPriceOverride ? Number(cardPriceOverride) : undefined,
      });
      onReload();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create contract');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4 rounded-lg border border-ink-line p-4">
      <div className="flex flex-wrap gap-4">
        <Field label="Start date">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
        </Field>
        <Field label="Payment frequency">
          <select value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value as typeof paymentFrequency)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </Field>
        <Field label="Number of stands">
          <input type="number" min={0} onFocus={(e) => e.target.select()} value={standsCount} onChange={(e) => setStandsCount(Number(e.target.value))} className="w-32 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <Field label="System fee override (AED, optional)">
          <input value={systemFeeOverride} onChange={(e) => setSystemFeeOverride(e.target.value)} placeholder="200" className="w-40 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
        </Field>
        <Field label="Card price override (AED, optional)">
          <input value={cardPriceOverride} onChange={(e) => setCardPriceOverride(e.target.value)} placeholder="20" className="w-40 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
        </Field>
      </div>
      {error && <p className="text-base text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
        {saving ? 'Creating...' : 'Create contract'}
      </button>
    </form>
  );
}

function ReceiptsSection({ businessId }: { businessId: string }) {
  const [receipts, setReceipts] = useState<BillingReceipt[]>([]);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    listReceipts(businessId).then(setReceipts);
  }
  useEffect(reload, [businessId]);

  return (
    <Section
      title="Billing receipts"
      action={
        <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
          + New receipt
        </button>
      }
    >
      <p className="text-base text-ivory-dim">
        Issued directly to this business's own Receipts page the moment
        you generate one - stamped with whatever stamp and signature is
        currently active in Billing Settings, frozen onto that receipt
        permanently.
      </p>
      {showForm && <ReceiptForm businessId={businessId} onDone={() => setShowForm(false)} onReload={reload} />}
      <div className="space-y-3">
        {receipts.map((r) => <ReceiptRow key={r.id} receipt={r} businessId={businessId} onChange={reload} />)}
        {receipts.length === 0 && <p className="text-base text-ivory-dim">No receipts issued yet.</p>}
      </div>
    </Section>
  );
}

// Standard pricing - the defaults applied automatically unless a specific
// receipt overrides them. Kept as constants here (not fetched from
// anywhere) since this is Tavzio's own internal billing tool, not
// something a business ever sees or configures.
const DEFAULT_SYSTEM_FEE_AED = 200;
const DEFAULT_CARD_PRICE_AED = 20;

function formatLongDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Builds the professional contract-period sentence from a start date and a
// term length - never a raw date shown on its own.
function buildPeriodSentence(startDate: string, termYears: '1' | '2' | '3' | 'custom', customMonths: number) {
  if (!startDate) return '';
  const start = new Date(startDate);
  const end = new Date(start);
  const isCustom = termYears === 'custom';
  if (isCustom) {
    end.setMonth(end.getMonth() + (customMonths || 0));
  } else {
    end.setFullYear(end.getFullYear() + Number(termYears));
  }
  const termWords = isCustom
    ? `${customMonths}-month`
    : `${termYears}-year`;
  return `This agreement is effective from ${formatLongDate(start)} through ${formatLongDate(end)}, covering a ${termWords} service term.`;
}

function ReceiptForm({ businessId, onDone, onReload }: { businessId: string; onDone: () => void; onReload: () => void }) {
  const [receiptType, setReceiptType] = useState<'one_time' | 'monthly' | 'adjustment'>('one_time');

  // Contract term - only relevant for a monthly subscription receipt.
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [termYears, setTermYears] = useState<'1' | '2' | '3' | 'custom'>('1');
  const [customMonths, setCustomMonths] = useState(12);

  // Structured, auto-priced components - the normal way to bill. Both
  // default on for a fresh monthly receipt, but either can be switched
  // off independently (e.g. billing a one-time customer for cards only).
  const [includeSystem, setIncludeSystem] = useState(true);
  const [systemOverride, setSystemOverride] = useState('');
  const [includeStands, setIncludeStands] = useState(true);
  const [standsQty, setStandsQty] = useState(0);
  const [standsOverride, setStandsOverride] = useState('');

  // Free-form extras - for anything outside the two standard components
  // (a discount adjustment, a one-off fee, etc).
  const [extraLines, setExtraLines] = useState<BillingReceiptLineItem[]>([]);

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const systemAmount = systemOverride !== '' ? Number(systemOverride) : DEFAULT_SYSTEM_FEE_AED;
  const standsAmount = standsOverride !== '' ? Number(standsOverride) : standsQty * DEFAULT_CARD_PRICE_AED;

  function updateExtraLine(i: number, field: 'description' | 'amount', value: string) {
    setExtraLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: field === 'amount' ? Number(value) : value } : l)));
  }

  const validExtraLines = extraLines.filter((l) => l.description.trim() && l.amount > 0);
  const total =
    (includeSystem ? systemAmount : 0) +
    (includeStands && standsQty > 0 ? standsAmount : 0) +
    validExtraLines.reduce((sum, l) => sum + Number(l.amount), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const lineItems: BillingReceiptLineItem[] = [];
    if (includeSystem) {
      lineItems.push({
        description: 'Tavzio platform subscription — monthly access to the full digital guest engagement system',
        amount: systemAmount,
      });
    }
    if (includeStands && standsQty > 0) {
      lineItems.push({
        description: `Supply and provisioning of ${standsQty} NFC-enabled table stand${standsQty === 1 ? '' : 's'}`,
        amount: standsAmount,
      });
    }
    lineItems.push(...validExtraLines);

    if (lineItems.length === 0) {
      setError('Include the system fee, a number of stands, or at least one additional item');
      return;
    }

    const periodLabel = receiptType === 'monthly' ? buildPeriodSentence(startDate, termYears, customMonths) : '';

    setSaving(true);
    try {
      const receipt = await createReceipt(businessId, { receiptType, lineItems, periodLabel, notes });
      onReload();
      if (receipt.ziinaError) {
        // The receipt itself saved fine (by design, this is best-effort) -
        // but no payment_link_url was generated, so the business's Pay
        // Now button won't show for it. Keep the form open with the real
        // reason visible instead of silently closing as if everything
        // worked - that silence was exactly why a reissue could fail
        // the same way twice with no indication anything was wrong.
        setError(`Receipt ${receipt.receipt_number} was created, but Ziina did not return a payment link: ${receipt.ziinaError}. The receipt exists without a "Pay now" button until this is resolved and reissued.`);
        return;
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create receipt');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4 rounded-lg border border-ink-line p-4">
      <Field label="Receipt type">
        <select value={receiptType} onChange={(e) => setReceiptType(e.target.value as typeof receiptType)} className="w-48 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
          <option value="one_time">One-time</option>
          <option value="monthly">Monthly subscription</option>
          <option value="adjustment">Adjustment</option>
        </select>
      </Field>

      {receiptType === 'monthly' && (
        <div className="space-y-3 rounded-lg border border-ink-line p-3">
          <p className="text-sm text-ivory-dim">Contract term</p>
          <div className="flex flex-wrap gap-4">
            <Field label="Start date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
            </Field>
            <Field label="Term length">
              <select value={termYears} onChange={(e) => setTermYears(e.target.value as typeof termYears)} className="w-36 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                <option value="1">1 year</option>
                <option value="2">2 years</option>
                <option value="3">3 years</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            {termYears === 'custom' && (
              <Field label="Months">
                <input type="number" min={1} onFocus={(e) => e.target.select()} value={customMonths} onChange={(e) => setCustomMonths(Number(e.target.value))} className="w-24 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
              </Field>
            )}
          </div>
          <p className="text-sm text-ivory-dim italic">{buildPeriodSentence(startDate, termYears, customMonths) || 'Set a start date to preview the contract sentence.'}</p>
        </div>
      )}

      <div className="space-y-3">
        <ToggleRow
          label="Platform subscription"
          description={`Defaults to AED ${DEFAULT_SYSTEM_FEE_AED}/month unless overridden below`}
          checked={includeSystem}
          onChange={setIncludeSystem}
        />
        {includeSystem && (
          <Field label="Override amount (AED, optional)">
            <input
              type="number"
              onFocus={(e) => e.target.select()}
              value={systemOverride}
              onChange={(e) => setSystemOverride(e.target.value)}
              placeholder={String(DEFAULT_SYSTEM_FEE_AED)}
              className="w-40 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
            />
          </Field>
        )}

        <ToggleRow
          label="NFC table stands"
          description={`Priced automatically at AED ${DEFAULT_CARD_PRICE_AED}/stand unless overridden below`}
          checked={includeStands}
          onChange={setIncludeStands}
        />
        {includeStands && (
          <div className="flex flex-wrap gap-4">
            <Field label="Number of stands">
              <input
                type="number"
                min={0}
                onFocus={(e) => e.target.select()}
                value={standsQty || ''}
                onChange={(e) => setStandsQty(Number(e.target.value))}
                className="w-32 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
              />
            </Field>
            <Field label="Override total (AED, optional)">
              <input
                type="number"
                onFocus={(e) => e.target.select()}
                value={standsOverride}
                onChange={(e) => setStandsOverride(e.target.value)}
                placeholder={standsQty > 0 ? String(standsQty * DEFAULT_CARD_PRICE_AED) : ''}
                className="w-40 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-ivory-dim">Additional items (optional - discounts, one-off fees, etc)</p>
        {extraLines.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={line.description}
              onChange={(e) => updateExtraLine(i, 'description', e.target.value)}
              placeholder="e.g. Loyalty setup discount"
              className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
            />
            <input
              type="number"
              onFocus={(e) => e.target.select()}
              value={line.amount || ''}
              onChange={(e) => updateExtraLine(i, 'amount', e.target.value)}
              placeholder="AED"
              className="w-28 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
            />
            <button type="button" onClick={() => setExtraLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-sm text-danger hover:underline">
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setExtraLines((prev) => [...prev, { description: '', amount: 0 }])} className="text-sm text-brass hover:underline">
          + Add item
        </button>
      </div>

      <Field label="Notes (optional, shown on the receipt)">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </Field>

      <div className="flex items-center justify-between border-t border-ink-line pt-3">
        <p className="text-base text-ivory">Total: <span className="font-medium text-brass">AED {total.toFixed(2)}</span></p>
        <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? 'Generating...' : 'Generate & send'}
        </button>
      </div>
      {error && <p className="text-base text-danger">{error}</p>}
    </form>
  );
}

function ReceiptRow({ receipt, businessId, onChange }: { receipt: BillingReceipt; businessId: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleVoid() {
    if (!confirm(`Delete receipt ${receipt.receipt_number}? This can't be undone.`)) return;
    setBusy(true);
    await voidReceipt(businessId, receipt.id);
    setBusy(false);
    onChange();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-line px-4 py-3 text-base sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-ivory">
          {receipt.receipt_number} <span className="text-ivory-dim">— {receipt.period_label || receipt.receipt_type.replace('_', ' ')}</span>
          <span className={`ms-2 inline-block rounded-full border px-2 py-0.5 text-xs ${receipt.payment_status === 'paid' ? 'border-success/40 text-success' : 'border-ink-line text-ivory-dim'}`}>
            {receipt.payment_status === 'paid' ? 'Paid' : 'Awaiting payment'}
          </span>
        </p>
        <p className="text-sm text-ivory-dim">{new Date(receipt.created_at).toLocaleDateString()} · AED {Number(receipt.amount).toFixed(2)}</p>
        {receipt.payment_link_url && receipt.payment_status !== 'paid' && (
          <a href={receipt.payment_link_url} target="_blank" rel="noreferrer" className="text-sm text-brass hover:underline">
            Payment link ↗
          </a>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => downloadReceiptPdf(businessId, receipt.id, receipt.receipt_number)}
          className="rounded-lg border border-brass/40 px-3 py-1.5 text-sm text-brass hover:bg-brass/10"
        >
          Download
        </button>
        <ActionButton danger onClick={handleVoid} disabled={busy}>Delete</ActionButton>
      </div>
    </div>
  );
}

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
      <div className="space-y-4">
        {buttons.map((b) => <CustomButtonRow key={b.id} button={b} buttons={buttons} businessId={businessId} onButtonsChange={setButtons} onChange={reload} />)}
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

function CustomButtonRow({ button, buttons, businessId, onButtonsChange, onChange }: {
  button: CustomButton; buttons: CustomButton[]; businessId: string; onButtonsChange: (b: CustomButton[]) => void; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) return <CustomButtonForm businessId={businessId} existing={button} onDone={() => { setEditing(false); onChange(); }} />;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-line px-5 py-4 text-base sm:flex-row sm:items-center sm:justify-between">
      <span className="text-ivory">{button.label} <span className="text-ivory-dim">· {button.icon}</span></span>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          onClick={() => {
            onButtonsChange(buttons.map((b) => (b.id === button.id ? { ...b, enabled: !b.enabled } : b)));
            updateCustomButton(businessId, button.id, { enabled: !button.enabled }).catch(onChange);
          }}
        >
          {button.enabled ? 'On' : 'Off'}
        </ActionButton>
        <ActionButton onClick={() => setEditing(true)}>Edit</ActionButton>
        <ActionButton
          danger
          onClick={() => {
            onButtonsChange(buttons.filter((b) => b.id !== button.id));
            deleteCustomButton(businessId, button.id).catch(onChange);
          }}
        >
          Delete
        </ActionButton>
      </div>
    </div>
  );
}

function StaffTable({ staff, businessId, onChange, busy, setBusy }: {
  staff: StaffMember[]; businessId: string; onChange: () => void; busy: boolean; setBusy: (b: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {staff.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded-lg border border-ink-line px-5 py-4 text-base">
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
      <button disabled={loading} className="shrink-0 rounded-lg bg-brass px-5 py-4 text-base font-medium text-ink disabled:opacity-50">
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
    <form onSubmit={submit} className="flex gap-2.5 border-t border-ink-line pt-4">
      <input type="number" onFocus={(e) => e.target.select()} min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))}
        className="w-20 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
      <input placeholder="Label (e.g. Table 4)" value={label} onChange={(e) => setLabel(e.target.value)}
        className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
      <button disabled={loading} className="shrink-0 rounded-lg bg-brass px-5 py-4 text-base font-medium text-ink disabled:opacity-50">
        Add
      </button>
    </form>
  );
}

function CardRow({ card, cards, businessId, onCardsChange, onChange }: {
  card: Card; cards: Card[]; businessId: string; onCardsChange: (c: Card[]) => void; onChange: () => void;
}) {
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
    <div className="flex flex-col gap-3 rounded-lg border border-ink-line px-5 py-4 text-base sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
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
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={copyUrl} className="rounded border border-ink-line px-2 py-1 text-base text-ivory-dim hover:text-ivory">
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
        <select
          value={card.status}
          onChange={(e) => {
            const status = e.target.value as Card['status'];
            onCardsChange(cards.map((c) => (c.id === card.id ? { ...c, status } : c)));
            updateCard(businessId, card.id, { status }).catch(onChange);
          }}
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
              onCardsChange(cards.filter((c) => c.id !== card.id));
              deleteCard(businessId, card.id).catch(onChange);
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
