// Em src/app/lib/logger.ts
import winston from "winston";
import * as Sentry from "@sentry/node";
import { sendAlert } from "@/app/lib/alerts";

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "debug",
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const originalError = logger.error.bind(logger);
logger.error = (message: unknown, ...meta: unknown[]) => {
  originalError(message, ...meta);
  const err = meta[0] instanceof Error ? meta[0] : new Error(typeof message === "string" ? message : JSON.stringify(message));
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  void sendAlert(`Erro crítico: ${err.message}`);
};
