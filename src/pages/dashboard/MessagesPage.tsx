import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listMessages, sendMessage, markMessagesRead } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import type { SupportMessage } from '../../types';

export default function MessagesPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function reload() {
    if (businessId) listMessages(businessId).then(setMessages).catch(() => {});
  }

  useEffect(reload, [businessId]);
  usePollingFallback(reload, !!businessId);
  // matters before someone's actually looking at the thread.
  useEffect(() => {
    if (businessId) markMessagesRead(businessId);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'support_messages', () => {
      reload();
      markMessagesRead(businessId);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!businessId || !text.trim()) return;
    setSending(true);
    await sendMessage(businessId, text.trim());
    setText('');
    setSending(false);
    reload();
  }

  if (!businessId) return null;

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border border-ink-line">
      <div className="border-b border-ink-line p-4">
        <h1 className="font-display text-xl text-ivory">{t('Contact us')}</h1>
        <p className="text-base text-ivory-dim">{t("Message the platform operator directly — they'll reply here.")}</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_role === 'business' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-5 py-4 text-base ${
              m.sender_role === 'business' ? 'bg-brass text-ink' : 'border border-ink-line bg-ink-soft text-ivory'
            }`}>
              <p>{m.message}</p>
              <p className={`mt-1 text-[10px] ${m.sender_role === 'business' ? 'text-ink/60' : 'text-ivory-dim'}`}>
                {new Date(m.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-base text-ivory-dim">{t('No messages yet — send one below if you need help.')}</p>}
        <div ref={bottomRef} />
      </div>

      {/* A real chat composer - rounded input pill + circular send button,
          the same shape every messaging app (WhatsApp included) uses,
          instead of a boxy textarea + rectangular button pairing that
          reads more like a generic form than a conversation. */}
      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-ink-line p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('Describe the issue...')}
          rows={1}
          className="flex-1 resize-none rounded-3xl border border-ink-line bg-ink px-4 py-2.5 text-sm text-ivory placeholder:text-ivory-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        />
        <button disabled={sending} aria-label={t('Send')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>
        </button>
      </form>
    </div>
  );
}
