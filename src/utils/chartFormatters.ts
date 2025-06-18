export function formatNullableNumberTooltip(value: number | null, name: string): [string, string] {
  return [value !== null ? value.toLocaleString() : 'N/A', name];
}
