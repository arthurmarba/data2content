import { buildCreatorVideoNarrativeDiagnosisFixture } from "./creatorVideoNarrativeDiagnosisFixtures";
import { sanitizeCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisSanitizer";
import type { CreatorNarrativeMapReadingDiagnosisShape } from "./creatorNarrativeMapReadingChapters";

export function buildNarrativeMapReadingDiagnosisFixture(
  overrides: Partial<CreatorNarrativeMapReadingDiagnosisShape> = {},
): CreatorNarrativeMapReadingDiagnosisShape {
  const sanitized = sanitizeCreatorVideoNarrativeDiagnosisInput(buildCreatorVideoNarrativeDiagnosisFixture({
    diagnosisId: "diagnosis-reading-map-1",
    profileContribution: {
      type: "confirms_existing_pattern",
      confidence: "high",
      weight: "high",
      reason: "Este vídeo reforça humor cotidiano com identificação rápida, um sinal que ja aparece no Perfil.",
      profileImpactPreview: "Reforça uma narrativa em formação, sem mudar o Perfil sozinho.",
    },
  }));

  return {
    ...sanitized,
    createdAt: new Date("2026-05-20T10:03:00.000Z"),
    ...overrides,
  };
}
