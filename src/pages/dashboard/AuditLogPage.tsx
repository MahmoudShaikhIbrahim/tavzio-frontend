import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listAuditLog } from '../../lib/authApi';
import type { AuditLogEntry, AuditAction } from '../../types';
import { Section } from '../../components/ui';

const ACTION_STYLE: Record<AuditAction, string> = {
  void_order: 'border-danger/40 text-danger',
  void_item: 'border-danger/40 text-danger',
  refund: 'border-danger/40 text-danger',
  manual_payment_recorded: 'border-success/40 text-success',
  payment_integration_updated: 'border-brass/40 text-brass',
};

// Turns each action's raw details into an actual sentence, instead of a
// dumped JSON object nobody should have to parse by eye. Each action type
// has a known, fixed shape (defined by exactly what the backend logs for
// it), so this is a direct, reliable translation, not a guess.
function describeAction(entry: AuditLogEntry): { label: string; description: string } {
  const d = entry.details as Record<string, unknown>;

  switch (entry.action) {
    case 'void_item':
      return { label: 'Deleted item', description: `"${d.itemName}" removed from an order` };
    case 'refund':
      return { label: 'Refund issued', description: `${d.amount} refunded${d.reason ? ` — ${d.reason}` : ''}` };
    case 'manual_payment_recorded':
      return { label: 'Payment recorded', description: `${d.amount} via ${d.method === 'cash' ? 'cash' : 'card machine'} (${d.itemCount} item${d.itemCount === 1 ? '' : 's'})` };
    case 'payment_integration_updated':
      return { label: 'Payment settings changed', description: `${d.provider} ${d.enabled ? 'enabled' : 'disabled'}` };
    case 'void_order':
      if (d.clearedTable) {
        const count = Array.isArray(d.orderIds) ? d.orderIds.length : 0;
        return { label: 'Table cleared', description: `${count} order${count === 1 ? '' : 's'} deleted` };
      }
      return { label: 'Deleted order', description: `${d.table || 'No table'}${d.reason ? ` — ${d.reason}` : ''}` };
    default:
      return { label: entry.action, description: '' };
  }
}

export default function AuditLogPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    if (businessId) listAuditLog(businessId).then(setEntries);
  }, [businessId]);

  if (!businessId) return null;

  return (
    <Section title="Audit log">
      <p className="text-base text-ivory-dim">
        Every void, refund, staff-placed order, and card deletion — who did
        it, and when. Not a general activity feed by design.
      </p>
      <div className="space-y-4">
        {entries.map((e) => {
          const { label, description } = describeAction(e);
          return (
            <div key={e.id} className="rounded-lg border border-ink-line px-3.5 py-2.5 text-base">
              <div className="flex items-center justify-between">
                <span className={`rounded-full border px-2 py-0.5 text-sm ${ACTION_STYLE[e.action]}`}>
                  {label}
                </span>
                <span className="text-sm text-ivory-dim">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-ivory-dim">
                <span className="text-ivory">{e.actor_name || 'Unknown'}</span> ({e.actor_role})
                {description && <span className="ml-1">— {description}</span>}
              </p>
            </div>
          );
        })}
        {entries.length === 0 && <p className="text-base text-ivory-dim">No activity logged yet.</p>}
      </div>
    </Section>
  );
}
