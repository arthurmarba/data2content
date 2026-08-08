/**
 * territories.ts — seleção dos territórios da semana e a ponte de EVIDÊNCIA.
 *
 * O território de um criador vem do card "Seu Mapa" (ver mapProfiles.ts). Este módulo
 * faz duas coisas menores e bem delimitadas:
 *
 *   1. escolhe quais territórios abrem tela nesta semana (por volume, com fixação);
 *   2. traduz o `context` de um POST — que é classificação da LEGENDA — para os mesmos
 *      ids canônicos do registro, para que "o que o mapa declara" e "o que a semana
 *      mostrou" sejam comparáveis.
 *
 * O item 2 é só evidência: não define território de ninguém. Existe porque quando o
 * post de um criador de Paternidade é classificado como Cozinha semana após semana,
 * isso é assunto de reunião e sinal de que o card precisa ser revisitado.
 *
 * A versão anterior deste arquivo tinha um catálogo próprio de territórios mapeado a
 * `contextCategories` e ERA a definição de território. Estava errado: território é
 * propriedade declarada do criador, não inferência do texto de um post.
 */

import { resolveContextLabel } from "@/app/lib/classification";
import { canonicalTerritoryById } from "./mapRegistry";

/**
 * Ponte `context` → território canônico. As chaves são ids de `contextCategories`
 * (src/app/lib/classification.ts); os valores são ids de `CANONICAL_TERRITORIES`
 * (mapRegistry.ts). Só existe para a comparação de evidência.
 *
 * Nem todo context tem território correspondente, e isso é esperado: `general`,
 * `curiosities` e as famílias-pai não descrevem domínio de vida.
 */
const CONTEXT_TO_TERRITORY: Readonly<Record<string, string>> = {
  parenting: "maternidade", // a árvore de context não separa mãe de pai
  relationships_family: "relacoes",
  beauty_personal_care: "beleza",
  fashion_style: "moda",
  food_culinary: "cozinha",
  fitness_sports: "treino",
  home_decor_diy: "casa-real",
  travel_tourism: "viagem",
  health_wellness: "saude-mental",
  personal_development: "desenvolvimento",
  career_work: "carreira",
  finance: "carreira",
  education: "estudos",
  art_culture: "cultura",
  pop_culture_music: "cultura",
  gaming: "cultura",
  technology_digital: "tecnologia",
  pets: "pets",
  social_causes_religion: "fe",
  events_celebrations: "cultura",
};

/**
 * Canonicaliza um valor cru de `context`. Aceita id, label e as formas sujas que
 * existem no banco ("personal_and_professional/parenting") — `resolveContextLabel`
 * já sabe destrinchar.
 */
export function canonicalContextId(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string" || !raw.trim()) return null;
  return resolveContextLabel(raw)?.value ?? null;
}

/**
 * Território que a classificação de um post SUGERE. Devolve id canônico do registro,
 * ou null quando o context não descreve domínio de vida.
 *
 * Determinístico: com mais de um context no post, ganha o primeiro que tem tradução,
 * na ordem do array — e a ordem do array é a que a IA gravou, que é estável por post.
 */
export function resolveTerritoryForContexts(
  contexts: unknown,
): { id: string; label: string } | null {
  const values = Array.isArray(contexts)
    ? contexts
    : typeof contexts === "string"
      ? [contexts]
      : [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const contextId = canonicalContextId(value);
    if (!contextId) continue;
    const territoryId = CONTEXT_TO_TERRITORY[contextId];
    if (!territoryId) continue;
    const territory = canonicalTerritoryById(territoryId);
    if (territory) return { id: territory.id, label: territory.label };
  }
  return null;
}

// ─── Seleção dos territórios da semana ───────────────────────────────────────

export interface TerritoryVolume {
  territoryId: string;
  label: string;
  posts: number;
  creators: number;
}

/** Post com o território (do mapa) já resolvido. */
export interface TerritorizedPost {
  creatorId: string;
  territoryId: string | null;
}

