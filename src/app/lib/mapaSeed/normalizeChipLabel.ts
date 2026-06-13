// src/app/lib/mapaSeed/normalizeChipLabel.ts
//
// Normalização de rótulos de chip do mapa (territórios, temas, assets).
//
// Princípio: um chip é um RÓTULO, não uma descrição — deve caber em uma linha.
// Quando a IA empacota exemplos entre parênteses como uma lista separada por
// vírgula, o rótulo gigante é quebrado em vários chips curtos:
//
//   "Cenários externos (praia, metrô, áreas verdes)"
//     → ["Cenários externos", "Praia", "Metrô", "Áreas verdes"]
//
// Parênteses SEM vírgula são sinal (um nome ou especificação única), não uma
// lista de exemplos — ficam intactos:
//
//   "A esposa (Lívia Linhares)" → ["A esposa (Lívia Linhares)"]
//
// A função é determinística e idempotente: aplicá-la a um rótulo já curto
// devolve o próprio rótulo. É esse o ponto único de verdade usado pelo hook
// pre('save') do MapaSeed e pelo script de normalização dos mapas já gravados.

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Quebra um único rótulo (possivelmente verboso) em um ou mais chips curtos.
 * Retorna [] para entrada vazia.
 */
export function splitChipLabel(raw: string): string[] {
  const label = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!label) return [];

  // Parêntese FINAL cujo conteúdo é uma enumeração (contém vírgula).
  // [^()]* evita capturar parênteses aninhados.
  const match = label.match(/^(.*?)\s*\(([^()]*,[^()]*)\)\s*$/u);
  if (!match) return [label];

  const core = (match[1] ?? "").trim();
  const examples = (match[2] ?? "")
    .split(",")
    .map((part) => capitalizeFirst(part.trim()))
    .filter(Boolean);

  const out = [core, ...examples].filter(Boolean);

  // Dedupe case-insensitive preservando a ordem.
  const seen = new Set<string>();
  return out.filter((chip) => {
    const key = chip.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Normaliza um array de chips: quebra rótulos empacotados, descarta vazios,
 * dedupa case-insensitive e limita o total apenas como teto de segurança.
 *
 * O cap é generoso de propósito: quebrar rótulos empacotados ("praia, metrô,
 * áreas verdes" → 3 chips) é desejável porque especificidade gera pauta precisa,
 * e o criador controla add/remove. O teto só evita explosão patológica — não
 * deve cortar assets reais de um mapa normal.
 */
export function sanitizeChipArray(items: unknown, cap = 24): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    for (const chip of splitChipLabel(String(raw ?? ""))) {
      const key = chip.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(chip);
      if (out.length >= cap) return out;
    }
  }
  return out;
}
