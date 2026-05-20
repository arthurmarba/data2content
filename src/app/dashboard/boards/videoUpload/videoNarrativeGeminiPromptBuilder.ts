import type { VideoNarrativeAiProviderInput } from "./videoNarrativeAiProviderTypes";

export type VideoNarrativeGeminiPrompt = {
  systemInstruction: string;
  userInstruction: string;
  responseSchemaInstruction: string;
  promptVersion: string;
};

const schemaExample = {
  mainNarrative: "string",
  whatVideoCommunicates: "string",
  creatorIntention: "string",
  strategicReading: "string",
  strengthPoint: "string",
  attentionPoint: "string",
  recommendedAdjustment: "string",
  suggestedHook: "string",
  commercialPotential: "string",
  nextActions: ["string"],
  creatorSignals: ["string"],
  brandTerritories: ["string"],
  collabOpportunities: ["string"],
};

function safeString(value: string | undefined | null, fallback = "Não informado"): string {
  const trimmed = value?.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redigido]").replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

function formatQuickAnswers(input: VideoNarrativeAiProviderInput): string {
  const answers = input.quickAnswers ?? [];
  if (answers.length === 0) return "- Sem respostas rápidas.";

  return answers
    .slice(0, 6)
    .map((answer) => `- ${safeString(answer.id)}: ${safeString(answer.value)}`)
    .join("\n");
}

export function buildVideoNarrativeGeminiPrompt(input: VideoNarrativeAiProviderInput): VideoNarrativeGeminiPrompt {
  const hasTemporaryUpload = Boolean(input.temporaryUpload);
  const videoMetadata = input.temporaryUpload
    ? [
        `- mimeType: ${safeString(input.temporaryUpload.mimeType)}`,
        `- sizeBytes: ${input.temporaryUpload.sizeBytes}`,
        `- uploadSessionId: ${safeString(input.temporaryUpload.uploadSessionId)}`,
      ].join("\n")
    : "- Sem upload temporário informado.";

  return {
    promptVersion: input.promptVersion,
    systemInstruction: [
      "Você é um analista narrativo estratégico da Data2Content.",
      "Interprete o vídeo como uma peça de conteúdo em construção para atualizar o diagnóstico vivo do creator.",
      "Responda apenas em JSON válido e estrito, sem Markdown, sem comentários e sem texto fora do objeto.",
      "Não prometa viralização, contrato de marca, patrocínio, certeza de performance, ranking, nota, score ou resultado garantido.",
      "Não faça diagnóstico médico, psicológico, jurídico ou financeiro.",
      "Não retorne conteúdo privado bruto, transcrição longa, URL, signed URL, token, API key ou identificador de storage.",
      "Não mencione o nome do provedor de IA na resposta.",
    ].join("\n"),
    userInstruction: [
      `promptVersion: ${input.promptVersion}`,
      `requestId: ${safeString(input.requestId)}`,
      `Objetivo do creator: ${safeString(input.creatorGoal)}`,
      `Opção selecionada: ${input.selectedGoalOption}`,
      "Respostas rápidas:",
      formatQuickAnswers(input),
      "Contexto do Perfil Estratégico:",
      `- displayName: ${safeString(input.profileContext?.displayName)}`,
      `- instagramConnected: ${Boolean(input.profileContext?.instagramConnected)}`,
      `- premiumAccess: ${Boolean(input.profileContext?.premiumAccess)}`,
      "Metadados seguros do vídeo temporário:",
      videoMetadata,
      `- hasTemporaryUpload: ${hasTemporaryUpload}`,
      "Tarefa: gere uma leitura estratégica curta, humana e acionável para atualizar o Perfil da D2C.",
    ].join("\n"),
    responseSchemaInstruction: [
      "Retorne exatamente um objeto JSON com este schema:",
      JSON.stringify(schemaExample, null, 2),
      "Todas as strings devem ser curtas. Arrays devem ter no máximo 5 itens.",
    ].join("\n"),
  };
}
