const DEFAULT_FAST_TIMEOUT_MS = 3500;
const DEFAULT_COLD_TIMEOUT_MS =
  process.env.NODE_ENV === "development" ? 4800 : 4500;

function readTimeout(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const FAST_TIMEOUT_MS = readTimeout(
  process.env.LANDING_INTERNAL_TIMEOUT_MS,
  DEFAULT_FAST_TIMEOUT_MS,
);
const COLD_TIMEOUT_MS = Math.max(
  FAST_TIMEOUT_MS,
  Math.min(
    4900,
    readTimeout(process.env.LANDING_COLD_START_TIMEOUT_MS, DEFAULT_COLD_TIMEOUT_MS),
  ),
);

export function resolveLandingInternalTimeoutMs(hasWarmFallbackData: boolean) {
  return hasWarmFallbackData ? FAST_TIMEOUT_MS : COLD_TIMEOUT_MS;
}

type TimeoutResult<T> =
  | { source: "live"; value: T }
  | { source: "timeout_fallback"; value: T };

export async function executeWithLandingTimeout<T>(options: {
  task: Promise<T>;
  fallbackValue: T;
  timeoutMs: number;
  onTimeout: () => void;
}): Promise<TimeoutResult<T>> {
  const { task, fallbackValue, timeoutMs, onTimeout } = options;

  return await new Promise<TimeoutResult<T>>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      onTimeout();
      resolve({ source: "timeout_fallback", value: fallbackValue });
    }, timeoutMs);

    task
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve({ source: "live", value });
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
