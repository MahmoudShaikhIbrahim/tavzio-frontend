import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getBusiness,
  listAccounts, createAccount, seedDefaultAccounts,
  listJournalEntries, createJournalEntry, postJournalEntry, voidJournalEntry, getTrialBalance,
  listVendors, createVendor, listApBills, createApBill, recordApPayment,
  listArInvoices, createArInvoice, recordArReceipt,
} from '../../lib/authApi';
import type { AdminBusiness, ChartAccount, JournalEntry, JournalEntryLine, TrialBalance, Vendor, ApBill, ArInvoice } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';

export default function AccountingPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!businessId || !business) return <p className="text-ivory-dim">Loading...</p>;

  if (!business.features.accounting?.enabled) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="font-display text-3xl text-ivory">Accounting</h1>
        <p className="text-base text-ivory-dim">Turned off for your business. Turn it on under Features for a native chart of accounts, journal, and AP/AR.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Accounting</h1>
        <p className="mt-1 text-base text-ivory-dim">Owner-only. Runs alongside Zoho Books if you're already connected - this doesn't replace that sync.</p>
      </div>
      <ChartOfAccountsSection businessId={businessId} />
      <JournalEntriesSection businessId={businessId} />
      <TrialBalanceSection businessId={businessId} />
      <VendorsAndBillsSection businessId={businessId} />
      <ArInvoicesSection businessId={businessId} />
    </div>
  );
}

// --- Chart of accounts ---

