/**
 * collectPlatform.ts — as telas que não são de território: capa, visão geral,
 * comparação entre territórios, destaques e quem não postou.
 */

import { medianOf, roundIndex, type ReportPost } from "./postMetrics";
import {
  canonicalAssetRoleById,
  canonicalFramingById,
  canonicalPlaceById,
  canonicalSubjectById,
  canonicalTerritoryById,
  canonicalToneById,
} from "./mapRegistry";
import { gridPosition } from "./weekWindow";
import type { CollectedTerritory } from "./collectTerritory";
import type {
  CrossTerritoryRow,
  Highlight,
  MetricIndex,
  Movement,
  OverviewRow,
  ReportMetric,
  TerritoryGap,
} from "./types";

export interface CreatorLike {
  avatarUrl?: string | null;
  id: string;
  name: string;
  handle: string | null;
  isFreePlan: boolean;
}

const OVERVIEW_COLUMNS: ReportMetric[] = [
  "curtidas",
  "comentarios",
  "compartilhamentos",
  "salvamentos",
  "retencao",
];

/**
 * Visão geral (tela 02). Cada território comparado com a base da PLATAFORMA na janela
 * — este é o único lugar do relatório em que o denominador é global, e é o que torna a
 * comparação entre territórios legítima aqui. Mediana, pelo mesmo motivo do
 * rankingEngine: um post viral não é um território.
 */
export function collectOverview(
  windowPosts: readonly ReportPost[],
  weekPosts: readonly ReportPost[],
  territoryIds: readonly string[],
  previousRanks: Map<string, number> | null,
  movementWeeksBack: number,
): OverviewRow[] {
  const platformBaseline = new Map<ReportMetric, number | null>();
  for (const metric of OVERVIEW_COLUMNS) {
    platformBaseline.set(metric, medianOf(windowPosts.map((post) => post.raw[metric] ?? null)));
  }

  const rows = territoryIds.map((territoryId) => {
    const inTerritory = weekPosts.filter((post) => post.territoryId === territoryId);
    const metrics: MetricIndex[] = [];
    for (const metric of OVERVIEW_COLUMNS) {
      const mean = medianOf(inTerritory.map((post) => post.raw[metric] ?? null));
      const platform = platformBaseline.get(metric);
      if (mean === null || !platform || platform <= 0) continue;
      metrics.push({ metric, index: roundIndex(mean / platform) });
    }
    return {
      territoryId,
      label: canonicalTerritoryById(territoryId)?.label ?? territoryId,
      posts: inTerritory.length,
      creators: new Set(inTerritory.map((post) => post.creatorId)).size,
      metrics,
      movement: null as Movement | null,
    };
  });

  // Ordenado por engajamento, como o slide declara.
  const ordered = [...rows].sort((a, b) => {
    const indexOf = (row: OverviewRow) =>
      row.metrics.find((m) => m.metric === "comentarios")?.index ?? 0;
    return indexOf(b) - indexOf(a) || a.territoryId.localeCompare(b.territoryId);
  });

  return ordered.map((row, position) => {
    const rank = position + 1;
    let movement: Movement | null = null;
    if (previousRanks) {
      const previous = previousRanks.get(row.territoryId);
      if (previous === undefined) {
        movement = { kind: "new", delta: 0, comparedWeeksBack: movementWeeksBack };
      } else {
        const delta = previous - rank;
        movement =
          Math.abs(delta) <= 1
            ? { kind: "stable", delta: 0, comparedWeeksBack: movementWeeksBack }
            : {
                kind: delta > 0 ? "up" : "down",
                delta: Math.abs(delta),
                comparedWeeksBack: movementWeeksBack,
              };
      }
    }
    return { ...row, movement };
  });
}

