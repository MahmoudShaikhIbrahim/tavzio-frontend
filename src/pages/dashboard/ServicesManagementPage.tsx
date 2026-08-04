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
      <div className="space-y-4">
        {services.map((service) => (
          <ServiceRow key={service.id} service={service} services={services} businessId={businessId} onServicesChange={setServices} onChange={reload} />
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
        <Field label="Price"><input type="number" onFocus={(e) => e.target.select()} step="0.01" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={inputClass} /></Field>
        <Field label="Duration (min)"><input type="number" onFocus={(e) => e.target.select()} min={5} step={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={inputClass} /></Field>
      </div>
      <Field label="Description">
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </Field>
      <PrimaryButton disabled={saving}>{saving ? 'Saving...' : existing ? 'Save changes' : 'Add service'}</PrimaryButton>
    </form>
  );
}

function ServiceRow({ service, services, businessId, onServicesChange, onChange }: {
  service: Service; services: Service[]; businessId: string; onServicesChange: (s: Service[]) => void; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <ServiceForm businessId={businessId} existing={service} onDone={() => { setEditing(false); onChange(); }} />;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-line px-3.5 py-2.5 text-base sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span className="text-ivory">{service.name}</span>
        <span className="ml-2 text-ivory-dim">{service.price.toFixed(2)} · {service.duration_minutes} min</span>
        {!service.is_available && <span className="ml-2 text-base text-danger">unavailable</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          onClick={() => {
            onServicesChange(services.map((s) => (s.id === service.id ? { ...s, is_available: !s.is_available } : s)));
            updateService(businessId, service.id, { isAvailable: !service.is_available }).catch(onChange);
          }}
        >
          {service.is_available ? 'Mark unavailable' : 'Mark available'}
        </ActionButton>
        <ActionButton onClick={() => setEditing(true)}>Edit</ActionButton>
        <ActionButton
          danger
          onClick={() => {
            onServicesChange(services.filter((s) => s.id !== service.id));
            deleteService(businessId, service.id).catch(onChange);
          }}
        >
          Remove
        </ActionButton>
      </div>
    </div>
  );
}
