/**
 * audienceInsightsService.ts
 *
 * "Sua Audiência" — insights NÃO-ÓBVIOS sobre o que a audiência reconhece no criador.
 *
 * Princípio: o Instagram já mostra saves, alcance e demografia (o óbvio). O valor
 * do Data2Content está no CRUZAMENTO desses sinais com o mapa do criador — coisas
 * que o Instagram estruturalmente não consegue computar porque não conhece a
 * narrativa, o tom e a intenção classificados de cada post.
 *
 * V1 — 4 insights de reconhecimento (saves/shares × mapa):
 *   1. Território órfão — muito guardado, pouco explorado
 *   2. Tom que ressoa — quando você fala de um jeito, eles guardam mais
 *   3. Inversão de formato — o que alcança ≠ o que fica
 *   4. Intenção que ressoa — quando você faz X, eles guardam
 *
 * V2 — 2 insights adicionais:
 *   5. Divergência mapa↔audiência — a audiência te reconhece por algo diferente do mapa central
 *   6. Quem te acompanha — demografia: faixa etária, gênero, cidade
 *
 * V3 — catálogo expandido (banco mais profundo; card sempre rico):
 *   7. Ritmo — dia/hora × saves/shares (quando elas te guardam)
 *   8. Atenção — qual tema faz a audiência assistir até o fim (retention × contexto)
 *   9. Propagação — qual tema a audiência passa pra frente (shares × contexto)
 *
 * Regra do produto: nada aparece se não existir de verdade. Cada campo é `null`
 * quando o sinal não atinge o piso de confiança — a UI só renderiza o que veio.
 * `hasAny` é `true` apenas quando há ≥1 insight NÃO-óbvio (demo sozinha não conta).
 */
import type { Types } from "mongoose";
import { getAverageEngagementByGroupings } from "@/utils/getAverageEngagementByGrouping";
import type { AverageResult } from "@/utils/getAverageEngagementByGrouping";
import { getLatestAudienceDemographics } from "@/app/lib/dataService/demographicService";
import { buildRhythmInsights, type RhythmPost } from "./audienceRhythmInsights";
import { buildAttentionInsight, buildPropagationInsight } from "./audienceAttentionInsights";
import MetricModel from "@/app/models/Metric";
import { contextCategories } from "@/app/lib/classification";
// Utilitários puros de label — extraídos p/ módulo client-safe (sem winston/mongoose).
// Re-export de territoryLabelsMatch mantém compatível quem importa daqui.
import { normalizeLabel, territoryLabelsMatch } from "./audienceTerritoryLabels";
export { territoryLabelsMatch };

// ─── Confiança ──────────────────────────────────────────────────────────────
// Piso absoluto: nº mínimo de posts numa categoria para confiarmos na média.
// Subido de 3 → 5: com 3 posts uma média de saves é ruído (um único post atípico domina).
const MIN_POSTS_FOR_SIGNAL = 5;
// Piso relativo de volume: para insights de "o que mais ressoa" (tom/proposta/contexto),
// a categoria vencedora precisa ter ao menos esta fração dos posts da categoria mais usada.
// Evita que uma categoria de 5 posts (alta variância) vença uma de 50 só na média.
const MIN_VOLUME_SHARE = 0.2;
// Margem mínima para a inversão de formato: cada formato precisa liderar a SUA métrica
// por esta folga relativa. Sem isso, um empate técnico (~3%) viraria "insight".
const FORMAT_INVERSION_MARGIN = 0.15;
// Tons/propostas comerciais não são "reconhecimento narrativo" — são venda. Excluídos
// de "o que ressoa" (a audiência guardar um anúncio não diz nada sobre a narrativa).
// Inclui intents comerciais do contentIntent V2 (converter, anunciar/lançar) — não são
// reconhecimento narrativo. normalizeLabel remove acentos/pontuação antes do match.
const COMMERCIAL_KEYWORDS = ["comercial", "promocional", "anuncio", "anunciar", "lancar", "converter", "publi", "patrocin", "vend"];

// Janela adaptativa: criadores que postam espaçado não enchem 90 dias. Em vez de
// um card vazio, ampliamos a lente (90 → 180 → 365 → todo período) até haver posts
// suficientes para os insights ricos. Mantém recência para quem posta muito.
const MIN_POSTS_FOR_RICH_WINDOW = 12;
const WINDOW_LADDER: Array<{ days: number; key: string; label: string }> = [
  { days: 90,    key: "last_90_days",   label: "últimos 90 dias" },
  { days: 180,   key: "last_180_days",  label: "últimos 6 meses" },
  { days: 365,   key: "last_12_months", label: "últimos 12 meses" },
  { days: Infinity, key: "all_time",    label: "todo o período" },
];

/** Escolhe a menor janela com posts suficientes; cai para a maior disponível. */
function chooseWindow(postDates: Date[]): { days: number; key: string; label: string } {
  const now = Date.now();
  for (const w of WINDOW_LADDER) {
    if (w.days === Infinity) return w;
    const count = postDates.filter((d) => now - d.getTime() <= w.days * 86_400_000).length;
    if (count >= MIN_POSTS_FOR_RICH_WINDOW) return w;
  }
  return WINDOW_LADDER[WINDOW_LADDER.length - 1]!;
}

// ─── Tipos de saída ───────────────────────────────────────────────────────────

/** Território muito guardado e pouco explorado — o "lado que você não assumiu". */
export interface OrphanTerritoryInsight {
  label: string;
  avgSaves: number;
  postCount: number;
}

/** Tom de comunicação que mais gera reconhecimento. */
export interface ResonantToneInsight {
  label: string;
  avgSaves: number;
  postCount: number;
}

/** Quando o formato que alcança ≠ o formato que é guardado. */
export interface FormatInversionInsight {
  reachLeaderLabel: string;
  savesLeaderLabel: string;
}

/** A intenção de conteúdo que mais é guardada. */
/**
 * Intenção estratégica (contentIntent V2) que mais é guardada — substitui o legado
 * "proposal". O "por quê" do post (ensinar, inspirar, conectar, informar…).
 */
