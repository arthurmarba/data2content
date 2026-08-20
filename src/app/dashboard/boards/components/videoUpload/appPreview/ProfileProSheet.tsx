"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * O convite do Pro, na hora em que ele é a resposta a alguma coisa.
 *
 * Não é o card de ativação, que fica parado na tela explicando o estado da
 * conta. Este aparece quando a pessoa TOCA num padrão bloqueado — ou seja,
 * quando ela acabou de demonstrar interesse por uma resposta específica. É a
 * diferença entre um cartaz e uma resposta a uma pergunta.
 *
 * Por isso ele sai de baixo em vez de cobrir a tela: o contexto que provocou o
 * toque continua visível atrás, e a segunda saída ("Ver minha narrativa
 * primeiro") existe porque nem todo interesse é intenção de compra — quem não
 * está pronto merece uma porta que não seja o botão de fechar.
 */
export function ProfileProSheet({
  open,
  narrativeActionLabel = "Ver minha narrativa primeiro",
  onUpgrade,
  onOpenNarrative,
  onClose,
}: {
  open: boolean;
  narrativeActionLabel?: string;
  onUpgrade: () => void;
  onOpenNarrative: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (document.activeElement === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-[var(--ds-color-scrim)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-sheet-title"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[430px] rounded-t-[22px] bg-[var(--ds-color-surface)] px-[18px] pb-7 pt-5 outline-none"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-[18px] block h-1 w-9 rounded-[2px] bg-[var(--ds-color-line-strong)]"
        />
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--ds-color-text-muted)]">
          Pro
        </p>
        <h2
          id="pro-sheet-title"
          className="mt-2.5 text-[22px] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--ds-color-ink)]"
        >
          Essa leitura é um exemplo. A sua chega toda segunda.
        </h2>
        <p className="mt-2.5 text-[13px] leading-[1.5] text-[var(--ds-color-text-secondary)]">
          No Pro, a D2C lê os seus posts, separa o que já é regra do que ainda é hipótese e monta a recomendação da
          semana em cima do que você postou.
        </p>
        <button type="button" onClick={onUpgrade} className="ds-button ds-button--primary ds-button--block mt-[18px]">
          Ativar o Pro
        </button>
        <button
          type="button"
          onClick={onOpenNarrative}
          className="ds-button ds-button--quiet ds-button--block mt-2"
        >
          {narrativeActionLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
