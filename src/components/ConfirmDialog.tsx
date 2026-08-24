import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Real replacement for the native browser confirm() found used
// throughout the dashboard and super-admin (delete staff, leave
// organization, revoke full access, delete organization, unlink a
// location) - the one moment in the whole app that broke out of the
// brass/ink/ivory identity into a stark, unstyled OS popup.
//
// Promise-based specifically so every existing call site needs only a
// one-line change: `if (!confirm(message)) return;` becomes
// `if (!(await confirm(message))) return;` inside the same already-async
// handler - no rewrite of the surrounding logic.
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const normalized = typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      setState({ options: normalized, resolve });
    });
  }, []);

  function handle(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-modal-backdrop flex items-center justify-center bg-black/50 p-4"
          onClick={() => handle(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-soft shadow-2xl motion-safe:animate-[confirm-in_0.2s_cubic-bezier(0.22,1,0.36,1)]"
          >
            {state.options.danger && (
              <div className="mx-5 mt-5 flex h-10 w-10 items-center justify-center rounded-xl bg-danger/15 text-lg text-danger">!</div>
            )}
            <div className={state.options.danger ? 'px-5 pb-1 pt-3' : 'p-5 pb-1'}>
              {state.options.title && (
                <p id="confirm-dialog-title" className="font-display text-lg text-ivory">{state.options.title}</p>
              )}
              <p className={`text-sm leading-relaxed ${state.options.title ? 'mt-1.5 text-ivory-dim' : 'text-ivory'}`}>
                {state.options.message}
              </p>
            </div>
            <div className="flex justify-end gap-2.5 p-5 pt-4">
              <button
                type="button"
                onClick={() => handle(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ivory-dim transition-colors hover:text-ivory"
              >
                {state.options.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handle(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-ink transition-opacity hover:opacity-90 ${
                  state.options.danger ? 'bg-danger' : 'bg-brass'
                }`}
              >
                {state.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes confirm-in { from { opacity: 0; transform: scale(0.96) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
    </ConfirmContext.Provider>
  );
}

// Throws loudly if used outside the provider, rather than silently
// falling back to the native confirm() - a missing provider should be
// caught in development, not paper over itself in production.
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmDialogProvider>');
  return ctx;
}