export interface ResonantIntentInsight {
  label: string;
  avgSaves: number;
  postCount: number;
}

/** Território cujo reconhecimento (saves) vem CRESCENDO na 2ª metade da janela vs a 1ª. */
export interface RisingTerritoryInsight {
  label: string;
}

/**
 * Combo cirúrgico: o cruzamento território × momento (horário OU dia) que mais se
 * destaca. Só existe quando a célula tem volume real e o momento faz diferença
 * material — nunca uma hipótese. Demografia NUNCA entra (é dado de conta, não por post).
 */
export interface ComboInsight {
  territoryLabel: string;
  whenKind: "timeOfDay" | "dayOfWeek";
  whenLabel: string; // "de manhã" | "à noite" | "sábado"
}

/** Forma narrativa (V2) que mais é guardada — o "como você conta" (bastidores, tutorial, dia-na-vida…). */
export interface ResonantNarrativeFormInsight {
  label: string;
  avgSaves: number;
  postCount: number;
}

/** Postura/voz (V2.5) que mais ressoa — "de onde você fala" (depoimento, crítico, questionando…). */
export interface ResonantStanceInsight {
  label: string;
  avgSaves: number;
  postCount: number;
}

/**
 * V2 — A audiência reconhece um território diferente do que é o centro do mapa confirmado.
 * Só aparece quando há divergência real — confirmação ("mapa alinhado") não aparece.
 */
export interface TerritoryDivergenceInsight {
  /** O território que a audiência mais guarda (top saves+shares). */
  audienceLabel: string;
  /** O primeiro território confirmado pelo criador no mapa. */
  mapLabel: string;
}

/** V2 — Demographic composition of the creator's audience. */
export interface AudienceDemographicsInsight {
  /** Top age range label (e.g., "25-34") */
  topAgeRange: string | null;
  /** Dominant gender ("feminino" | "masculino" | "outro") */
  dominantGender: string | null;
  /** Top city */
  topCity: string | null;
  /** Top country (when city data is unavailable) */
  topCountry: string | null;
}

/**
 * Divergência "quem segue ≠ quem engaja": quando o perfil de quem mais ENGAJA difere
 * de quem mais SEGUE. Sinal raro e valioso — revela quem de fato valoriza o conteúdo,
 * não só quem clicou em seguir um dia.
 */
export interface EngagedDivergenceInsight {
  dimension: "gênero" | "faixa etária" | "cidade";
  followerLabel: string;
  engagedLabel: string;
}

// ─── V3 — Tipos das famílias novas ───────────────────────────────────────────

/**
 * Território (assunto) que a audiência mais guarda — mostrado direto, sem depender
 * de comparação com o mapa. Aparece quando NÃO há divergência (mapa ausente ou já
 * alinhado) e quando não é o mesmo do território órfão, para nunca duplicar.
 */
export interface ResonantTerritoryInsight {
  label: string;
  avgSaves: number;
  postCount: number;
}

/** V3 — Asset de vida que gera mais reconhecimento (saves/shares). */
export interface LifeAssetInsight {
  label: string;       // e.g. "casa", "solo", "rotina de fim de semana"
  avgSaves: number;
  postCount: number;
}

/** V3 — Dia ou período do dia em que a audiência mais guarda/compartilha. */
export interface RhythmInsightResult {
  kind: "dayOfWeek" | "timeOfDay";
  signal: "saves" | "shares";
  label: string;   // "sábado" | "à noite"
  score: number;
  postCount: number;
}

/** V3 — Tema/formato que a audiência assiste até o fim. */
export interface AttentionInsightResult {
  grouping: "context" | "tone" | "proposal" | "format";
  label: string;
  avgRetention: number;
  postCount: number;
}

/** V3 — Tema/formato que a audiência mais passa pra frente. */
export interface PropagationInsightResult {
  grouping: "context" | "tone" | "proposal" | "format";
  label: string;
  avgShares: number;
  postCount: number;
}

export interface AudienceInsights {
  orphanTerritory: OrphanTerritoryInsight | null;
  resonantTone: ResonantToneInsight | null;
  formatInversion: FormatInversionInsight | null;
  resonantIntent: ResonantIntentInsight | null;
  /** V2 — divergência mapa↔audiência */
  territoryDivergence: TerritoryDivergenceInsight | null;
  /** Território que a audiência mais guarda (quando não há divergência para mostrá-lo) */
  resonantTerritory: ResonantTerritoryInsight | null;
  /** Território cujo reconhecimento vem crescendo na janela */
  risingTerritory: RisingTerritoryInsight | null;
  /** Combo cirúrgico território × momento (quando a célula é confiável) */
  combo: ComboInsight | null;
  /** V2 — quem te acompanha */
  demographics: AudienceDemographicsInsight | null;
  /** Divergência quem segue ≠ quem engaja */
  engagedDivergence: EngagedDivergenceInsight | null;
  /** V3 — ritmo: quando a audiência guarda/compartilha mais (top 1) */
  rhythm: RhythmInsightResult | null;
  /** V3 — atenção: qual tema faz a audiência assistir até o fim */
  attention: AttentionInsightResult | null;
  /** V3 — propagação: qual tema a audiência mais passa pra frente */
  propagation: PropagationInsightResult | null;
  /** Forma narrativa que mais é guardada (bastidores, tutorial…) */
  resonantNarrativeForm: ResonantNarrativeFormInsight | null;
  /** Postura/voz que mais ressoa (depoimento, crítico…) */
  resonantStance: ResonantStanceInsight | null;
  /** V3 — asset de vida que gera mais reconhecimento (preenchido quando há posts com lifeAssets taggeados) */
  topLifeAsset: LifeAssetInsight | null;
  /** Rótulo da janela efetivamente usada (adaptativa): "últimos 90 dias" | "últimos 12 meses" | "todo o período". */
  periodLabel: string;
  /**
   * Empréstimo da Galileia (ponto-ouro): os territórios REAIS confirmados no mapa
   * (placeholders removidos). A UI cruza cada insight de território com esta lista
   * para julgar se é OURO (dentro do mapa → faça mais) ou A NOMEAR (fora → é você?).
   */
  confirmedTerritoryLabels: string[];
  /**
   * O território que a audiência MAIS guarda (top saves), com sua magnitude relativa
   * (`saveLift`: 2.0 = o dobro da média dos demais). Alimenta a espinha do card.
   */
  topTerritory: { label: string; saveLift: number } | null;
  /**
   * Fase C-lite (movimento): rótulo do território cujo reconhecimento vem CRESCENDO
   * na janela — exposto CRU (antes do dedup que suprime a linha `risingTerritory`).
   * A UI decora QUALQUER linha desse território com o selo "▲ crescendo", mesmo
   * quando ele aparece via divergência/órfão/reconhecimento. Null se nada cresce.
   */
  risingTerritoryLabel: string | null;
  hasAny: boolean;
}

