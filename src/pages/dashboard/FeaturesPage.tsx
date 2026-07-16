import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getBusiness, updateBusinessFeatures,
  listCustomButtons, createCustomButton, updateCustomButton, deleteCustomButton,
} from '../../lib/authApi';
import type { AdminBusiness, CustomButton } from '../../types';
import { Section, Field, inputClass, ActionButton, ToggleRow } from '../../components/ui';

const ICON_OPTIONS = ['Link', 'Star', 'Gift', 'Music', 'ShoppingBag', 'Heart', 'Phone', 'Mail', 'Globe', 'MapPin', 'Camera', 'Ticket'];

export default function FeaturesPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [saving, setSaving] = useState(false);

  function reload() {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }
  useEffect(reload, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    await updateBusinessFeatures(businessId!, body);
    setSaving(false);
    reload();
  }

  const { ordering, booking } = business.features;

  return (
    <div className="space-y-6">
      <Section title="Ordering">
        <div className="space-y-2">
          <ToggleRow label="Menu view" description="Customers can browse the menu after tapping."
            checked={ordering.menuView} onChange={(v) => patch({ ordering: { menuView: v } })} disabled={saving} />
          <ToggleRow label="Order submission" description="Customers can actually place an order — Tavzio's own order screen always works, no POS needed."
            checked={ordering.submission} onChange={(v) => patch({ ordering: { submission: v } })} disabled={saving} />
          <ToggleRow label="POS integration" description="Push orders into a connected POS, on top of Tavzio's own screen. Set up by the platform operator."
            checked={ordering.posIntegration} onChange={(v) => patch({ ordering: { posIntegration: v } })} disabled={saving} />
          <ToggleRow label="Call waiter" description="Only useful with order submission or POS integration on."
            checked={ordering.callWaiter} onChange={(v) => patch({ ordering: { callWaiter: v } })} disabled={saving || !ordering.submission} />
          <ToggleRow label="Request bill" description="Only useful with order submission or POS integration on."
            checked={ordering.requestBill} onChange={(v) => patch({ ordering: { requestBill: v } })} disabled={saving || !ordering.submission} />
        </div>
      </Section>

      <Section title="Booking">
        <div className="space-y-2">
          <ToggleRow label="Booking page" description="Customers can browse services after tapping."
            checked={booking.menuView} onChange={(v) => patch({ booking: { menuView: v } })} disabled={saving} />
          <ToggleRow label="Booking submission" description="Customers can request an appointment — you confirm or decline."
            checked={booking.submission} onChange={(v) => patch({ booking: { submission: v } })} disabled={saving} />
          <ToggleRow label="Booking integration" description="Push bookings into a connected system. Set up by the platform operator."
            checked={booking.integration} onChange={(v) => patch({ booking: { integration: v } })} disabled={saving} />
        </div>
      </Section>

      <Section title="Other">
        <div className="space-y-2">
          <ToggleRow label="Loyalty program" checked={business.features.loyalty}
            onChange={(v) => patch({ loyalty: v })} disabled={saving} />
          <ToggleRow label="Staff accounts" description="Turn off if this business never needs a second account."
            checked={business.features.staffAccounts} onChange={(v) => patch({ staffAccounts: v })} disabled={saving} />
        </div>
      </Section>

      <CustomButtonsSection businessId={businessId} />
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
        <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-xs font-medium text-ink hover:opacity-90">
          + Add button
        </button>
      }
    >
      <p className="text-xs text-ivory-dim">
        Beyond the 7 built-in links — add a brand-new button with its own
        label, icon, and link.
      </p>
      {showForm && <CustomButtonForm businessId={businessId} onDone={() => { setShowForm(false); reload(); }} />}
      <div className="space-y-1.5">
        {buttons.map((b) => <CustomButtonRow key={b.id} button={b} businessId={businessId} onChange={reload} />)}
        {buttons.length === 0 && <p className="text-sm text-ivory-dim">No custom buttons yet.</p>}
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
      <button disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink disabled:opacity-50">
        {saving ? 'Saving...' : existing ? 'Save changes' : 'Add button'}
      </button>
    </form>
  );
}

function CustomButtonRow({ button, businessId, onChange }: { button: CustomButton; businessId: string; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <CustomButtonForm businessId={businessId} existing={button} onDone={() => { setEditing(false); onChange(); }} />;

  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-2 text-sm">
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
