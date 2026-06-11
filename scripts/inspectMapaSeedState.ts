/**
 * inspectMapaSeedState.ts — diagnóstico pontual (somente leitura)
 *
 * Mostra, para um usuário, o estado das peças que fazem o enriquecimento de
 * Instagram acontecer: User, conexão Instagram, MapaSeed (maturidade,
 * instagramEnrichedAt, narrativa/territórios) e contagem de Metrics.
 *
 * Uso:
 *   npx tsx scripts/inspectMapaSeedState.ts --email=arthurksy@gmail.com
 *   MAPASEED_BACKFILL_DB=data2content npx tsx scripts/inspectMapaSeedState.ts --email=...
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";

const EMAIL = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ?? null;
const DB_NAME = process.env.MAPASEED_BACKFILL_DB || null;

async function main() {
  if (!EMAIL) {
    console.error("Informe --email=...");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI!);
  const conn = DB_NAME ? mongoose.connection.useDb(DB_NAME, { useCache: true }) : mongoose.connection;
  const db = conn.db!;
  console.log(`Banco: ${db.databaseName} | email: ${EMAIL}\n`);

  const user = await db.collection("users").findOne(
    { email: EMAIL },
    {
      projection: {
        email: 1,
        name: 1,
        isInstagramConnected: 1,
        instagramAccountId: 1,
        "instagramAccessToken": 1,
        instagramSyncErrorMsg: 1,
        lastInstagramSyncAttempt: 1,
        lastInstagramSyncSuccess: 1,
        "onboardingAnswers.creatorPurpose": 1,
      },
    },
  );

  if (!user) {
    console.log("❌ Usuário NÃO encontrado neste banco.");
    await mongoose.disconnect();
    return;
  }

  console.log("── USER ──");
  console.log({
    _id: String(user._id),
    name: user.name,
    isInstagramConnected: user.isInstagramConnected,
    instagramAccountId: user.instagramAccountId ?? null,
    hasAccessToken: !!user.instagramAccessToken,
    lastInstagramSyncAttempt: user.lastInstagramSyncAttempt ?? null,
    lastInstagramSyncSuccess: user.lastInstagramSyncSuccess ?? null,
    instagramSyncErrorMsg: user.instagramSyncErrorMsg ?? null,
    hasCreatorPurpose: !!user.onboardingAnswers?.creatorPurpose,
  });

  const userId = user._id;

  const mapa = await db.collection("mapasseed").findOne({ userId });
  console.log("\n── MAPASEED ──");
  if (!mapa) {
    console.log("❌ Sem MapaSeed para este userId.");
  } else {
    const m = (mapa.mapa ?? {}) as Record<string, unknown>;
    console.log({
      maturidade: m.maturidade ?? null,
      fonte: m.fonte ?? null,
      narrativa_central: typeof m.narrativa_central === "string" ? (m.narrativa_central as string).slice(0, 80) : m.narrativa_central ?? null,
      territorios: Array.isArray(m.territorios) ? (m.territorios as unknown[]).length : m.territorios ?? null,
      tom: m.tom ?? null,
      instagramEnrichedAt: mapa.instagramEnrichedAt ?? null,
      updatedAt: mapa.updatedAt ?? null,
    });
  }

  const metricCount = await db.collection("metrics").countDocuments({ user: userId });
  const lastMetric = await db
    .collection("metrics")
    .find({ user: userId })
    .sort({ postDate: -1 })
    .limit(1)
    .project({ postDate: 1, instagramMediaId: 1, createdAt: 1 })
    .toArray();
  console.log("\n── METRICS ──");
  console.log({ count: metricCount, mostRecent: lastMetric[0] ?? null });

  // Também tenta achar conexão Instagram na coleção dedicada, se existir.
  const igConn = await db.collection("instagramconnections").findOne({ userId }).catch(() => null);
  if (igConn) {
    console.log("\n── instagramconnections ──");
    console.log({
      accountId: (igConn as Record<string, unknown>).accountId ?? null,
      hasToken: !!(igConn as Record<string, unknown>).accessToken,
    });
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
