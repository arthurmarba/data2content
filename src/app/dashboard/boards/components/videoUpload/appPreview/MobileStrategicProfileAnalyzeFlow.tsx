import { useState } from "react";

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
};

function nextStep(current: AnalyzeFlowStep): AnalyzeFlowStep {
  const index = STEPS.indexOf(current);
  return STEPS[Math.min(index + 1, STEPS.length - 1)] ?? "updated_confirmation";
}

export function MobileStrategicProfileAnalyzeFlow({
  open,
  onClose,
  onComplete,
}: MobileStrategicProfileAnalyzeFlowProps) {
  const [step, setStep] = useState<AnalyzeFlowStep>("intro");

  if (!open) return null;

  const goNext = () => setStep((current) => nextStep(current));
  const close = () => {
    setStep("intro");
    onClose();
  };
  const complete = () => {
    setStep("intro");
    onComplete();
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-strategic-profile-analyze-flow-title"
      className="absolute inset-x-0 bottom-0 z-40 rounded-t-[1.75rem] border-t border-zinc-200 bg-white p-5 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">Analisar vídeo</p>
          <h2 id="mobile-strategic-profile-analyze-flow-title" className="mt-1 text-xl font-semibold text-zinc-950">
            {step === "updated_confirmation" ? "Diagnóstico atualizado." : "Vamos atualizar seu Perfil Estratégico"}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Fechar fluxo de análise"
          className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-lg font-semibold text-zinc-700"
          onClick={close}
        >
          ×
        </button>
      </div>

      <div className="mt-4">
        {step === "intro" ? (
          <div>
            <p className="text-sm leading-6 text-zinc-600">
              Envie um vídeo para a D2C entender novos sinais da sua narrativa.
            </p>
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-950">Atualizar Perfil</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                A análise é temporária e retorna para o Diagnóstico vivo.
              </p>
            </div>
          </div>
        ) : null}

        {step === "mock_upload" ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">Vídeo selecionado para análise</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Preview local. Nenhum arquivo será enviado neste protótipo.
            </p>
          </div>
        ) : null}

        {step === "creator_goal" ? (
          <div>
            <p className="text-sm font-semibold text-zinc-950">Qual era o objetivo desse conteúdo?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["Ganhar autoridade", "Melhorar retenção", "Testar formato", "Preparar publi"].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-sm font-semibold text-zinc-800"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === "quick_questions" ? (
          <div>
            <p className="text-sm font-semibold text-zinc-950">Duas perguntas rápidas para entender contexto</p>
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-800">Esse conteúdo representa sua fase atual?</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Resposta visual nesta preview, sem salvar nada.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-800">Você quer repetir essa direção no próximo post?</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">A leitura volta para o Perfil Estratégico.</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === "updating_profile" ? (
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">Atualizando seu diagnóstico vivo...</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Estamos conectando esta leitura ao seu Perfil Estratégico.
            </p>
          </div>
        ) : null}

        {step === "updated_confirmation" ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">Identificamos novos sinais sobre sua narrativa.</p>
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
            className="w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white"
            onClick={complete}
          >
            Voltar para meu Perfil
          </button>
        ) : (
          <button
            type="button"
            className="w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white"
            onClick={goNext}
          >
            Continuar
          </button>
        )}
      </div>
    </section>
  );
}