const EMPTY_INSIGHTS: AudienceInsights = {
  orphanTerritory: null,
  resonantTone: null,
  formatInversion: null,
  resonantIntent: null,
  territoryDivergence: null,
  resonantTerritory: null,
  risingTerritory: null,
  combo: null,
  rhythm: null,
  attention: null,
  propagation: null,
  resonantNarrativeForm: null,
  resonantStance: null,
  topLifeAsset: null,
  engagedDivergence: null,
  periodLabel: "últimos 90 dias",
  confirmedTerritoryLabels: [],
  topTerritory: null,
  risingTerritoryLabel: null,
  demographics: null,
  hasAny: false,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function confident(list: AverageResult[]): AverageResult[] {
  return list.filter((r) => r.postsCount >= MIN_POSTS_FOR_SIGNAL && r.value > 0);
}

function pickOrphanTerritory(byContextSaves: AverageResult[]): OrphanTerritoryInsight | null {
  const eligible = confident(byContextSaves);
  if (eligible.length < 2) return null;

  const bySaves = [...eligible].sort((a, b) => b.value - a.value);
  const topBySaves = bySaves[0]!;

  const counts = eligible.map((r) => r.postsCount).sort((a, b) => a - b);
  const medianCount = counts[Math.floor(counts.length / 2)]!;
  const maxCount = counts[counts.length - 1]!;

  if (topBySaves.postsCount > medianCount) return null;
  if (topBySaves.postsCount >= maxCount) return null;

  return {
    label: topBySaves.name,
    avgSaves: round(topBySaves.value),
    postCount: topBySaves.postsCount,
  };
}

function pickTop(list: AverageResult[]): AverageResult | null {
  const eligible = confident(list);
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => b.value - a.value)[0]!;
}

function isCommercial(label: string): boolean {
  const n = normalizeLabel(label);
  return COMMERCIAL_KEYWORDS.some((k) => n.includes(k));
}

// Labels genéricos/placeholder de território que o sistema usa quando o mapa ainda
// não tem um território real confirmado (ex.: "Território de marca possível",
// "Território em formação"). A divergência NÃO deve comparar contra eles — seria
// fingir um centro de mapa que não existe de verdade.
const PLACEHOLDER_TERRITORY_PATTERNS = [
  "territorio de marca",
  "territorio em formacao",
  "em formacao",
  "marca possivel",
  "marca recomendad",
  "recomendado para voce",
  "sem territorio",
];
export function isPlaceholderTerritory(label: string): boolean {
  const n = normalizeLabel(label);
  return PLACEHOLDER_TERRITORY_PATTERNS.some((p) => n.includes(p));
}

/**
 * Escolhe a categoria de maior média que também tem volume relevante (≥ MIN_VOLUME_SHARE
 * dos posts da categoria mais usada). Opcionalmente exclui categorias comerciais.
 * Usado para "o que ressoa" (tom, proposta) e para o território top da divergência —
 * onde premiar amostra pequena seria enganoso.
 */
function pickTopMeaningful(
  list: AverageResult[],
  opts?: { excludeCommercial?: boolean },
): AverageResult | null {
  let eligible = confident(list);
  if (opts?.excludeCommercial) eligible = eligible.filter((r) => !isCommercial(r.name));
  if (eligible.length === 0) return null;
  const maxPosts = Math.max(...eligible.map((r) => r.postsCount));
  const meaningful = eligible.filter((r) => r.postsCount >= MIN_VOLUME_SHARE * maxPosts);
  if (meaningful.length === 0) return null;
  return [...meaningful].sort((a, b) => b.value - a.value)[0]!;
}

