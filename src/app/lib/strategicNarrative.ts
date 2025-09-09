import OpenAI from 'openai';
import type { StrategicReport, StrategicNarrative } from 'types/StrategicReport';
import { logger } from '@/app/lib/logger';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export async function generateStrategicNarrative(userName: string, report: StrategicReport): Promise<StrategicNarrative | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const system = `Você é um estrategista de conteúdo. Gere uma narrativa curta (intro, 2-4 parágrafos e conclusão) com tom humano e direto.
Regras críticas:
- Não afirme números sem citá-los dos itens de 'keyInsights' (uplift/n, métrica) ou das 'evidenceRefs'.
- Sempre que citar um número, inclua entre parênteses a referência (ex.: ref: time_bucket_4_20h) e o n quando existir.
- Não invente dados. Se algo não existir no JSON, não mencione.
- Seja conciso e prático; evite jargões e repetições.
`;

  const prompt = {
    userName,
    summary: report.summary,
    keyInsights: report.keyInsights,
    correlations: report.correlations,
    scriptSuggestions: report.scriptSuggestions,
    weeklyPlan: report.weeklyPlan,
  };

  const user = `Gere uma narrativa para ${userName} com base no JSON abaixo.
Formato de saída (JSON): { intro: string, body: string[], conclusion: string }
JSON:
${JSON.stringify(prompt, null, 2)}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 650,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    // Try parse JSON; if plain text, wrap as minimal narrative
    try {
      const parsed = JSON.parse(text) as StrategicNarrative;
      if (parsed && parsed.intro && Array.isArray(parsed.body) && parsed.conclusion) return parsed;
    } catch {/* fallthrough */}
    return {
      intro: `Resumo estratégico para ${userName}.`,
      body: [text],
      conclusion: 'Coloque em prática os próximos passos e monitore os resultados.',
    };
  } catch (e) {
    logger.warn('[strategicNarrative] OpenAI call failed', e);
    return null;
  }
}

