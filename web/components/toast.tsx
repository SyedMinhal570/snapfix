"use client";

export type ToastItem = {
  id: string;
  /** Bold lead-in, e.g. "New issue reported:" */
  label?: string;
  title: string;
};

type Props = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export default function ToastStack({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg toast-enter dark:border-zinc-700 dark:bg-zinc-900"
          role="status"
        >
          <p className="min-w-0 flex-1 text-sm text-zinc-800 dark:text-zinc-200">
            {toast.label ? (
              <>
                <span className="font-medium">{toast.label}</span>{" "}
              </>
            ) : null}
            <span className="text-zinc-600 dark:text-zinc-400">
              {toast.title}
            </span>
          </p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
