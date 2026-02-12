import { formatCurrencySafely } from '@/utils/currency';
import type { ProposalSuggestionType, ProposalConfidenceLabel } from '@/types/proposals';

import type { DeterministicAnalysisResult, ProposalAnalysisContext } from './types';

const TARGET_WEIGHTS = {
  calcTarget: 0.5,
  dealTarget: 0.3,
  similarProposalTarget: 0.2,
} as const;

const roundToHundreds = (value: number | null): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value / 100) * 100;
};

const roundToTwo = (value: number | null): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function computeTargetValue(context: ProposalAnalysisContext): number | null {
  const weightedEntries = [
    { key: 'calcTarget', weight: TARGET_WEIGHTS.calcTarget, value: context.benchmarks.calcTarget },
    { key: 'dealTarget', weight: TARGET_WEIGHTS.dealTarget, value: context.benchmarks.dealTarget },
    {
      key: 'similarProposalTarget',
      weight: TARGET_WEIGHTS.similarProposalTarget,
      value: context.benchmarks.similarProposalTarget,
    },
  ] as const;

  let numerator = 0;
  let denominator = 0;

  for (const item of weightedEntries) {
    if (typeof item.value === 'number' && Number.isFinite(item.value) && item.value > 0) {
      numerator += item.value * item.weight;
      denominator += item.weight;
    }
  }

  if (denominator === 0) return null;
  return numerator / denominator;
}

function classifyVerdict(
  offered: number | null,
  target: number | null
): { verdict: ProposalSuggestionType; gapPercent: number | null } {
  if (offered === null) {
    return { verdict: 'coletar_orcamento', gapPercent: null };
  }

  if (target === null || target <= 0) {
    return { verdict: 'ajustar', gapPercent: null };
  }

  const gapPercent = ((offered - target) / target) * 100;

  if (gapPercent >= 18) {
    return { verdict: 'aceitar_com_extra', gapPercent };
  }

  if (gapPercent >= -10) {
    return { verdict: 'aceitar', gapPercent };
  }

  if (gapPercent >= -30) {
    return { verdict: 'ajustar', gapPercent };
  }

  return { verdict: 'ajustar_escopo', gapPercent };
}

function buildConfidence(context: ProposalAnalysisContext): { score: number; label: ProposalConfidenceLabel } {
  const signalCount = [
    context.benchmarks.calcTarget,
    context.benchmarks.dealTarget,
    context.benchmarks.similarProposalTarget,
  ].filter((item) => typeof item === 'number').length;

  const signalScore = (signalCount / 3) * 0.7;
  const closeRateScore = context.benchmarks.closeRate !== null ? 0.15 : 0;
  const deliverablesScore = context.proposal.deliverables.length > 0 ? 0.1 : 0;
  const budgetScore = context.proposal.offeredBudget !== null ? 0.05 : 0;

  const score = clamp(signalScore + closeRateScore + deliverablesScore + budgetScore, 0, 1);

  if (score >= 0.75) {
    return { score, label: 'alta' };
  }

  if (score >= 0.5) {
    return { score, label: 'media' };
  }

  return { score, label: 'baixa' };
}

function buildRationale(
  context: ProposalAnalysisContext,
  target: number | null,
  gapPercent: number | null,
  verdict: ProposalSuggestionType
): string[] {
  const rationale: string[] = [];

  if (target !== null) {
    rationale.push(
      `Pelos seus dados mais recentes, o valor recomendado fica perto de ${formatCurrencySafely(target, context.proposal.currency)}.`
    );
  } else {
    rationale.push('Ainda faltam dados para sugerir um valor com mais precisão.');
  }

  if (gapPercent !== null) {
    const direction = gapPercent >= 0 ? 'acima' : 'abaixo';
    rationale.push(
      `A oferta da marca está ${Math.abs(gapPercent).toFixed(1)}% ${direction} do valor recomendado.`
    );
  }

  if (context.benchmarks.closeRate !== null) {
    if (context.benchmarks.closeRate <= 0) {
      rationale.push('Até agora, você ainda não fechou propostas parecidas aqui na plataforma.');
    } else {
      const percent = (context.benchmarks.closeRate * 100).toFixed(1).replace('.', ',');
      rationale.push(
        `No seu histórico, cerca de ${percent}% das propostas parecidas viram parceria fechada.`
      );
    }
  }

  if (verdict === 'ajustar_escopo') {
    rationale.push(
      'A diferença está grande: normalmente é melhor ajustar o escopo do que baixar demais o valor.'
    );
  }

  return rationale;
}

