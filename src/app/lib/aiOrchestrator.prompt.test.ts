/** @jest-environment node */
import { buildDirectAlertPrompt } from '@/app/lib/aiOrchestrator';

describe('buildDirectAlertPrompt', () => {
  it('personalizes using the provided name without hardcoded fallbacks', () => {
    const prompt = buildDirectAlertPrompt('Maria', 'Alcance caiu 20%');
    expect(prompt).toContain('Maria');
    expect(prompt).not.toMatch(/Arthur/i);
  });

  it('falls back to a generic creator name when none is provided', () => {
    const prompt = buildDirectAlertPrompt('', 'Alcance está estável');
    expect(prompt).toContain('criador');
  });
});
