import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listExternalHotelSystems, connectExternalHotelSystem, disconnectExternalHotelSystem, type ExternalHotelSystem } from '../../lib/authApi';
import { Section } from '../../components/ui';

const ROLE_LABEL: Record<string, string> = { channel_manager: 'Channel Manager', pos: 'Hotel POS', pms: 'Hotel PMS' };

export default function ExternalHotelSystemsPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [systems, setSystems] = useState<ExternalHotelSystem[]>([]);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState('');
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  function reload() {
    if (businessId) listExternalHotelSystems(businessId).then(setSystems);
  }
  useEffect(reload, [businessId]);

  function startEditing(s: ExternalHotelSystem) {
    setEditingProvider(s.provider);
    setPropertyId(s.externalPropertyId || '');
    setError('');
  }

  async function handleConnect(provider: string) {
    if (!businessId) return;
    if (!propertyId.trim()) { setError('Enter the property ID with this vendor first.'); return; }
    setError('');
    setBusyProvider(provider);
    try {
      await connectExternalHotelSystem(businessId, provider, propertyId);
      setEditingProvider(null);
      setPropertyId('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleDisconnect(provider: string) {
    if (!businessId) return;
    if (!confirm('Disconnect this integration? You can reconnect any time.')) return;
    setBusyProvider(provider);
    try {
      await disconnectExternalHotelSystem(businessId, provider);
      reload();
    } finally {
      setBusyProvider(null);
    }
  }

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <Section title="External Hotel Systems">
      <p className="text-base text-ivory-dim">
        For hotels keeping their existing PMS/POS - Tavzio's NFC guest experience connects alongside it instead of
        replacing it. Each of these needs a real partner account with the vendor before it can go live; connecting
        here just records which one this hotel uses and stores your property ID with them.
      </p>
      <div className="space-y-3">
        {systems.map((s) => (
          <div key={s.provider} className="rounded-lg border border-ink-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base text-ivory">{s.label} <span className="text-xs uppercase text-brass">{ROLE_LABEL[s.role]}</span></p>
                <p className="text-sm text-ivory-dim">{s.requirement}</p>
                {s.connected && <p className="mt-1 text-sm text-ivory">Property ID: {s.externalPropertyId || '(not set)'}</p>}
              </div>
              <div>
                {editingProvider === s.provider ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={propertyId}
                        onChange={(e) => setPropertyId(e.target.value)}
                        placeholder="Property ID with vendor"
                        autoFocus
                        className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory"
                      />
                      <button onClick={() => handleConnect(s.provider)} disabled={busyProvider === s.provider} className="text-sm text-brass hover:underline disabled:opacity-50">
                        {busyProvider === s.provider ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => { setEditingProvider(null); setError(''); }} className="text-sm text-ivory-dim hover:underline">Cancel</button>
                    </div>
                    {error && <p className="text-xs text-danger">{error}</p>}
                  </div>
                ) : s.connected ? (
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${s.enabled ? 'text-success' : 'text-warning'}`}>{s.enabled ? 'Live' : 'Awaiting real credentials'}</span>
                    <button onClick={() => startEditing(s)} className="text-sm text-brass hover:underline">Edit</button>
                    <button onClick={() => handleDisconnect(s.provider)} disabled={busyProvider === s.provider} className="text-sm text-danger hover:underline disabled:opacity-50">
                      {busyProvider === s.provider ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => startEditing(s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
