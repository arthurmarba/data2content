export function getPortugueseWeekdayName(day: number): string {
  const names = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  if (day >= 0 && day <= 6) return names[day];
  if (day >= 1 && day <= 7) return names[day - 1];
  return `Dia ${day}`;
}
