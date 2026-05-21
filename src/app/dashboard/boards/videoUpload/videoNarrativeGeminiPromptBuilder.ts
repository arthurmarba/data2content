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
  evidenceAnchors: {
    speechQuotes: [
      {
        quote: "string curta realmente dita pelo creator",
        source: "creator_spoken",
        quoteRole: "hook",
        whyItMatters: "string",
        chapterHint: "pattern",
      },
    ],
    sceneAnchors: [
      {
        description: "cena ou momento observado sem timestamp técnico",
        source: "model_observed",
        momentRole: "opening",
        whyItMatters: "string",
        chapterHint: "video_reveal",
      },
    ],
    creatorIntentAnchor: {
      statedGoal: "string",
      interpretedGoal: "string",
      whyItMatters: "string",
    },
  },
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
      "Não retorne transcrição completa, timestamps técnicos, nome de arquivo, objectKey, uploadUrl, signedUrl, localPath ou storageProviderPath.",
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
      "Evidence anchors:",
      "- Extraia até 4 falas curtas realmente ditas pelo creator que sustentem a leitura estratégica.",
      "- Use source creator_spoken apenas quando tiver confiança de que a frase foi dita no vídeo.",
      "- Não invente falas e não transforme sugestão sua em fala real.",
      "- Se não houver certeza sobre uma fala, retorne speechQuotes como array vazio.",
      "- Não transcreva o vídeo; use apenas trechos curtos.",
      "- Descreva até 4 cenas ou momentos observados que respondam onde a D2C percebeu isso.",
      "- Cenas não devem ter timestamp técnico, storage metadata, URL, filename ou caminho de arquivo.",
      "- Diferencie statedGoal do creator de interpretedGoal da leitura estratégica.",
    ].join("\n"),
    responseSchemaInstruction: [
      "Retorne exatamente um objeto JSON com este schema:",
      JSON.stringify(schemaExample, null, 2),
      "Todas as strings devem ser curtas. Arrays devem ter no máximo 5 itens.",
      "evidenceAnchors é opcional, mas preferido; se não houver evidência concreta, use speechQuotes: [] e sceneAnchors: [].",
      "Valores aceitos em quoteRole: hook, promise, turning_point, closing, example, context, other.",
      "Valores aceitos em momentRole: opening, conflict, turning_point, visual_signal, pacing_signal, production_signal, other.",
      "Valores aceitos em chapterHint: pattern, tension, movement, territory, video_reveal, profile_impact, opportunities.",
      "Não inclua transcript, raw notes, timestamps técnicos, URLs ou metadata de upload/storage.",
    ].join("\n"),
  };
}
