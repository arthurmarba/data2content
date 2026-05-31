/**
 * audienceRhythmInsights.ts
 *
 * Família "Ritmo" do card "Sua Audiência" (V3).
 *
 * Responde: QUANDO a audiência reconhece o criador — não para otimizar algoritmo,
 * mas para revelar o ritmo da relação. "Elas te guardam mais à noite" é uma verdade
 * sobre quando a audiência para pra prestar atenção em você, não uma prescrição de horário.
 *
 * REGRA DE CRENÇA: sinal é SEMPRE reconhecimento (saves/shares), NUNCA alcance/views.
 * Alcance é algoritmo; salvar e compartilhar é a audiência dizendo "isso é meu / é pra você".
 *
 * Núcleo é puro (recebe posts já normalizados) para ser testável e timezone-aware —
 * dia-da-semana e período do dia são extraídos no fuso do criador, senão "noite" não
 * significa nada.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Post reduzido ao que o ritmo precisa. */
export interface RhythmPost {
  postDate: Date;
  saves: number;
  shares: number;
}

export type RhythmSignal = "saves" | "shares";

export interface RhythmInsight {
  kind: "dayOfWeek" | "timeOfDay";
  signal: RhythmSignal;
  /** Rótulo humano do bucket vencedor: "quarta-feira" | "à noite". */
  label: string;
  /** Quanto o bucket vencedor se destaca da média geral (1.0 = na média). */
  score: number;
  /** Posts no bucket vencedor (transparência/depuração). */
  postCount: number;
}

// ─── Confiança ────────────────────────────────────────────────────────────────

const DEFAULT_TZ = "America/Sao_Paulo";
/** Mínimo de posts no período para qualquer leitura de ritmo. */
const MIN_TOTAL_POSTS = 12;
/** Mínimo de posts no bucket vencedor para confiar nele. */
const MIN_BUCKET_POSTS = 4;
/** O bucket vencedor precisa superar a média geral por esta folga (40%). */
const STANDOUT_MARGIN = 1.4;
/** E precisa superar o 2º colocado por esta folga, senão é empate (ruído). */
const RUNNER_UP_MARGIN = 1.15;

// ─── Extração timezone-aware ──────────────────────────────────────────────────

// Frases prontas (com preposição) pra encaixar direto: "Aos sábados, é quando…".
const WEEKDAY_LABELS: Record<string, string> = {
  Sunday: "aos domingos",
  Monday: "às segundas",
  Tuesday: "às terças",
  Wednesday: "às quartas",
  Thursday: "às quintas",
  Friday: "às sextas",
  Saturday: "aos sábados",
};

function weekdayKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(date);
}

function hourInTz(date: Date, tz: string): number {
  const h = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(date);
  // "24" pode aparecer para meia-noite em alguns engines; normaliza para 0.
  const n = Number(h);
  return n === 24 ? 0 : n;
}

/** Período do dia + rótulo relacional ("à noite"). */
function timeOfDayBucket(hour: number): { key: string; label: string } {
  if (hour >= 5 && hour < 12) return { key: "manha", label: "de manhã" };
  if (hour >= 12 && hour < 18) return { key: "tarde", label: "à tarde" };
  if (hour >= 18 && hour < 24) return { key: "noite", label: "à noite" };
  return { key: "madrugada", label: "de madrugada" };
}

// ─── Núcleo: escolher o bucket que se destaca ─────────────────────────────────

interface Bucket {
  key: string;
  label: string;
  sum: number;
  count: number;
}

function mean(b: Bucket): number {
  return b.count > 0 ? b.sum / b.count : 0;
}

/**
 * Dado um conjunto de buckets, retorna o vencedor SE ele se destaca de forma
 * confiável: volume mínimo, supera a média geral por STANDOUT_MARGIN, e supera
 * o 2º colocado elegível por RUNNER_UP_MARGIN (evita empate técnico).
 */
function pickStandout(
  buckets: Bucket[],
  kind: RhythmInsight["kind"],
  signal: RhythmSignal,
): RhythmInsight | null {
  const totalCount = buckets.reduce((acc, b) => acc + b.count, 0);
  const totalSum = buckets.reduce((acc, b) => acc + b.sum, 0);
  if (totalCount < MIN_TOTAL_POSTS) return null;
  const grandMean = totalSum / totalCount;
  if (grandMean <= 0) return null;

  const eligible = buckets.filter((b) => b.count >= MIN_BUCKET_POSTS);
  if (eligible.length < 2) return null;

  const ranked = [...eligible].sort((a, b) => mean(b) - mean(a));
  const top = ranked[0]!;
  const runnerUp = ranked[1]!;
  const topMean = mean(top);

  if (topMean < grandMean * STANDOUT_MARGIN) return null;
  if (topMean < mean(runnerUp) * RUNNER_UP_MARGIN) return null;

  return {
    kind,
    signal,
    label: top.label,
    score: Math.round((topMean / grandMean) * 100) / 100,
    postCount: top.count,
  };
}

function buildBuckets(
  posts: RhythmPost[],
  signal: RhythmSignal,
  keyOf: (p: RhythmPost) => { key: string; label: string },
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const p of posts) {
    const value = signal === "saves" ? p.saves : p.shares;
    if (typeof value !== "number" || value < 0) continue;
    const { key, label } = keyOf(p);
    const b = map.get(key) ?? { key, label, sum: 0, count: 0 };
    b.sum += value;
    b.count += 1;
    map.set(key, b);
  }
  return [...map.values()];
}

// ─── API pública (pura) ───────────────────────────────────────────────────────

/**
 * Gera os insights de ritmo confiáveis. Pode devolver 0..N — a camada de catálogo
 * decide quais entram nos slots do card. Ordena por score (mais destacado primeiro).
 */
export function buildRhythmInsights(posts: RhythmPost[], tz: string = DEFAULT_TZ): RhythmInsight[] {
  if (!posts.length) return [];

  const out: RhythmInsight[] = [];
  const signals: RhythmSignal[] = ["saves", "shares"];

  for (const signal of signals) {
    const dayInsight = pickStandout(
      buildBuckets(posts, signal, (p) => ({
        key: weekdayKey(p.postDate, tz),
        label: WEEKDAY_LABELS[weekdayKey(p.postDate, tz)] ?? weekdayKey(p.postDate, tz),
      })),
      "dayOfWeek",
      signal,
    );
    if (dayInsight) out.push(dayInsight);

    const timeInsight = pickStandout(
      buildBuckets(posts, signal, (p) => timeOfDayBucket(hourInTz(p.postDate, tz))),
      "timeOfDay",
      signal,
    );
    if (timeInsight) out.push(timeInsight);
  }

  // Evita redundância: se "saves" e "shares" apontam o mesmo bucket/kind, mantém o de maior score.
  const best = new Map<string, RhythmInsight>();
  for (const i of out) {
    const k = `${i.kind}:${i.label}`;
    const cur = best.get(k);
    if (!cur || i.score > cur.score) best.set(k, i);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}
