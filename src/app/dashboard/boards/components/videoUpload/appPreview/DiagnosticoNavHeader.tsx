"use client";

import type { ReactNode } from "react";

interface Props {
  /** Título da tela, à esquerda, ao lado do botão voltar. */
  title: string;
  /** Callback do botão voltar (chevron à esquerda). */
  onBack: () => void;
  /** Slot opcional de ação no canto direito do header. */
  actionSlot?: ReactNode;
}

/**
 * DiagnosticoNavHeader — barra de navegação padrão das telas full-screen de
 * drill-down da experiência V2.
 *
 * Padrão único (decidido em revisão de UX): chevron 44×44 (só ícone) à esquerda,
 * título grande à esquerda, slot de ação opcional à direita. Glyph canônico de
 * voltar = chevron `M15.5 19l-7-7 7-7`, 22px.
 *
 * NÃO inclui o container `fixed inset-0` nem o `paddingTop: SAFE_TOP` — isso fica
 * a cargo de cada tela (ou do wrapper), pois bg/scroll variam.
 */
export function DiagnosticoNavHeader({ title, onBack, actionSlot }: Props) {
  return (
    <div className="flex h-[60px] shrink-0 items-center gap-1.5 px-4">
      <button
        type="button"
        onClick={onBack}
        className="flex h-11 w-11 shrink-0 items-center justify-start text-zinc-950 transition-opacity duration-150 active:opacity-50 focus-visible:outline-none"
        aria-label="Voltar"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15.5 19l-7-7 7-7"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <p className="truncate text-[18px] font-bold tracking-tight text-zinc-950">{title}</p>

      {actionSlot && (
        <div className="ml-auto flex shrink-0 items-center">{actionSlot}</div>
      )}
    </div>
  );
}
