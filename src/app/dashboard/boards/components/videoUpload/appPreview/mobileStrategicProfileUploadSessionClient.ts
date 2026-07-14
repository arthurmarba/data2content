export type UploadSessionPayload = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  userConsentAccepted: boolean;
  consentTextVersion: string;
  source: "mobile_strategic_profile";
};

export type UploadSessionResponse = {
  ok: boolean;
  status: "mock_session_created" | "signed_upload_session_created" | "disabled" | string;
  uploadSession?: {
    id: string;
    providerMode: string;
    storageProvider: string;
    uploadUrl?: string;
    method?: "PUT";
    headers?: Record<string, string>;
    expiresAt: string;
    signedUrlTtlSeconds?: number;
    retentionTtlMinutes: number;
    objectKey?: string;
    shouldDeleteAfterAnalysis: boolean;
    shouldPersistVideo: boolean;
    shouldPersistThumbnail: boolean;
  };
  issues?: Array<{ code: string; message: string; severity: string }>;
  message?: string;
};

export function buildUploadSessionPayloadFromFile(
  file: Pick<File, "name" | "type" | "size">,
  userConsentAccepted: boolean,
  durationSeconds: number | null = null,
): UploadSessionPayload {
  return {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    durationSeconds,
    userConsentAccepted,
    consentTextVersion: "video_narrative_upload_consent_v1",
    source: "mobile_strategic_profile",
  };
}

export async function requestUploadSession(
  payload: UploadSessionPayload
): Promise<UploadSessionResponse> {
  try {
    const response = await fetch(
      "/api/dashboard/mobile-strategic-profile/upload-session",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          sizeBytes: payload.sizeBytes,
          durationSeconds: payload.durationSeconds,
          userConsentAccepted: payload.userConsentAccepted,
          consentTextVersion: payload.consentTextVersion,
          source: payload.source,
        }),
      }
    );

    const data = typeof response.json === "function" ? await response.json().catch(() => null) : null;

    if (response.status === 401) {
      return {
        ok: false,
        status: "disabled",
        message: "Sessão não identificada. Por favor, faça login novamente.",
      };
    }

    if (!response.ok) {
      const issues = Array.isArray(data?.issues) ? data.issues : [];
      const blockerIssue = issues.find(
        (issue: { message?: unknown; severity?: unknown }) => issue.severity === "blocker" && typeof issue.message === "string",
      );
      const blockerMessage = typeof blockerIssue?.message === "string" ? blockerIssue.message : null;

      // 403 sem "blocker" = infra/flag de upload indisponível (não é algo que o
      // criador resolve). Não vaza a mensagem técnica do servidor ("Acesso
      // proibido: API ... desativada") — entrega um aviso calmo e acionável.
      if (response.status === 403 && !blockerMessage) {
        return {
          ok: false,
          status: typeof data?.status === "string" ? data.status : "disabled",
          issues,
          message: "O envio de vídeos está indisponível no momento. Tente novamente em instantes.",
        };
      }

      return {
        ok: false,
        status: typeof data?.status === "string" ? data.status : "disabled",
        issues,
        message:
          blockerMessage ||
          (typeof data?.message === "string" && data.message) ||
          "Não foi possível validar o vídeo agora.",
      };
    }

    return data;
  } catch {
    return {
      ok: false,
      status: "disabled",
      message: "Não foi possível validar o vídeo agora.",
    };
  }
}
