// src/app/dashboard/home/minimal/MediaKitSnapshot.tsx

"use client";

import React from "react";
import toast from "react-hot-toast";
import { Link as LinkIcon, ExternalLink, Pencil } from "lucide-react";
import type { MediaKitCardData } from "../types";
import { track } from "@/lib/track";

async function tryCopyShareUrl(shareUrl: string): Promise<"clipboard" | "execCommand" | null> {
  // Tenta API moderna
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && typeof window !== "undefined" && window.isSecureContext) {
      await navigator.clipboard.writeText(shareUrl);
      return "clipboard";
    }
  } catch {
    // Continua para fallback
  }

  // Fallback compatível com Safari / contextos bloqueados
  try {
    if (typeof document === "undefined") return null;
    const textarea = document.createElement("textarea");
    textarea.value = shareUrl;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (success) return "execCommand";
  } catch {
    // ignore
  }
  return null;
}

interface MediaKitSnapshotProps {
  mediaKit: MediaKitCardData | null;
  loading: boolean;
  onCopyLink?: () => boolean | Promise<boolean>;
  onViewAsBrand: () => void;
  onEdit: () => void;
  creatorId?: string | null;
  compactView?: boolean;
}

function SnapshotSkeleton() {
  return (
    <div className="dashboard-panel rounded-[2rem] p-5">
      <div className="h-3 w-24 animate-pulse rounded-full bg-zinc-200" />
      <div className="mt-3 h-6 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="mt-2 h-4 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
          </div>
        ))}
      </div>
      <div className="mt-6 h-10 w-44 animate-pulse rounded-2xl bg-zinc-200" />
    </div>
  );
}