function findByLabel(list: AverageResult[], name: string): AverageResult | undefined {
  const target = normalizeLabel(name);
  return list.find((r) => normalizeLabel(r.name) === target);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Magnitude relativa (empréstimo da Galileia: "stat sempre RELATIVO, nunca número
 * cru"). Quanto o vencedor supera a MÉDIA dos demais grupos confiáveis. 2.0 = o dobro.
 * Retorna 1 quando não há base de comparação (não superestima com amostra única).
 */
function computeLift(winner: AverageResult, list: AverageResult[]): number {
  const rest = confident(list).filter((r) => normalizeLabel(r.name) !== normalizeLabel(winner.name));
  if (rest.length === 0) return 1;
  const mean = rest.reduce((a, r) => a + r.value, 0) / rest.length;
  return mean > 0 ? winner.value / mean : 1;
}


// ─── Rollup pai↔filho de context (granularidade) ──────────────────────────────
// A árvore de context tem 2 níveis e o classificador grava em níveis inconsistentes
// (uns posts no pai "Estilo de Vida e Bem-Estar", outros no filho "Beleza"). Isso
// fragmenta os saves do MESMO território entre buckets irmãos. O rollup consolida
// tudo na FAMÍLIA-pai (sem perder nenhum post), mas rotula com o FILHO dominante
// quando um filho concentra a maioria — específico quando o dado sustenta, robusto
// sempre. Decisão de produto: território = específico (nível folha) quando possível.
// Filho rotula a família quando é o líder e tem ≥35% dos posts dela — plural claro.
// Mais baixo que 50% para favorecer rótulos ESPECÍFICOS ("tecnologia") em vez do
// pai genérico ("hobbies"), sem deixar um líder fraco overclaim.
const CHILD_DOMINANCE_SHARE = 0.35;
// Tendência: território precisa de ≥MIN_HALF_POSTS em CADA metade da janela e crescer ≥RISE_MARGIN.
const MIN_HALF_POSTS = 4;
const RISE_MARGIN = 1.5;
// Combo (território × momento): a célula cruzada precisa de volume real (≥MIN_COMBO_CELL
// posts) E o momento precisa fazer diferença material (≥COMBO_MARGIN × a média do território).
// Sem isso vira hipótese sem fundamento — só surfa quando o cruzamento é estatisticamente honesto.
const MIN_COMBO_CELL = 8;
const COMBO_MARGIN = 1.4;
const COMBO_TZ = "America/Sao_Paulo";

const CONTEXT_FAMILY_MAP: Map<string, { family: string; child: string | null }> = (() => {
  const map = new Map<string, { family: string; child: string | null }>();
  for (const parent of contextCategories) {
    map.set(normalizeLabel(parent.label), { family: parent.label, child: null });
    map.set(normalizeLabel(parent.id), { family: parent.label, child: null });
    for (const child of parent.subcategories ?? []) {
      map.set(normalizeLabel(child.label), { family: parent.label, child: child.label });
      map.set(normalizeLabel(child.id), { family: parent.label, child: child.label });
    }
  }
  return map;
})();

/**
 * Consolida resultados de context por família-pai. Cada saída tem:
 *   value = média de saves ponderada por posts da família inteira
 *   postsCount = total de posts da família
 *   name = rótulo do filho dominante (≥CHILD_DOMINANCE_SHARE e ≥piso) ou o da família
 * Labels desconhecidos (fora da árvore) viram a própria família — degrada graciosamente.
 */
function rollUpContextFamilies(results: AverageResult[]): AverageResult[] {
  interface Fam {
    familyLabel: string;
    sumSaves: number;
    posts: number;
    children: Map<string, { label: string; posts: number }>;
  }
  const fams = new Map<string, Fam>();

  for (const r of results) {
    const entry = CONTEXT_FAMILY_MAP.get(normalizeLabel(r.name));
    const familyLabel = entry?.family ?? r.name;
    const childLabel = entry?.child ?? null;
    const key = normalizeLabel(familyLabel);

    const fam = fams.get(key) ?? { familyLabel, sumSaves: 0, posts: 0, children: new Map() };
    fam.sumSaves += r.value * r.postsCount;
    fam.posts += r.postsCount;
    if (childLabel) {
      const ck = normalizeLabel(childLabel);
      const c = fam.children.get(ck) ?? { label: childLabel, posts: 0 };
      c.posts += r.postsCount;
      fam.children.set(ck, c);
    }
    fams.set(key, fam);
  }

  const out: AverageResult[] = [];
  for (const fam of fams.values()) {
    if (fam.posts === 0) continue;
    let label = fam.familyLabel;
    let topChild: { label: string; posts: number } | null = null;
    for (const c of fam.children.values()) {
      if (!topChild || c.posts > topChild.posts) topChild = c;
    }
    if (topChild && topChild.posts >= CHILD_DOMINANCE_SHARE * fam.posts && topChild.posts >= MIN_POSTS_FOR_SIGNAL) {
      label = topChild.label;
    }
    out.push({ name: label, value: fam.sumSaves / fam.posts, postsCount: fam.posts });
  }
  return out;
}

/**
 * Território "em ascensão": compara saves médios por família-pai na 1ª metade vs 2ª
 * metade da janela. Surfa quem CRESCEU de forma clara (≥RISE_MARGIN), com volume
 * mínimo em ambas as metades. Só momentum positivo (não surfa queda — evita ansiedade).
 * Rotula com o filho dominante da 2ª metade quando há um claro.
 * Opera in-memory sobre os posts já buscados — sem query nova.
 */
function pickRisingTerritory(
  posts: Array<{ postDate: Date; saved: number; context: unknown }>,
  windowStart: Date,
): RisingTerritoryInsight | null {
  const now = Date.now();
  const mid = windowStart.getTime() + (now - windowStart.getTime()) / 2;
  if (!Number.isFinite(mid)) return null; // janela "all_time" (windowStart=epoch) → sem corte confiável

  interface Half { sum: number; count: number; children: Map<string, number>; }
  interface Fam { label: string; older: Half; recent: Half; }
  const emptyHalf = (): Half => ({ sum: 0, count: 0, children: new Map() });
  const fams = new Map<string, Fam>();

  for (const p of posts) {
    const saved = typeof p.saved === "number" ? p.saved : 0;
    const ctxArr: string[] = Array.isArray(p.context) ? p.context : [];
    const isRecent = new Date(p.postDate).getTime() >= mid;
    const seen = new Set<string>();
    for (const ctx of ctxArr) {
      if (!ctx) continue;
      const entry = CONTEXT_FAMILY_MAP.get(normalizeLabel(ctx));
      const familyLabel = entry?.family ?? ctx;
      const childLabel = entry?.child ?? null;
      const key = normalizeLabel(familyLabel);
      if (seen.has(key)) continue; // 1 atribuição por família por post
      seen.add(key);
      const fam = fams.get(key) ?? { label: familyLabel, older: emptyHalf(), recent: emptyHalf() };
      const half = isRecent ? fam.recent : fam.older;
      half.sum += saved;
      half.count += 1;
      if (childLabel) half.children.set(childLabel, (half.children.get(childLabel) ?? 0) + 1);
      fams.set(key, fam);
    }
  }

  let best: RisingTerritoryInsight | null = null;
  let bestRatio = 0;
  for (const fam of fams.values()) {
    if (fam.older.count < MIN_HALF_POSTS || fam.recent.count < MIN_HALF_POSTS) continue;
    const olderAvg = fam.older.sum / fam.older.count;
    const recentAvg = fam.recent.sum / fam.recent.count;
    if (olderAvg <= 0 || recentAvg <= 0) continue;
    const ratio = recentAvg / olderAvg;
    if (ratio >= RISE_MARGIN && ratio > bestRatio) {
      let label = fam.label;
      let topChild: string | null = null;
      let topChildN = 0;
      for (const [c, n] of fam.recent.children) if (n > topChildN) { topChild = c; topChildN = n; }
      if (topChild && topChildN >= CHILD_DOMINANCE_SHARE * fam.recent.count) label = topChild;
      best = { label };
      bestRatio = ratio;
    }
  }
  return best;
}

// Frases prontas (com preposição/gênero) para encaixar direto na headline.
const COMBO_WEEKDAY: Record<string, string> = {
  Sunday: "aos domingos", Monday: "às segundas", Tuesday: "às terças",
  Wednesday: "às quartas", Thursday: "às quintas", Friday: "às sextas", Saturday: "aos sábados",
};
function comboTimeBucket(hour: number): string {
  if (hour >= 5 && hour < 12) return "de manhã";
  if (hour >= 12 && hour < 18) return "à tarde";
  if (hour >= 18 && hour < 24) return "à noite";
  return "de madrugada";
}

/**
 * Encontra o cruzamento território × momento mais distintivo e CONFIÁVEL.
 * Cada célula (família × horário) e (família × dia) precisa de ≥MIN_COMBO_CELL posts
 * e bater a média do território por ≥COMBO_MARGIN. Surfa o de maior destaque.
 * Rotula o território com o filho dominante da célula quando há um claro.
 */
function pickComboInsight(
  posts: Array<{ postDate: Date; saved: number; context: unknown }>,
): ComboInsight | null {
  interface Cell { famKey: string; famLabel: string; whenKind: "timeOfDay" | "dayOfWeek"; whenLabel: string; sum: number; count: number; children: Map<string, number>; }
  const famTotal = new Map<string, { sum: number; count: number }>();
  const cells = new Map<string, Cell>();

  for (const p of posts) {
    const saved = typeof p.saved === "number" ? p.saved : 0;
    const ctxArr: string[] = Array.isArray(p.context) ? p.context : [];
    const date = new Date(p.postDate);
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: COMBO_TZ }).format(date)) % 24;
    const wd = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: COMBO_TZ }).format(date);
    const axes: Array<{ kind: "timeOfDay" | "dayOfWeek"; label: string }> = [
      { kind: "timeOfDay", label: comboTimeBucket(hour) },
      { kind: "dayOfWeek", label: COMBO_WEEKDAY[wd] ?? wd },
    ];
    const seenFam = new Set<string>();
    for (const ctx of ctxArr) {
      if (!ctx) continue;
      const entry = CONTEXT_FAMILY_MAP.get(normalizeLabel(ctx));
      const famLabel = entry?.family ?? ctx;
      const childLabel = entry?.child ?? null;
      const famKey = normalizeLabel(famLabel);
      if (seenFam.has(famKey)) continue;
      seenFam.add(famKey);
      const ft = famTotal.get(famKey) ?? { sum: 0, count: 0 };
      ft.sum += saved; ft.count += 1; famTotal.set(famKey, ft);
      for (const axis of axes) {
        const cellKey = `${famKey}|${axis.kind}|${axis.label}`;
        const cell = cells.get(cellKey) ?? { famKey, famLabel, whenKind: axis.kind, whenLabel: axis.label, sum: 0, count: 0, children: new Map() };
        cell.sum += saved; cell.count += 1;
        if (childLabel) cell.children.set(childLabel, (cell.children.get(childLabel) ?? 0) + 1);
        cells.set(cellKey, cell);
      }
    }
  }

  let best: ComboInsight | null = null;
  let bestRatio = 0;
  for (const cell of cells.values()) {
    if (cell.count < MIN_COMBO_CELL) continue;
    const ft = famTotal.get(cell.famKey);
    if (!ft || ft.count === 0) continue;
    const famAvg = ft.sum / ft.count;
    const cellAvg = cell.sum / cell.count;
    if (famAvg <= 0 || cellAvg <= 0) continue;
    const ratio = cellAvg / famAvg;
    if (ratio >= COMBO_MARGIN && ratio > bestRatio) {
      let territoryLabel = cell.famLabel;
      let topChild: string | null = null; let topChildN = 0;
      for (const [c, n] of cell.children) if (n > topChildN) { topChild = c; topChildN = n; }
      if (topChild && topChildN >= CHILD_DOMINANCE_SHARE * cell.count) territoryLabel = topChild;
      best = { territoryLabel, whenKind: cell.whenKind, whenLabel: cell.whenLabel };
      bestRatio = ratio;
    }
  }
  return best;
}


