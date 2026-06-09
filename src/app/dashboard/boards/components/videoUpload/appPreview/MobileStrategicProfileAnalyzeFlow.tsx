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
  "upload",
  "creator_goal",
  "processing",
  "confirmation",
] as const;

// Steps visíveis ao criador no contador — processing é automático, não conta.
const VISIBLE_STEPS = ["upload", "creator_goal", "confirmation"] as const;

type AnalyzeFlowStep = (typeof STEPS)[number];

function visibleStepIndex(step: AnalyzeFlowStep): number {
  return (VISIBLE_STEPS as readonly string[]).indexOf(step);
}
export type MobileStrategicProfileAnalyzeContextOption = {
  id: string;
  label: string;
  value?: string | null;
  recommended?: boolean;
};

export type MobileStrategicProfileAnalyzeContextQuestion = {
  id: string;
  question: string;
  helper?: string | null;
  options: MobileStrategicProfileAnalyzeContextOption[];
};

export type MobileStrategicProfileAnalyzeConfirmationData = {
  diagnosisSummary?: string | null;
  unlockedSignals?: string[];
  opportunities?: string[];
};

export type MobileStrategicProfileAnalyzeResult = {
  contextQuestions?: MobileStrategicProfileAnalyzeContextQuestion[];
  /** The saved diagnosis ID from the backend, used by the parent to persist the thumbnail. */
  savedDiagnosisId?: string | null;
  /** Real content from the server snapshot to display on the confirmation step. */
  confirmationData?: MobileStrategicProfileAnalyzeConfirmationData | null;
};

export type MobileStrategicProfileAnalyzeFlowCompleteResult = {
  thumbnailDataUrl?: string;
  /** The saved diagnosis ID — matches the reading in the refreshed server view. */
  savedDiagnosisId?: string | null;
  /** Creator's declared publication intent for this video. */
  publishIntent?: "yes" | "no" | null;
};

type MobileStrategicProfileAnalyzeFlowProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (result?: MobileStrategicProfileAnalyzeFlowCompleteResult) => void;
  completionSecondaryAction?: "another_video" | "upgrade";
  onCompletionUpgrade?: () => void;
  onSubmitAnalysis?: (payload: {
    creatorGoal: string;
    selectedGoalOption: "authority" | "authority_build" | "retention" | "format_test" | "sponsored_content";
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
  }) => Promise<MobileStrategicProfileAnalyzeResult | void>;
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
  onSubmitConfirmationAnswer?: (payload: {
    diagnosisId: string;
    answer: { questionId: string; questionText: string; answerId: string; answerValue: string };
  }) => Promise<void>;
  /**
   * Called when the creator declares their publication intent for this video.
   * Fire-and-forget from the component — errors are non-fatal.
   */
  onPublishIntentSubmit?: (diagnosisId: string, intent: "yes" | "no") => Promise<void>;
  /**
   * Resumo de cota de leituras, exibido no passo de upload. `null`/ausente esconde o
   * contador (ex.: admin com leituras ilimitadas). Free mostra a leitura-presente;
   * Pro mostra "X de N este mês". O tom é informativo e calmo — nunca alarme de escassez.
   */
  readingsSummary?: {
    isPro: boolean;
    /** Leituras já usadas (free: total; pro: no mês). */
    used: number;
    /** Limite do plano (free: 1; pro: 10). */
    limit: number;
  } | null;
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

