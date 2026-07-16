/**
 * contentIdeasGeminiPromptBuilder.ts
 *
 * Builds the Gemini prompt for pauta (content idea) generation.
 *
 * North Star constraints baked into this prompt:
 *
 *   1. Pautas emerge from the creator's specific confirmed map — NEVER from
 *      trending topics, algorithm patterns, or what other creators are doing.
 *
 *   2. The prompt NEVER mentions: algoritmo, viralizar, engajamento, tendência,
 *      crescimento, audiência grande, número de seguidores, performance.
 *      The forbidden vocabulary is enumerated as an explicit instruction.
 *
 *   3. Each pauta must connect to a CONFIRMED dimension of the map. If the
 *      pauta can't trace back to the creator's confirmed narrative + territory
 *      + asset + tone, it shouldn't be generated.
 *
 *   4. The tone of each pauta matches the creator's confirmed tone — not a
 *      generic "engaging" tone.
 *
 *   5. The "whyItFits" field is mandatory and must reference the specific
 *      dimension of the creator's map.
 */

/**
 * Sinais de reconhecimento da audiência, JÁ TRADUZIDOS (sem métricas, sem números).
 * Cada campo já vem como um rótulo/assunto que o criador entende. Territórios aqui
 * são SEMPRE territórios confirmados do mapa (o mapeamento que produz este objeto
 * descarta qualquer assunto fora do mapa). Servem só para PRIORIZAR entre pautas que
 * já emergem do mapa e para nomear o encontro (resonanceNote) — nunca para inventar
 * território/tom novo.
 */
export interface ContentIdeasAudienceResonance {
  /** Território confirmado que a audiência mais guarda/reconhece. */
  resonantTerritory?: string | null;
  /** Território confirmado que o criador toca pouco, mas que a audiência mais guarda. */
  underexploredTerritory?: string | null;
  /** Jeito de falar (tom) que mais ressoa. */
  tone?: string | null;
  /** Intenção que mais conecta (criar laço, ensinar, inspirar…). */
  intent?: string | null;
  /** Forma de contar que mais guardam (bastidores, tutorial…). */
  narrativeForm?: string | null;
  /** Postura/voz que mais reconhecem (depoimento, crítico…). */
  stance?: string | null;
}

export interface ContentIdeasMapContext {
  /** Creator's confirmed main narrative label + summary */
  narrative: { label: string; summary: string };
  /** Confirmed territories (1+ required) */
  territories: Array<{ label: string; summary?: string | null }>;
  /** Confirmed life assets — what's recurring in their actual life */
  confirmedAssets: string[];
  /**
   * Confirmed themes (camada-cena: território × narrativa, quase filmável).
   * Vêm do MapaSeed (onboarding/Instagram) já confirmados/editados pelo criador.
   * São PONTOS DE PARTIDA do roteiro — o gerador ancora as pautas nas cenas que
   * o criador já tem em vez de reconstruir a camada-tema do zero. Opcional:
   * quando ausente, a geração se comporta como antes.
   */
  confirmedThemes?: string[];
  /** Confirmed tone of communication (optional but enriching) */
  tone: string | null;
  /** Top-performing context pattern (e.g. "manhã + filhos + reflexivo") */
  topPerformingPattern: string | null;
  /** Past creator quiz answers — direct intent signals */
  pastCreatorAnswers: Array<{ questionText: string; answerValue: string }>;
  /** Onboarding answers — long-term intent */
  onboardingAnswers: {
    whyYouCreate: string | null;
    desiredFeeling: string | null;
    contentLimit: string | null;
    /** Declaração de propósito livre — o "norte" do criador (sinal mais forte). */
    creatorPurpose?: string | null;
  } | null;
  /** Previously dismissed idea titles — to avoid re-suggesting */
  recentDismissedTitles: string[];
  /**
   * Formats the creator confirmed as preferred — used to bias suggestedFormat selection.
   * When present, the prompt prioritises these formats unless a focusedFormat overrides.
   */
  confirmedFormats?: string[];
  /**
   * Etapa 4 — Adjacent narrative labels confirmed by the creator.
   * Used as diversification anchors: some pautas should explore these angles
   * without leaving the central narrative's identity space.
   */
  confirmedAdjacentNarratives?: string[];
  /**
   * Etapa 9 × Audiência — sinais de reconhecimento da audiência (já traduzidos).
   * Quando ausente (sem Instagram conectado ou sem sinal confiável), a geração
   * se comporta exatamente como antes: pautas a partir do mapa, sem priorização.
   */
  audienceResonance?: ContentIdeasAudienceResonance | null;
}

export interface ContentIdeasPromptParams {
  context: ContentIdeasMapContext;
  count: number; // how many ideas to generate (typically 3)
  /** Optional focus — narrows generation to one territory */
  focusedTerritory?: string | null;
  /** Optional format constraint */
  focusedFormat?: string | null;
}

export interface ContentIdeasPromptOutput {
  systemInstruction: string;
  userInstruction: string;
  responseSchemaInstruction: string;
}

/** Metadados internos que forçam variedade real dentro da leva de swipe. */
export const CONTENT_IDEA_CREATIVE_MODES = [
  "história vivida",
  "bastidor concreto",
  "posição pessoal",
  "método prático",
  "comparação ou contraste",
  "decisão ou virada",
] as const;

