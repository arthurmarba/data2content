import OpenAI from 'openai';
import { z } from 'zod';

import { logger } from '@/app/lib/logger';

import type { DeterministicAnalysisResult, LlmEnhancedPayload, ProposalAnalysisContext } from './types';

const OUTPUT_SCHEMA = z.object({
  analysis: z.string().min(30),
  replyDraft: z.string().min(30),
  rationale: z.array(z.string().min(5)).min(1).max(5),
  playbook: z.array(z.string().min(5)).min(1).max(5),
  cautions: z.array(z.string().min(5)).max(4).optional(),
});

interface LlmEnhancementInput {
  context: ProposalAnalysisContext;
  deterministic: DeterministicAnalysisResult;
  timeoutMs?: number;
}

interface LlmEnhancementOutput {
  payload: LlmEnhancedPayload;
  fallbackUsed: boolean;
  model: string;
}

const SENIOR_NEGOTIATION_SYSTEM_PROMPT = [
  'Você é um negociador sênior de parcerias para creators.',
  'Seu papel é transformar um diagnóstico determinístico em comunicação comercial de alto nível, sem alterar os números fornecidos.',
  'Fale como um consultor didático para um criador leigo, com linguagem simples e direta.',
  '',
  'Regras críticas:',
  '1) Nunca invente números, métricas ou fatos.',
  '2) Nunca altere o veredito, suggestedValue, target, anchor, floor ou gapPercent.',
  '3) Se houver incerteza, assuma postura conservadora e use linguagem condicional.',
  '4) Responda estritamente em JSON válido (sem markdown).',
  '5) Evite jargões técnicos (ex.: target, gap, benchmark, baseline, BATNA).',
  '6) Quando precisar desses conceitos, traduza para linguagem simples (ex.: valor recomendado, diferença, histórico).',
  '7) Evite frases vagas ou corporativas; prefira frases curtas, diretas e didáticas.',
  '8) Sempre deixe claro o que o creator deve responder para a marca na próxima mensagem.',
  '',
  'Qualidade esperada (nível sênior):',
  '- Defender valor com assertividade profissional, sem agressividade.',
  '- Aplicar negociação por princípios: começar com valor inicial claro, pedir contrapartida em ajustes e proteger margem.',
  '- Evitar concessão unilateral; toda concessão deve vir com contrapartida de escopo, prazo ou volume.',
  '- Encerrar com próximo passo objetivo (call curta, aprovação de escopo, cronograma).',
  '',
  'Formato de saída:',
  '- analysis: diagnóstico executivo curto (4-8 linhas), com risco e recomendação prática.',
  '- replyDraft: email pronto para envio, humano e claro.',
  '- rationale/playbook/cautions: bullets curtos, acionáveis e sem repetição.',
].join('\n');

const JARGON_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /target de negocia[cç][aã]o estimado em/gi,
    replacement: 'O valor recomendado para esta proposta fica em',
  },
  { pattern: /target estimado/gi, replacement: 'valor recomendado' },
  { pattern: /\btarget\b/gi, replacement: 'valor recomendado' },
  { pattern: /\bgap\b/gi, replacement: 'diferenca' },
  { pattern: /\bbenchmark(s)?\b/gi, replacement: 'historico de comparacao' },
  { pattern: /\bbaseline\b/gi, replacement: 'referencia inicial' },
  { pattern: /\bBATNA\b/gi, replacement: 'alternativa de negociacao' },
  { pattern: /ancora/gi, replacement: 'valor inicial de referencia' },
  { pattern: /âncora/gi, replacement: 'valor inicial de referencia' },
  { pattern: /concessao/gi, replacement: 'ajuste negociado' },
  { pattern: /concessão/gi, replacement: 'ajuste negociado' },
  { pattern: /concessoes/gi, replacement: 'ajustes negociados' },
  { pattern: /concessões/gi, replacement: 'ajustes negociados' },
  { pattern: /taxa hist[oó]rica de fechamento:\s*0(?:[.,]\d+)?%\.?/gi, replacement: 'Você ainda não fechou propostas parecidas por aqui.' },
  {
    pattern: /taxa hist[oó]rica de fechamento:\s*([0-9]+(?:[.,]\d+)?)%\.?/gi,
    replacement: 'No seu histórico, cerca de $1% das propostas parecidas viraram parceria.',
  },
  { pattern: /primeiro retorno/gi, replacement: 'primeira mensagem' },
  { pattern: /aceite/gi, replacement: 'aceitação' },
  { pattern: /extra de alto valor percebido/gi, replacement: 'extra simples que agrega valor' },
  { pattern: /propostas similares/gi, replacement: 'propostas parecidas' },
];

