import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLeads } from '../../lib/authApi';
import type { Lead } from '../../types';
import { Section } from '../../components/ui';

const SOURCE_LABEL: Record<Lead['source'], string> = {
  get_started: 'Get Started',
  pricing_inquiry: 'Pricing inquiry',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConverted, setShowConverted] = useState(false);
  // Confirmed requirement: pricing inquiries land in this same Leads
  // section, distinguishable from a real Get Started signup rather than
  // a separate page - this filter is that distinction made visible and
  // actionable, not just a label.
  const [sourceFilter, setSourceFilter] = useState<'all' | Lead['source']>('all');
  const navigate = useNavigate();

  function reload() {
    listLeads().then(setLeads).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  // Jumps straight into Create Business with the lead's details pre-filled,
  // then marks the lead converted once that account is actually created -
  // this is the "immediately onboard them" step, not a separate manual copy-paste.
  // A pricing_inquiry lead has no business_type on file (it was never asked) -
  // falls back to an empty category rather than passing the literal string
  // "null" through as a URL param, which encodeURIComponent(null) would do.
  function handleConvert(lead: Lead) {
    navigate(`/admin/super/businesses/new?leadId=${lead.id}&email=${encodeURIComponent(lead.email)}&phone=${encodeURIComponent(lead.phone)}&category=${encodeURIComponent(lead.business_type || '')}`);
  }

  const visible = leads.filter((l) => (showConverted || !l.converted) && (sourceFilter === 'all' || l.source === sourceFilter));
  const pricingInquiryCount = leads.filter((l) => l.source === 'pricing_inquiry' && !l.converted).length;
  const getStartedCount = leads.filter((l) => l.source === 'get_started' && !l.converted).length;

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
      <p className="text-base text-ivory-dim">
        Everyone who came in through either homepage form - the full "Get Started" signup, or the lighter
        "Contact us" pricing inquiry.
      </p>

      <div className="flex gap-2">
        {(['all', 'get_started', 'pricing_inquiry'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setSourceFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              sourceFilter === f ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim hover:text-ivory'
            }`}
          >
            {f === 'all' ? `All (${getStartedCount + pricingInquiryCount})` : f === 'get_started' ? `Get Started (${getStartedCount})` : `Pricing inquiries (${pricingInquiryCount})`}
          </button>
        ))}
      </div>

      {loading && <p className="text-ivory-dim">Loading...</p>}
      <div className="space-y-2">
        {visible.map((lead) => (
          <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-line px-4 py-3">
            <div>
              <p className="text-base text-ivory">
                {lead.email} · {lead.phone}{' '}
                <span className={`ml-1 rounded-full border px-2 py-0.5 text-xs ${lead.source === 'pricing_inquiry' ? 'border-brass/40 text-brass' : 'border-ink-line text-ivory-dim'}`}>
                  {SOURCE_LABEL[lead.source]}
                </span>
              </p>
              <p className="text-sm text-ivory-dim">
                {lead.source === 'get_started'
                  ? `${lead.business_type} · wants ~${lead.stands_estimate} stand${lead.stands_estimate === 1 ? '' : 's'}`
                  : `Prefers to be contacted by ${lead.preferred_contact_method}`}
                {' · '}{new Date(lead.created_at).toLocaleDateString()}
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
