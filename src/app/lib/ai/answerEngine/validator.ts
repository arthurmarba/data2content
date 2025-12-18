import type { ContextPack } from './types';

const URL_REGEX = /https?:\/\/[^\s)>\]]+/gi;

function buildThresholdExplanation(pack: ContextPack) {
  const thr = pack.policy.thresholds;
  const parts: string[] = [];
  parts.push(`mínimo de interações: ${thr.effectiveInteractions}`);
  if (thr.effectiveEr) {
    const erPercent = (thr.effectiveEr * 100).toFixed(2);
    parts.push(`ER/reach mínimo: ${erPercent}%`);
  }
  if (pack.policy.formatLocked) {
    parts.push(`formato: ${pack.policy.formatLocked}`);
  }
  if (pack.policy.metricsRequired?.length) {
    parts.push(`métricas obrigatórias: ${pack.policy.metricsRequired.join(', ')}`);
  }
  return parts.join(' | ');
}

function buildFallback(pack: ContextPack, reason: string) {
  const thresholdInfo = buildThresholdExplanation(pack);
  const relaxStep = pack.relaxApplied?.[0]?.step;
  const base = `Não encontrei posts acima do critério (${thresholdInfo}).`;
  const askRelax = relaxStep
    ? `Relax aplicado: ${relaxStep}. Quer que eu relaxe mais um pouco?`
    : 'Posso relaxar em ~10-15% ou considerar outro formato. Quer tentar?';
  const action = pack.policy.formatLocked
    ? `Dica: poste mais 5 ${pack.policy.formatLocked}s nos próximos dias para calibrar a mediana.`
    : 'Dica: poste mais 5 conteúdos esta semana para calibrar o baseline.';
  if (reason === 'empty') {
    return `${base}\n${askRelax}\n${action}`;
  }
  return `${base}\nRemovi recomendações inconsistentes. ${askRelax}\n${action}`;
}

export interface ValidationResult {
  sanitizedResponse: string;
  badRecoPrevented: number;
  fallbackUsed: boolean;
  reason?: string;
}

export function validateAnswerWithContext(
  response: string,
  pack: ContextPack | null | undefined,
): ValidationResult {
  if (!pack) return { sanitizedResponse: response, badRecoPrevented: 0, fallbackUsed: false };
  if (!pack.top_posts.length) {
    return { sanitizedResponse: buildFallback(pack, 'empty'), badRecoPrevented: 0, fallbackUsed: true, reason: 'empty_pack' };
  }

  const allowedUrls = new Set(
    pack.top_posts
      .map((p) => (p.permalink || '').toLowerCase())
      .filter(Boolean),
  );

  const lines = (response || '').split('\n');
  const filtered: string[] = [];
  let badRecoPrevented = 0;
  for (const line of lines) {
    const urls = [...line.matchAll(URL_REGEX)].map((m) => (m[0] || '').toLowerCase());
    if (!urls.length) {
      filtered.push(line);
      continue;
    }
    const allAllowed = urls.every((u) => allowedUrls.has(u));
    if (!allAllowed) {
      badRecoPrevented += 1;
      continue;
    }
    filtered.push(line);
  }

  let sanitized = filtered.join('\n').trim();
  if (!sanitized) {
    sanitized = buildFallback(pack, 'removed_all');
  }

  return {
    sanitizedResponse: sanitized,
    badRecoPrevented,
    fallbackUsed: badRecoPrevented > 0,
    reason: badRecoPrevented > 0 ? 'removed_invalid_recos' : undefined,
  };
}
