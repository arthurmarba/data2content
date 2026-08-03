/**
 * mapProfiles.ts — o mapa de cada criador, resolvido para o canônico.
 *
 * Esta é a fonte de verdade do relatório para território, narrativa, assets e tom.
 * O card "Seu Mapa" é o dicionário; este módulo o lê e o traduz para as categorias
 * compartilhadas do registro (mapRegistry.ts).
 *
 * O que MUDOU em relação à primeira versão do relatório: antes o território vinha do
 * `context` do post, que é classificação da LEGENDA. Isso estava errado por duas
 * razões. A primeira é de produto: território é uma propriedade do criador, declarada
 * e confirmada no mapa, não uma inferência do texto de um post. A segunda é prática:
 * a legenda diz do que o post fala, não onde o criador atua — um pai que posta uma
 * receita não virou criador de Cozinha naquela semana.
 *
 * O `context` do post não é jogado fora: ele passa a ser EVIDÊNCIA. Quando o post de
 * um criador de Paternidade é classificado como Cozinha semana após semana, isso é um
 * sinal de que o mapa dele está desatualizado — e o card muda devagar justamente por
 * isso. Ver `territoryEvidence`.
 */

import { Types } from "mongoose";
import MapaSeedModel from "@/app/models/MapaSeed";
import CreatorMapConfirmationsModel from "@/app/models/CreatorMapConfirmations";
import { logger } from "@/app/lib/logger";
import {
  canonicalAssetRoleById,
  canonicalTerritoryById,
  canonicalToneById,
  resolveAssetLabel,
  resolveSubjectLabel,
  resolveTerritoryLabel,
  resolveToneLabel,
  splitToneField,
} from "./mapRegistry";

const TAG = "[relatorio][mapProfiles]";

/** Um asset do mapa, com o rótulo do criador e o papel coletivo. */
export interface MapAsset {
  /** Como está escrito no mapa dele: "a esposa (Lívia)". Nunca vai pro slide. */
  ownLabel: string;
  /** O papel coletivo: "parceiro_em_cena". É isto que o relatório ranqueia. */
  roleId: string;
  roleLabel: string;
  group: "vida" | "cenario" | "objeto";
  /** true quando o criador confirmou este asset no card. */
  confirmed: boolean;
}

export interface MapProfile {
  creatorId: string;
  /** Territórios canônicos do mapa, na ordem em que aparecem. */
  territoryIds: string[];
  /** O primeiro território canônico — onde o criador entra no relatório. */
  primaryTerritoryId: string | null;
  /** A frase que resume o mapa: "um pai que busca equilíbrio perto da família". */
  narrative: string | null;
  /** true quando o criador confirmou a narrativa no card. */
  narrativeConfirmed: boolean;
  assets: MapAsset[];
  /** Tons canônicos do mapa. */
  toneIds: string[];
  /**
   * Assuntos canônicos vindos de `mapa.temas` — o que o criador fala DE FATO.
   * `ownLabel` é a frase dele ("Sair do trabalho a tempo de viver a vida familiar"),
   * que vai no prompt da avaliação de cena; `subjectId` é a categoria coletiva.
   */
  subjects: { ownLabel: string; subjectId: string; label: string }[];
  /** Rótulos de território que estavam no campo errado — insumo de curadoria. */
  misplacedTerritoryLabels: { label: string; belongsTo: string }[];
  maturity: string | null;
}

/**
 * Carrega o mapa dos criadores pedidos. Só devolve perfil para quem TEM mapa — sem
 * mapa não há território, e sem território o criador não entra em nenhuma tela de
 * território (mas continua contando na capa e em "quem não postou").
 */
