export type GeminiVideoNarrativePromptInput = {
  creatorQuestion: string | null;
  creatorContext?: {
    handle?: string | null;
    niche?: string | null;
    knownNarratives?: string[];
  } | null;
  language?: "pt-BR";
};

export type GeminiVideoNarrativePrompt = {
  systemInstruction: string;
  userInstruction: string;
  responseFormatInstruction: string;
};

export function buildGeminiVideoNarrativeSystemInstruction(): string {
  return [
    "Você atua como estrategista de conteúdo da D2C.",
    "Analise o vídeo como uma peça de conteúdo em construção, não como simples extração técnica.",
    "Avalie gancho, resumo, tópicos falados, textos na tela, elementos visuais, estrutura de cenas, classificação D2C, diagnóstico, blueprint, brand match, evidências e sinais futuros de perfil.",
    "Extraia evidence anchors concretos quando houver segurança: falas curtas realmente ditas, cenas específicas, virada narrativa e intenção do creator.",
    "Evite prometer performance e evite linguagem absoluta.",
    "Quando faltar contexto, reduza a confiança, deixe lacunas explícitas e proponha ajustes em vez de inventar.",
  ].join(" ");
}

export function buildGeminiVideoNarrativeUserInstruction(input: GeminiVideoNarrativePromptInput): string {
  const parts = [
    "Analise este vídeo como narrativa em construção para orientar um post futuro.",
    "Use português do Brasil.",
  ];

  if (input.creatorQuestion) {
    parts.push(`Pergunta do criador: ${input.creatorQuestion}`);
  } else {
    parts.push("Pergunta do criador: não informada.");
  }

  if (input.creatorContext?.handle) {
    parts.push(`Handle do criador: ${input.creatorContext.handle}`);
  }
  if (input.creatorContext?.niche) {
    parts.push(`Nicho: ${input.creatorContext.niche}`);
  }
  if (input.creatorContext?.knownNarratives?.length) {
    parts.push(`Narrativas já conhecidas: ${input.creatorContext.knownNarratives.join(", ")}.`);
  }

  parts.push(
    "Taxonomia conceitual de formato: reel, photo, carousel, long_video, unknown.",
    "Taxonomia conceitual de proposta: tips, review, humor_scene, positioning_authority, behind_the_scenes, comparison, announcement, comment_to_post, ad_adaptation, collab_narrative, unknown.",
    "Se o contexto visual ou sonoro for insuficiente, retorne baixa confiança e ajustes úteis.",
    "Extraia até 4 falas curtas realmente ditas pelo criador que ajudem a sustentar a leitura estratégica. Não transcreva o vídeo. Não invente frases. Se não houver segurança suficiente de que uma frase foi dita, retorne speechQuotes vazio.",
    "Descreva até 4 cenas ou momentos específicos observados, sem timestamp técnico, filename, URL, objectKey, signedUrl, uploadUrl, localPath ou metadata de storage.",
    "Explique por que cada fala ou cena importa para a narrativa e indique o capítulo em que ela ajuda.",
  );

  return parts.join(" ");
}

export function buildGeminiVideoNarrativeResponseFormatInstruction(): string {
  return [
    "Retorne apenas JSON válido.",
    "Não use markdown.",
    "Não escreva texto fora do JSON.",
    'Use o shape: {"hook":{"detected":null,"strength":"unknown","why":null},"summary":null,"spokenTopics":[],"onScreenText":[],"visualElements":[],"sceneStructure":[],"d2cClassification":{"format":"unknown","proposal":"unknown","context":null,"tone":null,"reference":null,"intent":null,"narrative":null},"diagnosis":{"strengths":[],"weaknesses":[],"recommendedAdjustments":[]},"blueprintSuggestion":{"whatToPost":null,"whyThisPath":null,"howItShouldWork":null,"scenes":[]},"brandMatch":{"enabled":false,"territories":[],"whyBrandsWouldFit":null},"evidence":{"transcript":null,"ocr":[],"frames":[],"technicalSignals":[]},"evidenceAnchors":{"speechQuotes":[],"sceneAnchors":[],"creatorIntentAnchor":null},"profileSignals":[],"confidence":"unknown"}.',
    "evidenceAnchors é opcional para compatibilidade, mas preferido quando houver evidência concreta.",
    "speechQuotes aceita apenas source creator_spoken; sceneAnchors aceita source model_observed ou derived_scene.",
    "Não retorne transcript bruto, raw notes, timestamps técnicos, URLs ou metadata de upload/storage.",
  ].join(" ");
}

export function buildGeminiVideoNarrativePrompt(input: GeminiVideoNarrativePromptInput): GeminiVideoNarrativePrompt {
  return {
    systemInstruction: buildGeminiVideoNarrativeSystemInstruction(),
    userInstruction: buildGeminiVideoNarrativeUserInstruction(input),
    responseFormatInstruction: buildGeminiVideoNarrativeResponseFormatInstruction(),
  };
}
