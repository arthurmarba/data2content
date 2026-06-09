"use client";

interface Props {
  onClose: () => void;
  /** Rótulo acessível (default "Fechar"). */
  ariaLabel?: string;
  disabled?: boolean;
  /** Margem negativa à direita para alinhar o círculo visual à borda (opcional). */
  edgeAlign?: boolean;
}

/**
 * DiagnosticoCloseButton — botão "×" padrão dos modais/sheets da experiência V2.
 *
 * Área de toque 44×44 (iOS/Android HIG) com círculo visual de 36px (bg-zinc-100),
 * mesmo padrão usado na engrenagem do header. Glyph "×" canônico.
 */
export function DiagnosticoCloseButton({
  onClose,
  ariaLabel = "Fechar",
  disabled = false,
  edgeAlign = false,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClose}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex h-11 w-11 shrink-0 items-center justify-center bg-transparent ${edgeAlign ? "-mr-1.5" : ""}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 hover:bg-zinc-200 hover:text-zinc-800">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  );
}
