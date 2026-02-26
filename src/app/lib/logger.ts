// Em src/app/lib/logger.ts
import winston from "winston";
import * as Sentry from "@sentry/nextjs";
import { sendAlert } from "@/app/lib/alerts";

const baseMeta = {
  env: process.env.NODE_ENV || "dev",
  service: "affiliates",
  version:
    process.env.GIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    "local",
};

// Adiciona 'import "server-only";' se este arquivo for estritamente para o servidor.
// Isso ajuda a evitar importações acidentais em componentes de cliente.
// import "server-only";

const hasSentryDsn = Boolean(process.env.SENTRY_DSN);
const hasSentryCaptureException =
  typeof (Sentry as { captureException?: unknown }).captureException === "function";

if (hasSentryDsn) {
  try {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
  } catch (initError) {
    // Never crash app boot due to observability setup.
    // eslint-disable-next-line no-console
    console.error("[logger] Falha ao inicializar Sentry:", initError);
  }
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: baseMeta,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Sobrescreve o método de erro para integrar com Sentry e alertas
const originalError = logger.error.bind(logger);

function sanitize(msg: string): string {
  return msg.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "[redacted]");
}

function safeToString(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

logger.error = (message: unknown, ...meta: unknown[]) => {
  const logMessage = sanitize(safeToString(message));

  originalError(logMessage, ...meta);

  const err = meta[0] instanceof Error ? meta[0] : new Error(logMessage);
  err.message = sanitize(err.message);

  if (hasSentryDsn && hasSentryCaptureException) {
    try {
      (Sentry as { captureException: (error: Error) => void }).captureException(err);
    } catch (sentryError) {
      originalError(
        "[logger] Falha ao enviar excecao para o Sentry.",
        sentryError
      );
    }
  }

  void sendAlert(`Erro crítico: ${err.message}`).catch((alertError) => {
    originalError("[logger] Falha ao enviar alerta.", alertError);
  });

  return logger;
};