/** Variação percentual de engajamento de uma semana sobre a anterior. */
export function engagementDeltaPct(
  currentWeekPosts: readonly ReportPost[],
  previousWeekPosts: readonly ReportPost[],
): number | null {
  const current = medianOf(currentWeekPosts.map((post) => post.raw.engajamento ?? null));
  const previous = medianOf(previousWeekPosts.map((post) => post.raw.engajamento ?? null));
  if (current === null || previous === null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Comparação entre territórios (tela 19) ──────────────────────────────────

export const MIN_CROSS_TERRITORY_CELL = 5;

/**
 * O mesmo elemento nos N territórios. É a única tela em que comparar territórios é
 * honesto: o elemento é o mesmo e cada coluna é o índice DENTRO do seu território,
 * então o que se lê é "funciona aqui e não funciona ali" — não "aqui é melhor".
 *
 * Só entra elemento que aparece em pelo menos DOIS territórios com amostra. Um
 * elemento que só existe num lugar não tem comparação para fazer.
 */
export function collectCrossTerritory(
  windowPosts: readonly ReportPost[],
  territoryIds: readonly string[],
  metric: ReportMetric = "compartilhamentos",
  limit = 5,
): CrossTerritoryRow[] {
  // `read` devolve a CHAVE do elemento; `label` traduz para o rótulo do slide. Sem essa
  // segunda função, a tela 19 imprimia "sozinho_na_cena" cru — a Regra 3 escapando por
  // uma porta que ficou aberta, já que asset e tom são chaves canônicas desde a Fase 10.
  const dimensions: {
    kind: "assunto" | "tom" | "asset";
    read: (p: ReportPost) => string[];
    label: (key: string) => string;
  }[] = [
    // `label: (key) => key` deixava "corpo_e_treino" cru na comparação entre
    // territórios. Mesmo bug do combinado, mesmo remédio: o registro traduz.
    {
      kind: "assunto",
      read: (p) => p.assuntos,
      label: (key) => canonicalSubjectById(key)?.label ?? key,
    },
    { kind: "tom", read: (p) => p.tons, label: (key) => canonicalToneById(key)?.label ?? key },
    {
      kind: "asset",
      read: (p) => p.assets,
      label: (key) => canonicalAssetRoleById(key)?.label ?? key,
    },
  ];

  const territoryBaseline = new Map<string, number | null>();
  for (const territoryId of territoryIds) {
    territoryBaseline.set(
      territoryId,
      medianOf(
        windowPosts
          .filter((post) => post.territoryId === territoryId)
          .map((post) => post.raw[metric] ?? null),
      ),
    );
  }

  interface Candidate {
    label: string;
    kind: "assunto" | "tom" | "asset";
    byTerritory: Map<string, { values: (number | null)[]; creators: Set<string> }>;
  }
  const candidates = new Map<string, Candidate>();

  for (const post of windowPosts) {
    if (!post.territoryId || !territoryIds.includes(post.territoryId)) continue;
    for (const dimension of dimensions) {
      for (const elementKey of dimension.read(post)) {
        const key = `${dimension.kind}|${elementKey}`;
        const candidate =
          candidates.get(key) ??
          { label: dimension.label(elementKey), kind: dimension.kind, byTerritory: new Map() };
        const cell =
          candidate.byTerritory.get(post.territoryId) ??
          { values: [], creators: new Set<string>() };
        cell.values.push(post.raw[metric] ?? null);
        cell.creators.add(post.creatorId);
        candidate.byTerritory.set(post.territoryId, cell);
        candidates.set(key, candidate);
      }
    }
  }

  const scored: { row: CrossTerritoryRow; spread: number }[] = [];

  for (const candidate of candidates.values()) {
    const byTerritory: { territoryId: string; index: number | null }[] = [];
    const usableIndexes: number[] = [];

    for (const territoryId of territoryIds) {
      const cell = candidate.byTerritory.get(territoryId);
      const mean = territoryBaseline.get(territoryId);
      if (
        !cell ||
        cell.values.filter((v) => v !== null).length < MIN_CROSS_TERRITORY_CELL ||
        !mean ||
        mean <= 0
      ) {
        byTerritory.push({ territoryId, index: null });
        continue;
      }
      const cellMean = medianOf(cell.values);
      if (cellMean === null) {
        byTerritory.push({ territoryId, index: null });
        continue;
      }
      const index = roundIndex(cellMean / mean);
      byTerritory.push({ territoryId, index });
      usableIndexes.push(index);
    }

    if (usableIndexes.length < 2) continue;
    const spread = Math.max(...usableIndexes) - Math.min(...usableIndexes);
    scored.push({
      row: { label: candidate.label, kind: candidate.kind, metric, byTerritory, reading: null },
      spread,
    });
  }

  // Maior divergência primeiro: é ela que carrega a tela.
  return scored
    .sort((a, b) => b.spread - a.spread || a.row.label.localeCompare(b.row.label))
    .slice(0, limit)
    .map(({ row }) => row);
}

/**
 * Dica de lacuna por território: um elemento que vai bem em outro território e
 * quase não aparece aqui. Alimenta o segundo box da tela 05.
 */
export function crossTerritoryHints(
  rows: readonly CrossTerritoryRow[],
  territoryIds: readonly string[],
): Map<string, TerritoryGap> {
  const hints = new Map<string, TerritoryGap>();

  for (const territoryId of territoryIds) {
    for (const row of rows) {
      const here = row.byTerritory.find((cell) => cell.territoryId === territoryId);
      if (!here || here.index !== null) continue;
      const elsewhere = row.byTerritory
        .filter((cell) => cell.territoryId !== territoryId && cell.index !== null)
        .sort((a, b) => (b.index ?? 0) - (a.index ?? 0))[0];
      if (!elsewhere || (elsewhere.index ?? 0) < 1.4) continue;
      const otherLabel = canonicalTerritoryById(elsewhere.territoryId)?.label ?? elsewhere.territoryId;
      hints.set(territoryId, {
        title: row.label,
        detail: `Quase não aparece aqui. Em ${otherLabel} é o que mais ${row.metric === "compartilhamentos" ? "compartilha" : "engaja"}.`,
      });
      break;
    }
  }

  return hints;
}

// ─── Destaques (tela 20) ─────────────────────────────────────────────────────

/**
 * Cada prêmio compara a pessoa COM ELA MESMA. Nenhum destaque é "o melhor da base" —
 * isso premiaria quem tem mais seguidor toda semana. O denominador é sempre a média
 * do próprio criador na janela.
 */
export function collectHighlights(
  windowPosts: readonly ReportPost[],
  weekPosts: readonly ReportPost[],
  creators: Map<string, CreatorLike>,
  territories: readonly { territoryId: string; collected: CollectedTerritory }[],
  previousWinners: ReadonlySet<string> = new Set(),
): Highlight[] {
  const highlights: Highlight[] = [];

  /**
   * UM PRÊMIO POR PESSOA, POR SEMANA.
   *
   * Na primeira execução com os prêmios novos, Débora levou quatro dos oito: destaque
   * do território, coragem, vídeo da comunidade e a frase da semana. É consequência
   * lógica — quem teve a melhor semana tende a liderar todos os recortes — e é péssimo
   * para o que a seção existe: com 33 pessoas postando e um pódio dominado por uma, os
   * outros 32 leem a abertura do relatório como uma lista de que não são eles.
   *
   * Já existia a regra de não repetir na semana seguinte (`previousWinners`). Faltava a
   * do mesmo dia. O destaque de território vem primeiro e é o mais importante; os
   * demais pulam quem já subiu.
   */
  const jaPremiados = new Set<string>();
  const disponivel = (creatorId: string) =>
    !jaPremiados.has(creatorId) && !previousWinners.has(creatorId);

  /**
   * Posts mínimos do criador na janela para ele concorrer a destaque.
   *
   * "Cada prêmio compara a pessoa com ela mesma" só vale se a pessoa TEM uma média
   * própria. Com 2 posts na janela, a base é a mediana de dois números e qualquer post
   * bom vira "29,2× o próprio compartilhamento" — número verdadeiro que parece erro e
   * premia quem tem pouca história, não quem se superou.
   */
  const MIN_HIGHLIGHT_SAMPLE = 5;
  const postsByCreator = new Map<string, number>();
  for (const post of windowPosts) {
    postsByCreator.set(post.creatorId, (postsByCreator.get(post.creatorId) ?? 0) + 1);
  }
  const hasOwnBaseline = (creatorId: string) =>
    (postsByCreator.get(creatorId) ?? 0) >= MIN_HIGHLIGHT_SAMPLE;

  // Base de engajamento de cada criador na janela — o denominador de "a própria média".
  const engagementByCreator = new Map<string, (number | null)[]>();
  for (const post of windowPosts) {
    const list = engagementByCreator.get(post.creatorId) ?? [];
    list.push(post.raw.engajamento ?? null);
    engagementByCreator.set(post.creatorId, list);
  }
  const creatorMean = new Map<string, number | null>(
    [...engagementByCreator.entries()].map(([creatorId, values]) => [creatorId, medianOf(values)]),
  );

  const profileOf = (creatorId: string) => creators.get(creatorId);

  /**
   * A parte do prêmio que vem do POST — e que antes era descartada.
   *
   * `collectHighlights` sempre soube qual post ganhou; guardava o nome e uma string e
   * jogava o resto fora. Sem imagem, sem link e sem gancho, o destaque não dizia de QUÊ
   * a pessoa foi destaque. Tudo isto já estava carregado.
   */
  const postOf = (post: ReportPost) => ({
    link: post.postLink,
    thumbnailUrl: post.thumbnailUrl,
    screenTitle: post.screenTitle,
    openingLine: post.openingLine,
    elements: [
      ...(post.local ? [canonicalPlaceById(post.local)?.label ?? post.local] : []),
      ...post.assets.map((key) => canonicalAssetRoleById(key)?.label ?? key),
      ...post.tons.map((key) => canonicalToneById(key)?.label ?? key),
      ...post.objetos.map((key) => key.charAt(0).toUpperCase() + key.slice(1)),
    ].slice(0, 5),
  });

  /**
   * O mesmo número dito na unidade que a pessoa reconhece.
   *
   * "29,2× o próprio compartilhamento" é abstrato — exige lembrar qual é a própria
   * média para saber o que aconteceu. "Costuma fazer 12, este fez 350" é a mesma
   * verdade, sem tradução na cabeça de ninguém.
   */
  const medianaAbsoluta = (creatorId: string, campo: "compartilhamentos" | "comentarios") =>
    medianOf(
      windowPosts.filter((p) => p.creatorId === creatorId).map((p) => p.absolute[campo] ?? null),
    );

  /**
   * A frase em números absolutos.
   *
   * `raw` guarda TAXAS por pessoa alcançada — arredondar 0,008 dá "0", e a primeira
   * versão desta função dizia "Costuma fazer 0 compartilhamentos. Este fez 0.". O
   * criador pensa em contagem, não em taxa; para falar com ele é o absoluto que serve.
   */
  const plainOf = (
    creatorId: string,
    post: ReportPost,
    campo: "compartilhamentos" | "comentarios",
    unidade: string,
  ): string | null => {
    const mediana = medianaAbsoluta(creatorId, campo);
    const valor = post.absolute[campo] ?? null;
    if (mediana === null || valor === null || mediana <= 0) return null;
    return `Costuma fazer ${Math.round(mediana)} ${unidade} por post. Este fez ${Math.round(valor)}.`;
  };
  const territoryLabelOf = (territoryId: string | null) =>
    territoryId ? canonicalTerritoryById(territoryId)?.label ?? territoryId : null;

  // Destaque do território: quem mais superou a própria média, um por território.
  for (const { territoryId, collected } of territories) {
    const scored = collected.weekPosts
      .map((post) => {
        if (!hasOwnBaseline(post.creatorId)) return null;
        const mean = creatorMean.get(post.creatorId);
        const value = post.raw.engajamento;
        if (value === null || value === undefined || !mean || mean <= 0) return null;
        return { post, ratio: value / mean };
      })
      .filter((item): item is { post: ReportPost; ratio: number } => item !== null)
      .filter((item) => disponivel(item.post.creatorId))
      .sort((a, b) => b.ratio - a.ratio || a.post.id.localeCompare(b.post.id));

    const winner = scored[0];
    if (!winner || winner.ratio < 1.5) continue;
    jaPremiados.add(winner.post.creatorId);
    const profile = profileOf(winner.post.creatorId);
    highlights.push({
      kind: "destaque_do_territorio",
      label: "Destaque do território",
      creatorName: profile?.name ?? "Criador",
      creatorHandle: profile?.handle ?? null,
      creatorAvatarUrl: profile?.avatarUrl ?? null,
      territoryId,
      territoryLabel: territoryLabelOf(territoryId),
      result: `${winner.ratio.toFixed(1).replace(".", ",")}× a própria média`,
      isFreePlan: profile?.isFreePlan ?? true,
      post: postOf(winner.post),
      plain: plainOf(winner.post.creatorId, winner.post, "comentarios", "comentários"),
    });
  }

  // Virada: quem voltou a postar depois de semanas parado.
  const weekCreatorIds = new Set(weekPosts.map((post) => post.creatorId));
  const MS_WEEK = 7 * 86_400_000;
  const weekStart = weekPosts.length
    ? Math.min(...weekPosts.map((post) => post.postDate.getTime()))
    : 0;

  let bestGap: { creatorId: string; weeks: number } | null = null;
  for (const creatorId of weekCreatorIds) {
    if (!disponivel(creatorId)) continue;
    const before = windowPosts
      .filter((post) => post.creatorId === creatorId && post.postDate.getTime() < weekStart)
      .sort((a, b) => b.postDate.getTime() - a.postDate.getTime())[0];
    if (!before) continue;
    const weeks = Math.floor((weekStart - before.postDate.getTime()) / MS_WEEK);
    if (weeks < 3) continue;
    if (!bestGap || weeks > bestGap.weeks) bestGap = { creatorId, weeks };
  }
  if (bestGap) {
    jaPremiados.add(bestGap.creatorId);
    const profile = profileOf(bestGap.creatorId);
    highlights.push({
      kind: "virada",
      label: "Virada",
      creatorName: profile?.name ?? "Criador",
      creatorHandle: profile?.handle ?? null,
      creatorAvatarUrl: profile?.avatarUrl ?? null,
      territoryId: null,
      territoryLabel: null,
      result: `${bestGap.weeks} semanas paradas`,
      isFreePlan: profile?.isFreePlan ?? true,
      post: null,
      plain: `Voltou a postar depois de ${bestGap.weeks} semanas sem publicar nada.`,
    });
  }

  // Consistência: quem postou em mais dias distintos da semana.
  const daysByCreator = new Map<string, Set<number>>();
  for (const post of weekPosts) {
    const set = daysByCreator.get(post.creatorId) ?? new Set<number>();
    set.add(gridPosition(post.postDate).dayOfWeek);
    daysByCreator.set(post.creatorId, set);
  }
  const mostConsistent = [...daysByCreator.entries()]
    .filter(([creatorId]) => disponivel(creatorId))
    .map(([creatorId, days]) => ({ creatorId, days: days.size }))
    .sort((a, b) => b.days - a.days || a.creatorId.localeCompare(b.creatorId))[0];
  if (mostConsistent && mostConsistent.days >= 4) {
    jaPremiados.add(mostConsistent.creatorId);
    const profile = profileOf(mostConsistent.creatorId);
    highlights.push({
      kind: "consistencia",
      label: "Consistência",
      creatorName: profile?.name ?? "Criador",
      creatorHandle: profile?.handle ?? null,
      creatorAvatarUrl: profile?.avatarUrl ?? null,
      territoryId: null,
      territoryLabel: null,
      result: `${mostConsistent.days}/7 dias`,
      isFreePlan: profile?.isFreePlan ?? true,
      post: null,
      plain:
        mostConsistent.days === 7
          ? "Postou todos os dias da semana."
          : `Postou em ${mostConsistent.days} dos 7 dias da semana.`,
    });
  }

  // CORAGEM: quem gravou de um jeito que nunca tinha gravado.
  //
  // Antes o prêmio olhava "assunto que nunca fez" nas 20 gavetas do mapa — vocabulário
  // grosso demais para alguém estrear alguma coisa, e o prêmio simplesmente não saiu
  // nesta semana. Trocar pelos assuntos ABERTOS seria o extremo oposto: quase todo
  // assunto específico é inédito, e o prêmio sairia toda semana para qualquer um.
  //
  // O recorte que funciona é a FORMA de gravar: um cômodo, um enquadramento ou um asset
  // que aquela pessoa nunca tinha usado em 90 dias. Isso é sair da zona de conforto de
  // produção, é verificável, e só virou mensurável com a leitura de cena da v3.
  const formaDe = (post: ReportPost): { chave: string; rotulo: string }[] => [
    ...(post.local
      ? [{ chave: `local:${post.local}`, rotulo: canonicalPlaceById(post.local)?.label ?? post.local }]
      : []),
    ...post.enquadramentos.map((id) => ({
      chave: `enq:${id}`,
      rotulo: canonicalFramingById(id)?.label ?? id,
    })),
    ...post.assets.map((id) => ({
      chave: `asset:${id}`,
      rotulo: canonicalAssetRoleById(id)?.label ?? id,
    })),
  ];

  const corajosos = weekPosts
    .map((post) => {
      if (!hasOwnBaseline(post.creatorId) || !disponivel(post.creatorId)) return null;
      const historico = new Set(
        windowPosts
          .filter(
            (other) =>
              other.creatorId === post.creatorId &&
              other.id !== post.id &&
              other.postDate < post.postDate,
          )
          .flatMap((other) => formaDe(other).map((f) => f.chave)),
      );
      // Só conta estreia de quem TEM histórico lido: sem cena avaliada antes, tudo
      // pareceria novidade e o prêmio premiaria falta de dado.
      if (historico.size === 0) return null;
      const estreia = formaDe(post).find((f) => !historico.has(f.chave));
      if (!estreia) return null;
      const value = post.raw.engajamento;
      const mean = creatorMean.get(post.creatorId);
      if (value === null || value === undefined || !mean || mean <= 0) return null;
      const ratio = value / mean;
      if (ratio < 1.2) return null;
      return { post, estreia, ratio, mean, value };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.ratio - a.ratio || a.post.id.localeCompare(b.post.id));

  const corajoso = corajosos[0];
  if (corajoso) {
    jaPremiados.add(corajoso.post.creatorId);
    const profile = profileOf(corajoso.post.creatorId);
    highlights.push({
      kind: "coragem",
      label: "Coragem",
      creatorName: profile?.name ?? "Criador",
      creatorHandle: profile?.handle ?? null,
      creatorAvatarUrl: profile?.avatarUrl ?? null,
      territoryId: corajoso.post.territoryId,
      territoryLabel: territoryLabelOf(corajoso.post.territoryId),
      result: `estreou: ${corajoso.estreia.rotulo.toLowerCase()}`,
      isFreePlan: profile?.isFreePlan ?? true,
      post: postOf(corajoso.post),
      plain:
        `Nunca tinha gravado com ${corajoso.estreia.rotulo.toLowerCase()} em 90 dias. ` +
        `Fez, e o post rendeu ${corajoso.ratio.toFixed(1).replace(".", ",")}× a própria média.`,
    });
  }

  // Vídeo da comunidade: o maior salto de compartilhamento sobre a própria média.
  const shareMean = new Map<string, number | null>();
  for (const post of weekPosts) {
    if (shareMean.has(post.creatorId)) continue;
    shareMean.set(
      post.creatorId,
      medianOf(
        windowPosts
          .filter((other) => other.creatorId === post.creatorId)
          .map((other) => other.raw.compartilhamentos ?? null),
      ),
    );
  }
  const bestShare = weekPosts
    .map((post) => {
      if (!hasOwnBaseline(post.creatorId) || !disponivel(post.creatorId)) return null;
      const mean = shareMean.get(post.creatorId);
      const value = post.raw.compartilhamentos;
      if (value === null || value === undefined || !mean || mean <= 0) return null;
      return { post, ratio: value / mean };
    })
    .filter((item): item is { post: ReportPost; ratio: number } => item !== null)
    .sort((a, b) => b.ratio - a.ratio || a.post.id.localeCompare(b.post.id))[0];
  if (bestShare && bestShare.ratio >= 2) {
    jaPremiados.add(bestShare.post.creatorId);
    const profile = profileOf(bestShare.post.creatorId);
    highlights.push({
      kind: "video_da_comunidade",
      label: "Vídeo da comunidade",
      creatorName: profile?.name ?? "Criador",
      creatorHandle: profile?.handle ?? null,
      creatorAvatarUrl: profile?.avatarUrl ?? null,
      territoryId: bestShare.post.territoryId,
      territoryLabel: territoryLabelOf(bestShare.post.territoryId),
      result: `${bestShare.ratio.toFixed(1).replace(".", ",")}× o próprio compartilhamento`,
      isFreePlan: profile?.isFreePlan ?? true,
      post: postOf(bestShare.post),
      plain: plainOf(
        bestShare.post.creatorId,
        bestShare.post,
        "compartilhamentos",
        "compartilhamentos",
      ),
    });
  }

  // A FRASE DA SEMANA: a melhor coisa dita, entre todos os territórios.
  //
  // Só existe desde que a leitura de cena passou a copiar falas verbatim. É o prêmio
  // mais copiável do relatório: quem lê pode roubar a frase na quinta-feira.
  const comFala = weekPosts
    .map((post) => {
      const fala = post.falas[0] ?? post.openingLine;
      if (!fala || fala.length < 18) return null;
      if (!hasOwnBaseline(post.creatorId) || !disponivel(post.creatorId)) return null;
      const mean = creatorMean.get(post.creatorId);
      const value = post.raw.engajamento;
      if (value === null || value === undefined || !mean || mean <= 0) return null;
      return { post, fala, ratio: value / mean };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.ratio >= 1.5)
    .sort((a, b) => b.ratio - a.ratio || a.post.id.localeCompare(b.post.id));

  const melhorFala = comFala[0];
  if (melhorFala) {
    jaPremiados.add(melhorFala.post.creatorId);
    const profile = profileOf(melhorFala.post.creatorId);
    highlights.push({
      kind: "frase_da_semana",
      label: "A frase da semana",
      creatorName: profile?.name ?? "Criador",
      creatorHandle: profile?.handle ?? null,
      creatorAvatarUrl: profile?.avatarUrl ?? null,
      territoryId: melhorFala.post.territoryId,
      territoryLabel: territoryLabelOf(melhorFala.post.territoryId),
      result: `“${melhorFala.fala}”`,
      isFreePlan: profile?.isFreePlan ?? true,
      post: postOf(melhorFala.post),
      plain: `O post rendeu ${melhorFala.ratio.toFixed(1).replace(".", ",")}× a própria média.`,
    });
  }

  return highlights;
}

/**
 * Quem não postou: criador que aparece na janela mas não na semana. Semana parada
 * não muda a média de ninguém — é só um convite de volta.
 */
/**
 * Quem não postou — em NÚMERO, não em lista de nomes.
 *
 * A tela dizia "12 criadores não postou nesta semana: Aline Aurea, Aline Bergamini,
 * Aline Feitosa…" ao lado de um quadro de prêmios. Isso é constrangimento público, não
 * informação: os nomes são úteis para quem opera a comunidade, e a base recebe deles
 * só o desconforto de estar numa lista de quem falhou.
 *
 * A contagem fica (é um fato da semana), os nomes saem. Ver `silentCount` no relatório.
 */
export function collectSilentCreators(
  windowPosts: readonly ReportPost[],
  weekPosts: readonly ReportPost[],
  creators: Map<string, CreatorLike>,
  creatorTerritories: Map<string, string>,
  limit = 12,
): { creatorName: string; territoryLabel: string | null }[] {
  const active = new Set(weekPosts.map((post) => post.creatorId));
  const known = new Set(windowPosts.map((post) => post.creatorId));
  const silent = [...known].filter((creatorId) => !active.has(creatorId));

  return silent
    .map((creatorId) => {
      const profile = creators.get(creatorId);
      const territoryId = creatorTerritories.get(creatorId) ?? null;
      return {
        creatorName: profile?.name ?? "Criador",
        territoryLabel: territoryId ? canonicalTerritoryById(territoryId)?.label ?? territoryId : null,
      };
    })
    .sort((a, b) => a.creatorName.localeCompare(b.creatorName))
    .slice(0, limit);
}

export { OVERVIEW_COLUMNS };
