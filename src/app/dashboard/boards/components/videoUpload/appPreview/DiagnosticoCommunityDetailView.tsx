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
  const titleText = "Os criadores que você vê aqui se falam.";
  const descText = isPro
    ? "Você está dentro. Troque sobre narrativa, mapa e criação com a comunidade."
    : "Assine o Pro para entrar no grupo deles no WhatsApp.";

  const ctaLabel = isPro ? "Entrar na comunidade" : "Assinar para entrar";

  const cardClass =
    "flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]";

  return (
    <section className={cardClass}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#0d9488" aria-hidden="true">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.02a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.24 8.23Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold tracking-tight text-zinc-950">{titleText}</p>
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
