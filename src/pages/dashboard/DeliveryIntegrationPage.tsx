import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { getDeliveryIntegration, connectDeliveryIntegration, type DeliveryIntegration } from '../../lib/authApi';
import { Section } from '../../components/ui';

export default function DeliveryIntegrationPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [integration, setIntegration] = useState<DeliveryIntegration | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (businessId) getDeliveryIntegration(businessId).then(setIntegration);
  }, [businessId]);

  async function handleConnect() {
    if (!businessId) return;
    setConnecting(true);
    const updated = await connectDeliveryIntegration(businessId);
    setIntegration(updated);
    setConnecting(false);
  }

  if (!businessId || !integration) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <Section title="Delivery platforms">
      <p className="text-base text-ivory-dim">
        Talabat, Deliveroo, and Careem orders come in through Deliverect - one connection covers all three,
        landing in your normal Orders/Kitchen queue automatically once it's live.
      </p>

      {!integration.enabled ? (
        <div className="space-y-3 rounded-lg border border-ink-line p-4">
          <p className="text-sm text-ivory-dim">
            Not connected yet. Two things are needed before this goes live - neither can be done from here:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ivory-dim">
            <li>A Deliverect partner account (their own signup + review process)</li>
            <li>Once approved, their team will provide a production HMAC secret - Tavzio needs this set as an environment variable before real orders can come through</li>
          </ol>
          <p className="text-sm text-ivory-dim">
            Once you have a Deliverect account, click below to generate this business's connection ID - you'll enter
            that as the "External Location ID" when setting up this location in Deliverect's dashboard.
          </p>
          <button onClick={handleConnect} disabled={connecting} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            {connecting ? 'Generating...' : 'Generate connection ID'}
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-success/40 p-4">
          <p className="text-base text-success">Connected</p>
          <p className="text-sm text-ivory-dim">External Location ID for Deliverect: <span className="text-ivory">{businessId}</span></p>
        </div>
      )}
    </Section>
  );
}
