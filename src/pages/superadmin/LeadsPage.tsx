import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLeads } from '../../lib/authApi';
import type { Lead } from '../../types';
import { Section } from '../../components/ui';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConverted, setShowConverted] = useState(false);
  const navigate = useNavigate();

  function reload() {
    listLeads().then(setLeads).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  // Jumps straight into Create Business with the lead's details pre-filled,
  // then marks the lead converted once that account is actually created -
  // this is the "immediately onboard them" step, not a separate manual copy-paste.
  function handleConvert(lead: Lead) {
    navigate(`/admin/super/businesses/new?leadId=${lead.id}&email=${encodeURIComponent(lead.email)}&phone=${encodeURIComponent(lead.phone)}&category=${encodeURIComponent(lead.business_type)}`);
  }

  const visible = leads.filter((l) => showConverted || !l.converted);

  return (
    <Section
      title="Leads"
      action={
        <label className="flex items-center gap-2 text-sm text-ivory-dim">
          <input type="checkbox" checked={showConverted} onChange={(e) => setShowConverted(e.target.checked)} className="accent-brass" />
          Show converted
        </label>
      }
    >
      <p className="text-base text-ivory-dim">Everyone who signed up through the "Get Started" form on the homepage.</p>
      {loading && <p className="text-ivory-dim">Loading...</p>}
      <div className="space-y-2">
        {visible.map((lead) => (
          <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-line px-4 py-3">
            <div>
              <p className="text-base text-ivory">{lead.email} · {lead.phone}</p>
              <p className="text-sm text-ivory-dim">
                {lead.business_type} · wants ~{lead.stands_estimate} stand{lead.stands_estimate === 1 ? '' : 's'} · {new Date(lead.created_at).toLocaleDateString()}
                {lead.note && ` · "${lead.note}"`}
              </p>
            </div>
            {lead.converted ? (
              <span className="text-sm text-success">Converted</span>
            ) : (
              <button type="button" onClick={() => handleConvert(lead)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
                Convert to client
              </button>
            )}
          </div>
        ))}
        {!loading && visible.length === 0 && <p className="text-ivory-dim">No leads yet.</p>}
      </div>
    </Section>
  );
}
