import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { listServices, createService, updateService, deleteService } from '../../lib/authApi';
import type { Service } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';

export default function ServicesManagementPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    if (businessId) listServices(businessId).then(setServices);
  }

  useEffect(reload, [businessId]);

  if (!businessId) return null;

  return (
    <Section
      title="Services"
      action={
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90"
        >
          + Add service
        </button>
      }
    >
      {showForm && <ServiceForm businessId={businessId} onDone={() => { setShowForm(false); reload(); }} />}
      <div className="space-y-1.5">
        {services.map((service) => (
          <ServiceRow key={service.id} service={service} businessId={businessId} onChange={reload} />
        ))}
        {services.length === 0 && <p className="text-base text-ivory-dim">No services yet.</p>}
      </div>
    </Section>
  );
}

function ServiceForm({ businessId, existing, onDone }: { businessId: string; existing?: Service; onDone: () => void }) {
  const [name, setName] = useState(existing?.name || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [price, setPrice] = useState(existing?.price ?? 0);
  const [durationMinutes, setDurationMinutes] = useState(existing?.duration_minutes ?? 30);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { name, description, price, durationMinutes };
    if (existing) {
      await updateService(businessId, existing.id, payload);
    } else {
      await createService(businessId, payload);
    }
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-3 rounded-lg border border-ink-line p-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <Field label="Price"><input type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={inputClass} /></Field>
        <Field label="Duration (min)"><input type="number" min={5} step={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={inputClass} /></Field>
      </div>
      <Field label="Description">
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </Field>
      <PrimaryButton disabled={saving}>{saving ? 'Saving...' : existing ? 'Save changes' : 'Add service'}</PrimaryButton>
    </form>
  );
}

function ServiceRow({ service, businessId, onChange }: { service: Service; businessId: string; onChange: () => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <ServiceForm businessId={businessId} existing={service} onDone={() => { setEditing(false); onChange(); }} />;
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-2.5 text-base">
      <div>
        <span className="text-ivory">{service.name}</span>
        <span className="ml-2 text-ivory-dim">{service.price.toFixed(2)} · {service.duration_minutes} min</span>
        {!service.is_available && <span className="ml-2 text-base text-red-400">unavailable</span>}
      </div>
      <div className="flex items-center gap-2">
        <ActionButton onClick={() => updateService(businessId, service.id, { isAvailable: !service.is_available }).then(onChange)}>
          {service.is_available ? 'Mark unavailable' : 'Mark available'}
        </ActionButton>
        <ActionButton onClick={() => setEditing(true)}>Edit</ActionButton>
        <ActionButton danger onClick={() => deleteService(businessId, service.id).then(onChange)}>Remove</ActionButton>
      </div>
    </div>
  );
}
