import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

interface PublicContract {
  contractNumber: string;
  businessName: string;
  status: string;
  text: string;
  isSigned: boolean;
  signedByName: string | null;
  signedAt: string | null;
}

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const activated = searchParams.get('activated') === '1';

  const [contract, setContract] = useState<PublicContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/api/public/contracts/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: PublicContract) => {
        setContract(data);
        // Real fix: signed but not yet paid (checkout was abandoned or
        // the tab was closed) - resume it automatically instead of
        // leaving the person stuck on a static "Signed" confirmation
        // with no way to actually finish. Exactly status 'signed', not
        // 'paid'/'active' - those are genuinely done, nothing to resume.
        if (data.status === 'signed') {
          setResuming(true);
          fetch(`${BASE}/api/public/contracts/${token}/resume-checkout`, { method: 'POST' })
            .then((r) => r.json())
            .then((resumeData) => {
              if (resumeData.checkoutUrl) {
                window.location.href = resumeData.checkoutUrl;
              } else {
                setCheckoutError(resumeData.message || 'Could not resume payment setup - Tavzio will follow up.');
                setResuming(false);
              }
            })
            .catch(() => {
              setCheckoutError('Could not resume payment setup - Tavzio will follow up.');
              setResuming(false);
            });
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSign() {
    if (!token) return;
    if (!fullName.trim()) { setError('Type your full legal name to sign'); return; }
    if (!agreed) { setError('Please confirm you have read and agree to this contract and all its terms and conditions'); return; }
    setSigning(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/public/contracts/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not sign');
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setCheckoutError(data.checkoutError || 'Signed, but could not start payment setup - Tavzio will follow up.');
      setContract((prev) => (prev ? { ...prev, isSigned: true, signedByName: fullName.trim() } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign contract');
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#141110]"><div className="h-8 w-8 animate-pulse rounded-full border-2 border-[#b8925a]/40" /></div>;
  }

  if (resuming) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141110] px-6 text-center">
        <div>
          <div className="mx-auto h-8 w-8 animate-pulse rounded-full border-2 border-[#b8925a]/40" />
          <p className="mt-4 text-sm text-[#a79a87]">Taking you back to complete payment...</p>
        </div>
      </div>
    );
  }

  if (notFound || !contract) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141110] px-6 text-center">
        <p className="text-[#a79a87]">This link is invalid or has expired. Contact Tavzio for a new one.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141110] px-5 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          {/* Real fix for the explicit request: this was the one place
              in the whole app still using an actual image file for the
              logo (/brand/logo-white.png) instead of the same real
              icon+text Logo component every other page already uses -
              same drop-shadow treatment this page already had, just on
              real markup instead of a flat PNG. */}
          <div className="inline-block" style={{ filter: 'drop-shadow(0 0 14px rgba(184,146,90,0.28))' }}>
            <Logo size="lg" />
          </div>
        </div>

        {activated && (
          <div className="rounded-lg border border-green-700/40 bg-green-900/20 p-4 text-center text-sm text-green-400">
            Payment method added - your subscription is now active.
          </div>
        )}

        <div className="rounded-xl border border-[#3a332c] bg-[#1f1a16] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base text-[#f4eee3]">{contract.contractNumber} - {contract.businessName}</p>
            <a
              href={`${BASE}/api/public/contracts/${token}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full border border-[#b8925a]/40 px-3.5 py-1.5 text-sm text-[#b8925a] hover:bg-[#b8925a]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8925a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1f1a16]"
            >
              Download PDF
            </a>
          </div>
          {contract.isSigned ? (
            <p className="mt-1 text-sm text-green-400">Signed by {contract.signedByName}{contract.signedAt ? ` on ${new Date(contract.signedAt).toLocaleDateString()}` : ''}</p>
          ) : (
            <p className="mt-1 text-sm text-[#b8925a]">Ready for your signature</p>
          )}
        </div>

        <pre className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#3a332c] bg-[#1f1a16] p-5 text-sm leading-relaxed text-[#a79a87]">
          {contract.text}
        </pre>

        {!contract.isSigned && (
          <div className="space-y-3 rounded-2xl border border-[#3a332c] bg-[#1f1a16] p-5 shadow-sm">
            <p className="text-sm text-[#a79a87]">
              Signing electronically here is legally valid under UAE Federal Decree-Law No. 46 of 2021 on Electronic
              Transactions and Trust Services. Your typed name, the time, and your IP address are recorded alongside
              the exact text above. After signing, you'll be asked to add a payment method to activate your subscription.
            </p>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Type your full legal name"
              className="w-full rounded-lg border border-[#3a332c] bg-[#141110] px-3.5 py-2.5 text-base text-[#f4eee3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8925a]"
            />
            <label className="flex items-center gap-2 text-base text-[#f4eee3]">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-[#b8925a]" />
              I have read this contract in full and agree to all of its terms and conditions.
            </label>
            {error && <p className="text-base text-red-400">{error}</p>}
            <button type="button"
              onClick={handleSign}
              disabled={signing || !agreed}
              className="w-full rounded-full bg-[#b8925a] px-4 py-2.5 text-base font-medium text-[#141110] hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8925a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1f1a16]"
            >
              {signing ? 'Signing...' : 'Sign & continue to payment setup'}
            </button>
          </div>
        )}

        {contract.isSigned && checkoutError && (
          <p className="text-center text-sm text-[#a79a87]">{checkoutError}</p>
        )}
      </div>
    </div>
  );
}
