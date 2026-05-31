"use client";

import { useState, useEffect, useCallback } from "react";
import { MOBILE_INSTAGRAM_CONNECT_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { openPaywallModal } from "@/utils/paywallModal";
import { MOBILE_PROFILE_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { OnboardingPaywallModal } from "./OnboardingPaywallModal";
import type { NarrativeMapAccessState } from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingAnswers = {
  whyYouCreate: string;
  desiredFeeling: string;
  contentLimit?: string;
};

type OnboardingStep =
  | "welcome"
  | "instagram"
  | "question_1"
  | "question_2"
  | "question_3"
  | "calibrating"
  | "first_signal";

const QUESTION_STEPS: OnboardingStep[] = ["question_1", "question_2", "question_3"];

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
  onComplete: (answers: OnboardingAnswers) => void;
}

// ─── Option data ──────────────────────────────────────────────────────────────

const WHY_OPTIONS = [
  { value: "expressao_pessoal", label: "Expressão pessoal" },
  { value: "construir_audiencia", label: "Construir uma audiência" },
  { value: "gerar_renda", label: "Gerar renda" },
  { value: "construir_autoridade", label: "Construir autoridade" },
  { value: "explorar_criatividade", label: "Explorar criatividade" },
] as const;

const FEELING_OPTIONS = [
  { value: "inspirado", label: "Inspirado" },
  { value: "informado", label: "Informado" },
  { value: "entendido", label: "Entendido" },
  { value: "entretido", label: "Entretido" },
  { value: "motivado", label: "Motivado a agir" },
] as const;

function findOptionLabel(options: readonly OptionItem[], value: string): string | null {
  return options.find((option) => option.value === value)?.label ?? null;
}

function lowerFirst(value: string): string {
  return value ? `${value.slice(0, 1).toLowerCase()}${value.slice(1)}` : value;
}

function buildSeedSignal({
  whyYouCreate,
  desiredFeeling,
  contentLimit,
}: OnboardingAnswers): FirstSignal {
  const whyLabel = findOptionLabel(WHY_OPTIONS, whyYouCreate);
  const feelingLabel = findOptionLabel(FEELING_OPTIONS, desiredFeeling);
  const label = whyLabel
    ? `${whyLabel} como ponto de partida`
    : "Seu mapa começa pelas suas respostas";
  const feelingCopy = feelingLabel
    ? `para fazer a audiência se sentir ${lowerFirst(feelingLabel)}`
    : "e construir uma relação mais clara com a audiência";
  const limitCopy = contentLimit
    ? ` Também vamos respeitar o limite que você marcou: ${contentLimit}.`
    : "";

  return {
    label,
    summary: `Por enquanto, a D2C entende que seu conteúdo parte de ${lowerFirst(whyLabel ?? "uma direção própria")} ${feelingCopy}.${limitCopy}`,
    source: "seed",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileOnboardingFlow({
  open,
  instagramConnected,
  accessState,
  firstSignal,
  onComplete,
}: Props) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [whyYouCreate, setWhyYouCreate] = useState("");
  const [desiredFeeling, setDesiredFeeling] = useState("");
  const [contentLimit, setContentLimit] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [firstSignalResponse, setFirstSignalResponse] = useState<string | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("welcome");
      setWhyYouCreate("");
      setDesiredFeeling("");
      setContentLimit("");
      setIsSaving(false);
      setFirstSignalResponse(null);
      setShowPaywallModal(false);
    }
  }, [open]);

  const saveAndCalibrate = useCallback(async () => {
    setStep("calibrating");
    setIsSaving(true);

    try {
      await fetch("/api/dashboard/mobile-strategic-profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whyYouCreate,
          desiredFeeling,
          contentLimit: contentLimit.trim() || undefined,
        }),
      });
    } catch {
      // Non-fatal — onboarding state saved locally, will retry on next visit
    }

    // Show calibrating for at least 2s for UX feel
    await new Promise((r) => setTimeout(r, 2000));
    setIsSaving(false);

    setStep("first_signal");
  }, [whyYouCreate, desiredFeeling, contentLimit]);

  const handleFirstSignalResponse = useCallback(
    (response: "yes" | "almost" | "no") => {
      setFirstSignalResponse(response);
      const answers = { whyYouCreate, desiredFeeling, contentLimit: contentLimit.trim() || undefined };

      // Show paywall modal to free users who haven't used their reading yet
      if (accessState === "free_unused") {
        onComplete(answers);
        setShowPaywallModal(true);
        return;
      }

      onComplete(answers);
    },
    [whyYouCreate, desiredFeeling, contentLimit, accessState, onComplete],
  );

  const handlePaywallSubscribeNow = useCallback(async () => {
    // Trigger the standard paywall modal flow for subscription
    openPaywallModal({
      context: "narrative_map",
      source: "onboarding_entry",
      returnTo: MOBILE_PROFILE_ROUTE,
      postCheckoutIntent: "connect_instagram",
    });
  }, []);

  const handlePaywallExploreFree = useCallback(() => {
    // User chose to explore free tier — close the modal and keep onboarding open
    setShowPaywallModal(false);
  }, []);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[270] flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto">
        {step === "welcome" && (
          <WelcomeScreen onNext={() => setStep(instagramConnected ? "question_1" : "instagram")} />
        )}
        {step === "instagram" && (
          <InstagramScreen
            onConnect={() => {
              window.location.href = MOBILE_INSTAGRAM_CONNECT_ROUTE;
            }}
            onSkip={() => setStep("question_1")}
          />
        )}
        {step === "question_1" && (
          <QuestionScreen
            questionNumber={1}
            question="Por que você cria conteúdo?"
            options={WHY_OPTIONS}
            selected={whyYouCreate}
            onSelect={setWhyYouCreate}
            onNext={() => setStep("question_2")}
          />
        )}
        {step === "question_2" && (
          <QuestionScreen
            questionNumber={2}
            question="O que você quer que alguém sinta depois de ver seu conteúdo?"
            options={FEELING_OPTIONS}
            selected={desiredFeeling}
            onSelect={setDesiredFeeling}
            onNext={() => setStep("question_3")}
          />
        )}
        {step === "question_3" && (
          <LimitScreen
            value={contentLimit}
            onChange={setContentLimit}
            onNext={saveAndCalibrate}
            saving={isSaving}
          />
        )}
        {step === "calibrating" && <CalibratingScreen />}
        {step === "first_signal" && (
          <FirstSignalScreen
            signal={firstSignal ?? buildSeedSignal({
              whyYouCreate,
              desiredFeeling,
              contentLimit: contentLimit.trim() || undefined,
            })}
            response={firstSignalResponse}
            onRespond={handleFirstSignalResponse}
          />
        )}
        </div>
      </div>

      <OnboardingPaywallModal
        open={showPaywallModal}
        onSubscribeNow={handlePaywallSubscribeNow}
        onExploreFree={handlePaywallExploreFree}
      />
    </>
  );
}

