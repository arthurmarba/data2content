import type {
  CreatorStrategicProfileSynthesis,
  CreatorStrategicProfileSynthesisConfidence,
  CreatorStrategicProfileSynthesisSignal,
} from "./creatorStrategicProfileSynthesis";

export type DiagnosticoLeadingNarrativeSource =
  | "main_narrative"
  | "recurring_pattern"
  | "tested_narrative"
  | "strength";

export interface DiagnosticoLeadingNarrativeSignal {
  label: string;
  summary: string;
  evidenceCount: number;
  diagnosisIds: string[];
  confidence: CreatorStrategicProfileSynthesisConfidence;
  source: DiagnosticoLeadingNarrativeSource;
}

function confidenceForEvidence(evidenceCount: number): CreatorStrategicProfileSynthesisConfidence {
  if (evidenceCount >= 4) return "high";
  if (evidenceCount >= 2) return "medium";
  return "low";
}

function fromSignal(
  signal: CreatorStrategicProfileSynthesisSignal | undefined,
  source: DiagnosticoLeadingNarrativeSource,
): DiagnosticoLeadingNarrativeSignal | null {
  if (!signal?.label?.trim()) return null;
  return {
    label: signal.label,
    summary: signal.summary,
    evidenceCount: signal.evidenceCount,
    diagnosisIds: signal.diagnosisIds,
    confidence: confidenceForEvidence(signal.evidenceCount),
    source,
  };
}

export function resolveDiagnosticoLeadingNarrativeSignal(
  synthesis: CreatorStrategicProfileSynthesis,
): DiagnosticoLeadingNarrativeSignal | null {
  if (synthesis.mainNarrative) {
    return {
      label: synthesis.mainNarrative.label,
      summary: synthesis.mainNarrative.summary,
      evidenceCount: synthesis.mainNarrative.evidenceCount,
      diagnosisIds: synthesis.mainNarrative.diagnosisIds,
      confidence: synthesis.mainNarrative.confidence,
      source: "main_narrative",
    };
  }

  return (
    fromSignal(synthesis.recurringPatterns[0], "recurring_pattern") ??
    fromSignal(synthesis.testedNarratives[0], "tested_narrative") ??
    fromSignal(synthesis.strengths[0], "strength")
  );
}
