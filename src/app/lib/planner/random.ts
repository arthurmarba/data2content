// @/app/lib/planner/random.ts
// RNG determinístico e utilidades de amostragem para os "TESTES" do planner.

export type RngFn = () => number; // retorna float em [0,1)

/**
 * Hash simples para derivar seed a partir de string.
 * xmur3 + mulberry32 -> rápido e suficiente para reprodutibilidade.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    // força para 32 bits não negativos
    return h >>> 0;
  };
}

function mulberry32(seed: number): RngFn {
  let t = seed >>> 0;
  return function () {
    t |= 0;
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    // [0,1)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cria um RNG determinístico a partir de seed (string ou number).
 * Use uma seed composta (ex.: `${userId}:${weekStartISO}`) para reproduzir a mesma semana.
 */
export function createSeededRng(seed: string | number): RngFn {
  const n = typeof seed === 'number' ? seed : xmur3(String(seed))();
  return mulberry32(n);
}

/** Float em [min, max) */
export function randFloat(rng: RngFn, min = 0, max = 1): number {
  return min + (max - min) * rng();
}

/** Inteiro em [min, max] (inclusivo) */
export function randInt(rng: RngFn, min: number, max: number): number {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(randFloat(rng, 0, 1) * (b - a + 1)) + a;
}

/** Embaralha in-place (Fisher–Yates) */
export function shuffleInPlace<T>(arr: T[], rng: RngFn): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    // evita T | undefined quando noUncheckedIndexedAccess estiver ativo
    const ai = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = ai;
  }
  return arr;
}

/** Softmax estável (com temperatura). Retorna probs normalizadas. */
export function softmax(
  scores: number[],
  temperature = 1
): number[] {
  if (!scores.length) return [];
  const T = Math.max(1e-6, temperature); // evita divisão por zero
  const scaled = scores.map((s) => (Number.isFinite(s) ? s / T : -Infinity));
  const m = Math.max(...scaled.filter((x) => Number.isFinite(x)), -Infinity);
  // exp(s - m) para estabilidade
  const exps = scaled.map((s) => (s === -Infinity ? 0 : Math.exp(s - m)));
  const sum = exps.reduce((acc, v) => acc + v, 0);
  if (sum <= 0) {
    // fallback: tudo zero -> distribuição uniforme
    const p = 1 / scores.length;
    return scores.map(() => p);
  }
  return exps.map((e) => e / sum);
}

/** Amostragem categórica por pesos (não normalizados). */
export function weightedSample(weights: number[], rng: RngFn): number {
  if (!weights.length) return -1;

  // soma total robusta a buracos/undefined
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    total += Math.max(0, w);
  }

  if (total <= 0) {
    // uniforme se pesos inválidos
    return randInt(rng, 0, weights.length - 1);
  }

  let r = randFloat(rng, 0, total);
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    r -= Math.max(0, w);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** Amostra um índice via softmax dos scores com temperatura. */
export function softmaxSample(
  scores: number[],
  rng: RngFn,
  temperature = 1
): number {
  const probs = softmax(scores, temperature);
  return weightedSample(probs, rng);
}
