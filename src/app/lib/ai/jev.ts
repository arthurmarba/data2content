// Jev (TypeSafe): modelo que só responde pergunta fechada sobre um texto (sim/não, escolha entre opções ou
// nota numa escala), com a probabilidade de cada resposta. Rápido (~0,4 s) e quase de graça; não escreve,
// não explica e não busca dado. Sem TYPESAFE_API_KEY, ou com o serviço fora, devolve null e quem chama
// segue sem ele.
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
// Fixado: os limites de quem usa foram medidos nesta versão (teste de publis de 09/10/2026).
const MODEL = 'jev-1.13.0';
const TIMEOUT_MS = 4000;
const MAX_IN_FLIGHT = 24; // limite da TypeSafe: 80 pedidos por segundo
const BREAKER_FAILURES = 3;
const BREAKER_MS = 60000;

export type JevQuestion =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'score'; instructions: string; criteria: string[] };

export type JevAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence?: number }
  | { type: 'score'; score: number; probabilities: Record<string, number>; confidence?: number };

let inFlight = 0;
const waiting: (() => void)[] = [];
let failures = 0;
let openUntil = 0;

async function acquire() {
  if (inFlight < MAX_IN_FLIGHT) { inFlight++; return; }
  await new Promise<void>(resolve => waiting.push(resolve));
}
function release() {
  const next = waiting.shift();
  if (next) next(); else inFlight--;
}
function failed() {
  failures++;
  // Depois de algumas falhas seguidas, para de chamar por um minuto em vez de fazer cada post esperar o prazo.
  if (failures >= BREAKER_FAILURES) openUntil = Date.now() + BREAKER_MS;
}

export async function askJev<K extends string>(state: unknown, questions: Record<K, JevQuestion>): Promise<Record<K, JevAnswer> | null> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key || Date.now() < openUntil) return null;
  await acquire();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() < openUntil) return null;
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: MODEL, state, questions }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) {
          const json = await res.json();
          failures = 0;
          return json?.answers ?? null;
        }
        if (res.status !== 429 && res.status < 500) { failed(); return null; }
        const retryAfter = Number(res.headers.get('retry-after'));
        await new Promise(resolve => setTimeout(resolve, Math.min(retryAfter > 0 ? retryAfter * 1000 : 400, 2000)));
      } catch {
        failed();
        return null;
      }
    }
    failed();
    return null;
  } finally {
    release();
  }
}

export function resetJevForTests() {
  inFlight = 0; waiting.length = 0; failures = 0; openUntil = 0;
}
