import { createHash } from 'node:crypto';
import { canonicalToneById } from '@/app/lib/relatorio/mapRegistry';
import { acquireReading, checkpointReading, finishReading } from '@/app/lib/relatorio/contentReadingState';
import type { IMapaData } from '@/app/models/MapaSeed';
import type { InstagramPatterns } from './analyzeInstagramPosts';
// src/app/lib/mapaSeed/enrichMapaSeedForUser.ts
//
// Enriquece o MapaSeed de um usuário com seus posts recentes do Instagram.
// Chamado pelo worker QStash após sync de dados do Instagram.
// Chamadas antigas seguem tolerantes a falhas; a fila recebe o estado explícito.

import { logger } from "@/app/lib/logger";
import { getInstagramConnectionDetails } from "@/app/lib/instagram/db/userActions";
import { fetchInstagramMedia } from "@/app/lib/instagram/api/fetchers";
import { analyzeInstagramPosts } from "./analyzeInstagramPosts";
import { enrichMapaWithInstagram } from "./enrichMapaWithInstagram";
import MapaSeedModel from "@/app/models/MapaSeed";
import MetricModel from "@/app/models/Metric";
import ContentReadingState from '@/app/models/ContentReadingState';
import { getMapConfirmationsSnapshot } from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";
import { connectToDatabase } from "@/app/lib/mongoose";

const TAG = "[enrichMapaSeedForUser]";
// Alvo de posts para a análise narrativa. A API do IG devolve em ordem
// cronológica reversa, ~25 por página; paginamos até este alvo para dar ao
// Gemini uma amostra mais representativa da narrativa do criador (e não só o
// recorte mais recente, que pode ser atípico). Sem filtro de data — isso
// machucaria quem posta pouco. A leitura visual cara segue limitada (12 thumbs).
const TARGET_POSTS = 60;
// Teto de páginas para limitar latência do enriquecimento on-connect (60 ÷ 25 ≈ 3).
const MAX_MEDIA_PAGES = 3;
// Só re-enriquece se o mapa foi criado/atualizado há mais de X horas,
// evitando re-processamento desnecessário em reconexões rápidas.
const MIN_HOURS_BETWEEN_ENRICHMENTS = 12;

