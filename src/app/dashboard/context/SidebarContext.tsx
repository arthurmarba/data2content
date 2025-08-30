// src/app/dashboard/context/SidebarContext.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SidebarCtx = {
  isCollapsed: boolean;              // true = fechado, false = aberto
  toggleSidebar: (next?: boolean) => void;
  setCollapsed: (v: boolean) => void;
};

const Ctx = createContext<SidebarCtx | null>(null);
const STORAGE_KEY = "sidebar:collapsed"; // persiste preferência

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Inicia FECHADO para evitar o flash de overlay no mobile.
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const mqRef = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(min-width: 1024px)"); // lg
    mqRef.current = mq;

    // 1) Tenta restaurar preferência salva
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === "1");
    } else {
      // 2) Sem preferência: desktop abre por padrão, mobile fecha
      setIsCollapsed(mq.matches ? false : true);
    }

    // 3) Reage à mudança de breakpoint:
    // - Entrou no mobile  -> sempre fechado por padrão
    // - Entrou no desktop -> usa preferido salvo (ou aberto por padrão)
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        // desktop
        const saved = localStorage.getItem(STORAGE_KEY);
        setIsCollapsed(saved !== null ? saved === "1" : false);
      } else {
        // mobile
        setIsCollapsed(true);
      }
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const applyAndPersist = useCallback((v: boolean) => {
    setIsCollapsed(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = useCallback((next?: boolean) => {
    setIsCollapsed(prev => {
      const v = typeof next === "boolean" ? next : !prev;
      try {
        localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
      } catch {/* ignore */}
      return v;
    });
  }, []);

  const setCollapsed = useCallback((v: boolean) => applyAndPersist(v), [applyAndPersist]);

  const value = useMemo(
    () => ({ isCollapsed, toggleSidebar, setCollapsed }),
    [isCollapsed, toggleSidebar, setCollapsed]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSidebar() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
