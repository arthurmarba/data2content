// Helpers e constantes de demo para a landing
import dynamic from "next/dynamic";
import { createElement, Fragment, type ReactNode } from "react";

// Handle do Media Kit público usado na landing (iframe/link demo)
export const DEMO_MEDIAKIT_HANDLE = process.env.NEXT_PUBLIC_DEMO_MEDIAKIT_HANDLE || "arthur-marba";
export const DEMO_URL = `https://data2content.ai/mediakit/${DEMO_MEDIAKIT_HANDLE}`;

// User ID de demonstração para chamadas públicas (quando aplicável)
export const DEMO_USER_ID = process.env.NEXT_PUBLIC_DEMO_USER_ID || "demo";

// Opcional: um postId de demonstração para abrir o PostDetailModal público
export const DEMO_POST_ID = process.env.NEXT_PUBLIC_DEMO_POST_ID || "";

export const isHexObjectId = (id: string) => /^[a-fA-F0-9]{24}$/.test(String(id || ''));

// Retorna início da semana (Domingo) em YYYY-MM-DD
export function getWeekStartISO(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0..6 (0=Dom)
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

// dynamic import sem SSR para componentes pesados
export function dynamicNoSSR<T = any>(loader: () => Promise<T>, opts?: { loading?: ReactNode }) {
  return dynamic(loader as any, {
    ssr: false,
    // Next dynamic expects a component returning Element | null
    loading: () =>
      opts?.loading != null
        ? createElement(Fragment, null, opts.loading)
        : null,
  }) as any;
}
