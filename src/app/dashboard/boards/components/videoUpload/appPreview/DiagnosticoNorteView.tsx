"use client";

import { useCallback, useRef, useState } from "react";
import { DiagnosticoNavHeader } from "./DiagnosticoNavHeader";
import { SAFE_TOP } from "./diagnosticoTokens";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  /** Propósito atual salvo no perfil (vindo de User.onboardingAnswers.creatorPurpose). */
  initialPurpose: string | null;
  /** Leitura atual exibida no card "Seu mapa". */
  mapNarrative: string | null;
  mapTerritories: string[];
  onClose: () => void;
  /** Abre as respostas que dão origem ao mapa. */
  onEditMap: () => void;
  /** Chamado quando o save é bem-sucedido, com o novo valor (ou null se limpo). */
  onSaved?: (newPurpose: string | null) => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_CHARS = 400;

// ─── Componente ───────────────────────────────────────────────────────────────

/**
 * Tela "Seu norte" nas Configurações.
 *
 * Permite ao criador ler e editar a declaração de propósito ("para quem cria /
 * o que quer que eles sintam") que alimenta a IA do mapa narrativo.
 *
 * Pattern: DiagnosticoNavHeader + paddingTop SAFE_TOP (igual a ReadingDetailView
 * e MediaKitSheet).
 */
export function DiagnosticoNorteView({
  initialPurpose,
  mapNarrative,
  mapTerritories,
  onClose,
  onEditMap,
  onSaved,
}: Props) {
  const [value, setValue] = useState(initialPurpose?.trim() ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = value.trim() !== (initialPurpose?.trim() ?? "");
  const isEmpty = value.trim().length === 0;

  const handleSave = useCallback(async () => {
    if (!isDirty || status === "saving") return;

    setStatus("saving");
    try {
      const res = await fetch(
        "/api/dashboard/mobile-strategic-profile/onboarding-answers",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorPurpose: value.trim() || null }),
        },
      );

      if (!res.ok) throw new Error(`status ${res.status}`);

      setStatus("saved");
      onSaved?.(value.trim() || null);

      // Reset "saved" feedback após 2 s
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [isDirty, status, value, onSaved]);

  const handleClear = useCallback(() => {
    setValue("");
    textareaRef.current?.focus();
  }, []);

  return (
    <div
      className="ds-screen fixed inset-0 z-[300] flex flex-col"
      style={{ paddingTop: SAFE_TOP }}
    >
      <DiagnosticoNavHeader
        title="Seu norte"
        onBack={onClose}
        actionSlot={
          <SaveButton
            status={status}
            disabled={!isDirty || status === "saving"}
            onClick={handleSave}
          />
        }
      />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-lg px-5 pb-16 pt-6">
          <section className="ds-notebook-section" aria-labelledby="norte-purpose-title">
            <p className="ds-notebook-label mb-1">Propósito</p>
            <h2 id="norte-purpose-title" className="mb-2 font-display text-[1.75rem] font-bold leading-[1.05] tracking-[-0.035em] text-[var(--ds-color-ink)]">
              Para quem você cria?
            </h2>
            <p className="mb-5 text-[13px] leading-relaxed text-[var(--ds-color-text-secondary)]">
              Em uma frase: para quem cria e o que quer que eles sintam ou façam.
              Seu mapa usa este propósito para interpretar seus conteúdos e gerar pautas.
            </p>

            <div className="relative rounded-lg bg-[var(--ds-color-neutral)] px-3">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  setStatus("idle");
                  setValue(e.target.value.slice(0, MAX_CHARS));
                }}
                placeholder="ex: quero encorajar mães sem tempo a se cuidarem"
                rows={4}
                className="min-h-[8rem] w-full resize-none border-0 bg-transparent px-0 py-3 text-[15px] leading-relaxed text-[var(--ds-color-ink)] outline-none placeholder:text-[var(--ds-color-text-muted)] focus:ring-0"
              />
              {value.length >= 300 && (
                <span className="absolute bottom-3 right-4 text-[11px] text-[var(--ds-color-text-muted)]">
                  {value.length}/{MAX_CHARS}
                </span>
              )}
            </div>

            {!isEmpty && (
              <button
                type="button"
                onClick={handleClear}
                className="mt-3 min-h-11 text-[12px] font-medium text-[var(--ds-color-text-muted)] underline-offset-2 hover:underline"
              >
                Limpar
              </button>
            )}

            {status === "error" && (
              <p className="mt-4 text-[13px] font-medium text-[var(--ds-color-danger)]">
                Não conseguimos salvar agora. Tente de novo.
              </p>
            )}
          </section>

          <section className="ds-notebook-section" aria-labelledby="norte-map-title">
            <p className="ds-notebook-label">Seu mapa</p>
            <h2
              id="norte-map-title"
              className="mt-3 font-display text-[1.45rem] font-bold leading-[1.12] tracking-[-0.035em] text-[var(--ds-color-ink)]"
            >
              “{mapNarrative || "Sua história ainda está ganhando forma"}”
            </h2>

            <div className="mt-5">
              <p className="ds-notebook-label">Seus assuntos</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {mapTerritories.length > 0 ? mapTerritories.map((territory) => (
                  <span key={territory} className="ds-notebook-tag">{territory}</span>
                )) : (
                  <span className="ds-caption">Responda algumas perguntas para formar os primeiros assuntos do seu mapa.</span>
                )}
              </div>
              <p className="ds-caption mt-3">
                O mapa nasce das suas respostas e fica mais preciso conforme a D2C lê seus vídeos.
              </p>
              <button type="button" className="ds-notebook-action mt-3" onClick={onEditMap}>
                <span>Ajustar respostas do mapa</span>
                <span className="text-[var(--ds-color-text-muted)]" aria-hidden="true">›</span>
              </button>
            </div>
          </section>

          <details className="group rounded-[var(--ds-radius-md)] bg-[var(--ds-color-surface)] px-4 py-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-[var(--ds-color-ink)]">
              Como é usado
              <span className="text-[var(--ds-color-text-muted)] transition-transform group-open:rotate-90" aria-hidden="true">›</span>
            </summary>
            <p className="pb-2 pr-6 text-[13px] leading-relaxed text-[var(--ds-color-text-muted)]">
              Quando você cria pautas ou analisa vídeos, a IA considera este propósito
              para filtrar o que é coerente com quem você é e para quem cria.
            </p>
          </details>

          {/* Empty state — convite quando não há propósito */}
          {isEmpty && (
            <p className="mt-6 text-center text-[13px] leading-relaxed text-[var(--ds-color-text-muted)]">
              Sem propósito declarado, o mapa usa só os sinais dos seus vídeos.
              Uma frase já faz diferença.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componente: botão de salvar ─────────────────────────────────────────

function SaveButton({
  status,
  disabled,
  onClick,
}: {
  status: "idle" | "saving" | "saved" | "error";
  disabled: boolean;
  onClick: () => void;
}) {
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-[13px] font-semibold text-[var(--ds-color-success)]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Salvo
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ds-button ds-button--secondary ds-button--small min-h-11 disabled:bg-transparent disabled:text-[var(--ds-color-text-muted)]"
    >
      {status === "saving" ? "Salvando…" : "Salvar"}
    </button>
  );
}