function ChartOfAccountsSection({ businessId }: { businessId: string }) {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<ChartAccount['account_type']>('expense');
  const [error, setError] = useState('');

  function reload() {
    setLoading(true);
    listAccounts(businessId).then(setAccounts).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleSeed() {
    setSeeding(true);
    try {
      await seedDefaultAccounts(businessId);
      reload();
    } finally {
      setSeeding(false);
    }
  }

  async function handleAdd() {
    if (!code || !name) { setError('Code and name are required'); return; }
    setError('');
    try {
      await createAccount(businessId, { code, name, accountType });
      setCode(''); setName(''); setAdding(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add account');
    }
  }

  return (
    <Section title="Chart of accounts" action={
      <div className="flex gap-2">
        {accounts.length === 0 && <ActionButton onClick={handleSeed} disabled={seeding}>{seeding ? 'Seeding...' : 'Seed default accounts'}</ActionButton>}
        <ActionButton onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add account'}</ActionButton>
      </div>
    }>
      {adding && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label="Code"><input value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} w-24`} /></Field>
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-48`} /></Field>
          <Field label="Type">
            <select value={accountType} onChange={(e) => setAccountType(e.target.value as typeof accountType)} className={`${inputClass} w-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </Field>
          <PrimaryButton onClick={handleAdd}>Add</PrimaryButton>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {['asset', 'liability', 'equity', 'revenue', 'expense'].map((type) => {
            const group = accounts.filter((a) => a.account_type === type);
            if (group.length === 0) return null;
            return (
              <div key={type} className="rounded-lg border border-ink-line p-3">
                <p className="mb-2 text-sm capitalize text-ivory-dim">{type}</p>
                {group.map((a) => (
                  <p key={a.id} className="text-sm text-ivory">{a.code} — {a.name}</p>
                ))}
              </div>
            );
          })}
          {accounts.length === 0 && <p className="text-ivory-dim">No accounts yet - seed the defaults to get started.</p>}
        </div>
      )}
    </Section>
  );
}

// --- Journal entries ---

function JournalEntriesSection({ businessId }: { businessId: string }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    Promise.all([listJournalEntries(businessId), listAccounts(businessId)])
      .then(([e, a]) => { setEntries(e); setAccounts(a); }).catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handlePost(entryId: string) {
    await postJournalEntry(businessId, entryId);
    reload();
  }
  async function handleVoid(entryId: string) {
    await voidJournalEntry(businessId, entryId);
    reload();
  }

  return (
    <Section title="Journal entries" action={<ActionButton onClick={() => setCreating(!creating)}>{creating ? 'Cancel' : 'New entry'}</ActionButton>}>
      {creating && <NewJournalEntryForm businessId={businessId} accounts={accounts} onSaved={() => { setCreating(false); reload(); }} />}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-ink-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base text-ivory">{new Date(e.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} {e.reference && `— ${e.reference}`}</p>
                  <p className="text-sm text-ivory-dim">{e.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm capitalize ${e.status === 'posted' ? 'text-success' : e.status === 'voided' ? 'text-danger' : 'text-ivory-dim'}`}>{e.status}</span>
                  {e.status === 'draft' && <ActionButton onClick={() => handlePost(e.id)}>Post</ActionButton>}
                  {e.status !== 'voided' && <ActionButton danger onClick={() => handleVoid(e.id)}>Void</ActionButton>}
                </div>
              </div>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {e.journal_entry_lines.map((l, i) => (
                    <tr key={i} className="text-ivory-dim">
                      <td className="py-0.5 pr-4">{l.chart_of_accounts?.code} {l.chart_of_accounts?.name}</td>
                      <td className="py-0.5 pr-4 text-right">{Number(l.debit_aed) > 0 ? Number(l.debit_aed).toFixed(2) : ''}</td>
                      <td className="py-0.5 text-right">{Number(l.credit_aed) > 0 ? Number(l.credit_aed).toFixed(2) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {entries.length === 0 && !creating && <p className="text-ivory-dim">No journal entries yet.</p>}
        </div>
      )}
    </Section>
  );
}

function NewJournalEntryForm({ businessId, accounts, onSaved }: { businessId: string; accounts: ChartAccount[]; onSaved: () => void }) {
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { account_id: '', debit_aed: 0, credit_aed: 0, memo: '' },
    { account_id: '', debit_aed: 0, credit_aed: 0, memo: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalDebits = lines.reduce((sum, l) => sum + (Number(l.debit_aed) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (Number(l.credit_aed) || 0), 0);
  const balanced = Math.round(totalDebits * 100) === Math.round(totalCredits * 100) && totalDebits > 0;

  function updateLine(i: number, patch: Partial<JournalEntryLine>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function handleSave() {
    if (!balanced) { setError('Debits and credits must balance before saving'); return; }
    setSaving(true);
    setError('');
    try {
      await createJournalEntry(businessId, { entryDate, reference, description, lines });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save entry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Date"><input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={`${inputClass} w-40`} /></Field>
        <Field label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} className={`${inputClass} w-32`} /></Field>
        <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} w-64`} /></Field>
      </div>
      <div className="mt-3 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <select value={l.account_id} onChange={(e) => updateLine(i, { account_id: e.target.value })} className={`${inputClass} w-56 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
              <option value="">Select account...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
            <input type="number" placeholder="Debit" value={l.debit_aed || ''} onFocus={(e) => e.target.select()} onChange={(e) => updateLine(i, { debit_aed: Number(e.target.value) || 0, credit_aed: 0 })} className={`${inputClass} w-28`} />
            <input type="number" placeholder="Credit" value={l.credit_aed || ''} onFocus={(e) => e.target.select()} onChange={(e) => updateLine(i, { credit_aed: Number(e.target.value) || 0, debit_aed: 0 })} className={`${inputClass} w-28`} />
            <input placeholder="Memo" value={l.memo} onChange={(e) => updateLine(i, { memo: e.target.value })} className={`${inputClass} w-40`} />
            {lines.length > 2 && <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-sm text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">remove</button>}
          </div>
        ))}
        <button type="button" onClick={() => setLines([...lines, { account_id: '', debit_aed: 0, credit_aed: 0, memo: '' }])} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">+ Add line</button>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <p className={`text-sm ${balanced ? 'text-success' : 'text-ivory-dim'}`}>
          Debits {totalDebits.toFixed(2)} / Credits {totalCredits.toFixed(2)} {balanced ? '(balanced)' : ''}
        </p>
        <PrimaryButton onClick={handleSave} disabled={saving || !balanced}>{saving ? 'Saving...' : 'Save as draft'}</PrimaryButton>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

// --- Trial balance ---

function TrialBalanceSection({ businessId }: { businessId: string }) {
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [balance, setBalance] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTrialBalance(businessId, asOf).then(setBalance).finally(() => setLoading(false));
  }, [businessId, asOf]);

  return (
    <Section title="Trial balance" action={<input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={`${inputClass} w-40`} />}>
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && balance && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b border-ink-line text-sm text-ivory-dim">
                <th className="pb-2 pr-4">Account</th>
                <th className="pb-2 pr-4 text-right">Debit</th>
                <th className="pb-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {balance.rows.map((r) => (
                <tr key={r.accountId} className="border-b border-ink-line/50">
                  <td className="py-1.5 pr-4 text-ivory">{r.code} — {r.name}</td>
                  <td className="py-1.5 pr-4 text-right text-ivory-dim">{r.debitAed > 0 ? r.debitAed.toFixed(2) : ''}</td>
                  <td className="py-1.5 text-right text-ivory-dim">{r.creditAed > 0 ? r.creditAed.toFixed(2) : ''}</td>
                </tr>
              ))}
              <tr className="font-medium text-ivory">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right">{balance.totalDebits.toFixed(2)}</td>
                <td className="pt-2 text-right">{balance.totalCredits.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          {balance.rows.length === 0 && <p className="text-ivory-dim">No posted entries as of this date yet.</p>}
        </div>
      )}
    </Section>
  );
}

// --- Vendors + AP bills ---

