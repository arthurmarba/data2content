/**
 * normalizeMapaSeedChips.ts — normaliza os rótulos de chip dos mapas já gravados
 *
 * O hook pre('save') do MapaSeed quebra rótulos empacotados pela IA (ex:
 * "Cenários externos (praia, metrô, áreas verdes)") em vários chips curtos, mas
 * só age em escritas futuras. Os mapas que JÁ estão no banco mantêm os rótulos
 * longos até serem re-enriquecidos. Este script os atualiza de uma vez.
 *
 * Para cada MapaSeed, computa os arrays normalizados (territorios/temas/assets/
 * narrativas_adjacentes) com o mesmo helper do hook. Se algo muda, no --apply
 * marca `mapa` como modificado e salva — o próprio hook reaplica a normalização.
 * É idempotente e seguro de re-rodar (mapa já curto não muda).
 *
 * Uso:
 *   npx tsx scripts/normalizeMapaSeedChips.ts                 # dry-run (mostra diffs)
 *   npx tsx scripts/normalizeMapaSeedChips.ts --apply         # grava
 *   npx tsx scripts/normalizeMapaSeedChips.ts --email=x@y.com # um usuário
 *   npx tsx scripts/normalizeMapaSeedChips.ts --apply --limit=50
 *
 * ATENÇÃO: usa connectToDatabase() (MONGODB_URI). Rode com a URI de PRODUÇÃO
 * para normalizar produção.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const EMAIL = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ?? null;
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || 0;

const FIELDS = ["territorios", "temas", "assets", "narrativas_adjacentes"] as const;

async function main() {
  const { connectToDatabase } = await import("../src/app/lib/mongoose");
  const mongoose = (await import("mongoose")).default;
  await connectToDatabase();

  const { default: User } = await import("../src/app/models/User");
  const { default: MapaSeedModel } = await import("../src/app/models/MapaSeed");
  const { sanitizeChipArray } = await import("../src/app/lib/mapaSeed/normalizeChipLabel");

  console.log(
    `Banco: ${mongoose.connection.db?.databaseName} | modo: ${APPLY ? "APPLY" : "DRY-RUN"}` +
      `${EMAIL ? ` | email: ${EMAIL}` : ""}${LIMIT ? ` | limit: ${LIMIT}` : ""}\n`,
  );

  // Filtro opcional por email → resolve userId.
  let userFilter: Record<string, unknown> = {};
  if (EMAIL) {
    const u = await User.findOne({ email: EMAIL }).select("_id").lean();
    if (!u) {
      console.log(`Usuário ${EMAIL} não encontrado.`);
      await mongoose.disconnect();
      return;
    }
    userFilter = { userId: (u as any)._id };
  }

  const docs = await MapaSeedModel.find(userFilter);
  console.log(`MapaSeeds: ${docs.length}\n`);

  let processed = 0;
  let changed = 0;

  for (const doc of docs) {
    if (LIMIT && processed >= LIMIT) break;
    processed++;

    const mapa = doc.mapa;
    if (!mapa) continue;

    const diffs: string[] = [];
    for (const field of FIELDS) {
      const before = (mapa[field] ?? []) as string[];
      const after = sanitizeChipArray(before);
      if (before.length !== after.length || before.some((v, i) => v !== after[i])) {
        diffs.push(`    ${field}: [${before.join(" · ")}] → [${after.join(" · ")}]`);
        (mapa[field] as string[]) = after;
      }
    }

    if (diffs.length === 0) continue;
    changed++;
    console.log(`  • ${String(doc.userId)}`);
    for (const d of diffs) console.log(d);

    if (APPLY) {
      doc.markModified("mapa");
      await doc.save(); // o hook pre('save') reaplica a normalização
      console.log("    ✅ salvo");
    }
  }

  console.log(
    `\nResumo: ${processed} processados | ${changed} ${APPLY ? "normalizados" : "a normalizar"} | ` +
      `${processed - changed} já limpos`,
  );
  if (!APPLY) console.log("DRY-RUN — nada escrito. Rode com --apply para aplicar.");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
