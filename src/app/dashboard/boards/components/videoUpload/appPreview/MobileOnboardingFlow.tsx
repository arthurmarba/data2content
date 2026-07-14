"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MOBILE_INSTAGRAM_CONNECT_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { SAFE_TOP } from "./diagnosticoTokens";
import type { NarrativeMapAccessState } from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import { color, font } from "@/design-system";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingAnswers = {
  whyYouCreate: string;
  desiredFeeling: string;
  contentLimit?: string;
  /**
   * Declaração de propósito livre — "para quem cria / o que quer que eles sintam".
   * Coletada no Q3 do onboarding (opcional). Alimenta a geração do mapa (Fase 3).
   */
  creatorPurpose?: string;
  // Mapa seed — 5 perguntas adicionadas na Fase 1
  niches?: string[];
  brandTerritories?: string;
  mainGoal3m?: string;
  mainPains?: string[];
  dreamBrands?: string;
};

export type OnboardingStep =
  | "welcome"
  | "questions"          // Q1+Q2 fusionados — novo fluxo otimizado
  | "calibrating"
  | "first_signal"
  | "instagram_invite"   // CTA de Instagram pós first_signal — novo
  // Legacy: aceitos via initialStep para retomada após redirect OAuth
  | "instagram"
  | "question_1"
  | "question_2"
  | "question_3"
  // Mapa seed: mantidos no tipo mas removidos do fluxo principal (acessíveis via gear)
  | "map_q1"
  | "map_q2"
  | "map_q3"
  | "map_q4"
  | "map_q5";

interface FirstSignal {
  label: string;
  summary: string;
  source?: "detected" | "seed";
}

interface Props {
  open: boolean;
  instagramConnected: boolean;
  accessState: NarrativeMapAccessState;
  /** Leading narrative signal from synthesis — shown at first_signal step if present. */
  firstSignal?: FirstSignal | null;
  /**
   * O3 — step de retomada após redirect do Instagram.
   * Quando definido, o onboarding inicia neste step em vez de "welcome",
   * evitando que o criador tenha de clicar "Começar" de novo.
   */
  initialStep?: OnboardingStep;
  /**
   * O3 — callback que o shell usa para salvar o step atual em sessionStorage
   * antes de navegar para o fluxo de conexão do Instagram.
   * Se omitido, cai no comportamento legado (window.location.href).
   */
  onConnectInstagram?: () => void;
  onComplete: (answers: OnboardingAnswers) => void;
  /** Decisão 2 — abre o upload de vídeo direto após o criador escolher "Enviar meu primeiro vídeo" no first_signal. */
  onRequestUpload?: () => void;
}

// ─── Option data ──────────────────────────────────────────────────────────────


// ─── Flow orientation (Fase 3b) ───────────────────────────────────────────────

/**
 * Telas visíveis do fluxo, na ordem, para o usuário atual.
 *
 *   - não-free, sem IG   → instagram_invite após questions
 *   - demais             → encerra direto após questions
 *
 * `calibrating` é estado de loading — não conta como etapa de progresso.
 */
function getVisibleSteps(
  instagramConnected: boolean,
  accessState: NarrativeMapAccessState,
): OnboardingStep[] {
  const steps: OnboardingStep[] = ["questions"];
  if (accessState !== "free_unused" && !instagramConnected) steps.push("instagram_invite");
  return steps;
}


