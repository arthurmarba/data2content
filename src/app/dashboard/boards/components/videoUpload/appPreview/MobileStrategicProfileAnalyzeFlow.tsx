import { useState, useEffect } from "react";

const STEPS = [
  "intro",
  "mock_upload",
  "creator_goal",
  "quick_questions",
  "updating_profile",
  "updated_confirmation",
] as const;

type AnalyzeFlowStep = (typeof STEPS)[number];

type MobileStrategicProfileAnalyzeFlowProps = {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onSubmitAnalysis?: (payload: {
    creatorGoal: string;
    selectedGoalOption: "authority" | "retention" | "format_test" | "sponsored_content";
    quickAnswers?: Array<{ id: string; value: string }>;
    mockScenario?: string;
  }) => Promise<void>;
};

function nextStep(current: AnalyzeFlowStep): AnalyzeFlowStep {
  const index = STEPS.indexOf(current);
  return STEPS[Math.min(index + 1, STEPS.length - 1)] ?? "updated_confirmation";
}

function stepIndex(step: AnalyzeFlowStep): number {
  return STEPS.indexOf(step);
}

export function MobileStrategicProfileAnalyzeFlow({
  open,
  onClose,
  onComplete,
  onSubmitAnalysis,
}: MobileStrategicProfileAnalyzeFlowProps) {
  const [step, setStep] = useState<AnalyzeFlowStep>("intro");
  const [selectedOption, setSelectedOption] = useState<"authority" | "retention" | "format_test" | "sponsored_content">("authority");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitAttempt, setSubmitAttempt] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep("intro");
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [open]);

  // Executa o envio da análise ao entrar na etapa 'updating_profile'
  useEffect(() => {
    if (step !== "updating_profile") return;

    let active = true;

    async function triggerSubmit() {
      if (onSubmitAnalysis) {
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
          await onSubmitAnalysis({
            creatorGoal: "Como posso otimizar meu posicionamento de conteúdo?",
            selectedGoalOption: selectedOption,
            quickAnswers: [
              { id: "represents_current_phase", value: "sim" },
              { id: "wants_to_repeat_direction", value: "sim" }
            ],
          });
          if (active) {
            setIsSubmitting(false);
            setStep("updated_confirmation");
          }
        } catch (err: any) {
          if (active) {
            setIsSubmitting(false);
            setErrorMsg(err.message || "Ocorreu um erro no processamento do diagnóstico.");
          }
        }
      } else {
        // Fallback local do preview de simulação offline (1000ms)
        const timer = setTimeout(() => {
          if (active) {
            setStep("updated_confirmation");
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }

    triggerSubmit();

    return () => {
      active = false;
    };
  }, [step, selectedOption, onSubmitAnalysis, submitAttempt]);

  if (!open) return null;

  const goNext = () => {
    setStep((current) => nextStep(current));
  };

  const close = () => {
    setStep("intro");
    setErrorMsg(null);
    onClose();
  };

  const complete = () => {
    setStep("intro");
    setErrorMsg(null);
    onComplete();
  };

  const currentStepIndex = stepIndex(step);

  const goalOptions = [
    { label: "Ganhar autoridade", value: "authority" as const },
    { label: "Melhorar retenção", value: "retention" as const },
    { label: "Testar formato", value: "format_test" as const },
    { label: "Preparar publi", value: "sponsored_content" as const },
  ];

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-strategic-profile-analyze-flow-title"
      className="absolute inset-x-0 bottom-0 z-40 rounded-t-[2rem] border-t border-zinc-200 bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-300"
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-200" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Etapa {currentStepIndex + 1} de {STEPS.length} · Analisar vídeo
          </p>
          <h2 id="mobile-strategic-profile-analyze-flow-title" className="mt-1 text-xl font-semibold text-zinc-950">
            {step === "updated_confirmation" ? "Diagnóstico atualizado." : "Vamos atualizar seu Perfil"}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Fechar fluxo de análise"
          className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-lg font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors"
          onClick={close}
          disabled={isSubmitting}
        >
          ×
        </button>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-1" aria-hidden="true">
        {STEPS.map((item, index) => (
          <span
            key={item}
            className={index <= currentStepIndex ? "h-1.5 rounded-full bg-zinc-950" : "h-1.5 rounded-full bg-zinc-200"}
          />
        ))}
      </div>

      <div className="mt-4">
        {step === "intro" ? (
          <div>
            <p className="text-sm leading-6 text-zinc-600">
              Use um vídeo para a D2C entender novos sinais da sua narrativa.
            </p>
            <div className="mt-5 rounded-[1.5rem] border border-zinc-200 bg-[#f7f7f4] p-4">
              <p className="text-sm font-semibold text-zinc-950">Atualizar Perfil</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                A análise é temporária e retorna para o Diagnóstico vivo.
              </p>
            </div>
          </div>
        ) : null}

        {step === "mock_upload" ? (
          <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-[#f7f7f4] p-4">
            <p className="text-sm font-semibold text-zinc-950">Vídeo pronto para análise</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Preview local. Nenhum arquivo será enviado neste protótipo.
            </p>
          </div>
        ) : null}

        {step === "creator_goal" ? (
          <div>
            <p className="text-sm font-semibold text-zinc-950">Qual era o objetivo do conteúdo?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {goalOptions.map((opt) => {
                const isSelected = selectedOption === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-all duration-200 ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                        : "border-zinc-200 bg-[#f7f7f4] text-zinc-800 hover:border-zinc-300"
                    }`}
                    onClick={() => setSelectedOption(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === "quick_questions" ? (
          <div>
            <p className="text-sm font-semibold text-zinc-950">Só mais um contexto rápido</p>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Essas respostas ajudam a D2C entender o que você queria comunicar.
            </p>
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-[#f7f7f4] p-4">
                <p className="text-sm font-semibold text-zinc-800">Esse conteúdo representa sua fase atual?</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Resposta visual nesta preview, sem salvar nada.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-[#f7f7f4] p-4">
                <p className="text-sm font-semibold text-zinc-800">Você quer repetir essa direção no próximo post?</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">A leitura volta para o Perfil Estratégico.</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === "updating_profile" ? (
          <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50 p-4 transition-all">
            {errorMsg ? (
              <div>
                <p className="text-sm font-semibold text-red-600">Erro na atualização</p>
                <p className="mt-2 text-sm leading-6 text-red-500">{errorMsg}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm font-semibold text-zinc-950">Atualizando seu Perfil Estratégico</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Estamos conectando essa leitura ao seu diagnóstico vivo.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {step === "updated_confirmation" ? (
          <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">Identificamos novos aprendizados sobre sua narrativa.</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              A confirmação é curta porque o destino final é o seu Perfil.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex gap-2">
        {step === "updated_confirmation" ? (
          <button
            type="button"
            className="w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
            onClick={complete}
          >
            Voltar para meu Perfil
          </button>
        ) : step === "updating_profile" && errorMsg ? (
          <div className="flex w-full gap-2">
            <button
              type="button"
              className="w-1/2 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
              onClick={close}
            >
              Fechar
            </button>
            <button
              type="button"
              className="w-1/2 rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
              onClick={() => {
                setErrorMsg(null);
                setSubmitAttempt((prev) => prev + 1);
                setStep("updating_profile");
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            onClick={goNext}
            disabled={isSubmitting}
          >
            Continuar
          </button>
        )}
      </div>
    </section>
  );
}