function simplifyForCreator(text: string): string {
  let normalized = text;
  for (const rule of JARGON_REPLACEMENTS) {
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }
  return normalized.replace(/\s{2,}/g, ' ').trim();
}

function simplifyEmailForCreator(text: string): string {
  let normalized = text.replace(/\r\n/g, '\n');
  for (const rule of JARGON_REPLACEMENTS) {
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }

  normalized = normalized
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized;
}

function formatReplyDraftParagraphs(replyDraft: string): string {
  let text = replyDraft.replace(/\r\n/g, '\n').trim();
  if (!text) return text;

  if (!/\n\s*\n/.test(text)) {
    const sentences = text.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
    if (sentences.length > 1) {
      const chunks: string[] = [];
      for (let i = 0; i < sentences.length; i += 2) {
        chunks.push(sentences.slice(i, i + 2).join(' '));
      }
      text = chunks.join('\n\n');
    }
  }

  text = text
    .replace(/\n?(—\s)/g, '\n\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function ensureMediaKitInReplyDraft(replyDraft: string, mediaKitPublicUrl: string | null | undefined): string {
  const normalizedReply = formatReplyDraftParagraphs(replyDraft.trim());
  if (!mediaKitPublicUrl) return normalizedReply;
  const normalizedUrl = mediaKitPublicUrl.trim();
  if (!normalizedUrl) return normalizedReply;

  const hasExactUrl = normalizedReply.toLowerCase().includes(normalizedUrl.toLowerCase());
  const hasRealtimeMetricsMessage = /m[eé]tricas?\s+em\s+tempo\s+real/i.test(normalizedReply);

  if (hasExactUrl && hasRealtimeMetricsMessage) {
    return normalizedReply;
  }

  const mediaKitParagraph = hasExactUrl
    ? 'No meu mídia kit público, vocês acompanham minhas métricas em tempo real.'
    : `Também deixo meu mídia kit público aqui: ${normalizedUrl}. Por ele, vocês acompanham minhas métricas em tempo real.`;

  return formatReplyDraftParagraphs(`${normalizedReply}\n\n${mediaKitParagraph}`.trim());
}

function normalizePayloadForCreator(
  payload: LlmEnhancedPayload,
  mediaKitPublicUrl?: string | null
): LlmEnhancedPayload {
  return {
    analysis: simplifyForCreator(payload.analysis),
    replyDraft: ensureMediaKitInReplyDraft(simplifyEmailForCreator(payload.replyDraft), mediaKitPublicUrl),
    rationale: payload.rationale.map(simplifyForCreator),
    playbook: payload.playbook.map(simplifyForCreator),
    cautions: payload.cautions.map(simplifyForCreator),
  };
}

function buildFallbackPayload(result: DeterministicAnalysisResult): LlmEnhancedPayload {
  return {
    analysis: result.analysis,
    replyDraft: result.replyDraft,
    rationale: result.analysisV2.rationale,
    playbook: result.analysisV2.playbook,
    cautions: result.analysisV2.cautions,
  };
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('LLM_EMPTY_OUTPUT');
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('LLM_JSON_NOT_FOUND');
    }
    const candidate = withoutFence.slice(start, end + 1);
    return JSON.parse(candidate);
  }
}