function VendorsAndBillsSection({ businessId }: { businessId: string }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<ApBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingVendor, setAddingVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [addingBill, setAddingBill] = useState(false);
  const [billVendorId, setBillVendorId] = useState('');
  const [billDueDate, setBillDueDate] = useState('');
  const [billAmount, setBillAmount] = useState('');

  function reload() {
    setLoading(true);
    Promise.all([listVendors(businessId), listApBills(businessId)])
      .then(([v, b]) => { setVendors(v); setBills(b); }).catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleAddVendor() {
    if (!vendorName) return;
    await createVendor(businessId, { name: vendorName });
    setVendorName(''); setAddingVendor(false);
    reload();
  }

  async function handleAddBill() {
    if (!billVendorId || !billDueDate || !billAmount) return;
    await createApBill(businessId, { vendorId: billVendorId, dueDate: billDueDate, amountAed: Number(billAmount) });
    setBillVendorId(''); setBillDueDate(''); setBillAmount(''); setAddingBill(false);
    reload();
  }

  async function handlePay(bill: ApBill) {
    const remaining = Number(bill.amount_aed) - Number(bill.amount_paid_aed);
    await recordApPayment(businessId, bill.id, remaining);
    reload();
  }

  return (
    <Section title="Vendors & bills payable" action={
      <div className="flex gap-2">
        <ActionButton onClick={() => setAddingVendor(!addingVendor)}>{addingVendor ? 'Cancel' : 'Add vendor'}</ActionButton>
        <ActionButton onClick={() => setAddingBill(!addingBill)}>{addingBill ? 'Cancel' : 'Add bill'}</ActionButton>
      </div>
    }>
      {addingVendor && (
        <div className="flex items-end gap-3 rounded-lg border border-ink-line p-3">
          <Field label="Vendor name"><input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={`${inputClass} w-48`} /></Field>
          <PrimaryButton onClick={handleAddVendor}>Add</PrimaryButton>
        </div>
      )}
      {addingBill && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-3">
          <Field label="Vendor">
            <select value={billVendorId} onChange={(e) => setBillVendorId(e.target.value)} className={`${inputClass} w-48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
              <option value="">Select...</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          <Field label="Due date"><input type="date" value={billDueDate} onChange={(e) => setBillDueDate(e.target.value)} className={`${inputClass} w-40`} /></Field>
          <Field label="Amount (AED)"><input type="number" value={billAmount} onFocus={(e) => e.target.select()} onChange={(e) => setBillAmount(e.target.value)} className={`${inputClass} w-32`} /></Field>
          <PrimaryButton onClick={handleAddBill}>Add bill</PrimaryButton>
        </div>
      )}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-ink-line text-sm text-ivory-dim">
              <th className="pb-2 pr-4">Vendor</th>
              <th className="pb-2 pr-4">Due</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="border-b border-ink-line/50">
                <td className="py-2 pr-4 text-ivory">{b.vendors?.name}</td>
                <td className="py-2 pr-4 text-ivory-dim">{new Date(b.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                <td className="py-2 pr-4 text-ivory-dim">AED {Number(b.amount_aed).toFixed(2)}</td>
                <td className="py-2 pr-4 capitalize text-ivory-dim">{b.status}</td>
                <td className="py-2">{b.status !== 'paid' && <ActionButton onClick={() => handlePay(b)}>Mark paid</ActionButton>}</td>
              </tr>
            ))}
            {bills.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-ivory-dim">No bills yet.</td></tr>}
          </tbody>
        </table>
      )}
    </Section>
  );
}

// --- AR invoices ---

function ArInvoicesSection({ businessId }: { businessId: string }) {
  const [invoices, setInvoices] = useState<ArInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');

  function reload() {
    setLoading(true);
    listArInvoices(businessId).then(setInvoices).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleAdd() {
    if (!customerName || !dueDate || !amount) return;
    await createArInvoice(businessId, { customerName, dueDate, amountAed: Number(amount) });
    setCustomerName(''); setDueDate(''); setAmount(''); setAdding(false);
    reload();
  }

  async function handleReceive(inv: ArInvoice) {
    const remaining = Number(inv.amount_aed) - Number(inv.amount_received_aed);
    await recordArReceipt(businessId, inv.id, remaining);
    reload();
  }

  return (
    <Section title="Receivables" action={<ActionButton onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add invoice'}</ActionButton>}>
      {adding && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-3">
          <Field label="Customer"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={`${inputClass} w-48`} /></Field>
          <Field label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${inputClass} w-40`} /></Field>
          <Field label="Amount (AED)"><input type="number" value={amount} onFocus={(e) => e.target.select()} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-32`} /></Field>
          <PrimaryButton onClick={handleAdd}>Add invoice</PrimaryButton>
        </div>
      )}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-ink-line text-sm text-ivory-dim">
              <th className="pb-2 pr-4">Customer</th>
              <th className="pb-2 pr-4">Due</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-ink-line/50">
                <td className="py-2 pr-4 text-ivory">{inv.customer_name}</td>
                <td className="py-2 pr-4 text-ivory-dim">{new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                <td className="py-2 pr-4 text-ivory-dim">AED {Number(inv.amount_aed).toFixed(2)}</td>
                <td className="py-2 pr-4 capitalize text-ivory-dim">{inv.status}</td>
                <td className="py-2">{inv.status !== 'paid' && <ActionButton onClick={() => handleReceive(inv)}>Mark received</ActionButton>}</td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-ivory-dim">No invoices yet.</td></tr>}
          </tbody>
        </table>
      )}
    </Section>
  );
}
