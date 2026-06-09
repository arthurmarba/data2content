"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DiagnosticoNavHeader } from "./DiagnosticoNavHeader";
import { SAFE_TOP } from "./diagnosticoTokens";

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
  }, [slug]);

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-white"
      style={{ paddingTop: SAFE_TOP }}
    >
      {/* Header padrão */}
      <DiagnosticoNavHeader title="Mídia Kit" onBack={onClose} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {error ? (
          <ErrorState onRetry={() => { setError(false); setData(null); }} slug={slug} />
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
    <div className="animate-pulse px-5 pt-6 pb-8 flex flex-col gap-6">
      {/* Avatar + nome */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="h-20 w-20 rounded-full bg-zinc-200" />
        <div className="h-4 w-36 rounded-full bg-zinc-200" />
        <div className="h-3 w-24 rounded-full bg-zinc-100" />
      </div>
      {/* Botão de copiar link */}
      <div className="mx-auto h-10 w-40 rounded-full bg-zinc-200" />
      {/* Seção de destaque */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-32 rounded-full bg-zinc-200" />
        <div className="h-20 rounded-2xl bg-zinc-100" />
        <div className="h-20 rounded-2xl bg-zinc-100" />
      </div>
      {/* Gênero */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-20 rounded-full bg-zinc-200" />
        <div className="h-3 w-full rounded-full bg-zinc-100" />
        <div className="h-3 w-3/4 rounded-full bg-zinc-100" />
        <div className="h-3 w-1/2 rounded-full bg-zinc-100" />
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}

/* ── Error state ──────────────────────────────────────────────────────────── */

function ErrorState({ onRetry, slug }: { onRetry: () => void; slug: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-[15px] font-semibold text-zinc-800">
        Não foi possível carregar o Mídia Kit
      </p>
      <p className="text-[13px] text-zinc-400">Verifique a conexão e tente novamente.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-full bg-zinc-950 px-5 py-2.5 text-[13px] font-semibold text-white active:opacity-80"
      >
        Tentar novamente
      </button>
    </div>
  );
}
