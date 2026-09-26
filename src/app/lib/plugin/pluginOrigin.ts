// De qual chat a pessoa chegou à Data2Content, gravado na primeira conexão.
//
// Serve à medição do funil e ao e-mail semanal de quem veio de um plugin e não
// assinou. Nunca pode atrapalhar o login do conector: falha vira aviso no log.

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import UserModel from "@/app/models/User";
import type { PluginClient } from "./pluginClient";

export async function recordPluginConnection(userId: string, client: PluginClient, now = new Date()): Promise<void> {
  if (!Types.ObjectId.isValid(userId)) return;
  try {
    await connectToDatabase();
    // Só a primeira origem conta: quem conecta os dois chats continua sendo de onde veio.
    await UserModel.updateOne(
      { _id: new Types.ObjectId(userId), pluginOrigin: { $exists: false } },
      { $set: { pluginOrigin: { client, firstConnectedAt: now } } },
    );
  } catch (error) {
    logger.warn("[plugin][origin_record_failed]", {
      client,
      error: error instanceof Error ? error.name : "unknown_error",
    });
  }
}
