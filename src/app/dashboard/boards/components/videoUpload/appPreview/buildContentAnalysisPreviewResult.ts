import type { MobileStrategicProfileAnalyzeResult } from "./MobileStrategicProfileAnalyzeFlow";

/**
 * Dados controlados usados somente pelo preview interno de UX. Eles permitem
 * revisar o relatório completo sem upload, chamada de IA ou persistência.
 */
export function buildContentAnalysisPreviewResult(): MobileStrategicProfileAnalyzeResult {
  return {
    savedDiagnosisId: "internal-content-analysis-preview",
    confirmationData: {
      diagnosisSummary: "O vídeo tem uma estrutura clara, mas a promessa precisa aparecer antes.",
      directAnswer: "O conteúdo pode engajar melhor com um ajuste na abertura.",
      contentPotentialScan: {
        band: "promising_with_adjustment",
        confidence: "high",
        basis: "creator_history",
        objective: "complete_reading",
        historyPostsAnalyzed: 18,
        engagementPotential: {
          verdict: "promising_with_adjustment",
          confidence: "high",
          basis: "creator_history",
          summary:
            "A progressão visual e o assunto combinam com seus conteúdos de melhor resposta. O principal risco está no gancho: a promessa fica clara tarde demais.",
          postsCompared: 18,
          historicalWindowDays: 90,
        },
        personalComparisons: [
          {
            dimension: "hook",
            label: "Gancho",
            current: "A rotina começa antes de revelar o ganho para quem assiste.",
            historical: "Seus conteúdos mais fortes mostram a transformação já nos primeiros segundos.",
            impact: "limiting",
            reading: "A entrada atual exige mais paciência do que o seu padrão de melhor desempenho.",
            evidenceCount: 8,
          },
          {
            dimension: "framing",
            label: "Enquadramento",
            current: "Rosto, gesto e produto permanecem legíveis no mesmo plano.",
            historical: "Planos próximos e demonstrações manuais acompanham seus melhores resultados.",
            impact: "positive",
            reading: "O enquadramento preserva a proximidade que costuma funcionar para você.",
            evidenceCount: 11,
          },
          {
            dimension: "subject",
            label: "Assunto",
            current: "A rotina de autocuidado entrega uma aplicação prática.",
            historical: "Conteúdos de rotina com utilidade concreta concentram mais compartilhamentos.",
            impact: "positive",
            reading: "O tema está dentro de um território já validado pelo seu público.",
            evidenceCount: 13,
          },
        ],
        dimensions: {
          openingClarity: {
            status: "weak",
            evidence: "A primeira cena mostra o ritual, mas ainda não revela qual ganho será entregue.",
            adjustment: "Antecipar a transformação e escrevê-la no primeiro frame.",
            window: "0-3s",
          },
          attentionArchitecture: {
            status: "strong",
            evidence: "A alternância entre rosto, produto e aplicação cria progressão visual fácil de acompanhar.",
            adjustment: null,
            window: "0-10s",
          },
          shareImpulse: {
            status: "mixed",
            evidence: "A dica é útil, mas o fechamento ainda não a transforma numa síntese fácil de enviar.",
            adjustment: "Encerrar com uma regra curta que a audiência queira guardar ou compartilhar.",
            window: "full_video",
          },
          promiseDelivery: {
            status: "strong",
            evidence: "O vídeo demonstra o ritual anunciado e chega a uma conclusão prática.",
            adjustment: null,
            window: "full_video",
          },
          narrativeFit: {
            status: "strong",
            evidence: "Autocuidado aplicado à rotina é um território recorrente entre seus conteúdos mais consistentes.",
            adjustment: null,
            window: "creator_history",
          },
        },
        watchedMoments: [
          {
            moment: "opening",
            observation: "Você aparece com o produto em mãos, mas a transformação ainda não é nomeada.",
            impact: "A cena chama atenção visualmente, porém demora a explicar por que vale continuar.",
          },
          {
            moment: "development",
            observation: "A aplicação do produto acompanha a explicação sem disputar atenção com a fala.",
            impact: "O gesto confirma a mensagem e sustenta o ritmo no trecho central.",
          },
          {
            moment: "closing",
            observation: "O resultado aparece, mas a principal aprendizagem permanece apenas na fala.",
            impact: "A conclusão funciona, porém poderia gerar mais salvamentos com uma síntese visível.",
          },
        ],
        practicalDirection: {
          title: "Mostre o resultado antes de começar a rotina",
          action: "Abra com a transformação e use a rotina como prova nos segundos seguintes.",
          example: "O passo que fez minha pele parar de repuxar pela manhã",
        },
        highestImpactAdjustment: "Antecipar a transformação e torná-la legível no primeiro frame.",
        disclaimer: "Leitura estrutural comparada ao histórico disponível — não é garantia de alcance.",
      },
    },
  };
}
