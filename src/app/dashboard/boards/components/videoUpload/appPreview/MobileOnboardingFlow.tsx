"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";
import { MOBILE_PROFILE_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";
import { color } from "@/design-system";
import { SAFE_TOP } from "./diagnosticoTokens";

const MIN_PURPOSE_LENGTH = 15;
const MAX_PURPOSE_LENGTH = 400;

const PURPOSE_EXAMPLES = [
  "Ajudo mulheres que empreendem a comunicar seu valor com mais confiança.",
  "Quero transformar rotina e bastidores em inspiração prática para outros criadores.",
  "Crio para quem quer entender cultura e sair de cada conteúdo com uma nova perspectiva.",
] as const;

export type OnboardingAnswers = {
  creatorPurpose?: string;
};

export type OnboardingSeedSignal = {
  label: string;
  territorios: string[];
  temas: string[];
  assets: string[];
};

export type MobileOnboardingCompletePayload = {
  answers: OnboardingAnswers;
  seedSignal: OnboardingSeedSignal | null;
  skipped: boolean;
};

interface Props {
  open: boolean;
  telemetryRoute?: string;
  onComplete: (result: MobileOnboardingCompletePayload) => void;
}

type FlowState = "north" | "building";

function MapSketch() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-[190px] w-[250px]">
      <motion.div
        className="absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: color.ink, boxShadow: "var(--ds-shadow-floating)" }}
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      />
      {[{ x: 8, y: 22 }, { x: 174, y: 8 }, { x: 184, y: 126 }, { x: 12, y: 134 }].map((point, index) => (
        <motion.div
          key={`${point.x}-${point.y}`}
          className="absolute h-[58px] w-[58px] rounded-full border bg-white"
          style={{ left: point.x, top: point.y, borderColor: color.line, boxShadow: "var(--ds-shadow-raised)" }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.92, 1.06, 0.92], opacity: 1 }}
          transition={{
            opacity: { delay: 0.18 + index * 0.1, duration: 0.25 },
            scale: { delay: 0.18 + index * 0.1, duration: 1.6, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      ))}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 250 190" fill="none">
        {[
          "M65 52 C90 58 91 77 110 87",
          "M183 39 C160 52 155 71 141 86",
          "M190 150 C166 134 158 117 142 106",
          "M64 158 C88 143 93 122 111 107",
        ].map((path, index) => (
          <motion.path
            key={path}
            d={path}
            stroke={index === 1 ? color.map : color.brand}
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.72 }}
            transition={{ delay: 0.12 + index * 0.1, duration: 0.6 }}
          />
        ))}
      </svg>
    </div>
  );
}

