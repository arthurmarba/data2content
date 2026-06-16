"use client";

import type { DiagnosticoCreatorDirectoryState } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { CreatorDirectorySection } from "./DiagnosticoCollabsDetailView";
import { CATEGORY_META } from "./DiagnosticoCategoryMeta";

const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/BAeBQZ8zuhQJOxXXJJaTnH";

const EMPTY_DIRECTORY: DiagnosticoCreatorDirectoryState = {
  status: "idle",
  creators: [],
  error: null,
};

interface Props {
  /** Directory of D2C creators — visible to everyone (social proof). */
  creatorDirectory?: DiagnosticoCreatorDirectoryState;
  /** Pro/admin users can join the WhatsApp community directly; free users are nudged to upgrade. */
  isPro?: boolean;
  /** Called when a free user taps "Entrar na comunidade" — opens the paywall. */
  onUpgrade?: () => void;
  onClose: () => void;
}

/**
 * Comunidade — superfície persistente, separada do card de Collabs.
 *
 * Regra de acesso (decisão de produto): qualquer criador VÊ o diretório da
 * comunidade (prova social no topo do funil); ENTRAR no grupo do WhatsApp é Pro.
 * O matching de collab continua no card de Collabs (depende de mapa confirmado).
 */
export function DiagnosticoCommunityDetailView({
  creatorDirectory = EMPTY_DIRECTORY,
  isPro = false,
  onUpgrade,
  onClose,
}: Props) {
  const meta = CATEGORY_META.community;

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
    >
      <CommunityJoinCard isPro={isPro} onUpgrade={onUpgrade} />

      {/* Diretório visível para todos — matchedSlugs vazio (sem personalização aqui). */}
      <CreatorDirectorySection directory={creatorDirectory} matchedSlugs={new Set()} />
    </DiagnosticoCategoryDetailView>
  );
}

/* ── Join card — gated by plan ───────────────────────────────────────────── */

function CommunityJoinCard({ isPro, onUpgrade }: { isPro: boolean; onUpgrade?: () => void }) {
  const titleText = "Você não está criando sozinho.";
  const descText = isPro
    ? "Toda semana a comunidade se reúne ao vivo pra ler conteúdo junto e ajustar a estratégia de imagem de cada um. Você está dentro."
    : "Toda semana a comunidade se reúne ao vivo pra ler conteúdo junto e ajustar a estratégia de imagem de cada um. Assine o Pro pra participar.";

  const ctaLabel = isPro ? "Acessar comunidade" : "Assinar para participar";

  const cardClass =
    "flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]";

  return (
    <section className={cardClass}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8" aria-hidden="true">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20v-1a6 6 0 0 1 6-6" strokeLinecap="round" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M13.5 20v-1a5 5 0 0 1 4-4.9" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-teal-700">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden="true" />
            Reunião semanal · ao vivo
          </span>
          <p className="mt-1.5 text-[15px] font-bold tracking-tight text-zinc-950">{titleText}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-zinc-500">{descText}</p>
        </div>
      </div>

      {isPro ? (
        <a
          href={WHATSAPP_COMMUNITY_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-4 py-2.5 text-[13px] font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
        >
          {ctaLabel}
        </a>
      ) : (
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-4 py-2.5 text-[13px] font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
        >
          {ctaLabel}
        </button>
      )}
    </section>
  );
}
