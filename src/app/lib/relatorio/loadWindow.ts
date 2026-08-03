/**
 * loadWindow.ts — a única leitura de banco do relatório.
 *
 * Carrega a janela inteira (semana + 90 dias) uma vez, converte para `ReportPost` e
 * entrega em memória. Dali pra frente todo o cálculo é função pura sobre array —
 * testável sem Mongo e determinístico.
 *
 * Escala: a base tem ~3.300 posts em 90 dias. Carregar tudo custa alguns MB e uma
 * query; fazer 20 agregações no Mongo custaria 20 round-trips e espalharia a regra
 * de negócio por pipelines difíceis de testar. Se a base crescer 100×, o lugar de
 * otimizar é aqui, sem tocar no resto.
 */

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import { idsToLabels } from "@/app/lib/classification";
import { v2IdsToLabels } from "@/app/lib/classificationV2";
import { logger } from "@/app/lib/logger";
import { durationBucketFor, extractAbsoluteMetrics,
  extractRawMetrics, rawRetention, type ReportPost } from "./postMetrics";
import { currentAssetRoleId } from "./mapRegistry";
import { loadMapProfiles, territoryEvidence, type MapProfile, type TerritoryEvidence } from "./mapProfiles";
import { resolveTerritoryForContexts } from "./territories";
import type { WeekWindow } from "./weekWindow";

const TAG = "[relatorio][loadWindow]";

export interface CreatorProfile {
  id: string;
  name: string;
  handle: string | null;
  /** Foto de perfil, para os destaques terem rosto. */
  avatarUrl: string | null;
  isFreePlan: boolean;
}

export interface WindowData {
  week: WeekWindow;
  /** Todos os posts da janela de 90 dias, com `isWeek` derivável pela data. */
  posts: ReportPost[];
  /** Só os posts da semana do relatório. */
  weekPosts: ReportPost[];
  creators: Map<string, CreatorProfile>;
  /** Criadores com Instagram conectado — o universo que o relatório pode analisar. */
  connectedCreatorIds: Set<string>;
  /**
   * O mapa de cada criador, resolvido para o canônico. É a FONTE de território,
   * narrativa, asset e tom — o card "Seu Mapa" é o dicionário do relatório.
   */
  mapProfiles: Map<string, MapProfile>;
  /**
   * Onde a classificação dos posts divergiu do mapa. Não altera nenhum número; serve
   * para a reunião ("seu mapa diz Paternidade e sua semana foi toda Cozinha") e para
   * sinalizar que o card precisa ser revisitado.
   */
  evidence: TerritoryEvidence[];
}

interface RawMetric {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  postDate: Date;
  context?: unknown;
  proposal?: unknown;
  tone?: unknown;
  format?: unknown;
  contentIntent?: unknown;
  narrativeForm?: unknown;
  lifeAssets?: unknown;
  sceneElements?: {
    assetRoleIds?: string[];
    toneIds?: string[];
    subjectIds?: string[];
    subjects?: string[];
    objects?: string[];
    quotes?: string[];
    placeId?: string | null;
    framingIds?: string[];
    aestheticIds?: string[];
    screenTitle?: string | null;
    openingLine?: string | null;
    offMap?: boolean;
    version?: string;
  } | null;
  description?: string;
  postLink?: string;
  thumbnailUrl?: string | null;
  coverUrl?: string | null;
  stats?: Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  return typeof value === "string" && value.trim() ? [value] : [];
}

/**
 * Assunto = sobre o que o vídeo FALOU. Só do mapa, sem fallback.
 *
 * O fallback para `contentIntent` existiu enquanto a janela não estava avaliada, e foi
 * removido quando ficou claro que ele NÃO some sozinho: os criadores sem token nunca
 * são avaliados, então a tabela ficaria permanentemente com dois vocabulários — "Criar
 * filho" (assunto real, do mapa) ao lado de "Converter" (intenção, inferida da
 * legenda). São coisas diferentes disputando as mesmas linhas, e o leitor não tem como
 * saber qual é qual.
 *
 * Mesma regra do tom e dos assets: o mapa é o dicionário. Post não avaliado não
 * contribui para o ranking de assunto — e a tabela fica menor e verdadeira em vez de
 * maior e ambígua.
 */
function assuntosOf(metric: RawMetric): string[] {
  return unique(asStringArray(metric.sceneElements?.subjectIds));
}

