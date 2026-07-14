import type { VideoNarrativeAiProviderInput } from "./videoNarrativeAiProviderTypes";

export type VideoNarrativeGeminiPrompt = {
  systemInstruction: string;
  userInstruction: string;
  responseSchemaInstruction: string;
  promptVersion: string;
};

// Maps the internal (legacy) goal-option enum to the human lens the creator actually
// chose in the app, plus what the reading should emphasise for that lens. The raw enum
// values ("retention", "sponsored_content") do NOT match their current labels and must
// never reach the model as-is — they would mislead the analysis.
const GOAL_LENS: Record<string, { label: string; emphasis: string }> = {
  authority: {
    label: "entender minha narrativa",
    emphasis: "o que este vídeo revela sobre a narrativa e o ponto de vista do creator.",
  },
  retention: {
    label: "checar coerência com o meu mapa",
    emphasis: "se este vídeo confirma, tensiona ou desvia do que o creator vem construindo.",
  },
  format_test: {
    label: "testar um formato diferente",
    emphasis: "se este formato vale repetir no perfil e o que ele acrescenta à narrativa.",
  },
  sponsored_content: {
    label: "explorar um território novo",
    emphasis: "que território de conteúdo este vídeo abre e com que legitimidade o creator pode ocupá-lo.",
  },
  authority_build: {
    label: "fortalecer meu ponto de vista",
    emphasis: "como este vídeo reforça (ou dilui) o ponto de vista recorrente do creator.",
  },
};

function describeGoalLens(option: string): { label: string; emphasis: string } {
  return (
    GOAL_LENS[option] ?? {
      label: "entender minha narrativa",
      emphasis: "o que este vídeo revela sobre a narrativa do creator.",
    }
  );
}