export function MobileOnboardingFlow({ open, telemetryRoute = MOBILE_PROFILE_ROUTE, onComplete }: Props) {
  const [mounted, setMounted] = useState(false);
  const [flowState, setFlowState] = useState<FlowState>("north");
  const [creatorPurpose, setCreatorPurpose] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const viewedRef = useRef(false);
  const typingTrackedRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || viewedRef.current) return;
    viewedRef.current = true;
    trackMobileNarrativeEvent("mobile_north_screen_viewed", {
      route: telemetryRoute,
      actionType: "first_login_gate",
    });
  }, [open, telemetryRoute]);

  const persistOnboarding = useCallback(async (body: { creatorPurpose?: string; skip?: boolean }) => {
    setIsSkipping(body.skip === true);
    setFlowState("building");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/dashboard/mobile-strategic-profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        skipped?: boolean;
        seedSignal?: OnboardingSeedSignal | null;
        message?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "save_failed");
      }

      const skipped = result.skipped === true;
      if (skipped) {
        trackMobileNarrativeEvent("mobile_north_skipped", {
          route: telemetryRoute,
          actionType: "confirmed_skip",
        });
      } else {
        trackMobileNarrativeEvent("mobile_starter_map_created", {
          route: telemetryRoute,
          actionType: result.seedSignal ? "seed_ready" : "seed_pending",
        });
      }

      onComplete({
        answers: body.creatorPurpose ? { creatorPurpose: body.creatorPurpose } : {},
        seedSignal: result.seedSignal ?? null,
        skipped,
      });
    } catch {
      setIsSkipping(false);
      setFlowState("north");
      setErrorMessage("Não conseguimos montar seu mapa agora. Seu texto continua aqui para você tentar novamente.");
      trackMobileNarrativeEvent("mobile_north_save_failed", {
        route: telemetryRoute,
        safeErrorCode: "onboarding_save_failed",
      });
    }
  }, [onComplete, telemetryRoute]);

  const handleSubmit = useCallback(() => {
    const normalized = creatorPurpose.trim();
    if (normalized.length < MIN_PURPOSE_LENGTH) {
      setErrorMessage(`Conte um pouco mais — use pelo menos ${MIN_PURPOSE_LENGTH} caracteres.`);
      return;
    }
    trackMobileNarrativeEvent("mobile_north_submitted", {
      route: telemetryRoute,
      actionType: "create_starter_map",
    });
    void persistOnboarding({ creatorPurpose: normalized });
  }, [creatorPurpose, persistOnboarding, telemetryRoute]);

  const handleSkip = useCallback(() => {
    setShowSkipConfirmation(false);
    void persistOnboarding({ skip: true });
  }, [persistOnboarding]);

  if (!open || !mounted) return null;

  const normalizedLength = creatorPurpose.trim().length;
  const canSubmit = normalizedLength >= MIN_PURPOSE_LENGTH;

  return createPortal(
    <div
      className={`d2c-mobile-app ds-notebook fixed inset-0 z-[200] overflow-y-auto ${d2cFontVariables}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="north-onboarding-title"
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[680px] flex-col px-5 pb-[max(28px,env(safe-area-inset-bottom))] sm:px-8" style={{ paddingTop: SAFE_TOP }}>
        <header className="flex items-center justify-between py-5">
          <span data-ds-display="true" className="text-[18px] font-extrabold tracking-[-0.045em]">D2C</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ds-color-text-muted)]">
            Seu app começa aqui
          </span>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {flowState === "north" ? (
            <motion.main
              key="north"
              className="flex flex-1 flex-col justify-center py-8 sm:py-12"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24 }}
            >
              <div className="max-w-[590px]">
                <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ds-color-brand-strong)]">
                  Primeiro sinal
                </p>
                <h1
                  id="north-onboarding-title"
                  className="max-w-[560px] text-[clamp(2.25rem,8vw,4.2rem)] font-bold leading-[0.96] tracking-[-0.055em]"
                >
                  Qual é o seu Norte?
                </h1>
                <p className="mt-5 max-w-[545px] text-[15px] leading-[1.6] text-[var(--ds-color-text-secondary)] sm:text-[17px]">
                  Para quem você cria e o que deseja provocar nessas pessoas? Com essa resposta, a D2C monta o primeiro rascunho do seu mapa — mesmo sem conectar o Instagram.
                </p>
              </div>

              <div className="ds-notebook-section !mb-0 mt-8">
                <label htmlFor="creator-purpose" className="sr-only">Seu Norte</label>
                <textarea
                  id="creator-purpose"
                  autoFocus
                  value={creatorPurpose}
                  maxLength={MAX_PURPOSE_LENGTH}
                  onChange={(event) => {
                    setCreatorPurpose(event.target.value);
                    setErrorMessage(null);
                    if (!typingTrackedRef.current && event.target.value.trim()) {
                      typingTrackedRef.current = true;
                      trackMobileNarrativeEvent("mobile_north_typing_started", {
                        route: telemetryRoute,
                        actionType: "purpose_textarea",
                      });
                    }
                  }}
                  placeholder="Ex.: crio para mulheres que estão construindo o próprio negócio e quero que elas se sintam capazes de ocupar mais espaço."
                  className="ds-field min-h-[150px] resize-none"
                  aria-describedby="creator-purpose-help creator-purpose-error"
                  aria-invalid={Boolean(errorMessage)}
                />
                <div className="mt-2 flex items-center justify-between gap-4 px-1">
                  <span id="creator-purpose-help" className="text-[12px] text-[var(--ds-color-text-muted)]">
                    Uma ou duas frases bastam.
                  </span>
                  <span className={`text-[12px] tabular-nums ${canSubmit ? "text-[var(--ds-color-brand-strong)]" : "text-[var(--ds-color-text-muted)]"}`}>
                    {normalizedLength}/{MAX_PURPOSE_LENGTH}
                  </span>
                </div>
                {errorMessage ? (
                  <p id="creator-purpose-error" role="alert" className="mt-3 rounded-[var(--ds-radius-sm)] bg-[var(--ds-color-danger-soft)] px-3 py-2 text-[13px] leading-[1.45] text-[var(--ds-color-danger)]">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <div className="mt-5">
                <p className="text-[12px] font-semibold text-[var(--ds-color-text-muted)]">Se quiser, comece por um exemplo:</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap">
                  {PURPOSE_EXAMPLES.map((example, index) => (
                    <button
                      key={example}
                      type="button"
                      className="ds-button ds-button--quiet min-w-[235px] !h-auto !justify-start whitespace-normal text-left !text-[12.5px] !leading-[1.45] sm:min-w-0 sm:flex-1"
                      onClick={() => {
                        setCreatorPurpose(example);
                        setErrorMessage(null);
                        trackMobileNarrativeEvent("mobile_north_example_selected", {
                          route: telemetryRoute,
                          actionType: `example_${index + 1}`,
                        });
                      }}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="ds-button ds-button--primary min-h-[54px] px-7"
                >
                  Criar meu primeiro mapa
                </button>
                <button
                  type="button"
                  onClick={() => setShowSkipConfirmation(true)}
                  className="ds-button ds-button--ghost min-h-11 px-4 text-[13px]"
                >
                  Entrar sem preencher
                </button>
              </div>

              <AnimatePresence>
                {showSkipConfirmation ? (
                  <motion.div
                    className="ds-notebook-section !mb-0 mt-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <p className="text-[13px] leading-[1.5] text-[var(--ds-color-text-secondary)]">
                      Você pode entrar agora, mas seu mapa começará vazio. Dá para definir o Norte depois no Perfil.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={handleSkip} className="ds-button ds-button--secondary ds-button--small">
                        Entrar mesmo assim
                      </button>
                      <button type="button" onClick={() => setShowSkipConfirmation(false)} className="ds-button ds-button--ghost ds-button--small">
                        Voltar
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.main>
          ) : (
            <motion.main
              key="building"
              className="flex flex-1 flex-col items-center justify-center py-12 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              aria-live="polite"
            >
              {isSkipping ? (
                <motion.div
                  aria-hidden="true"
                  className="grid h-[92px] w-[92px] place-items-center rounded-full bg-[var(--ds-color-ink)] text-[20px] font-extrabold tracking-[-0.05em] text-[var(--ds-color-on-brand)]"
                  animate={{ scale: [0.96, 1.04, 0.96] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  D2C
                </motion.div>
              ) : <MapSketch />}
              <p className="mt-8 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ds-color-brand-strong)]">
                {isSkipping ? "Abrindo seu app" : "Organizando seus primeiros sinais"}
              </p>
              <h1 id="north-onboarding-title" className="mt-3 max-w-[470px] text-[34px] font-bold leading-[1.03] tracking-[-0.045em] sm:text-[46px]">
                {isSkipping ? "Seu Perfil está pronto." : "Seu mapa está começando a tomar forma."}
              </h1>
              <p className="mt-4 max-w-[430px] text-[14px] leading-[1.55] text-[var(--ds-color-text-secondary)]">
                {isSkipping
                  ? "Você pode definir seu Norte a qualquer momento dentro do Perfil."
                  : "Estamos transformando seu Norte em narrativa, territórios e temas iniciais. Você já vai ver o resultado dentro do Perfil."}
              </p>
            </motion.main>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}