/**
 * Tom: só os tons DO MAPA que o vídeo confirmou. Sem fallback para a legenda.
 *
 * O `tone` da legenda é SENTIMENTO (6 valores: humorístico, inspirador, educacional,
 * crítico, neutro, promocional), não jeito de falar. Misturar os dois na mesma tabela
 * põe "Humor" (do mapa) e "Humorístico" (da legenda) como duas linhas para a mesma
 * coisa — a fragmentação de rótulo que divide as ocorrências e derruba as duas do
 * corte. Aconteceu na primeira execução com a avaliação de cena ligada.
 *
 * Consequência aceita: a tabela de tom fica vazia enquanto a avaliação de cena não
 * cobrir o território, e diz por quê. Vazio honesto é melhor que populado com um
 * vocabulário que não é o do mapa.
 */
function tonsOf(metric: RawMetric): string[] {
  return unique(asStringArray(metric.sceneElements?.toneIds));
}

/**
 * Formato. Mesma regra de precedência: cena (quando lida do vídeo) → v2 → v1. Um só
 * nível por post, para não fragmentar o ranking.
 */
function formatosOf(metric: RawMetric): string[] {
  const narrative = v2IdsToLabels(asStringArray(metric.narrativeForm), "narrativeForm");
  if (narrative.length > 0) return unique(narrative);
  return unique(idsToLabels(asStringArray(metric.format), "format"));
}

/**
 * Assets de vida: os PAPÉIS do mapa que o vídeo confirmou.
 *
 * Só isto — não há fallback. `lifeAssets` (do fluxo de upload pré-publicação) guarda
 * rótulo livre e nomeia indivíduo, então não pode alimentar um ranking coletivo. Sem a
 * avaliação de cena, a tela 03 fica honestamente vazia em vez de ser preenchida com um
 * proxy que não é asset.
 */
