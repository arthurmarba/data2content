"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DiagnosticoNavHeader } from "./DiagnosticoNavHeader";
import { SAFE_TOP } from "./diagnosticoTokens";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";

// Lazy-load — MediaKitView é ~5 200 linhas; não deve entrar no bundle inicial do dashboard.
const MediaKitView = dynamic(
  () => import("@/app/mediakit/[token]/MediaKitView"),
  { ssr: false, loading: () => <MediaKitSkeleton /> },
);

interface MediaKitSheetProps {
  slug: string;
  onClose: () => void;
}

export function MediaKitSheet({ slug, onClose }: MediaKitSheetProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setData(null);
    setError(false);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetch(`/api/mediakit/${encodeURIComponent(slug)}/view-data`, {
      signal: ctrl.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => {
        if (err?.name !== "AbortError") setError(true);
      });

    return () => ctrl.abort();
  }, [loadVersion, slug]);

  return (
    <div
      className={`d2c-mobile-app ds-notebook fixed inset-0 z-[300] flex flex-col bg-[var(--ds-color-neutral)] ${d2cFontVariables}`}
      style={{ paddingTop: SAFE_TOP }}
    >
      {/* Header padrão */}
      <DiagnosticoNavHeader title="Mídia Kit" onBack={onClose} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain bg-[var(--ds-color-surface)]">
        {error ? (
          <ErrorState onRetry={() => { setError(false); setData(null); setLoadVersion((version) => version + 1); }} />
        ) : data ? (
          <MediaKitView
            user={data.user as any}
            summary={data.summary as any}
            videos={(data.videos as any) ?? []}
            kpis={data.kpis as any}
            demographics={data.demographics as any}
            engagementTrend={data.engagementTrend as any}
            showOwnerCtas={false}
            compactPadding
            compactBoardPreview
            mediaKitSlug={data.mediaKitSlug as string}
            premiumAccess={data.premiumAccess as any}
            pricing={data.pricing as any}
            pricingPublished={Boolean(data.pricingPublished)}
            packages={(data.packages as any) ?? []}
          />
        ) : (
          <MediaKitSkeleton />
        )}
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

function MediaKitSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg animate-pulse flex-col gap-3 bg-[var(--ds-color-neutral)] px-4 pb-8 pt-4">
      {/* Avatar + nome */}
      <section className="ds-notebook-section flex flex-col items-center gap-3 pt-6">
        <div className="h-20 w-20 rounded-full bg-[var(--ds-color-neutral)]" />
        <div className="h-4 w-36 rounded bg-[var(--ds-color-neutral)]" />
        <div className="h-3 w-24 rounded bg-[var(--ds-color-neutral)]" />
        <div className="mt-2 h-10 w-40 rounded-lg bg-[var(--ds-color-neutral)]" />
      </section>
      {/* Seção de destaque */}
      <section className="ds-notebook-section flex flex-col gap-2">
        <div className="h-3 w-32 rounded bg-[var(--ds-color-neutral)]" />
        <div className="h-20 rounded-lg bg-[var(--ds-color-neutral)]" />
        <div className="h-20 rounded-lg bg-[var(--ds-color-neutral)]" />
      </section>
      {/* Gênero */}
      <section className="ds-notebook-section flex flex-col gap-2">
        <div className="h-3 w-20 rounded bg-[var(--ds-color-neutral)]" />
        <div className="h-3 w-full rounded bg-[var(--ds-color-neutral)]" />
        <div className="h-3 w-3/4 rounded bg-[var(--ds-color-neutral)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--ds-color-neutral)]" />
      </section>
      {/* KPIs */}
      <section className="ds-notebook-section grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-[var(--ds-color-neutral)]" />
        ))}
      </section>
    </div>
  );
}

/* ── Error state ──────────────────────────────────────────────────────────── */

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="font-display text-[1.25rem] font-bold text-[var(--ds-color-ink)]">
        Não foi possível carregar o Mídia Kit
      </p>
      <p className="text-[13px] text-[var(--ds-color-text-muted)]">Verifique a conexão e tente novamente.</p>
      <button
        type="button"
        onClick={onRetry}
        className="ds-button ds-button--primary mt-2"
      >
        Tentar novamente
      </button>
    </div>
  );
}
