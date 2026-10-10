/**
 * Dados de contas que já foram excluídas e ficaram no banco e no R2.
 * Sem --apply, só conta: não apaga nada.
 *
 *   npx tsx --env-file=.env.local scripts/accountDataOrphans.ts            # ensaio
 *   npx tsx --env-file=.env.local scripts/accountDataOrphans.ts --apply    # apaga
 *
 * Usa as mesmas regras da exclusão de conta (src/app/lib/account/accountDataDeletion.ts)
 * e nunca toca em conta que existe. Os nomes nos relatórios da comunidade não têm
 * como ser ligados a uma conta que já saiu: o comando só lista os que não batem com
 * nenhum cadastro, para conferir à mão.
 */
import mongoose from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import {
  ACCOUNT_DATA_RULES,
  REMOVED_CREATOR_LABEL,
  deleteAccountData,
} from "../src/app/lib/account/accountDataDeletion";

const OBJECT_ID = /^[0-9a-f]{24}$/i;

async function main() {
  const apply = process.argv.includes("--apply");
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Sem conexão com o banco.");

  const accounts = await db.collection("users").find({}, { projection: { _id: 1, name: 1 } }).toArray();
  const existing = new Set(accounts.map((account) => String(account._id)));

  const orphans = new Set<string>();
  for (const rule of ACCOUNT_DATA_RULES) {
    const owners: unknown[] = await db.collection(rule.collection).distinct(rule.field).catch(() => []);
    for (const owner of owners) {
      const id = String(owner);
      if (OBJECT_ID.test(id) && !existing.has(id)) orphans.add(id);
    }
  }

  const totals: Record<string, number> = {};
  let files = 0;
  for (const id of orphans) {
    if (await db.collection("users").countDocuments({ _id: new mongoose.Types.ObjectId(id) })) continue;
    const report = await deleteAccountData(id, { dryRun: !apply });
    for (const [key, count] of Object.entries(report.collections)) totals[key] = (totals[key] ?? 0) + count;
    files += report.files;
  }

  const names = new Set(accounts.map((account) => String(account.name ?? "").trim()).filter(Boolean));
  const highlighted: string[] = await db.collection("weekly_territory_reports").distinct("highlightWinners");
  const unmatched = highlighted.filter((name) => name && name !== REMOVED_CREATOR_LABEL && !names.has(name.trim()));

  console.log(apply ? "APAGADO" : "ENSAIO (nada foi apagado; use --apply para apagar)");
  console.log(`Contas excluídas com dado para trás: ${orphans.size}`);
  for (const [key, count] of Object.entries(totals).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(52)} ${count}`);
  }
  console.log(`  ${"R2: capas de análise de vídeo".padEnd(52)} ${files}`);
  console.log(`Nomes nos relatórios da comunidade sem cadastro (conferir à mão): ${unmatched.length ? unmatched.join(", ") : "nenhum"}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
