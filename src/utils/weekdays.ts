// src/utils/weekdays.ts

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

  // Esta função é usada com MongoDB's $dayOfWeek, que é 1-based (1=Dom, 7=Sáb).
  // A lógica anterior era ambígua e produzia resultados incorretos para os dias 1-6.
  // Esta lógica revisada mapeia corretamente um dia 1-based para um índice de array 0-based.
  const index = day - 1;

  // Esta verificação garante que o índice é válido antes de acessar o array,
  // o que satisfaz a verificação de tipo do TypeScript e previne erros em tempo de execução.
  if (index >= 0 && index < names.length) {
    // Podemos usar com segurança a asserção de não-nulidade `!` por causa da verificação de limites acima.
    return names[index]!; 
  }

  // Fallback para qualquer número de dia fora do intervalo 1-7.
  return `Dia ${day}`;
}
