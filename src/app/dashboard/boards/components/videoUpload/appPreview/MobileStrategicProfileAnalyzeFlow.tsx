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
  "processing",
  "confirmation",
] as const;

// Steps visíveis ao criador no contador — processing é automático, não conta.
// A pergunta-lente deixou de ser um passo: o modal tem função única ("vale postar?"),
// então o contexto do criador virou um campo opcional dentro do próprio upload.
const VISIBLE_STEPS = ["upload", "confirmation"] as const;

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

export type NarrativeCoherenceVerdict =
  | "confirms_top_pattern"
  | "experiment"
  | "deviation"
  | "first_reading"
  | "unknown";

/** Verdict for the non-narrative axes (audiência, marca) of the "vale postar?" screen. */
export type AxisVerdict = "aligned" | "tension" | "off" | "unknown";

export type AxisCoherence = {
  verdict: AxisVerdict;
  reading: string | null;
};

export type MobileStrategicProfileAnalyzeConfirmationData = {
  diagnosisSummary?: string | null;
  unlockedSignals?: string[];
  opportunities?: string[];
  /** Direct, observational answer to the creator's question for this upload. */
  directAnswer?: string | null;
  /** Coherence verdict of this video against the creator's established pattern (eixo narrativa). */
  coherenceVerdict?: NarrativeCoherenceVerdict | null;
  coherenceReasoning?: string | null;
  /** Does this video speak to who watches the creator? (eixo audiência) */
  audienceCoherence?: AxisCoherence | null;
  /** Does this video open/sustain a coherent commercial territory? (eixo marca) */
  brandCoherence?: AxisCoherence | null;
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

// Ordem em gradiente: do mais íntimo (narrativa/ponto de vista) ao mais externo
// (território/formato). O default (authority) permanece em primeiro.
const goalOptions = [
  {
    label: "Entender minha narrativa",
    value: "authority" as const,
    defaultQuestion: "O que esse vídeo revela sobre minha narrativa?",
  },
  {
    label: "Fortalecer meu ponto de vista",
    value: "authority_build" as const,
    defaultQuestion: "Como esse vídeo reforça o meu ponto de vista?",
  },
  {
    label: "Checar coerência com o meu mapa",
    value: "retention" as const,
    defaultQuestion: "Esse vídeo é coerente com o que venho construindo?",
  },
  {
    label: "Explorar um território novo",
    value: "sponsored_content" as const,
    defaultQuestion: "Que território de conteúdo esse vídeo abre para mim?",
  },
  {
    label: "Testar um formato diferente",
    value: "format_test" as const,
    defaultQuestion: "Esse formato vale repetir no meu Perfil?",
  },
];


// Friendly, calm reading of the coherence verdict — shown right before the publish
// decision so it becomes an informed choice, not a blind data-collection checkbox.
const COHERENCE_VERDICT_LABEL: Record<NarrativeCoherenceVerdict, string | null> = {
  confirms_top_pattern: "Esse vídeo confirma seu padrão principal.",
  experiment: "Esse vídeo é um experimento dentro da sua identidade.",
  deviation: "Esse vídeo desvia do seu padrão atual.",
  first_reading: "Primeira leitura — seu padrão ainda está se formando.",
  unknown: null,
};

// Cor do marcador do veredito — informa o tipo de coerência sem precisar de caixa.
const COHERENCE_VERDICT_DOT: Record<NarrativeCoherenceVerdict, string> = {
  confirms_top_pattern: "bg-emerald-500",
  experiment: "bg-sky-500",
  deviation: "bg-amber-500",
  first_reading: "bg-zinc-400",
  unknown: "bg-zinc-300",
};

// ─── Veredito de 3 eixos ("vale postar?") ────────────────────────────────────
// Eixos não-narrativos (audiência, marca). "off" é observação calma — um sinal, não
// reprovação — por isso rose-400 (suave), nunca vermelho de erro.
const AXIS_DOT: Record<AxisVerdict, string> = {
  aligned: "bg-emerald-500",
  tension: "bg-amber-500",
  off: "bg-rose-400",
  unknown: "bg-zinc-300",
};

// Leitura de fallback quando a IA não devolve uma frase para o eixo.
const AXIS_VERDICT_FALLBACK: Record<AxisVerdict, string> = {
  aligned: "Conversa com este eixo.",
  tension: "Conversa em parte, com uma ressalva.",
  off: "Ainda não conversa com este eixo.",
  unknown: "Sem base suficiente para avaliar ainda.",
};

// Mapeia o veredito narrativo (enum próprio, mais rico) para a cor de marcador do
// eixo narrativa, reaproveitando as cores do padrão de coerência já existente.
const NARRATIVE_AXIS_DOT: Record<NarrativeCoherenceVerdict, string> = COHERENCE_VERDICT_DOT;

type VerdictAxis = { key: string; label: string; dot: string; reading: string };

// Monta as 3 linhas do veredito a partir do confirmationData. Sempre retorna as 3
// (audiência/marca degradam para "unknown" quando a IA não avaliou), para o criador
// ler as três lentes que pesam antes de postar: narrativa, audiência e marca.
function buildVerdictAxes(data: MobileStrategicProfileAnalyzeConfirmationData | null): VerdictAxis[] {
  const axes: VerdictAxis[] = [];

  const nv = data?.coherenceVerdict ?? null;
  const narrativeReading =
    (data?.coherenceReasoning?.trim() || (nv ? COHERENCE_VERDICT_LABEL[nv] : null)) ??
    "Sem base suficiente para avaliar ainda.";
  axes.push({
    key: "narrativa",
    label: "Narrativa",
    dot: nv ? NARRATIVE_AXIS_DOT[nv] : "bg-zinc-300",
    reading: narrativeReading,
  });

  const audience = data?.audienceCoherence ?? null;
  axes.push({
    key: "audiencia",
    label: "Audiência",
    dot: AXIS_DOT[audience?.verdict ?? "unknown"],
    reading: audience?.reading?.trim() || AXIS_VERDICT_FALLBACK[audience?.verdict ?? "unknown"],
  });

  const brand = data?.brandCoherence ?? null;
  axes.push({
    key: "marca",
    label: "Marca",
    dot: AXIS_DOT[brand?.verdict ?? "unknown"],
    reading: brand?.reading?.trim() || AXIS_VERDICT_FALLBACK[brand?.verdict ?? "unknown"],
  });

  return axes;
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
  onPublishIntentSubmit,
  completionSecondaryAction = "another_video",
  onCompletionUpgrade,
  readingsSummary,
}: MobileStrategicProfileAnalyzeFlowProps) {
  const [step, setStep] = useState<AnalyzeFlowStep>("upload");
  const [publishIntent, setPublishIntent] = useState<"yes" | "no" | null>(null);
  // Lente fixa do modal: "checar coerência com o meu mapa" (retention). O criador não
  // escolhe mais a lente — a pergunta é sempre "vale postar?". O campo opcional de
  // contexto refina a pergunta específica, sem trocar a lente.
  const [selectedOption, setSelectedOption] = useState<"authority" | "authority_build" | "retention" | "format_test" | "sponsored_content">("retention");
  const [creatorGoal, setCreatorGoal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // When the backend marks a failure as non-retryable (provider access/config),
  // we drop the "Tentar novamente" CTA instead of inviting a doomed retry.
  const [errorRetryable, setErrorRetryable] = useState(true);
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
      setSelectedOption("retention");
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
            setErrorRetryable(err?.retryable !== false);
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
          setStep("processing");
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
          setStep("processing");
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
    setSelectedOption("retention");
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
    setSelectedOption("retention");
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
              ? "Traga o vídeo que está na dúvida"
              : step === "processing"
                ? "Lendo seu vídeo"
                : "Vale postar?"}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Fechar fluxo de análise"
          className="-m-1.5 grid h-11 w-11 place-items-center rounded-full text-zinc-500 transition-colors disabled:opacity-50"
          onClick={close}
          disabled={isSubmitting}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </span>
        </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1" aria-hidden="true">
          {VISIBLE_STEPS.map((item, index) => {
            const vIdx = visibleStepIndex(step);
            // Durante o processing (entre os dois passos visíveis), mantém só o
            // primeiro preenchido; na confirmação, ambos.
            const filled = step === "processing" ? index === 0 : index <= vIdx;
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
                  // Número discreto, sem pip-meter de cota — informa sem comunicar escassez.
                  <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#f7f7f4] px-3.5 py-3">
                    <span className="text-xs font-semibold text-zinc-700">Leituras este mês</span>
                    <span className="text-xs font-medium text-zinc-500">
                      {readingsSummary.used} de {readingsSummary.limit}
                    </span>
                  </div>
                ) : (
                  <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-[#f7f7f4] px-3.5 py-3">
                    <span className="shrink-0 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Grátis
                    </span>
                    <span className="text-xs font-medium text-zinc-600">
                      {readingsSummary.used < readingsSummary.limit
                        ? "Sua primeira leitura é por nossa conta."
                        : "Você já usou sua leitura grátis."}
                    </span>
                  </div>
                )
              ) : null}
              <p className="text-sm leading-6 text-zinc-600 mb-4">
                Escolha um post recente, um conteúdo de que você se orgulha ou uma ideia que quer ver refletida.
              </p>

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

              {/* Contexto opcional — substitui o antigo passo de "lente". Uma linha, sem
                  pressão; refina a pergunta que a leitura responde, sem trocar a função
                  única do modal ("vale postar?"). */}
              {selectedFile ? (
                <div className="mt-4">
                  <label htmlFor="video-context-input" className="text-xs text-zinc-400">
                    Quer me contar algo sobre esse vídeo? (opcional)
                  </label>
                  <input
                    id="video-context-input"
                    type="text"
                    value={creatorGoal}
                    onChange={(event) => setCreatorGoal(event.target.value)}
                    placeholder="Ex: gravei no impulso e fiquei na dúvida se posto."
                    className="mt-1.5 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
                  />
                </div>
              ) : null}

              {validationStatus === "validating" ? (
                <p className="mt-3 text-xs font-medium text-sky-600">
                  Acolhendo seu vídeo...
                </p>
              ) : null}

              {validationStatus === "uploading" ? (
                <p className="mt-3 text-xs font-medium text-sky-600">
                  Conectando ao seu mapa...
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
                Prossiga para a leitura e descubra se vale postar.
              </p>
            </div>
          )
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
                <div className="grid gap-3">
                  {(
                    [
                      { label: "Estudando sua voz", threshold: 0 },
                      { label: "Percebendo seus padrões", threshold: 1 },
                      { label: "Atualizando seu mapa", threshold: 2 },
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
            {/* Leitura plana: seções separadas por hairline + hierarquia de fonte,
                sem card-dentro-de-card. O único elemento "contido" é o botão. */}

            {/* Hero — a resposta à pergunta do criador, o maior peso visual da tela. */}
            {confirmationData?.directAnswer ? (
              <div>
                <p className="text-xs leading-snug text-zinc-400">
                  {creatorGoal.trim() || "Sua pergunta"}
                </p>
                <p className="mt-1.5 text-lg font-medium leading-snug text-zinc-900">
                  {confirmationData.directAnswer}
                </p>
              </div>
            ) : null}

            {/* Veredito de coerência — as 3 lentes que pesam antes de postar.
                Linhas com marcador, sem caixa, sem nota. "off" é observação, não reprovação. */}
            <div className={confirmationData?.directAnswer ? "mt-5 border-t border-zinc-100 pt-5" : ""}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Coerência com o seu mapa</p>
              <div className="mt-3 flex flex-col gap-3">
                {buildVerdictAxes(confirmationData ?? null).map((axis) => (
                  <div key={axis.key} className="flex items-start gap-2.5">
                    <span className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${axis.dot}`} />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{axis.label}</p>
                      <p className="mt-0.5 text-sm leading-6 text-zinc-600">{axis.reading}</p>
                    </div>
                  </div>
                ))}
              </div>
              {confirmationData?.diagnosisSummary ? (
                <p className="mt-3.5 text-xs leading-5 text-zinc-400">{confirmationData.diagnosisSummary}</p>
              ) : null}
            </div>

            {/* A decisão — o fecho natural do veredito. A leitura é da IA; a escolha é do criador. */}
            <div className="mt-5 border-t border-zinc-100 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Você decide</p>
              <p className="mt-0.5 text-xs text-zinc-400">A leitura é minha; a decisão é sua. Só o que você publica entra no seu mapa.</p>
              <div className="mt-3 flex gap-2">
                {(
                  [
                    { intent: "yes", label: "Vou postar" },
                    { intent: "no", label: "Não vou" },
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
              {publishIntent === "yes" ? (
                <p className="mt-2.5 text-xs leading-5 text-emerald-700">Boa — seu mapa vai aprender com esse vídeo.</p>
              ) : publishIntent === "no" ? (
                <p className="mt-2.5 text-xs leading-5 text-zinc-500">Fechado. Esse fica só entre nós — não entra no mapa.</p>
              ) : null}
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
              Ver sua leitura completa
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
          errorRetryable ? (
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
                  setErrorRetryable(true);
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
              className="w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
              onClick={close}
            >
              Fechar
            </button>
          )
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
