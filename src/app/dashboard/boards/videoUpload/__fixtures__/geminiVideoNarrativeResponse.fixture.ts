import type { VideoNarrativeAiAnalysis } from "../videoNarrativeAiProviderTypes";

export const geminiVideoNarrativeResponseFixture: VideoNarrativeAiAnalysis = {
  mainNarrative: "Rotina prática que transforma bastidor em autoridade acessível.",
  whatVideoCommunicates: "O creator mostra método, cuidado e clareza na forma de explicar.",
  creatorIntention: "Reforçar confiança e aproximar a audiência de uma rotina replicável.",
  strategicReading: "O vídeo posiciona o creator como alguém que simplifica decisões e guia a audiência com segurança.",
  strengthPoint: "A força está na demonstração concreta do processo e na linguagem direta.",
  attentionPoint: "O início pode ganhar mais contexto para deixar a promessa do conteúdo evidente.",
  recommendedAdjustment: "Abrir com a tensão principal antes de mostrar o passo a passo.",
  suggestedHook: "Antes de seguir essa rotina, entenda o erro que muda o resultado.",
  commercialPotential: "Pode atrair marcas ligadas a rotina, cuidado e educação prática, como oportunidade futura.",
  nextActions: [
    "Testar um gancho com contraste claro.",
    "Repetir o formato com uma pergunta inicial.",
    "Fechar com um próximo passo simples.",
  ],
  creatorSignals: ["Didática prática", "Autoridade acessível", "Bastidor como prova"],
  brandTerritories: ["Cuidados pessoais", "Educação prática", "Rotina inteligente"],
  collabOpportunities: ["Collabs com creators de rotina", "Séries com especialistas convidados"],
  evidenceAnchors: {
    speechQuotes: [
      {
        quote: "rapidinho",
        source: "creator_spoken",
        quoteRole: "hook",
        whyItMatters: "A palavra cria uma promessa pequena para a abertura.",
        chapterHint: "pattern",
      },
    ],
    sceneAnchors: [
      {
        description: "A cena começa como rotina simples e vira explicação de escolha.",
        source: "model_observed",
        momentRole: "turning_point",
        whyItMatters: "A virada sustenta a leitura de autoridade acessível.",
        chapterHint: "tension",
      },
    ],
    creatorIntentAnchor: {
      source: "creator_goal",
      statedGoal: "Reforçar confiança e aproximar a audiência.",
      interpretedGoal: "Testar se a rotina prática pode virar autoridade acessível.",
      whyItMatters: "A intenção muda a leitura do gancho para entregar confiança antes da explicação.",
    },
    profilePatternAnchors: [],
    instagramAnchors: [],
  },
};

export const geminiVideoNarrativeRawJsonFixture = JSON.stringify(geminiVideoNarrativeResponseFixture);