async function extractVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof URL.createObjectURL !== "function" || typeof URL.revokeObjectURL !== "function") {
      resolve(null);
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.addEventListener("loadeddata", () => {
      video.currentTime = Math.min(1, video.duration / 4);
    });
    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        const maxW = 480;
        const scale = Math.min(1, maxW / (video.videoWidth || 480));
        canvas.width = Math.round((video.videoWidth || 480) * scale);
        canvas.height = Math.round((video.videoHeight || 270) * scale);
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    });
    video.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      resolve(null);
    });
    // Fallback if seeked never fires
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 8000);
  });
}

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
    label: "Entender minha narrativa",
    value: "authority" as const,
    defaultQuestion: "O que esse vídeo revela sobre minha narrativa?",
  },
  {
    label: "Checar coerência com o meu mapa",
    value: "retention" as const,
    defaultQuestion: "Esse vídeo é coerente com o que venho construindo?",
  },
  {
    label: "Testar um formato diferente",
    value: "format_test" as const,
    defaultQuestion: "Esse formato vale repetir no meu Perfil?",
  },
  {
    label: "Explorar um território novo",
    value: "sponsored_content" as const,
    defaultQuestion: "Que território de conteúdo esse vídeo abre para mim?",
  },
  {
    label: "Fortalecer meu ponto de vista",
    value: "authority_build" as const,
    defaultQuestion: "Como esse vídeo reforça o meu ponto de vista?",
  },
];


