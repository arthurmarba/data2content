"use client";

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";

type ToastVariant = "success" | "error" | "info" | "warning";
type ToastPriority = "high" | "normal" | "low";

type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
  closeOnAction?: boolean; // default: false
};

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  priority?: ToastPriority;
  duration?: number;     // ms (0 = não auto-dismiss)
  createdAt: number;
  totalMs?: number;      // para progress
  deadlineAt?: number;   // timestamp quando deve encerrar
  paused?: boolean;
  remainingMs?: number;  // usado em pause
  action?: ToastAction;
};

type ToastInput = Omit<ToastItem, "id" | "createdAt" | "totalMs" | "deadlineAt" | "paused" | "remainingMs">;

type ToastContextValue = {
  toast: (t: ToastInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

const ToastCtx = createContext<ToastContextValue | null>(null);
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastA11yProvider>");
  return ctx;
}

type Props = {
  children: React.ReactNode;
  maxVisible?: number;
};

export function ToastA11yProvider({ children, maxVisible = 3 }: Props) {
  const [visible, setVisible] = useState<ToastItem[]>([]);
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, any>>({});
  const tickRef = useRef<any>(null); // 1 intervalo global p/ re-render do progress
  const [, setTick] = useState(0); // força re-render do progress

  // Live region
  const [srText, setSrText] = useState<string>("");
  const [srPoliteness, setSrPoliteness] = useState<"polite" | "assertive">("polite");

  // Defaults
  const getDefaults = (t: ToastInput) => {
    const pri = t.priority ?? "normal";
    const variant = t.variant ?? "info";
    const isAssertive = variant === "error" || pri === "high";
    const durationByPriority: Record<ToastPriority, number> = {
      high: 6000, normal: 4000, low: 2500,
    };
    const duration = typeof t.duration === "number" ? t.duration : durationByPriority[pri];
    return { pri, variant, isAssertive, duration };
  };

  // Ordenação por prioridade e chegada
  const sortQueue = (list: ToastItem[]) =>
    [...list].sort((a, b) => {
      const w = (p: ToastPriority | undefined) => (p === "high" ? 3 : p === "normal" ? 2 : 1);
      const d = w(b.priority) - w(a.priority);
      return d !== 0 ? d : a.createdAt - b.createdAt;
    });

  const announceSR = (title?: string, description?: string, assertive?: boolean) => {
    const msg = [title, description].filter(Boolean).join(" — ");
    if (!msg) return;
    setSrPoliteness(assertive ? "assertive" : "polite");
    setSrText(msg);
    setTimeout(() => setSrText(""), 100);
  };

  const scheduleDismiss = (id: string, ms: number) => {
    if (ms <= 0) return;
    timersRef.current[id] = setTimeout(() => dismiss(id), ms);
  };

  const ensureTickLoop = () => {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => setTick((n) => (n + 1) % 1000000), 100);
  };
  const stopTickLoopIfIdle = () => {
    const anyRunning = visible.some((t) => !!t.totalMs && !t.paused);
    if (!anyRunning && tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const maybeShowFromQueue = useCallback(() => {
    setVisible((curr) => {
      if (curr.length >= maxVisible) return curr;
      let nextVisible = [...curr];
      setQueue((q) => {
        if (q.length === 0) return q;
        const sorted = sortQueue(q);
        const slots = Math.max(0, maxVisible - nextVisible.length);
        const toTake = sorted.slice(0, slots);
        const remaining = sorted.slice(slots);

        const now = Date.now();
        toTake.forEach((t) => {
          // inicializa timers do toast
          if (t.duration && t.duration > 0) {
            t.totalMs = t.duration;
            t.deadlineAt = now + t.duration;
            t.paused = false;
            scheduleDismiss(t.id, t.duration);
            ensureTickLoop();
          }
          nextVisible.push(t);
        });

        return remaining;
      });
      return nextVisible;
    });
  }, [maxVisible]);

  const dismiss = useCallback((id: string) => {
    setVisible((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setTimeout(maybeShowFromQueue, 10);
    setTimeout(stopTickLoopIfIdle, 50);
  }, [maybeShowFromQueue]);

  const dismissAll = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
    setVisible([]);
    setTimeout(stopTickLoopIfIdle, 50);
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    const { pri, variant, isAssertive, duration } = getDefaults(input);

    const base: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      variant,
      priority: input.priority ?? pri,
      duration,
      createdAt: Date.now(),
      action: input.action,
    };

    announceSR(base.title, base.description, isAssertive);
    setQueue((prev) => sortQueue([...prev, base]));
    setTimeout(maybeShowFromQueue, 0);
    return id;
  }, [maybeShowFromQueue]);

  // Pause/Resume helpers
  const pause = (id: string) => {
    setVisible((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.paused || !t.deadlineAt || !t.totalMs) return t;
        const remaining = Math.max(0, t.deadlineAt - Date.now());
        if (timersRef.current[id]) {
          clearTimeout(timersRef.current[id]);
          delete timersRef.current[id];
        }
        return { ...t, paused: true, remainingMs: remaining };
      })
    );
  };

  const resume = (id: string) => {
    setVisible((prev) =>
      prev.map((t) => {
        if (t.id !== id || !t.paused || !t.totalMs) return t;
        const remaining = t.remainingMs ?? 0;
        const newDeadline = Date.now() + remaining;
        scheduleDismiss(id, remaining);
        ensureTickLoop();
        return { ...t, paused: false, remainingMs: undefined, deadlineAt: newDeadline };
      })
    );
  };

  // cleanup global
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toast, dismiss, dismissAll }),
    [toast, dismiss, dismissAll]
  );

  const progressPct = (t: ToastItem) => {
    if (!t.totalMs || !t.deadlineAt) return 0;
    const remaining = Math.max(0, (t.paused ? (t.remainingMs ?? 0) : (t.deadlineAt - Date.now())));
    return Math.max(0, Math.min(100, (remaining / t.totalMs) * 100));
  };

  return (
    <ToastCtx.Provider value={value}>
      {/* Live region invisível */}
      <div
        aria-live={srPoliteness}
        aria-atomic="true"
        aria-relevant="additions text"
        className="sr-only"
      >
        {srText}
      </div>

      {children}

      {/* Container dos toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {visible.map((t) => {
          const isAlert = t.variant === "error" || t.priority === "high";
          const pct = progressPct(t);

          return (
            <div
              key={t.id}
              role={isAlert ? "alert" : "status"}
              aria-live={isAlert ? "assertive" : "polite"}
              className={[
                "w-[340px] rounded-lg p-3 shadow-lg text-sm transition-all animate-[toastIn_.14s_ease-out] focus-within:ring-2 focus-within:ring-white/30",
                t.variant === "success" && "bg-green-600 text-white",
                t.variant === "error" && "bg-red-600 text-white",
                t.variant === "warning" && "bg-yellow-600 text-white",
                (!t.variant || t.variant === "info") && "bg-gray-900 text-white",
              ].filter(Boolean).join(" ")}
              onMouseEnter={() => pause(t.id)}
              onMouseLeave={() => resume(t.id)}
              onFocus={() => pause(t.id)}
              onBlur={() => resume(t.id)}
            >
              <div className="flex items-start gap-2">
                <div className="grow">
                  {t.title && <div className="font-medium">{t.title}</div>}
                  {t.description && <div className="opacity-90">{t.description}</div>}
                  {/* Ação opcional */}
                  {t.action && (
                    <div className="mt-2">
                      <button
                        onClick={async () => {
                          try {
                            await t.action!.onClick();
                          } finally {
                            if (t.action?.closeOnAction) {
                              // dismiss depois da ação
                              dismiss(t.id);
                            }
                          }
                        }}
                          className="px-2 py-1 rounded bg-white/15 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40"
                      >
                        {t.action.label}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => dismiss(t.id)}
                  className="opacity-80 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
                  aria-label="Fechar notificação"
                  title="Fechar"
                >
                  <span aria-hidden>×</span>
                </button>
              </div>

              {/* Barra de progresso (restante) */}
              {t.totalMs && (
                <div className="mt-3 h-1 w-full bg-white/25 rounded">
                  <div
                    className="h-1 bg-white rounded transition-[width] duration-100"
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* reduced motion */}
      <style jsx global>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-[toastIn"] {
            animation: none !important;
          }
        }
      `}</style>
    </ToastCtx.Provider>
  );
}

