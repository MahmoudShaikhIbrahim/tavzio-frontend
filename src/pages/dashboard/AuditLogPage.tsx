import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listAuditLog } from '../../lib/authApi';
import type { AuditLogEntry, AuditAction } from '../../types';
import { Section } from '../../components/ui';

const ACTION_LABEL: Record<AuditAction, string> = {
  void_order: 'Voided order',
  void_item: 'Voided item',
  refund: 'Refund issued',
  staff_order_placed: 'Order placed by staff',
  card_deleted: 'Card deleted',
};

const ACTION_STYLE: Record<AuditAction, string> = {
  void_order: 'border-red-400/40 text-red-400',
  void_item: 'border-red-400/40 text-red-400',
  refund: 'border-red-400/40 text-red-400',
  staff_order_placed: 'border-brass/40 text-brass',
  card_deleted: 'border-red-400/40 text-red-400',
};

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
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.id} className="rounded-lg border border-ink-line px-3.5 py-2.5 text-base">
            <div className="flex items-center justify-between">
              <span className={`rounded-full border px-2 py-0.5 text-sm ${ACTION_STYLE[e.action]}`}>
                {ACTION_LABEL[e.action]}
              </span>
              <span className="text-sm text-ivory-dim">{new Date(e.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-ivory-dim">
              <span className="text-ivory">{e.actor_name || 'Unknown'}</span> ({e.actor_role})
              {Object.keys(e.details).length > 0 && (
                <span className="ml-1 text-base">— {JSON.stringify(e.details)}</span>
              )}
            </p>
          </div>
        ))}
        {entries.length === 0 && <p className="text-base text-ivory-dim">No activity logged yet.</p>}
      </div>
    </Section>
  );
}