export type ContentIdeaCreativeMode = (typeof CONTENT_IDEA_CREATIVE_MODES)[number];

// ─── Response schema (strict JSON) ────────────────────────────────────────────

const ideaJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "angle",
          "hook",
          "territory",
          "assets",
          "suggestedFormat",
          "whyItFits",
          "mapAnchors",
          "scriptPoints",
          "scriptClosing",
          "scriptBlueprint",
          "creativeMode",
        ],
        properties: {
          title: { type: "string", maxLength: 80 },
          angle: { type: "string", maxLength: 320 },
          hook: { type: "string", maxLength: 180 },
          territory: { type: "string", maxLength: 100 },
          assets: { type: "array", items: { type: "string" }, maxItems: 4 },
          suggestedFormat: { type: "string", maxLength: 40 },
          whyItFits: { type: "string", maxLength: 320 },
          mapAnchors: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "source", "label"],
              properties: {
                kind: { type: "string", enum: ["subject", "situation", "scene", "voice"] },
                source: { type: "string", enum: ["territories", "themes", "assets", "tone"] },
                label: { type: "string", maxLength: 120 },
              },
            },
          },
          scriptPoints: {
            type: "array",
            items: { type: "string", maxLength: 120 },
            minItems: 2,
            maxItems: 3,
          },
          scriptClosing: { type: "string", maxLength: 120 },
          scriptBlueprint: {
            type: "object",
            additionalProperties: false,
            required: ["visualPremise", "estimatedDurationSeconds", "scenes", "recordingChecklist"],
            properties: {
              visualPremise: { type: "string", maxLength: 180 },
              estimatedDurationSeconds: { type: "integer", minimum: 10, maximum: 180 },
              scenes: {
                type: "array",
                minItems: 3,
                maxItems: 4,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["beat", "visual", "spokenIntent", "onScreenText", "shot", "asset", "durationSeconds"],
                  properties: {
                    beat: { type: "string", enum: ["abertura", "contexto", "virada", "fechamento"] },
                    visual: { type: "string", maxLength: 180 },
                    spokenIntent: { type: "string", maxLength: 180 },
                    onScreenText: { type: "string", maxLength: 90 },
                    shot: { type: "string", maxLength: 80 },
                    asset: { type: "string", maxLength: 100 },
                    durationSeconds: { type: "integer", minimum: 1, maximum: 90 },
                  },
                },
              },
              recordingChecklist: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                items: { type: "string", maxLength: 120 },
              },
            },
          },
          // Opcional (não está em `required`): metade-audiência do "match".
          // Só preenchido quando a pauta cai num sinal de reconhecimento.
          resonanceNote: { type: "string", maxLength: 200 },
          creativeMode: { type: "string", enum: CONTENT_IDEA_CREATIVE_MODES },
        },
      },
    },
  },
};

export const CONTENT_IDEAS_RESPONSE_JSON_SCHEMA = ideaJsonSchema;

// ─── Builder ──────────────────────────────────────────────────────────────────

const FORBIDDEN_VOCAB = [
  "algoritmo",
  "viralizar",
  "viralização",
  "engajamento",
  "tendência",
  "tendências",
  "trending",
  "growth hack",
  "crescimento",
  "ganhar seguidores",
  "bater o algoritmo",
  "performance",
  "audiência grande",
  "alta performance",
  // A1 — jargão de produto que vaza para títulos/hooks
  "autonomia criativa",
  "narrativa central",
  "mapa narrativo",
];

const ALLOWED_FORMATS = ["Reels", "Carrossel", "Story", "Foto", "Vídeo longo"];

