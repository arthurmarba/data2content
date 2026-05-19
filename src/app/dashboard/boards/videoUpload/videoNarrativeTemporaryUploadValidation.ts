import {
  VideoNarrativeTemporaryUploadPolicy,
  VideoNarrativeTemporaryUploadValidationInput,
  VideoNarrativeTemporaryUploadValidationResult,
  DEFAULT_TEMPORARY_UPLOAD_POLICY,
} from "./videoNarrativeTemporaryUploadContracts";

const RESTRICTED_EXTENSIONS = [
  ".exe", ".bat", ".sh", ".bin", ".cmd", ".msi", ".js", ".ts", ".vbs", ".scr", ".pif"
];

/**
 * Sanitiza o nome do arquivo para garantir compatibilidade com sistemas de arquivos comuns,
 * prevenindo injeções de caminhos ou caracteres maliciosos.
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return "unnamed_video.mp4";
  
  // Remove caracteres perigosos ou invasores
  let name = fileName.replace(/[\\/:*?"<>|]/g, "_");
  
  // Agrupa múltiplos pontos seguidos
  name = name.replace(/\.+/g, ".");
  
  // Converte múltiplos espaços em underscore
  name = name.replace(/\s+/g, "_");
  
  // Mantém apenas caracteres seguros de forma restrita
  name = name.replace(/[^a-zA-Z0-9.\-_]/g, "");
  
  return name || "video.mp4";
}

/**
 * Validador puro e seguro para entrada de mídias temporárias.
 */
export function validateTemporaryUploadInput(
  input: VideoNarrativeTemporaryUploadValidationInput,
  policy: VideoNarrativeTemporaryUploadPolicy = DEFAULT_TEMPORARY_UPLOAD_POLICY
): VideoNarrativeTemporaryUploadValidationResult {
  const issues: Array<{ code: string; message: string; severity: "blocker" | "warning" | "info" }> = [];

  // 1. Consentimento explícito do usuário
  if (policy.requireExplicitConsent && !input.userConsentAccepted) {
    issues.push({
      code: "consent_required",
      message: "O consentimento explícito para processamento temporário do vídeo é obrigatório.",
      severity: "blocker",
    });
  }

  // 2. Mime Type permitido
  if (!policy.acceptedMimeTypes.includes(input.mimeType)) {
    issues.push({
      code: "invalid_mime_type",
      message: `Mime type '${input.mimeType}' não é suportado pela política.`,
      severity: "blocker",
    });
  }

  // 3. Extensão do arquivo e disfarces
  const lowerFileName = input.fileName.toLowerCase();
  const extMatch = lowerFileName.match(/\.[a-z0-9]+$/);
  const extension = extMatch ? extMatch[0] : "";

  if (!policy.acceptedExtensions.includes(extension)) {
    issues.push({
      code: "invalid_extension",
      message: `Extensão de arquivo '${extension}' não é permitida.`,
      severity: "blocker",
    });
  }

  // Bloqueio de disfarces de executáveis ou arquivos nocivos
  for (const restricted of RESTRICTED_EXTENSIONS) {
    if (lowerFileName.includes(restricted)) {
      issues.push({
        code: "executable_disguise_blocked",
        message: "Assinatura ou extensão de arquivo executável bloqueada por motivos de segurança.",
        severity: "blocker",
      });
      break;
    }
  }

  // 4. Validação de tamanho (sizeBytes)
  if (input.sizeBytes <= 0) {
    issues.push({
      code: "empty_file",
      message: "O tamanho do arquivo deve ser maior que zero.",
      severity: "blocker",
    });
  } else if (input.sizeBytes > policy.maxFileSizeBytes) {
    issues.push({
      code: "file_too_large",
      message: `O arquivo excede o limite máximo permitido de ${policy.maxFileSizeBytes / (1024 * 1024)}MB.`,
      severity: "blocker",
    });
  }

  // 5. Validação de duração em segundos
  if (input.durationSeconds !== undefined) {
    if (input.durationSeconds <= 0) {
      issues.push({
        code: "invalid_duration",
        message: "A duração do vídeo deve ser maior que zero.",
        severity: "blocker",
      });
    } else if (input.durationSeconds > policy.maxDurationSeconds) {
      issues.push({
        code: "duration_too_long",
        message: `A duração do vídeo excede o limite de ${policy.maxDurationSeconds} segundos.`,
        severity: "blocker",
      });
    }
  }

  // 6. Bloqueios estritos contra Base64 e URLs externas nos metadados
  const base64Regex = /data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,/i;
  if (base64Regex.test(input.fileName) || input.fileName.toLowerCase().includes("base64")) {
    issues.push({
      code: "base64_filename_blocked",
      message: "Nome de arquivo em formato Base64 bloqueado por segurança.",
      severity: "blocker",
    });
  }

  const urlRegex = /^(https?:\/\/|ftp:\/\/|www\.)/i;
  if (urlRegex.test(input.fileName) || urlRegex.test(input.source)) {
    issues.push({
      code: "url_source_blocked",
      message: "URLs externas não são permitidas como nome de arquivo ou fonte primária.",
      severity: "blocker",
    });
  }

  const ok = issues.filter((i) => i.severity === "blocker").length === 0;

  return {
    ok,
    issues,
    safeForTemporaryUpload: ok,
    shouldPersistVideo: policy.allowRawVideoPersistence,
    shouldPersistThumbnail: policy.allowThumbnailPersistence,
    shouldDeleteAfterAnalysis: true, // Sempre deletar após análise para segurança absoluta
    normalizedMetadata: ok
      ? {
          fileName: sanitizeFileName(input.fileName),
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          durationSeconds: input.durationSeconds,
          sanitizedAt: new Date().toISOString(),
        }
      : undefined,
  };
}
