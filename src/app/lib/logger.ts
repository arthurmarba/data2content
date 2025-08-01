// Em src/app/lib/logger.ts
import winston from "winston";
import * as Sentry from "@sentry/nextjs";
import { sendAlert } from "@/app/lib/alerts";

// Adiciona 'import "server-only";' se este arquivo for estritamente para o servidor.
// Isso ajuda a evitar importações acidentais em componentes de cliente.
// import "server-only";

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

// Sobrescreve o método de erro para integrar com Sentry e alertas
const originalError = logger.error.bind(logger);
logger.error = (message: unknown, ...meta: unknown[]) => {
  // CORREÇÃO: Garante que a mensagem principal seja uma string antes de passá-la para o logger.
  const logMessage = typeof message === 'string' ? message : JSON.stringify(message);

  // Mantém o log original no console
  originalError(logMessage, ...meta);

  // Garante que temos um objeto de Erro para o Sentry
  const err = meta[0] instanceof Error ? meta[0] : new Error(logMessage);

  // Envia a exceção para o Sentry, se configurado
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  // Envia um alerta (ex: Slack, Email)
  void sendAlert(`Erro crítico: ${err.message}`);

  // Retorna a instância do logger para cumprir a assinatura do tipo de Winston
  return logger;
};
