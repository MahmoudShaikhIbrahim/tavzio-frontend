import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  getBusiness, setBusinessStatus, deleteBusiness, updateBusiness,
  listCards, createCards, updateCard, deleteCard,
  getPaymentStatus,
  listReceipts, createReceipt, voidReceipt, downloadReceiptPdf,
  createContract, sendContract, listContracts, previewContract, generateContractReceipt, resetAccountPassword, issueAdminCard,
} from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { ContractStatusLabel } from './ContractsListPage';
import { Field, inputClass } from '../../components/ui';
import type { AdminBusiness, Card, BillingReceipt, BillingReceiptLineItem, Contract } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { useSession } from '../../hooks/useSession';
import { listLinkedAccounts, createLinkedAccount, deleteLinkedAccount, type LinkedAccount } from '../../lib/authApi';

export default function BusinessDetail() {
  const confirm = useConfirm();
  const { businessId } = useParams<{ businessId: string }>();
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [busy, setBusy] = useState(false);

  function reload() {
    if (!businessId) return;
    getBusiness(businessId).then(setBusiness);
    listCards(businessId).then(setCards);
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
        <AdminCardIssue business={business} businessId={businessId} />
        <LinkAccountSection business={business} />

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
            onClick={async () => {
              if (await confirm({ title: 'Delete business?', message: `Delete ${business.name}? This cannot be undone.`, confirmLabel: 'Delete', danger: true })) {
                withBusy(() => deleteBusiness(businessId).then(() => { window.location.href = '/admin/super/businesses'; }));
              }
            }}
          >
            Delete
          </ActionButton>
        </div>
      </div>

      {/* Per your simplified structure: only Payments, Contracts, and
          Table/Room cards live here by default. Feature toggles, POS
          integration hookup, custom buttons, and staff already have full
          self-service parity in the owner's own dashboard - this page is
          for the handful of things that are genuinely super-admin-only. */}
      <PaymentStatusSection businessId={businessId} />

      <ContractsSection businessId={businessId} />

      {/* Table / customer-facing cards only - old admin/owner login cards
          (from before that feature was removed entirely) are deliberately
          excluded here, since they no longer serve any function and don't
          belong in a list of physical table cards. Hotels see "Rooms"
          instead, since a hotel guest card maps to a room, not a table. */}
      <Section title={`${business.category === 'hotel' ? 'Room' : 'Table / customer'} cards (${cards.filter((c) => !c.linked_user_id).length})`}>
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
    <button type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-5 py-4 text-base disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${
        danger ? 'border-danger/40 text-danger hover:bg-danger/10 focus-visible:ring-danger' : 'border-brass/40 text-brass hover:bg-brass/10 focus-visible:ring-brass'
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
      <button type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`shrink-0 rounded-lg border px-5 py-4 text-base disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${
          checked ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'
        }`}
      >
        {checked ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

// Read-only for super_admin, deliberately - the owner sets up their own Tap
// Payments credentials from their own Settings; this is just a status
// check for support purposes, never the secret key itself.
function PaymentStatusSection({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<{ enabled: boolean; status: string } | null>(null);
  const [receipts, setReceipts] = useState<BillingReceipt[]>([]);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    getPaymentStatus(businessId).then(setStatus);
    listReceipts(businessId).then(setReceipts);
  }
  useEffect(reload, [businessId]);

  return (
    <Section
      title="Payments"
      action={
        <button type="button" onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          + New receipt
        </button>
      }
    >
      <div className="rounded-lg border border-ink-line p-4">
        <p className="text-base text-ivory">Payment gateway</p>
        <p className="mt-1 text-sm text-ivory-dim">
          Set up by the owner directly, from their own Settings — the secret
          key is never visible here, only whether it's connected.
        </p>
        <p className="mt-2 text-base">
          Status: <span className={status?.enabled ? 'text-success' : 'text-ivory-dim'}>
            {status?.enabled ? `connected (${status.status})` : 'not connected'}
          </span>
        </p>
      </div>

      <div>
        <p className="mb-2 text-base text-ivory">Billing receipts</p>
        <p className="mb-3 text-sm text-ivory-dim">
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
      </div>
    </Section>
  );
}

const BUSINESS_TYPES = ['restaurant', 'cafe', 'retail', 'hotel', 'salon', 'clinic', 'gym', 'other'];

// Business Type determines which product architecture a business gets
// (restaurant/F&B vs the hotel PMS+F&B system) - locked after
// onboarding everywhere except here, since changing it is a structural
// operation with real consequences, not a normal profile edit.
function BusinessTypeEditor({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(business.category);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (value === business.category) { setEditing(false); return; }
    if (!(await confirm({ title: 'Change business type?', message: `Change Business Type from "${business.category}" to "${value}"? This changes which features and dashboard this business gets.`, danger: true }))) return;
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
          <select value={value} onChange={(e) => setValue(e.target.value)} className="rounded border border-ink-line bg-ink px-2 py-1 text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" onClick={handleSave} disabled={saving} className="text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => { setValue(business.category); setEditing(false); }} className="text-ivory-dim hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Cancel</button>
        </>
      ) : (
        <>
          <span className="capitalize text-ivory">{business.category}</span>
          <button type="button" onClick={() => setEditing(true)} className="text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Change</button>
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
  const confirm = useConfirm();
  const [result, setResult] = useState<{ name: string; tempPassword: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (!(await confirm({ title: 'Reset password?', message: `Reset the owner's password for ${business.name}? They'll get a new temporary password and must set their own on next login.`, confirmLabel: 'Reset password' }))) return;
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
          <button type="button" onClick={() => setResult(null)} className="mt-1 text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Dismiss</button>
        </div>
      ) : (
        <button type="button" onClick={handleReset} disabled={resetting} className="text-sm text-brass hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {resetting ? 'Resetting...' : "Reset owner's password"}
        </button>
      )}
    </div>
  );
}

// Real fix for a confirmed gap: creating a link was already possible on
// the backend (super_admin only, by design - see linkedAccountsController
// for why), but there was no interface for it at all. Scoped to the
// realistic case this exists for: linking THIS business's owner account
// to whichever super_admin account is currently viewing this page, so
// the fast switch-without-signing-out flow actually has something to
// switch to.
function LinkAccountSection({ business }: { business: AdminBusiness }) {
  const { user } = useSession();
  const confirm = useConfirm();
  const [links, setLinks] = useState<LinkedAccount[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    listLinkedAccounts().then(setLinks).catch(() => {});
  }
  useEffect(reload, []);

  const existingLink = links.find((l) => l.account.id === business.owner);

  async function handleLink() {
    if (!user) return;
    setCreating(true);
    setError('');
    try {
      await createLinkedAccount(user.id, business.owner);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create link');
    } finally {
      setCreating(false);
    }
  }

  async function handleUnlink() {
    if (!existingLink) return;
    if (!(await confirm({ title: 'Remove this link?', message: `Remove the link between your account and ${business.name}'s owner? You'll need to sign in separately to switch between them afterward.`, danger: true }))) return;
    await deleteLinkedAccount(existingLink.linkId);
    reload();
  }

  return (
    <div className="mt-2">
      <p className="text-sm text-ivory-dim">
        {existingLink
          ? `Linked to your account since ${new Date(existingLink.linkedSince).toLocaleDateString()} - switch to it any time from your account menu, no sign-in needed.`
          : "Not linked to your account yet - link it to switch between this business's owner account and your own without signing out."}
      </p>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={existingLink ? handleUnlink : handleLink}
        disabled={creating}
        className={`mt-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${
          existingLink ? 'border-danger/40 text-danger hover:bg-danger/10 focus-visible:ring-danger' : 'border-brass/40 text-brass hover:bg-brass/10 focus-visible:ring-brass'
        }`}
      >
        {creating ? 'Linking...' : existingLink ? 'Remove link' : 'Link to my account'}
      </button>
    </div>
  );
}

function AdminCardIssue({ business, businessId }: { business: AdminBusiness; businessId: string }) {
  const confirm = useConfirm();
  const [issued, setIssued] = useState<Card | null>(null);
  const [issuing, setIssuing] = useState(false);

  async function handleIssue() {
    if (!(await confirm({ title: 'Issue new admin card?', message: `Issue a fresh admin login card for ${business.name}'s admin account? Any old admin card stops working immediately, and they'll be signed out everywhere.`, danger: true }))) return;
    setIssuing(true);
    try {
      const card = await issueAdminCard(businessId, business.owner);
      setIssued(card);
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="mt-2">
      {issued ? (
        <div className="rounded-lg border border-brass/40 bg-ink-soft p-3 text-sm">
          <p className="text-ivory">New admin card issued - write this UID to the physical NFC card:</p>
          <p className="mt-1 select-all rounded bg-ink px-2.5 py-1.5 font-mono text-base text-brass">{issued.uid}</p>
          <button type="button" onClick={() => setIssued(null)} className="mt-1 text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Dismiss</button>
        </div>
      ) : (
        <button type="button" onClick={handleIssue} disabled={issuing} className="text-sm text-brass hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {issuing ? 'Issuing...' : 'Reissue admin login card'}
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
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

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
    setMessage(null);
    try {
      const receipt = await generateContractReceipt(businessId, contractId);
      setMessage({ text: `Receipt ${receipt.receipt_number} generated${receipt.ziinaError ? ` (no payment link: ${receipt.ziinaError})` : ''}`, isError: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not generate receipt', isError: true });
    }
  }

  async function handleSend(contractId: string) {
    setMessage(null);
    try {
      const res = await sendContract(businessId, contractId);
      setMessage({ text: res.message, isError: false });
      reload();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not send contract', isError: true });
    }
  }

  return (
    <Section
      title="Contracts"
      action={
        <button type="button" onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          + New contract
        </button>
      }
    >
      <p className="text-base text-ivory-dim">
        Every contract is a fixed 1-year term - only the payment frequency changes. Send it for the owner to
        e-sign inside their dashboard; once signed, generate installment receipts against it as payments come due.
      </p>
      {showForm && <ContractForm businessId={businessId} onDone={() => setShowForm(false)} onReload={reload} />}
      {message && <p className={`text-sm ${message.isError ? 'text-danger' : 'text-success'}`}>{message.text}</p>}
      <div className="space-y-3">
        {contracts.map((c) => (
          <div key={c.id} className="rounded-lg border border-ink-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-medium text-ivory">{c.contract_number}</p>
                <p className="text-sm text-ivory-dim">
                  {c.start_date} → {c.end_date} · {c.payment_frequency} · AED {c.annual_total_aed.toFixed(2)}/yr ·{' '}
                  <ContractStatusLabel status={c.status} />
                  {c.signed_by_name && ` · signed by ${c.signed_by_name}`}
                </p>
                {c.countdown && (
                  <p className="mt-1 text-sm">
                    <span className={c.countdown.daysToBilling <= 3 ? 'font-medium text-warning' : 'text-ivory-dim'}>
                      Next receipt: {new Date(c.countdown.nextBillingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-ivory-dim"> · </span>
                    <span className={c.countdown.daysToExpiry <= c.countdown.expiryWarningDays ? 'font-medium text-danger' : 'text-ivory-dim'}>
                      Renews: {new Date(c.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {c.status === 'draft' && (
                  <button type="button" onClick={() => handleSend(c.id)} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                    Send to client
                  </button>
                )}
                <button type="button" onClick={() => handlePreview(c.id)} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  {previewingId === c.id ? 'Hide' : 'Preview'}
                </button>
                {(c.status === 'signed' || c.status === 'active') && (
                  <button type="button" onClick={() => handleGenerateReceipt(c.id)} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
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
  const [planType, setPlanType] = useState<'connect' | 'full'>('connect');
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
        planType,
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
          <select value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value as typeof paymentFrequency)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </Field>
        <Field label="Plan">
          <select value={planType} onChange={(e) => setPlanType(e.target.value as typeof planType)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            <option value="connect">Tavzio Connect</option>
            <option value="full">Tavzio Full</option>
          </select>
        </Field>
        <Field label="Number of stands">
          <input type="number" min={0} onFocus={(e) => e.target.select()} value={standsCount} onChange={(e) => setStandsCount(Number(e.target.value))} className="w-32 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <Field label="System fee override (AED, optional)">
          <input value={systemFeeOverride} onChange={(e) => setSystemFeeOverride(e.target.value)} placeholder="Auto-filled from plan + business type" className="w-56 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
        </Field>
        <Field label="Card price override (AED, optional)">
          <input value={cardPriceOverride} onChange={(e) => setCardPriceOverride(e.target.value)} placeholder="20" className="w-40 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" />
        </Field>
      </div>
      {error && <p className="text-base text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
        {saving ? 'Creating...' : 'Create contract'}
      </button>
    </form>
  );
}

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
        <select value={receiptType} onChange={(e) => setReceiptType(e.target.value as typeof receiptType)} className="w-48 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
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
              <select value={termYears} onChange={(e) => setTermYears(e.target.value as typeof termYears)} className="w-36 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
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
          <Field label="Override amount (AED excl. VAT, optional)">
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
            <Field label="Override total (AED excl. VAT, optional)">
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
        <p className="text-sm text-ivory-dim">Additional items (optional - discounts, one-off fees, etc). Amounts excl. VAT - 5% is added automatically.</p>
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
              placeholder="AED excl. VAT"
              className="w-28 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
            />
            <button type="button" onClick={() => setExtraLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-sm text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setExtraLines((prev) => [...prev, { description: '', amount: 0 }])} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          + Add item
        </button>
      </div>

      <Field label="Notes (optional, shown on the receipt)">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </Field>

      <div className="flex items-center justify-between border-t border-ink-line pt-3">
        <div className="text-base text-ivory">
          <p>Subtotal (excl. VAT): <span className="text-ivory-dim">AED {total.toFixed(2)}</span></p>
          <p>VAT (5%): <span className="text-ivory-dim">AED {(total * 0.05).toFixed(2)}</span></p>
          <p>Total to charge: <span className="font-medium text-brass">AED {(total * 1.05).toFixed(2)}</span></p>
        </div>
        <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {saving ? 'Generating...' : 'Generate & send'}
        </button>
      </div>
      {error && <p className="text-base text-danger">{error}</p>}
    </form>
  );
}

function ReceiptRow({ receipt, businessId, onChange }: { receipt: BillingReceipt; businessId: string; onChange: () => void }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function handleVoid() {
    if (!(await confirm({ title: 'Delete receipt?', message: `Delete receipt ${receipt.receipt_number}? This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return;
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
        <button type="button"
          onClick={() => downloadReceiptPdf(businessId, receipt.id, receipt.receipt_number)}
          className="rounded-lg border border-brass/40 px-3 py-1.5 text-sm text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          Download
        </button>
        <ActionButton danger onClick={handleVoid} disabled={busy}>Delete</ActionButton>
      </div>
    </div>
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
      <button disabled={loading} className="shrink-0 rounded-lg bg-brass px-5 py-4 text-base font-medium text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
        Add
      </button>
    </form>
  );
}

function CardRow({ card, cards, businessId, onCardsChange, onChange }: {
  card: Card; cards: Card[]; businessId: string; onCardsChange: (c: Card[]) => void; onChange: () => void;
}) {
  const confirm = useConfirm();
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
            <button type="button" onClick={saveLabel} className="text-base text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Save</button>
            <button type="button" onClick={() => { setEditing(false); setLabel(card.label); }} className="text-base text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Cancel</button>
          </>
        ) : (
          <>
            <span className="truncate text-ivory">{card.label || 'Untitled'}</span>
            <span className="shrink-0 font-mono text-base text-ivory-dim">{card.uid}</span>
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-base text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Rename</button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copyUrl} className="rounded border border-ink-line px-2 py-1 text-base text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
        <select
          value={card.status}
          onChange={(e) => {
            const status = e.target.value as Card['status'];
            onCardsChange(cards.map((c) => (c.id === card.id ? { ...c, status } : c)));
            updateCard(businessId, card.id, { status }).catch(onChange);
          }}
          className="rounded border border-ink-line bg-ink px-2 py-1 text-base text-ivory-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="lost">lost</option>
          <option value="disabled">disabled</option>
        </select>
        <button type="button"
          onClick={async () => {
            if (await confirm({ title: 'Delete card?', message: `Permanently delete this card? If the physical chip still exists, it will stop working entirely - only do this for a genuinely broken or lost card.`, confirmLabel: 'Delete', danger: true })) {
              onCardsChange(cards.filter((c) => c.id !== card.id));
              deleteCard(businessId, card.id).catch(onChange);
            }
          }}
          className="rounded border border-danger/40 px-2 py-1 text-base text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