function assetsOf(metric: RawMetric): string[] {
  // Normaliza chaves renomeadas: o banco guarda a chave do dia em que foi avaliado.
  return unique(asStringArray(metric.sceneElements?.assetRoleIds).map(currentAssetRoleId));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function toReportPost(metric: RawMetric): ReportPost {
  const stats = metric.stats ?? {};
  const durationSeconds =
    typeof stats.video_duration_seconds === "number" && stats.video_duration_seconds > 0
      ? stats.video_duration_seconds
      : null;

  return {
    id: String(metric._id),
    creatorId: String(metric.user),
    postDate: new Date(metric.postDate),
    // `territoryId` fica null aqui e é preenchido em `loadWindow` com o território DO
    // MAPA de quem postou. O território que a legenda sugere vai para
    // `observedTerritoryId`, como evidência.
    territoryId: null,
    observedTerritoryId: resolveTerritoryForContexts(metric.context)?.id ?? null,
    raw: extractRawMetrics(stats),
    absolute: extractAbsoluteMetrics(stats),
    rawRetentionValue: rawRetention(stats),
    durationSeconds,
    durationBucket: durationBucketFor(durationSeconds)?.key ?? null,
    assuntos: assuntosOf(metric),
    tons: tonsOf(metric),
    formatos: formatosOf(metric),
    assets: assetsOf(metric),
    temas: asStringArray(metric.sceneElements?.subjects),
    objetos: asStringArray(metric.sceneElements?.objects),
    falas: asStringArray(metric.sceneElements?.quotes),
    local: (metric.sceneElements?.placeId as string | undefined) ?? null,
    enquadramentos: asStringArray(metric.sceneElements?.framingIds),
    esteticas: asStringArray(metric.sceneElements?.aestheticIds),
    screenTitle: (metric.sceneElements?.screenTitle as string | undefined) ?? null,
    sceneRead: Boolean(metric.sceneElements?.version),
    openingLine: (metric.sceneElements?.openingLine as string | undefined) ?? null,
    postLink: metric.postLink ?? null,
    thumbnailUrl: metric.thumbnailUrl ?? metric.coverUrl ?? null,
    description: typeof metric.description === "string" ? metric.description : "",
  };
}

const PROJECTION = {
  user: 1,
  postDate: 1,
  context: 1,
  proposal: 1,
  tone: 1,
  format: 1,
  contentIntent: 1,
  narrativeForm: 1,
  lifeAssets: 1,
  sceneElements: 1,
  description: 1,
  postLink: 1,
  thumbnailUrl: 1,
  coverUrl: 1,
  stats: 1,
} as const;

/**
 * Carrega a janela. Só posts classificados entram: um post com
 * `classificationStatus` pendente não tem assunto nem tom, e contá-lo no
 * denominador do território empurraria todas as médias para baixo.
 */
export async function loadWindow(week: WeekWindow): Promise<WindowData> {
  await connectToDatabase();

  const metrics = (await MetricModel.find(
    {
      postDate: { $gte: week.windowStartsAt, $lte: week.endsAt },
      classificationStatus: "completed",
    },
    PROJECTION,
  )
    .lean()
    .exec()) as unknown as RawMetric[];

  const rawPosts = metrics.map(toReportPost);
  const creatorIds = unique(rawPosts.map((post) => post.creatorId));

  // O MAPA define o território. Carregado antes de qualquer cálculo, porque é dele que
  // o post herda o território — a classificação da legenda fica só como evidência.
  const mapProfiles = await loadMapProfiles(creatorIds);
  const posts = rawPosts.map((post) => ({
    ...post,
    territoryId: mapProfiles.get(post.creatorId)?.primaryTerritoryId ?? null,
  }));
  const weekPosts = posts.filter(
    (post) => post.postDate >= week.startsAt && post.postDate <= week.endsAt,
  );
  const evidence = territoryEvidence(
    weekPosts.map((post) => ({
      creatorId: post.creatorId,
      observedTerritoryId: post.observedTerritoryId,
    })),
    mapProfiles,
  );

  const users = (await UserModel.find(
    { _id: { $in: creatorIds.map((id) => new Types.ObjectId(id)) } },
    { name: 1, username: 1, planStatus: 1, isInstagramConnected: 1, profile_picture_url: 1 },
  )
    .lean()
    .exec()) as unknown as Array<{
    _id: Types.ObjectId;
    name?: string;
    username?: string | null;
    planStatus?: string;
    isInstagramConnected?: boolean;
    profile_picture_url?: string | null;
  }>;

  const creators = new Map<string, CreatorProfile>();
  const connectedCreatorIds = new Set<string>();
  for (const user of users) {
    const id = String(user._id);
    creators.set(id, {
      id,
      name: user.name?.trim() || user.username?.trim() || "Criador sem nome",
      handle: user.username?.trim() || null,
      avatarUrl: user.profile_picture_url?.trim() || null,
      isFreePlan: user.planStatus !== "active",
    });
    if (user.isInstagramConnected) connectedCreatorIds.add(id);
  }

  // MÉTRICAS ÓRFÃS: o post existe, o dono não.
  //
  // Duas contas apagadas deixaram 59 posts na janela (2%), e um deles era o vídeo nº 1
  // de Treino — "Criador · 44,2× comentários", sem nome, sem @, sem ninguém para
  // comemorar. Pior que feio: uma conta que não existe mais estava definindo a mediana
  // do território e ocupando o destaque de quem continua postando.
  //
  // O relatório é sobre gente da comunidade. Quem saiu sai do cálculo.
  const orfaos = posts.filter((post) => !creators.has(post.creatorId));
  if (orfaos.length > 0) {
    const donos = new Set(orfaos.map((post) => post.creatorId));
    logger.info(
      `${TAG} ${orfaos.length} posts de ${donos.size} conta(s) apagada(s) fora do cálculo.`,
    );
  }
  const posts_ = posts.filter((post) => creators.has(post.creatorId));
  const weekPosts_ = weekPosts.filter((post) => creators.has(post.creatorId));

  const semTerritorio = weekPosts_.filter((post) => post.territoryId === null).length;
  logger.info(
    `${TAG} semana ${week.weekKey}: ${weekPosts.length} posts na semana, ` +
      `${posts_.length} na janela de 90 dias, ${creators.size} criadores, ` +
      `${mapProfiles.size} com mapa. ${semTerritorio} posts da semana sem território ` +
      `(criador sem mapa ou com mapa que não resolve).`,
  );

  return {
    week,
    posts: posts_,
    weekPosts: weekPosts_,
    creators,
    connectedCreatorIds,
    mapProfiles,
    evidence,
  };
}

/** Posts de um território, dentro de um recorte. */
export function postsOfTerritory(
  posts: readonly ReportPost[],
  territoryId: string,
): ReportPost[] {
  return posts.filter((post) => post.territoryId === territoryId);
}
