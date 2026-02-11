import mongoose from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";

const SCRIPT_TAG = "[SCRIPT_SET_SCRIPTS_INTELLIGENCE_FLAG]";
const FLAG_KEY = "scripts_intelligence_v2";

type FlagEnvironment = "development" | "staging" | "production";

function parseArg(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!match) return undefined;
  return match.slice(name.length + 3);
}

function normalizeEnv(input?: string): FlagEnvironment {
  const value = (input || "").trim().toLowerCase();
  if (["dev", "development", "local"].includes(value)) return "development";
  if (["stage", "staging", "preview"].includes(value)) return "staging";
  if (["prod", "production", "live"].includes(value)) return "production";
  return "development";
}

function parseBoolean(input?: string): boolean | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return null;
}

async function run() {
  const env = normalizeEnv(parseArg("env") || process.env.FLAG_ENV || process.env.NODE_ENV);
  const enabled = parseBoolean(parseArg("enabled"));
  const defaultValueArg = parseBoolean(parseArg("default"));

  if (enabled === null && defaultValueArg === null) {
    throw new Error(
      "Informe pelo menos um valor: --enabled=true|false (ambiente) ou --default=true|false (default)."
    );
  }

  logger.info(`${SCRIPT_TAG} Iniciando atualização da flag ${FLAG_KEY}.`, {
    env,
    enabled,
    defaultValueArg,
  });

  await connectToDatabase();

  const update: Record<string, any> = {
    description: "Rollout do roteirista inteligente por narrativa + DNA do criador",
  };

  if (enabled !== null) {
    update[`environments.${env}`] = enabled;
  }

  if (defaultValueArg !== null) {
    update.defaultValue = defaultValueArg;
  }

  const now = new Date();
  const collection = mongoose.connection.collection("featureflags");
  await collection.updateOne(
    { key: FLAG_KEY },
    {
      $set: {
        ...update,
        updatedAt: now,
      },
      $setOnInsert: {
        key: FLAG_KEY,
        createdAt: now,
      },
    },
    { upsert: true }
  );

  const doc = await collection.findOne({ key: FLAG_KEY });

  logger.info(`${SCRIPT_TAG} Flag atualizada com sucesso.`, {
    key: doc?.key,
    defaultValue: doc?.defaultValue,
    environments: doc?.environments,
  });
}

run()
  .catch((error) => {
    logger.error(`${SCRIPT_TAG} Erro ao atualizar flag.`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