export function buildContentIdeasPrompt(
  params: ContentIdeasPromptParams,
): ContentIdeasPromptOutput {
  const { context, count, focusedTerritory, focusedFormat } = params;

  const systemInstruction = [
    "Você é o companheiro estratégico do criador na plataforma Data2Content.",
    "Sua função é propor pautas (ideias de conteúdo) que emergem do mapa narrativo confirmado pelo criador — nunca de tendências, números ou modas.",
    "",
    "Crenças centrais que você nunca quebra:",
    "1. O conteúdo nasce da vida do criador, não do algoritmo.",
    "2. Cada pauta precisa rastrear de volta a uma dimensão confirmada do mapa (narrativa, território, asset, tom).",
    "3. A leitura é calma — sem pressão de performance, sem ansiedade.",
    "4. O criador reconhece a pauta como sua, não como um truque externo.",
    "",
    "Vocabulário PROIBIDO (nunca use estas palavras, nem variações):",
    FORBIDDEN_VOCAB.map((w) => `  - ${w}`).join("\n"),
    "",
    "Em vez de \"viralizar\" ou \"engajamento\", fale sobre \"ressonância\", \"reconhecimento\", \"identificação\", \"profundidade\".",
    "Em vez de \"audiência\", fale sobre \"as pessoas que te seguem porque enxergam algo em você\".",
    "Em vez de \"tendência\", fale sobre \"o que pulsa na sua vida agora\".",
    "",
    "IMPORTANTE — \"pauta\" é termo INTERNO desta plataforma. A palavra \"pauta\" (e \"pautas\")",
    "NUNCA pode aparecer em nenhum texto novo que o criador lê (title, hook, scriptPoints, scriptClosing, scriptBlueprint,",
    "whyItFits, resonanceNote). Use \"vídeo\", \"ideia\" ou \"roteiro\". Ex.: ❌ \"a estrutura de uma pauta\" → ✅ \"a estrutura do vídeo\".",
    "Exceção: mapAnchors.label deve copiar literalmente um rótulo já confirmado pelo próprio criador, mesmo quando esse rótulo contém um termo da lista proibida.",
    "",
    "Cada pauta deve responder, de forma natural, a essa pergunta implícita:",
    "  \"O que da vida deste criador, hoje, pode virar um vídeo coerente com o mapa dele?\"",
  ].join("\n");

  const territoryLines = context.territories.map(
    (t) => `  - ${t.label}${t.summary ? ` — ${t.summary}` : ""}`,
  );

  const assetLines = context.confirmedAssets.length > 0
    ? context.confirmedAssets.map((a) => `  - ${a}`).join("\n")
    : "  (sem assets confirmados ainda — proponha pautas que abram espaço para detectar novos assets)";

  const pastAnswersBlock = context.pastCreatorAnswers.length > 0
    ? [
        "",
        "Respostas anteriores do criador a perguntas de confirmação (use como sinal direto de intenção):",
        ...context.pastCreatorAnswers.slice(0, 5).map(
          (a) => `  - \"${a.questionText}\" → \"${a.answerValue}\"`,
        ),
      ].join("\n")
    : "";

  const onboardingBlock = context.onboardingAnswers
    ? [
        "",
        "Intenção declarada no onboarding:",
        // O propósito é a âncora narrativa: quando existe, prevalece sobre os
        // demais sinais de intenção para decidir o que é coerente propor.
        context.onboardingAnswers.creatorPurpose
          ? `  - PROPÓSITO (norte do criador — priorize sobre os demais sinais): ${context.onboardingAnswers.creatorPurpose}`
          : null,
        context.onboardingAnswers.whyYouCreate
          ? `  - Por que cria: ${context.onboardingAnswers.whyYouCreate}`
          : null,
        context.onboardingAnswers.desiredFeeling
          ? `  - Sentimento desejado: ${context.onboardingAnswers.desiredFeeling}`
          : null,
        context.onboardingAnswers.contentLimit
          ? `  - Limite de identidade (NÃO deve aparecer): ${context.onboardingAnswers.contentLimit}`
          : null,
      ].filter(Boolean).join("\n")
    : "";

  const dismissedBlock = context.recentDismissedTitles.length > 0
    ? [
        "",
        "Pautas que o criador já descartou (evite repetir ou propor variações próximas):",
        ...context.recentDismissedTitles.slice(0, 8).map((t) => `  - ${t}`),
      ].join("\n")
    : "";

  const adjacentNarrativesBlock =
    context.confirmedAdjacentNarratives && context.confirmedAdjacentNarratives.length > 0
      ? [
          "",
          "Narrativas adjacentes confirmadas pelo criador (outros ângulos de olhar pela mesma identidade):",
          ...context.confirmedAdjacentNarratives.map((l) => `  - ${l}`),
          "Use estas como ângulos alternativos em 1 ou 2 pautas — sempre mantendo a identidade da narrativa central.",
        ].join("\n")
      : "";

  const themesBlock = (() => {
    const temas = (context.confirmedThemes ?? []).filter((t) => t && t.trim());
    if (temas.length === 0) return "";
    return [
      "",
      "Cenas que o criador JÁ confirmou (camada-tema — cada uma é território × narrativa, quase filmável):",
      ...temas.slice(0, 8).map((t) => `  - ${t}`),
      "Estas cenas são PONTOS DE PARTIDA reais — ancore ao menos parte das pautas nelas",
      "em vez de inventar situações novas do zero. Uma cena confirmada já carrega o cruzamento",
      "certo (assunto + identidade); seu trabalho é transformá-la em título + hook + roteiro,",
      "não substituí-la por outra. NUNCA copie a frase do tema literalmente no título: ela é o",
      "ponto de partida interno, não a legenda do vídeo.",
    ].join("\n");
  })();

  const audienceResonanceBlock = (() => {
    const r = context.audienceResonance;
    if (!r) return "";
    const lines: string[] = [];
    if (r.resonantTerritory) lines.push(`  - Assunto que as pessoas mais guardam/reconhecem de você: ${r.resonantTerritory}`);
    if (r.underexploredTerritory) lines.push(`  - Assunto que você toca POUCO, mas que mais guardam quando aparece: ${r.underexploredTerritory}`);
    if (r.tone) lines.push(`  - Jeito de falar (tom) que mais ressoa com elas: ${r.tone}`);
    if (r.intent) lines.push(`  - Intenção que mais conecta: ${r.intent}`);
    if (r.narrativeForm) lines.push(`  - Forma de contar que mais guardam: ${r.narrativeForm}`);
    if (r.stance) lines.push(`  - Postura/voz que mais reconhecem em você: ${r.stance}`);
    if (lines.length === 0) return "";
    // Teto de diversidade: a audiência molda no máx. ~metade da leva (mín. 1),
    // nunca todas — protege a identidade do mapa contra deriva (3 pautas iguais).
    const audienceShapedCap = Math.max(1, Math.ceil(count / 2));
    return [
      "",
      "Sinais de reconhecimento da audiência — o que as pessoas que te seguem mais GUARDAM pra rever e LEVAM pra alguém:",
      ...lines,
      "",
      "Como usar estes sinais (REGRAS — leia com atenção):",
      `  - PISO: ao menos 1 pauta deve cair no que mais reconhecem — é onde QUEM VOCÊ É encontra O QUE AS PESSOAS VEEM EM VOCÊ.`,
      `  - TETO (igualmente obrigatório): NO MÁXIMO ${audienceShapedCap} de ${count} pauta${count === 1 ? "" : "s"} pode se apoiar nos sinais da audiência.`,
      "    Os sinais PRIORIZAM, não SUBSTITUEM o mapa. É proibido entregar pautas que sejam todas a mesma nota (ex.: todas humor + solo).",
      "  - DIVERSIDADE OBRIGATÓRIA: as pautas restantes devem cobrir territórios DIFERENTES da lista confirmada — inclusive os que a audiência NÃO destaca.",
      "    Se há território confirmado que ainda não foi tocado em nenhuma pauta desta leva, ele tem prioridade nas pautas que não são moldadas pela audiência.",
      "    Identidade primeiro: um criador é mais do que o lado dele que a audiência mais salva.",
      "  - Se houver um 'assunto que você toca pouco, mas que mais guardam', ele conta como 1 das pautas moldadas pela audiência (respeita o teto).",
      "  - Os assuntos acima JÁ pertencem ao mapa confirmado — NÃO invente território novo a partir deles. O campo `territory` continua valendo a regra de só usar a lista confirmada.",
      "  - PROIBIDO tratar isso como desempenho: nunca diga nem sugira que algo 'funciona', 'dá retorno', 'rende mais', 'tem mais alcance', 'performa' ou qualquer ideia de número.",
      "    Fale sempre em 'reconhecimento', 'o que guardam', 'o que fica com elas', 'o que levam pra alguém'.",
    ].join("\n");
  })();

  const focusBlock = (() => {
    const lines: string[] = [];
    if (focusedTerritory) {
      lines.push(`  - Foque exclusivamente no território: \"${focusedTerritory}\".`);
    }
    if (focusedFormat) {
      lines.push(`  - Sugira apenas o formato: \"${focusedFormat}\".`);
    } else if (context.confirmedFormats && context.confirmedFormats.length > 0) {
      lines.push(`  - Prefira os formatos confirmados pelo criador: ${context.confirmedFormats.join(", ")}. Outros formatos só se fizerem mais sentido narrativo.`);
    }
    return lines.length > 0 ? `\nRestrições desta geração:\n${lines.join("\n")}` : "";
  })();

  const userInstruction = [
    "Mapa narrativo confirmado deste criador:",
    "",
    `Narrativa central: ${context.narrative.label}`,
    `  ${context.narrative.summary}`,
    "",
    "Territórios confirmados (legítimos para este criador ocupar):",
    ...territoryLines,
    "",
    "FILTRO NARRATIVO OBRIGATÓRIO: Os territórios acima são ÂNGULOS ESPECÍFICOS",
    "desta narrativa central — nunca temas independentes. Cada território deve ser",
    "interpretado EXCLUSIVAMENTE pelo que este criador já é e faz.",
    "Se a narrativa é sobre 'IA e estratégia para criadores de conteúdo', então:",
    "  - 'carreira artística' = carreira de criador digital, não de artista musical",
    "  - 'negócio cultural' = criadores que constroem negócio com conteúdo próprio",
    "  - 'autonomia criativa' = criar sem depender de pauta/equipe/algoritmo",
    "Antes de gerar cada pauta, pergunte: 'Esta pauta, sem o título, ainda deixa",
    "claro que o criador é sobre [narrativa central]?' Se a resposta for não, a pauta",
    "está errada. Nunca gere pautas sobre música, moda, culinária, esportes ou",
    "qualquer nicho externo à narrativa central confirmada.",
    "",
    "Assets de vida confirmados (elementos reais que aparecem no conteúdo):",
    assetLines,
    "",
    `Tom dominante confirmado: ${context.tone ?? "(ainda não confirmado — adote tom reflexivo e direto)"}`,
    "",
    context.topPerformingPattern
      ? `Padrão de contexto mais frequente: ${context.topPerformingPattern}`
      : "Sem padrão de contexto dominante ainda.",
    themesBlock,
    pastAnswersBlock,
    onboardingBlock,
    dismissedBlock,
    adjacentNarrativesBlock,
    audienceResonanceBlock,
    focusBlock,
    "",
    `Tarefa: gere exatamente ${count} pauta${count === 1 ? "" : "s"} que respeitem TODAS as crenças e o vocabulário permitido.`,
    "",
    "COMPOSIÇÃO OBRIGATÓRIA DA LEVA — não entregue a mesma ideia com outras palavras:",
    `  - Dê a cada ideia um creativeMode DIFERENTE, escolhido entre: ${CONTENT_IDEA_CREATIVE_MODES.join(", ")}.`,
    "  - Mude a ORIGEM da história entre as ideias: se uma nasce de uma cena de bastidor, a próxima não pode apenas recontar esse mesmo bastidor com outro título.",
    "  - Quando houver mais de um território confirmado, distribua as ideias por territórios diferentes antes de repetir um deles.",
    "  - Quando houver mais de um asset ou cena confirmado, distribua as ideias por experiências diferentes antes de voltar ao mesmo lugar, objeto ou conflito.",
    "  - Título, hook e angle precisam defender pontos de vista diferentes. Trocar sinônimos, inverter a frase ou mudar apenas o formato NÃO cria uma ideia nova.",
    "  - Teste final: se dois vídeos poderiam usar a mesma primeira cena e chegar à mesma conclusão, mantenha só um e crie outro a partir de uma experiência realmente distinta.",
    "",
    "Para cada pauta:",
    "  - title: este campo É o título do Reels — o texto que apareceria na tela ou como legenda principal.",
    "    Regras do título:",
    "    • Máx. 70 caracteres. Direto. Sem ponto final.",
    "    • Use formatos reais de Reels (escolha o que melhor encaixa na pauta):",
    "      POV: [situação em primeira pessoa]",
    "      Como [resultado concreto] sem [custo comum]",
    "      A verdade sobre [tema do criador]",
    "      Quando [situação relatable do criador]",
    "      Por que [crença contraintuitiva]",
    "      [Número] coisas que [revelação pessoal]",
    "      [Pergunta direta que o criador responderia com autoridade]?",
    "    • O título deve soar como algo que o próprio criador diria — não como manchete de blog.",
    "    • Pode ser provocativo ou íntimo — nunca genérico ou abstrato.",
    "    • A2 — ÂNCORA OBRIGATÓRIA: o título deve conter ao menos um verbo de ação concreta do criador",
    "      (descobri, aprendi, faço, fiz, percebi, tentei, voltei, parei, comecei, tenho).",
    "      Títulos com apenas substantivos abstratos ('a tensão de...', 'o modelo de...') são insuficientes.",
    "    • A1 — VOCABULÁRIO PROIBIDO também em títulos: performance, autonomia criativa, narrativa central,",
    "      engagement, algoritmo. Se a palavra aparecer no título, o título está errado.",
    "    • ASSETS NÃO SÃO VOCABULÁRIO: os rótulos dos assets (ex: 'solo', 'casa') descrevem a vida",
    "      do criador — NUNCA os use como palavras literais no título. Transforme o conceito em fala humana.",
    "      'solo' (asset) → 'criar tudo eu mesmo', 'não ter equipe', 'gravar só eu' — nunca 'solo' no título.",
    "      'casa' (asset) → 'no meu quarto', 'aqui no meu espaço', 'sem sair de casa' — nunca 'casa' solta.",
    "    • SUBSTANTIVOS ABSTRATOS EXIGEM ÂNCORA: palavras como 'tensão', 'humor', 'ansiedade',",
    "      'medo', 'caos', 'pressão', 'processo' são opacas sozinhas — o espectador não sabe a que se referem.",
    "      Se usar uma dessas palavras, ela DEVE vir imediatamente acompanhada da situação concreta que a origina.",
    "      ❌ 'minha maior tensão virou meu melhor humor' (dois abstratos soltos — o que é cada um?)",
    "      ✅ 'a pressão de gravar sozinho virou minha piada favorita' (situação + resultado legível)",
    "      ❌ 'descobri que meu caos vira conteúdo' (caos de quê? conteúdo = jargão)",
    "      ✅ 'descobri que gravar no meio da bagunça em casa faz meu vídeo ficar melhor'",
    "    • UM TÍTULO, UM FORMATO: escolha exatamente um dos formatos acima e use-o puro.",
    "      NUNCA combine dois formatos no mesmo título.",
    "      ❌ 'A verdade sobre: como eu aprendi...' (dois formatos fundidos)",
    "      ❌ 'POV: a verdade sobre criar sozinho' (POV + A verdade)",
    "      ✅ 'A verdade sobre criar sozinho e ainda pagar as contas' (um formato, direto)",
    "    • TESTE DO ESPECTADOR (obrigatório antes de finalizar cada título):",
    "      Imagine alguém que te segue mas não sabe nada sobre 'criação de conteúdo', 'pauta',",
    "      'processo criativo' ou 'IP'. Essa pessoa entende o título sem precisar pesquisar?",
    "      Se uma palavra do título for jargão de bastidor ou de marketing — troque por linguagem comum.",
    "      ❌ 'processo de pauta' → ✅ 'como eu decido o que gravar'",
    "      ❌ 'IP' → ✅ 'o que eu criei', 'minha marca', 'o que é meu'",
    "      ❌ 'conteúdo' (como substantivo genérico) → ✅ 'vídeo', 'o que eu posto', 'o que faço'",
    "      ❌ 'negócio cultural' → ✅ 'como pago minhas contas fazendo o que faço'",
    "      ❌ 'processo criativo' → ✅ 'como eu crio', 'o que acontece antes de gravar'",
    "      PALAVRAS-PREENCHIMENTO PROIBIDAS: 'aqui', 'assim', 'agora', 'isso' como sujeito vago.",
    "      Essas palavras adicionam volume sem adicionar significado.",
    "      ❌ 'a pressão de criar sozinho aqui virou...' → ✅ 'a pressão de criar sozinho virou...'",
    "    ASPAS IRÔNICAS PROIBIDAS (vale para TODOS os campos: título, hook, scriptPoints, whyItFits, resonanceNote):",
    "      não use aspas para marcar ironia/distância numa palavra ('aulas', 'problemas', 'caos', 'falta').",
    "      Ou a palavra é direta (sem aspas), ou troque por outra. ❌ minhas 'aulas' que nascem da vida → ✅ o que eu ensino sem perceber",
    "    CLICHÊS PROIBIDOS: 'marca registrada', 'a sua cara' (dentro do texto), 'sua essência', 'DNA', 'autêntico'.",
    "      Diga a coisa concreta em vez do rótulo pronto. ❌ 'é a sua marca registrada' → ✅ 'você faz isso toda vez que grava sozinho'",
    "  - angle: 1-2 frases explicando o ponto de vista específico desta pauta dentro da narrativa do criador",
    "  - hook: a primeira frase FALADA no vídeo. Tem duas regras simultâneas:",
    "    REGRA 1 — ORIGEM: vem da vida real do criador (situação, momento, objeto concreto do mapa).",
    "    REGRA 2 — EFEITO: precisa PARAR O SCROLL nos primeiros 3 segundos.",
    "    Um hook que apenas descreve uma memória suave NÃO cumpre a regra 2.",
    "    O espectador precisa sentir: 'não posso sair agora — preciso ouvir o resto.'",
    "",
    "    Use um destes padrões de impacto — sempre com base no mapa confirmado do criador:",
    "    • CONFISSÃO INESPERADA: admita algo que outros não admitem",
    "      ✅ 'Fui o pior funcionário que tive — e foi assim que aprendi a trabalhar sozinho.'",
    "    • RUPTURA DE EXPECTATIVA: dois anos/X tentativas e descobri que estava errado",
    "      ✅ 'Passei um ano tentando montar equipe. Aí parei tudo e entendi o que estava perdendo.'",
    "    • DECLARAÇÃO POLÊMICA: afirme algo que a maioria discordaria de início",
    "      ✅ 'Criar sozinho é mais difícil — e é por isso que vale mais.'",
    "    • MOMENTO DE CRISE REAL: comece na virada, não no começo da história",
    "      ✅ 'Estava prestes a fechar tudo quando entendi o que eu realmente estava construindo.'",
    "    • FATO CONTRAINTUITIVO: quanto menos X, mais Y — viola expectativa do espectador",
    "      ✅ 'Quanto menos eu planejava o vídeo, mais as pessoas assistiam até o fim.'",
    "",
    "    PROIBIDO no hook:",
    "    ❌ Hook nostálgico/suave sem tensão: 'Lembro daquela sensação de paz...' (não para o scroll)",
    "    ❌ Começa no espectador: 'Você sabia que...' / 'Acha que...' (não é voz do criador)",
    "    ❌ Frase genérica que qualquer criador poderia dizer: 'Criar conteúdo mudou minha vida'",
    "  - territory: nome exato de um território confirmado da lista acima",
    "  - assets: 0 a 3 assets confirmados envolvidos (se houver assets a confirmar, deixe vazio)",
    `  - suggestedFormat: um destes: ${ALLOWED_FORMATS.join(", ")}`,
    "  - whyItFits: 1-2 frases em linguagem de criador — por que esta pauta é naturalmente dele,",
    "    como se você fosse um amigo próximo confirmando: 'isso é a sua cara'.",
    "    NÃO mencione 'narrativa central', 'território', 'asset' ou qualquer jargão de produto.",
    "    LADO MAPA, NÃO AUDIÊNCIA: o whyItFits fala só do CRIADOR — da vida, do jeito, do que ele já faz.",
    "    NUNCA fale do que 'as pessoas', 'elas', 'a audiência' acham/salvam/reconhecem — esse é o trabalho EXCLUSIVO da resonanceNote.",
    "    Se a frase do whyItFits terminar em 'as pessoas se identificam/reconhecem', está errada — reescreva olhando só pro criador.",
    "    ❌ '…é o que as pessoas mais se identificam na sua voz.' (isso é audiência → vai pra resonanceNote)",
    "    ✅ 'Você já faz isso toda vez que grava sozinho no seu quarto — já é o seu jeito.'",
    "    A4 — ESPECIFICIDADE OBRIGATÓRIA: o texto deve mencionar algo único e concreto que aparece",
    "    nos vídeos/vida DESTE criador — não pode ser uma descrição genérica que se aplica a qualquer",
    "    criador do mesmo nicho. Se a frase fizer sentido para qualquer humorista, criador solo ou",
    "    creator de lifestyle do Brasil, ela é genérica demais — reescreva.",
    "    ÂNCORA NESTE ROTEIRO: o whyItFits precisa retomar um detalhe concreto que JÁ está neste",
    "    roteiro específico (o objeto/cena/situação do hook ou dos scriptPoints) — não uma descrição",
    "    do criador 'em geral'. Pergunte-se: essa frase poderia ser colada em outra pauta dele? Se sim, refaça.",
    "    ❌ 'Você sempre encontra humor nas situações do dia a dia da sua vida de criador.' (vale pra qualquer pauta dele e pra qualquer humorista)",
    "    ✅ 'A mesa virada do avesso quando você se irrita é de onde saem suas melhores ideias — isso é só seu.'",
    "    ASSETS NO WHYITFITS: NUNCA mencione os rótulos dos assets pelo nome (ex: 'solo', 'casa',",
    "    'rotina', 'bastidor'). Descreva a experiência real que eles representam.",
    "    ❌ 'Sua leitura do solo não é sobre isolamento' (usa o label 'solo' do sistema)",
    "    ✅ 'Você já mostrou várias vezes o que é tomar todas as decisões sem depender de ninguém'",
    "    ✅ 'Você já fez isso sem perceber — esse vídeo só dá nome ao que você repete todo semana.'",
    "    ✅ 'Isso aparece toda vez que você filma sozinho em casa. Já é o seu jeito.'",
    "    ❌ 'Seu humor sempre vem da capacidade de rir das suas próprias experiências.' (qualquer humorista)",
    "    ❌ 'Esta pauta conecta a narrativa central ao território X utilizando o asset Y.' (jargão)",
    "  - mapAnchors: assinatura visual e RASTREÁVEL desta ideia no 'Seu mapa'.",
    "    Use somente rótulos EXATOS das listas confirmadas acima e combine kind/source assim:",
    "      • subject + territories: o mesmo rótulo exato usado em territory (obrigatório).",
    "      • situation + themes: a situação real confirmada que sustenta ESTE roteiro; inclua quando uma das situações reais acima foi usada.",
    "      • scene + assets: 0 a 2 elementos de cena realmente presentes no roteiro, exatamente como aparecem nos assets confirmados.",
    "      • voice + tone: o tom confirmado, somente quando estiver disponível.",
    "    Não invente, resuma, traduza nem reescreva labels. Não use creativeMode nem suggestedFormat como âncora do mapa.",
    "    Prefira 3 ou 4 âncoras úteis a preencher 5 itens sem necessidade.",
    "  - scriptPoints: 2 a 3 pontos de partida concretos para o vídeo, em ordem.",
    "    Cada ponto ancora o criador num momento, objeto ou situação real da vida dele — não num conceito.",
    "    O criador lê e sabe imediatamente de onde tirar o conteúdo: qual memória usar, o que mostrar, onde começar.",
    "    NÃO use nomes de conceitos, análises ou abstrações. Use situações e momentos.",
    "    ✅ 'Começa naquele dia em que você estava sozinho criando e percebeu que estava funcionando melhor assim'",
    "    ✅ 'Mostra um detalhe físico do seu espaço de trabalho que conta essa história sem precisar explicar'",
    "    ✅ 'Conta o momento em que você tentou fazer diferente e voltou pro mesmo jeito — o que isso revelou'",
    "    ❌ 'Exploração da tensão paradoxal entre solidão e conexão' (abstrato demais)",
    "    ❌ 'Conexão com a narrativa de autonomia' (jargão de produto)",
    "    CENA, NÃO REAÇÃO: os scriptPoints ficam na vida/cena do criador — NUNCA em como a plateia reage.",
    "    Proibido 'como as pessoas respondem/reagem/curtem/comentam'. Isso é reação de audiência, não ponto de roteiro.",
    "    ❌ 'Compartilha como as pessoas respondem a essa singularidade' (reação de audiência)",
    "    ✅ 'Mostra a cena real em que você fez tudo sozinho e o que sentiu ali'",
    "  - scriptClosing: como o vídeo termina — uma pergunta ao espectador, um convite ou um insight final (1 frase curta, sem ponto final)",
    "  - scriptBlueprint: transforme o roteiro num storyboard simples, filmável e específico:",
    "    • visualPremise: a lógica visual do vídeo em 1 frase — o que sustenta as imagens do começo ao fim.",
    "    • estimatedDurationSeconds: duração total realista entre 10 e 180 segundos.",
    "    • scenes: 3 ou 4 cenas em progressão. Use abertura, contexto, virada e fechamento; em roteiro de 3 cenas, una contexto e virada sem perder a mudança de direção.",
    "    • visual: o que a câmera VÊ e o criador FAZ. Dê verbo, objeto/ambiente e ação concreta. Nunca escreva apenas 'falar para a câmera'.",
    "    • spokenIntent: o que precisa ser comunicado naquele momento, em linguagem natural. Não escreva um texto longo para decorar.",
    "    • onScreenText: texto curto que realmente ajudaria a leitura. Use string vazia quando não precisar.",
    "    • shot: enquadramento simples e executável (selfie, plano próximo, detalhe das mãos, tela gravada, plano aberto).",
    "    • asset: use EXATAMENTE um asset confirmado envolvido na cena; string vazia quando nenhum asset for necessário.",
    "    • durationSeconds: duração estimada daquela cena.",
    "    • recordingChecklist: 2 a 4 coisas concretas que o creator precisa separar ou capturar antes de gravar.",
    "    O storyboard precisa variar imagem, escala ou ação entre as cenas. Se todas puderem ser gravadas no mesmo plano parado, refaça.",
    "    Não invente locação, objeto, pessoa, marca ou rotina que não exista no mapa. Quando faltar contexto, simplifique a produção.",
    "  - resonanceNote: OBRIGATÓRIO sempre que a pauta se apoiar em QUALQUER sinal da audiência —",
    "    seja assunto, TOM (ex.: humor), INTENÇÃO, FORMA (ex.: tutorial) ou POSTURA. Atenção: se você",
    "    escolheu o tom/forma desta pauta por causa dos sinais acima, ELA SE APOIA na audiência — preencha.",
    "    É a metade-AUDIÊNCIA do encontro — complementar ao whyItFits (que é a metade-MAPA). 1 frase curta (máx. 180 caracteres), em linguagem de criador,",
    "    nomeando o porquê desta pauta ser justamente o que as pessoas mais guardam de você. NÃO repita o whyItFits.",
    "    Nomeie o SINAL específico em linguagem humana: humor → 'é no seu lado que faz rir que elas mais se reconhecem';",
    "    tutorial → 'é quando você ensina na prática que elas mais guardam'.",
    "    PROIBIDO: números, ideia de desempenho ('funciona', 'rende', 'alcança') e jargão de produto ('território', 'narrativa central').",
    "    ✅ 'Toda vez que você aparece assim, é o que as pessoas mais guardam pra rever.'",
    "    ✅ 'Você fala pouco disso — mas é o que mais fica com quem te acompanha.'",
    "    SÓ deixe de fora quando a pauta for puramente do mapa, sem nenhum sinal de reconhecimento envolvido. Nesse caso, não invente.",
    "  - creativeMode: metadado INTERNO. Escolha exatamente um dos modos permitidos para representar o gesto principal desta ideia. Não escreva esse rótulo em nenhum outro campo.",
    "",
    "Exemplos de títulos BOM vs RUIM:",
    "  ✅ 'POV: você percebe que seu conteúdo sempre volta pro mesmo tema'",
    "  ✅ 'Por que eu parei de copiar formato e comecei a copiar ideia'",
    "  ✅ 'A lição que o Bad Bunny me deu sem saber'",
    "  ❌ 'A lição de autonomia criativa em Parasita' (abstrato demais)",
    "  ❌ 'Reflexões sobre processo criativo e narrativa' (jornalístico)",
    "  ❌ 'Como criar conteúdo autêntico em 2024' (genérico, sem identidade)",
    "",
    "Não invente territórios, assets ou tons que não estejam na lista acima.",
    "O campo `territory` deve ser EXATAMENTE o rótulo do território da lista — nunca uma descrição",
    "genérica como 'Território de marca possível', 'Território em formação' ou similar.",
    "Se o melhor território disponível tiver esse tipo de rótulo genérico, use-o mesmo assim, literalmente.",
    "Se o tom estiver ausente, gere pautas que naturalmente revelem o tom — não force.",
    "",
    "REGRA CRÍTICA — origem e especificidade das pautas:",
    "1. Cada pauta deve emergir da VIDA CONFIRMADA do criador — não de referências culturais externas.",
    "   Celebridades, filmes, séries ou tendências culturais (Taylor Swift, Star Wars, Bad Bunny, etc.) só entram",
    "   se o próprio criador já os usou explicitamente como contexto de vídeo no mapa.",
    "   Uma pauta sobre 'o que Taylor Swift me ensinou sobre IP' poderia ser de qualquer criador.",
    "   Uma pauta sobre 'o que aprendi sozinho em casa sobre criar um negócio do meu conteúdo' é DESTA vida.",
    "",
    "2. Use SEMPRE a primeira pessoa do singular no título: 'minha', 'meu', 'eu', 'aprendi', 'faço', 'descobri'.",
    "   NUNCA use 'você', 'seu', 'sua' no título — isso transforma a pauta em conselho genérico.",
    "   ❌ 'POV: você trabalha de casa e precisa criar sozinho'",
    "   ✅ 'POV: descobri que criar sozinho em casa é o meu modelo'",
    "   ❌ 'Quando a tensão do dia a dia vira sua melhor ideia'",
    "   ✅ 'Como a tensão de criar sozinho virou meu processo de pauta'",
    "",
    "3. Cada título deve conter ao menos um elemento que só existe neste mapa específico.",
    "   Esse elemento deve ser a EXPERIÊNCIA HUMANA por trás dos assets/territórios — nunca o rótulo em si.",
    "   'solo' (asset) → a experiência de gravar sem equipe, de tomar todas as decisões sozinho",
    "   'casa' (asset) → o quarto, a mesa, o silêncio, a liberdade de trabalhar sem sair",
    "   Se o título pode ser publicado por qualquer outro criador sem soar estranho, reescreva-o.",
    "",
    "Responda em JSON estrito conforme o schema fornecido. Não inclua texto antes ou depois do JSON.",
  ].filter(Boolean).join("\n");

  const responseSchemaInstruction = [
    "Responda exclusivamente em JSON válido conforme o schema abaixo.",
    "Nenhum campo fora do schema. Nenhum comentário. Nenhum markdown.",
    // Defesa contra acentos mutilados: o modelo às vezes escapa 'ç' como \\u00e7 e
    // perde a barra, gravando '00e7' literal. Exigir UTF-8 puro evita isso.
    "Escreva acentos como caracteres UTF-8 literais (ç, ã, õ, á, é, í, ó, ú, â, ê, ô). NUNCA use escapes \\uXXXX nem códigos numéricos para letras acentuadas.",
    "",
    JSON.stringify(ideaJsonSchema, null, 2),
  ].join("\n");

  return { systemInstruction, userInstruction, responseSchemaInstruction };
}
