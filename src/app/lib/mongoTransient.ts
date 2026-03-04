const TRANSIENT_MONGO_ERROR_NAMES = new Set([
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerSelectionError",
  "MongoPoolClearedError",
  "MongoTopologyClosedError",
  "MongooseServerSelectionError",
]);

const TRANSIENT_MONGO_MESSAGE_PATTERNS = [
  /connection pool .* was cleared/i,
  /tlsv1 alert internal error/i,
  /server selection timed out/i,
  /econnreset/i,
  /socket hang up/i,
  /connection .* closed/i,
];

export function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message || "";
  return String(error);
}

export function isTransientMongoError(error: unknown): boolean {
  if (!error) return false;
  const name = (error as { name?: unknown })?.name;
  if (typeof name === "string" && TRANSIENT_MONGO_ERROR_NAMES.has(name)) {
    return true;
  }

  const message = getErrorMessage(error);
  if (!message) return false;

  return TRANSIENT_MONGO_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

type MongoRetryOptions = {
  retries?: number;
  onRetry?: (error: unknown, retryCount: number) => void;
};

export async function withMongoTransientRetry<T>(
  operation: () => Promise<T>,
  options: MongoRetryOptions = {}
): Promise<T> {
  const retriesRaw = options.retries;
  const retries =
    typeof retriesRaw === "number" && Number.isFinite(retriesRaw) && retriesRaw > 0
      ? Math.floor(retriesRaw)
      : 0;

  let retryCount = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientMongoError(error) || retryCount >= retries) {
        throw error;
      }
      retryCount += 1;
      options.onRetry?.(error, retryCount);
    }
  }
}
