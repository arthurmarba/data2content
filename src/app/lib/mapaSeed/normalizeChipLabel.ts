// src/app/lib/mapaSeed/normalizeChipLabel.ts
//
// Normalização de rótulos de chip do mapa (territórios, temas, assets).
//
// Princípio: um chip é um RÓTULO, não uma descrição — deve caber em uma linha.
// Quando a IA empacota exemplos entre parênteses como uma lista separada por
// vírgula, o rótulo gigante é quebrado em vários chips curtos. E quando o núcleo
// é um CABEÇALHO DE CATEGORIA genérico ("Cenários externos", "Objetos de cena"),
// ele é descartado — o criador quer o item ESPECÍFICO, não a categoria:
//
//   "Cenários externos (praia, metrô, áreas verdes)"
//     → ["Praia", "Metrô", "Áreas verdes"]
//
// Núcleos que NÃO são categoria de cena são preservados (mais específicos por
// si só), p.ex. em territórios/temas:
//
//   "Família (esposa, filhos)" → ["Família", "Esposa", "Filhos"]
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

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

// Substantivos de categoria de CENA que a IA usa como cabeçalho de lista. Como
// NÚCLEO de uma enumeração ("Cenários externos (praia, metrô)") o cabeçalho é só
// um rótulo de grupo — dropado em favor dos específicos. Prefixo é seguro aqui
// porque a própria enumeração já sinaliza que o núcleo é uma categoria.
const SCENE_HEADER_PREFIX =
  /^(cenarios?|locac\w+|objetos?|equipamentos?|ferramentas?|enquadramentos?)\b/;
const BARE_QUALIFIER = /^(externos?|internos?)$/;

// Como chip ISOLADO, só dropamos por match EXATO de cabeçalho genérico — evita
// nukear temas/territórios legítimos como "Objeto de desejo" ou "Cenário do crime".
const BARE_SCENE_HEADER =
  /^(cenarios?( (externos?|internos?|diversos?|recorrentes?|variados?))?|objetos? de cena|externos?|internos?)$/;

function coreIsSceneHeader(core: string): boolean {
  const s = normalizeForMatch(core);
  return SCENE_HEADER_PREFIX.test(s) || BARE_QUALIFIER.test(s);
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
  if (!match) {
    // Cabeçalho de categoria genérico, isolado e sem específicos — não é chip
    // postável ("Cenários externos", "Objetos de cena", "Internos"). Sai do mapa.
    return BARE_SCENE_HEADER.test(normalizeForMatch(label)) ? [] : [label];
  }

  const core = (match[1] ?? "").trim();
  const examples = (match[2] ?? "")
    .split(",")
    .map((part) => capitalizeFirst(part.trim()))
    .filter(Boolean);

  // Núcleo que é cabeçalho de cena ("Cenários externos") é descartado; só os
  // específicos viram chip. Núcleo comum ("Família") é preservado.
  const out = (coreIsSceneHeader(core) ? examples : [core, ...examples]).filter(Boolean);

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
