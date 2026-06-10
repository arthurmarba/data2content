/**
 * backfillMapaSeed.ts — Fase 2D
 *
 * Cria um MapaSeed-semente para usuários que já fizeram onboarding ANTES da Fase 2A
 * (quando o onboarding passou a criar o MapaSeed). Sem isso, esses usuários não têm
 * MapaSeed e não se beneficiam do enriquecimento de Instagram nem do destrave de
 * pautas pelo mapa (Fase 2C).
 *
 * Estratégia: para cada User com onboardingAnswers.creatorPurpose e SEM MapaSeed,
 * gera a hipótese de narrativa (generateOnboardingSeedSignal) e cria o MapaSeed
 * mínimo — exatamente como a Fase 2A faz no onboarding vivo.
 *
 * Idempotente: nunca sobrescreve um MapaSeed existente.
 * Faz chamadas de IA reais (Gemini/OpenAI) — é uma operação de ops deliberada.
 *
 * Uso:
 *   npx tsx scripts/backfillMapaSeed.ts                 # dry-run (não escreve)
 *   npx tsx scripts/backfillMapaSeed.ts --apply         # aplica
 *   npx tsx scripts/backfillMapaSeed.ts --email=x@y.com # um usuário só
 *   npx tsx scripts/backfillMapaSeed.ts --apply --limit=50
 *
 * ATENÇÃO ao banco: usa a conexão padrão do app (MONGODB_URI). Rode com a URI
 * de PRODUÇÃO para backfillar produção. Opcional: MAPASEED_BACKFILL_DB para
 * forçar o nome do banco (ex.: data2content).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const EMAIL = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ?? null;
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || 0;
const DB_NAME = process.env.MAPASEED_BACKFILL_DB || null;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const conn = DB_NAME ? mongoose.connection.useDb(DB_NAME, { useCache: true }) : mongoose.connection;
  const db = conn.db!;
  console.log(`Banco: ${db.databaseName} | modo: ${APPLY ? "APPLY" : "DRY-RUN"}${EMAIL ? ` | email: ${EMAIL}` : ""}${LIMIT ? ` | limit: ${LIMIT}` : ""}\n`);

  const { generateOnboardingSeedSignal } = await import(
    "../src/app/lib/mapaSeed/generateOnboardingSeedSignal"
  );

  const query: Record<string, unknown> = {
    "onboardingAnswers.creatorPurpose": { $nin: [null, ""] },
  };
  if (EMAIL) query.email = EMAIL;

  const users = await db
    .collection("users")
    .find(query, { projection: { email: 1, onboardingAnswers: 1 } })
    .toArray();

  console.log(`Candidatos (têm creatorPurpose): ${users.length}`);

  let created = 0, skipped = 0, failed = 0, processed = 0;

  for (const u of users) {
    if (LIMIT && processed >= LIMIT) break;
    processed++;

    const exists = await db.collection("mapasseed").findOne({ userId: u._id }, { projection: { _id: 1 } });
    if (exists) { skipped++; continue; }

    const oa = (u as any).onboardingAnswers ?? {};
    const seedSignal = await generateOnboardingSeedSignal({
      whyYouCreate: oa.whyYouCreate ?? "",
      desiredFeeling: oa.desiredFeeling ?? "",
      creatorPurpose: oa.creatorPurpose ?? "",
    }).catch(() => null);

    if (!seedSignal?.label) {
      console.log(`  ⚠️  ${u.email}: sem seedSignal (pulado)`);
      failed++;
      continue;
    }

    console.log(`  ${APPLY ? "✅" : "•"} ${u.email}: "${seedSignal.label}"`);
    if (APPLY) {
      await db.collection("mapasseed").insertOne({
        userId: u._id,
        mapa: {
          narrativa_central: seedSignal.label,
          territorios: [],
          narrativas_adjacentes: [],
          assets: [],
          tom: "",
          formatos: [],
          maturidade: "seed",
          fonte: ["onboarding_declarativo"],
          observacoes: [],
        },
        leituraInaugural: null,
        instagramEnrichedAt: null,
        videoEnrichedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    created++;
  }

  console.log(`\nResumo: ${created} ${APPLY ? "criados" : "a criar"} | ${skipped} já tinham | ${failed} sem sinal | ${processed} processados`);
  if (!APPLY) console.log("DRY-RUN — nada escrito. Rode com --apply para aplicar.");

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
