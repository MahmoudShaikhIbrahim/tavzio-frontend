import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { createStandaloneContract } from '../../lib/authApi';

const CATEGORIES = ['restaurant', 'cafe', 'retail', 'hotel', 'salon', 'clinic', 'gym', 'other'];

// No business account gets created here - just the contract, with the
// client's own details captured on it. The account only comes into
// existence later, at Onboard, and only if they've actually signed.
export default function CreateContractPage() {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientBusinessName, setClientBusinessName] = useState('');
  const [clientCategory, setClientCategory] = useState('restaurant');

  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [planType, setPlanType] = useState<'connect' | 'full'>('connect');
  const [standsCount, setStandsCount] = useState(0);
  const [systemFeeOverride, setSystemFeeOverride] = useState('');
  const [cardPriceOverride, setCardPriceOverride] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createStandaloneContract({
        clientName,
        clientEmail,
        clientBusinessName,
        clientCategory,
        startDate,
        paymentFrequency,
        planType,
        standsCount,
        systemFeeOverride: systemFeeOverride ? Number(systemFeeOverride) : undefined,
        cardPriceOverride: cardPriceOverride ? Number(cardPriceOverride) : undefined,
      });
      navigate('/admin/super/contracts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl text-ivory">Create contract</h1>
      <p className="mt-1 text-base text-ivory-dim">
        No account gets created here - just the contract, sent straight to the client. Once they sign and pay,
        you'll see an Onboard action next to it on the Contracts list, which is what actually creates their
        Tavzio account.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
        <Field label="Client's full name">
          <input required value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Client's email">
          <input type="email" required value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputClass} />
        </Field>

        <div className="border-t border-ink-line pt-4">
          <Field label="Business name">
            <input required value={clientBusinessName} onChange={(e) => setClientBusinessName(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Category">
          <select value={clientCategory} onChange={(e) => setClientCategory(e.target.value)} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <div className="border-t border-ink-line pt-4">
          <div className="flex flex-wrap gap-4">
            <Field label="Start date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={smallInputClass} />
            </Field>
            <Field label="Payment frequency">
              <select value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value as typeof paymentFrequency)} className={smallInputClass}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <Field label="Plan">
              <select value={planType} onChange={(e) => setPlanType(e.target.value as typeof planType)} className={smallInputClass}>
                <option value="connect">Tavzio Connect</option>
                <option value="full">Tavzio Full</option>
              </select>
            </Field>
            <Field label="Number of stands">
              <input type="number" min={0} onFocus={(e) => e.target.select()} value={standsCount} onChange={(e) => setStandsCount(Number(e.target.value))} className="w-28 rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory focus:border-brass" />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <Field label="System fee override (AED, optional)">
              <input value={systemFeeOverride} onChange={(e) => setSystemFeeOverride(e.target.value)} placeholder="Auto-filled from plan + category" className={smallInputClass} />
            </Field>
            <Field label="Card price override (AED, optional)">
              <input value={cardPriceOverride} onChange={(e) => setCardPriceOverride(e.target.value)} placeholder="20" className="w-32 rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory focus:border-brass" />
            </Field>
          </div>
        </div>

        {error && <p className="text-base text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brass px-4 py-2.5 font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create contract'}
        </button>
      </form>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory focus:border-brass';
const smallInputClass = 'rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory focus:border-brass';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-base text-ivory-dim">{label}</span>
      {children}
    </label>
  );
}