function buildPlaybook(
  verdict: ProposalSuggestionType,
  target: number | null,
  anchor: number | null,
  floor: number | null,
  currency: string
): string[] {
  const playbook: string[] = [];

  switch (verdict) {
    case 'aceitar_com_extra':
      playbook.push('Se topar a proposta, já responda com as datas e o que será entregue.');
      playbook.push('Você pode incluir um extra simples (ex.: stories de bastidor) para aumentar o valor da campanha.');
      break;
    case 'aceitar':
      playbook.push('A proposta está em uma boa faixa: avance para fechar com datas claras.');
      playbook.push('Use um ou dois resultados seus para passar segurança na entrega.');
      break;
    case 'ajustar':
      if (anchor !== null) {
        playbook.push(`Comece pedindo ${formatCurrencySafely(anchor, currency)} para abrir a conversa com folga.`);
      }
      if (target !== null) {
        playbook.push(`O melhor ponto para fechar é perto de ${formatCurrencySafely(target, currency)}.`);
      }
      if (floor !== null) {
        playbook.push(
          `Se cair abaixo de ${formatCurrencySafely(floor, currency)}, peça redução de escopo para não sair no prejuízo.`
        );
      }
      break;
    case 'ajustar_escopo':
      playbook.push(
        'Ofereça duas opções: pacote completo no valor recomendado ou pacote menor no orçamento atual.'
      );
      if (target !== null) {
        playbook.push(`Para o pacote completo, mostre referência de ${formatCurrencySafely(target, currency)}.`);
      }
      break;
    case 'coletar_orcamento':
      playbook.push('Antes de precificar, pergunte a faixa de investimento e o prazo da campanha.');
      playbook.push('Também peça objetivo principal (venda, alcance ou posicionamento).');
      break;
    default:
      playbook.push('Mantenha a conversa simples: valor, escopo e prazo bem definidos.');
      break;
  }

  return playbook;
}

function buildCautions(
  context: ProposalAnalysisContext,
  verdict: ProposalSuggestionType,
  confidence: ProposalConfidenceLabel
): string[] {
  const cautions: string[] = [];

  if (confidence === 'baixa') {
    cautions.push('Temos pouca segurança nos dados: confirme informações antes de bater o martelo.');
  }

  if (context.benchmarks.similarProposalCount < 3) {
    cautions.push('Ainda temos poucas propostas parecidas para comparar no histórico.');
  }

  if (verdict === 'coletar_orcamento') {
    cautions.push('Evite passar preço final sem confirmar escopo, prazo e orçamento da marca.');
  }

  return cautions;
}

function buildLegacyAnalysis(
  context: ProposalAnalysisContext,
  verdict: ProposalSuggestionType,
  target: number | null,
  gapPercent: number | null,
  confidenceLabel: ProposalConfidenceLabel,
  anchor: number | null,
  floor: number | null
): string {
  const targetText =
    target !== null ? formatCurrencySafely(target, context.proposal.currency) : 'indisponível com os dados atuais';
  const gapText =
    gapPercent !== null
      ? `${Math.abs(gapPercent).toFixed(1)}% ${gapPercent >= 0 ? 'acima' : 'abaixo'}`
      : 'não calculável';

  const verdictLabel: Record<ProposalSuggestionType, string> = {
    aceitar: 'Pode fechar',
    ajustar: 'Pedir ajuste de valor',
    aceitar_com_extra: 'Pode fechar e pedir extra',
    ajustar_escopo: 'Negociar escopo',
    coletar_orcamento: 'Pedir orçamento da marca',
  };

  const lines = [
    '🧩 Diagnóstico do Mobi',
    `Veredito: ${verdictLabel[verdict]}.`,
    `Valor recomendado: ${targetText}.`,
    `Diferença da oferta para o recomendado: ${gapText}.`,
    `Nível de segurança desta recomendação: ${confidenceLabel}.`,
  ];

  if (anchor !== null && floor !== null) {
    lines.push(
      `Faixa que faz sentido na negociação: ${formatCurrencySafely(floor, context.proposal.currency)} a ${formatCurrencySafely(anchor, context.proposal.currency)}.`
    );
  }

  lines.push('Quer que eu estruture a contraproposta final para você enviar agora?');

  return lines.join('\n');
}

