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
}

function SnapshotSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="mt-6 h-9 w-44 animate-pulse rounded bg-slate-200" />
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Seu Mídia Kit</h2>
      <p className="mt-1 text-sm text-slate-500">
        {hasMediaKit
          ? "Use o link abaixo na bio e destaque suas métricas para marcas."
          : "Crie seu Mídia Kit em 2 minutos e transforme visitas em propostas."}
      </p>

      {hasMediaKit ? (
        <div className="mt-5 space-y-4">
          <dl className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <dt className="text-slate-500">Views (7 dias)</dt>
              <dd className="font-semibold text-slate-900">{mediaKit?.viewsLast7Days ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-slate-500">Propostas via kit</dt>
              <dd className="font-semibold text-slate-900">
                {mediaKit?.proposalsViaMediaKit ?? 0}
              </dd>
            </div>
            {mediaKit?.lastUpdatedLabel ? (
              <div className="flex items-center justify-between text-sm">
                <dt className="text-slate-500">Última atualização</dt>
                <dd className="font-medium text-slate-900">{mediaKit.lastUpdatedLabel}</dd>
              </div>
            ) : null}
          </dl>

          {highlights.length ? (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {highlights.map((item) => (
                <li key={item.label} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-2 text-xs text-slate-500">
            <p>Copie o link e adicione na bio. Fixe “Parcerias” nos stories para aumentar o fluxo.</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          <p>
            Crie seu Mídia Kit em 2 minutos e comece a atrair marcas com uma vitrine profissional.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {hasMediaKit ? (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
              onClick={handleCopy}
              aria-label="Copiar link do Mídia Kit"
            >
              <LinkIcon className="h-4 w-4" />
              Copiar link da bio
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
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
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
              Editar kit
            </button>
          </>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
            Criar Mídia Kit
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
