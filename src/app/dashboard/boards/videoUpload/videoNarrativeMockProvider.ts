import {
  VideoNarrativeAnalysis,
  VideoNarrativeConfidence,
  createEmptyVideoNarrativeAnalysis,
  sanitizeVideoNarrativeAnalysisText,
} from "./videoNarrativeAnalysisTypes";
import type { VideoNarrativeContentPotentialScan } from "./videoNarrativeContentPotentialScan";

export type VideoNarrativeMockProviderScenario =
  | "skincare_routine"
  | "backstage_process"
  | "brand_potential"
  | "weak_hook"
  | "collab_potential"
  | "unclear_content"
  | "ad_adaptation";

export type VideoNarrativeMockProviderInput = {
  id: string;
  creatorQuestion: string | null;
  createdAt?: string | null;
};

export type VideoNarrativeMockProviderOptions = {
  scenario?: VideoNarrativeMockProviderScenario;
  confidence?: VideoNarrativeConfidence;
};

const fallbackId = "mock-video-narrative-analysis";

function buildMockContentPotentialScan(
  scenario: VideoNarrativeMockProviderScenario,
): VideoNarrativeContentPotentialScan {
  const isWeakOpening = scenario === "weak_hook";
  const isUnclear = scenario === "unclear_content";
  const isShareable = scenario === "brand_potential" || scenario === "collab_potential" || scenario === "ad_adaptation";
  const dimension = (
    status: "strong" | "mixed" | "weak" | "unknown",
    evidence: string,
    adjustment: string | null,
    window: "0-3s" | "0-10s" | "full_video" | "creator_history",
  ) => ({ status, evidence: clean(evidence), adjustment: adjustment ? clean(adjustment) : null, window });

  return {
    band: isUnclear ? "uncertain" : isWeakOpening ? "weak_signals" : "promising_with_adjustment",
    confidence: isUnclear ? "low" : "medium",
    basis: "video_only",
    objective: "complete_reading",
    historyPostsAnalyzed: 0,
    dimensions: {
      openingClarity: isUnclear
        ? dimension("unknown", "Não há evidência suficiente da abertura.", null, "0-3s")
        : isWeakOpening
          ? dimension("weak", "O assunto principal só aparece depois da contextualização.", "Trazer a tensão principal para os 3 primeiros segundos e reforçá-la em texto.", "0-3s")
          : dimension("mixed", "O assunto é reconhecível no início, mas pode ficar mais explícito sem som.", "Escrever a promessa principal na primeira cena.", "0-3s"),
      attentionArchitecture: isUnclear
        ? dimension("unknown", "Não há evidência suficiente de ritmo.", null, "0-10s")
        : dimension("mixed", "Há progressão nos primeiros 10 segundos, com espaço para uma virada visual mais clara.", "Antecipar um corte, gesto ou mudança de enquadramento.", "0-10s"),
      shareImpulse: isUnclear
        ? dimension("unknown", "Não há evidência suficiente de utilidade compartilhável.", null, "full_video")
        : isShareable
          ? dimension("strong", "A pauta oferece uma ideia útil para levar a outra pessoa.", null, "full_video")
          : dimension("mixed", "Existe utilidade, mas o motivo para enviar a alguém ainda está implícito.", "Fechar com uma síntese que a audiência queira encaminhar.", "full_video"),
      promiseDelivery: isUnclear
        ? dimension("unknown", "Não foi possível confrontar promessa e entrega.", null, "full_video")
        : dimension("mixed", "O vídeo entrega o tema proposto, mas o fechamento pode materializar melhor o ganho.", "Transformar o final em uma conclusão prática.", "full_video"),
      narrativeFit: isUnclear
        ? dimension("unknown", "Sem contexto suficiente para comparar com o mapa.", null, "creator_history")
        : dimension("strong", "O formato conversa com os territórios narrativos identificados no perfil.", null, "creator_history"),
    },
    watchedMoments: isUnclear
      ? [
          {
            moment: "opening",
            observation: "A abertura não oferece imagem ou fala nítida o bastante para identificar a promessa.",
            impact: "Sem uma evidência legível, a leitura da entrada permanece inconclusiva.",
          },
          {
            moment: "development",
            observation: "O material disponível não permite confirmar uma progressão visual ou verbal.",
            impact: "Não há base suficiente para apontar onde a atenção ganha ou perde força.",
          },
        ]
      : [
          {
            moment: "opening",
            observation: isWeakOpening
              ? "Você começa contextualizando a situação antes de revelar a tensão principal."
              : "A primeira cena apresenta o tema pela fala, mas a promessa ainda não aparece escrita.",
            impact: isWeakOpening
              ? "A pessoa precisa esperar para entender por que vale continuar."
              : "Sem som, o assunto é reconhecível, mas o ganho do vídeo fica implícito.",
          },
          {
            moment: "development",
            observation: "A explicação avança com uma mudança de enquadramento nos primeiros 10 segundos.",
            impact: "A virada visual ajuda a sinalizar que a ideia está progredindo.",
          },
          {
            moment: "closing",
            observation: "O fechamento retoma o tema, mas deixa a conclusão prática apenas na fala.",
            impact: "A utilidade existe, porém ainda não vira uma síntese fácil de guardar ou enviar.",
          },
        ],
    practicalDirection: isUnclear
      ? {
          title: "Dê ao scan uma abertura mais legível",
          action: "Use uma versão em que a primeira cena, a fala e o texto estejam nítidos para a análise.",
          example: null,
        }
      : isWeakOpening
        ? {
            title: "Abra pela tensão que hoje aparece depois",
            action: "Corte a contextualização inicial e leve a dúvida central para o primeiro frame, também em texto.",
            example: "A sua ideia trava antes mesmo de virar pauta?",
          }
        : {
            title: "Torne a promessa visível na primeira cena",
            action: "Mantenha a fala atual e acrescente no primeiro frame uma frase curta com o ganho que o vídeo entrega.",
            example: "Como transformar uma ideia solta em uma pauta clara",
          },
    highestImpactAdjustment: isWeakOpening
      ? clean("Trazer a tensão principal para os 3 primeiros segundos e reforçá-la em texto.")
      : clean("Tornar a promessa legível sem som já na primeira cena."),
    disclaimer: clean("Leitura estrutural do vídeo — não é garantia de alcance."),
  };
}

