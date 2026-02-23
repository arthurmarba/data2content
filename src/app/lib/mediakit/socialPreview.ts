export interface MediaKitPreviewCopyInput {
  displayName: string;
  username?: string | null;
  followersCount?: unknown;
  mediaCount?: unknown;
  biography?: string | null;
}

const COMPACT_PT_BR = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const INTEGER_PT_BR = new Intl.NumberFormat('pt-BR');

function truncateText(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function normalizePreviewUsername(raw?: string | null): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^@+/, '');
  return cleaned ? cleaned : null;
}

export function toNonNegativeInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value);
}

export function formatCompactCount(value: unknown): string | null {
  const parsed = toNonNegativeInt(value);
  if (parsed === null) return null;
  return COMPACT_PT_BR.format(parsed);
}

export function formatIntegerCount(value: unknown): string | null {
  const parsed = toNonNegativeInt(value);
  if (parsed === null) return null;
  return INTEGER_PT_BR.format(parsed);
}

export function buildMediaKitMetaTitle(displayName: string, username?: string | null): string {
  const safeName = displayName?.trim() || 'Criador';
  const normalizedUsername = normalizePreviewUsername(username);
  if (!normalizedUsername) {
    return `Mídia Kit de ${safeName}`;
  }
  return `Mídia Kit de ${safeName} (@${normalizedUsername})`;
}

export function buildMediaKitMetaDescription(input: MediaKitPreviewCopyInput): string {
  const safeName = input.displayName?.trim() || 'Criador';
  const normalizedUsername = normalizePreviewUsername(input.username);
  const followers = formatCompactCount(input.followersCount);
  const mediaCount = formatIntegerCount(input.mediaCount);
  const bio = typeof input.biography === 'string' ? input.biography.trim() : '';

  const identityParts: string[] = [];
  if (normalizedUsername) identityParts.push(`@${normalizedUsername}`);
  if (followers) identityParts.push(`${followers} seguidores`);
  if (mediaCount) identityParts.push(`${mediaCount} publicações`);

  const identityLine = identityParts.join(' • ');
  const fallback = `Dados de desempenho e publicações de destaque de ${safeName}.`;

  if (!identityLine && !bio) {
    return truncateText(fallback, 160);
  }

  if (!identityLine) {
    return truncateText(bio, 160);
  }

  if (!bio) {
    return truncateText(identityLine, 160);
  }

  return truncateText(`${identityLine} — ${bio}`, 160);
}