/**
 * Detecta divergência entre o que o mapa confirma como principal e
 * o que a audiência mais guarda. Só retorna se houver divergência real.
 */
function detectTerritoryDivergence(
  topAudienceLabel: string,
  confirmedMapTerritories: string[],
): TerritoryDivergenceInsight | null {
  if (!confirmedMapTerritories.length) return null;
  const topMapLabel = confirmedMapTerritories[0]!;
  // Se a audiência reconhece o mesmo território que está no topo do mapa → não é divergência
  if (territoryLabelsMatch(topAudienceLabel, topMapLabel)) return null;
  // Verifica também contra os outros territórios confirmados
  const matchesAny = confirmedMapTerritories.some((m) =>
    territoryLabelsMatch(topAudienceLabel, m)
  );
  if (matchesAny) return null; // está no mapa, só não é o principal — sem divergência notável

  return {
    audienceLabel: topAudienceLabel,
    mapLabel: topMapLabel,
  };
}

/** Extrai o pico de cada dimensão demográfica. */
function pickDemographics(raw: Awaited<ReturnType<typeof getLatestAudienceDemographics>>): AudienceDemographicsInsight | null {
  if (!raw?.follower_demographics) return null;
  const { age, gender, city, country } = raw.follower_demographics;

  const topOf = (rec?: Record<string, number>): string | null => {
    if (!rec) return null;
    const entries = Object.entries(rec).filter(([, v]) => v > 0);
    if (!entries.length) return null;
    return entries.sort(([, a], [, b]) => b - a)[0]![0];
  };

  const topGenderKey = topOf(gender);
  const genderMap: Record<string, string> = {
    F: "feminino", FEMALE: "feminino", female: "feminino",
    M: "masculino", MALE: "masculino", male: "masculino",
  };
  const dominantGender = topGenderKey ? (genderMap[topGenderKey] ?? topGenderKey.toLowerCase()) : null;

  const result: AudienceDemographicsInsight = {
    topAgeRange: topOf(age),
    dominantGender,
    topCity: topOf(city),
    topCountry: topOf(country),
  };

  // Só retorna se houver ao menos 1 dimensão com dado
  if (!result.topAgeRange && !result.dominantGender && !result.topCity && !result.topCountry) {
    return null;
  }
  return result;
}

