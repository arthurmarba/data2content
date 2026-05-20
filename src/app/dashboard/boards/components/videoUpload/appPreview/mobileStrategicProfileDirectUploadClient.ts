export type MobileStrategicProfileDirectUploadInput = {
  file: File;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

export type MobileStrategicProfileDirectUploadResult = {
  ok: boolean;
  status: "uploaded" | "failed" | "expired" | "invalid_signed_session";
  errorMessage?: string;
  uploadedAt?: string;
  bytesSent?: number;
};

const HUMAN_UPLOAD_ERROR = "Não foi possível enviar o vídeo agora.";
const DANGEROUS_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "host",
  "content-length",
  "origin",
  "referer",
  "proxy-authorization",
]);

function invalidSignedSession(message = "Sessão temporária de envio inválida."): MobileStrategicProfileDirectUploadResult {
  return {
    ok: false,
    status: "invalid_signed_session",
    errorMessage: message,
  };
}

function hasExpired(expiresAt: string): boolean {
  const expiresMs = new Date(expiresAt).getTime();
  return !Number.isFinite(expiresMs) || expiresMs <= Date.now();
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> | null {
  const safeHeaders: Record<string, string> = {};

  for (const [rawName, rawValue] of Object.entries(headers ?? {})) {
    const name = rawName.trim();
    const value = String(rawValue);
    if (!name) return null;
    if (DANGEROUS_HEADERS.has(name.toLowerCase())) return null;
    safeHeaders[name] = value;
  }

  return safeHeaders;
}

export async function uploadVideoToTemporarySignedUrl(
  input: MobileStrategicProfileDirectUploadInput,
): Promise<MobileStrategicProfileDirectUploadResult> {
  if (!input.uploadUrl?.trim()) {
    return invalidSignedSession();
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.uploadUrl);
  } catch {
    return invalidSignedSession();
  }

  if (parsedUrl.protocol !== "https:") {
    return invalidSignedSession();
  }

  if (input.method !== "PUT") {
    return invalidSignedSession();
  }

  if (hasExpired(input.expiresAt)) {
    return {
      ok: false,
      status: "expired",
      errorMessage: "A sessão temporária expirou. Tente enviar o vídeo novamente.",
    };
  }

  const headers = sanitizeHeaders(input.headers);
  if (!headers) {
    return invalidSignedSession();
  }

  try {
    const response = await fetch(input.uploadUrl, {
      method: "PUT",
      headers,
      body: input.file,
      credentials: "omit",
    });

    if (response.ok) {
      return {
        ok: true,
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
        bytesSent: input.file.size,
      };
    }

    return {
      ok: false,
      status: "failed",
      errorMessage: HUMAN_UPLOAD_ERROR,
    };
  } catch {
    return {
      ok: false,
      status: "failed",
      errorMessage: HUMAN_UPLOAD_ERROR,
    };
  }
}
