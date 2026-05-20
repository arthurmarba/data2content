export type VideoNarrativeTemporaryStorageRuntimeResolverStatus =
  | "ready"
  | "missing_storage_adapter"
  | "missing_signed_download"
  | "provider_not_configured"
  | "unsupported_provider";

export type VideoNarrativeTemporaryStorageRuntimeResolverIssue = {
  code: string;
  message: string;
};

export type VideoNarrativeTemporaryStorageRuntimeResolverResult = {
  ok: boolean;
  status: VideoNarrativeTemporaryStorageRuntimeResolverStatus;
  safeMessage: string;
  issues: VideoNarrativeTemporaryStorageRuntimeResolverIssue[];
};

export type VideoNarrativeTemporaryStorageRuntimeResolverInput = {
  uploadSessionId?: string | null;
  objectKey?: string | null;
  mimeType?: string | null;
};

export function resolveVideoNarrativeTemporaryStorageObject(
  input: VideoNarrativeTemporaryStorageRuntimeResolverInput,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): VideoNarrativeTemporaryStorageRuntimeResolverResult {
  const provider = env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER;

  if (!provider || provider === "disabled" || provider === "none" || provider === "local_mock") {
    return {
      ok: false,
      status: "provider_not_configured",
      safeMessage: "A análise real ainda precisa da conexão temporária de storage para ler o vídeo.",
      issues: [
        {
          code: "provider_disabled",
          message: "O serviço de storage temporário não está configurado."
        }
      ]
    };
  }

  if (!["cloudflare_r2", "r2", "aws_s3", "s3"].includes(provider)) {
    return {
      ok: false,
      status: "unsupported_provider",
      safeMessage: "A análise real ainda precisa da conexão temporária de storage para ler o vídeo.",
      issues: [
        {
          code: "unsupported_provider",
          message: `Provider ${provider} not fully implemented.`
        }
      ]
    };
  }

  const bucket = env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET;
  const accessKeyId = env.VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = env.VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return {
      ok: false,
      status: "provider_not_configured",
      safeMessage: "O serviço de storage temporário não está configurado.",
      issues: [
        {
          code: "missing_credentials",
          message: "Storage credentials missing."
        }
      ]
    };
  }

  if (!input.objectKey) {
    return {
      ok: false,
      status: "missing_storage_adapter",
      safeMessage: "Referência de vídeo ausente.",
      issues: [
        {
          code: "empty_object_key",
          message: "Object key is empty."
        }
      ]
    };
  }

  return {
    ok: true,
    status: "ready",
    safeMessage: "Ready",
    issues: []
  };
}
