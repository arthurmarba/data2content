"use client";

import type { ReactNode } from "react";
import { AppHeader } from "@/design-system";

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
  return <AppHeader title={title} onBack={onBack} action={actionSlot} className="h-[60px] shrink-0" />;
}