const GENDER_MAP: Record<string, string> = {
  F: "feminino", FEMALE: "feminino", female: "feminino",
  M: "masculino", MALE: "masculino", male: "masculino",
};

/**
 * Detecta divergência entre quem SEGUE e quem ENGAJA. Surfa a primeira dimensão
 * (gênero → faixa etária → cidade) cujo topo difere. Exige liderança CLARA (≥1.2× o
 * 2º) nos dois lados — a demografia engajada vem de janela curta (this_month) e pode
 * oscilar; o guard evita surfar um empate.
 */
function pickEngagedDivergence(
  raw: Awaited<ReturnType<typeof getLatestAudienceDemographics>>,
): EngagedDivergenceInsight | null {
  const f = raw?.follower_demographics;
  const e = (raw as any)?.engaged_audience_demographics;
  if (!f || !e) return null;

  const clearTop = (rec?: Record<string, number>): string | null => {
    if (!rec) return null;
    const entries = Object.entries(rec).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
    if (!entries.length) return null;
    if (entries.length === 1) return entries[0]![0];
    return entries[0]![1] >= entries[1]![1] * 1.2 ? entries[0]![0] : null;
  };

  const fg = clearTop(f.gender), eg = clearTop(e.gender);
  if (fg && eg && fg !== eg) {
    return { dimension: "gênero", followerLabel: GENDER_MAP[fg] ?? fg.toLowerCase(), engagedLabel: GENDER_MAP[eg] ?? eg.toLowerCase() };
  }
  const fa = clearTop(f.age), ea = clearTop(e.age);
  if (fa && ea && fa !== ea) {
    return { dimension: "faixa etária", followerLabel: fa, engagedLabel: ea };
  }
  const fc = clearTop(f.city), ec = clearTop(e.city);
  if (fc && ec && normalizeLabel(fc) !== normalizeLabel(ec)) {
    return { dimension: "cidade", followerLabel: fc, engagedLabel: ec };
  }
  return null;
}

// ─── Serviço principal ──────────────────────────────────────────────────────

