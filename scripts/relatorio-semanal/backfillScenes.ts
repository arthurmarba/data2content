// scripts/relatorio-semanal/backfillScenes.ts
//
// Confere, contra os reels PUBLICADOS, quais elementos do mapa de cada criador
// apareceram, e grava os papéis canônicos em Metric.sceneElements.
// É o que destrava a tela 03 (assets de vida) e o tom da tela 04.
//
// A pergunta é FECHADA: o prompt leva os itens do mapa daquele criador e pergunta quais
// aparecem. Criador sem mapa é pulado — não há o que conferir.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/relatorio-semanal/backfillScenes.ts --dry-run
//   npx tsx --env-file=.env.local scripts/relatorio-semanal/backfillScenes.ts --limit=20
//   ... --week=2026-W29  (só os vídeos daquela semana — o que completa o relatório dela)
//   ... --days=90        (janela, default 90; ignorado quando --week é usado)
//   ... --limit=200      (teto de vídeos nesta execução — TETO DE CUSTO)
//   ... --user=<id>      (um criador só)
//   ... --media=<id,id>  (somente Reels específicos; útil para completar um PPT)
//
// CUSTO: ~US$ 0,005 por vídeo. 3.300 vídeos (90 dias da base inteira) ≈ US$ 17.
// O --limit existe para isso: rode em lotes e confira o gasto em GeminiUsageLog
// (tag "cena") entre um lote e o outro.

import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../../src/app/lib/mongoose";
import MetricModel from "../../src/app/models/Metric";
import UserModel from "../../src/app/models/User";
import { loadMapProfiles } from "../../src/app/lib/relatorio/mapProfiles";
import { weekWindowFor } from "../../src/app/lib/relatorio/weekWindow";
import {
  SCENE_EVALUATION_VERSION,
  sceneElementsUpdate,
  evaluateSceneAgainstMap,
} from "../../src/app/lib/relatorio/sceneEvaluation";
import { upsertPublishedContentEvidence } from "../../src/app/lib/scripts/publishedContentEvidence";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}
function has(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

const GRAPH_VERSION = process.env.INSTAGRAM_API_VERSION || "v20.0";

async function freshMediaUrl(mediaId: string, token: string): Promise<string | null> {
  const fields = encodeURIComponent("id,media_type,media_url");
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}?fields=${fields}&access_token=${token}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = (await response.json()) as { media_type?: string; media_url?: string };
    if (json.media_type !== "VIDEO") return null;
    return typeof json.media_url === "string" ? json.media_url : null;
  } catch {
    return null;
  }
}

