import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useSearchParams } from 'react-router-dom';
import { getZohoBooksConnectUrl, getZohoBooksStatus, disconnectZohoBooks, syncZohoBooksReceipts } from '../../lib/authApi';
import { Section } from '../../components/ui';

export default function AccountingSyncPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; total: number; errors: { receiptNumber: string; error: string }[] } | null>(null);
  const [error, setError] = useState('');

  function reload() {
    if (!businessId) return;
    getZohoBooksStatus(businessId).then((s) => { setConnected(s.connected); setConnectedAt(s.connectedAt); }).finally(() => setLoaded(true));
  }
  useEffect(reload, [businessId]);

  useEffect(() => {
    if (searchParams.get('zohoConnected') === '1') reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleConnect() {
    if (!businessId) return;
    setConnecting(true);
    setError('');
    try {
      const { url } = await getZohoBooksConnectUrl(businessId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Zoho Books connection');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!businessId) return;
    if (!confirm('Disconnect Zoho Books? Already-synced bills stay in your Zoho account.')) return;
    await disconnectZohoBooks(businessId);
    reload();
  }

  async function handleSync() {
    if (!businessId) return;
    setSyncing(true);
    setError('');
    setSyncResult(null);
    try {
      const result = await syncZohoBooksReceipts(businessId);
      setSyncResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync');
    } finally {
      setSyncing(false);
    }
  }

  if (!loaded) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <Section title="Zoho Books">
      <p className="text-base text-ivory-dim">
        Connect your own Zoho Books account and every billing receipt Tavzio issues to you gets pushed there
        automatically as a Bill, ready for your accountant - no manual re-entry.
      </p>

      {!connected ? (
        <div className="rounded-lg border border-ink-line p-4">
          <p className="text-base text-ivory">Not connected</p>
          <p className="mt-1 text-sm text-ivory-dim">You'll be sent to Zoho to approve access to your own Zoho Books account.</p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="mt-3 rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
          >
            {connecting ? 'Redirecting...' : 'Connect Zoho Books'}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-success/40 p-4">
          <p className="text-base text-success">Connected{connectedAt ? ` since ${new Date(connectedAt).toLocaleDateString('en-GB')}` : ''}</p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
            <button type="button" onClick={handleDisconnect} className="text-sm text-danger hover:underline">Disconnect</button>
          </div>
          {syncResult && (
            <div className="mt-3 rounded-lg bg-ink-soft p-3 text-sm">
              <p className="text-ivory">Synced {syncResult.synced} of {syncResult.total} receipt(s).</p>
              {syncResult.errors.length > 0 && (
                <div className="mt-1 space-y-0.5 text-danger">
                  {syncResult.errors.map((e) => <p key={e.receiptNumber}>{e.receiptNumber}: {e.error}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