export async function buildAudienceInsights(
  userId: string | Types.ObjectId,
  options?: {
    periodDays?: number;
    /**
     * V2 — Labels dos territórios confirmados no mapa do criador (em ordem de relevância).
     * Passados pela page.tsx a partir de synthesis.narrativeTerritories.
     * Sem isso, a detecção de divergência não acontece.
     */
    confirmedTerritoryLabels?: string[];
  },
): Promise<AudienceInsights> {
  const confirmedTerritoryLabels = options?.confirmedTerritoryLabels ?? [];

  try {
    const resolvedId = String(userId);

    // ── Fase 1: buscar TODOS os posts + demografia, e decidir a janela adaptativa ──
    const [allPosts, rawDemographics] = await Promise.all([
      MetricModel.find({ user: userId })
        .select("postDate stats.saved stats.shares stats.ig_reels_avg_watch_time stats.video_duration_seconds context tone lifeAssets")
        .lean()
        .catch(() => [] as any[]),
      getLatestAudienceDemographics(resolvedId).catch(() => null),
    ]);

    const postDates = (allPosts as any[])
      .map((p) => (p?.postDate ? new Date(p.postDate) : null))
      .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));

    // Se o chamador fixou um período explícito, respeita; senão escolhe adaptativamente.
    const window = options?.periodDays
      ? { days: options.periodDays, key: `last_${options.periodDays}_days`, label: `últimos ${options.periodDays} dias` }
      : chooseWindow(postDates);
    const effectiveKey = window.key;
    const periodLabel = window.label;

    // Posts dentro da janela escolhida (para ritmo/atenção/lifeAsset, computados in-memory).
    const windowStart = window.days === Infinity ? new Date(0) : new Date(Date.now() - window.days * 86_400_000);
    const rhythmPosts = (allPosts as any[]).filter(
      (p) => p?.postDate && new Date(p.postDate) >= windowStart,
    );

    // ── Fase 2: groupings (saves/reach/shares × dimensões) na janela escolhida ──
    const [savesGrouped, reachGrouped, sharesGrouped] = await Promise.all([
      getAverageEngagementByGroupings(userId, effectiveKey, "stats.saved", [
        "context", "tone", "contentIntent", "format", "narrativeForm", "stance",
      ]),
      getAverageEngagementByGroupings(userId, effectiveKey, "stats.reach", ["format"]),
      getAverageEngagementByGroupings(userId, effectiveKey, "stats.shares", [
        "context", "tone", "proposal", "format",
      ]),
    ]);

    // Context passa pelo rollup pai↔filho (consolida fragmentação de granularidade).
    const byContextSaves = rollUpContextFamilies(savesGrouped.context ?? []);
    const byToneSaves    = savesGrouped.tone ?? [];
    const byContentIntentSaves = savesGrouped.contentIntent ?? [];
    const byFormatSaves  = savesGrouped.format ?? [];
    const byNarrativeFormSaves = savesGrouped.narrativeForm ?? [];
    const byStanceSaves  = savesGrouped.stance ?? [];
    const byFormatReach  = reachGrouped.format ?? [];
    const byContextShares = rollUpContextFamilies(sharesGrouped.context ?? []);
    const byToneShares    = sharesGrouped.tone ?? [];
    const byProposalShares = sharesGrouped.proposal ?? [];
    const byFormatShares  = sharesGrouped.format ?? [];

    // ── V1 — 4 insights de reconhecimento ──────────────────────────────────────
    const orphanTerritory = pickOrphanTerritory(byContextSaves);

    const toneTop = pickTopMeaningful(byToneSaves, { excludeCommercial: true });
    const resonantTone: ResonantToneInsight | null = toneTop
      ? { label: toneTop.name, avgSaves: round(toneTop.value), postCount: toneTop.postsCount }
      : null;

    const savesFormatLeader = pickTop(byFormatSaves);
    const reachFormatLeader = pickTop(byFormatReach);
    let formatInversion: FormatInversionInsight | null = null;
    if (
      savesFormatLeader && reachFormatLeader &&
      normalizeLabel(savesFormatLeader.name) !== normalizeLabel(reachFormatLeader.name)
    ) {
      const reachOfSavesLeader = findByLabel(byFormatReach, savesFormatLeader.name);
      const savesOfReachLeader = findByLabel(byFormatSaves, reachFormatLeader.name);
      const reachMaterial = !reachOfSavesLeader || reachFormatLeader.value >= reachOfSavesLeader.value * (1 + FORMAT_INVERSION_MARGIN);
      const savesMaterial = !savesOfReachLeader || savesFormatLeader.value >= savesOfReachLeader.value * (1 + FORMAT_INVERSION_MARGIN);
      if (reachMaterial && savesMaterial) {
        formatInversion = { reachLeaderLabel: reachFormatLeader.name, savesLeaderLabel: savesFormatLeader.name };
      }
    }

    // Intenção: agora via contentIntent (V2). Exclui intents comerciais (converter/anunciar).
    const intentTop = pickTopMeaningful(byContentIntentSaves, { excludeCommercial: true });
    const resonantIntent: ResonantIntentInsight | null = intentTop
      ? { label: intentTop.name, avgSaves: round(intentTop.value), postCount: intentTop.postsCount }
      : null;

    // Forma narrativa (V2) e Postura (V2.5) — dimensões já classificadas, antes não exibidas.
    const narrativeFormTop = pickTopMeaningful(byNarrativeFormSaves);
    const resonantNarrativeForm: ResonantNarrativeFormInsight | null = narrativeFormTop
      ? { label: narrativeFormTop.name, avgSaves: round(narrativeFormTop.value), postCount: narrativeFormTop.postsCount }
      : null;

    const stanceTop = pickTopMeaningful(byStanceSaves);
    const resonantStance: ResonantStanceInsight | null = stanceTop
      ? { label: stanceTop.name, avgSaves: round(stanceTop.value), postCount: stanceTop.postsCount }
      : null;

    // ── V2 — divergência mapa↔audiência + demografia ────────────────────────────
    // Remove territórios placeholder antes de comparar — divergência só faz sentido
    // contra um território REAL confirmado pelo criador.
    const realTerritories = confirmedTerritoryLabels.filter((l) => !isPlaceholderTerritory(l));
    const topAudienceContext = pickTopMeaningful(byContextSaves);
    // Território mais guardado + magnitude relativa (alimenta a espinha do card).
    const topTerritory = topAudienceContext
      ? { label: topAudienceContext.name, saveLift: round(computeLift(topAudienceContext, byContextSaves)) }
      : null;
    const territoryDivergence =
      topAudienceContext && realTerritories.length > 0
        ? detectTerritoryDivergence(topAudienceContext.name, realTerritories)
        : null;

    // Dedup território: órfão e divergência podem cair no MESMO território (assunto
    // pouco explorado + fora do mapa + mais guardado). Mostrar os dois é repetir a mesma
    // verdade com duas manchetes. A divergência é mais rica (compara com o mapa + tem CTA),
    // então quando colidem, mantemos a divergência e suprimimos o órfão.
    const orphanTerritoryDeduped: OrphanTerritoryInsight | null =
      territoryDivergence && orphanTerritory &&
      normalizeLabel(orphanTerritory.label) === normalizeLabel(territoryDivergence.audienceLabel)
        ? null
        : orphanTerritory;

    // Território de reconhecimento: o assunto mais guardado, mostrado direto.
    // Só quando NÃO há divergência (a divergência já o mostraria) e quando não é o
    // mesmo do território órfão — para nunca duplicar a mesma informação.
    const resonantTerritory: ResonantTerritoryInsight | null =
      topAudienceContext && !territoryDivergence && orphanTerritoryDeduped?.label !== topAudienceContext.name
        ? { label: topAudienceContext.name, avgSaves: round(topAudienceContext.value), postCount: topAudienceContext.postsCount }
        : null;

    // Território em ascensão (tendência no tempo). Dedup: se o que cresce é o MESMO
    // já mostrado (órfão/divergência/reconhecimento), não repete — momentum é secundário.
    const risingRaw = pickRisingTerritory(
      (rhythmPosts as any[]).map((p) => ({ postDate: p.postDate, saved: p.stats?.saved ?? 0, context: p.context })),
      windowStart,
    );
    const shownTerritoryLabels = [
      orphanTerritoryDeduped?.label,
      territoryDivergence?.audienceLabel,
      resonantTerritory?.label,
    ].filter(Boolean).map((l) => normalizeLabel(l as string));
    const risingTerritory: RisingTerritoryInsight | null =
      risingRaw && !shownTerritoryLabels.includes(normalizeLabel(risingRaw.label))
        ? risingRaw
        : null;

    const demographics = pickDemographics(rawDemographics);
    const engagedDivergence = pickEngagedDivergence(rawDemographics);

    // Combo cirúrgico (território × momento) — o cruzamento mais distintivo e confiável.
    const combo = pickComboInsight(
      (rhythmPosts as any[]).map((p) => ({ postDate: p.postDate, saved: p.stats?.saved ?? 0, context: p.context })),
    );

    // ── V3 — Ritmo ──────────────────────────────────────────────────────────────
    const postsForRhythm: RhythmPost[] = (rhythmPosts as any[]).map((p) => ({
      postDate: new Date(p.postDate),
      saves:  p.stats?.saved  ?? 0,
      shares: p.stats?.shares ?? 0,
    }));
    const rhythmList = buildRhythmInsights(postsForRhythm);
    const rhythmRaw = rhythmList[0] ?? null;
    // Se há combo, ele JÁ diz o "quando" com contexto (território × momento) — o ritmo
    // sozinho ("à noite elas guardam") vira redundante. Suprime para não repetir.
    const rhythm: RhythmInsightResult | null = (rhythmRaw && !combo)
      ? { kind: rhythmRaw.kind, signal: rhythmRaw.signal, label: rhythmRaw.label, score: rhythmRaw.score, postCount: rhythmRaw.postCount }
      : null;

    // ── V3 — Atenção (watch-time derivado × contexto) ───────────────────────────
    // ig_reels_avg_watch_time está em ms; video_duration_seconds em segundos.
    // Retenção relativa = (wt_ms / 1000) / duration_s. Valores >1 são possíveis (loops).
    // Calculamos manualmente em grupos de contexto para não depender do campo retention_rate.
    const retentionByContext: Record<string, { sum: number; count: number }> = {};
    for (const p of rhythmPosts as any[]) {
      const wt = p.stats?.ig_reels_avg_watch_time ?? 0;
      const dur = p.stats?.video_duration_seconds ?? 0;
      if (!wt || !dur) continue;
      const ret = (wt / 1000) / dur;
      const ctxArr: string[] = Array.isArray(p.context) ? p.context : [];
      for (const ctx of ctxArr) {
        if (!ctx) continue;
        const bucket = retentionByContext[ctx] ?? { sum: 0, count: 0 };
        bucket.sum += ret;
        bucket.count += 1;
        retentionByContext[ctx] = bucket;
      }
    }
    // Converte para AverageResult[] compatível com buildAttentionInsight
    const retentionResults = Object.entries(retentionByContext).map(([name, { sum, count }]) => ({
      name,
      value: sum / count,
      postsCount: count,
    }));
    const attentionRaw = buildAttentionInsight({ context: retentionResults });
    const attention: AttentionInsightResult | null = attentionRaw
      ? { grouping: attentionRaw.grouping, label: attentionRaw.label, avgRetention: attentionRaw.avgRetention, postCount: attentionRaw.postCount }
      : null;

    // ── V3 — Propagação (shares × contexto/tom) ─────────────────────────────────
    const propagationRaw = buildPropagationInsight({
      context: byContextShares,
      tone:    byToneShares,
      proposal: byProposalShares,
      format:  byFormatShares,
    });
    const propagation: PropagationInsightResult | null = propagationRaw
      ? { grouping: propagationRaw.grouping, label: propagationRaw.label, avgShares: propagationRaw.avgShares, postCount: propagationRaw.postCount }
      : null;

    // ── V3 — Asset de vida × reconhecimento ─────────────────────────────────────
    // Agrupa posts que têm lifeAssets taggeados (via publish-intent + contentContext)
    // e encontra o asset que gera mais saves em média.
    const assetBuckets = new Map<string, { sum: number; count: number }>();
    for (const p of rhythmPosts as any[]) {
      const la: string[] = Array.isArray((p as any).lifeAssets) ? (p as any).lifeAssets : [];
      const saves: number = (p as any).stats?.saved ?? 0;
      for (const asset of la) {
        if (!asset) continue;
        const b = assetBuckets.get(asset) ?? { sum: 0, count: 0 };
        b.sum += saves;
        b.count += 1;
        assetBuckets.set(asset, b);
      }
    }
    const assetResults = [...assetBuckets.entries()]
      .map(([name, { sum, count }]) => ({ name, value: sum / count, postsCount: count }));
    const topAsset = pickTopMeaningful(assetResults);
    const topLifeAsset: LifeAssetInsight | null = topAsset
      ? { label: topAsset.name, avgSaves: round(topAsset.value), postCount: topAsset.postsCount }
      : null;

    const insights: AudienceInsights = {
      orphanTerritory: orphanTerritoryDeduped,
      resonantTone,
      formatInversion,
      resonantIntent,
      territoryDivergence,
      resonantTerritory,
      risingTerritory,
      combo,
      demographics,
      rhythm,
      attention,
      propagation,
      resonantNarrativeForm,
      resonantStance,
      topLifeAsset,
      engagedDivergence,
      periodLabel,
      confirmedTerritoryLabels: realTerritories,
      topTerritory,
      risingTerritoryLabel: risingRaw?.label ?? null,
      // hasAny = true quando há QUALQUER sinal real sobre a audiência.
      // Os insights não-óbvios (ritmo/atenção/propagação/reconhecimento×mapa) têm
      // prioridade e aparecem primeiro. A demografia é a ÂNCORA: garante que o card
      // nunca fique vazio para um criador conectado que tem ao menos esse dado.
      // (Decisão de produto: o card "Sua Audiência" deve sempre existir com informação —
      // a demografia é dado real e limpo, não placeholder vazio.)
      hasAny: Boolean(
        orphanTerritoryDeduped || resonantTone || formatInversion || resonantIntent ||
        territoryDivergence || resonantTerritory || risingTerritory || combo || rhythm || attention || propagation ||
        resonantNarrativeForm || resonantStance || topLifeAsset || engagedDivergence || demographics
      ),
    };

    return insights;
  } catch {
    return EMPTY_INSIGHTS;
  }
}
