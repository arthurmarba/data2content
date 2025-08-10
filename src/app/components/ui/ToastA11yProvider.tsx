"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";

type ToastVariant = "success" | "error" | "info" | "warning";
type ToastPriority = "high" | "normal" | "low";

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  priority?: ToastPriority;
  duration?: number; // ms (0 = não auto-dismiss)
  createdAt: number;
};

type ToastInput = Omit<ToastItem, "id" | "createdAt">;

type ToastContextValue = {
  toast: (t: ToastInput) => string; // retorna id
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
  /**
   * Quantos toasts podem ficar visíveis ao mesmo tempo.
   * O excedente fica na fila (prioridade/ordem de chegada).
   */
  maxVisible?: number;
};

export function ToastA11yProvider({ children, maxVisible = 3 }: Props) {
  const [visible, setVisible] = useState<ToastItem[]>([]);
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, any>>({});

  // Live region (para leitores de tela)
  const [srText, setSrText] = useState<string>("");
  const [srPoliteness, setSrPoliteness] = useState<"polite" | "assertive">("polite");

  // Defaults por prioridade/variant
  const getDefaults = (t: ToastInput) => {
    const pri = t.priority ?? "normal";
    const variant = t.variant ?? "info";

    // Durações sugeridas (A11y: assertive geralmente um pouco mais longo)
    const durationByPriority: Record<ToastPriority, number> = {
      high: 6000,
      normal: 4000,
      low: 2500,
    };

    // Variant pode ajustar a prioridade/politeness
    const isAssertive = variant === "error" || pri === "high";

    // Se dev quiser 0 (= não auto-dismiss), respeitamos
    const duration = typeof t.duration === "number" ? t.duration : durationByPriority[pri];

    return { pri, variant, duration, isAssertive };
  };

  // Ordenação: prioridade > createdAt
  const sortQueue = (list: ToastItem[]) =>
    [...list].sort((a, b) => {
      const weight = (p: ToastPriority) => (p === "high" ? 3 : p === "normal" ? 2 : 1);
      const prDiff = weight(b.priority ?? "normal") - weight(a.priority ?? "normal");
      if (prDiff !== 0) return prDiff;
      return a.createdAt - b.createdAt;
    });

  const announceSR = (title?: string, description?: string, assertive?: boolean) => {
    // Para leitores de tela: atualiza o live region com o último toast inserido
    const msg = [title, description].filter(Boolean).join(" — ");
    if (!msg) return;
    setSrPoliteness(assertive ? "assertive" : "polite");
    setSrText(msg);
    // Reseta o texto em ~100ms para permitir re-anúncio do mesmo conteúdo no futuro
    setTimeout(() => setSrText(""), 100);
  };

  const scheduleDismiss = (id: string, duration: number) => {
    if (duration <= 0) return;
    timersRef.current[id] = setTimeout(() => {
      dismiss(id);
    }, duration);
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

        toTake.forEach((t) => {
          nextVisible.push(t);
          if (t.duration && t.duration > 0) {
            scheduleDismiss(t.id, t.duration);
          }
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
    // Libera vaga e puxa próximo da fila
    setTimeout(maybeShowFromQueue, 10);
  }, [maybeShowFromQueue]);

  const dismissAll = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
    setVisible([]);
    // Mantém fila, mas pode limpar se preferir:
    // setQueue([]);
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    const { pri, variant, duration, isAssertive } = getDefaults(input);

    const next: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      variant,
      priority: input.priority ?? pri,
      duration,
      createdAt: Date.now(),
    };

    // Anuncia no live region
    announceSR(next.title, next.description, isAssertive);

    setQueue((prev) => sortQueue([...prev, next]));
    // tenta exibir imediatamente se houver slot
    setTimeout(maybeShowFromQueue, 0);

    return id;
  }, [maybeShowFromQueue]);

  const value = useMemo<ToastContextValue>(
    () => ({ toast, dismiss, dismissAll }),
    [toast, dismiss, dismissAll]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, []);

  return (
    <ToastCtx.Provider value={value}>
      {/* Live region invisível, anuncia o último toast criado */}
      <div
        aria-live={srPoliteness}
        aria-atomic="true"
        aria-relevant="additions text"
        className="sr-only"
      >
        {srText}
      </div>

      {children}

      {/* Container visual dos toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {visible.map((t) => (
          <div
            key={t.id}
            role={t.variant === "error" || t.priority === "high" ? "alert" : "status"}
            aria-live={t.variant === "error" || t.priority === "high" ? "assertive" : "polite"}
            className={[
              "w-[320px] rounded-lg p-3 shadow-lg text-sm transition-all animate-[toastIn_.14s_ease-out]",
              t.variant === "success" && "bg-green-600 text-white",
              t.variant === "error" && "bg-red-600 text-white",
              t.variant === "warning" && "bg-yellow-600 text-white",
              (!t.variant || t.variant === "info") && "bg-gray-900 text-white",
            ].filter(Boolean).join(" ")}
          >
            <div className="flex items-start gap-2">
              <div className="grow">
                {t.title && <div className="font-medium">{t.title}</div>}
                {t.description && <div className="opacity-90">{t.description}</div>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="opacity-80 hover:opacity-100 focus:outline-none"
                aria-label="Fechar notificação"
                title="Fechar"
              >
                <span aria-hidden>×</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Animação + respeito a reduced motion */}
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

