"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MOBILE_INSTAGRAM_CONNECT_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { openPaywallModal } from "@/utils/paywallModal";
import { MOBILE_PROFILE_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { OnboardingValueBlock } from "./OnboardingValueBlock";
import { SAFE_TOP } from "./diagnosticoTokens";
import { BRAND_ATMOSPHERE_BG } from "@/app/lib/brandAtmosphere";
import type { NarrativeMapAccessState } from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";

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

type OptionItem = { value: string; label: string };

// Decisão 1 — Q1 agora mapeia identidade narrativa (o QUE cria), não motivação (POR QUE cria).
// Isso alimenta diretamente Etapas 2-3 da jornada D2C (Narrativa Central + Territórios).
const WHY_OPTIONS = [
  { value: "ensino_conhecimento", label: "Ensino ou compartilho conhecimento" },
  { value: "conto_historias",     label: "Conto histórias da minha vida" },
  { value: "entretenimento",      label: "Entretenimento e humor" },
  { value: "inspiro_acao",        label: "Inspiro a agir ou mudar algo" },
] as const;

const FEELING_OPTIONS = [
  { value: "inspirado", label: "Inspirado" },
  { value: "informado", label: "Informado" },
  { value: "entendido", label: "Compreendido" },
  { value: "entretido", label: "Entretido" },
  { value: "motivado", label: "Motivado a agir" },
] as const;

// Mapa de label narrativo e estilo para o seed signal
const WHY_TO_NARRATIVE: Record<string, { label: string; style: string }> = {
  ensino_conhecimento: { label: "Criação a partir do que você aprende e ensina",    style: "conteúdo educativo" },
  conto_historias:     { label: "Conteúdo construído a partir da sua vida",          style: "conteúdo pessoal" },
  entretenimento:      { label: "Entretenimento como linguagem",                     style: "conteúdo de entretenimento" },
  inspiro_acao:        { label: "Criação com intenção de mover pessoas",             style: "conteúdo motivacional" },
  // Legacy — mantidos para usuários com respostas antigas
  compartilho_aprendizado: { label: "Criação a partir do que você aprende e ensina", style: "conteúdo educativo" },
  ensino_habilidade:       { label: "Criação a partir do que você aprende e ensina", style: "tutoriais e conteúdo técnico" },
};

function findOptionLabel(options: readonly OptionItem[], value: string): string | null {
  return options.find((option) => option.value === value)?.label ?? null;
}

function lowerFirst(value: string): string {
  return value ? `${value.slice(0, 1).toLowerCase()}${value.slice(1)}` : value;
}

function buildSeedSignal({
  whyYouCreate,
  desiredFeeling,
}: Pick<OnboardingAnswers, "whyYouCreate" | "desiredFeeling">): FirstSignal {
  const narrative = WHY_TO_NARRATIVE[whyYouCreate];
  const feelingLabel = findOptionLabel(FEELING_OPTIONS, desiredFeeling);
  const label = narrative?.label ?? "Seu território ainda está sendo mapeado";

  // Fase 4 — sentimento de Q2 é a dimensão central da hipótese, não um apêndice.
  // Estrutura: O QUÊ você cria (label) + POR QUÊ / intenção (feeling) + próximo passo.
  const feelingSentence = feelingLabel
    ? `A intenção por trás: que cada pessoa que assiste saia ${lowerFirst(feelingLabel)}.`
    : "";

  const summary = feelingSentence
    ? `Hipótese construída a partir das suas respostas. ${feelingSentence} Seu primeiro vídeo vai revelar muito mais.`
    : "Hipótese construída a partir das suas respostas. Seu primeiro vídeo vai revelar muito mais sobre o seu mapa.";

  return { label, summary, source: "seed" };
}

// ─── Flow orientation (Fase 3b) ───────────────────────────────────────────────

/**
 * Telas visíveis do fluxo, na ordem, para o usuário atual.
 *
 *   - free_unused        → first_signal É a tela de conversão (valor + assinar);
 *                          não há step extra, a hipótese e o CTA Pro convivem nela.
 *   - não-free, sem IG   → instagram_invite
 *   - conectado/pago     → encerra após first_signal
 *
 * `calibrating` é estado de loading — não conta como etapa de progresso.
 */
function getVisibleSteps(
  instagramConnected: boolean,
  accessState: NarrativeMapAccessState,
): OnboardingStep[] {
  const steps: OnboardingStep[] = ["questions", "first_signal"];
  if (accessState !== "free_unused" && !instagramConnected) steps.push("instagram_invite");
  return steps;
}

/**
 * Lê o seedSignal enriquecido pela IA do corpo da resposta de /onboarding.
 * Best-effort: qualquer formato inesperado (sem .json, JSON inválido, campos
 * faltando) resulta em null → o client cai no buildSeedSignal determinístico.
 */
async function readSeedSignalFromResponse(response: Response): Promise<FirstSignal | null> {
  try {
    if (typeof response.json !== "function") return null;
    const data = (await response.json()) as { seedSignal?: unknown } | null;
    const seed = data?.seedSignal as { label?: unknown; summary?: unknown } | null | undefined;
    if (!seed || typeof seed.label !== "string" || typeof seed.summary !== "string") return null;
    if (!seed.label.trim() || !seed.summary.trim()) return null;
    return { label: seed.label, summary: seed.summary, source: "seed" };
  } catch {
    return null;
  }
}

/** Para qual step o botão "voltar" leva. Ausência = sem voltar (entrada/loading). */
const BACK_TARGET: Partial<Record<OnboardingStep, OnboardingStep>> = {
  first_signal: "questions",
  instagram_invite: "first_signal",
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
  const [whyYouCreate, setWhyYouCreate] = useState("");
  const [desiredFeeling, setDesiredFeeling] = useState("");
  const [creatorPurpose, setCreatorPurpose] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [calibrationError, setCalibrationError] = useState(false);
  // Fase 3 — sinal seed enriquecido pela IA (gerado a partir de Q1+Q2+Q3 quando
  // há propósito declarado). Tem prioridade sobre o buildSeedSignal determinístico,
  // mas cede ao firstSignal detectado (Instagram/vídeos), que é o sinal mais forte.
  const [aiSeedSignal, setAiSeedSignal] = useState<FirstSignal | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("questions");
      setWhyYouCreate("");
      setDesiredFeeling("");
      setCreatorPurpose("");
      setAiSeedSignal(null);
      setIsSaving(false);
      setCalibrationError(false);
    }
  }, [open]);

  // Bug 1 fix: recebe `feelingValue` como parâmetro para evitar race condition
  // com setState async — o closure de `desiredFeeling` ficaria stale quando
  // chamado imediatamente após `setDesiredFeeling(v)`.
  // `purposeValue` segue o mesmo padrão para `creatorPurpose`.
  const saveAndCalibrate = useCallback(async (feelingValue?: string, purposeValue?: string) => {
    const feeling = feelingValue ?? desiredFeeling;
    const purpose = purposeValue !== undefined ? purposeValue : creatorPurpose;

    if (firstSignal) {
      void fetch("/api/dashboard/mobile-strategic-profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whyYouCreate,
          desiredFeeling: feeling,
          ...(purpose ? { creatorPurpose: purpose } : {}),
        }),
      }).catch(() => { /* não-fatal */ });
      setStep("first_signal");
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
            desiredFeeling: feeling,
            ...(purpose ? { creatorPurpose: purpose } : {}),
          }),
        }),
        new Promise<void>((r) => setTimeout(r, 1200)),
      ]);

      if (!response.ok) throw new Error(`Onboarding API error: ${response.status}`);

      // Fase 3 — se a API devolveu um sinal enriquecido pela IA, usa-o no
      // first_signal. Caso contrário, o render cai no buildSeedSignal.
      setAiSeedSignal(await readSeedSignalFromResponse(response));

      setIsSaving(false);
      setStep("first_signal");
    } catch {
      setIsSaving(false);
      setCalibrationError(true);
    }
  }, [firstSignal, whyYouCreate, desiredFeeling, creatorPurpose]);

  const completeOnboarding = useCallback((openUpload = false) => {
    const answers: OnboardingAnswers = {
      whyYouCreate,
      desiredFeeling,
      ...(creatorPurpose ? { creatorPurpose } : {}),
    };
    onComplete(answers);
    if (openUpload && onRequestUpload) {
      // Pequeno delay para o onboarding fechar antes de abrir o upload
      setTimeout(() => onRequestUpload(), 300);
    }
  }, [whyYouCreate, desiredFeeling, creatorPurpose, onComplete, onRequestUpload]);

  /**
   * free_unused clicou "Assinar e aprofundar meu mapa" na própria tela do rascunho —
   * fecha o onboarding e abre o checkout (Stripe). O post-checkout conecta o Instagram.
   */
  const handleSubscribe = useCallback(() => {
    const answers: OnboardingAnswers = {
      whyYouCreate,
      desiredFeeling,
      ...(creatorPurpose ? { creatorPurpose } : {}),
    };
    onComplete(answers);
    openPaywallModal({
      context: "onboarding",
      source: "onboarding_first_signal_value",
      returnTo: MOBILE_PROFILE_ROUTE,
      postCheckoutIntent: "connect_instagram",
    });
  }, [whyYouCreate, desiredFeeling, creatorPurpose, onComplete]);

  /** free_unused clicou "Explorar o mapa primeiro" — fecha o onboarding sem abrir Stripe. */
  const handleExploreFree = useCallback(() => {
    completeOnboarding(false);
  }, [completeOnboarding]);

  const handleFirstSignalResponse = useCallback(
    () => {
      // Só usuários NÃO-free e sem IG veem o convite de Instagram após a hipótese.
      // free_unused converte na própria tela do rascunho (handleSubscribe / handleExploreFree),
      // então não passa por aqui no caminho primário.
      if (accessState !== "free_unused" && !instagramConnected) {
        setStep("instagram_invite");
      } else {
        completeOnboarding();
      }
    },
    [accessState, instagramConnected, completeOnboarding],
  );

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
      className="fixed inset-0 z-[270] flex flex-col"
      style={{ backgroundImage: BRAND_ATMOSPHERE_BG }}
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
          className="h-[2px] w-full bg-zinc-100"
          role="progressbar"
          aria-label="Progresso do onboarding"
          aria-valuenow={Math.round(progressFraction * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            className="h-full bg-zinc-900"
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
                whyYouCreate={whyYouCreate}
                onSelectWhy={setWhyYouCreate}
                desiredFeeling={desiredFeeling}
                onSelectFeeling={setDesiredFeeling}
                creatorPurpose={creatorPurpose}
                onSetCreatorPurpose={setCreatorPurpose}
                onSubmit={(feeling, purpose) => {
                  setCreatorPurpose(purpose);
                  saveAndCalibrate(feeling, purpose);
                }}
              />
            )}
            {step === "calibrating" && (
              // Retry sem argumento: saveAndCalibrate cai no fallback de `desiredFeeling`.
              // (Passar a ref direta injetaria o evento de clique como feelingValue,
              //  quebrando o JSON.stringify do body com refs circulares.)
              <CalibratingScreen isError={calibrationError} onRetry={() => saveAndCalibrate()} />
            )}
            {step === "first_signal" && (
              <FirstSignalScreen
                // Prioridade: sinal detectado (Instagram/vídeos) > seed da IA (Q1+Q2+Q3) > determinístico.
                signal={firstSignal ?? aiSeedSignal ?? buildSeedSignal({ whyYouCreate, desiredFeeling })}
                onRespond={handleFirstSignalResponse}
                onUpload={onRequestUpload ? () => completeOnboarding(true) : undefined}
                isFreeUnused={accessState === "free_unused"}
                whyYouCreate={whyYouCreate}
                onSubscribe={handleSubscribe}
                onExploreFree={handleExploreFree}
              />
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
          <p className="text-[16px] font-medium text-zinc-700">Suas respostas estão aqui.</p>
          <p className="mt-2 text-[13px] text-zinc-400">Não conseguimos conectar agora. Tente de novo.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-8 rounded-full bg-zinc-950 px-6 py-4 text-[15px] font-semibold text-white transition-colors active:bg-zinc-800"
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
        <p className="text-[16px] font-medium text-zinc-700">Construindo seu mapa…</p>
        <p className="mt-2 text-[13px] text-zinc-400">Um momento.</p>
      </div>
    </div>
  );
}

