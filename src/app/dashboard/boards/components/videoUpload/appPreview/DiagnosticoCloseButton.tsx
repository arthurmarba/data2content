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
 * Área de toque 44×44 com a superfície quiet do creator-studio.
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
      className={`ds-icon-button ${edgeAlign ? "-mr-1.5" : ""}`}
    >
      <span className="grid place-items-center text-zinc-500">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  );
}
