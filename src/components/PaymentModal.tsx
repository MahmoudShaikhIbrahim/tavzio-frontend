import { useState, type ReactNode } from 'react';
import { useT } from '../hooks/useT';
import { verifyMyPin, setMyPin, recordManualPayment } from '../lib/authApi';

interface PaymentItem {
  id: string;
  orderId: string;
  name: string;
  unitPrice: number;
  addonTotal: number;
  quantity: number;
}

// The real shared Payment action - opened identically from POS Terminal
// (right after Send to Kitchen, paying immediately, always one order),
// Requests (confirming a customer's own cash-pending order), and Orders
// (settling a table that may span several separate orders placed over
// the course of a meal - a real, common dine-in case, not an edge case
// to design around). Same component every time on purpose: the PIN
// gate, multi-tender support, and cash change calculation shouldn't be
// something any call site could accidentally build differently or skip.
export default function PaymentModal({ businessId, items, onClose, onDone }: {
  businessId: string; items: PaymentItem[]; onClose: () => void; onDone: () => void;
}) {
  const { t } = useT();
  const [step, setStep] = useState<'pin' | 'tender'>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);
  // Real detection via the structured error code (not string-matching
  // the message) - a staff member's very first sensitive action is
  // exactly when they're expected to choose their PIN, not before.
  const [needsSetup, setNeedsSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState('');

  const [mode, setMode] = useState<'cash' | 'card' | 'split'>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const total = items.reduce((sum, i) => sum + (i.unitPrice + i.addonTotal) * i.quantity, 0);

  async function handlePinSubmit() {
    if (pin.length < 4) return;
    setVerifying(true);
    setPinError('');
    try {
      await verifyMyPin(pin);
      setStep('tender');
    } catch (err) {
      const code = (err as Error & { code?: string })?.code;
      if (code === 'no_pin_set') {
        setNeedsSetup(true);
        setPin('');
        return;
      }
      setPinError(err instanceof Error ? err.message : 'Could not verify PIN');
      setPin('');
    } finally {
      setVerifying(false);
    }
  }

  async function handleSetupSubmit() {
    if (newPin.length < 4) return;
    if (newPin !== confirmNewPin) { setSetupError("PINs don't match"); return; }
    setSettingUp(true);
    setSetupError('');
    try {
      await setMyPin(newPin);
      // Real fix: the PIN was successfully created, but `pin` (what
      // handleConfirm actually sends at final payment submission) was
      // never updated to match it - it stayed at its initial empty
      // value the whole time, since first-time setup types into
      // newPin/confirmNewPin, never into pin itself.
      setPin(newPin);
      setNeedsSetup(false);
      setStep('tender');
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not set PIN');
    } finally {
      setSettingUp(false);
    }
  }

  const tendered = Number(cashTendered) || 0;
  const change = mode === 'cash' ? Math.max(0, tendered - total) : 0;
  const cashShort = mode === 'cash' && tendered > 0 && tendered < total;

  const splitCashNum = Number(splitCash) || 0;
  const splitCardNum = Number(splitCard) || 0;
  const splitTotal = splitCashNum + splitCardNum;
  const splitBalanced = mode !== 'split' || Math.abs(splitTotal - total) < 0.01;

  function overallTenders(): { method: 'cash' | 'card'; amount: number }[] {
    if (mode === 'cash') return [{ method: 'cash', amount: total }];
    if (mode === 'card') return [{ method: 'card', amount: total }];
    const list: { method: 'cash' | 'card'; amount: number }[] = [];
    if (splitCashNum > 0) list.push({ method: 'cash', amount: splitCashNum });
    if (splitCardNum > 0) list.push({ method: 'card', amount: splitCardNum });
    return list;
  }

  // Real allocation, not an approximation: groups items by their real
  // order, then walks the tender pools (cash first, then card) against
  // each order's own owed amount in turn - so every order's tenders sum
  // to EXACTLY what it's owed, with zero rounding drift, regardless of
  // how many separate orders this table ends up spanning.
  function allocateByOrder(): { orderId: string; itemIds: string[]; tenders: { method: 'cash' | 'card'; amount: number }[] }[] {
    const orderIds = [...new Set(items.map((i) => i.orderId))];
    const pools = overallTenders().map((t) => ({ ...t, remaining: t.amount }));
    return orderIds.map((orderId) => {
      const orderItems = items.filter((i) => i.orderId === orderId);
      let owed = orderItems.reduce((sum, i) => sum + (i.unitPrice + i.addonTotal) * i.quantity, 0);
      const tenders: { method: 'cash' | 'card'; amount: number }[] = [];
      for (const pool of pools) {
        if (owed <= 0.001) break;
        if (pool.remaining <= 0) continue;
        const take = Math.min(pool.remaining, owed);
        tenders.push({ method: pool.method, amount: Math.round(take * 100) / 100 });
        pool.remaining -= take;
        owed -= take;
      }
      return { orderId, itemIds: orderItems.map((i) => i.id), tenders };
    });
  }

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const groups = allocateByOrder();
      await Promise.all(groups.map((g) => recordManualPayment(businessId, g.orderId, g.itemIds, g.tenders, pin)));
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not record this payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-ink/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-soft p-6 shadow-2xl shadow-black/50">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl text-ivory">{t('Payment')}</h2>
          <button type="button" onClick={onClose} className="text-base text-ivory-dim hover:text-ivory">{t('Close')}</button>
        </div>

        <div className="mb-5 rounded-lg border border-ink-line bg-ink px-4 py-3">
          <p className="text-sm text-ivory-dim">{t('Amount due')}</p>
          <p className="font-display text-3xl text-brass">AED {total.toFixed(2)}</p>
        </div>

        {step === 'pin' ? (
          needsSetup ? (
            <div className="space-y-3">
              <p className="text-center text-sm text-ivory-dim">{t('No PIN set yet - choose one now. You\'ll use this every time you take a payment.')}</p>
              <input
                type="password" inputMode="numeric" maxLength={6}
                value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder={t('New PIN (4-6 digits)')}
                className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-center text-lg tracking-widest text-ivory"
                autoFocus
              />
              <input
                type="password" inputMode="numeric" maxLength={6}
                value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder={t('Confirm PIN')}
                className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-center text-lg tracking-widest text-ivory"
              />
              {setupError && <p className="text-center text-sm text-danger">{setupError}</p>}
              <button
                type="button"
                onClick={handleSetupSubmit}
                disabled={settingUp || newPin.length < 4 || confirmNewPin.length < 4}
                className="w-full rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
              >
                {settingUp ? t('Setting up...') : t('Set PIN and continue')}
              </button>
            </div>
          ) : (
            <PinEntry
              pin={pin}
              onChange={setPin}
              onSubmit={handlePinSubmit}
              verifying={verifying}
              error={pinError}
            />
          )
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'card', 'split'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium capitalize ${
                    mode === m ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim hover:text-ivory'
                  }`}
                >
                  {m === 'cash' ? t('Cash') : m === 'card' ? t('Card') : t('Split')}
                </button>
              ))}
            </div>

            {mode === 'cash' && (
              <div className="space-y-2">
                <label className="block text-sm text-ivory-dim">{t('Cash tendered')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-lg text-ivory"
                  autoFocus
                />
                {tendered > 0 && !cashShort && (
                  <p className="text-base text-success">{t('Change due:')} AED {change.toFixed(2)}</p>
                )}
                {cashShort && <p className="text-sm text-danger">{t('Tendered amount is less than what is owed')}</p>}
              </div>
            )}

            {mode === 'card' && (
              <p className="text-sm text-ivory-dim">{t('Full amount charged on the card machine.')}</p>
            )}

            {mode === 'split' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-ivory-dim">{t('Cash')}</label>
                  <input
                    type="number" min={0} step="0.01" value={splitCash}
                    onChange={(e) => { setSplitCash(e.target.value); setSplitCard((total - (Number(e.target.value) || 0)).toFixed(2)); }}
                    className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-ivory"
                  />
                </div>
                <div>
                  <label className="block text-sm text-ivory-dim">{t('Card')}</label>
                  <input
                    type="number" min={0} step="0.01" value={splitCard}
                    onChange={(e) => { setSplitCard(e.target.value); setSplitCash((total - (Number(e.target.value) || 0)).toFixed(2)); }}
                    className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-ivory"
                  />
                </div>
                {!splitBalanced && <p className="col-span-2 text-sm text-danger">{t('Cash + Card must add up to the amount due')}</p>}
              </div>
            )}

            {submitError && <p className="text-sm text-danger">{submitError}</p>}
            {pin.length < 4 && <p className="text-sm text-danger">{t('PIN was lost - close this and try the payment again')}</p>}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || cashShort || !splitBalanced || pin.length < 4 || (mode === 'cash' && !tendered)}
              className="w-full rounded-lg bg-brass px-4 py-3.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? t('Recording...') : t('Confirm payment')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// A real numeric keypad, not a plain password-style input - a POS PIN
// is entered fast, often without looking, by someone whose hands are
// full a second before. Large touch targets, digits only.
function PinEntry({ pin, onChange, onSubmit, verifying, error }: {
  pin: string; onChange: (v: string) => void; onSubmit: () => void; verifying: boolean; error: string;
}) {
  const { t } = useT();

  function press(digit: string) {
    if (pin.length >= 6) return;
    onChange(pin + digit);
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-ivory-dim">{t('Enter your PIN to continue')}</p>
      <div className="flex justify-center gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full border ${i < pin.length ? 'border-brass bg-brass' : 'border-ink-line'}`} />
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <PadButton key={d} onClick={() => press(d)}>{d}</PadButton>
        ))}
        <PadButton onClick={() => onChange(pin.slice(0, -1))}>⌫</PadButton>
        <PadButton onClick={() => press('0')}>0</PadButton>
        <PadButton onClick={onSubmit} disabled={pin.length < 4 || verifying} accent>
          {verifying ? '…' : '✓'}
        </PadButton>
      </div>
    </div>
  );
}

function PadButton({ children, onClick, disabled, accent }: { children: ReactNode; onClick: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 items-center justify-center rounded-xl border text-xl transition-colors disabled:opacity-30 ${
        accent ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory hover:border-brass/40'
      }`}
    >
      {children}
    </button>
  );
}
