import { useEffect, useState } from 'react';
import {
  listOrganizations, createOrganization, deleteOrganization, setBusinessOrganization, inviteOrgOwner,
  listBusinesses, type Organization,
} from '../../lib/authApi';
import type { AdminBusiness } from '../../types';
import { Field, inputClass } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<AdminBusiness[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);

  function reload() {
    listOrganizations().then(setOrganizations);
    listBusinesses({}).then((res) => setAllBusinesses(res.businesses));
  }
  useEffect(reload, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createOrganization(name.trim());
      setName(''); setShowAdd(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-ivory">Organizations</h1>
          <p className="mt-1 text-base text-ivory-dim">Franchise/multi-outlet groups - link locations, invite an org owner.</p>
        </div>
        <button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          + Create organization
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="flex items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label="Organization name"><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Costa Coffee UAE" className={inputClass} /></Field>
          <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            {saving ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {organizations.map((org) => (
          <OrganizationCard
            key={org.id}
            org={org}
            allBusinesses={allBusinesses}
            expanded={expandedOrgId === org.id}
            onToggle={() => setExpandedOrgId(expandedOrgId === org.id ? null : org.id)}
            onChange={reload}
          />
        ))}
        {organizations.length === 0 && <p className="text-ivory-dim">No organizations yet.</p>}
      </div>
    </div>
  );
}

function OrganizationCard({ org, allBusinesses, expanded, onToggle, onChange }: {
  org: Organization; allBusinesses: AdminBusiness[]; expanded: boolean; onToggle: () => void; onChange: () => void;
}) {
  const confirm = useConfirm();
  const [linkBusinessId, setLinkBusinessId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState('');
  const [actionError, setActionError] = useState('');

  const linkedIds = new Set((org.businesses || []).map((b) => b.id));
  const unlinkedBusinesses = allBusinesses.filter((b) => !linkedIds.has(b.id));

  async function handleLink() {
    if (!linkBusinessId) return;
    setBusy(true);
    setActionError('');
    try {
      await setBusinessOrganization(linkBusinessId, org.id);
      setLinkBusinessId('');
      onChange();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not link this business');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink(businessId: string) {
    if (!(await confirm({
      title: 'Unlink this location?',
      message: 'Unlink this location from the organization? It keeps its own menu as-is, just stops receiving future publishes.',
      confirmLabel: 'Unlink',
    }))) return;
    setBusy(true);
    setActionError('');
    try {
      await setBusinessOrganization(businessId, null);
      onChange();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not unlink this location');
    } finally {
      setBusy(false);
    }
  }

  const locationCount = (org.businesses || []).length;

  async function handleDelete() {
    if (!(await confirm({
      title: 'Delete organization?',
      message: `Permanently delete "${org.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    }))) return;
    setBusy(true);
    setActionError('');
    try {
      await deleteOrganization(org.id);
      onChange();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete organization');
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim() || !ownerEmail.trim()) return;
    setBusy(true);
    setInviteResult('');
    try {
      const result = await inviteOrgOwner(org.id, ownerName.trim(), ownerEmail.trim());
      setInviteResult(
        result.resent
          ? `${ownerName} was already invited - resent the invite email.`
          : `Invited ${ownerName} - they'll get an email to set their password.`
      );
      setOwnerName(''); setOwnerEmail('');
    } catch (err) {
      setInviteResult(err instanceof Error ? err.message : 'Could not invite owner');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base text-ivory">{org.name}</p>
          <p className="text-sm text-ivory-dim">{locationCount} location(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onToggle} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{expanded ? 'Close' : 'Manage'}</button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy || locationCount > 0}
            title={locationCount > 0 ? 'Unlink every location first' : undefined}
            className="text-sm text-danger hover:underline disabled:opacity-40 disabled:hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            Delete
          </button>
        </div>
      </div>
      {actionError && <p className="mt-1 text-sm text-danger">{actionError}</p>}

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-ink-line pt-4">
          <div>
            <p className="mb-2 text-sm text-ivory-dim">Locations</p>
            <div className="space-y-1.5">
              {(org.businesses || []).map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded border border-ink-line px-3 py-2 text-sm">
                  <span className="text-ivory">{b.name} <span className="text-ivory-dim">· {b.category}</span></span>
                  <button type="button" onClick={() => handleUnlink(b.id)} disabled={busy} className="text-danger hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Unlink</button>
                </div>
              ))}
              {(org.businesses || []).length === 0 && <p className="text-sm text-ivory-dim">No locations linked yet.</p>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <select value={linkBusinessId} onChange={(e) => setLinkBusinessId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                <option value="">Select a business to link...</option>
                {unlinkedBusinesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button type="button" onClick={handleLink} disabled={busy || !linkBusinessId} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                Link
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-ivory-dim">Invite an org owner account</p>
            <form onSubmit={handleInviteOwner} className="flex flex-wrap items-end gap-2">
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Name" className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory" />
              <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} type="email" placeholder="Email" className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory" />
              <button type="submit" disabled={busy} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Invite</button>
            </form>
            {inviteResult && <p className="mt-1 text-sm text-ivory-dim">{inviteResult}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