async function main() {
  const dryRun = has("dry-run");
  const days = Number(arg("days") ?? 90);
  const limit = Number(arg("limit") ?? 25);
  const userId = arg("user");
  const mediaIds = (arg("media") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  await connectToDatabase();

  // --week recorta exatamente a semana ISO. É o que completa o relatório DAQUELA semana
  // sem pagar pelo trimestre inteiro: o corte de elegibilidade olha a janela de 90 dias,
  // e a janela inclui a semana corrente, então classificar só a semana já popula o
  // ranking dos papéis mais frequentes.
  const weekKey = arg("week");
  let range: { $gte: Date; $lte?: Date };
  if (weekKey) {
    const match = /^(\d{4})-W(\d{1,2})$/.exec(weekKey.trim());
    if (!match) throw new Error(`Semana inválida: "${weekKey}". Use 2026-W29.`);
    const jan4 = new Date(Date.UTC(Number(match[1]), 0, 4, 12));
    const weekday = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
    const week1Monday = new Date(jan4.getTime() - (weekday - 1) * 86_400_000);
    const week = weekWindowFor(
      new Date(week1Monday.getTime() + (Number(match[2]) - 1) * 7 * 86_400_000),
    );
    range = { $gte: week.startsAt, $lte: week.endsAt };
    console.error(`  recorte: semana ${week.weekKey} · ${week.rangeLabel}`);
  } else {
    range = { $gte: new Date(Date.now() - days * 86_400_000) };
  }

  const query: Record<string, unknown> = {
    postDate: range,
    instagramMediaId: { $ne: null },
    // Só o que ainda não foi lido nesta versão do vocabulário.
    $or: [
      { sceneElements: { $exists: false } },
      { "sceneElements.version": { $ne: SCENE_EVALUATION_VERSION } },
    ],
  };
  if (mediaIds.length > 0) {
    query.instagramMediaId = { $in: mediaIds };
  } else {
    query["stats.video_duration_seconds"] = { $gt: 0 };
  }
  if (userId) {
    query.user = new Types.ObjectId(userId);
  } else {
    // Só criadores COM token. Sem token não há como baixar o mp4, e sem este filtro o
    // `--limit` era consumido por posts que nunca passariam: numa execução de 800, 685
    // foram pulados por falta de token e apenas 1 foi lido. O teto de custo tem que
    // limitar o que pode ser feito, não o que vai ser descartado.
    const comToken = (await UserModel.find(
      { instagramAccessToken: { $nin: [null, ""] } },
      { _id: 1 },
    )
      .lean()
      .exec()) as unknown as Array<{ _id: Types.ObjectId }>;
    query.user = { $in: comToken.map((u) => u._id) };
    console.error(`  ${comToken.length} criadores com token`);
  }

  const total = await MetricModel.countDocuments(query);
  const metrics = await MetricModel.find(query)
    .select("user instagramMediaId stats postDate")
    // Mais NOVOS primeiro: a Graph API deixa de servir `media_url` para mídia antiga.
    .sort({ postDate: -1 })
    .limit(limit)
    .lean<
      Array<{
        _id: Types.ObjectId;
        user: Types.ObjectId;
        instagramMediaId: string;
        stats?: { video_duration_seconds?: number };
        postDate: Date;
      }>
    >();

  const estimated = (metrics.length * 0.005).toFixed(2);
  console.error(
    `\n▸ ${total} vídeos pendentes${weekKey ? ` em ${weekKey}` : ` na janela de ${days} dias`}` +
      ` · processando ${metrics.length} · custo estimado ≈ US$ ${estimated}` +
      `${dryRun ? " · DRY RUN" : ""}`,
  );
  if (metrics.length === 0) {
    await mongoose.disconnect();
    return;
  }

  // O mapa de todos os criadores do lote, de uma vez.
  const creatorIds = [...new Set(metrics.map((m) => String(m.user)))];
  const profiles = await loadMapProfiles(creatorIds);
  console.error(`  ${profiles.size}/${creatorIds.length} criadores do lote têm mapa`);

  // Um token por criador, reaproveitado no lote.
  const tokens = new Map<string, string | null>();
  const tokenFor = async (id: string): Promise<string | null> => {
    if (tokens.has(id)) return tokens.get(id)!;
    const user = await UserModel.findById(id).select("instagramAccessToken").lean<{
      instagramAccessToken?: string;
    }>();
    const token = user?.instagramAccessToken ?? null;
    tokens.set(id, token);
    return token;
  };

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let oversized = 0;

  for (const metric of metrics) {
    const label = `${String(metric._id).slice(-6)} ${metric.postDate.toISOString().slice(0, 10)}`;
    const profile = profiles.get(String(metric.user));
    if (!profile) {
      console.error(`  – ${label}: criador sem mapa — nada a conferir`);
      skipped += 1;
      continue;
    }

    const token = await tokenFor(String(metric.user));
    if (!token) {
      console.error(`  – ${label}: criador sem token`);
      skipped += 1;
      continue;
    }

    const mediaUrl = await freshMediaUrl(metric.instagramMediaId, token);
    if (!mediaUrl) {
      console.error(`  – ${label}: sem media_url de vídeo`);
      skipped += 1;
      continue;
    }

    const outcome = await evaluateSceneAgainstMap({
      mediaUrl,
      durationSeconds: metric.stats?.video_duration_seconds ?? null,
      profile,
    });

    if (!outcome.ok) {
      if (outcome.reason.includes("acima do teto inline")) oversized += 1;
      console.error(`  ✗ ${label}: ${outcome.reason}`);
      failed += 1;
      continue;
    }

    const scene = outcome.result;
    console.error(
      `  ✓ ${label}: [${scene.assetRoleIds.join(", ") || "—"}] · tom ` +
        `${scene.toneIds.join(", ") || "—"} · assunto ` +
        `${scene.subjectIds.join(", ") || "—"}${scene.offMap ? " · FORA DO MAPA" : ""}`,
    );

    if (!dryRun) {
      try {
        await upsertPublishedContentEvidence({
          metricId: String(metric._id),
          scene,
        });
        await MetricModel.updateOne(
          { _id: metric._id },
          { $set: { sceneElements: sceneElementsUpdate(scene) } },
        );
      } catch (error) {
        console.error(`  ✗ ${label}: falha ao persistir evidência integral — ${error instanceof Error ? error.message : String(error)}`);
        failed += 1;
        continue;
      }
    }
    ok += 1;
  }

  console.error(
    `\n${ok} lidos · ${skipped} pulados · ${failed} falharam` +
      `${oversized > 0 ? ` (${oversized} por tamanho)` : ""}` +
      `${dryRun ? " (dry run — nada gravado)" : ""}`,
  );
  console.error(
    `Restam ${Math.max(0, total - ok)} vídeos. Confira o gasto real:\n` +
      `  db.geminiusagelogs.aggregate([{$match:{tag:"cena"}},{$group:{_id:null,` +
      `in:{$sum:"$promptTokens"},out:{$sum:"$outputTokens"},n:{$sum:1}}}])`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("\n✗ falhou:", error instanceof Error ? error.stack : error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