export async function loadMapProfiles(
  creatorIds: readonly string[],
): Promise<Map<string, MapProfile>> {
  if (creatorIds.length === 0) return new Map();

  const objectIds = creatorIds.map((id) => new Types.ObjectId(id));
  const [mapas, confirmations] = await Promise.all([
    MapaSeedModel.find({ userId: { $in: objectIds } })
      .select(
        "userId mapa.territorios mapa.assets mapa.tom mapa.temas " +
          "mapa.narrativa_central mapa.maturidade",
      )
      .lean<
        Array<{
          userId: Types.ObjectId;
          mapa?: {
            territorios?: string[];
            assets?: string[];
            tom?: string;
            temas?: string[];
            narrativa_central?: string;
            maturidade?: string;
          };
        }>
      >(),
    CreatorMapConfirmationsModel.find({ userId: { $in: objectIds } })
      .select("userId narrative.state assets")
      .lean<
        Array<{
          userId: Types.ObjectId;
          narrative?: { state?: string };
          assets?: Array<{ label: string; state: string }>;
        }>
      >(),
  ]);

  const confirmationByCreator = new Map(
    confirmations.map((doc) => [String(doc.userId), doc]),
  );

  const profiles = new Map<string, MapProfile>();

  for (const mapa of mapas) {
    const creatorId = String(mapa.userId);
    const confirmation = confirmationByCreator.get(creatorId);
    const confirmedAssetLabels = new Set(
      (confirmation?.assets ?? [])
        .filter((asset) => asset.state === "confirmed")
        .map((asset) => asset.label.trim().toLowerCase()),
    );

    const territoryIds: string[] = [];
    const misplacedTerritoryLabels: { label: string; belongsTo: string }[] = [];
    for (const raw of mapa.mapa?.territorios ?? []) {
      if (!raw?.trim()) continue;
      const resolution = resolveTerritoryLabel(raw);
      if (resolution.kind === "canonical") {
        if (!territoryIds.includes(resolution.territoryId)) {
          territoryIds.push(resolution.territoryId);
        }
      } else if (resolution.kind === "misplaced") {
        misplacedTerritoryLabels.push({ label: raw.trim(), belongsTo: resolution.belongsTo });
      }
    }

    const assets: MapAsset[] = [];
    const seenAssetPairs = new Set<string>();
    for (const raw of mapa.mapa?.assets ?? []) {
      if (!raw?.trim()) continue;
      const resolution = resolveAssetLabel(raw);
      if (resolution.kind !== "canonical") continue;
      const ownLabel = raw.trim();
      const pair = `${ownLabel.toLowerCase()}|${resolution.roleId}`;
      if (seenAssetPairs.has(pair)) continue;
      seenAssetPairs.add(pair);
      assets.push({
        ownLabel,
        roleId: resolution.roleId,
        roleLabel: resolution.label,
        group: resolution.group,
        confirmed: confirmedAssetLabels.has(ownLabel.toLowerCase()),
      });
    }

    const subjects: MapProfile["subjects"] = [];
    const seenSubjects = new Set<string>();
    for (const raw of mapa.mapa?.temas ?? []) {
      if (!raw?.trim()) continue;
      const resolution = resolveSubjectLabel(raw);
      if (resolution.kind !== "canonical") continue;
      const ownLabel = raw.trim();
      const pair = `${ownLabel.toLowerCase()}|${resolution.subjectId}`;
      if (seenSubjects.has(pair)) continue;
      seenSubjects.add(pair);
      subjects.push({ ownLabel, subjectId: resolution.subjectId, label: resolution.label });
    }

    const toneIds: string[] = [];
    for (const chip of splitToneField(mapa.mapa?.tom)) {
      const resolution = resolveToneLabel(chip);
      if (resolution.kind === "canonical" && !toneIds.includes(resolution.toneId)) {
        toneIds.push(resolution.toneId);
      }
    }

    profiles.set(creatorId, {
      creatorId,
      territoryIds,
      primaryTerritoryId: territoryIds[0] ?? null,
      narrative: mapa.mapa?.narrativa_central?.trim() || null,
      narrativeConfirmed: confirmation?.narrative?.state === "confirmed",
      assets,
      toneIds,
      subjects,
      misplacedTerritoryLabels,
      maturity: mapa.mapa?.maturidade ?? null,
    });
  }

  const semMapa = creatorIds.filter((id) => !profiles.has(id)).length;
  if (semMapa > 0) {
    logger.info(
      `${TAG} ${profiles.size}/${creatorIds.length} criadores com mapa. ` +
        `${semMapa} sem mapa não entram em nenhuma tela de território.`,
    );
  }

  return profiles;
}