function clean(value: string): string {
  return sanitizeVideoNarrativeAnalysisText(value);
}

function buildBase(input: VideoNarrativeMockProviderInput, confidence: VideoNarrativeConfidence): VideoNarrativeAnalysis {
  return {
    ...createEmptyVideoNarrativeAnalysis({
      id: input.id.trim() || fallbackId,
      createdAt: input.createdAt ?? null,
    }),
    confidence,
  };
}

function buildScenario(
  input: VideoNarrativeMockProviderInput,
  scenario: VideoNarrativeMockProviderScenario,
  confidence: VideoNarrativeConfidence,
): VideoNarrativeAnalysis {
  const base = buildBase(input, confidence);

  switch (scenario) {
    case "backstage_process":
      return {
        ...base,
        summary: clean("Vídeo de bastidor mostrando processo de criação em andamento."),
        hook: {
          detected: clean("Abre com a rotina real antes da entrega final."),
          strength: "medium",
          why: clean("A abertura cria contexto para acompanhar o processo."),
        },
        spokenTopics: [clean("processo de criação"), clean("bastidores")],
        visualElements: [clean("reunião"), clean("tela de trabalho"), clean("rascunhos")],
        sceneStructure: [
          { id: "context", timestampLabel: "00:00", role: "context", description: clean("Mostra a reunião inicial."), suggestedAdjustment: null },
          { id: "development", timestampLabel: "00:08", role: "development", description: clean("Desenvolve o raciocínio no processo."), suggestedAdjustment: null },
          { id: "closing", timestampLabel: "00:24", role: "closing", description: clean("Fecha com a entrega tomando forma."), suggestedAdjustment: null },
        ],
        d2cClassification: {
          format: "reel",
          proposal: "behind_the_scenes",
          context: clean("processo"),
          tone: clean("observational"),
          reference: null,
          intent: clean("mostrar processo"),
          narrative: clean("bastidor -> processo -> pauta"),
        },
        diagnosis: {
          strengths: [clean("O processo aparece de forma concreta.")],
          weaknesses: [],
          recommendedAdjustments: [clean("Explicitar a virada prática do bastidor.")],
        },
        blueprintSuggestion: {
          whatToPost: clean("Um reel de bastidor que transforma processo em pauta."),
          whyThisPath: clean("O material já mostra contexto real e progressão."),
          howItShouldWork: clean("Abrir no bastidor, revelar decisão e fechar com aprendizado."),
          scenes: [clean("Reunião"), clean("Decisão"), clean("Aprendizado")],
        },
        brandMatch: { enabled: false, territories: [], whyBrandsWouldFit: null },
        evidence: {
          transcript: clean("Mostro como a ideia sai da reunião e vira pauta."),
          ocr: [clean("Planejamento")],
          frames: [clean("Reunião"), clean("Tela"), clean("Rascunhos")],
          technicalSignals: [],
        },
        profileSignals: [
          { type: "content_strength", value: clean("bastidor e processo"), confidence: "medium", shouldPersistLater: false },
        ],
      };
    case "brand_potential":
      return {
        ...base,
        summary: clean("Vídeo com narrativa de autocuidado que pode receber adaptação orgânica para marca."),
        hook: {
          detected: clean("Abre pelo ritual antes de citar qualquer produto."),
          strength: "strong",
          why: clean("A narrativa já existe sem depender da publi."),
        },
        spokenTopics: [clean("autocuidado"), clean("rotina")],
        visualElements: [clean("produtos de beleza"), clean("bancada"), clean("aplicação no rosto")],
        sceneStructure: [
          { id: "hook", timestampLabel: "00:00", role: "hook", description: clean("Começa pelo ritual diário."), suggestedAdjustment: null },
          { id: "proof", timestampLabel: "00:10", role: "proof", description: clean("Mostra o uso no contexto real."), suggestedAdjustment: null },
        ],
        d2cClassification: {
          format: "reel",
          proposal: "ad_adaptation",
          context: clean("autocuidado"),
          tone: clean("natural"),
          reference: null,
          intent: clean("adaptar para publi orgânica"),
          narrative: clean("rotina orgânica -> produto -> continuidade"),
        },
        diagnosis: {
          strengths: [clean("A presença de produto conversa com uma rotina já existente.")],
          weaknesses: [],
          recommendedAdjustments: [clean("Manter o produto dentro da história, sem quebrar o fluxo.")],
        },
        blueprintSuggestion: {
          whatToPost: clean("Adaptar a rotina para uma publi orgânica com produto integrado."),
          whyThisPath: clean("O vídeo já sustenta contexto antes da marca entrar."),
          howItShouldWork: clean("Preservar rotina, inserir benefício e fechar com uso real."),
          scenes: [clean("Ritual"), clean("Produto em uso"), clean("Resultado percebido")],
        },
        brandMatch: {
          enabled: true,
          territories: [clean("beleza"), clean("autocuidado"), clean("creator economy")],
          whyBrandsWouldFit: clean("A narrativa encaixa produto em hábito real."),
        },
        evidence: { transcript: clean("Essa é minha rotina de autocuidado."), ocr: [], frames: [clean("Produto na bancada")], technicalSignals: [] },
        profileSignals: [{ type: "brand_territory", value: clean("autocuidado"), confidence: "high", shouldPersistLater: false }],
      };
    case "weak_hook":
      return {
        ...base,
        summary: clean("Vídeo com boa matéria-prima, mas abertura lenta."),
        hook: {
          detected: clean("Começa contextualizando antes de mostrar o ponto mais forte."),
          strength: "weak",
          why: clean("A tensão aparece tarde demais para orientar a leitura."),
        },
        spokenTopics: [clean("processo de criação")],
        visualElements: [clean("mesa de trabalho")],
        sceneStructure: [
          { id: "hook", timestampLabel: "00:00", role: "hook", description: clean("Abertura longa antes do conflito."), suggestedAdjustment: clean("Abrir pela pergunta central.") },
        ],
        d2cClassification: {
          format: "reel",
          proposal: "tips",
          context: clean("planejamento"),
          tone: clean("educational"),
          reference: null,
          intent: clean("ensinar"),
          narrative: clean("dúvida -> ajuste -> pauta"),
        },
        diagnosis: {
          strengths: [clean("O desenvolvimento tem material útil.")],
          weaknesses: [clean("A abertura demora para revelar o gancho.")],
          recommendedAdjustments: [clean("Abrir com uma pergunta ou situação mais clara.")],
        },
        blueprintSuggestion: {
          whatToPost: clean("Reestruturar o vídeo em torno da dúvida principal."),
          whyThisPath: clean("O conteúdo melhora quando a tensão aparece cedo."),
          howItShouldWork: clean("Abrir com conflito, desenvolver exemplo e fechar com direção."),
          scenes: [clean("Pergunta"), clean("Exemplo"), clean("Direção")],
        },
        brandMatch: { enabled: false, territories: [], whyBrandsWouldFit: null },
        evidence: { transcript: clean("Antes de mostrar o ponto principal, explico todo o contexto."), ocr: [], frames: [], technicalSignals: [clean("opening_density: low")] },
        profileSignals: [{ type: "creative_gap", value: clean("gancho de abertura"), confidence: "medium", shouldPersistLater: false }],
      };
    case "collab_potential":
      return {
        ...base,
        summary: clean("Vídeo com espaço para troca entre criadores e comunidades."),
        hook: { detected: clean("Abre com uma pergunta que convida contraponto."), strength: "medium", why: clean("A estrutura deixa espaço para outra voz.") },
        spokenTopics: [clean("troca entre comunidades")],
        visualElements: [clean("creator em câmera")],
        sceneStructure: [
          { id: "hook", timestampLabel: "00:00", role: "hook", description: clean("Pergunta inicial abre conversa."), suggestedAdjustment: null },
          { id: "development", timestampLabel: "00:07", role: "development", description: clean("Tema permite resposta complementar."), suggestedAdjustment: null },
        ],
        d2cClassification: {
          format: "reel",
          proposal: "collab_narrative",
          context: clean("comunidade"),
          tone: clean("conversational"),
          reference: null,
          intent: clean("estimular troca"),
          narrative: clean("pergunta -> contraponto -> troca entre comunidades"),
        },
        diagnosis: { strengths: [clean("A pauta admite dois pontos de vista.")], weaknesses: [], recommendedAdjustments: [clean("Definir o papel de cada creator na conversa.")] },
        blueprintSuggestion: {
          whatToPost: clean("Uma collab em dois atos, com pergunta e resposta."),
          whyThisPath: clean("A narrativa ganha força com contraponto."),
          howItShouldWork: clean("Um creator abre a tensão e o outro amplia a leitura."),
          scenes: [clean("Pergunta"), clean("Contraponto"), clean("Síntese")],
        },
        brandMatch: { enabled: false, territories: [], whyBrandsWouldFit: null },
        evidence: { transcript: clean("Quero ouvir como outros criadores lidam com isso."), ocr: [], frames: [], technicalSignals: [] },
        profileSignals: [{ type: "audience_goal", value: clean("troca entre comunidades"), confidence: "medium", shouldPersistLater: false }],
      };
    case "unclear_content":
      return {
        ...base,
        summary: null,
        hook: { detected: null, strength: "unknown", why: null },
        d2cClassification: {
          ...base.d2cClassification,
          format: "unknown",
          proposal: "unknown",
        },
        diagnosis: {
          strengths: [],
          weaknesses: [],
          recommendedAdjustments: [clean("Trazer mais contexto sobre intenção, abertura e caminho desejado.")],
        },
        blueprintSuggestion: {
          whatToPost: null,
          whyThisPath: null,
          howItShouldWork: null,
          scenes: [],
        },
      };
    case "ad_adaptation":
      return {
        ...buildScenario(input, "brand_potential", confidence),
        summary: clean("Vídeo orgânico com espaço para adaptação de publi sem perder a narrativa."),
        d2cClassification: {
          format: "reel",
          proposal: "ad_adaptation",
          context: clean("rotina"),
          tone: clean("organic"),
          reference: null,
          intent: clean("adaptar para publi"),
          narrative: clean("rotina orgânica -> encaixe de produto -> continuidade"),
        },
        diagnosis: {
          strengths: [clean("A história orgânica já sustenta o produto.")],
          weaknesses: [],
          recommendedAdjustments: [clean("Preservar a coerência do conteúdo ao inserir a marca.")],
        },
        blueprintSuggestion: {
          whatToPost: clean("Uma adaptação de publi que mantém a rotina como centro."),
          whyThisPath: clean("A narrativa orgânica permite inserir produto sem quebrar o fluxo."),
          howItShouldWork: clean("Manter contexto, mostrar uso e fechar com continuidade."),
          scenes: [clean("Rotina"), clean("Produto integrado"), clean("Fechamento orgânico")],
        },
      };
    case "skincare_routine":
    default:
      return {
        ...base,
        summary: clean("Rotina de skincare pela manhã com foco em autocuidado."),
        hook: { detected: clean("Começa mostrando a primeira etapa da rotina."), strength: "medium", why: clean("A abertura situa rapidamente o ritual.") },
        spokenTopics: [clean("skincare"), clean("autocuidado")],
        onScreenText: [clean("Rotina da manhã")],
        visualElements: [clean("produtos de skincare"), clean("aplicação no rosto")],
        sceneStructure: [
          { id: "hook", timestampLabel: "00:00", role: "hook", description: clean("Mostra o início da rotina."), suggestedAdjustment: null },
          { id: "development", timestampLabel: "00:06", role: "development", description: clean("Explica as etapas do autocuidado."), suggestedAdjustment: null },
          { id: "closing", timestampLabel: "00:24", role: "closing", description: clean("Fecha com continuidade da rotina."), suggestedAdjustment: null },
        ],
        d2cClassification: {
          format: "reel",
          proposal: "tips",
          context: clean("autocuidado"),
          tone: clean("educational"),
          reference: null,
          intent: clean("educar"),
          narrative: clean("rotina de autocuidado -> dica -> continuidade"),
        },
        diagnosis: {
          strengths: [clean("A rotina é fácil de acompanhar.")],
          weaknesses: [],
          recommendedAdjustments: [clean("Destacar uma dica prática logo no início.")],
        },
        blueprintSuggestion: {
          whatToPost: clean("Um reel de rotina de skincare com dica prática."),
          whyThisPath: clean("O vídeo já combina ritual visual e assunto claro."),
          howItShouldWork: clean("Abrir na rotina, explicar uma dica e fechar com continuidade."),
          scenes: [clean("Início da rotina"), clean("Dica prática"), clean("Fechamento")],
        },
        brandMatch: {
          enabled: true,
          territories: [clean("autocuidado"), clean("skincare")],
          whyBrandsWouldFit: clean("A narrativa conecta produto com hábito real."),
        },
        evidence: {
          transcript: clean("Mostro minha rotina de skincare pela manhã e falo sobre autocuidado."),
          ocr: [clean("Rotina da manhã")],
          frames: [clean("Produtos na bancada"), clean("Aplicação no rosto")],
          technicalSignals: [],
        },
        profileSignals: [{ type: "brand_territory", value: clean("autocuidado"), confidence: "high", shouldPersistLater: false }],
      };
  }
}

export function runVideoNarrativeMockProvider(params: {
  input: VideoNarrativeMockProviderInput;
  options?: VideoNarrativeMockProviderOptions;
}): VideoNarrativeAnalysis {
  const scenario = params.options?.scenario ?? "skincare_routine";
  const confidence = params.options?.confidence ?? (scenario === "unclear_content" ? "low" : "medium");
  return {
    ...buildScenario(params.input, scenario, confidence),
    contentPotentialScan: buildMockContentPotentialScan(scenario),
  };
}

export function runVideoNarrativeMockProviderBatch(params: {
  inputs: VideoNarrativeMockProviderInput[];
  options?: VideoNarrativeMockProviderOptions;
}): VideoNarrativeAnalysis[] {
  return params.inputs.map((input) => runVideoNarrativeMockProvider({ input, options: params.options }));
}
