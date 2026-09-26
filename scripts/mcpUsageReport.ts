/**
 * Uso do conector Data2Content (ChatGPT e Claude), só leitura.
 *
 *   npx tsx --env-file=.env.local scripts/mcpUsageReport.ts                 # últimos 7 dias
 *   npx tsx --env-file=.env.local scripts/mcpUsageReport.ts --days 30
 *   npx tsx --env-file=.env.local scripts/mcpUsageReport.ts --requests      # inclui os pedidos
 *   npx tsx --env-file=.env.local scripts/mcpUsageReport.ts --check-ttl     # confere a expiração no banco
 */
import mongoose from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import { buildMcpUsageReport } from "../src/app/lib/mcp/usageReport";
import McpToolCallLog from "../src/app/models/McpToolCallLog";
import McpUsageDaily from "../src/app/models/McpUsageDaily";

function arg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function saoPauloDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function main() {
  await connectToDatabase();
  if (process.argv.includes("--check-ttl")) {
    // A política promete apagar em 90 dias e 12 meses: confira no banco real, não no schema.
    for (const model of [McpToolCallLog, McpUsageDaily]) {
      const indexes = await model.collection.indexes().catch(() => []);
      const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);
      console.log(`${model.collection.collectionName}: ${ttl ? `expiração ativa (${JSON.stringify(ttl.key)})` : "SEM índice de expiração"}`);
    }
    return;
  }
  const days = Number(arg("--days") ?? 7);
  const end = new Date();
  const start = new Date(end.getTime() - (Math.max(1, days) - 1) * 86_400_000);
  const report = await buildMcpUsageReport({
    startDate: saoPauloDay(start),
    endDate: saoPauloDay(end),
    includeRequests: process.argv.includes("--requests"),
    requestLimit: 100,
    includeInternal: process.argv.includes("--internal"),
  });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