// ─── Agrupamento por território ──────────────────────────────────────────────

export interface TerritoryMembership {
  territoryId: string;
  label: string;
  /** Criadores cujo mapa declara este território. */
  creatorIds: string[];
}

/**
 * Quantos criadores há em cada território, segundo o mapa. É o "58 criadores" do
 * cabeçalho — e é o denominador honesto do "cabe em", porque conta quem DECLAROU
 * atuar ali, não quem por acaso postou sobre isso nesta semana.
 *
 * Um criador pode aparecer em mais de um território: o mapa dele pode declarar
 * "Paternidade" e "Cozinha", e as duas coisas são verdade. Isso é diferente do POST,
 * que pertence a um território só — ver `territoryOfPost`.
 */
export function territoryMemberships(
  profiles: ReadonlyMap<string, MapProfile>,
): TerritoryMembership[] {
  const byTerritory = new Map<string, Set<string>>();
  for (const profile of profiles.values()) {
    for (const territoryId of profile.territoryIds) {
      const set = byTerritory.get(territoryId) ?? new Set<string>();
      set.add(profile.creatorId);
      byTerritory.set(territoryId, set);
    }
  }
  return [...byTerritory.entries()]
    .map(([territoryId, creators]) => ({
      territoryId,
      label: canonicalTerritoryById(territoryId)?.label ?? territoryId,
      creatorIds: [...creators].sort(),
    }))
    .sort(
      (a, b) => b.creatorIds.length - a.creatorIds.length || a.territoryId.localeCompare(b.territoryId),
    );
}

/**
 * Território de UM post: o território primário do mapa de quem postou.
 *
 * Por que o primário e não todos: se o post contasse em dois territórios, ele entraria
 * duas vezes na média do território e "engajamento do território" deixaria de
 * significar algo. O criador mora em vários territórios; cada post dele conta em um.
 */
export function territoryOfPost(
  creatorId: string,
  profiles: ReadonlyMap<string, MapProfile>,
): string | null {
  return profiles.get(creatorId)?.primaryTerritoryId ?? null;
}

/**
 * Narrativas de um território: a frase que resume o mapa de cada criador dali.
 *
 * A tela 03 lista as narrativas SEM ranking (Regra 1) com quantos criadores em cada.
 * Como cada narrativa é uma frase própria ("um pai que busca equilíbrio perto da
 * família"), duas pessoas raramente têm a mesma — então aqui cada criador aparece com
 * a sua, e a contagem é 1. Agrupar frases distintas numa narrativa compartilhada é
 * curadoria, não string matching; até existir, a lista mostra as narrativas reais do
 * território em vez de forçar agrupamento.
 */
export function narrativesOfTerritory(
  territoryId: string,
  profiles: ReadonlyMap<string, MapProfile>,
  creatorsInWeek: ReadonlySet<string>,
): { label: string; creators: number; confirmed: boolean }[] {
  const seen = new Map<string, { label: string; creators: number; confirmed: boolean }>();
  for (const profile of profiles.values()) {
    if (!profile.territoryIds.includes(territoryId)) continue;
    if (!creatorsInWeek.has(profile.creatorId)) continue;
    if (!profile.narrative) continue;
    const key = profile.narrative.toLowerCase();
    const entry = seen.get(key);
    if (entry) {
      entry.creators += 1;
      entry.confirmed = entry.confirmed || profile.narrativeConfirmed;
    } else {
      seen.set(key, {
        label: profile.narrative,
        creators: 1,
        confirmed: profile.narrativeConfirmed,
      });
    }
  }
  return [...seen.values()].sort(
    (a, b) => b.creators - a.creators || a.label.localeCompare(b.label),
  );
}

