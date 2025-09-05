export function formatNullableNumberTooltip(value: number | null, name: string): [string, string] {
  return [value !== null ? value.toLocaleString() : 'N/A', name];
}

export function formatAxisNumberCompact(value: number): string {
  try {
    return Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  } catch {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return String(value);
  }
}

export function formatDateLabel(dateStr: string): string {
  // Espera YYYY-MM-DD; se não for, retorna o original
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      return Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(dt);
    }
  }
  return dateStr;
}
