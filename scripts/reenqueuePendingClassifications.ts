// scripts/reenqueuePendingClassifications.ts
//
// Reconciliação do backlog de classificação.
//
// Posts ingeridos via API ficam com classificationStatus='pending' e dependem de
// uma tarefa QStash (publicada em metricActions.ts) para serem classificados pelo
// worker /api/worker/classify-content. Quando esse enqueue falha ou é pulado
// (CLASSIFICATION_WORKER_URL ausente, OU rate limit do plano QStash), o post fica
// preso em 'pending' para sempre — sem retry, sem erro registrado.
//
// Este script encontra os ÓRFÃOS (pending + sem classificationError + com
// descrição) e os resolve por uma de duas estratégias:
//
//   • QStash (default)  — re-publica a tarefa no mesmo caminho de produção.
//                         Cron-ready, mas sujeito ao limite do plano QStash.
//   • --inline          — classifica DIRETO via OpenAI (mesma lógica do worker),
//                         ignorando o QStash. Use para drenar backlog quando o
//                         QStash está limitado.
//
// Seguro por padrão: só LISTA (dry-run). Use --apply para agir.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/reenqueuePendingClassifications.ts \
//     [--user=<id>] [--limit=N] [--stale-minutes=N] [--inline] [--apply]

import { connectToDatabase } from '../src/app/lib/mongoose';
import MetricModel from '../src/app/models/Metric';
import { Client } from '@upstash/qstash';
import { Types } from 'mongoose';
import {
  buildClassificationOpenAiPayload,
  buildMetricClassificationUpdate,
  normalizeClassificationResponse,
} from '../src/app/lib/classificationRuntime';

interface Args { user?: string; limit: number; staleMinutes: number; apply: boolean; inline: boolean; }

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.split('=')[1] : undefined;
  };
  return {
    user: get('user'),
    limit: Number(get('limit') ?? 500),
    staleMinutes: Number(get('stale-minutes') ?? 10),
    apply: argv.includes('--apply'),
    inline: argv.includes('--inline'),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const OPENAI_MODEL = process.env.OPENAI_CLASSIFIER_MODEL?.trim() || 'gpt-4o-mini';

// Espelha classifyContent do worker, com backoff simples em 429.
async function classifyInline(description: string): Promise<Record<string, string[]>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY ausente');
  const payload = buildClassificationOpenAiPayload(description, OPENAI_MODEL);

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || 20;
      await sleep((retryAfter + 1) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`OpenAI ${res.status} ${res.statusText}`);
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('Resposta da OpenAI sem conteúdo');
    return normalizeClassificationResponse(JSON.parse(content)) as unknown as Record<string, string[]>;
  }
  throw new Error('Rate limit persistente após retries');
}

async function main() {
  const args = parseArgs();
  await connectToDatabase();

  const staleBefore = new Date(Date.now() - args.staleMinutes * 60_000);
  const query: Record<string, unknown> = {
    classificationStatus: 'pending',
    classificationError: { $in: [null, ''] },
    description: { $exists: true, $nin: [null, ''] },
    updatedAt: { $lte: staleBefore },
  };
  if (args.user) query.user = new Types.ObjectId(args.user);

  const totalOrphans = await MetricModel.countDocuments(query);
  const batch = await MetricModel.find(query)
    .select('_id description user source type')
    .sort({ postDate: -1 })
    .limit(args.limit)
    .lean();

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  RECONCILIAÇÃO DE CLASSIFICAÇÃO (pending órfãos)');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  escopo: ${args.user ? `user ${args.user}` : 'TODOS os usuários'}`);
  console.log(`  estratégia: ${args.inline ? '🧠 INLINE (OpenAI direto)' : '📮 QStash'}`);
  console.log(`  órfãos elegíveis: ${totalOrphans}  |  neste lote (limit ${args.limit}): ${batch.length}`);
  console.log(`  modo: ${args.apply ? '🚀 APPLY' : '🔍 DRY-RUN (nada é alterado)'}`);
  console.log('──────────────────────────────────────────────────────────\n');

  if (!args.apply) {
    batch.slice(0, 10).forEach((m: any) =>
      console.log(`    [dry] ${m._id}  "${String(m.description).replace(/\s+/g, ' ').slice(0, 50)}…"`),
    );
    if (batch.length > 10) console.log(`    … e mais ${batch.length - 10}`);
    console.log(`\n  Para executar: adicione --apply  ${args.inline ? '' : '(ou --inline --apply se o QStash estiver limitado)'}\n`);
    process.exit(0);
  }

  let ok = 0, fail = 0, emptyCtx = 0;

  if (args.inline) {
    for (const m of batch as any[]) {
      try {
        const classification = await classifyInline(m.description);
        const update = buildMetricClassificationUpdate(m, classification as any);
        await MetricModel.updateOne(
          { _id: m._id },
          { $set: { ...update, classificationStatus: 'completed', classificationError: null } },
        );
        ok++;
        if (!update.context?.length) emptyCtx++;
        if (ok % 20 === 0) console.log(`    … ${ok} classificados (${emptyCtx} sem context)`);
        await sleep(300); // gentileza com a API
      } catch (e) {
        fail++;
        console.error(`    ✗ ${m._id}:`, e instanceof Error ? e.message : e);
      }
    }
    console.log(`\n  ✓ classificados: ${ok}  |  falhas: ${fail}  |  destes sem context (texto fraco/emoji): ${emptyCtx}`);
    console.log(`  restantes após este lote: ${Math.max(0, totalOrphans - ok)}\n`);
    process.exit(0);
  }

  // QStash
  const token = process.env.QSTASH_TOKEN;
  const workerUrl = process.env.CLASSIFICATION_WORKER_URL;
  if (!token || !workerUrl) {
    console.error(`\n  ✗ QSTASH_TOKEN/CLASSIFICATION_WORKER_URL ausentes — use --inline.\n`);
    process.exit(1);
  }
  const qstash = new Client({ token });
  for (const m of batch as any[]) {
    try {
      await qstash.publishJSON({ url: workerUrl, body: { metricId: String(m._id) } });
      ok++;
      if (ok % 25 === 0) console.log(`    … ${ok} publicados`);
    } catch (e) {
      fail++;
      console.error(`    ✗ ${m._id}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`\n  ✓ publicados: ${ok}  |  falhas: ${fail}  |  restantes: ${Math.max(0, totalOrphans - ok)}`);
  console.log(`  Worker processa async — verifique o status em alguns minutos.\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
