import { useState, useEffect } from "react";
import {
  buildUploadSessionPayloadFromFile,
  type UploadSessionPayload,
  type UploadSessionResponse,
} from "./mobileStrategicProfileUploadSessionClient";
import type {
  MobileStrategicProfileDirectUploadInput,
  MobileStrategicProfileDirectUploadResult,
} from "./mobileStrategicProfileDirectUploadClient";

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
  onCreateUploadSession?: (payload: UploadSessionPayload) => Promise<UploadSessionResponse>;
  onUploadToTemporarySignedUrl?: (
    input: MobileStrategicProfileDirectUploadInput,
  ) => Promise<MobileStrategicProfileDirectUploadResult>;
  onCleanupTemporaryUpload?: (payload: {
    uploadSessionId: string;
    objectKey?: string;
    reason: "analysis_completed" | "analysis_failed" | "user_cancelled" | "expired";
  }) => Promise<void>;
};

function nextStep(current: AnalyzeFlowStep): AnalyzeFlowStep {
  const index = STEPS.indexOf(current);
  return STEPS[Math.min(index + 1, STEPS.length - 1)] ?? "updated_confirmation";
}

function stepIndex(step: AnalyzeFlowStep): number {
  return STEPS.indexOf(step);
}

const formatSize = (bytes: number) => {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
};

const sanitizeVisibleFileName = (fileName: string) => {
  const normalized = fileName.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
  if (normalized.length <= 44) return normalized || "video";
  return `${normalized.slice(0, 28)}...${normalized.slice(-12)}`;
};

function getUploadSessionErrorMessage(response?: UploadSessionResponse) {
  const blockerCode = response?.issues?.find((issue) => issue.severity === "blocker")?.code;

  if (blockerCode === "invalid_mime_type" || blockerCode === "invalid_extension") {
    return "Formato não aceito. Escolha um vídeo MP4, MOV ou WEBM.";
  }

  if (blockerCode === "file_too_large") {
    return "Arquivo muito grande. Escolha um vídeo de até 100 MB.";
  }

  if (blockerCode === "consent_required") {
    return "Aceite o consentimento para continuar.";
  }

  if (blockerCode === "empty_file") {
    return "O arquivo selecionado parece vazio. Escolha outro vídeo.";
  }

  return response?.message || "Não foi possível validar o vídeo agora.";
}

