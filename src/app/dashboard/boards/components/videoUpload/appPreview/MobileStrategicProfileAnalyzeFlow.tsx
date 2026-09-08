import { fetchVideoRequest } from "./videoUploadRequest";
import { findPendingVideoAnalysis } from "./mobileStrategicProfileAnalysisSubmitClient";
import { useState, useEffect, useRef } from "react";
import { LayoutGroup } from "framer-motion";
import {
  buildUploadSessionPayloadFromFile,
  type UploadSessionPayload,
  type UploadSessionResponse,
} from "./mobileStrategicProfileUploadSessionClient";
import type {
  MobileStrategicProfileDirectUploadInput,
  MobileStrategicProfileDirectUploadResult,
} from "./mobileStrategicProfileDirectUploadClient";
import type { VideoNarrativeContentPotentialScan } from "@/app/dashboard/boards/videoUpload/videoNarrativeContentPotentialScan";
import { ContentAnalysisReport } from "./ContentAnalysisReport";
import { AnalysisProcessingExperience } from "./AnalysisProcessingExperience";
import type { HookRecommendation } from "@/app/dashboard/boards/videoUpload/hookRecommendation";
import type { HookRecommendationInteraction } from "./HookRecommendationCard";
import type { ScriptAdjustmentRecommendation } from "@/app/dashboard/boards/videoUpload/scriptAdjustmentRecommendation";
import type { ScriptAdjustmentInteraction } from "./ScriptAdjustmentCard";

const STEPS = [
  "upload",
  "processing",
  "confirmation",
] as const;

// Steps visíveis ao criador no contador — processing é automático, não conta.
// O relatório tem uma única lente editorial: estimar o potencial de engajamento
// deste vídeo em relação à estrutura observada e ao histórico do próprio criador.
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

/** Verdict legado dos eixos não narrativos, mantido apenas por compatibilidade de leitura. */
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
  contentPotentialScan?: import("@/app/dashboard/boards/videoUpload/videoNarrativeContentPotentialScan").VideoNarrativeContentPotentialScan | null;
  hookRecommendation?: HookRecommendation | null;
  scriptAdjustmentRecommendation?: ScriptAdjustmentRecommendation | null;
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
};

type MobileStrategicProfileAnalyzeFlowProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (result?: MobileStrategicProfileAnalyzeFlowCompleteResult) => void;
  completionSecondaryAction?: "another_video" | "upgrade";
  onCompletionUpgrade?: () => void;
  onSubmitAnalysis?: (payload: {
    recoveryJobId?: string;
    signal?: AbortSignal;
    onProgress?: (stage: string) => void;
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
      durationSeconds?: number;
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
  /** Telemetria sem conteúdo: somente a ação realizada no relatório. */
  onReportInteraction?: (
    event: "copy_suggestion" | HookRecommendationInteraction | ScriptAdjustmentInteraction,
    actionType?: string,
  ) => void;
  /** Persists the chosen suggestion without sending its text back from the client. */
  onSelectHookRecommendation?: (payload: {
    diagnosisId: string;
    candidateId: string;
  }) => Promise<void>;
  /** Persists only step IDs that belong to the saved recommendation. */
  onSelectScriptAdjustment?: (payload: {
    diagnosisId: string;
    selectedStepIds: string[];
  }) => Promise<void>;
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
  /** Capa controlada usada apenas por previews internos sem upload real. */
  initialThumbnailSrc?: string | null;
};

function nextStep(current: AnalyzeFlowStep): AnalyzeFlowStep {
  const index = STEPS.indexOf(current);
  return STEPS[Math.min(index + 1, STEPS.length - 1)] ?? "confirmation";
}

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
        // A capa é o único derivado visual persistido. Mantemos uma versão pequena
        // (sem áudio ou frames adicionais) para caber no limite privado de 120 KB.
        const maxW = 320;
        const maxH = 480;
        const scale = Math.min(
          1,
          maxW / (video.videoWidth || maxW),
          maxH / (video.videoHeight || maxH),
        );
        canvas.width = Math.round((video.videoWidth || 480) * scale);
        canvas.height = Math.round((video.videoHeight || 270) * scale);
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const qualities = [0.68, 0.56, 0.44];
        let thumbnail = canvas.toDataURL("image/jpeg", qualities[0]);
        for (const quality of qualities.slice(1)) {
          if (thumbnail.length <= 150_000) break;
          thumbnail = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(thumbnail);
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

// Só analisamos microconteúdo de até 90 segundos. Medimos a duração no próprio
// navegador (metadata) para recusar vídeos longos ANTES de gastar o upload.
const MAX_VIDEO_DURATION_SECONDS = 90;
const MAX_VIDEO_FILE_SIZE_BYTES = 300 * 1024 * 1024;
const DURATION_TOO_LONG_MESSAGE =
  "Analisamos conteúdos de até 90 segundos. Escolha um vídeo mais curto.";

async function extractVideoDurationSeconds(file: File): Promise<number | null> {
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
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.addEventListener("loadedmetadata", () => {
      finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
    });
    video.addEventListener("error", () => finish(null));
    // Fallback se loadedmetadata nunca disparar
    setTimeout(() => finish(null), 8000);
    video.src = url;
  });
}