export async function enrichMapaSeedWithInstagram(userId: string): Promise<'complete' | 'deferred' | void> {
  let lease: { token: string; result?: Record<string, any> | null } | null = null;
  const readingKey = `mapa:instagram:${userId}`;
  try {
    await connectToDatabase();

    // Auto-cura: se o usuário ainda não tem MapaSeed (ex.: onboardou antes da
    // criação automática, ou nunca declarou propósito), cria um seed vazio para
    // que a própria análise do Instagram preencha narrativa/territórios/tom logo
    // abaixo. Remove a dependência do backfill para o caminho de Instagram.
    let mapaDoc = await MapaSeedModel.findOne({ userId });
    if (!mapaDoc) {
      mapaDoc = await MapaSeedModel.create({
        userId,
        mapa: { maturidade: "seed", fonte: ["instagram"] },
      });
      logger.info(`${TAG} MapaSeed ausente — criado seed vazio para enriquecer via Instagram. userId=${userId}`);
    }

    // Throttle por fonte: usa o timestamp dedicado do Instagram, não `maturidade`
    // nem `updatedAt` (que o stream de vídeo também mexe). Se nunca foi enriquecido
    // por IG (`instagramEnrichedAt` ausente), sempre roda.
    const instagramEnrichedAt: Date | undefined =
      mapaDoc.instagramEnrichedAt instanceof Date ? mapaDoc.instagramEnrichedAt : undefined;
    if (instagramEnrichedAt) {
      const horasSinceEnrichment = (Date.now() - instagramEnrichedAt.getTime()) / (1000 * 60 * 60);
      if (horasSinceEnrichment < MIN_HOURS_BETWEEN_ENRICHMENTS) {
        logger.info(
          `${TAG} MapaSeed já enriquecido por Instagram há ${horasSinceEnrichment.toFixed(1)}h para userId=${userId} — ignorado.`,
        );
        return;
      }
    }

    const igConnection = await getInstagramConnectionDetails(userId);
    if (!igConnection?.accessToken || !igConnection?.accountId) {
      logger.warn(`${TAG} Instagram não conectado para userId=${userId} — enriquecimento ignorado.`);
      return;
    }

    const firstPage = await fetchInstagramMedia(igConnection.accountId, igConnection.accessToken);
    if (!firstPage.success || !firstPage.data?.length) {
      logger.warn(
        `${TAG} Sem posts para userId=${userId}: ${firstPage.error ?? "lista vazia"} — enriquecimento ignorado.`,
      );
      return;
    }

    // Pagina até TARGET_POSTS (ou esgotar páginas/teto) para uma amostra mais rica.
    // Best-effort: se uma página seguinte falhar, segue com o que já coletou.
    const collected = [...firstPage.data];
    let nextPageUrl = firstPage.nextPageUrl ?? null;
    let pages = 1;
    while (collected.length < TARGET_POSTS && nextPageUrl && pages < MAX_MEDIA_PAGES) {
      const page = await fetchInstagramMedia(
        igConnection.accountId,
        igConnection.accessToken,
        nextPageUrl,
      );
      if (!page.success || !page.data?.length) break;
      collected.push(...page.data);
      nextPageUrl = page.nextPageUrl ?? null;
      pages += 1;
    }

    const posts = collected.slice(0, TARGET_POSTS);
    logger.info(`${TAG} ${posts.length} posts recuperados (${pages} página(s)) para userId=${userId}.`);

    const extracted = await MetricModel.find({ user: userId, instagramMediaId: { $in: posts.map(post => post.id) }, 'sceneElements.version': { $exists: true } })
      .select('instagramMediaId postLink type sceneElements').lean();
    const sourceRevision = createHash('sha256').update(JSON.stringify({
      posts: posts.map(post => ({ id: post.id, caption: post.caption })),
      readings: extracted.map(metric => ({ id: metric.instagramMediaId, scene: metric.sceneElements })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    })).digest('hex');
    if (mapaDoc.instagramSourceRevision === sourceRevision) return;
    lease = await acquireReading(readingKey, `${sourceRevision}:${mapaDoc.__v ?? 0}`);
    if (!lease) return;
    await MapaSeedModel.updateOne({ _id: mapaDoc._id }, { $set: { enrichmentStatus: { attemptedAt: new Date(), state: 'processing' } } }, { timestamps: false });
    if (extracted.length < 3 && !lease.result?.patterns) {
      const provider = await ContentReadingState.findById('provider:gemini').select('state').lean();
      if (provider && provider.state !== 'healthy') throw new Error('Leitura visual temporariamente indisponível');
    }
    // A extração visual já paga é a fonte preferencial; só o primeiro mapa sem
    // corpus suficiente usa a leitura de mídia do onboarding.
    const list = (values: unknown[]) => [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))].slice(0, 20);
    const padroes: InstagramPatterns = lease.result?.patterns ?? (extracted.length >= 3 ? {
      temas_recorrentes: list(extracted.flatMap(metric => metric.sceneElements?.subjects ?? [])),
      tom_real: list(extracted.flatMap(metric => metric.sceneElements?.toneIds ?? []).map(id => canonicalToneById(id)?.label ?? id)).join(', '),
      formatos_usados: list(extracted.map(metric => metric.type === 'IMAGE' ? 'Foto' : metric.type === 'CAROUSEL_ALBUM' ? 'Carrossel' : 'Vídeo')),
      assets_identificados: list(extracted.flatMap(metric => metric.sceneElements?.objects ?? [])),
      ausencias_notaveis: [], amostragem: extracted.length >= 10 ? 'suficiente' : 'baixa',
    } : await analyzeInstagramPosts(posts, { resonanceByMediaId: await buildResonanceMap(userId, posts.map(post => post.id)) }));
    if (!lease.result?.patterns) await checkpointReading(readingKey, lease.token, { patterns: padroes });

    // Estabilidade do núcleo (G3): se o criador já confirmou narrativa/tom, o IG
    // não sobrescreve. Non-fatal — sem confirmações, locks ficam falsos (comportamento
    // anterior: IG enriquece livremente o núcleo ainda não confirmado).
    const confirmations = await getMapConfirmationsSnapshot(userId);
    const locks = {
      narrativeLocked: confirmations?.narrative === "confirmed",
      toneLocked: confirmations?.tone === "confirmed",
    };

    const mapaEnriquecido: IMapaData = lease.result?.mapa ?? await enrichMapaWithInstagram(
      mapaDoc.mapa,
      padroes,
      locks,
      { source: 'instagram', revision: sourceRevision, evidence: extracted.length >= 3
        ? extracted.map(metric => ({ id: String(metric.instagramMediaId), url: metric.postLink ?? null }))
        : posts.map(post => ({ id: post.id })) },
    );

    await checkpointReading(readingKey, lease.token, { patterns: padroes, mapa: mapaEnriquecido });
    mapaDoc.mapa = mapaEnriquecido;
    mapaDoc.instagramEnrichedAt = new Date();
    mapaDoc.instagramSourceRevision = sourceRevision;
    mapaDoc.enrichmentStatus = { attemptedAt: new Date(), state: 'complete' };
    await mapaDoc.save();
    await finishReading(readingKey, lease.token);

    logger.info(
      `${TAG} MapaSeed enriquecido para userId=${userId}. Maturidade: ${mapaEnriquecido.maturidade}`,
    );
    return 'complete';
  } catch (err) {
    if (lease) await finishReading(readingKey, lease.token, 'Falha temporária no enriquecimento do mapa').catch(() => undefined);
    await MapaSeedModel.updateOne({ userId }, { $set: { enrichmentStatus: {
      attemptedAt: new Date(), state: 'deferred', reason: 'map_enrichment_failed', nextAttemptAt: new Date(Date.now() + 30 * 60000),
    } } }).catch(() => undefined);
    // Non-fatal: nunca quebra o caller
    logger.warn(`${TAG} Falha ao enriquecer MapaSeed para userId=${userId}:`, err);
    return 'deferred';
  }
}

/**
 * Monta um mapa instagramMediaId → (saves + shares) a partir dos Metric docs já
 * salvos por triggerDataRefresh. Non-fatal: qualquer falha devolve mapa vazio,
 * e a leitura visual cai para seleção por recência.
 */
async function buildResonanceMap(
  userId: string,
  mediaIds: string[],
): Promise<Map<string, number>> {
  const resonance = new Map<string, number>();
  if (mediaIds.length === 0) return resonance;
  try {
    const metrics = await MetricModel.find({
      user: userId,
      instagramMediaId: { $in: mediaIds },
    })
      .select("instagramMediaId stats.saved stats.shares")
      .lean();

    for (const m of metrics as Array<{ instagramMediaId?: string | null; stats?: { saved?: number; shares?: number } }>) {
      if (!m.instagramMediaId) continue;
      const saved = typeof m.stats?.saved === "number" ? m.stats.saved : 0;
      const shares = typeof m.stats?.shares === "number" ? m.stats.shares : 0;
      resonance.set(m.instagramMediaId, saved + shares);
    }
  } catch (err) {
    logger.warn(`${TAG} Falha ao montar mapa de ressonância (ignorada):`, err);
  }
  return resonance;
}
