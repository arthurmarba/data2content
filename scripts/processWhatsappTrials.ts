// scripts/processWhatsappTrials.ts

import "dotenv/config";
import { connectToDatabase } from "../src/app/lib/mongoose";
import User from "../src/app/models/User";
import { logger } from "../src/app/lib/logger";
import {
  sendTemplateMessage,
  sendWhatsAppMessage,
} from "../src/app/lib/whatsappService";

const TAG = "[processWhatsappTrials]";
const DEFAULT_BATCH_LIMIT = 50;
const DEFAULT_GRACE_MINUTES = 5;
const TRIAL_DURATION_HOURS = 48;

const WHATSAPP_TRIAL_ENABLED =
  String(
    process.env.WHATSAPP_TRIAL_ENABLED ??
      process.env.NEXT_PUBLIC_WHATSAPP_TRIAL_ENABLED ??
      "true"
  )
    .toLowerCase()
    .trim() !== "false";

const batchLimit = Number(process.env.WHATSAPP_TRIAL_CRON_LIMIT ?? DEFAULT_BATCH_LIMIT);
const graceMinutes = Number(process.env.WHATSAPP_TRIAL_GRACE_MINUTES ?? DEFAULT_GRACE_MINUTES);
const upgradeUrl =
  process.env.NEXT_PUBLIC_PRO_UPGRADE_URL ||
  process.env.WHATSAPP_TRIAL_UPSELL_URL ||
  "https://app.data2content.co/dashboard/billing/checkout";
const templateName = process.env.WHATSAPP_TRIAL_EXPIRE_TEMPLATE || "";

function buildFallbackMessage(name?: string | null) {
  const greeting = name ? `Oi, ${name}!` : "Oi! 👋";
  return (
    `${greeting} Seu teste de ${TRIAL_DURATION_HOURS}h com a estrategista no WhatsApp acabou.\n\n` +
    `Ative o plano PRO agora e ganhe +7 dias grátis para continuar recebendo roteiros prontos, melhores horários e alertas personalizados.\n\n` +
    `👉 ${upgradeUrl}`
  );
}

async function notifyUser(user: {
  _id: typeof User.prototype._id;
  email?: string;
  name?: string;
  whatsappPhone?: string | null;
}) {
  if (!user.whatsappPhone) {
    logger.warn(`${TAG} Usuário ${user._id} não possui whatsappPhone para notificar.`);
    return false;
  }

  try {
    if (templateName) {
      await sendTemplateMessage(user.whatsappPhone, templateName, [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: user.name ?? "criador",
            },
            {
              type: "text",
              text: upgradeUrl,
            },
          ],
        },
      ]);
    } else {
      const message = buildFallbackMessage(user.name);
      await sendWhatsAppMessage(user.whatsappPhone, message);
    }
    return true;
  } catch (error) {
    logger.error(`${TAG} Falha ao enviar mensagem de expiração para ${user._id}`, error);
    return false;
  }
}

async function processTrials() {
  if (!WHATSAPP_TRIAL_ENABLED) {
    logger.warn(`${TAG} Flag WHATSAPP_TRIAL_ENABLED está desativada; encerrando sem alterações.`);
    return;
  }

  await connectToDatabase();

  const now = new Date();
  const cutoff = new Date(now.getTime() - graceMinutes * 60_000);

  logger.info(
    `${TAG} Buscando trials ativos expirados até ${cutoff.toISOString()} (limite ${batchLimit}).`
  );

  const expiringUsers = await User.find({
    whatsappTrialActive: true,
    whatsappTrialExpiresAt: { $lte: cutoff },
    $or: [
      { whatsappTrialLastNotificationAt: { $exists: false } },
      { whatsappTrialLastNotificationAt: null },
    ],
  })
    .select(
      "_id email name whatsappPhone whatsappTrialExpiresAt whatsappTrialActive whatsappTrialLastNotificationAt"
    )
    .limit(batchLimit)
    .lean();

  if (!expiringUsers.length) {
    logger.info(`${TAG} Nenhum trial expirado pendente encontrado.`);
    return;
  }

  logger.info(`${TAG} Processando ${expiringUsers.length} usuário(s) com trial expirado.`);

  for (const user of expiringUsers) {
    const notified = await notifyUser(user);

    const update: Record<string, unknown> = {
      whatsappTrialActive: false,
      whatsappTrialEligible: false,
      whatsappTrialLastNotificationAt: now,
    };

    if (!notified) {
      logger.warn(`${TAG} Notificação falhou para ${user._id}; mantendo status para reprocessar.`);
      delete update.whatsappTrialLastNotificationAt;
    }

    await User.updateOne({ _id: user._id }, { $set: update }).exec();
  }
}

processTrials()
  .then(() => {
    logger.info(`${TAG} Execução concluída.`);
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`${TAG} Erro fatal:`, error);
    process.exit(1);
  });
