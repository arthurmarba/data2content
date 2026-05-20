export type UploadSessionPayload = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: null;
  userConsentAccepted: boolean;
  consentTextVersion: string;
  source: "mobile_strategic_profile";
};

export type UploadSessionResponse = {
  ok: boolean;
  status: string;
  uploadSession?: {
    id: string;
    providerMode: string;
    storageProvider: string;
    expiresAt: string;
    retentionTtlMinutes: number;
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
): UploadSessionPayload {
  return {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    durationSeconds: null,
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

    if (response.status === 401) {
      return {
        ok: false,
        status: "disabled",
        message: "Sessão não identificada. Por favor, faça login novamente.",
      };
    }

    if (response.status === 403) {
      return {
        ok: false,
        status: "disabled",
        message: "Acesso proibido. A API de sessão temporária de upload está inativa.",
      };
    }

    const data = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        status: "disabled",
        issues: data.issues || [],
        message: data.message || "Não foi possível validar o vídeo agora.",
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
