import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import {
  sendTemplateMessage,
  sendWhatsAppMessage,
} from "@/app/lib/whatsappService";
import {
  buildWhatsappTrialDeactivation,
  isWhatsappTrialEnabled,
} from "@/app/lib/whatsappTrial";

const DEFAULT_BATCH_LIMIT = 50;
const DEFAULT_GRACE_MINUTES = 5;
const TRIAL_DURATION_HOURS = 48;

const UPGRADE_URL =
  process.env.NEXT_PUBLIC_PRO_UPGRADE_URL ||
  process.env.WHATSAPP_TRIAL_UPSELL_URL ||
  "https://app.data2content.co/dashboard/billing/checkout";

const EXPIRE_TEMPLATE = process.env.WHATSAPP_TRIAL_EXPIRE_TEMPLATE || "";

export interface ProcessWhatsappTrialsOptions {
  batchLimit?: number;
  graceMinutes?: number;
  dryRun?: boolean;
}

export interface ProcessWhatsappTrialsResult {
  processed: number;
  notified: number;
  failedNotifications: number;
  missingPhone: number;
  deactivated: number;
  dryRun?: boolean;
}

function buildFallbackMessage(name?: string | null) {
  const greeting = name ? `Oi, ${name}!` : "Oi! 👋";
  return (
    `${greeting} Seu teste de ${TRIAL_DURATION_HOURS}h com a estrategista no WhatsApp acabou.\n\n` +
    `Ative o plano PRO agora e ganhe +7 dias grátis para continuar recebendo roteiros prontos, melhores horários e alertas personalizados.\n\n` +
    `👉 ${UPGRADE_URL}`
  );
}

async function notifyUser(phone: string, name?: string | null) {
  if (EXPIRE_TEMPLATE) {
    await sendTemplateMessage(phone, EXPIRE_TEMPLATE, [
      {
        type: "body",
        parameters: [
          { type: "text", text: name ?? "criador" },
          { type: "text", text: UPGRADE_URL },
        ],
      },
    ]);
  } else {
    const fallback = buildFallbackMessage(name);
    await sendWhatsAppMessage(phone, fallback);
  }
}

export async function processWhatsappTrials(
  options: ProcessWhatsappTrialsOptions = {}
): Promise<ProcessWhatsappTrialsResult> {
  if (!isWhatsappTrialEnabled()) {
    logger.warn("[cron.whatsappTrial] Flag desativada — nada será processado.");
    return {
      processed: 0,
      notified: 0,
      failedNotifications: 0,
      missingPhone: 0,
      deactivated: 0,
      dryRun: options.dryRun ?? false,
    };
  }

  const batchLimit = options.batchLimit ?? Number(process.env.WHATSAPP_TRIAL_CRON_LIMIT ?? DEFAULT_BATCH_LIMIT);
  const graceMinutes =
    options.graceMinutes ?? Number(process.env.WHATSAPP_TRIAL_GRACE_MINUTES ?? DEFAULT_GRACE_MINUTES);
  const dryRun = options.dryRun ?? false;

  await connectToDatabase();

  const now = new Date();
  const cutoff = new Date(now.getTime() - graceMinutes * 60_000);

  logger.info(
    "[cron.whatsappTrial] Iniciando verificação",
    { cutoff: cutoff.toISOString(), batchLimit, dryRun }
  );

  const query: Record<string, unknown> = {
    whatsappTrialActive: true,
    whatsappTrialExpiresAt: { $lte: cutoff },
  };

  if (!dryRun) {
    query.$or = [
      { whatsappTrialLastNotificationAt: { $exists: false } },
      { whatsappTrialLastNotificationAt: null },
    ];
  }

  const expiringUsers = await User.find(query)
    .select(
      "_id email name planStatus whatsappPhone whatsappTrialExpiresAt whatsappTrialActive whatsappTrialLastNotificationAt"
    )
    .limit(batchLimit)
    .lean()
    .exec();

  if (!expiringUsers.length) {
    logger.info("[cron.whatsappTrial] Nenhum trial expirado pendente.");
    return {
      processed: 0,
      notified: 0,
      failedNotifications: 0,
      missingPhone: 0,
      deactivated: 0,
      dryRun,
    };
  }

  const result: ProcessWhatsappTrialsResult = {
    processed: expiringUsers.length,
    notified: 0,
    failedNotifications: 0,
    missingPhone: 0,
    deactivated: 0,
    dryRun,
  };

  for (const user of expiringUsers) {
    if (!user.whatsappPhone) {
      logger.warn("[cron.whatsappTrial] Usuário sem telefone para notificar", {
        userId: String(user._id),
      });
      result.missingPhone += 1;
      if (!dryRun) {
      const deactivation = buildWhatsappTrialDeactivation(now, {
        resetPlanStatus: (user as any).planStatus === "trial",
        recordNotificationTimestamp: false,
      });
      await User.updateOne(
        { _id: user._id },
        { $set: deactivation.set }
      ).exec();
        result.deactivated += 1;
      }
      continue;
    }

    if (dryRun) {
      logger.info("[cron.whatsappTrial] (dry-run) Usuário seria notificado", {
        userId: String(user._id),
        phone: user.whatsappPhone,
      });
      continue;
    }

    try {
      await notifyUser(user.whatsappPhone, (user as any).name);
      result.notified += 1;
    } catch (error) {
      result.failedNotifications += 1;
      logger.error("[cron.whatsappTrial] Falha ao notificar usuário", {
        userId: String(user._id),
        error,
      });
      // Não atualiza flags para permitir nova tentativa futura
      continue;
    }

    const deactivation = buildWhatsappTrialDeactivation(now, {
      resetPlanStatus: (user as any).planStatus === "trial",
      recordNotificationTimestamp: true,
    });
    await User.updateOne(
      { _id: user._id },
      { $set: deactivation.set }
    ).exec();

    result.deactivated += 1;
  }

  logger.info("[cron.whatsappTrial] Processamento concluído", result);
  return result;
}

export default processWhatsappTrials;