function buildUserPrompt(context: ProposalAnalysisContext, deterministic: DeterministicAnalysisResult): string {
  const verdictTactics: Record<string, string[]> = {
    aceitar_com_extra: [
      'Fechar rápido mantendo valor e incluir um extra simples que ajude o resultado da campanha.',
      'Evitar desconto desnecessário e conduzir para aprovação.',
    ],
    aceitar: [
      'Conduzir para fechamento imediato com datas e próximos passos claros.',
      'Evitar rediscussão de preço; focar execução e resultado.',
    ],
    ajustar: [
      'Abrir com valor inicial e sustentar o preço com escopo e resultados.',
      'Fazer ajuste de preço apenas com contrapartida (ex.: reduzir escopo ou ampliar pacote).',
    ],
    ajustar_escopo: [
      'Apresentar duas opções: pacote completo no valor recomendado e pacote reduzido no orçamento atual.',
      'Não absorver diferença grande sem ajustar claramente os entregáveis.',
    ],
    coletar_orcamento: [
      'Qualificar orçamento, objetivo e prazo antes de precificar.',
      'Evitar proposta fechada sem mínimo de contexto comercial.',
    ],
  };

  const payload = {
    objective: 'melhorar clareza e qualidade de negociacao mantendo valores do motor deterministico',
    tone: 'assertiva profissional',
    locale: 'pt-BR',
    brand: context.proposal.brandName,
    campaignTitle: context.proposal.campaignTitle ?? null,
    currency: context.proposal.currency,
    creatorAssets: {
      mediaKitPublicUrl: context.proposal.mediaKitPublicUrl,
    },
    deterministic: {
      verdict: deterministic.verdict,
      suggestedValue: deterministic.suggestedValue,
      pricing: deterministic.analysisV2.pricing,
      confidence: deterministic.analysisV2.confidence,
      rationale: deterministic.analysisV2.rationale,
      playbook: deterministic.analysisV2.playbook,
      cautions: deterministic.analysisV2.cautions,
    },
    businessContext: {
      closeRate: context.benchmarks.closeRate,
      dealCountLast180d: context.benchmarks.dealCountLast180d,
      similarProposalCount: context.benchmarks.similarProposalCount,
      contextSignals: context.contextSignals,
      pricingCore: {
        source: context.pricingCore.source,
        confidence: context.pricingCore.confidence,
        resolvedDefaults: context.pricingCore.resolvedDefaults,
        limitations: context.pricingCore.limitations,
      },
    },
    tacticalFocus: verdictTactics[deterministic.verdict] ?? [],
    constraints: [
      'Nao invente numeros.',
      'Use apenas os valores numéricos fornecidos.',
      'Nao mude veredito nem suggestedValue.',
      'Retorne JSON valido sem markdown.',
      'analysis deve ser curto (4-8 linhas) e acionavel.',
      'replyDraft deve ser um email pronto para enviar.',
      'No replyDraft, mantenha 4-6 paragrafos curtos.',
      'No replyDraft, separe paragrafos com uma linha em branco (formato de email).',
      'No replyDraft, inclua chamada para proximo passo objetivo.',
      'Use concessoes condicionais quando houver ajuste de valor.',
      'Evite termos tecnicos e escreva como conversa com criador leigo.',
      'Nao use palavras em ingles quando houver equivalente claro em portugues.',
      'Evite frases como "primeiro retorno", "valor percebido" e "taxa historica de fechamento".',
      'Escreva o email com tom simpatico e objetivo, em linguagem clara.',
      'Se mediaKitPublicUrl existir, inclua exatamente esse link no replyDraft e explique em 1 frase que a marca pode acompanhar metricas em tempo real por ele.',
    ],
  };

  return JSON.stringify(payload);
}

export async function generateLlmEnhancedAnalysis(
  input: LlmEnhancementInput
): Promise<LlmEnhancementOutput> {
  const { context, deterministic } = input;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const timeoutMs = input.timeoutMs ?? Number(process.env.PROPOSAL_ANALYSIS_LLM_TIMEOUT_MS || 8000);

  if (!process.env.OPENAI_API_KEY) {
    return {
      payload: normalizePayloadForCreator(buildFallbackPayload(deterministic), context.proposal.mediaKitPublicUrl),
      fallbackUsed: true,
      model,
    };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await openai.chat.completions.create(
      {
        model,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: SENIOR_NEGOTIATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildUserPrompt(context, deterministic),
          },
        ],
      },
      {
        signal: controller.signal,
      }
    );

    const text = completion.choices?.[0]?.message?.content ?? '';
    const parsed = OUTPUT_SCHEMA.parse(extractJsonObject(text));

    return {
      payload: normalizePayloadForCreator({
        analysis: parsed.analysis,
        replyDraft: parsed.replyDraft,
        rationale: parsed.rationale,
        playbook: parsed.playbook,
        cautions: parsed.cautions ?? [],
      }, context.proposal.mediaKitPublicUrl),
      fallbackUsed: false,
      model,
    };
  } catch (error) {
    logger.warn('[proposalAnalysisV2][llm] fallback applied', {
      reason: error instanceof Error ? error.message : 'unknown_error',
      proposalId: context.proposal.id,
      creatorId: context.creator.id,
    });

    return {
      payload: normalizePayloadForCreator(buildFallbackPayload(deterministic), context.proposal.mediaKitPublicUrl),
      fallbackUsed: true,
      model,
    };
  } finally {
    clearTimeout(timeout);
  }
}