// ─── Screen: Welcome ──────────────────────────────────────────────────────────

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 pb-16 pt-20 text-center">
      {/* Map icon */}
      <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" fill="#f97316" />
        </svg>
      </div>

      <h1 className="mb-3 text-[26px] font-bold leading-tight tracking-tight text-zinc-950">
        Descubra a identidade do seu conteúdo.
      </h1>
      <p className="mb-12 text-[15px] leading-relaxed text-zinc-500">
        A D2C percebe seus padrões reais de criação — não o que você preenche em formulários.
      </p>

      <button
        type="button"
        onClick={onNext}
        className="w-full max-w-xs rounded-full bg-zinc-950 px-6 py-4 text-[15px] font-semibold text-white transition-colors active:bg-zinc-800"
      >
        Começar
      </button>
    </div>
  );
}

// ─── Screen: Instagram ────────────────────────────────────────────────────────

function InstagramScreen({ onConnect, onSkip }: { onConnect: () => void; onSkip: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 pb-16 pt-20 text-center">
      <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-sky-50">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" stroke="#0ea5e9" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" stroke="#0ea5e9" strokeWidth="1.8" />
          <circle cx="17.5" cy="6.5" r="1" fill="#0ea5e9" />
        </svg>
      </div>

      <h2 className="mb-3 text-[22px] font-bold leading-tight tracking-tight text-zinc-950">
        Traga seu Instagram para o espelho
      </h2>
      <p className="mb-2 text-[15px] leading-relaxed text-zinc-500">
        Suas postagens revelam seus padrões silenciosamente — nosso espelho reconhece seus caminhos sem esforço.
      </p>

      <button
        type="button"
        onClick={onConnect}
        className="mt-8 w-full max-w-xs rounded-full bg-zinc-950 px-6 py-4 text-[15px] font-semibold text-white transition-colors active:bg-zinc-800"
      >
        Conectar agora
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="mt-3 w-full max-w-xs rounded-full border border-zinc-200 px-6 py-4 text-[15px] font-semibold text-zinc-600 transition-colors active:bg-zinc-50"
      >
        Fazer isso depois
      </button>

      <p className="mt-6 max-w-xs text-[12px] leading-relaxed text-zinc-400">
        Você volta para continuar o mapa. Sem Instagram, ele cresce com os vídeos que você trouxer.
      </p>
    </div>
  );
}

