// Em src/app/lib/logger.ts
import winston from "winston";
import * as Sentry from "@sentry/nextjs";
import { sendAlert } from "@/app/lib/alerts";

const baseMeta = {
  env: process.env.NODE_ENV || "dev",
  service: "affiliates",
  version: process.env.GIT_SHA || "local",
};

// Adiciona 'import "server-only";' se este arquivo for estritamente para o servidor.
// Isso ajuda a evitar importações acidentais em componentes de cliente.
// import "server-only";

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
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

logger.error = (message: unknown, ...meta: unknown[]) => {
  const logMessage =
    typeof message === "string" ? sanitize(message) : JSON.stringify(message);

  originalError(logMessage, ...meta);

  const err = meta[0] instanceof Error ? meta[0] : new Error(logMessage);
  err.message = sanitize(err.message);

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  void sendAlert(`Erro crítico: ${err.message}`);

  return logger;
};