export function MobileStrategicProfileAnalyzeFlow({
  open,
  onClose,
  onComplete,
  onSubmitAnalysis,
  onCreateUploadSession,
  onUploadToTemporarySignedUrl,
  enableRealAnalysis = false,
  onCleanupTemporaryUpload,
  onSubmitConfirmationAnswer,
  onPublishIntentSubmit,
  completionSecondaryAction = "another_video",
  onCompletionUpgrade,
  readingsSummary,
}: MobileStrategicProfileAnalyzeFlowProps) {
  const [step, setStep] = useState<AnalyzeFlowStep>("upload");
  const [publishIntent, setPublishIntent] = useState<"yes" | "no" | null>(null);
  const [selectedOption, setSelectedOption] = useState<"authority" | "authority_build" | "retention" | "format_test" | "sponsored_content">("authority");
  const [creatorGoal, setCreatorGoal] = useState("");
  const [confirmationQuestion, setConfirmationQuestion] = useState<MobileStrategicProfileAnalyzeContextQuestion | null>(null);
  const [confirmationAnswer, setConfirmationAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const [savedDiagnosisId, setSavedDiagnosisId] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] = useState<MobileStrategicProfileAnalyzeConfirmationData | null>(null);
  // Animated processing stage: 0=first active, 1=second active, 2=third active
  const [processingStage, setProcessingStage] = useState(0);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
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

  const requestTemporaryUploadCleanup = (
    reason: "analysis_completed" | "analysis_failed" | "user_cancelled" | "expired",
  ) => {
    if (!temporaryUploadForCleanup || !onCleanupTemporaryUpload) return;
    onCleanupTemporaryUpload({
      ...temporaryUploadForCleanup,
      reason,
    }).catch(() => {
      console.warn("Cleanup temporário não foi confirmado.");
    });
  };

  useEffect(() => {
    if (!open) {
      setStep("upload");
      setErrorMsg(null);
      setIsSubmitting(false);
      setSelectedFile(null);
      setThumbnailDataUrl(null);
      setConsentAccepted(false);
      setValidationStatus("idle");
      setFileValidationError(null);
      setUploadSessionValidated(false);
      setTemporaryUploadForCleanup(null);
      setTemporaryUploadForAnalysis(null);
      setCreatorGoal("");
      setSelectedOption("authority");
      setConfirmationQuestion(null);
      setConfirmationAnswer(null);
      setProcessingStage(0);
      setConfirmationData(null);
    }
  }, [open]);

  // Animate processing stage labels progressively while waiting for server
  useEffect(() => {
    if (step !== "processing" || errorMsg) return;
    setProcessingStage(0);
    const t1 = setTimeout(() => setProcessingStage(1), 4000);
    const t2 = setTimeout(() => setProcessingStage(2), 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step, errorMsg, submitAttempt]);

  useEffect(() => {
    if (step !== "processing") return;

    let active = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    async function triggerSubmit() {
      if (onSubmitAnalysis) {
        if (enableRealAnalysis && !temporaryUploadForAnalysis?.uploadSessionId) {
          setIsSubmitting(false);
          setErrorMsg("Não conseguimos confirmar o envio do vídeo. Volte e envie novamente.");
          return;
        }
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
          const result = await onSubmitAnalysis({
            creatorGoal: creatorGoal.trim() || goalOptions.find((option) => option.value === selectedOption)?.defaultQuestion || "O que este vídeo revela sobre minha narrativa?",
            selectedGoalOption: selectedOption,
            consentTextVersion: "mobile_strategic_profile_temporary_video_v1",
            temporaryUpload: enableRealAnalysis ? temporaryUploadForAnalysis ?? undefined : undefined,
          });
          if (!enableRealAnalysis && temporaryUploadForCleanup && onCleanupTemporaryUpload) {
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
            if (enableRealAnalysis && !result?.savedDiagnosisId) {
              throw new Error("A leitura foi feita, mas não foi salva no Perfil. Tente novamente.");
            }
            if (result?.savedDiagnosisId) {
              setSavedDiagnosisId(result.savedDiagnosisId);
            }
            if (result?.confirmationData) {
              setConfirmationData(result.confirmationData);
            }
            if (result?.contextQuestions?.[0]) {
              setConfirmationQuestion(result.contextQuestions[0]);
            }
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
          if (enableRealAnalysis) {
            setValidationStatus("error");
            setFileValidationError("Não conseguimos preparar o vídeo para leitura real agora.");
            return;
          }
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

  const resetFlow = (
    cleanupReason?: "analysis_completed" | "analysis_failed" | "user_cancelled" | "expired",
  ) => {
    if (cleanupReason) {
      requestTemporaryUploadCleanup(cleanupReason);
    }
    setStep("upload");
    setErrorMsg(null);
    setSelectedFile(null);
    setConsentAccepted(false);
    setValidationStatus("idle");
    setFileValidationError(null);
    setUploadSessionValidated(false);
    setTemporaryUploadForCleanup(null);
    setTemporaryUploadForAnalysis(null);
    setCreatorGoal("");
    setSelectedOption("authority");
    setConfirmationQuestion(null);
    setConfirmationAnswer(null);
    setThumbnailDataUrl(null);
    setSavedDiagnosisId(null);
    setConfirmationData(null);
    setProcessingStage(0);
    setPublishIntent(null);
  };

  const close = () => {
    resetFlow("user_cancelled");
    onClose();
  };

  const buildCompleteResult = (): MobileStrategicProfileAnalyzeFlowCompleteResult | undefined => {
    const thumb = thumbnailDataUrl;
    const diagId = savedDiagnosisId;
    return thumb || diagId
      ? { thumbnailDataUrl: thumb ?? undefined, savedDiagnosisId: diagId, publishIntent }
      : undefined;
  };

  const complete = () => {
    const result = buildCompleteResult();
    resetFlow();
    onComplete(result);
  };

  const handleConfirmationSecondaryAction = () => {
    if (completionSecondaryAction === "upgrade") {
      const result = buildCompleteResult();
      resetFlow();
      onComplete(result);
      onCompletionUpgrade?.();
      return;
    }

    setStep("upload");
    setSelectedFile(null);
    setConsentAccepted(false);
    setValidationStatus("idle");
    setFileValidationError(null);
    setUploadSessionValidated(false);
    setTemporaryUploadForCleanup(null);
    setTemporaryUploadForAnalysis(null);
    setCreatorGoal("");
    setSelectedOption("authority");
    setConfirmationQuestion(null);
    setConfirmationAnswer(null);
    setSavedDiagnosisId(null);
    setConfirmationData(null);
    setPublishIntent(null);
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
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-zinc-950/35 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-strategic-profile-analyze-flow-title"
        className="max-h-[min(88dvh,760px)] w-full max-w-md overflow-y-auto rounded-[1.65rem] border border-zinc-200 bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-300"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-200" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
        <div>
          {step !== "processing" && (
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Etapa {visibleStepIndex(step) + 1} de {VISIBLE_STEPS.length}
            </p>
          )}
          <h2 id="mobile-strategic-profile-analyze-flow-title" className="mt-1 text-xl font-semibold text-zinc-950">
            {step === "upload"
              ? "Traga seu vídeo"
              : step === "creator_goal"
                ? "O que quer desvendar?"
                : step === "processing"
                  ? "Percebendo seus padrões"
                  : "Seu espelho está pronto"}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Fechar fluxo de análise"
          className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
          onClick={close}
          disabled={isSubmitting}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1" aria-hidden="true">
          {VISIBLE_STEPS.map((item, index) => {
            const vIdx = visibleStepIndex(step);
            const filled = step === "processing" ? index <= 1 : index <= vIdx;
            return (
              <span key={item} className={filled ? "h-1.5 rounded-full bg-zinc-950" : "h-1.5 rounded-full bg-zinc-200"} />
            );
          })}
        </div>

        <div className="mt-4">

        {step === "upload" ? (
          onCreateUploadSession ? (
            <div>
              {readingsSummary ? (
                readingsSummary.isPro ? (
                  <div className="mb-4 rounded-2xl bg-[#f7f7f4] px-3.5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-700">Leituras este mês</span>
                      <span className="text-xs font-semibold text-zinc-500">
                        {readingsSummary.used} de {readingsSummary.limit}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1" aria-hidden="true">
                      {Array.from({ length: readingsSummary.limit }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${i < readingsSummary.used ? "bg-zinc-800" : "bg-zinc-200"}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-[#f7f7f4] px-3.5 py-3">
                    <span className="shrink-0 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Grátis
                    </span>
                    <span className="text-xs font-medium text-zinc-600">
                      Sua primeira leitura é por nossa conta.
                    </span>
                  </div>
                )
              ) : null}
              <p className="text-sm leading-6 text-zinc-600 mb-4">
                Escolha um post recente, um conteúdo de que você se orgulha ou uma ideia que quer ver refletida.
              </p>
              {!selectedFile ? (
                <p className="mb-3 text-xs font-semibold text-zinc-500">Escolha seu vídeo para refletir.</p>
              ) : null}

              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    requestTemporaryUploadCleanup("user_cancelled");
                    setSelectedFile(file);
                    setConsentAccepted(false);
                    setValidationStatus("idle");
                    setFileValidationError(null);
                    setUploadSessionValidated(false);
                    setTemporaryUploadForCleanup(null);
                    setTemporaryUploadForAnalysis(null);
                    setThumbnailDataUrl(null);
                    extractVideoThumbnail(file).then((url) => {
                      if (url) setThumbnailDataUrl(url);
                    });
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
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-[#f7f7f4] p-4 text-left overflow-hidden">
                  {thumbnailDataUrl ? (
                    <div className="-mx-4 -mt-4 mb-3 overflow-hidden rounded-t-2xl">
                      <img src={thumbnailDataUrl} alt="" className="w-full object-cover" style={{ aspectRatio: "16/9", maxHeight: 160 }} aria-hidden="true" />
                    </div>
                  ) : null}
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
                    Usar este vídeo apenas para estudar meus padrões e refletir minha narrativa.
                  </label>
                </div>
              ) : null}

              {validationStatus === "validating" ? (
                <p className="mt-3 text-xs font-medium text-sky-600">
                  Acolhendo seu vídeo...
                </p>
              ) : null}

              {validationStatus === "uploading" ? (
                <p className="mt-3 text-xs font-medium text-sky-600">
                  Conectando ao espelho...
                </p>
              ) : null}

              {validationStatus === "validated" ? (
                <p className="mt-3 text-xs font-semibold text-emerald-600">
                  Vídeo acolhido e pronto
                </p>
              ) : null}

              {validationStatus === "uploaded" ? (
                <p className="mt-3 text-xs font-semibold text-emerald-600">
                  Vídeo acolhido e pronto
                </p>
              ) : null}

              {fileValidationError ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-red-600">{fileValidationError}</p>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700"
                    onClick={() => {
                      requestTemporaryUploadCleanup("user_cancelled");
                      setSelectedFile(null);
                      setConsentAccepted(false);
                      setValidationStatus("idle");
                      setFileValidationError(null);
                      setUploadSessionValidated(false);
                      setThumbnailDataUrl(null);
                      setTemporaryUploadForCleanup(null);
                      setTemporaryUploadForAnalysis(null);
                    }}
                  >
                    Trocar vídeo
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-[#f7f7f4] p-4">
              <p className="text-sm font-semibold text-zinc-950">Vídeo acolhido e pronto</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Prossiga para definir sua dúvida e ver seu espelho refletir sua voz.
              </p>
            </div>
          )
        ) : null}

        {step === "creator_goal" ? (
          <div>
            {uploadSessionValidated ? (
              <p className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                Vídeo acolhido e pronto
              </p>
            ) : null}
            {/* Botões primeiro — escolha concreta, sem pressão de campo em branco */}
            <div className="flex flex-col gap-2">
              {goalOptions.map((opt) => {
                const isSelected = selectedOption === opt.value;
                return (
                  <button
                    key={`${opt.value}-${opt.label}`}
                    type="button"
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all duration-200 ${
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
            {/* Textarea opcional abaixo */}
            <p className="mt-4 text-xs text-zinc-400">Quer refinar a pergunta? Escreva abaixo.</p>
            <textarea
              value={creatorGoal}
              onChange={(event) => setCreatorGoal(event.target.value)}
              placeholder="Ex: por que esse vídeo prendeu atenção?"
              className="mt-2 min-h-[72px] w-full resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
            />
          </div>
        ) : null}

        {step === "processing" ? (
          <div className="rounded-[1.5rem] bg-zinc-950 p-5 text-white transition-all">
            {errorMsg ? (
              <div>
                <p className="text-sm font-semibold text-red-400">Erro na análise</p>
                <p className="mt-2 text-sm leading-6 text-red-300">{errorMsg}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 animate-spin text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm font-semibold">Percebendo seus padrões</p>
                </div>
                <div className="mt-4 grid gap-3">
                  {(
                    [
                      { label: "Estudando sua voz", threshold: 0 },
                      { label: "Percebendo seus padrões", threshold: 1 },
                      { label: "Ajustando seu espelho", threshold: 2 },
                    ] as const
                  ).map((stage, idx) => {
                    const isDone = processingStage > stage.threshold;
                    const isActive = processingStage === stage.threshold;
                    return (
                      <div key={stage.label} className="flex items-center gap-3">
                        {isDone ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                              <path d="M3 7.5l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        ) : isActive ? (
                          <span className="mx-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-white" />
                        ) : (
                          <span className="mx-1.5 h-2 w-2 shrink-0 rounded-full bg-white/25" />
                        )}
                        <span className={`text-sm transition-opacity ${!isDone && !isActive ? "text-white/40" : "text-white"}`}>
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-[11px] text-white/30">Isso pode levar até 30 segundos</p>
              </div>
            )}
          </div>
        ) : null}

        {step === "confirmation" ? (
          <div>
            {thumbnailDataUrl ? (
              <div className="-mx-5 -mt-1 mb-4 overflow-hidden">
                <img src={thumbnailDataUrl} alt="" className="w-full object-cover opacity-80" style={{ aspectRatio: "16/9", maxHeight: 120 }} aria-hidden="true" />
              </div>
            ) : null}
            <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-zinc-950">Esse vídeo deixou seu mapa mais claro.</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {confirmationData?.diagnosisSummary
                  ? confirmationData.diagnosisSummary
                  : "Abra a leitura para ver o que este vídeo confirma, tensiona ou abre no seu mapa."}
              </p>
            </div>
            {((confirmationData?.unlockedSignals?.length ?? 0) > 0 || (confirmationData?.opportunities?.length ?? 0) > 0) ? (
              <div className="mt-4 rounded-[1.5rem] bg-[#f7f7f4] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">O que este vídeo mostrou</p>
                <div className="mt-3 grid gap-2">
                  {confirmationData?.unlockedSignals?.map((signal) => (
                    <div key={signal} className="flex items-start gap-2.5 rounded-[14px] bg-white p-3 shadow-[0_1px_2px_rgba(9,9,11,0.04)]">
                      <span className="mt-0.5 shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-600">
                        Sinal
                      </span>
                      <p className="text-xs leading-[1.55] text-zinc-700">{signal}</p>
                    </div>
                  ))}
                  {confirmationData?.opportunities?.map((opp) => (
                    <div key={opp} className="flex items-start gap-2.5 rounded-[14px] bg-white p-3 shadow-[0_1px_2px_rgba(9,9,11,0.04)]">
                      <span className="mt-0.5 shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                        Sinal novo
                      </span>
                      <p className="text-xs leading-[1.55] text-zinc-700">{opp}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.5rem] bg-[#f7f7f4] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Próximo passo</p>
                <p className="mt-2 text-xs leading-[1.6] text-zinc-600">
                  Veja seu perfil para encontrar a leitura do seu momento dividida em capítulos.
                </p>
              </div>
            )}

            {confirmationQuestion ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-[#f7f7f4] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Uma pergunta sobre esta leitura</p>
                <p className="mt-2 text-sm font-semibold text-zinc-800">{confirmationQuestion.question}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {confirmationQuestion.options.map((option) => {
                    const optionValue = option.value ?? option.label;
                    const isSelected = confirmationAnswer === optionValue;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={
                          isSelected
                            ? "rounded-full bg-zinc-950 px-3 py-2 text-xs font-semibold text-white"
                            : "rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
                        }
                        onClick={() => {
                          setConfirmationAnswer(optionValue);
                          if (savedDiagnosisId && onSubmitConfirmationAnswer && confirmationQuestion) {
                            onSubmitConfirmationAnswer({
                              diagnosisId: savedDiagnosisId,
                              answer: {
                                questionId: confirmationQuestion.id,
                                questionText: confirmationQuestion.question,
                                answerId: option.id,
                                answerValue: optionValue,
                              },
                            }).catch(() => {});
                          }
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Publish intent — integrado na confirmação, fire-and-forget */}
            <div className="mt-4 rounded-2xl border border-zinc-100 bg-[#f7f7f4] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vai publicar este vídeo?</p>
              <p className="mt-0.5 text-xs text-zinc-400">Só os vídeos publicados entram no seu mapa narrativo.</p>
              <div className="mt-3 flex gap-2">
                {(
                  [
                    { intent: "yes", label: "Sim" },
                    { intent: "no", label: "Não" },
                  ] as const
                ).map(({ intent, label }) => {
                  const isSelected = publishIntent === intent;
                  return (
                    <button
                      key={intent}
                      type="button"
                      className={`flex-1 rounded-full border px-2 py-2 text-xs font-semibold transition-all duration-150 ${
                        isSelected
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-white text-zinc-700"
                      }`}
                      onClick={() => {
                        setPublishIntent(intent);
                        if (savedDiagnosisId && onPublishIntentSubmit) {
                          onPublishIntentSubmit(savedDiagnosisId, intent).catch(() => {});
                        }
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
        </div>

        <div className="mt-5 flex gap-2">
        {step === "confirmation" ? (
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
              onClick={complete}
            >
              Ver leitura no Perfil
            </button>
            {completionSecondaryAction === "upgrade" ? (
              <button
                type="button"
                className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
                onClick={() => { complete(); onCompletionUpgrade?.(); }}
              >
                Continuar com Pro
              </button>
            ) : null}
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
            Continuar
          </button>
        )}
        </div>
      </section>
    </div>
  );
}