function getUploadSessionErrorMessage(response?: UploadSessionResponse) {
  const blockerCode = response?.issues?.find((issue) => issue.severity === "blocker")?.code;

  if (blockerCode === "invalid_mime_type" || blockerCode === "invalid_extension") {
    return "Formato não aceito. Escolha um vídeo MP4, MOV ou WEBM.";
  }

  if (blockerCode === "file_too_large") {
    return "Arquivo muito grande. Escolha um vídeo de até 300 MB.";
  }

  if (blockerCode === "duration_too_long") {
    return DURATION_TOO_LONG_MESSAGE;
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
  enableRealAnalysis = false,
  onCleanupTemporaryUpload,
  onReportInteraction,
  onSelectHookRecommendation,
  onSelectScriptAdjustment,
  completionSecondaryAction = "another_video",
  onCompletionUpgrade,
  initialThumbnailSrc = null,
}: MobileStrategicProfileAnalyzeFlowProps) {
  const closeRef = useRef<() => void>(() => undefined);
  const selectionRef = useRef(0);
  const transferRef = useRef<AbortController | null>(null);
  const cleanupRef = useRef<{ uploadSessionId: string; objectKey?: string } | null>(null);
  const [metadataPending, setMetadataPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recoveryJobId, setRecoveryJobId] = useState<string | null>(null);
  const [checkingRecovery, setCheckingRecovery] = useState(enableRealAnalysis);
  const [analysisStage, setAnalysisStage] = useState("queued");
  const sheetRef = useRef<HTMLElement | null>(null);
  const scriptSelectionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [step, setStep] = useState<AnalyzeFlowStep>("upload");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // When the backend marks a failure as non-retryable (provider access/config),
  // we drop the "Tentar novamente" CTA instead of inviting a doomed retry.
  const [errorRetryable, setErrorRetryable] = useState(true);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const [savedDiagnosisId, setSavedDiagnosisId] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] = useState<MobileStrategicProfileAnalyzeConfirmationData | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(initialThumbnailSrc);
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
    durationSeconds?: number;
    uploadedAt?: string;
  } | null>(null);

  const requestTemporaryUploadCleanup = (
    reason: "analysis_completed" | "analysis_failed" | "user_cancelled" | "expired",
  ) => {
    const cleanup = cleanupRef.current ?? temporaryUploadForCleanup;
    if (!cleanup || !onCleanupTemporaryUpload) return;
    onCleanupTemporaryUpload({
      ...cleanup,
      reason,
    }).catch(() => {
      console.warn("Cleanup temporário não foi confirmado.");
    });
  };

  useEffect(() => {
    if (!open || !enableRealAnalysis) return;
    const controller = new AbortController();
    setCheckingRecovery(true);
    findPendingVideoAnalysis(controller.signal).then(job => {
      if (controller.signal.aborted) return;
      if (job) { setRecoveryJobId(job.jobId); setStep("processing"); }
    }).catch(() => {
      if (!controller.signal.aborted) setFileValidationError("Não foi possível consultar análises em andamento. Feche e abra novamente antes de enviar.");
    }).finally(() => { if (!controller.signal.aborted) setCheckingRecovery(false); });
    return () => { controller.abort(); transferRef.current?.abort(); selectionRef.current++; };
  }, [open, enableRealAnalysis]);

  useEffect(() => {
    if (step !== "confirmation") return;
    const jobId = recoveryJobId ?? temporaryUploadForAnalysis?.uploadSessionId;
    if (enableRealAnalysis && jobId) void fetchVideoRequest("/api/dashboard/mobile-strategic-profile/analyze-real", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acknowledge: true, jobId }) }).catch(() => undefined);
  }, [step, enableRealAnalysis, recoveryJobId, temporaryUploadForAnalysis?.uploadSessionId]);

  useEffect(() => {
    if (!open) {
      setStep("upload");
      setErrorMsg(null);
      setIsSubmitting(false);
      setSelectedFile(null);
      setVideoDurationSeconds(null);
      setThumbnailDataUrl(initialThumbnailSrc);
      setValidationStatus("idle");
      setFileValidationError(null);
      setUploadSessionValidated(false);
      setTemporaryUploadForCleanup(null);
      setTemporaryUploadForAnalysis(null);
      setProcessingComplete(false);
      setConfirmationData(null);
    }
  }, [initialThumbnailSrc, open]);

  useEffect(() => {
    if (open && sheetRef.current) sheetRef.current.scrollTop = 0;
  }, [open, step]);

  useEffect(() => {
    if (step === "processing" && !errorMsg) setProcessingComplete(false);
  }, [step, submitAttempt, errorMsg]);

  useEffect(() => {
    if (step !== "processing") return;
    const controller = new AbortController();

    let active = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    async function triggerSubmit() {
      if (onSubmitAnalysis) {
        if (enableRealAnalysis && !recoveryJobId && !temporaryUploadForAnalysis?.uploadSessionId) {
          setIsSubmitting(false);
          setErrorMsg("Não conseguimos confirmar o envio do vídeo. Volte e envie novamente.");
          return;
        }
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
          const result = await onSubmitAnalysis({
            recoveryJobId: recoveryJobId ?? undefined,
            signal: controller.signal,
            onProgress: setAnalysisStage,
            creatorGoal: "Este conteúdo tem potencial de engajar com base no meu histórico?",
            selectedGoalOption: "retention",
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
            setProcessingComplete(true);
            await new Promise((resolve) => setTimeout(resolve, 560));
            if (!active) return;
            setIsSubmitting(false);
            setStep("confirmation");
          }
        } catch (err: any) {
          if (!active) return;
          if (!enableRealAnalysis && temporaryUploadForCleanup && onCleanupTemporaryUpload) {
            try {
              await onCleanupTemporaryUpload({
                ...temporaryUploadForCleanup,
                reason: "analysis_failed",
              });
            } catch {
              console.warn("Cleanup temporário não foi confirmado após falha da análise.");
            }
          }
          if (active) {
            setProcessingComplete(false);
            setIsSubmitting(false);
            setErrorRetryable(err?.retryable !== false);
            setErrorMsg(err.message || "Ocorreu um erro no processamento do diagnóstico.");
            setValidationStatus("idle");
            setUploadSessionValidated(false);

          }
        }
      } else {
        fallbackTimer = setTimeout(() => {
          if (active) {
            setProcessingComplete(true);
            fallbackTimer = setTimeout(() => {
              if (active) setStep("confirmation");
            }, 560);
          }
        }, 1000);
      }
    }

    triggerSubmit();

    return () => {
      active = false;
      controller.abort();
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [
    step,
    onSubmitAnalysis,
    submitAttempt,
    recoveryJobId,
    temporaryUploadForCleanup,
    onCleanupTemporaryUpload,
    temporaryUploadForAnalysis,
    enableRealAnalysis,
  ]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () => Array.from(sheet?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]):not([type="file"]), [tabindex="0"]') ?? []);
    items()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const nodes = items(), first = nodes[0], last = nodes[nodes.length - 1];
      if (!sheet?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [open]);

  if (!open) return null;

  const handleContinue = async () => {
    if (step === "upload" && onCreateUploadSession) {
      if (!selectedFile) {
        setFileValidationError("Selecione um arquivo de vídeo primeiro.");
        return;
      }
      if (selectedFile.size > MAX_VIDEO_FILE_SIZE_BYTES) {
        setValidationStatus("error");
        setFileValidationError("Arquivo muito grande. Escolha um vídeo de até 300 MB.");
        return;
      }
      // Barra vídeos longos antes de gastar o upload, usando a duração medida
      // na seleção (metadata carrega em milissegundos). Se ela não resolveu a
      // tempo (null), seguimos e deixamos o servidor aplicar o limite de 90s.
      if (videoDurationSeconds !== null && videoDurationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        setValidationStatus("error");
        setFileValidationError(
          `Este vídeo tem ${Math.round(videoDurationSeconds)}s. ${DURATION_TOO_LONG_MESSAGE}`,
        );
        return;
      }
      const controller = new AbortController();
      transferRef.current?.abort();
      transferRef.current = controller;
      setUploadProgress(0);
      setValidationStatus("validating");
      setFileValidationError(null);
      try {
        const res = await onCreateUploadSession(
          buildUploadSessionPayloadFromFile(selectedFile, true, videoDurationSeconds),
        );

        if (controller.signal.aborted) {
          if (res.uploadSession) await onCleanupTemporaryUpload?.({ uploadSessionId: res.uploadSession.id, objectKey: res.uploadSession.objectKey, reason: "user_cancelled" });
          return;
        }
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

          cleanupRef.current = { uploadSessionId: session.id, objectKey: session.objectKey };
          setTemporaryUploadForCleanup(cleanupRef.current);
          setValidationStatus("uploading");
          const uploadResult = await onUploadToTemporarySignedUrl({
            file: selectedFile,
            uploadUrl: session.uploadUrl,
            method: session.method,
            headers: session.headers,
            expiresAt: session.expiresAt,
            signal: controller.signal,
            onProgress: setUploadProgress,
          });

          if (controller.signal.aborted) {
            await onCleanupTemporaryUpload?.({ uploadSessionId: session.id, objectKey: session.objectKey, reason: "user_cancelled" });
            return;
          }
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
            mimeType: buildUploadSessionPayloadFromFile(selectedFile, true).mimeType,
            sizeBytes: selectedFile.size,
            ...(videoDurationSeconds !== null ? { durationSeconds: videoDurationSeconds } : {}),
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
        if (controller.signal.aborted) return;
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
    transferRef.current?.abort();
    selectionRef.current++;
    setMetadataPending(false);
    setRecoveryJobId(null);
    if (cleanupReason) {
      requestTemporaryUploadCleanup(cleanupReason);
    }
    cleanupRef.current = null;
    setStep("upload");
    setErrorMsg(null);
    setSelectedFile(null);
    setVideoDurationSeconds(null);
    setValidationStatus("idle");
    setFileValidationError(null);
    setUploadSessionValidated(false);
    setTemporaryUploadForCleanup(null);
    setTemporaryUploadForAnalysis(null);
    setThumbnailDataUrl(initialThumbnailSrc);
    setSavedDiagnosisId(null);
    setConfirmationData(null);
    setProcessingComplete(false);
  };

  const close = () => {
    const jobId = recoveryJobId ?? temporaryUploadForAnalysis?.uploadSessionId;
    if (errorMsg && jobId) void fetchVideoRequest("/api/dashboard/mobile-strategic-profile/analyze-real", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acknowledge: true, jobId }) }).catch(() => undefined);
    resetFlow("user_cancelled");
    onClose();
  };

  closeRef.current = close;

  const buildCompleteResult = (): MobileStrategicProfileAnalyzeFlowCompleteResult | undefined => {
    const thumb = thumbnailDataUrl;
    const diagId = savedDiagnosisId;
    return thumb || diagId
      ? { thumbnailDataUrl: thumb ?? undefined, savedDiagnosisId: diagId }
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

    selectionRef.current++;
    setRecoveryJobId(null);
    setMetadataPending(false);
    setStep("upload");
    setSelectedFile(null);
    setVideoDurationSeconds(null);
    setValidationStatus("idle");
    setFileValidationError(null);
    setUploadSessionValidated(false);
    setTemporaryUploadForCleanup(null);
    setTemporaryUploadForAnalysis(null);
    setSavedDiagnosisId(null);
    setConfirmationData(null);
    setProcessingComplete(false);
  };

  const copyPracticalSuggestion = async (scan: VideoNarrativeContentPotentialScan) => {
    const suggestion = scan.practicalDirection?.example?.trim()
      || scan.practicalDirection?.action?.trim()
      || scan.highestImpactAdjustment.trim();
    if (!suggestion) return;
    try {
      await navigator.clipboard?.writeText(suggestion);
    } catch {
      // A ação continua útil como confirmação visual mesmo quando o WebView bloqueia clipboard.
    }
    onReportInteraction?.("copy_suggestion", "practical_direction");
  };

  // Regra de disabled para o botão Continuar
  const isContinueDisabled =
    checkingRecovery || metadataPending || isSubmitting ||
    validationStatus === "validating" ||
    validationStatus === "uploading" ||
    (step === "upload" && Boolean(onCreateUploadSession) && !selectedFile) ||
    (step === "upload" &&
      onCreateUploadSession &&
      (validationStatus === "validated" || validationStatus === "uploaded"));

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center ds-scrim">
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-strategic-profile-analyze-flow-title"
        className="ds-sheet ds-enter-sheet max-h-[min(94dvh,800px)] p-5"
      >
        <div className="ds-sheet__handle !mt-[-0.5rem] mb-4" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
        <div>
          {step !== "processing" && (
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Etapa {visibleStepIndex(step) + 1} de {VISIBLE_STEPS.length}
            </p>
          )}
          <h2 id="mobile-strategic-profile-analyze-flow-title" className="mt-1 font-display text-[1.65rem] font-bold leading-[1.02] tracking-[-0.035em] text-zinc-950">
            {step === "upload"
              ? "Raio X do conteúdo"
              : step === "processing"
                ? "Escaneando seu vídeo"
                : "Seu Raio X"}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Fechar fluxo de análise"
          className="-m-1.5 grid h-11 w-11 place-items-center rounded-full text-zinc-500 transition-colors disabled:opacity-50"
          onClick={close}
          disabled={false}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </span>
        </button>
        </div>

        {step !== "processing" ? <div className="mt-4 grid grid-cols-2 gap-1" aria-hidden="true">
          {VISIBLE_STEPS.map((item, index) => {
            const vIdx = visibleStepIndex(step);
            const filled = index <= vIdx;
            return (
              <span key={item} className={filled ? "h-1.5 rounded-full bg-zinc-950" : "h-1.5 rounded-full bg-zinc-200"} />
            );
          })}
        </div> : null}

        <LayoutGroup id="content-analysis-flow">
        <div className="mt-4">

        {step === "upload" && checkingRecovery ? <p role="status">Consultando suas análises…</p> : null}
        {step === "upload" && validationStatus === "uploading" ? <p role="status">Enviando vídeo: {uploadProgress}%</p> : null}
        {step === "upload" && metadataPending ? <p role="status">Verificando o vídeo…</p> : null}

        {step === "upload" ? (
          onCreateUploadSession ? (
            <div>
              <input
                type="file"
                disabled={checkingRecovery || validationStatus === "uploading" || validationStatus === "validating"}
                accept="video/mp4,video/quicktime,video/webm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const selection = ++selectionRef.current;
                    setMetadataPending(true);
                    requestTemporaryUploadCleanup("user_cancelled");
                    setSelectedFile(file);
                    setValidationStatus("idle");
                    setFileValidationError(null);
                    setUploadSessionValidated(false);
                    setTemporaryUploadForCleanup(null);
                    setTemporaryUploadForAnalysis(null);
    setThumbnailDataUrl(initialThumbnailSrc);
                    setVideoDurationSeconds(null);
                    if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
                      setValidationStatus("error");
                      setFileValidationError("Arquivo muito grande. Escolha um vídeo de até 300 MB.");
                    }
                    extractVideoThumbnail(file).then((url) => {
                      if (selection === selectionRef.current && url) setThumbnailDataUrl(url);
                    });
                    extractVideoDurationSeconds(file).then((duration) => {
                      if (selection !== selectionRef.current) return;
                      setMetadataPending(false);
                      setVideoDurationSeconds(duration);
                      if (duration !== null && duration > MAX_VIDEO_DURATION_SECONDS) {
                        setValidationStatus("error");
                        setFileValidationError(
                          `Este vídeo tem ${Math.round(duration)}s. ${DURATION_TOO_LONG_MESSAGE}`,
                        );
                      }
                    });
                  }
                }}
                className="hidden"
                id="video-file-picker"
              />

              {!selectedFile ? (
                <label htmlFor="video-file-picker" className="ds-upload-dropzone hover:!border-zinc-950 hover:!bg-zinc-50">
                  <span>
                    <span className="ds-upload-dropzone__icon !bg-zinc-950 !shadow-none" aria-hidden="true">
                      <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
                        <path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="12" cy="12" r="2.25" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </span>
                    <span className="mt-4 block font-display text-[1.15rem] font-bold tracking-[-0.035em] text-zinc-950">Selecionar vídeo</span>
                    <span className="mt-1 block text-xs text-zinc-500">Até 90 segundos</span>
                  </span>
                </label>
              ) : (
                <label
                  htmlFor="video-file-picker"
                  aria-label="Trocar vídeo"
                  className="group relative block cursor-pointer overflow-hidden rounded-[1.5rem] bg-zinc-950 ds-enter-sheet"
                >
                  {thumbnailDataUrl ? (
                    <img
                      src={thumbnailDataUrl}
                      alt="Capa do vídeo selecionado"
                      className="w-full object-cover transition duration-300 group-active:scale-[0.99]"
                      style={{ aspectRatio: "9/12", maxHeight: 430 }}
                    />
                  ) : (
                    <span className="grid aspect-[9/12] max-h-[430px] place-items-center text-sm text-white/60">
                      Preparando capa...
                    </span>
                  )}
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition group-hover:bg-black/80">
                    Trocar vídeo
                  </span>
                </label>
              )}

              {validationStatus === "validating" ? (
                <p className="ds-upload-status mt-3">
                  Acolhendo seu vídeo...
                </p>
              ) : null}

              {validationStatus === "uploading" ? (
                <p className="ds-upload-status mt-3">
                  Conectando ao seu mapa...
                </p>
              ) : null}

              {fileValidationError ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-red-600">{fileValidationError}</p>
                  <button
                    type="button"
                    className="ds-inline-action shrink-0 !min-h-9 !px-3 !py-1.5"
                    onClick={() => {
                      selectionRef.current++;
                      setMetadataPending(false);
                      requestTemporaryUploadCleanup("user_cancelled");
                      setSelectedFile(null);
                      setVideoDurationSeconds(null);
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
            <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-[var(--ds-color-neutral)] p-4">
              <p className="text-sm font-semibold text-zinc-950">Vídeo acolhido e pronto</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Prossiga para comparar a estrutura deste vídeo com o seu histórico.
              </p>
            </div>
          )
        ) : null}

        {step === "processing" ? (
          <AnalysisProcessingExperience
            serverStage={enableRealAnalysis ? analysisStage : undefined}
            thumbnailSrc={thumbnailDataUrl}
            active={step === "processing" && !errorMsg}
            complete={processingComplete}
            resetKey={submitAttempt}
            errorMessage={errorMsg}
          />
        ) : null}

        {step === "confirmation" ? (
          <ContentAnalysisReport
            data={confirmationData}
            thumbnailSrc={thumbnailDataUrl}
            onCopySuggestion={copyPracticalSuggestion}
            onHookInteraction={(event, actionType) => onReportInteraction?.(event, actionType)}
            onHookCandidateChosen={(candidateId) => {
              if (!savedDiagnosisId) return;
              void onSelectHookRecommendation?.({ diagnosisId: savedDiagnosisId, candidateId })
                .catch(() => undefined);
            }}
            onScriptAdjustmentInteraction={(event, actionType) => onReportInteraction?.(event, actionType)}
            onScriptAdjustmentSelectionChange={(selectedStepIds) => {
              if (!savedDiagnosisId || !onSelectScriptAdjustment) return;
              scriptSelectionQueueRef.current = scriptSelectionQueueRef.current
                .catch(() => undefined)
                .then(() => onSelectScriptAdjustment({ diagnosisId: savedDiagnosisId, selectedStepIds }))
                .catch(() => undefined);
            }}
          />
        ) : null}

        </div>
        </LayoutGroup>

        <div className="mt-5 flex gap-2">
        {step === "confirmation" ? (
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              className="ds-button ds-button--primary ds-button--block !bg-zinc-950 !text-white !shadow-none hover:!bg-zinc-800"
              onClick={complete}
            >
              Concluir
            </button>
            {completionSecondaryAction === "upgrade" ? (
              <button
                type="button"
                className="ds-button ds-button--quiet ds-button--block"
                onClick={() => { complete(); onCompletionUpgrade?.(); }}
              >
                Continuar com Pro
              </button>
            ) : (
              <button
                type="button"
                className="ds-button ds-button--quiet ds-button--block"
                onClick={handleConfirmationSecondaryAction}
              >
                Analisar outro conteúdo
              </button>
            )}
          </div>
        ) : step === "processing" && errorMsg ? (
          errorRetryable ? (
            <div className="flex w-full gap-2">
              <button
                type="button"
                className="ds-button ds-button--quiet w-1/2"
                onClick={close}
              >
                Fechar
              </button>
              <button
                type="button"
                className="ds-button ds-button--primary w-1/2 !bg-zinc-950 !text-white !shadow-none hover:!bg-zinc-800"
                onClick={() => {
                  setErrorMsg(null);
                  setErrorRetryable(true);
                  if (enableRealAnalysis) {
                    setStep("upload");
                  } else {
                    setSubmitAttempt((prev) => prev + 1);
                    setStep("processing");
                  }
                }}
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="ds-button ds-button--primary ds-button--block !bg-zinc-950 !text-white !shadow-none hover:!bg-zinc-800"
              onClick={close}
            >
              Fechar
            </button>
          )
        ) : step === "processing" ? null : (
          <button
            type="button"
            className="ds-button ds-button--primary ds-button--block !bg-zinc-950 !text-white !shadow-none hover:!bg-zinc-800"
            onClick={handleContinue}
            disabled={isContinueDisabled}
          >
            {step === "upload" && onCreateUploadSession
              ? validationStatus === "validating" || validationStatus === "uploading"
                ? "Enviando..."
                : "Analisar conteúdo"
              : "Continuar"}
          </button>
        )}
        </div>
      </section>
    </div>
  );
}
