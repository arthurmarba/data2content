/**
 * Rastreabilidade entre uma pauta e as dimensões confirmadas do "Seu mapa".
 *
 * Os chips do card nunca são inferidos do título no cliente. Pautas novas
 * persistem as âncoras escolhidas pelo gerador depois de validá-las contra o
 * mapa; pautas antigas recebem um fallback honesto a partir dos campos que já
 * existiam (territory, assets e tone).
 */

export const CONTENT_IDEA_MAP_ANCHOR_KINDS = [
  "subject",
  "situation",
  "scene",
  "voice",
] as const;

export type ContentIdeaMapAnchorKind = (typeof CONTENT_IDEA_MAP_ANCHOR_KINDS)[number];
export type ContentIdeaMapAnchorSource = "territories" | "themes" | "assets" | "tone";

export interface ContentIdeaMapAnchor {
  kind: ContentIdeaMapAnchorKind;
  source: ContentIdeaMapAnchorSource;
  label: string;
}

export interface ContentIdeaMapAnchorContext {
  territories: string[];
  themes?: string[];
  assets: string[];
  tone?: string | null;
}

const SOURCE_BY_KIND: Record<ContentIdeaMapAnchorKind, ContentIdeaMapAnchorSource> = {
  subject: "territories",
  situation: "themes",
  scene: "assets",
  voice: "tone",
};

const DISPLAY_PRIORITY: Record<ContentIdeaMapAnchorKind, number> = {
  situation: 0,
  subject: 1,
  scene: 2,
  voice: 3,
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function isKind(value: unknown): value is ContentIdeaMapAnchorKind {
  return typeof value === "string" && CONTENT_IDEA_MAP_ANCHOR_KINDS.includes(value as ContentIdeaMapAnchorKind);
}

function canonicalMatch(label: string, allowed: string[]): string | null {
  const candidate = normalize(label);
  return allowed.find((value) => normalize(value) === candidate) ?? null;
}

function dedupeAndLimit(anchors: ContentIdeaMapAnchor[]): ContentIdeaMapAnchor[] {
  const seen = new Set<string>();
  let sceneCount = 0;

  return anchors.filter((anchor) => {
    if (anchor.kind === "scene") {
      if (sceneCount >= 2) return false;
      sceneCount += 1;
    }

    const key = `${anchor.kind}:${normalize(anchor.label)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

/** Sanitização estrutural para âncoras já persistidas. */
export function sanitizeStoredContentIdeaMapAnchors(value: unknown): ContentIdeaMapAnchor[] {
  if (!Array.isArray(value)) return [];

  const anchors = value.flatMap((raw): ContentIdeaMapAnchor[] => {
    if (!raw || typeof raw !== "object") return [];
    const candidate = raw as Record<string, unknown>;
    if (!isKind(candidate.kind) || typeof candidate.label !== "string") return [];
    const label = candidate.label.trim().slice(0, 120);
    const expectedSource = SOURCE_BY_KIND[candidate.kind];
    if (!label || candidate.source !== expectedSource) return [];
    return [{ kind: candidate.kind, source: expectedSource, label }];
  });

  return dedupeAndLimit(anchors);
}

/**
 * Valida a escolha do LLM contra o mapa confirmado e devolve sempre o rótulo
 * canônico do mapa, nunca a paráfrase gerada.
 */
export function sanitizeGeneratedContentIdeaMapAnchors(
  value: unknown,
  context: ContentIdeaMapAnchorContext,
): ContentIdeaMapAnchor[] {
  const structurallyValid = sanitizeStoredContentIdeaMapAnchors(value);
  const allowedBySource: Record<ContentIdeaMapAnchorSource, string[]> = {
    territories: context.territories,
    themes: context.themes ?? [],
    assets: context.assets,
    tone: context.tone?.trim() ? [context.tone.trim()] : [],
  };

  return dedupeAndLimit(structurallyValid.flatMap((anchor) => {
    const canonical = canonicalMatch(anchor.label, allowedBySource[anchor.source]);
    return canonical ? [{ ...anchor, label: canonical }] : [];
  }));
}

function legacyAnchors(params: {
  territory?: string | null;
  assets?: string[] | null;
  tone?: string | null;
}): ContentIdeaMapAnchor[] {
  const anchors: ContentIdeaMapAnchor[] = [];
  if (params.territory?.trim()) {
    anchors.push({ kind: "subject", source: "territories", label: params.territory.trim() });
  }
  for (const asset of params.assets ?? []) {
    if (asset?.trim()) anchors.push({ kind: "scene", source: "assets", label: asset.trim() });
  }
  if (params.tone?.trim()) {
    anchors.push({ kind: "voice", source: "tone", label: params.tone.trim() });
  }
  return dedupeAndLimit(anchors);
}

/**
 * Une as âncoras específicas escolhidas pelo gerador aos campos canônicos que
 * a pauta já possui. Assim o chip de assunto nunca falta e pautas antigas não
 * exigem migração.
 */
export function resolveContentIdeaMapAnchors(params: {
  mapAnchors?: unknown;
  territory?: string | null;
  assets?: string[] | null;
  tone?: string | null;
}): ContentIdeaMapAnchor[] {
  const stored = sanitizeStoredContentIdeaMapAnchors(params.mapAnchors);
  const fallbacks = legacyAnchors(params);
  return dedupeAndLimit([...stored, ...fallbacks]);
}

/** Ordem e limite visual do card; o detalhe pode usar a coleção completa. */
export function selectContentIdeaCardAnchors(
  anchors: ContentIdeaMapAnchor[],
  max = 4,
): ContentIdeaMapAnchor[] {
  return [...anchors]
    .sort((a, b) => DISPLAY_PRIORITY[a.kind] - DISPLAY_PRIORITY[b.kind])
    .slice(0, Math.max(0, max));
}

export function contentIdeaMapAnchorLabel(kind: ContentIdeaMapAnchorKind): string {
  switch (kind) {
    case "subject": return "Assunto";
    case "situation": return "Situação real";
    case "scene": return "Em cena";
    case "voice": return "Jeito de falar";
  }
}
