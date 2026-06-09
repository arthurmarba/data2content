type AnalysisSubmitResult = {
  response: Response;
  data: any;
  attempts: number;
};

const RETRIABLE_STATUS_CODES = new Set([408, 425, 429]);
const NON_RETRIABLE_CODES = new Set([
  "reading_quota_unavailable",
  "temporary_upload_required",
  "reading_not_saved",
  "profile_synthesis_not_written",
  "invalid_payload",
  "invalid_mime_type",
  "invalid_extension",
  "file_too_large",
]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function responseCanBeRetried(response: Response, data: any): boolean {
  if (response.ok) return false;
  if (data?.videoReadingPersistence?.saved) return false;

  const code = typeof data?.code === "string"
    ? data.code
    : typeof data?.reason === "string"
      ? data.reason
      : "";
  if (NON_RETRIABLE_CODES.has(code)) return false;

  return response.status >= 500 || RETRIABLE_STATUS_CODES.has(response.status);
}

export async function postMobileStrategicProfileAnalysisJson(params: {
  endpoint: string;
  body: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<AnalysisSubmitResult> {
  const maxAttempts = Math.max(1, params.maxAttempts ?? 3);
  let lastNetworkError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(params.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params.body),
      });
      const data = await response.json().catch(() => ({}));

      if (attempt < maxAttempts && responseCanBeRetried(response, data)) {
        await delay(450 * attempt);
        continue;
      }

      return { response, data, attempts: attempt };
    } catch (error) {
      lastNetworkError = error;
      if (attempt < maxAttempts) {
        await delay(450 * attempt);
        continue;
      }
    }
  }

  throw lastNetworkError instanceof Error
    ? lastNetworkError
    : new Error("Erro ao conectar com o serviço de análise.");
}