/** Para qual step o botão "voltar" leva. Ausência = sem voltar (entrada/loading). */
const BACK_TARGET: Partial<Record<OnboardingStep, OnboardingStep>> = {
  instagram_invite: "questions",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileOnboardingFlow({
  open,
  instagramConnected,
  accessState,
  firstSignal,
  initialStep,
  onConnectInstagram,
  onComplete,
  onRequestUpload,
}: Props) {
  // Steps legacy + "welcome" mapeados para "questions" — welcome eliminado do fluxo.
  const resolveInitialStep = (s?: OnboardingStep): OnboardingStep => {
    if (!s || s === "welcome" || s === "question_1" || s === "question_2" || s === "question_3" || s === "instagram") return "questions";
    return s;
  };
  const [step, setStep] = useState<OnboardingStep>(resolveInitialStep(initialStep));
  // Q1 e Q2 (múltipla escolha) foram removidos da UI — mantidos com valores padrão
  // para compatibilidade com o backend (que ainda valida esses campos).
  const [whyYouCreate] = useState("ensino_conhecimento");
  const [desiredFeeling] = useState("inspirado");
  const [creatorPurpose, setCreatorPurpose] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [calibrationError, setCalibrationError] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("questions");
      setCreatorPurpose("");
      setIsSaving(false);
      setCalibrationError(false);
    }
  }, [open]);

  const completeOnboarding = useCallback((openUpload = false) => {
    const answers: OnboardingAnswers = {
      whyYouCreate,
      desiredFeeling,
      ...(creatorPurpose ? { creatorPurpose } : {}),
    };
    onComplete(answers);
    if (openUpload && onRequestUpload) {
      setTimeout(() => onRequestUpload(), 300);
    }
  }, [whyYouCreate, desiredFeeling, creatorPurpose, onComplete, onRequestUpload]);

  // Determine the step that follows calibration (or direct submit when firstSignal
  // is already present). Non-free users without Instagram see the instagram_invite;
  // everyone else completes the onboarding immediately.
  const advanceAfterSave = useCallback(() => {
    if (accessState !== "free_unused" && !instagramConnected) {
      setStep("instagram_invite");
    } else {
      completeOnboarding();
    }
  }, [accessState, instagramConnected, completeOnboarding]);

  // `purposeValue` evita race condition com setState async — o closure de
  // `creatorPurpose` ficaria stale quando chamado imediatamente após setCreatorPurpose.
  const saveAndCalibrate = useCallback(async (purposeValue?: string) => {
    const purpose = purposeValue !== undefined ? purposeValue : creatorPurpose;

    if (firstSignal) {
      // Map signal already detected (IG/videos) — fire-and-forget save and advance.
      void fetch("/api/dashboard/mobile-strategic-profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whyYouCreate,
          desiredFeeling,
          ...(purpose ? { creatorPurpose: purpose } : {}),
        }),
      }).catch(() => { /* não-fatal */ });
      advanceAfterSave();
      return;
    }

    setStep("calibrating");
    setIsSaving(true);
    setCalibrationError(false);

    try {
      const [response] = await Promise.all([
        fetch("/api/dashboard/mobile-strategic-profile/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            whyYouCreate,
            desiredFeeling,
            ...(purpose ? { creatorPurpose: purpose } : {}),
          }),
        }),
        new Promise<void>((r) => setTimeout(r, 1200)),
      ]);

      if (!response.ok) throw new Error(`Onboarding API error: ${response.status}`);

      setIsSaving(false);
      advanceAfterSave();
    } catch {
      setIsSaving(false);
      setCalibrationError(true);
    }
  }, [firstSignal, whyYouCreate, desiredFeeling, creatorPurpose, advanceAfterSave]);

  // ── Orientação de fluxo (3b): progresso + navegação de volta ──
  const visibleSteps = useMemo(
    () => getVisibleSteps(instagramConnected, accessState),
    [instagramConnected, accessState],
  );
  const progressFraction = useMemo(() => {
    // calibrating é loading — congela na posição de "questions" até first_signal.
    const effective: OnboardingStep = step === "calibrating" ? "questions" : step;
    const idx = visibleSteps.indexOf(effective);
    return idx < 0 ? 0 : (idx + 1) / visibleSteps.length;
  }, [step, visibleSteps]);

  const canGoBack = Boolean(BACK_TARGET[step]);
  const handleBack = useCallback(() => {
    const target = BACK_TARGET[step];
    if (target) setStep(target);
  }, [step]);

  if (!open) return null;

  return (
    <div
      className="ds-screen fixed inset-0 z-[270] flex flex-col"
      style={{ background: color.paper }}
    >
      {/* Chrome do shell — safe-area + voltar + progresso (sempre presente) */}
      <header
        className="shrink-0"
        style={{ paddingTop: SAFE_TOP }}
      >
        <div className="flex h-11 items-center px-2">
          {canGoBack ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Voltar"
              className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-950 transition-opacity duration-150 active:opacity-50"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15.5 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <div className="h-11 w-11" />
          )}
        </div>
        {/* Barra de progresso ambiente — 2px, preenche por fração */}
        <div
          className="h-[2px] w-full"
          style={{ background: color.line }}
          role="progressbar"
          aria-label="Progresso do onboarding"
          aria-valuenow={Math.round(progressFraction * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            className="h-full"
            style={{ background: color.brand }}
            initial={false}
            animate={{ width: `${Math.round(progressFraction * 100)}%` }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
        </div>
      </header>

      {/* Área de conteúdo — cross-fade entre steps */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="absolute inset-0 overflow-y-auto"
          >
            {step === "questions" && (
              <CombinedQuestionsScreen
                creatorPurpose={creatorPurpose}
                onSetCreatorPurpose={setCreatorPurpose}
                onSubmit={(purpose) => {
                  setCreatorPurpose(purpose);
                  saveAndCalibrate(purpose);
                }}
              />
            )}
            {step === "calibrating" && (
              // Retry sem argumento: saveAndCalibrate cai no fallback de `desiredFeeling`.
              // (Passar a ref direta injetaria o evento de clique como feelingValue,
              //  quebrando o JSON.stringify do body com refs circulares.)
              <CalibratingScreen isError={calibrationError} onRetry={() => saveAndCalibrate()} />
            )}
            {step === "instagram_invite" && (
              <InstagramInviteScreen
                onConnect={() => {
                  if (onConnectInstagram) {
                    onConnectInstagram();
                  } else {
                    window.location.href = MOBILE_INSTAGRAM_CONNECT_ROUTE;
                  }
                }}
                onSkip={() => completeOnboarding(false)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Screen: Calibrating ─────────────────────────────────────────────────────

function CalibratingScreen({
  isError = false,
  onRetry,
}: {
  isError?: boolean;
  onRetry?: () => void;
}) {
  // safe-area-top agora é chrome do shell (3b). Aqui só padding de respiro +
  // safe-area no fundo. my-auto centraliza com fallback scrollável (anti-clipping).
  const safeStyle: React.CSSProperties = {
    paddingTop:    "1rem",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
  };

  if (isError) {
    return (
      <div className="flex min-h-full flex-col px-8 text-center" style={safeStyle}>
        <div className="my-auto flex flex-col items-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="#ef4444" strokeWidth="1.8" />
              <path d="M12 8v4M12 16h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="font-display text-[1.35rem] font-bold leading-tight text-zinc-700">Suas respostas estão aqui.</p>
          <p className="mt-2 text-[13px] text-zinc-400">Não conseguimos conectar agora. Tente de novo.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ds-button ds-button--primary mt-8"
            >
              Tentar de novo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-8 text-center" style={safeStyle}>
      <div className="my-auto flex flex-col items-center" role="status" aria-live="polite">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
          <svg className="h-6 w-6 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <p className="font-display text-[1.35rem] font-bold leading-tight text-zinc-700">Construindo seu mapa…</p>
        <p className="mt-2 text-[13px] text-zinc-400">Um momento.</p>
      </div>
    </div>
  );
}



// ─── Screen: Pergunta única — Por que você cria conteúdo? ────────────────────

const PURPOSE_EXAMPLES = [
  "Ensino finanças para quem nunca teve educação financeira.",
  "Inspiro mulheres a se reconectarem consigo mesmas depois dos filhos.",
  "Conto histórias do cotidiano que fazem as pessoas rirem e se identificarem.",
] as const;

function CombinedQuestionsScreen({
  creatorPurpose,
  onSetCreatorPurpose,
  onSubmit,
}: {
  creatorPurpose: string;
  onSetCreatorPurpose: (v: string) => void;
  onSubmit: (purpose: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Foco automático no heading ao montar (acessibilidade).
  useEffect(() => { headingRef.current?.focus(); }, []);

  const canSubmit = creatorPurpose.trim().length > 0;

  return (
    <div
      className="flex min-h-full flex-col px-5 pt-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
    >
      <div className="mx-auto w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/images/Colorido-Simbolo.png"
            alt="Data2Content"
            style={{ filter: "brightness(0)", width: "40px", height: "auto" }}
            aria-hidden="true"
          />
        </div>

        {/* Pergunta principal */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 font-display text-[2.15rem] font-bold leading-[0.98] tracking-[-0.045em] text-zinc-950 focus:outline-none"
        >
          Por que você cria conteúdo?
        </h2>
        <p className="mb-6 text-[13px] leading-relaxed text-zinc-400">
          Com suas próprias palavras — quanto mais específico, mais preciso seu mapa.
        </p>

        {/* Exemplos */}
        <div className="mb-5 border-y border-[var(--ds-color-line)] py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            exemplos
          </p>
          <ul className="flex flex-col gap-2.5">
            {PURPOSE_EXAMPLES.map((ex) => (
              <li
                key={ex}
                className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-500"
              >
                <span className="mt-[3px] shrink-0 text-zinc-300" aria-hidden="true">›</span>
                <span
                  className="cursor-pointer underline-offset-2 hover:text-zinc-700 hover:underline"
                  onClick={() => { onSetCreatorPurpose(ex); textareaRef.current?.focus(); }}
                >
                  {ex}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Campo livre */}
        <textarea
          ref={textareaRef}
          value={creatorPurpose}
          onChange={(e) => onSetCreatorPurpose(e.target.value.slice(0, 400))}
          placeholder="Escreva aqui…"
          rows={3}
          className="ds-field min-h-[7rem] resize-none"
        />
        {creatorPurpose.length >= 300 && (
          <p className="mt-1 text-right text-[11px] text-zinc-300">
            {creatorPurpose.length}/400
          </p>
        )}

        {/* CTA */}
        <div className="mt-5 flex flex-col gap-3 pb-4">
          <button
            type="button"
            onClick={() => onSubmit(creatorPurpose)}
            disabled={!canSubmit}
            className="ds-button ds-button--primary ds-button--block"
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Instagram Invite (pós first_signal) ──────────────────────────────

function InstagramInviteScreen({
  onConnect,
  onSkip,
}: {
  onConnect: () => void;
  onSkip: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Fase 4 — foco automático no heading ao montar o step.
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <div
      className="flex min-h-full flex-col items-center px-5"
      style={{
        paddingTop:    "1.5rem",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4rem)",
      }}
    >
      <div className="my-auto w-full max-w-sm px-1 text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="var(--ds-color-text-secondary)" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4" stroke="var(--ds-color-text-secondary)" strokeWidth="1.8" />
              <circle cx="17.5" cy="6.5" r="1" fill="var(--ds-color-text-secondary)" />
            </svg>
          </div>
        </div>

        <div className="mb-6">
          {/*
            Fase 4 — unificação de voz.
            Antes: "Quer que eu leia o que você já postou?" — 1ª pessoa da plataforma,
            inconsistente com o tom neutro/2ª pessoa de todos os outros steps.
            Agora: neutra, mantém o mesmo arco semântico (sinais do que já foi publicado
            enriquecem o mapa) e reusa o vocabulário da plataforma ("sinais", "mapa").
          */}
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mb-3 font-display text-[2.2rem] font-bold leading-[0.98] tracking-[-0.045em] text-zinc-950 focus:outline-none"
            style={{ textWrap: "balance", fontFamily: font.display } as React.CSSProperties}
          >
            Seu Instagram já tem os sinais que o mapa precisa.
          </h2>
          <p className="mx-auto max-w-[17rem] text-[13px] font-medium leading-relaxed text-zinc-500">
            Publicações, formatos e engajamento viram sinais narrativos para o seu mapa. Você conecta quando quiser.
          </p>
        </div>

        <div className="mx-auto w-full max-w-[19.5rem]">
          <button
            type="button"
            onClick={onConnect}
            className="ds-button ds-button--primary ds-button--block"
          >
            Conectar Instagram
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="ds-button ds-button--ghost ds-button--block mt-2"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
