/**
 * Contrato da recomendação que alimenta a frente e o detalhe de Collabs.
 *
 * Os nomes técnicos ficam restritos ao código. Todo texto persistido aqui pode
 * aparecer para o criador e, por isso, precisa ser curto, literal e comum.
 */

export const CONTENT_IDEA_OPPORTUNITY_KINDS = ["individual", "collab_optional"] as const;
export type ContentIdeaOpportunityKind = (typeof CONTENT_IDEA_OPPORTUNITY_KINDS)[number];

export type ContentIdeaEvidenceLevel = "exploratory" | "medium" | "strong";
export type ContentIdeaTimingConfidence = "medium" | "high";

export interface ContentIdeaTimingRecommendation {
  dayLabel: string;
  windowLabel: string;
  shortLabel: string;
  confidence: ContentIdeaTimingConfidence;
  reason: string;
  sampleSize: number;
}

export interface ContentIdeaOpportunityBrief {
  version: 1;
  kind: ContentIdeaOpportunityKind;
  /** Motivo simples e verificável para sugerir a ideia neste momento. */
  whyNow: string | null;
  /** Só existe quando a ideia funciona sozinha, mas pode melhorar com outra pessoa. */
  collabReason: string | null;
  /** Uma única explicação curta sobre os dados usados. */
  evidenceSummary: string | null;
  evidenceLevel: ContentIdeaEvidenceLevel;
  postsAnalyzed: number;
  timing: ContentIdeaTimingRecommendation | null;
}

export interface ContentIdeasCreativeSignals {
  postsAnalyzed: number;
  windowDays: number;
  confidence: "low" | "medium" | "high";
  subject: string | null;
  place: string | null;
  object: string | null;
  framing: string | null;
  tone: string | null;
  openingLines: string[];
  screenTitles: string[];
}

export interface ContentIdeasOpportunityContext {
  creativeSignals: ContentIdeasCreativeSignals | null;
  timing: ContentIdeaTimingRecommendation | null;
}

export function simplifyUserFacingText(value: unknown, max = 220): string | null {
  if (typeof value !== "string") return null;
  const simplified = value
    .replace(/\ba complementaridade (?:da|na) collab\b/gi, "o que cada pessoa acrescenta à parceria")
    .replace(/\bcomplementaridade (?:da|na) collab\b/gi, "o que cada pessoa acrescenta à parceria")
    .replace(/\bnarrativa central\b/gi, "tema central")
    .replace(/\bterrit[oó]rio narrativo\b/gi, "assunto")
    .replace(/\bnarrativas\b/gi, "temas")
    .replace(/\bnarrativa\b/gi, "tema")
    .replace(/\bterrit[oó]rios\b/gi, "assuntos")
    .replace(/\bterrit[oó]rio\b/gi, "assunto")
    .replace(/\bpautas\b/gi, "ideias")
    .replace(/\bpauta\b/gi, "ideia")
    .replace(/\bcomplementaridade\b/gi, "o que cada pessoa acrescenta")
    .replace(/\bperformance\b/gi, "resultado")
    .replace(/\bresson[aâ]ncia\b/gi, "resposta")
    .replace(/\binsight\b/gi, "o que percebemos")
    .replace(/\bframework\b/gi, "forma de organizar")
    .replace(/\bscore\b/gi, "avaliação")
    .replace(/\bfit\b/gi, "motivo")
    .replace(/\bstoryboard\b/gi, "passo a passo do vídeo")
    .replace(/\bum hook\b/gi, "uma frase inicial")
    .replace(/\bo hook\b/gi, "a frase inicial")
    .replace(/\bhook\b/gi, "frase inicial")
    .replace(/\bassets\b/gi, "elementos de cena")
    .replace(/\basset\b/gi, "elemento de cena")
    .replace(/\bmatches\b/gi, "parcerias")
    .replace(/\bmatch\b/gi, "parceria")
    .replace(/\bcollabs\b/gi, "parcerias")
    .replace(/\bcollab\b/gi, "parceria")
    .replace(/\s+/g, " ")
    .trim();
  if (!simplified) return null;
  if (simplified.length <= max) return simplified;
  const safeMax = Math.max(12, max - 1);
  const draft = simplified.slice(0, safeMax);
  const lastSpace = draft.lastIndexOf(" ");
  const cutAt = lastSpace >= Math.floor(safeMax * 0.7) ? lastSpace : safeMax;
  return `${draft.slice(0, cutAt).trimEnd()}…`;
}

function finiteCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

export function sanitizeContentIdeaTimingRecommendation(
  raw: unknown,
): ContentIdeaTimingRecommendation | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const dayLabel = simplifyUserFacingText(value.dayLabel, 40);
  const windowLabel = simplifyUserFacingText(value.windowLabel, 40);
  const shortLabel = simplifyUserFacingText(value.shortLabel, 80);
  const reason = simplifyUserFacingText(value.reason, 180);
  const confidence = value.confidence === "high" || value.confidence === "medium"
    ? value.confidence
    : null;
  if (!dayLabel || !windowLabel || !shortLabel || !reason || !confidence) return null;
  return {
    dayLabel,
    windowLabel,
    shortLabel,
    confidence,
    reason,
    sampleSize: finiteCount(value.sampleSize),
  };
}

export function sanitizeContentIdeaOpportunityBrief(
  raw: unknown,
): ContentIdeaOpportunityBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const kind = CONTENT_IDEA_OPPORTUNITY_KINDS.includes(value.kind as ContentIdeaOpportunityKind)
    ? value.kind as ContentIdeaOpportunityKind
    : null;
  if (!kind) return null;
  const evidenceLevel = value.evidenceLevel === "strong" || value.evidenceLevel === "medium" || value.evidenceLevel === "exploratory"
    ? value.evidenceLevel
    : "exploratory";
  return {
    version: 1,
    kind,
    whyNow: simplifyUserFacingText(value.whyNow, 180),
    collabReason: kind === "collab_optional" ? simplifyUserFacingText(value.collabReason, 180) : null,
    evidenceSummary: simplifyUserFacingText(value.evidenceSummary, 180),
    evidenceLevel,
    postsAnalyzed: finiteCount(value.postsAnalyzed),
    timing: sanitizeContentIdeaTimingRecommendation(value.timing),
  };
}

export function buildOpportunityEvidenceSummary(postsAnalyzed: number): string {
  if (postsAnalyzed <= 0) return "Usamos os assuntos que você informou no seu Mapa.";
  if (postsAnalyzed === 1) return "Usamos o seu Mapa e um vídeo recente.";
  return `Usamos o seu Mapa e ${postsAnalyzed} vídeos recentes.`;
}
