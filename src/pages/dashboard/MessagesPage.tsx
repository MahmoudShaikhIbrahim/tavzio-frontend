import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { listMessages, sendMessage, markMessagesRead } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import type { SupportMessage } from '../../types';

export default function MessagesPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function reload() {
    if (businessId) listMessages(businessId).then(setMessages);
  }

  useEffect(reload, [businessId]);

  // Mark read the moment this page is open - the "unread" state only
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
        <h1 className="font-display text-lg text-ivory">Contact us</h1>
        <p className="text-xs text-ivory-dim">Message the platform operator directly — they'll reply here.</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_role === 'business' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-3.5 py-2 text-sm ${
              m.sender_role === 'business' ? 'bg-brass text-ink' : 'border border-ink-line bg-ink-soft text-ivory'
            }`}>
              <p>{m.message}</p>
              <p className={`mt-1 text-[10px] ${m.sender_role === 'business' ? 'text-ink/60' : 'text-ivory-dim'}`}>
                {new Date(m.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-sm text-ivory-dim">No messages yet — send one below if you need help.</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-ink-line p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe the issue..."
          rows={2}
          className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
        />
        <button disabled={sending} className="shrink-0 rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
