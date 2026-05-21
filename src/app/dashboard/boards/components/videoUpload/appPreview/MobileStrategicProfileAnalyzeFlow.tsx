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
  "upload",
  "creator_goal",
  "context",
  "processing",
  "confirmation",
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
    consentTextVersion?: string;
    temporaryUpload?: {
      uploadSessionId: string;
      objectKey?: string;
      mimeType: string;
      sizeBytes: number;
      uploadedAt?: string;
    };
  }) => Promise<void>;
  onCreateUploadSession?: (payload: UploadSessionPayload) => Promise<UploadSessionResponse>;
  onUploadToTemporarySignedUrl?: (
    input: MobileStrategicProfileDirectUploadInput,
  ) => Promise<MobileStrategicProfileDirectUploadResult>;
  enableRealAnalysis?: boolean;
  onCleanupTemporaryUpload?: (payload: {
    uploadSessionId: string;
    objectKey?: string;
    reason: "analysis_completed" | "analysis_failed" | "user_cancelled" | "expired";
  }) => Promise<void>;
};

function nextStep(current: AnalyzeFlowStep): AnalyzeFlowStep {
  const index = STEPS.indexOf(current);
  return STEPS[Math.min(index + 1, STEPS.length - 1)] ?? "confirmation";
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

const goalOptions = [
  {
    label: "Melhorar retenção",
    value: "retention" as const,
    defaultQuestion: "Como esse vídeo pode prender mais atenção?",
  },
  {
    label: "Entender narrativa",
    value: "authority" as const,
    defaultQuestion: "O que esse vídeo revela sobre minha narrativa?",
  },
  {
    label: "Preparar publi",
    value: "sponsored_content" as const,
    defaultQuestion: "Como transformar essa direção em um conteúdo útil para marcas?",
  },
  {
    label: "Testar formato",
    value: "format_test" as const,
    defaultQuestion: "Esse formato vale repetir no meu Perfil?",
  },
  {
    label: "Ganhar autoridade",
    value: "authority" as const,
    defaultQuestion: "Como esse conteúdo fortalece minha autoridade?",
  },
];

const contextQuestions = [
  {
    id: "represents_current_phase",
    question: "Esse vídeo representa sua fase atual?",
    options: ["Sim", "Mais ou menos", "Não"],
  },
  {
    id: "wants_to_repeat_direction",
    question: "Você quer repetir essa direção?",
    options: ["Sim", "Talvez", "Não"],
  },
  {
    id: "content_intent",
    question: "O que você mais queria com esse conteúdo?",
    options: ["Alcançar mais pessoas", "Gerar comentários", "Atrair marcas", "Fortalecer autoridade"],
  },
];

function defaultContextAnswers(): Record<string, string> {
  return {
    represents_current_phase: "Sim",
    wants_to_repeat_direction: "Talvez",
    content_intent: "Fortalecer autoridade",
  };
}

export function MobileStrategicProfileAnalyzeFlow({
  open,
  onClose,
  onComplete,
  onSubmitAnalysis,
  onCreateUploadSession,
  onUploadToTemporarySignedUrl,
  enableRealAnalysis = false,
  onCleanupTemporaryUpload,
}: MobileStrategicProfileAnalyzeFlowProps) {
  const [step, setStep] = useState<AnalyzeFlowStep>("intro");
  const [selectedOption, setSelectedOption] = useState<"authority" | "retention" | "format_test" | "sponsored_content">("authority");
  const [creatorGoal, setCreatorGoal] = useState("");
  const [quickAnswers, setQuickAnswers] = useState<Record<string, string>>(() => defaultContextAnswers());
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
  const [temporaryUploadForAnalysis, setTemporaryUploadForAnalysis] = useState<{
    uploadSessionId: string;
    objectKey?: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt?: string;
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
      setTemporaryUploadForAnalysis(null);
      setCreatorGoal("");
      setSelectedOption("authority");
      setQuickAnswers(defaultContextAnswers());
    }
  }, [open]);

  useEffect(() => {
    if (step !== "processing") return;

    let active = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    async function triggerSubmit() {
      if (onSubmitAnalysis) {
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
          await onSubmitAnalysis({
            creatorGoal: creatorGoal.trim() || goalOptions.find((option) => option.value === selectedOption)?.defaultQuestion || "O que este vídeo revela sobre minha narrativa?",
            selectedGoalOption: selectedOption,
            quickAnswers: contextQuestions.map((question) => ({
              id: question.id,
              value: quickAnswers[question.id] ?? "",
            })),
            consentTextVersion: "mobile_strategic_profile_temporary_video_v1",
            temporaryUpload: enableRealAnalysis ? temporaryUploadForAnalysis ?? undefined : undefined,
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
            setStep("confirmation");
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
            setStep("confirmation");
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
  }, [
    step,
    creatorGoal,
    selectedOption,
    quickAnswers,
    onSubmitAnalysis,
    submitAttempt,
    temporaryUploadForCleanup,
    onCleanupTemporaryUpload,
    temporaryUploadForAnalysis,
    enableRealAnalysis,
  ]);

  if (!open) return null;

  const handleContinue = async () => {
    if (step === "upload" && onCreateUploadSession) {
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
          setTemporaryUploadForAnalysis({
            uploadSessionId: session.id,
            objectKey: session.objectKey,
            mimeType: selectedFile.type || "video/mp4",
            sizeBytes: selectedFile.size,
            uploadedAt: uploadResult.uploadedAt,
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
    setTemporaryUploadForAnalysis(null);
    setCreatorGoal("");
    setSelectedOption("authority");
    setQuickAnswers(defaultContextAnswers());
    onClose();
  };

  const complete = () => {
    setStep("intro");
    setErrorMsg(null);
    setUploadSessionValidated(false);
    setTemporaryUploadForCleanup(null);
    setTemporaryUploadForAnalysis(null);
    setCreatorGoal("");
    setSelectedOption("authority");
    setQuickAnswers(defaultContextAnswers());
    onComplete();
  };

  const currentStepIndex = stepIndex(step);

  // Regra de disabled para o botão Continuar
  const isContinueDisabled =
    isSubmitting ||
    validationStatus === "validating" ||
    validationStatus === "uploading" ||
    (step === "upload" &&
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
            Etapa {currentStepIndex + 1} de {STEPS.length} · Nova leitura
          </p>
          <h2 id="mobile-strategic-profile-analyze-flow-title" className="mt-1 text-xl font-semibold text-zinc-950">
            {step === "intro"
              ? "Nova leitura estratégica"
              : step === "upload"
                ? "Escolha o vídeo"
                : step === "creator_goal"
                  ? "O que você quer entender?"
                  : step === "context"
                    ? "Só mais um contexto rápido"
                    : step === "processing"
                      ? "Analisando sua narrativa"
                      : "Leitura pronta"}
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
              Envie um vídeo e diga o que você quer entender. A D2C transforma esse conteúdo em direção para o seu Perfil.
            </p>
            <div className="mt-5 rounded-[1.5rem] border border-zinc-200 bg-[#f7f7f4] p-4">
              <p className="text-sm font-semibold text-zinc-950">Seu Perfil é a casa da leitura</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                O vídeo traz sinais, sua pergunta dá intenção e o resultado volta para o Perfil.
              </p>
            </div>
          </div>
        ) : null}

        {step === "upload" ? (
          onCreateUploadSession ? (
            <div>
              <p className="text-sm leading-6 text-zinc-600 mb-4">
                Use um post recente, um conteúdo que performou bem ou uma ideia que você quer avaliar.
              </p>
              {!selectedFile ? (
                <p className="mb-3 text-xs font-semibold text-zinc-500">Escolha um arquivo para começar.</p>
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
                    setTemporaryUploadForAnalysis(null);
                  }
                }}
                className="hidden"
                id="video-file-picker"
              />

              <label
                htmlFor="video-file-picker"
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-[#f7f7f4] px-4 py-8 text-center transition-colors hover:bg-zinc-50"
              >
                <span className="text-sm font-semibold text-zinc-950">Selecionar vídeo</span>
                <span className="mt-1 text-xs text-zinc-500">MP4, MOV ou WEBM até 100 MB</span>
              </label>

              {selectedFile ? (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-[#f7f7f4] p-4 text-left">
                  <p className="text-xs uppercase font-semibold text-zinc-500">Vídeo selecionado</p>
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
                    Usar este vídeo apenas para gerar esta leitura.
                  </label>
                </div>
              ) : null}

              {validationStatus === "validating" ? (
                <p className="mt-3 text-xs font-medium text-sky-600">
                  Preparando vídeo...
                </p>
              ) : null}

              {validationStatus === "uploading" ? (
                <p className="mt-3 text-xs font-medium text-sky-600">
                  Enviando vídeo...
                </p>
              ) : null}

              {validationStatus === "validated" ? (
                <p className="mt-3 text-xs font-semibold text-emerald-600">
                  Vídeo pronto para leitura
                </p>
              ) : null}

              {validationStatus === "uploaded" ? (
                <p className="mt-3 text-xs font-semibold text-emerald-600">
                  Vídeo pronto para leitura
                </p>
              ) : null}

              {fileValidationError ? (
                <p className="mt-3 text-xs font-semibold text-red-600">
                  {fileValidationError}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-[#f7f7f4] p-4">
              <p className="text-sm font-semibold text-zinc-950">Vídeo pronto para leitura</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Continue para informar sua pergunta e gerar uma leitura estratégica.
              </p>
            </div>
          )
        ) : null}

        {step === "creator_goal" ? (
          <div>
            {uploadSessionValidated ? (
              <p className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                Vídeo pronto para leitura
              </p>
            ) : null}
            <p className="text-sm leading-6 text-zinc-600">Escreva sua dúvida ou escolha um objetivo rápido.</p>
            <textarea
              value={creatorGoal}
              onChange={(event) => setCreatorGoal(event.target.value)}
              placeholder="Ex: por que esse vídeo prendeu atenção?"
              className="mt-3 min-h-[92px] w-full resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
            />
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
                    onClick={() => {
                      setSelectedOption(opt.value);
                      if (!creatorGoal.trim()) {
                        setCreatorGoal(opt.defaultQuestion);
                      }
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === "context" ? (
          <div>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Isso ajuda a D2C interpretar o vídeo pela sua intenção, não só pela imagem.
            </p>
            <div className="mt-3 grid gap-3">
              {contextQuestions.map((item) => (
                <div key={item.id} className="rounded-2xl border border-zinc-200 bg-[#f7f7f4] p-4">
                  <p className="text-sm font-semibold text-zinc-800">{item.question}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.options.map((option) => {
                      const selected = quickAnswers[item.id] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          className={
                            selected
                              ? "rounded-full bg-zinc-950 px-3 py-2 text-xs font-semibold text-white"
                              : "rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
                          }
                          onClick={() => setQuickAnswers((current) => ({ ...current, [item.id]: option }))}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === "processing" ? (
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
                  <p className="text-sm font-semibold text-zinc-950">
                    Analisando sua narrativa
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Estamos conectando vídeo, pergunta e contexto ao seu Perfil.
                </p>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-sky-700">
                  <span>Lendo sinais do vídeo</span>
                  <span>Interpretando sua intenção</span>
                  <span>Atualizando o Perfil</span>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {step === "confirmation" ? (
          <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">Encontramos novos sinais para o seu Perfil.</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              O diagnóstico completo aparece no Perfil, junto das leituras e do mapa.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex gap-2">
        {step === "confirmation" ? (
          <div className="flex w-full gap-2">
            <button
              type="button"
              className="w-2/3 rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
              onClick={complete}
            >
              Ver leitura no Perfil
            </button>
            <button
              type="button"
              className="w-1/3 rounded-full border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
              onClick={() => {
                setStep("upload");
                setSelectedFile(null);
                setConsentAccepted(false);
                setValidationStatus("idle");
                setFileValidationError(null);
                setUploadSessionValidated(false);
              }}
            >
              Outro vídeo
            </button>
          </div>
        ) : step === "processing" && errorMsg ? (
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
                setStep("processing");
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
            {step === "intro"
              ? "Começar"
              : step === "context"
                ? "Gerar leitura"
                : "Continuar"}
          </button>
        )}
      </div>
    </section>
  );
}