export function MobileStrategicProfileAnalyzeFlow({
  open,
  onClose,
  onComplete,
  onSubmitAnalysis,
  onCreateUploadSession,
  onUploadToTemporarySignedUrl,
  onCleanupTemporaryUpload,
}: MobileStrategicProfileAnalyzeFlowProps) {
  const [step, setStep] = useState<AnalyzeFlowStep>("intro");
  const [selectedOption, setSelectedOption] = useState<"authority" | "retention" | "format_test" | "sponsored_content">("authority");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitAttempt, setSubmitAttempt] = useState(0);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [validationStatus, setValidationStatus] = useState<"idle" | "validating" | "uploading" | "validated" | "uploaded" | "error">("idle");
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [uploadSessionValidated, setUploadSessionValidated] = useState(false);
  const [temporaryUploadForCleanup, setTemporaryUploadForCleanup] = useState<{
    uploadSessionId: string;
    objectKey?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("intro");
      setErrorMsg(null);
      setIsSubmitting(false);
      setSelectedFile(null);
      setConsentAccepted(false);
      setValidationStatus("idle");
      setFileValidationError(null);
      setUploadSessionValidated(false);
      setTemporaryUploadForCleanup(null);
    }
  }, [open]);

  useEffect(() => {
    if (step !== "updating_profile") return;

    let active = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

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
          if (temporaryUploadForCleanup && onCleanupTemporaryUpload) {
            try {
              await onCleanupTemporaryUpload({
                ...temporaryUploadForCleanup,
                reason: "analysis_completed",
              });
            } catch {
              console.warn("Cleanup temporário não foi confirmado após a análise mock.");
            }
          }
          if (active) {
            setIsSubmitting(false);
            setStep("updated_confirmation");
          }
        } catch (err: any) {
          if (temporaryUploadForCleanup && onCleanupTemporaryUpload) {
            try {
              await onCleanupTemporaryUpload({
                ...temporaryUploadForCleanup,
                reason: "analysis_failed",
              });
            } catch {
              console.warn("Cleanup temporário não foi confirmado após falha da análise mock.");
            }
          }
          if (active) {
            setIsSubmitting(false);
            setErrorMsg(err.message || "Ocorreu um erro no processamento do diagnóstico.");
          }
        }
      } else {
        fallbackTimer = setTimeout(() => {
          if (active) {
            setStep("updated_confirmation");
          }
        }, 1000);
      }
    }

    triggerSubmit();

    return () => {
      active = false;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [step, selectedOption, onSubmitAnalysis, submitAttempt, temporaryUploadForCleanup, onCleanupTemporaryUpload]);

  if (!open) return null;

  const handleContinue = async () => {
    if (step === "mock_upload" && onCreateUploadSession) {
      if (!selectedFile) {
        setFileValidationError("Selecione um arquivo de vídeo primeiro.");
        return;
      }
      if (!consentAccepted) {
        setFileValidationError("Aceite o consentimento para continuar.");
        return;
      }
      setValidationStatus("validating");
      setFileValidationError(null);
      try {
        const res = await onCreateUploadSession(buildUploadSessionPayloadFromFile(selectedFile, true));

        if (res.ok && res.status === "mock_session_created") {
          setValidationStatus("validated");
          setUploadSessionValidated(true);
          setStep("creator_goal");
        } else if (res.ok && res.status === "signed_upload_session_created") {
          const session = res.uploadSession;
          if (!session?.uploadUrl || session.method !== "PUT" || !session.headers || !session.expiresAt) {
            setValidationStatus("error");
            setFileValidationError("Não foi possível enviar o vídeo agora.");
            return;
          }
          if (!onUploadToTemporarySignedUrl) {
            setValidationStatus("error");
            setFileValidationError("Não foi possível enviar o vídeo agora.");
            return;
          }

          setValidationStatus("uploading");
          const uploadResult = await onUploadToTemporarySignedUrl({
            file: selectedFile,
            uploadUrl: session.uploadUrl,
            method: session.method,
            headers: session.headers,
            expiresAt: session.expiresAt,
          });

          if (!uploadResult.ok) {
            setValidationStatus("error");
            setFileValidationError(uploadResult.errorMessage || "Não foi possível enviar o vídeo agora.");
            return;
          }

          setTemporaryUploadForCleanup({
            uploadSessionId: session.id,
            objectKey: session.objectKey,
          });
          setValidationStatus("uploaded");
          setUploadSessionValidated(true);
          setStep("creator_goal");
        } else {
          setValidationStatus("error");
          setFileValidationError(getUploadSessionErrorMessage(res));
        }
      } catch {
        setValidationStatus("error");
        setFileValidationError("Não foi possível validar o vídeo agora.");
      }
      return;
    }
    setStep((current) => nextStep(current));
  };

  const close = () => {
    setStep("intro");
    setErrorMsg(null);
    setUploadSessionValidated(false);
    setTemporaryUploadForCleanup(null);
    onClose();
  };

  const complete = () => {
    setStep("intro");
    setErrorMsg(null);
    setUploadSessionValidated(false);
    setTemporaryUploadForCleanup(null);
    onComplete();
  };

  const currentStepIndex = stepIndex(step);

  const goalOptions = [
    { label: "Ganhar autoridade", value: "authority" as const },
    { label: "Melhorar retenção", value: "retention" as const },
    { label: "Testar formato", value: "format_test" as const },
    { label: "Preparar publi", value: "sponsored_content" as const },
  ];

  // Regra de disabled para o botão Continuar
  const isContinueDisabled =
    isSubmitting ||
    validationStatus === "validating" ||
    validationStatus === "uploading" ||
    (step === "mock_upload" &&
      onCreateUploadSession &&
      (validationStatus === "validated" || validationStatus === "uploaded"));

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
          onCreateUploadSession ? (
            <div>
              <p className="text-sm leading-6 text-zinc-600 mb-4">
                Selecione um vídeo para validar se ele está pronto para análise temporária.
              </p>
              {!selectedFile ? (
                <p className="mb-3 text-xs font-semibold text-zinc-500">Aguardando seleção.</p>
              ) : null}

              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setConsentAccepted(false);
                    setValidationStatus("idle");
                    setFileValidationError(null);
                    setUploadSessionValidated(false);
                    setTemporaryUploadForCleanup(null);
                  }
                }}
                className="hidden"
                id="video-file-picker"
              />

              <label
                htmlFor="video-file-picker"
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-[#f7f7f4] px-4 py-8 text-center transition-colors hover:bg-zinc-50"
              >
                <span className="text-sm font-semibold text-zinc-950">Selecionar arquivo de vídeo</span>
                <span className="mt-1 text-xs text-zinc-500">MP4, MOV ou WEBM (max. 100MB)</span>
              </label>

              {selectedFile ? (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-[#f7f7f4] p-4 text-left">
                  <p className="text-xs uppercase font-semibold text-zinc-500">Arquivo Selecionado</p>
                  <p className="mt-1 truncate text-sm font-semibold text-zinc-950">{sanitizeVisibleFileName(selectedFile.name)}</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {selectedFile.type || "video/mp4"} · {formatSize(selectedFile.size)}
                  </p>
                </div>
              ) : null}

              {selectedFile ? (
                <div className="mt-4 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="video-consent-checkbox"
                    checked={consentAccepted}
                    onChange={(e) => {
                      setConsentAccepted(e.target.checked);
                      if (e.target.checked) {
                        setFileValidationError(null);
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <label htmlFor="video-consent-checkbox" className="text-xs leading-5 text-zinc-600 cursor-pointer">
                    Entendo que este vídeo será usado apenas para validar a análise narrativa temporária.
                  </label>
                </div>
              ) : null}

              {validationStatus === "validating" ? (
                <p className="mt-3 text-xs font-medium text-sky-600">
                  Preparando envio...
                </p>
              ) : null}

              {validationStatus === "uploading" ? (
                <p className="mt-3 text-xs font-medium text-sky-600">
                  Enviando vídeo...
                </p>
              ) : null}

              {validationStatus === "validated" ? (
                <p className="mt-3 text-xs font-semibold text-emerald-600">
                  Vídeo validado para análise
                </p>
              ) : null}

              {validationStatus === "uploaded" ? (
                <p className="mt-3 text-xs font-semibold text-emerald-600">
                  Vídeo enviado para análise temporária.
                </p>
              ) : null}

              {fileValidationError ? (
                <p className="mt-3 text-xs font-semibold text-red-600">
                  {fileValidationError}
                </p>
              ) : null}
            </div>
          ) : (
            // Interface Mock de Preview local legada
            <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-[#f7f7f4] p-4">
              <p className="text-sm font-semibold text-zinc-950">Vídeo pronto para análise</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Preview local. Nenhum arquivo será enviado neste protótipo.
              </p>
            </div>
          )
        ) : null}

        {step === "creator_goal" ? (
          <div>
            {uploadSessionValidated ? (
              <p className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                {validationStatus === "uploaded" ? "Vídeo enviado para análise temporária." : "Vídeo validado para análise"}
              </p>
            ) : null}
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
            onClick={handleContinue}
            disabled={isContinueDisabled}
          >
            Continuar
          </button>
        )}
      </div>
    </section>
  );
}
