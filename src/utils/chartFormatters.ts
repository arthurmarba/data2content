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

export function formatWeekStartLabel(weekKey: string): string {
  if (!weekKey) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) {
    return formatDateLabel(weekKey);
  }
  const match = weekKey.match(/^(\d{4})-W?(\d{1,2})$/);
  if (!match) return weekKey;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return weekKey;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Start = new Date(jan4);
  week1Start.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const weekStart = new Date(week1Start);
  weekStart.setUTCDate(week1Start.getUTCDate() + (week - 1) * 7);
  return Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(weekStart);
}
