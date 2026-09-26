/**
 * E-mail semanal de quem conectou a Data2Content por um chat e não assinou.
 *
 * Sem opção: só mostra quem receberia e qual pauta (não envia, não grava).
 *   npx tsx --env-file=.env.local scripts/pluginWeeklyEmail.ts
 * Envio de verdade (o mesmo que a rotina semanal do QStash faz):
 *   npx tsx --env-file=.env.local scripts/pluginWeeklyEmail.ts --send
 */
import mongoose from "mongoose";
import { runPluginWeeklyEmails } from "../src/app/lib/plugin/weeklyEmail";

async function main() {
  const send = process.argv.includes("--send");
  const result = await runPluginWeeklyEmails({ dryRun: !send, limit: 200 });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