export default function MediaKitSnapshot({
  mediaKit,
  loading,
  onCopyLink,
  onViewAsBrand,
  onEdit,
  creatorId,
  compactView = false,
}: MediaKitSnapshotProps) {
  const handleCopy = React.useCallback(async () => {
    if (!mediaKit?.shareUrl) {
      toast.error("Crie seu Mídia Kit para gerar um link compartilhável.");
      return;
    }

    try {
      let handled = false;
      if (onCopyLink) {
        const result = await Promise.resolve(onCopyLink());
        handled = result === true;
      }

      if (handled) return;

      const copyMethod = await tryCopyShareUrl(mediaKit.shareUrl);
      if (copyMethod) {
        toast.success("Link do Mídia Kit copiado!");
        track("copy_media_kit_link", {
          creator_id: creatorId ?? null,
          media_kit_id: extractMediaKitId(mediaKit.shareUrl),
          origin: "media_kit_block",
        });
        return;
      }

      toast.error("Não foi possível copiar o link agora. Toque e segure para copiar manualmente.");
    } catch {
      toast.error("Não foi possível copiar o link agora. Toque e segure para copiar manualmente.");
    }
  }, [creatorId, mediaKit?.shareUrl, onCopyLink]);

  if (loading && !mediaKit) {
    return <SnapshotSkeleton />;
  }

  const hasMediaKit = Boolean(mediaKit?.hasMediaKit);
  const highlights = mediaKit?.highlights ?? [];
  const visibleHighlights = compactView ? highlights.slice(0, 3) : highlights;
  const wrapperClassName = compactView
    ? "dashboard-panel rounded-[1.7rem] p-4"
    : "dashboard-panel rounded-[2rem] p-5";
  const titleClassName = compactView ? "text-base font-semibold tracking-tight text-zinc-900" : "text-lg font-semibold tracking-tight text-zinc-900";
  const descriptionClassName = compactView ? "mt-2 text-[13px] leading-snug text-zinc-500" : "mt-2 text-sm leading-relaxed text-zinc-500";
  const metricValueClassName = compactView ? "text-[13px] font-semibold text-zinc-900" : "font-semibold text-zinc-900";
  const actionContainerClassName = compactView
    ? "mt-5 flex flex-col gap-2"
    : "mt-6 flex flex-wrap items-center gap-3";

  return (
    <div className={wrapperClassName}>
      <p className="dashboard-muted-label">Mídia Kit</p>
      <h2 className={titleClassName}>Seu Mídia Kit</h2>
      <p className={descriptionClassName}>
        {hasMediaKit
          ? compactView
            ? "Deixe seu kit pronto para bio e propostas."
            : "Use o link abaixo na bio e destaque suas métricas para marcas."
          : compactView
            ? "Crie seu kit e transforme visitas em propostas."
            : "Crie seu Mídia Kit em 2 minutos e transforme visitas em propostas."}
      </p>

      {hasMediaKit ? (
        <div className={compactView ? "mt-4 space-y-3.5" : "mt-5 space-y-4"}>
          <dl className="overflow-hidden rounded-[1.4rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(250,250,250,0.76))]">
            <div className="flex items-center justify-between text-sm">
              <dt className="px-4 py-3 text-zinc-500">Views (7 dias)</dt>
              <dd className={`px-4 py-3 ${metricValueClassName}`}>{mediaKit?.viewsLast7Days ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-100/90 text-sm">
              <dt className="px-4 py-3 text-zinc-500">Propostas via kit</dt>
              <dd className={`px-4 py-3 ${metricValueClassName}`}>
                {mediaKit?.proposalsViaMediaKit ?? 0}
              </dd>
            </div>
            {mediaKit?.lastUpdatedLabel ? (
              <div className="flex items-center justify-between border-t border-zinc-100/90 text-sm">
                <dt className="px-4 py-3 text-zinc-500">Última atualização</dt>
                <dd className={`px-4 py-3 ${compactView ? "text-[13px] font-medium text-zinc-900" : "font-medium text-zinc-900"}`}>
                  {mediaKit.lastUpdatedLabel}
                </dd>
              </div>
            ) : null}
          </dl>

          {visibleHighlights.length ? (
            <div>
              <p className="dashboard-muted-label mb-2">Destaques estratégicos</p>
              <ul className="overflow-hidden rounded-[1.35rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(250,250,250,0.74))]">
              {visibleHighlights.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center justify-between border-b border-zinc-100/90 last:border-b-0 ${compactView ? "gap-3 px-3 py-2.5 text-[13px]" : "px-4 py-3 text-sm"}`}
                >
                  <span className="text-zinc-500">{item.label}</span>
                  <span className="font-semibold text-zinc-900">{item.value}</span>
                </li>
              ))}
              </ul>
            </div>
          ) : null}

          <div className={`space-y-2 text-zinc-500 ${compactView ? "text-[11px]" : "text-xs"}`}>
            <p>
              {compactView
                ? "Copie o link para bio e stories."
                : "Copie o link e adicione na bio. Fixe “Parcerias” nos stories para aumentar o fluxo."}
            </p>
          </div>
        </div>
      ) : (
        <div className={`dashboard-empty-state border border-dashed border-zinc-200 text-zinc-500 ${compactView ? "mt-5 rounded-[1.35rem] p-3.5 text-[13px]" : "mt-6 rounded-[1.5rem] p-4 text-sm"}`}>
          <p>
            Crie seu Mídia Kit em 2 minutos e comece a atrair marcas com uma vitrine profissional.
          </p>
        </div>
      )}

      <div className={actionContainerClassName}>
        {hasMediaKit ? (
          <>
            <button
              type="button"
              className={`dashboard-primary-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1 ${compactView ? "w-full" : ""}`}
              onClick={handleCopy}
              aria-label="Copiar link do Mídia Kit"
            >
              <LinkIcon className="h-4 w-4" />
              {compactView ? "Copiar link" : "Copiar link da bio"}
            </button>
            <button
              type="button"
              className={`dashboard-secondary-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-1 ${compactView ? "w-full" : ""}`}
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
              {compactView ? "Editar kit" : "Editar kit"}
            </button>
            {!compactView ? (
              <button
                type="button"
                className="dashboard-secondary-button inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-1"
                onClick={() => {
                  onViewAsBrand();
                  if (mediaKit?.shareUrl) {
                    window.open(mediaKit.shareUrl, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Ver como marca
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className={`dashboard-primary-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1 ${compactView ? "w-full" : ""}`}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
            {compactView ? "Criar kit" : "Criar Mídia Kit"}
          </button>
        )}
      </div>
    </div>
  );
}

function extractMediaKitId(shareUrl: string | null | undefined): string | null {
  if (!shareUrl) return null;
  try {
    const url = new URL(
      shareUrl,
      typeof window !== "undefined" ? window.location.origin : "https://app.data2content.ai"
    );
    const segments = url.pathname.split("/").filter(Boolean);
    return segments.pop() ?? null;
  } catch {
    return null;
  }
}
