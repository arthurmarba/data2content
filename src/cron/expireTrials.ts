import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import UserModel from "@/app/models/User";

const TAG = "[cron expireTrials]";

export async function expireTrialsCron() {
  await connectToDatabase();

  const now = new Date();
  const candidates = await UserModel.find({
    planStatus: { $in: ["trial", "trialing"] },
    planExpiresAt: { $ne: null, $lte: now },
  }).lean();

  if (!candidates.length) {
    logger.info(`${TAG} Nenhum trial ativo com expiração vencida encontrado.`);
    return;
  }

  logger.info(`${TAG} Encontrados ${candidates.length} usuários com trial vencido. Atualizando...`);

  for (const doc of candidates) {
    const updates: Record<string, any> = {
      planStatus: "expired",
      cancelAtPeriodEnd: false,
    };

    if (
      typeof (doc as any).proTrialStatus === "string" &&
      (doc as any).proTrialStatus.toLowerCase() === "active"
    ) {
      updates.proTrialStatus = "expired";
    }

    try {
      await UserModel.updateOne({ _id: doc._id }, { $set: updates });
      logger.info(`${TAG} Usuário ${doc._id} marcado como expired.`);
    } catch (err) {
      logger.error(`${TAG} Falha ao atualizar usuário ${doc._id}`, err);
    }
  }
}

export default expireTrialsCron;

if (process.argv[1]?.endsWith("expireTrials.ts")) {
  expireTrialsCron().catch((err) => {
    logger.error(`${TAG} unhandled error`, err);
    process.exitCode = 1;
  });
}
