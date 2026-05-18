const SENSITIVE_PATTERNS = [
  /\bAIza[0-9A-Za-z_-]{8,}/,
  /\b(?:GEMINI_API_KEY|GOOGLE_GENAI_API_KEY)=\S+/,
  /\b[A-Za-z0-9+/]{120,}={0,2}\b/,
  /\bhttps?:\/\/\S*(?:\?|&)(?:token|signature|sig|X-Amz-Signature|Expires)=\S*/i,
];

const ACCESS_LABELS: Record<string, string> = {
  free: "Free",
  premium: "Premium",
  instagram_optimized: "Instagram otimizado",
};

const STAGE_LABELS: Record<string, string> = {
  welcome: "Boas-vindas",
  upload_video: "Upload simulado",
  analyzing_video: "Análise do vídeo",
  asking_creator_goal: "Pergunta central",
  understanding_goal: "Entendimento da dúvida",
  adaptive_quiz: "Quiz adaptativo",
  building_diagnosis: "Montagem do diagnóstico",
  diagnosis_ready: "Diagnóstico pronto",
  upgrade_prompt: "Prompt de upgrade",
  instagram_optimization_prompt: "Prompt de Instagram",
  completed: "Concluído",
  blocked: "Bloqueado",
  error: "Erro",
};

export function clampStep(currentStep: number, totalSteps: number): number {
  const safeTotal = Number.isFinite(totalSteps) && totalSteps > 0 ? Math.floor(totalSteps) : 1;
  if (!Number.isFinite(currentStep)) return 1;
  return Math.min(Math.max(Math.floor(currentStep), 1), safeTotal);
}

export function formatAccessLabel(access: string): string {
  return ACCESS_LABELS[access] ?? formatSignalLabel(access);
}

export function formatStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? formatSignalLabel(stage);
}

export function formatSignalLabel(signalType: string): string {
  return signalType
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function isSafeVideoNarrativePreviewText(value: string): boolean {
  return !SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}
