"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DiagnosticoNavHeader } from "./DiagnosticoNavHeader";
import { SAFE_TOP } from "./diagnosticoTokens";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  /** Propósito atual salvo no perfil (vindo de User.onboardingAnswers.creatorPurpose). */
  initialPurpose: string | null;
  onClose: () => void;
  /** Chamado quando o save é bem-sucedido, com o novo valor (ou null se limpo). */
  onSaved?: (newPurpose: string | null) => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_CHARS = 400;

// ─── Componente ───────────────────────────────────────────────────────────────

/**
 * Fase 4 — Tela "Meu Norte" nas Configurações.
 *
 * Permite ao criador ler e editar a declaração de propósito ("para quem cria /
 * o que quer que eles sintam") que alimenta a IA do mapa narrativo.
 *
 * Pattern: DiagnosticoNavHeader + paddingTop SAFE_TOP (igual a ReadingDetailView
 * e MediaKitSheet).
 */
export function DiagnosticoNorteView({ initialPurpose, onClose, onSaved }: Props) {
  const [value, setValue] = useState(initialPurpose?.trim() ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Foco automático no textarea ao abrir (melhora UX mobile — teclado sobe).
  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 200);
    return () => clearTimeout(timer);
  }, []);

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
      className="fixed inset-0 z-[300] flex flex-col bg-white"
      style={{ paddingTop: SAFE_TOP }}
    >
      <DiagnosticoNavHeader
        title="Meu Norte"
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

          {/* Cabeçalho da seção */}
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">
            Propósito
          </p>
          <h2 className="mb-2 text-[1.35rem] font-bold leading-snug tracking-tight text-zinc-950">
            Para quem você cria?
          </h2>
          <p className="mb-6 text-[13px] leading-relaxed text-zinc-500">
            Em uma frase: para quem cria e o que quer que eles sintam ou façam.
            Seu mapa usa este propósito para interpretar seus conteúdos e gerar pautas.
          </p>

          {/* Campo de texto */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setStatus("idle");
                setValue(e.target.value.slice(0, MAX_CHARS));
              }}
              placeholder="ex: quero encorajar mães sem tempo a se cuidarem"
              rows={4}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-[15px] leading-relaxed text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none transition-colors"
            />
            {/* Contador de caracteres — visível ao se aproximar do limite */}
            {value.length >= 300 && (
              <span className="absolute bottom-3 right-4 text-[11px] text-zinc-300">
                {value.length}/{MAX_CHARS}
              </span>
            )}
          </div>

          {/* Botão limpar — só quando tem valor */}
          {!isEmpty && (
            <button
              type="button"
              onClick={handleClear}
              className="mt-3 text-[12px] font-medium text-zinc-400 underline-offset-2 hover:underline"
            >
              Limpar
            </button>
          )}

          {/* Feedback de erro */}
          {status === "error" && (
            <p className="mt-4 text-[13px] font-medium text-red-500">
              Não conseguimos salvar agora. Tente de novo.
            </p>
          )}

          {/* Indicador de impacto — âncora da feature */}
          <div className="mt-8 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden="true" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                Como é usado
              </p>
            </div>
            <p className="text-[13px] leading-relaxed text-zinc-500">
              Quando você cria pautas ou analisa vídeos, a IA considera este propósito
              para filtrar o que é coerente com quem você é e para quem cria.
            </p>
          </div>

          {/* Empty state — convite quando não há propósito */}
          {isEmpty && (
            <p className="mt-6 text-center text-[13px] leading-relaxed text-zinc-400">
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
      <span className="flex items-center gap-1 text-[13px] font-semibold text-emerald-600">
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
      className="rounded-full bg-zinc-950 px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-30 active:opacity-70"
    >
      {status === "saving" ? "Salvando…" : "Salvar"}
    </button>
  );
}