const schemaExample = {
  directAnswer: "string — resposta curta, direta e observacional à pergunta/objetivo do creator (campo 'Objetivo do creator'); 1 a 2 frases; responda exatamente o que ele perguntou, sem imperativos",
  mainNarrative: "string — rótulo de 2 a 6 palavras sobre o ponto de vista do creator, não o assunto do vídeo. Ex: Cultura pop como negócio",
  whatVideoCommunicates: "string — o que o vídeo revela sobre o mapa/narrativa do creator, não um resumo do tema",
  creatorIntention: "string — intenção percebida ou declarada do creator",
  strategicReading: "string — tese estratégica curta que conecta assunto, ponto de vista e mapa do creator",
  strengthPoint: "string — o que a narrativa já comunica com clareza neste vídeo; descreva o sinal, não avalie mérito",
  attentionPoint: "string — aspecto de calibração observado: onde a narrativa fica mais vaga ou o sinal menos claro; não é uma fraqueza, é uma observação",
  recommendedAdjustment: "string — o que a narrativa não explicita e que, se estivesse presente, tornaria a leitura mais precisa; escreva como observação ('a narrativa não deixa claro X'), nunca como imperativo ao creator ('faça X', 'ajuste Y')",
  suggestedHook: "string",
  commercialPotential: "string — território de atuação possível com marcas, descrito como área de fit narrativo; evite 'alto potencial', 'grande fit' ou qualquer avaliação de resultado comercial",
  nextActions: ["string — o que a D2C percebeu que vale observar a seguir neste perfil; escreva como sinal a acompanhar, não como tarefa para o creator"],
  creatorSignals: ["string"],
  brandTerritories: ["string"],
  collabOpportunities: ["string"],
  contentContext: {
    setting: "string ou null — local principal: praia, casa, academia, rua, estudio, etc.",
    socialPresence: "string ou null — solo, familia, amigos, casal, equipe, etc.",
    emotionalRegister: "string ou null — humor, inspiracional, educativo, reflexivo, emotivo",
    humorStyle: "string ou null — cultural, auto-ironia, situacional, absurdo, ou null se nao houver humor",
    energyLevel: "string ou null — alta, moderada, calma",
    lifeSignals: ["string — sinal de vida observado ex: carioca, fim-de-semana, rotina-matinal, vida-com-filhos"],
    productionStyle: "string ou null — selfie, estabilizado-casual, profissional, vertical-raw",
  },
  narrativeCoherence: {
    verdict: "confirms_top_pattern | experiment | deviation | first_reading | unknown",
    topPattern: "string ou null — padrao top do creator ex: praia + familia + humor",
    reasoning: "string curta explicando o veredicto",
    alignedAssets: ["string — assets confirmados que aparecem neste video"],
    newAssets: ["string — potenciais novos assets detectados, ainda sem confirmacao"],
  },
  audienceCoherence: {
    verdict: "aligned | tension | off | unknown",
    reading: "string curta e observacional — se o video fala com quem assiste este creator e com o que a audiencia costuma pedir; unknown+null quando nao ha base de audiencia para avaliar",
  },
  brandCoherence: {
    verdict: "aligned | tension | off | unknown",
    reading: "string curta e observacional — se o video abre ou sustenta um territorio comercial coerente com o mapa; sem promessa de resultado ou 'alto potencial'",
  },
  contentPotentialScan: {
    band: "uncertain — provisório; o servidor recalibra",
    confidence: "low | medium | high",
    basis: "video_only | creator_history",
    objective: "attention | sharing | positioning | complete_reading",
    historyPostsAnalyzed: 0,
    dimensions: {
      openingClarity: { status: "strong | mixed | weak | unknown", evidence: "string", adjustment: "string ou null", window: "0-3s" },
      attentionArchitecture: { status: "strong | mixed | weak | unknown", evidence: "string", adjustment: "string ou null", window: "0-10s" },
      shareImpulse: { status: "strong | mixed | weak | unknown", evidence: "string", adjustment: "string ou null", window: "full_video" },
      promiseDelivery: { status: "strong | mixed | weak | unknown", evidence: "string", adjustment: "string ou null", window: "full_video" },
      narrativeFit: { status: "strong | mixed | weak | unknown", evidence: "string", adjustment: "string ou null", window: "creator_history" },
    },
    watchedMoments: [
      { moment: "opening", observation: "string — cena, ação, texto visível ou fala curta realmente observada", impact: "string — efeito deste momento na leitura" },
      { moment: "development", observation: "string — evidência específica do desenvolvimento", impact: "string — efeito deste momento na leitura" },
      { moment: "closing", observation: "string — evidência específica do fechamento", impact: "string — efeito deste momento na leitura" },
    ],
    practicalDirection: {
      title: "string — uma direção curta e específica para este vídeo",
      action: "string — como aplicar a mudança no corte, texto, ordem, imagem ou fala deste vídeo",
      example: "string — texto na tela, abertura ou fechamento pronto para usar; null quando não couber",
    },
    highestImpactAdjustment: "string — uma única mudança específica e ancorada no vídeo",
    disclaimer: "string curta sem promessa de performance",
  },
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

function formatInstagramMetrics(input: VideoNarrativeAiProviderInput): string {
  const m = input.instagramMetrics;
  if (!m || !m.postsAnalyzed) return "";

  const lines: string[] = ["Métricas reais do Instagram (últimas análises armazenadas):"];

  lines.push(`- Posts analisados: ${m.postsAnalyzed}`);
  if (m.avgReachPerPost != null) lines.push(`- Alcance médio por post: ${Math.round(m.avgReachPerPost)}`);
  if (m.avgEngagementRate != null) lines.push(`- Taxa de engajamento média: ${(m.avgEngagementRate * 100).toFixed(2)}%`);
  if (m.avgReelsDurationSeconds != null) lines.push(`- Duração média de Reels: ${m.avgReelsDurationSeconds}s`);
  if (m.avgReelsWatchTimeSeconds != null) lines.push(`- Watch time médio de Reels: ${m.avgReelsWatchTimeSeconds}s`);
  if (m.avgReelsViews != null) lines.push(`- Views médias em Reels: ${Math.round(m.avgReelsViews)}`);
  if (m.avgSavesPerPost != null) lines.push(`- Salvamentos médios por post: ${Math.round(m.avgSavesPerPost)}`);
  if (m.avgSharesPerPost != null) lines.push(`- Compartilhamentos médios por post: ${Math.round(m.avgSharesPerPost)}`);
  if (m.avgCommentsPerPost != null) lines.push(`- Comentários médios por post: ${Math.round(m.avgCommentsPerPost)}`);
  if (m.avgIntentActionsPerPost != null) lines.push(`- Ações de intenção médias (salvar+compartilhar+visitas+seguir): ${Math.round(m.avgIntentActionsPerPost)}`);
  if (m.topFormats && m.topFormats.length > 0) lines.push(`- Formatos mais usados: ${m.topFormats.join(", ")}`);
  if (m.bestDayLabel) {
    const reachNote = m.bestDayAvgReach != null ? ` (alcance médio: ${Math.round(m.bestDayAvgReach)})` : "";
    lines.push(`- Melhor dia para postar: ${m.bestDayLabel}${reachNote}`);
  }
  if (m.reachDelta != null) {
    const dir = m.reachDelta >= 0 ? "crescimento" : "queda";
    lines.push(`- Tendência de alcance: ${dir} de ${Math.abs(Math.round(m.reachDelta * 100))}% vs. período anterior`);
  }
  if (m.intentDelta != null) {
    const dir = m.intentDelta >= 0 ? "crescimento" : "queda";
    lines.push(`- Tendência de intenção: ${dir} de ${Math.abs(Math.round(m.intentDelta * 100))}% vs. período anterior`);
  }

  return lines.join("\n");
}

function formatAudienceContext(input: VideoNarrativeAiProviderInput): string {
  const a = input.profileContext?.audienceContext;
  if (!a) return "";

  const lines: string[] = ["Audiência real do perfil (composição de quem segue/engaja):"];
  if (a.topGender) {
    lines.push(`- Predominância de gênero: ${a.topGender}${a.topGenderPct != null ? ` (${a.topGenderPct}%)` : ""}`);
  }
  if (a.topAgeRange) {
    lines.push(`- Faixa etária principal: ${a.topAgeRange}${a.topAgeRangePct != null ? ` (${a.topAgeRangePct}%)` : ""}`);
  }
  if (a.topLocations && a.topLocations.length > 0) {
    lines.push(`- Concentração geográfica: ${a.topLocations.join(", ")}`);
  }
  if (lines.length === 1) return "";
  return lines.join("\n");
}

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
        `- duração verificada: ${input.temporaryUpload.durationSeconds ?? "não informada"} segundos`,
        `- mudanças visuais detectadas nos primeiros 10 s: ${input.temporaryUpload.earlyVisualChanges ?? "não disponível"}`,
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
      "Tom obrigatório: nos campos de análise, escreva como um analista que relata o que observou no vídeo. practicalDirection é a única exceção operacional: ali, traduza a leitura em uma mudança concreta e aplicável.",
      "Evite imperativos diretos ao creator nos campos de análise: 'faça', 'ajuste', 'mostre', 'poste', 'troque', 'melhore' não devem aparecer. Em practicalDirection, use linguagem de ação específica sem tom de ordem ou promessa.",
      "Em recommendedAdjustment e attentionPoint: descreva o que a narrativa não explicita ou onde o sinal fica mais vago — use frases como 'a narrativa não deixa claro X' ou 'o sinal de Y aparece de forma difusa'.",
      "Evite linguagem de performance: 'alto potencial', 'grande fit', 'vai engajar', 'performa bem', 'ideal para marcas' não devem aparecer.",
      "O Raio X estima sinais estruturais relativos ao vídeo e ao histórico do creator; nunca prevê resultado garantido.",
    ].join("\n"),
    userInstruction: [
      `promptVersion: ${input.promptVersion}`,
      `requestId: ${safeString(input.requestId)}`,
      `Objetivo do creator: ${safeString(input.creatorGoal)}`,
      `Lente escolhida pelo creator: ${describeGoalLens(input.selectedGoalOption).label}.`,
      `Ao ler o vídeo, priorize: ${describeGoalLens(input.selectedGoalOption).emphasis}`,
      "Em directAnswer, responda diretamente ao 'Objetivo do creator' acima, ancorado no que aparece no vídeo — é a resposta que o creator espera ler primeiro.",
      "Respostas rápidas:",
      formatQuickAnswers(input),
      "Contexto do Perfil Estratégico:",
      `- displayName: ${safeString(input.profileContext?.displayName)}`,
      `- instagramConnected: ${Boolean(input.profileContext?.instagramConnected)}`,
      `- premiumAccess: ${Boolean(input.profileContext?.premiumAccess)}`,
      // Always emit an explicit Instagram context line so the model never has to guess
      // whether metrics exist. When null, it must not invent performance data.
      ...(() => {
        const metricsBlock = formatInstagramMetrics(input);
        if (metricsBlock) return [metricsBlock];
        if (input.profileContext?.instagramConnected) {
          return [
            "Instagram conectado, mas sem métricas históricas disponíveis para esta análise.",
            "Não assuma dados de performance do perfil. Baseie a leitura apenas no conteúdo do vídeo.",
          ];
        }
        return [
          "Instagram não conectado: não há dados históricos de performance disponíveis.",
          "Não referencie métricas, alcance, engajamento ou formatos do perfil. Analise apenas o vídeo enviado.",
        ];
      })(),
      // Audiência real (demografia). Quando presente, é a âncora do eixo audienceCoherence.
      ...(() => {
        const audienceBlock = formatAudienceContext(input);
        if (audienceBlock) {
          return [
            audienceBlock,
            "Use isso como âncora do eixo audienceCoherence: avalie se o vídeo fala com essa audiência real; não invente outros dados demográficos.",
          ];
        }
        return [
          "Sem dados demográficos de audiência para este perfil.",
          "Para audienceCoherence, se não houver sinal claro de para quem o vídeo fala, use verdict=unknown — não presuma a audiência.",
        ];
      })(),
      "Metadados seguros do vídeo temporário:",
      videoMetadata,
      `- hasTemporaryUpload: ${hasTemporaryUpload}`,
      ...(() => {
        const narratives = input.profileContext?.knownNarratives ?? [];
        if (narratives.length === 0) return [];
        return [
          `Narrativas já identificadas para este creator: ${narratives.slice(0, 4).join("; ")}.`,
          "Use isso como referência: verifique se este vídeo confirma, desvia ou abre uma nova hipótese em relação a essas narrativas.",
        ];
      })(),
      // Feed confirmed life assets back so Gemini can issue an accurate coherence verdict.
      // When assets exist, the model must evaluate this video against the established pattern.
      ...(() => {
        const assets = input.profileContext?.confirmedLifeAssets ?? [];
        const topPattern = input.profileContext?.topPerformingPattern;
        if (assets.length === 0 && !topPattern) return [];
        const lines: string[] = ["Assets de vida confirmados para este creator (aparecem em múltiplas leituras anteriores):"];
        if (topPattern) lines.push(`- Padrão principal: ${topPattern}`);
        assets.slice(0, 5).forEach((a) => lines.push(`- ${a.label} (${a.evidenceCount}x observado)`));
        lines.push(
          "Para narrativeCoherence: se o vídeo confirma o padrão principal → verdict=confirms_top_pattern; se abre nova direção sem quebrar a identidade → experiment; se diverge claramente → deviation.",
        );
        return lines;
      })(),
      // Inject creator's past confirmation answers as intent/preference signals.
      // These come from adaptive questions shown after prior analyses, so they reflect
      // considered responses — not pre-analysis guesses.
      ...(() => {
        const answers = input.profileContext?.pastCreatorAnswers ?? [];
        if (answers.length === 0) return [];
        return [
          "O que o creator respondeu sobre vídeos recentes (respostas às perguntas do Perfil D2C):",
          ...answers.slice(0, 5).map((a) => `- "${a.questionText}": ${a.answerValue}`),
          "Considere essas respostas como sinais de intenção e preferência ao interpretar este vídeo.",
        ];
      })(),
      "Tarefa: gere uma leitura estratégica curta, humana e observacional para atualizar o Perfil da D2C. Escreva o que o vídeo revela sobre a narrativa do creator — não o que ele deve fazer a seguir.",
      "Contrato narrativo D2C:",
      "- Separe assunto do vídeo de narrativa do creator. Assunto é 'sobre o que o vídeo fala'; narrativa é o ponto de vista recorrente que pode entrar no mapa.",
      "- mainNarrative deve ser um rótulo curto de mapa, com 2 a 6 palavras. Nunca escreva uma frase do tipo 'O criador analisa...'.",
      "- whatVideoCommunicates deve explicar o sinal para o Perfil, não repetir mainNarrative.",
      "- strategicReading deve responder: que leitura de mundo do creator aparece aqui?",
      "- Se o vídeo fala de Bad Bunny, Super Bowl ou outro caso externo, trate isso como assunto/evidência; a narrativa deve virar eixo como 'Cultura pop como negócio' ou 'Autonomia criativa como negócio cultural'.",
      "- Não chame uma hipótese nova de narrativa principal definitiva; escreva como sinal em observação quando ainda faltar recorrência.",
      "contentContext (OBRIGATÓRIO — observe o vídeo e descreva os atributos visuais/contextuais):",
      "- setting: local principal onde o vídeo acontece; null se não identificável.",
      "- socialPresence: quem aparece com o creator; null se solo e não relevante.",
      "- emotionalRegister: tom emocional dominante do vídeo.",
      "- humorStyle: tipo de humor se houver; null se o vídeo não for humorístico.",
      "- energyLevel: nível de energia percebido.",
      "- lifeSignals: sinais de vida observados — só registre o que aparece claramente no vídeo, sem inventar.",
      "- productionStyle: escolha entre selfie / estabilizado-casual / profissional / vertical-raw.",
      "narrativeCoherence (OBRIGATÓRIO — veredicto de coerência com o padrão estabelecido):",
      "- Se não há assets confirmados: verdict=first_reading.",
      "- Se o vídeo confirma o padrão principal: verdict=confirms_top_pattern.",
      "- Se o vídeo abre nova direção sem romper identidade: verdict=experiment.",
      "- Se o vídeo diverge claramente dos assets confirmados: verdict=deviation.",
      "- topPattern: o padrão que serviu de referência (ou null).",
      "- alignedAssets: assets confirmados que aparecem neste vídeo; newAssets: atributos novos detectados.",
      "audienceCoherence (OBRIGATÓRIO — eixo audiência): o vídeo fala com quem já assiste este creator e com o que essa audiência costuma pedir? Ancore no bloco 'Audiência real do perfil' acima quando ele existir.",
      "- aligned: conversa claramente com a audiência do creator; tension: conversa em parte, com uma ressalva; off: não conversa com quem o segue hoje.",
      "- unknown com reading=null quando não há dados de audiência nem sinais suficientes para avaliar — nunca invente alinhamento de audiência.",
      "- reading: 1 frase observacional; não prometa alcance, engajamento ou performance.",
      "brandCoherence (OBRIGATÓRIO — eixo marca): o vídeo abre ou sustenta um território comercial coerente com o mapa do creator?",
      "- aligned: abre/sustenta um território de fit narrativo com marcas; tension: fit parcial ou ainda difuso; off: não abre território comercial coerente; unknown quando não há base para avaliar.",
      "- reading: 1 frase como área de fit narrativo — evite 'alto potencial', 'grande fit' ou promessa de resultado comercial.",
      "contentPotentialScan (OBRIGATÓRIO — Raio X antes de publicar):",
      "- openingClarity: assista mentalmente aos primeiros 3 segundos SEM SOM. Diga se texto, imagem e ação deixam assunto ou promessa reconhecíveis. Depois considere o áudio apenas como evidência complementar.",
      "- attentionArchitecture: observe os primeiros 10 segundos. Considere cortes, zoom, texto, gesto, deslocamento e progressão; não reprove automaticamente um plano estável quando a fala ou a tensão sustentam atenção.",
      "- shareImpulse: identifique o motivo concreto para alguém enviar o conteúdo: utilidade, identificação, emoção, surpresa ou relevância social. Use weak/unknown quando nenhum motivo aparece.",
      "- promiseDelivery: verifique se o desenvolvimento e o final entregam a promessa aberta no início.",
      "- narrativeFit: compare o vídeo com narrativas, audiência e padrões do creator; use unknown quando não houver histórico suficiente.",
      "- Cada dimensão deve citar uma evidência observada no vídeo e, quando necessário, um único ajuste específico.",
      "- watchedMoments é OBRIGATÓRIO e deve conter de 2 a 3 momentos distribuídos entre abertura, desenvolvimento e fechamento.",
      "- Cada watchedMoment deve provar que o vídeo foi assistido: descreva uma ação, cena, texto visível ou fala curta realmente presente. Feedback genérico é inválido.",
      "- observation descreve somente o que foi visto ou ouvido; impact explica o efeito daquele momento sobre clareza, atenção, compartilhamento, entrega ou aderência narrativa.",
      "- practicalDirection é OBRIGATÓRIO e traz uma única mudança prioritária para ESTE vídeo. action deve dizer onde e como aplicá-la no corte, texto, ordem, imagem ou fala.",
      "- practicalDirection.example deve ser uma sugestão pronta para usar, nunca apresentada como fala real do vídeo. Use null quando um exemplo textual não fizer sentido.",
      "- band/confidence/basis são provisórios e serão recalibrados pelo servidor. Não use números, percentuais ou promessa de alcance.",
      "Evidence anchors (OBRIGATÓRIO — não retorne arrays vazios):",
      "- Forneça pelo menos 1 sceneAnchor descrevendo um momento concreto observado no vídeo.",
      "- Extraia até 4 falas curtas realmente ditas pelo creator que sustentem a leitura estratégica.",
      "- Use source creator_spoken apenas quando tiver confiança de que a frase foi dita no vídeo.",
      "- Não invente falas e não transforme sugestão sua em fala real.",
      "- Se não houver certeza sobre uma fala, retorne speechQuotes como array vazio — mas sceneAnchors DEVE ter ao menos 1 item.",
      "- Não transcreva o vídeo; use apenas trechos curtos e descrições de cena.",
      "- Descreva até 4 cenas ou momentos observados que respondam onde a D2C percebeu isso.",
      "- Cenas não devem ter timestamp técnico, storage metadata, URL, filename ou caminho de arquivo.",
      "- Diferencie statedGoal do creator de interpretedGoal da leitura estratégica.",
    ].join("\n"),
    responseSchemaInstruction: [
      "Retorne exatamente um objeto JSON com este schema:",
      JSON.stringify(schemaExample, null, 2),
      "directAnswer é OBRIGATÓRIO: responda diretamente à pergunta/objetivo do creator em 1 a 2 frases, ancorado no vídeo, em tom observacional (sem 'faça', 'poste', 'ajuste'). Não repita mainNarrative nem strategicReading.",
      "Todas as strings devem ser curtas. Arrays devem ter no máximo 5 itens.",
      "mainNarrative deve ter no máximo 80 caracteres e não pode começar com 'O criador', 'A creator', 'Esse vídeo', 'Este vídeo' ou 'Pelo vídeo'.",
      "Nunca use o assunto do vídeo como narrativa central. Exemplo ruim: 'O criador analisa a performance de Bad Bunny no Super Bowl'. Exemplo bom: 'Autonomia criativa como negócio cultural'.",
      "whatVideoCommunicates e strategicReading não podem repetir o mesmo texto de mainNarrative.",
      "contentContext é OBRIGATÓRIO; lifeSignals pode ser [] se nenhum sinal claro for observado.",
      "narrativeCoherence é OBRIGATÓRIO; verdict deve ser um dos valores válidos.",
      "Valores aceitos em narrativeCoherence.verdict: confirms_top_pattern, experiment, deviation, first_reading, unknown.",
      "audienceCoherence e brandCoherence são OBRIGATÓRIOS; cada um com verdict e reading.",
      "contentPotentialScan é OBRIGATÓRIO e deve conter exatamente as cinco dimensões estruturadas, 2 a 3 watchedMoments e practicalDirection.",
      "Valores aceitos em audienceCoherence.verdict e brandCoherence.verdict: aligned, tension, off, unknown.",
      "reading de audienceCoherence e brandCoherence deve ter no máximo 120 caracteres, tom observacional, sem imperativo e sem linguagem de performance.",
      "evidenceAnchors é OBRIGATÓRIO; sceneAnchors deve ter no mínimo 1 item descrevendo um momento concreto do vídeo; speechQuotes pode ser [].",
      "Valores aceitos em quoteRole: hook, promise, turning_point, closing, example, context, other.",
      "Valores aceitos em momentRole: opening, conflict, turning_point, visual_signal, pacing_signal, production_signal, other.",
      "Valores aceitos em chapterHint: pattern, tension, movement, territory, video_reveal, profile_impact, opportunities.",
      "Não inclua transcript, raw notes, timestamps técnicos, URLs ou metadata de upload/storage.",
      "recommendedAdjustment DEVE ser uma observação narrativa ('a narrativa não deixa claro X'), nunca um imperativo ('faça X', 'ajuste Y').",
      "attentionPoint DEVE descrever onde o sinal narrativo fica mais vago ou difuso — não avalie como erro ou fraqueza.",
      "nextActions DEVE descrever o que a D2C quer observar a seguir — escreva como sinal a acompanhar, não como tarefa.",
      "commercialPotential DEVE descrever um território de fit narrativo — evite 'alto potencial', 'grande fit' ou qualquer promessa de resultado.",
    ].join("\n"),
  };
}
