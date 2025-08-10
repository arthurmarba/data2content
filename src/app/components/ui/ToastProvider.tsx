"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info";
type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms
};

type ToastContextValue = {
  toast: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

const ToastCtx = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, any>>({});

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const toast = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = crypto.randomUUID();
      const duration = t.duration ?? 4000;
      const next: ToastItem = { id, variant: "info", ...t };
      setItems((prev) => [...prev, next]);

      if (duration > 0) {
        timersRef.current[id] = setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const dismissAll = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
    setItems([]);
  }, []);

  const value = useMemo(() => ({ toast, dismiss, dismissAll }), [toast, dismiss, dismissAll]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {/* Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={[
              "w-[320px] shadow-lg rounded-lg p-3 text-sm transition-all animate-[fadeIn_.15s_ease-out]",
              t.variant === "success" && "bg-green-600 text-white",
              t.variant === "error" && "bg-red-600 text-white",
              (!t.variant || t.variant === "info") && "bg-gray-900 text-white",
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
          >
            <div className="flex items-start gap-2">
              <div className="grow">
                {t.title && <div className="font-medium">{t.title}</div>}
                {t.description && <div className="opacity-90">{t.description}</div>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="opacity-80 hover:opacity-100 focus:outline-none"
                aria-label="Fechar"
                title="Fechar"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* animação básica */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastCtx.Provider>
  );
}

