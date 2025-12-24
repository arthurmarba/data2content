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
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

const getInitialCollapsed = () => true;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(getInitialCollapsed);
  const isDesktopRef = useRef<boolean>(
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_MEDIA_QUERY).matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncFromEnvironment = (matches: boolean) => {
      isDesktopRef.current = matches;
      if (matches) {
        try {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          setIsCollapsed(stored !== null ? stored === "1" : false);
        } catch {
          setIsCollapsed(false);
        }
      } else {
        setIsCollapsed(true);
      }
    };

    syncFromEnvironment(mq.matches);

    const onChange = (e: MediaQueryListEvent) => {
      syncFromEnvironment(e.matches);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const applyAndPersist = useCallback((v: boolean) => {
    setIsCollapsed(v);
    if (isDesktopRef.current) {
      try {
        window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  }, []);

  const toggleSidebar = useCallback((next?: boolean) => {
    setIsCollapsed((prev) => {
      const resolved = typeof next === "boolean" ? next : !prev;
      if (isDesktopRef.current) {
        try {
          window.localStorage.setItem(STORAGE_KEY, resolved ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return resolved;
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
