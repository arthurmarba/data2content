import type { CreatorScriptEvidencePack } from "./creatorScriptEvidencePack";
import { normalizedWords, medianMetric } from "./scriptEvidenceSelection";

const speech = (content: string) => {
  const lines = content.split("\n").filter(l => /^\s*Fala:/i.test(l));
  return lines.length ? lines.map(l => l.replace(/^\s*Fala:\s*/i, "")).join(" ") : content;
};
function fingerprint(content: string) {
  const text = speech(content);
  const tokens = normalizedWords(text);
  const sentences = Math.max(1, text.split(/[.!?]+/).filter(s => s.trim()).length);
  return { wordsPerSentence: tokens.length / sentences,
    questionsPer100Words: (text.match(/\?/g) || []).length * 100 / Math.max(1,tokens.length),
    audienceAddressPer100Words: tokens.filter(w => ["voce", "voces", "gente", "pessoal"].includes(w)).length * 100 / Math.max(1,tokens.length) };
}
/** Sinais mensuráveis não substituem o julgamento editorial do criador. */
export function reviewScriptVoice(content: string, pack: CreatorScriptEvidencePack) {
  const examples = pack.winningExemplars.filter(e => e.observedTranscriptText);
  const current = fingerprint(content);
  const signals = (Object.keys(current) as Array<keyof typeof current>).map(key => {
    const values = examples.map(e => fingerprint(e.observedTranscriptText!)[key]);
    const baseline = medianMetric(values);
    const relativeDifference = values.length ? Math.abs(current[key]-baseline) / Math.max(1,baseline) : null;
    return { signal: key, value: current[key], historicalMedian: values.length ? baseline : null,
      divergent: relativeDifference !== null && relativeDifference > 0.6,
      evidenceContentIds: examples.map(e => e.contentId) };
  });
  return {
    schemaVersion: "script_voice_review_v1", method: "textual_heuristics_with_editorial_rubric",
    status: examples.length < 2 ? "insufficient" : "requires_editorial_review",
    signals,
    historicalStructures: examples.map(e => ({ contentId: e.contentId, structure: e.structure, hook: e.hook, cta: e.cta })),
    rubric: [
      "Compare vocabulário, transições e tratamento da audiência com as referências citadas.",
      "Explique como gancho, progressão e CTA atendem ao briefing sem repetir a história anterior.",
      "Cheque experiências pessoais e resultados: só use fatos sustentados ou declarados pelo criador.",
      "Avalie naturalidade, novidade e facilidade de gravação; não prometa engajamento.",
    ],
    limitations: ["Heurísticas textuais não comprovam semelhança de voz nem causalidade de desempenho.",
      ...(examples.some(e => !e.quality?.speakerVerified) ? ["Identidade de quem fala não foi verificada em todas as referências."] : [])],
  };
}