// ─── Screen: Question (options) ───────────────────────────────────────────────

type OptionItem = { value: string; label: string };

function QuestionScreen({
  questionNumber,
  question,
  options,
  selected,
  onSelect,
  onNext,
}: {
  questionNumber: 1 | 2;
  question: string;
  options: readonly OptionItem[];
  selected: string;
  onSelect: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col px-5 pb-10 pt-16">
      {/* Progress dots */}
      <ProgressDots current={questionNumber} total={3} />

      <h2 className="mb-8 mt-6 text-[22px] font-bold leading-tight tracking-tight text-zinc-950">
        {question}
      </h2>

      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-medium transition-colors ${
              selected === opt.value
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-200 bg-white text-zinc-800 active:bg-zinc-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onNext}
          disabled={!selected}
          className="w-full rounded-full bg-zinc-950 px-6 py-4 text-[15px] font-semibold text-white transition-opacity disabled:opacity-30 active:bg-zinc-800"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Question 3 (free text) ──────────────────────────────────────────

function LimitScreen({
  value,
  onChange,
  onNext,
  saving,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col px-5 pb-10 pt-16">
      <ProgressDots current={3} total={3} />

      <h2 className="mb-2 mt-6 text-[22px] font-bold leading-tight tracking-tight text-zinc-950">
        Tem algum território que você prefere manter fora do seu espelho?
      </h2>
      <p className="mb-6 text-[14px] text-zinc-400">Opcional — campo livre, pode deixar em branco.</p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: política, vida privada, religião…"
        maxLength={300}
        rows={3}
        className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] text-zinc-800 outline-none transition focus:border-zinc-400 placeholder:text-zinc-400"
      />

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onNext}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-4 text-[15px] font-semibold text-white transition-opacity disabled:opacity-50 active:bg-zinc-800"
        >
          {saving ? (
            <>
              <svg className="h-4 w-4 animate-spin text-white/70" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Salvando…
            </>
          ) : (
            "Finalizar"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Calibrating ─────────────────────────────────────────────────────

function CalibratingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
        <svg className="h-6 w-6 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
      <p className="text-[16px] font-medium text-zinc-700">Sintonizando seu espelho…</p>
      <p className="mt-2 text-[13px] text-zinc-400">Um momento.</p>
    </div>
  );
}

// ─── Screen: First Signal ─────────────────────────────────────────────────────

function FirstSignalScreen({
  signal,
  response,
  onRespond,
}: {
  signal: FirstSignal;
  response: string | null;
  onRespond: (r: "yes" | "almost" | "no") => void;
}) {
  const isSeedSignal = signal.source === "seed";
  const [activePrompt, setActivePrompt] = useState<"almost" | "no" | "yes" | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 pb-16 pt-16">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" fill="#f97316" />
        </svg>
      </div>

      <h2 className="mb-2 text-center text-[20px] font-bold leading-snug tracking-tight text-zinc-950">
        Seu mapa começa assim
      </h2>
      <p className="mb-8 text-center text-[14px] leading-relaxed text-zinc-500">
        {isSeedSignal
          ? "Este é o primeiro rascunho a partir das suas respostas."
          : "Este é o primeiro sinal que encontramos no que você já criou."}
      </p>

      {/* Signal card */}
      <div className="w-full rounded-[24px] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03]">
        <p className="text-[10px] font-bold uppercase tracking-[1px] text-orange-400 mb-2">
          {isSeedSignal ? "Ponto de partida" : "Sinal narrativo"}
        </p>
        <p className="text-[18px] font-bold leading-snug text-zinc-950 mb-2">{signal.label}</p>
        <p className="text-[13px] leading-relaxed text-zinc-500">{signal.summary}</p>
      </div>

      {/* Confirmation */}
      <p className="mt-8 mb-4 text-[14px] font-medium text-zinc-500">Isso representa você agora?</p>

      {submitted || response ? (
        <p className="text-[14px] font-semibold text-teal-600">
          {(submitted ? activePrompt : response) === "yes" 
            ? "Registrado ✓ — mapa atualizado." 
            : "Entendido. Vamos recalibrar seu mapa a partir disso."}
        </p>
      ) : activePrompt && activePrompt !== "yes" ? (
        <div className="flex w-full flex-col gap-3">
          <p className="text-center text-[14px] font-semibold text-zinc-800">
            O que ficou fora?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {["Tema", "Tom", "Intenção", "Meu momento de vida"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedOption(opt)}
                className={`rounded-full px-3 py-2 text-[13px] font-medium transition-colors ${
                  selectedOption === opt
                    ? "bg-amber-100 text-amber-800"
                    : "bg-zinc-100 text-zinc-600 active:bg-zinc-200"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Escreva em uma frase (opcional)"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-zinc-800 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button
            type="button"
            disabled={!selectedOption && !textValue.trim()}
            onClick={() => {
              setSubmitted(true);
              setTimeout(() => {
                onRespond(activePrompt as "almost" | "no");
              }, 1500);
            }}
            className="mt-2 w-full rounded-full bg-zinc-950 px-4 py-3 text-[14px] font-semibold text-white transition-opacity disabled:opacity-30 active:bg-zinc-800"
          >
            Enviar
          </button>
        </div>
      ) : (
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={() => {
              setSubmitted(true);
              setActivePrompt("yes");
              setTimeout(() => onRespond("yes"), 1500);
            }}
            className="flex-1 rounded-full bg-teal-50 px-3 py-3 text-[13px] font-semibold text-teal-700 transition-colors active:bg-teal-100"
          >
            Sim ✓
          </button>
          <button
            type="button"
            onClick={() => setActivePrompt("almost")}
            className="flex-1 rounded-full bg-amber-50 px-3 py-3 text-[13px] font-semibold text-amber-700 transition-colors active:bg-amber-100"
          >
            Quase
          </button>
          <button
            type="button"
            onClick={() => setActivePrompt("no")}
            className="flex-1 rounded-full bg-zinc-100 px-3 py-3 text-[13px] font-semibold text-zinc-600 transition-colors active:bg-zinc-200"
          >
            Não é isso
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Passo ${current} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full transition-colors ${
            i + 1 === current ? "bg-zinc-950" : i + 1 < current ? "bg-zinc-300" : "bg-zinc-200"
          }`}
        />
      ))}
    </div>
  );
}