/**
 * "Cabe em": quantos criadores do território têm aquele papel de asset no mapa.
 *
 * Este é o numerador certo — capacidade DECLARADA. Um efeito de 3,0× que só serve pra
 * 5 pessoas vale menos que 2,0× que serve pra 50, e é o mapa que sabe quantos têm
 * filho, parceiro, animal ou cozinha para colocar em cena.
 */
export function assetFitsByTerritory(
  profiles: ReadonlyMap<string, MapProfile>,
): Map<string, Map<string, number>> {
  const fits = new Map<string, Map<string, number>>();
  for (const profile of profiles.values()) {
    const roles = new Set(profile.assets.map((asset) => asset.roleId));
    for (const territoryId of profile.territoryIds) {
      const byRole = fits.get(territoryId) ?? new Map<string, number>();
      for (const roleId of roles) {
        byRole.set(roleId, (byRole.get(roleId) ?? 0) + 1);
      }
      fits.set(territoryId, byRole);
    }
  }
  return fits;
}

/** Tons declarados por território, para o mesmo cálculo de "cabe em". */
export function toneFitsByTerritory(
  profiles: ReadonlyMap<string, MapProfile>,
): Map<string, Map<string, number>> {
  const fits = new Map<string, Map<string, number>>();
  for (const profile of profiles.values()) {
    for (const territoryId of profile.territoryIds) {
      const byTone = fits.get(territoryId) ?? new Map<string, number>();
      for (const toneId of profile.toneIds) {
        byTone.set(toneId, (byTone.get(toneId) ?? 0) + 1);
      }
      fits.set(territoryId, byTone);
    }
  }
  return fits;
}

// ─── Evidência: o post confirma ou contradiz o mapa? ─────────────────────────

export interface TerritoryEvidence {
  creatorId: string;
  /** Territórios que o mapa declara. */
  declared: string[];
  /**
   * Territórios que a classificação dos posts sugere, com contagem. Vem do `context`
   * do post mapeado para o registro — o mesmo caminho, mas como sinal, não definição.
   */
  observed: { territoryId: string; posts: number }[];
  /** true quando nada do que ele postou casa com o que o mapa declara. */
  diverges: boolean;
}

/**
 * Compara o mapa com o que foi postado. Não altera nenhum número do relatório — serve
 * para o card "Seu Mapa" saber que precisa ser revisitado, e para a reunião ter o
 * assunto "seu mapa diz Paternidade e sua semana foi toda Cozinha".
 */
export function territoryEvidence(
  posts: readonly { creatorId: string; observedTerritoryId: string | null }[],
  profiles: ReadonlyMap<string, MapProfile>,
): TerritoryEvidence[] {
  const byCreator = new Map<string, Map<string, number>>();
  for (const post of posts) {
    if (!post.observedTerritoryId) continue;
    const counts = byCreator.get(post.creatorId) ?? new Map<string, number>();
    counts.set(post.observedTerritoryId, (counts.get(post.observedTerritoryId) ?? 0) + 1);
    byCreator.set(post.creatorId, counts);
  }

  const out: TerritoryEvidence[] = [];
  for (const [creatorId, counts] of byCreator) {
    const declared = profiles.get(creatorId)?.territoryIds ?? [];
    const observed = [...counts.entries()]
      .map(([territoryId, posts]) => ({ territoryId, posts }))
      .sort((a, b) => b.posts - a.posts || a.territoryId.localeCompare(b.territoryId));
    out.push({
      creatorId,
      declared,
      observed,
      diverges:
        declared.length > 0 &&
        observed.length > 0 &&
        !observed.some((entry) => declared.includes(entry.territoryId)),
    });
  }
  return out;
}
