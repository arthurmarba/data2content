import { fetchVideoRequest } from "./videoUploadRequest";
export type MobileStrategicProfileDirectUploadInput = {
  file: File;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
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
const MAX_UPLOAD_ATTEMPTS = 2;
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

function isLocalDiscardUploadUrlAllowed(url: URL): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED === "1" &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
    url.pathname === "/api/dev/mobile-strategic-profile/discard-upload"
  );
}

function parseUploadUrl(uploadUrl: string): URL | null {
  try {
    if (typeof window !== "undefined") {
      return new URL(uploadUrl, window.location.href);
    }
    return new URL(uploadUrl);
  } catch {
    return null;
  }
}

function resolveFetchUploadUrl(uploadUrl: string, parsedUrl: URL): string {
  if (isLocalDiscardUploadUrlAllowed(parsedUrl)) {
    return `${parsedUrl.pathname}${parsedUrl.search}`;
  }
  return uploadUrl;
}

function uploadResponseCanBeRetried(response: Response): boolean {
  return response.status >= 500 || response.status === 408 || response.status === 429;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function transfer(url: string, headers: Record<string, string>, input: MobileStrategicProfileDirectUploadInput): Promise<Response> {
  if (!input.onProgress) return fetchVideoRequest(url, { method: "PUT", headers, body: input.file, credentials: "omit", signal: input.signal }, 180000);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const done = () => input.signal?.removeEventListener("abort", abort);
    xhr.open("PUT", url);
    xhr.timeout = 180000;
    xhr.withCredentials = false;
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = event => { if (event.lengthComputable) input.onProgress?.(Math.min(100, Math.round(event.loaded / event.total * 100))); };
    xhr.onload = () => { done(); resolve(new Response(null, { status: xhr.status, headers: { "x-d2c-local-temp-upload": xhr.getResponseHeader("x-d2c-local-temp-upload") || "" } })); };
    xhr.onerror = () => { done(); reject(new Error("A conexão caiu durante o envio.")); };
    xhr.ontimeout = () => { done(); reject(new Error("O envio demorou demais. Confira sua conexão e tente novamente.")); };
    xhr.onabort = () => { done(); reject(new DOMException("Envio cancelado.", "AbortError")); };
    if (input.signal?.aborted) { reject(new DOMException("Envio cancelado.", "AbortError")); return; }
    input.signal?.addEventListener("abort", abort, { once: true });
    xhr.send(input.file);
  });
}

export async function uploadVideoToTemporarySignedUrl(
  input: MobileStrategicProfileDirectUploadInput,
): Promise<MobileStrategicProfileDirectUploadResult> {
  if (!input.uploadUrl?.trim()) {
    return invalidSignedSession();
  }

  let parsedUrl: URL;
  const maybeParsedUrl = parseUploadUrl(input.uploadUrl);
  if (!maybeParsedUrl) {
    return invalidSignedSession();
  }
  parsedUrl = maybeParsedUrl;

  if (parsedUrl.protocol !== "https:" && !isLocalDiscardUploadUrlAllowed(parsedUrl)) {
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

  const fetchUploadUrl = resolveFetchUploadUrl(input.uploadUrl, parsedUrl);

  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
    if (input.signal?.aborted) return { ok: false, status: "failed", errorMessage: "Envio cancelado." };
    if (hasExpired(input.expiresAt)) {
      return {
        ok: false,
        status: "expired",
        errorMessage: "A sessão temporária expirou. Tente enviar o vídeo novamente.",
      };
    }

    try {
      const response = await transfer(fetchUploadUrl, headers, input);

      if (response.ok) {
        if (
          isLocalDiscardUploadUrlAllowed(parsedUrl) &&
          response.headers?.get("x-d2c-local-temp-upload") !== "stored"
        ) {
          return {
            ok: false,
            status: "failed",
            errorMessage: HUMAN_UPLOAD_ERROR,
          };
        }

        return {
          ok: true,
          status: "uploaded",
          uploadedAt: new Date().toISOString(),
          bytesSent: input.file.size,
        };
      }

      if (attempt < MAX_UPLOAD_ATTEMPTS && uploadResponseCanBeRetried(response)) {
        await delay(350 * attempt);
        continue;
      }

      return {
        ok: false,
        status: "failed",
        errorMessage: HUMAN_UPLOAD_ERROR,
      };
    } catch {
      if (input.signal?.aborted) return { ok: false, status: "failed", errorMessage: "Envio cancelado." };
      if (attempt < MAX_UPLOAD_ATTEMPTS) {
        await delay(350 * attempt);
        continue;
      }
    }
  }

  return {
    ok: false,
    status: "failed",
    errorMessage: HUMAN_UPLOAD_ERROR,
  };
}
