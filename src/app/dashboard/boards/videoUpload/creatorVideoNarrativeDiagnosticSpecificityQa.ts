import type { CreatorVideoNarrativeEvidenceAnchors } from "./creatorVideoNarrativeDiagnosisTypes";

const GENERIC_DIAGNOSTIC_PATTERNS = [
  /comunica[cç][aã]o aut[eê]ntica/i,
  /conte[uú]do gera conex[aã]o/i,
  /conte[uú]dos relevantes/i,
  /narrativa [ée] forte/i,
  /v[ií]deo tem potencial/i,
  /audi[eê]ncia pode se identificar/i,
  /conte[uú]do [ée] humanizado/i,
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function anchorTexts(anchors: CreatorVideoNarrativeEvidenceAnchors | undefined): string[] {
  if (!anchors) return [];
  return [
    ...anchors.speechQuotes.map((anchor) => anchor.quote),
    ...anchors.sceneAnchors.map((anchor) => anchor.description),
    ...(anchors.creatorIntentAnchor ? [anchors.creatorIntentAnchor.statedGoal, anchors.creatorIntentAnchor.interpretedGoal] : []),
    ...(anchors.profilePatternAnchors?.flatMap((anchor) => [anchor.patternLabel, anchor.whyThisVideoRelates]) ?? []),
    ...(anchors.instagramAnchors?.flatMap((anchor) => [anchor.signalLabel, anchor.evidenceSummary]) ?? []),
  ].filter(Boolean);
}

export function hasSpecificEvidenceAnchor(
  text: string,
  anchors: CreatorVideoNarrativeEvidenceAnchors | undefined,
): boolean {
  const normalizedText = normalize(text);
  return anchorTexts(anchors).some((anchor) => {
    const normalizedAnchor = normalize(anchor);
    if (!normalizedAnchor || normalizedAnchor.length < 8) return false;
    return normalizedText.includes(normalizedAnchor) || normalizedAnchor.split(" ").some((word) => word.length >= 8 && normalizedText.includes(word));
  });
}

export function isProbablyGenericDiagnosticText(
  text: string,
  anchors?: CreatorVideoNarrativeEvidenceAnchors,
): boolean {
  const hasGenericPhrase = GENERIC_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(text));
  if (!hasGenericPhrase) return false;
  return !hasSpecificEvidenceAnchor(text, anchors);
}
