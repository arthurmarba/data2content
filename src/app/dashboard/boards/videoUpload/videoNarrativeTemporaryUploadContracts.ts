export type VideoNarrativeTemporaryUploadProviderMode =
  | "disabled"
  | "mock"
  | "planned"
  | "real";

export type VideoNarrativeTemporaryUploadStorageProvider =
  | "none"
  | "local_mock"
  | "s3"
  | "r2"
  | "gcs"
  | "cloudinary"
  | "unknown";

export type VideoNarrativeTemporaryUploadPolicy = {
  maxFileSizeBytes: number;
  maxDurationSeconds: number;
  acceptedMimeTypes: string[];
  acceptedExtensions: string[];
  retentionTtlMinutes: number;
  requireExplicitConsent: boolean;
  allowThumbnailPersistence: boolean;
  allowRawVideoPersistence: boolean;
  allowTranscriptPersistence: boolean;
  allowSignedUrlPersistence: boolean;
  allowPublicAccess: boolean;
  providerMode: VideoNarrativeTemporaryUploadProviderMode;
  storageProvider: VideoNarrativeTemporaryUploadStorageProvider;
};

export type VideoNarrativeTemporaryUploadValidationInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  userConsentAccepted: boolean;
  source: string;
  createdAt: string;
};

export type VideoNarrativeTemporaryUploadIssue = {
  code: string;
  message: string;
  severity: "blocker" | "warning" | "info";
};

export type VideoNarrativeTemporaryUploadValidationResult = {
  ok: boolean;
  issues: VideoNarrativeTemporaryUploadIssue[];
  normalizedMetadata?: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds?: number;
    sanitizedAt: string;
  };
  safeForTemporaryUpload: boolean;
  shouldPersistVideo: boolean;
  shouldPersistThumbnail: boolean;
  shouldDeleteAfterAnalysis: boolean;
};

/**
 * Política padrão inicial e segura (Default Policy).
 * Justificativas de Produto:
 * - maxFileSizeBytes (300MB): Cobre vídeos curtos em alta resolução (Reels/Shorts/TikToks
 *   gravados em 1080p/4K) sem exigir compressão prévia, evitando ainda assim o upload de
 *   arquivos brutos gigantescos de câmera que geram sobrecarga de rede e custos elevados.
 * - maxDurationSeconds (90 segundos): Limite real de análise da plataforma — só
 *   processamos microconteúdo de até 90s. Vídeos mais longos são recusados.
 * - acceptedMimeTypes: Cobre os codecs e empacotamentos mais comuns no ecossistema web/mobile.
 * - retentionTtlMinutes (60 minutos): Tempo curto que permite o processamento
 *   completo da IA mesmo em cenários de fila sem deixar arquivos acumulados permanentemente.
 * - allow*Persistence (false): O perfil é o único diagnóstico persistido; a mídia física é descartável.
 * - providerMode ("disabled") / storageProvider ("none"): Mantém o fluxo real desativado
 *   por default até a ativação explícita de feature flags.
 */
export const DEFAULT_TEMPORARY_UPLOAD_POLICY: VideoNarrativeTemporaryUploadPolicy = {
  maxFileSizeBytes: 300 * 1024 * 1024, // 300MB
  maxDurationSeconds: 90,              // limite real de análise da plataforma
  acceptedMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
  acceptedExtensions: [".mp4", ".mov", ".webm"],
  retentionTtlMinutes: 60,             // 1 hora
  requireExplicitConsent: true,
  allowThumbnailPersistence: false,
  allowRawVideoPersistence: false,
  allowTranscriptPersistence: false,
  allowSignedUrlPersistence: false,
  allowPublicAccess: false,
  providerMode: "disabled",
  storageProvider: "none",
};
