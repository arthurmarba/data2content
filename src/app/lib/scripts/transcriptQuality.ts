import { normalizedWords } from "./scriptEvidenceSelection";

/** Verifica consistência estrutural; não declara reconhecimento de locutor. */
export function assessTranscriptQuality(text: string | null, segments: Array<{ startMs: number | null; endMs: number | null; text: string }>, durationSeconds: number | null, truncated = false, assemblySource: "independent" | "segments" = "independent") {
  if (!text?.trim()) return { status: "unavailable" as const, truncated, speakerVerified: false, temporalCoverage: null, structuralConsistent: false, audioFidelityVerified: false, assemblySource };
  const ordered = segments.every((s,i) => s.startMs !== null && s.endMs !== null && Number.isFinite(s.startMs) && Number.isFinite(s.endMs) && s.startMs >= 0 && s.endMs >= s.startMs
    && (!i || s.startMs >= (segments[i-1]!.endMs ?? 0))
    && (!durationSeconds || s.endMs <= durationSeconds*1000+500));
  const temporalCoverage = durationSeconds && segments.length && ordered
    ? Math.min(1, segments.reduce((sum, s) => sum + (s.endMs! - s.startMs!), 0) / (durationSeconds*1000)) : null;
  const matches = normalizedWords(segments.map(s => s.text).join(" ")).join(" ") === normalizedWords(text).join(" ");
  const structuralConsistent = ordered && matches && segments.length > 0;
  // A igualdade entre as duas cópias do formato antigo também vinha do próprio modelo:
  // nos segmentos, ela é garantida pela montagem e o critério real é a cobertura temporal.
  // Nenhum dos dois comprova fidelidade ao áudio (audioFidelityVerified segue falso).
  const complete = !truncated && ordered && matches && segments.length > 0 && temporalCoverage !== null && temporalCoverage >= 0.9;
  return { status: truncated ? "partial" as const : complete ? "complete" as const : "unverified" as const,
    truncated, speakerVerified: false, temporalCoverage, structuralConsistent, audioFidelityVerified: false, assemblySource };
}
