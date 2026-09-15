export const LEGACY_SCENE_FORMAT = "scene_legacy_v1";
export const COMPACT_SCENE_FORMAT = "scene_segments_v1";
export type SceneResponseFormat = typeof LEGACY_SCENE_FORMAT | typeof COMPACT_SCENE_FORMAT;

const MAX_SEGMENTS = 160;
const MAX_SCENES = 40;
const MAX_SEGMENT_CHARS = 1600;
const MAX_TRANSCRIPT_CHARS = 30000;

/**
 * Adapta a resposta sem inventar texto nem apagar silêncio.
 *
 * Tolerância igual à do formato antigo, medida no experimento de 14/09/2026: o modelo
 * erra tempos em até ~15s além do fim, esquece `segmentos` em cenas sem fala e passa
 * de 12 cenas. O parser antigo aceitava tudo isso em silêncio; recusar aqui descartava
 * leituras boas e tornava a comparação injusta. Tempo inválido vira null (a qualidade
 * da transcrição deixa de ser "complete"); tempo além do fim é limitado à duração.
 */
export function expandCompactScene(raw: Record<string, unknown>, durationSeconds: number | null, partial = false): Record<string, unknown> | null {
  if (raw.formato !== COMPACT_SCENE_FORMAT) return null;
  if (!partial && (!Array.isArray(raw.segmentos) || !Array.isArray(raw.cenas))) return null;
  const limitMs = durationSeconds != null && Number.isFinite(durationSeconds) ? Math.round(durationSeconds * 1000) : null;
  const time = (value: unknown) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    return limitMs == null ? Math.round(value) : Math.min(Math.round(value), limitMs);
  };

  const segments: Array<{ id: string | null; inicioMs: number | null; fimMs: number | null; texto: string }> = [];
  const byId = new Map<string, number>();
  for (const item of Array.isArray(raw.segmentos) ? raw.segmentos.slice(0, MAX_SEGMENTS) : []) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const text = typeof entry.texto === "string" ? entry.texto.trim().slice(0, MAX_SEGMENT_CHARS) : "";
    if (!text) continue;
    // Id repetido não pode ser referenciado sem ambiguidade: o texto fica, a referência não.
    const id = typeof entry.id === "string" && entry.id.trim() && !byId.has(entry.id.trim()) ? entry.id.trim() : null;
    if (id) byId.set(id, segments.length);
    segments.push({ id, inicioMs: time(entry.inicioMs), fimMs: time(entry.fimMs), texto: text });
  }
  const transcript = segments.map((segment) => segment.texto).join(" ").slice(0, MAX_TRANSCRIPT_CHARS);

  const scenes = (Array.isArray(raw.cenas) ? raw.cenas.slice(0, MAX_SCENES) : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const scene = item as Record<string, unknown>;
    const refs = Array.isArray(scene.segmentos) ? scene.segmentos : [];
    const used = new Set<number>();
    for (const ref of refs) {
      const index = typeof ref === "string" ? byId.get(ref.trim()) : undefined;
      if (index != null) used.add(index);
    }
    const speech = [...used].sort((a, b) => a - b).map((index) => segments[index]!.texto).join(" ");
    return [{ ...scene, inicioMs: time(scene.inicioMs), fimMs: time(scene.fimMs), fala: speech }];
  });

  return { ...raw, transcricao: transcript, segmentos: segments, cenas: scenes };
}

/** Só muda o contrato de vídeo; fotos e carrosséis conservam seu prompt. */
export function compactVideoPrompt(legacyFormat: string): string {
  const lines = legacyFormat.split("\n");
  const exampleIndex = lines.findIndex(line => line.startsWith('{"assets"'));
  const example = JSON.parse(lines[exampleIndex]!);
  delete example.transcricao;
  example.segmentos = [{ id: "s1", inicioMs: 0, fimMs: 4200, texto: "Gente, eu preciso falar sobre ontem" }];
  example.cenas = example.cenas.map((scene: any) => { const { fala, ...visual } = scene; return { ...visual, segmentos: ["s1"] }; });
  // A versão vem primeiro e sobrevive ao aproveitamento de resposta truncada.
  lines[exampleIndex] = JSON.stringify({ formato: COMPACT_SCENE_FORMAT, ...example });
  return lines.filter(line => !line.startsWith("transcricao:") && !line.startsWith("segmentos:")).join("\n") + `
formato: use exatamente "${COMPACT_SCENE_FORMAT}".
segmentos: transcreva TODA a fala literal uma única vez, em frases/unidades curtas na ordem do áudio. Cada trecho tem id único (s1, s2...), inicioMs, fimMs e texto. Preserve nomes, números, negações e repetições realmente faladas. Não resuma nem corrija. Máximo 160 trechos, 1600 caracteres por trecho. [] quando ninguém fala, inclusive em vídeo só com música. Não preencha silêncios.
cenas: cada cena inclui segmentos, uma lista ordenada dos IDs da fala que cruza aquele intervalo; [] se não houver fala. Uma frase que cruza um corte pode ser referenciada nas duas cenas. Toda fala deve aparecer em pelo menos uma cena. Preserve a descrição visual e os demais campos. Não repita texto falado dentro das cenas e não crie o campo transcricao.
Tempos: números em milissegundos, fim maior que início, dentro da duração do vídeo. Cenas e segmentos são ordenados e não se sobrepõem dentro de cada lista. Lacunas silenciosas são válidas.`;
}
