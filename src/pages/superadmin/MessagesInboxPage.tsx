import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getInbox, listMessages, sendMessage, markMessagesRead } from '../../lib/authApi';
import type { InboxThread, SupportMessage } from '../../types';

export default function MessagesInboxPage() {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

  function reload() {
    getInbox().then(setThreads);
  }
  useEffect(reload, []);

  const selectedThread = threads.find((t) => t.businessId === selectedBusinessId);

  return (
    <div className="flex h-[75vh] gap-4">
      <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-ink-line">
        <div className="border-b border-ink-line p-3">
          <h1 className="font-display text-lg text-ivory">Messages</h1>
        </div>
        {threads.map((t) => (
          <button
            key={t.businessId}
            onClick={() => { setSelectedBusinessId(t.businessId); }}
            className={`flex w-full items-center justify-between border-b border-ink-line px-3.5 py-3 text-left ${
              selectedBusinessId === t.businessId ? 'bg-ink-soft' : ''
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ivory">{t.businessName}</p>
              <p className="truncate text-xs text-ivory-dim">{t.lastMessage}</p>
            </div>
            {t.unreadCount > 0 && (
              <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass text-[10px] font-medium text-ink">
                {t.unreadCount}
              </span>
            )}
          </button>
        ))}
        {threads.length === 0 && <p className="p-3.5 text-sm text-ivory-dim">No messages yet.</p>}
      </div>

      <div className="flex-1 rounded-xl border border-ink-line">
        {selectedThread ? (
          <ThreadView businessId={selectedThread.businessId} businessName={selectedThread.businessName} onSent={reload} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ivory-dim">Select a conversation</div>
        )}
      </div>
    </div>
  );
}

function ThreadView({ businessId, businessName, onSent }: { businessId: string; businessName: string; onSent: () => void }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function reload() {
    listMessages(businessId).then(setMessages);
    markMessagesRead(businessId);
  }
  useEffect(reload, [businessId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    await sendMessage(businessId, text.trim());
    setText('');
    setSending(false);
    reload();
    onSent();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-line p-4">
        <p className="font-display text-lg text-ivory">{businessName}</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_role === 'super_admin' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-3.5 py-2 text-sm ${
              m.sender_role === 'super_admin' ? 'bg-brass text-ink' : 'border border-ink-line bg-ink-soft text-ivory'
            }`}>
              <p>{m.message}</p>
              <p className={`mt-1 text-[10px] ${m.sender_role === 'super_admin' ? 'text-ink/60' : 'text-ivory-dim'}`}>
                {new Date(m.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2 border-t border-ink-line p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply..."
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
