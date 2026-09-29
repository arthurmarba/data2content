/** @jest-environment node */
import { z } from 'zod';
import {
  buildClaudeServerInstructions,
  omitDirectiveKeysFromSchema,
  sanitizeToolResultForClaude,
  stripAssistantDirectives,
} from './claudeDirectoryPolicy';

// Verbos e campos que dirigiam o assistente. O revisor da Anthropic recusou
// instruções com eles; a lista é a régua de que não voltaram.
const DIRECTIVE_WORDS = /\b(siga|inclua|mostre|mencione|apresente|nunca promova|convite|conversationPolicy|closingReminder|onboardingPrompt)\b/i;

describe('política do Claude', () => {
  it.each([true, false])('instruções cabem no portal e descrevem sem ordenar (publis=%s)', (radar) => {
    const text = buildClaudeServerInstructions(radar);
    // O portal cortou em ~2.040 caracteres a versão anterior.
    expect(text.length).toBeLessThan(1900);
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThan(1950);
    expect(text).not.toMatch(DIRECTIVE_WORDS);
    expect(text.includes('find_campaign_opportunities')).toBe(radar);
  });

  it('tira os campos de ordem em qualquer profundidade e preserva o resto', () => {
    const cleaned = stripAssistantDirectives({
      a: 1,
      usage: ['x'],
      save: { nextTool: 'save_script', instruction: 'Mostre o rascunho' },
      list: [{ nextAction: 'open', keep: true }],
      analysisContract: ['Fale em saldo'],
      responseContract: { safeSummary: 'resumo', rules: ['Mostre'], nextStep: 'Escreva' },
      adaptationGuidance: { borrow: ['A lógica de abertura'], avoid: 'Não copie' },
      voiceReview: { rubric: ['Explique'], limitations: ['Heurística'] },
    });
    expect(cleaned).toEqual({
      a: 1,
      save: { nextTool: 'save_script' },
      list: [{ keep: true }],
      responseContract: { safeSummary: 'resumo' },
      adaptationGuidance: { borrow: ['A lógica de abertura'] },
      voiceReview: { limitations: ['Heurística'] },
    });
  });

  it('limpa também o texto em JSON e deixa texto comum intacto', () => {
    const result = sanitizeToolResultForClaude({
      content: [
        { type: 'text', text: JSON.stringify({ ok: true, closingReminder: { url: 'x' } }) },
        { type: 'text', text: 'texto livre' },
      ],
      structuredContent: { ok: true, conversationPolicy: {} },
    });
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({ ok: true });
    expect((result.content[1] as { text: string }).text).toBe('texto livre');
    expect(result.structuredContent).toEqual({ ok: true });
  });

  it('o formato declarado perde os mesmos campos, inclusive aninhados, e segue validando', () => {
    const schema = z.object({
      ok: z.boolean(),
      usage: z.array(z.string()),
      save: z.object({ nextTool: z.literal('save_script'), instruction: z.string() }),
      items: z.array(z.object({ id: z.string(), instruction: z.string() })).optional(),
    }).passthrough();
    const omitted = omitDirectiveKeysFromSchema(schema);
    const sample = stripAssistantDirectives({
      ok: true, usage: ['x'], save: { nextTool: 'save_script', instruction: 'y' }, items: [{ id: '1', instruction: 'z' }],
    });
    expect(omitted.safeParse(sample).success).toBe(true);
    expect(schema.safeParse(sample).success).toBe(false);
    expect(Object.keys((omitted as z.AnyZodObject).shape)).toEqual(['ok', 'save', 'items']);
  });
});