// ─── Screen: First Signal ─────────────────────────────────────────────────────

/**
 * O4 — Sub-fluxo de refinamento simplificado.
 *
 * Antes: "Quase"/"Não é isso" → chips (Tema/Tom/Intenção/Momento) + campo
 * de texto que eram coletados mas nunca persistidos → ilusão de coleta.
 *
 * Agora: a única ação é confirmar e seguir. O mapa aprende com as leituras
 * reais, não com o meta-feedback do onboarding.
 *
 * Fase 3a — caminhos "almost"/"no" eram código morto (nunca disparados).
 * Reduzido a uma confirmação única.
 */
const FIRST_SIGNAL_CONFIRMATION = "Registrado ✓ — mapa atualizado.";

function FirstSignalScreen({
  signal,
  onRespond,
  onUpload,
  isFreeUnused = false,
  whyYouCreate,
  onSubscribe,
  onExploreFree,
}: {
  signal: FirstSignal;
  onRespond: () => void;
  onUpload?: () => void;
  /** free_unused: a tela do rascunho É o momento de conversão (valor + assinar). */
  isFreeUnused?: boolean;
  /** Identidade narrativa (Q1) — contextualiza o valor de publi exibido. */
  whyYouCreate?: string;
  /** free_unused: "Assinar e aprofundar meu mapa" → checkout. */
  onSubscribe?: () => void;
  /** free_unused: "Explorar o mapa primeiro" → segue grátis. */
  onExploreFree?: () => void;
}) {
  const isSeedSignal = signal.source === "seed";
  const [confirmed, setConfirmed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const respondTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fase 4 — foco automático no heading ao montar o step.
  useEffect(() => { headingRef.current?.focus(); }, []);

  // Cancela o onRespond agendado se a tela desmontar antes dos 700ms —
  // ex.: usuário aperta "voltar" durante a confirmação. Sem isso, o timer
  // dispararia e jogaria o usuário pra frente, anulando o voltar.
  useEffect(() => {
    return () => {
      if (respondTimer.current) clearTimeout(respondTimer.current);
    };
  }, []);

  const handleExplore = () => {
    setConfirmed(true);
    respondTimer.current = setTimeout(() => onRespond(), 700);
  };

  const handleUpload = () => {
    // Bug 2 fix: NÃO chama onRespond — isso evita o double-complete.
    // onUpload já encapsula completeOnboarding(true), que fecha o onboarding
    // e dispara o upload. onRespond ficaria de fora para não chamar
    // completeOnboarding uma segunda vez.
    setConfirmed(true);
    onUpload?.();
  };

  // Subtítulo honesto: free não envia vídeo (CTA leva ao checkout), então a
  // promessa "a primeira leitura de um vídeo…" sai e entra a ponte rascunho→Pro.
  const subtitle = !isSeedSignal
    ? "Este é o primeiro sinal que encontramos no que você já criou."
    : isFreeUnused
      ? "Construído só com as suas respostas. No Pro, a D2C lê seus vídeos e seu Instagram e aprofunda esse mapa."
      : "A primeira leitura de um vídeo seu vai revelar muito mais.";

  return (
    <div
      className="flex min-h-full flex-col items-center px-5"
      style={{
        paddingTop:    "1.5rem",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4rem)",
      }}
    >
      {/* my-auto: centraliza quando há espaço, scrollável quando não há */}
      <div className="my-auto flex w-full max-w-sm flex-col items-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="#52525b" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" fill="#52525b" />
        </svg>
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mb-2 text-center text-[1.6rem] font-bold leading-snug tracking-tight text-zinc-950 focus:outline-none"
      >
        {isSeedSignal ? "Aqui está o rascunho do seu mapa" : "Seu mapa começa assim"}
      </h2>
      <p className="mb-8 text-center text-[13px] font-medium leading-relaxed text-zinc-500">
        {subtitle}
      </p>

      {/* Signal card — Decisão 3: badge "Hipótese inicial" para seeds.
          Mantido PURO (só narrativa) — o valor de publi nunca entra aqui. */}
      <div className="w-full rounded-[24px] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
          {isSeedSignal ? "Hipótese inicial" : "Sinal narrativo"}
        </p>
        <p className="text-[18px] font-bold leading-snug text-zinc-950 mb-2">{signal.label}</p>
        <p className="text-[13px] leading-relaxed text-zinc-500">{signal.summary}</p>
      </div>

      {isFreeUnused && onSubscribe ? (
        // Caminho free_unused: a hipótese convive com o valor de publi (destaque
        // forte) e o CTA honesto de assinar. Sem bait-and-switch, sem tela extra.
        <div className="mt-6 w-full flex flex-col items-stretch">
          <OnboardingValueBlock whyYouCreate={whyYouCreate} />

          <button
            type="button"
            onClick={onSubscribe}
            className="mt-6 w-full rounded-full bg-zinc-950 px-6 py-4 text-sm font-semibold text-white transition-colors active:bg-zinc-800"
          >
            Assinar e aprofundar meu mapa →
          </button>
          <button
            type="button"
            onClick={onExploreFree}
            className="mt-3 w-full text-[13px] font-medium text-zinc-400 underline-offset-2 hover:underline"
          >
            Explorar o mapa primeiro
          </button>

          <p className="mt-5 text-center text-[12px] leading-relaxed text-zinc-400">
            A assinatura não pula etapas — só aprofunda o que você descobre.
          </p>
        </div>
      ) : confirmed ? (
        // role="status" anuncia a confirmação para leitores de tela sem mover o foco.
        <p role="status" className="mt-8 text-[14px] font-semibold text-zinc-950">
          {FIRST_SIGNAL_CONFIRMATION}
        </p>
      ) : (
        <div className="mt-8 w-full max-w-[19.5rem] flex flex-col gap-3">
          {isSeedSignal && onUpload ? (
            <>
              <button
                type="button"
                onClick={handleUpload}
                className="w-full rounded-full bg-zinc-950 px-6 py-4 text-sm font-semibold text-white transition-colors active:bg-zinc-800"
              >
                Enviar meu primeiro vídeo →
              </button>
              <button
                type="button"
                onClick={handleExplore}
                className="w-full text-[13px] font-medium text-zinc-400 underline-offset-2 hover:underline"
              >
                Explorar o mapa primeiro
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleExplore}
              className="w-full rounded-full bg-zinc-950 px-6 py-4 text-sm font-semibold text-white transition-colors active:bg-zinc-800"
            >
              Ver meu mapa →
            </button>
          )}
        </div>
      )}
      </div>{/* /my-auto */}
    </div>
  );
}