function buildLegacyReplyDraft(
  context: ProposalAnalysisContext,
  verdict: ProposalSuggestionType,
  target: number | null,
  anchor: number | null
): string {
  const creatorName = context.creator.name?.trim() || 'Seu nome';
  const handle = context.creator.handle?.trim()
    ? context.creator.handle?.trim().startsWith('@')
      ? context.creator.handle.trim()
      : `@${context.creator.handle.trim()}`
    : null;

  const greeting = `Oi, pessoal da ${context.proposal.brandName}! Tudo bem?`;

  const opening = context.proposal.campaignTitle
    ? `Recebi a proposta “${context.proposal.campaignTitle}” e gostei da direção da campanha.`
    : 'Recebi a proposta e gostei da direção da campanha.';

  let negotiationParagraph = '';
  if (verdict === 'aceitar_com_extra') {
    negotiationParagraph =
      'Podemos seguir com o valor proposto e avançar com esse escopo. Se fizer sentido, também posso incluir um extra simples para potencializar o resultado da campanha.';
  } else if (verdict === 'aceitar') {
    negotiationParagraph =
      'Podemos confirmar esse valor e seguir com a campanha. Se aprovarem, já alinhamos as datas e os entregáveis para iniciar.';
  } else if (verdict === 'ajustar') {
    const anchorText = anchor !== null ? formatCurrencySafely(anchor, context.proposal.currency) : null;
    const targetText = target !== null ? formatCurrencySafely(target, context.proposal.currency) : null;
    negotiationParagraph =
      targetText !== null
        ? `Para esse escopo completo, o valor recomendado fica em ${targetText}. ${
            anchorText
              ? `Posso começar em ${anchorText} e buscar fechamento perto desse valor, mantendo a qualidade da entrega.`
              : 'Com esse ajuste, consigo manter a qualidade da entrega e o resultado esperado.'
          }`
        : 'Para manter a qualidade da entrega, preciso de um ajuste de valor para este escopo.';
  } else if (verdict === 'ajustar_escopo') {
    const targetText = target !== null ? formatCurrencySafely(target, context.proposal.currency) : null;
    negotiationParagraph =
      targetText !== null
        ? `No escopo completo, o valor recomendado fica em ${targetText}. Se preferirem manter o orçamento atual, eu envio uma versão mais enxuta do escopo.`
        : 'Para manter o orçamento atual, recomendo reduzir escopo para preservar qualidade da entrega.';
  } else {
    negotiationParagraph =
      'Para eu te passar um valor justo, vocês podem compartilhar a faixa de orçamento e o prazo da campanha?';
  }

  const mediaKitParagraph = context.proposal.mediaKitPublicUrl
    ? `Também deixo meu mídia kit público aqui: ${context.proposal.mediaKitPublicUrl}. Por ele, vocês acompanham minhas métricas em tempo real.`
    : null;
  const close = 'Se fizer sentido para vocês, seguimos com os próximos passos.';

  const signature = [
    `— ${creatorName}`,
    handle ? `${handle} | via Data2Content` : 'via Data2Content',
  ].join('\n');

  return [greeting, opening, negotiationParagraph, mediaKitParagraph, close, signature].filter(Boolean).join('\n\n');
}

export function runDeterministicProposalAnalysis(
  context: ProposalAnalysisContext
): DeterministicAnalysisResult {
  const targetValue = computeTargetValue(context);
  const offeredBudget = context.proposal.offeredBudget;

  const { verdict, gapPercent } = classifyVerdict(offeredBudget, targetValue);

  const roundedTarget = roundToHundreds(targetValue);
  const anchor = roundedTarget !== null ? roundToHundreds(roundedTarget * 1.18) : null;
  const counter = roundedTarget !== null ? roundToHundreds(roundedTarget * 1.05) : null;
  const floor = roundedTarget !== null ? roundToHundreds(roundedTarget * 0.97) : null;

  const confidence = buildConfidence(context);
  const rationale = buildRationale(context, roundedTarget, gapPercent, verdict);
  const playbook = buildPlaybook(verdict, roundedTarget, anchor, floor, context.proposal.currency);
  const cautions = buildCautions(context, verdict, confidence.label);

  let suggestedValue: number | null = null;
  switch (verdict) {
    case 'aceitar_com_extra':
      suggestedValue = offeredBudget ?? counter ?? roundedTarget;
      break;
    case 'aceitar':
      suggestedValue = offeredBudget ?? roundedTarget;
      break;
    case 'ajustar':
      suggestedValue = counter ?? roundedTarget ?? offeredBudget;
      break;
    case 'ajustar_escopo':
      suggestedValue = roundedTarget ?? floor ?? offeredBudget;
      break;
    case 'coletar_orcamento':
      suggestedValue = null;
      break;
    default:
      suggestedValue = offeredBudget;
      break;
  }

  const analysis = buildLegacyAnalysis(
    context,
    verdict,
    roundedTarget,
    gapPercent,
    confidence.label,
    anchor,
    floor
  );

  const replyDraft = buildLegacyReplyDraft(context, verdict, roundedTarget, anchor);

  return {
    verdict,
    suggestionType: verdict,
    suggestedValue: roundToHundreds(suggestedValue),
    targetValue: roundedTarget,
    analysis,
    replyDraft,
    analysisV2: {
      verdict,
      confidence: {
        score: roundToTwo(confidence.score) ?? 0,
        label: confidence.label,
      },
      pricing: {
        currency: context.proposal.currency,
        offered: offeredBudget,
        target: roundedTarget,
        anchor,
        floor,
        gapPercent: roundToTwo(gapPercent),
      },
      rationale,
      playbook,
      cautions,
    },
  };
}
