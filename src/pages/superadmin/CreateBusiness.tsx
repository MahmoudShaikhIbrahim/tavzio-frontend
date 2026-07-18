import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerBusiness } from '../../lib/authApi';

const CATEGORIES = ['restaurant', 'cafe', 'retail', 'hotel', 'salon', 'clinic', 'gym', 'other'];

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function randomPassword() {
  return Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
}

export default function CreateBusiness() {
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState(randomPassword());
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState('restaurant');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleBusinessNameChange(value: string) {
    setBusinessName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await registerBusiness({
        name: ownerName,
        email: ownerEmail,
        password,
        businessName,
        slug,
        category,
      });
      navigate(`/admin/super/businesses/${res.business.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl text-ivory">Onboard a business</h1>
      <p className="mt-1 text-base text-ivory-dim">
        Creates the owner's account and the business record together. The
        owner won't use this password day-to-day — they'll get a tap card
        once you issue one, on the business's page after this.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Owner's full name">
          <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Owner's email">
          <input type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Temporary password">
          <div className="flex gap-2">
            <input required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <button
              type="button"
              onClick={() => setPassword(randomPassword())}
              className="shrink-0 rounded-lg border border-ink-line px-3 text-base text-ivory-dim hover:text-ivory"
            >
              Generate
            </button>
          </div>
        </Field>

        <div className="border-t border-ink-line pt-4">
          <Field label="Business name">
            <input required value={businessName} onChange={(e) => handleBusinessNameChange(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="URL slug">
          <div className="flex items-center gap-1">
            <span className="text-base text-ivory-dim">tavzio.com/</span>
            <input
              required
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
              className={inputClass}
            />
          </div>
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        {error && <p className="text-base text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brass px-4 py-2.5 font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create business'}
        </button>
      </form>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory focus:border-brass';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-base text-ivory-dim">{label}</span>
      {children}
    </label>
  );
}