/**
 * Conta posts e criadores distintos por território na semana. Note que este
 * "criadores" é quem POSTOU no território nesta semana — diferente do
 * `territoryMemberships`, que conta quem DECLARA o território no mapa. O cabeçalho do
 * slide usa o do mapa; a seleção de quais territórios abrem tela usa este.
 */
export function tallyTerritories(posts: readonly TerritorizedPost[]): TerritoryVolume[] {
  const tally = new Map<string, { posts: number; creators: Set<string> }>();

  for (const post of posts) {
    if (!post.territoryId || !canonicalTerritoryById(post.territoryId)) continue;
    const entry = tally.get(post.territoryId) ?? { posts: 0, creators: new Set<string>() };
    entry.posts += 1;
    if (post.creatorId) entry.creators.add(post.creatorId);
    tally.set(post.territoryId, entry);
  }

  return [...tally.entries()]
    .map(([territoryId, entry]) => ({
      territoryId,
      label: canonicalTerritoryById(territoryId)?.label ?? territoryId,
      posts: entry.posts,
      creators: entry.creators.size,
    }))
    .sort((a, b) => b.posts - a.posts || a.territoryId.localeCompare(b.territoryId));
}

export interface SelectWeekTerritoriesOptions {
  /** Quantos territórios o relatório mostra. O mock desenha 4. */
  count?: number;
  /** Territórios fixados à mão — entram na frente, na ordem dada. */
  pinned?: string[];
  /**
   * Território só abre tela se tantos criadores postaram na semana.
   *
   * ERA 3. O piso existia porque, na época, uma tabela só mostrava elemento com ≥2
   * criadores — com 2 criadores no território, "Casa real" abriu quatro telas vazias
   * (0 assets, 0 assuntos, 0 tom, matriz com 0 linhas), porque dois criadores quase
   * nunca compartilham o mesmo elemento.
   *
   * Não existe mais desde a Fase 13 (peso substitui corte): hoje todo elemento visto
   * pelo menos uma vez entra na tabela, só que rotulado "indício" em vez de
   * "tendência" — a linha nunca finge ser mais forte do que é. Verificado com dado
   * real: território de 1 criador produz tabela cheia (rotulada indício) quando o
   * criador tem cena lida, e cai no estado "ponto cego" já existente quando não tem —
   * nunca mais em tela vazia. O piso de 3 hoje só esconde território de verdade sem
   * proteger nada.
   */
  minCreators?: number;
}

/**
 * Escolhe os territórios da semana, devolvendo ids canônicos. Fixados primeiro
 * (respeitando a ordem), o resto por volume de posts.
 *
 * `minCreators` existe para não abrir uma tela que é, na prática, a semana de uma
 * pessoa só — isso violaria a Regra 2. Território fixado passa por cima do piso: a
 * decisão de abrir a tela mesmo com pouca gente é editorial.
 */
export function selectWeekTerritories(
  volumes: readonly TerritoryVolume[],
  options: SelectWeekTerritoriesOptions = {},
): string[] {
  const { count = 4, pinned = [], minCreators = 1 } = options;
  const byId = new Map(volumes.map((v) => [v.territoryId, v]));
  const selected: string[] = [];

  for (const id of pinned) {
    if (!canonicalTerritoryById(id) || selected.includes(id)) continue;
    selected.push(id);
  }

  const ranked = [...volumes]
    .filter((v) => !selected.includes(v.territoryId) && v.creators >= minCreators)
    .sort((a, b) => b.posts - a.posts || a.territoryId.localeCompare(b.territoryId));

  for (const volume of ranked) {
    if (selected.length >= count) break;
    if (!canonicalTerritoryById(volume.territoryId)) continue;
    selected.push(volume.territoryId);
  }

  // Fixado nunca é cortado, mesmo que a lista fixada seja maior que o count.
  const pinnedValid = pinned.filter((id) => canonicalTerritoryById(id));
  return selected
    .slice(0, Math.max(count, pinnedValid.length))
    .filter((id) => pinnedValid.includes(id) || (byId.get(id)?.creators ?? 0) >= minCreators);
}
