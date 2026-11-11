"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "info" | "error";
type ToastAction = { label: string; onClick: () => void };
type ToastOptions = {
  action?: ToastAction;
  /** A new toast replaces any showing toast with the same key, e.g. one save's result replaces the last. */
  key?: string;
};
type Toast = ToastOptions & { id: number; kind: ToastKind; text: string };

export type Toasts = {
  /** Fades after 4 seconds. */
  success(text: string, options?: ToastOptions): void;
  /** A prompt, not a failure, such as "Log in to like posts". Fades after 8 seconds. */
  info(text: string, options?: ToastOptions): void;
  /** Stays until dismissed. */
  error(text: string, options?: ToastOptions): void;
};

/** How long each kind stays; errors stay until dismissed. */
const FADE_MS: Partial<Record<ToastKind, number>> = { success: 4000, info: 8000 };
const MAX_VISIBLE = 4;

const ToastContext = createContext<Toasts | null>(null);

/** The toasts every action reports its result through, as drawn in the UI Design. */
export function useToast(): Toasts {
  const toasts = useContext(ToastContext);
  if (!toasts) throw new Error("useToast must be used inside <ToastProvider>.");
  return toasts;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const api = useMemo<Toasts>(() => {
    const push = (kind: ToastKind, text: string, options: ToastOptions = {}) => {
      const id = nextId.current++;
      // The same message, or one with the same key, replaces the old one instead of stacking.
      const replaces = (t: Toast) => t.text === text || (options.key && t.key === options.key);
      setToasts((current) =>
        [...current.filter((t) => !replaces(t)), { ...options, id, kind, text }].slice(
          -MAX_VISIBLE,
        ),
      );
    };
    return {
      success: (text, options) => push("success", text, options),
      info: (text, options) => push("info", text, options),
      error: (text, options) => push("error", text, options),
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2.5 p-4 sm:items-end sm:p-6">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS: Record<ToastKind, { glyph: string; className: string }> = {
  success: { glyph: "✓", className: "bg-[#3E7A36] text-[#F4FBF2]" },
  info: { glyph: "i", className: "bg-toast-line font-serif text-toast-ink italic" },
  error: { glyph: "!", className: "bg-[#B5372A] text-[#FFF4F2]" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const fadeMs = FADE_MS[toast.kind];
    if (fadeMs === undefined) return;
    const timer = setTimeout(onDismiss, fadeMs);
    return () => clearTimeout(timer);
  }, [toast.kind, onDismiss]);

  const icon = ICONS[toast.kind];
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-2xl bg-toast py-3 pr-3 pl-4 text-toast-ink shadow-[0_14px_34px_rgba(20,12,8,0.22)]"
    >
      <span
        aria-hidden="true"
        className={`flex size-[26px] flex-none items-center justify-center rounded-full text-[13px] font-bold ${icon.className}`}
      >
        {icon.glyph}
      </span>
      <span className="flex-1 text-sm leading-[1.45]">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            onDismiss();
            toast.action!.onClick();
          }}
          className="h-9 flex-none cursor-pointer rounded-full border border-toast-line bg-transparent px-3 text-[13px] font-semibold text-toast-ink"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="size-9 flex-none cursor-pointer rounded-full bg-transparent text-lg text-toast-mut"
      >
        ×
      </button>
    </div>
  );
}