// ─── Screen: Combined Q1+Q2+Q3 ───────────────────────────────────────────────

/**
 * Tela de perguntas fundida — Q1 (identidade), Q2 (sentimento), Q3 (propósito).
 *
 * Q1 sempre visível → Q2 aparece após Q1 → Q3 aparece após Q2.
 * Q3 é opcional: o criador pode pular sem punição.
 * O avanço para a calibração só ocorre via "Continuar" ou "Pular por enquanto"
 * no Q3 (via callback `onSubmit`), não por auto-advance — o campo de texto
 * precisa de tempo para ser preenchido.
 */
function CombinedQuestionsScreen({
  whyYouCreate,
  onSelectWhy,
  desiredFeeling,
  onSelectFeeling,
  creatorPurpose,
  onSetCreatorPurpose,
  onSubmit,
}: {
  whyYouCreate: string;
  onSelectWhy: (v: string) => void;
  desiredFeeling: string;
  onSelectFeeling: (v: string) => void;
  creatorPurpose: string;
  onSetCreatorPurpose: (v: string) => void;
  /** Chamado quando o criador confirma ou pula Q3. Recebe feeling e purpose (vazio se pulado). */
  onSubmit: (feeling: string, purpose: string) => void;
}) {
  const q1HeadingRef = useRef<HTMLHeadingElement>(null);
  const q2Ref = useRef<HTMLDivElement>(null);
  const q3Ref = useRef<HTMLDivElement>(null);

  // Foco automático no heading de Q1 ao montar o step (acessibilidade).
  useEffect(() => { q1HeadingRef.current?.focus(); }, []);

  // Auto-scroll para Q2 quando aparece — garante visibilidade em iPhones pequenos.
  useEffect(() => {
    if (whyYouCreate && q2Ref.current) {
      setTimeout(() => {
        q2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 320); // após a animação de entrada (300ms)
    }
  }, [whyYouCreate]);

  // Auto-scroll para Q3 quando aparece.
  useEffect(() => {
    if (desiredFeeling && q3Ref.current) {
      setTimeout(() => {
        q3Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 320);
    }
  }, [desiredFeeling]);

  return (
    <div className="flex min-h-full flex-col px-5 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}>
      <div className="mx-auto w-full max-w-sm">
        {/* Header — logo (progresso agora é chrome do shell) */}
        <div className="mb-6">
          <img
            src="/images/Colorido-Simbolo.png"
            alt="Data2Content"
            style={{ filter: "brightness(0)", width: "44px", height: "auto" }}
            aria-hidden="true"
          />
        </div>

        {/* Q1 — identidade narrativa */}
        <h2
          ref={q1HeadingRef}
          tabIndex={-1}
          className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-zinc-950 focus:outline-none"
        >
          O que define o que você cria?
        </h2>
        <div className="flex flex-col gap-2.5">
          {WHY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelectWhy(opt.value)}
              className={`w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-medium transition-colors ${
                whyYouCreate === opt.value
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-800 active:bg-zinc-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Q2 — aparece após Q1 (motion real) + auto-scroll */}
        {whyYouCreate && (
          <motion.div
            ref={q2Ref}
            className="mt-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <h2 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-zinc-950">
              Que sentimento quer deixar em quem assiste?
            </h2>
            <div className="flex flex-col gap-2.5">
              {FEELING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSelectFeeling(opt.value)}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-medium transition-colors ${
                    desiredFeeling === opt.value
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 active:bg-zinc-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Q3 — propósito, aparece após Q2 (opcional) */}
        {desiredFeeling && (
          <motion.div
            ref={q3Ref}
            className="mt-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <h2 className="mb-1 text-[1.5rem] font-bold leading-tight tracking-tight text-zinc-950">
              Para quem você cria?
            </h2>
            <p className="mb-4 text-[13px] leading-relaxed text-zinc-400">
              Em uma frase. Quanto mais específico, mais preciso seu mapa.
            </p>
            <textarea
              value={creatorPurpose}
              onChange={(e) => onSetCreatorPurpose(e.target.value.slice(0, 150))}
              placeholder="ex: quero encorajar mães sem tempo a se cuidarem"
              rows={3}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-[15px] text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            />
            {/* Contador de caracteres — aparece a partir de 100 para não ser distrativo */}
            {creatorPurpose.length >= 100 && (
              <p className="mt-1 text-right text-[11px] text-zinc-300">
                {creatorPurpose.length}/150
              </p>
            )}
            <div className="mt-4 flex flex-col gap-3 pb-4">
              <button
                type="button"
                onClick={() => onSubmit(desiredFeeling, creatorPurpose)}
                className="w-full rounded-full bg-zinc-950 px-6 py-4 text-[15px] font-semibold text-white transition-colors active:bg-zinc-800"
              >
                Continuar →
              </button>
              <button
                type="button"
                onClick={() => onSubmit(desiredFeeling, "")}
                className="w-full text-[13px] font-medium text-zinc-400 underline-offset-2 hover:underline"
              >
                Pular por enquanto
              </button>
            </div>
          </motion.div>
        )}
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
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="#52525b" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4" stroke="#52525b" strokeWidth="1.8" />
              <circle cx="17.5" cy="6.5" r="1" fill="#52525b" />
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
            className="mb-3 text-[1.85rem] font-bold leading-[1.08] tracking-tight text-zinc-950 focus:outline-none"
            style={{ textWrap: "balance" } as React.CSSProperties}
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
            className="w-full rounded-full bg-zinc-950 px-6 py-4 text-sm font-semibold text-white transition-colors active:bg-zinc-800"
          >
            Conectar Instagram
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="mt-4 w-full text-[13px] font-medium text-zinc-400 underline-offset-2 hover:underline"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

