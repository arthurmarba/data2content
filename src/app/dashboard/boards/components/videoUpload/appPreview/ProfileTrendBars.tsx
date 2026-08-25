"use client";

/**
 * A série do padrão nas últimas semanas, em quatro barrinhas.
 *
 * Um multiplicador sozinho não diz para onde a coisa está indo: 2,1× pode ser um
 * padrão firme há dois meses ou o resto de um pico que já passou, e a decisão de
 * repetir muda inteira entre os dois casos. Quatro barras cabem no canto do card
 * e respondem isso sem cobrar nem uma palavra.
 *
 * A última barra é a semana que fechou, e é a única em tinta cheia — as outras
 * são contexto, não leitura. Barra zerada quer dizer "naquela semana você não
 * fez isso", que é diferente de "rendeu pouco"; por isso ela mantém a altura
 * mínima em vez de sumir.
 */

const MAX_HEIGHT = 22;
const MIN_HEIGHT = 4;

export function ProfileTrendBars({
  series,
  height = MAX_HEIGHT,
  width = 5,
}: {
  series: number[];
  height?: number;
  width?: number;
}) {
  if (series.length < 2) return null;
  const max = Math.max(...series);
  if (!Number.isFinite(max) || max <= 0) return null;

  return (
    <span
      className="flex items-end gap-[3px]"
      style={{ height }}
      role="img"
      aria-label={`Últimas ${series.length} semanas`}
      title={`Últimas ${series.length} semanas`}
    >
      {series.map((value, position) => (
        <span
          key={position}
          className={`block rounded-[2px] ${
            position === series.length - 1 ? "bg-[var(--ds-color-ink)]" : "bg-[var(--ds-color-line-strong)]"
          }`}
          style={{
            width,
            height: Math.max(MIN_HEIGHT, Math.round((Math.max(value, 0) / max) * height)),
          }}
        />
      ))}
    </span>
  );
}

/**
 * A série em palavras, para o detalhe. Compara a última semana com a anterior e
 * com o começo da janela — que é o que alguém diria olhando as barras.
 */
export function describeTrend(series: number[], label: string): string | null {
  const usable = series.filter((value) => Number.isFinite(value));
  if (usable.length < 2) return null;

  const last = usable[usable.length - 1] ?? 0;
  const previous = usable[usable.length - 2] ?? 0;
  const weeks = usable.length;
  const active = usable.filter((value) => value > 0).length;

  if (active === 1 && last > 0) {
    return `${label} apareceu uma vez só nas últimas ${weeks} semanas. Repetir é o que transforma isso em leitura.`;
  }
  if (last === 0) {
    return `${label} não apareceu na semana que fechou. O número acima vem das semanas anteriores.`;
  }
  if (previous > 0 && last >= previous * 1.15) {
    return `Vem subindo: ${format(previous)} na semana passada, ${format(last)} nesta.`;
  }
  if (previous > 0 && last <= previous * 0.85) {
    return `Caiu de ${format(previous)} para ${format(last)} de uma semana para a outra.`;
  }
  // Duas medidas não estabelecem estabilidade — estabelecem que duas medidas
  // deram parecido. Chamar isso de "estável" promete uma leitura que a amostra
  // ainda não sustenta, e hoje quase toda conta da base tem duas ou três
  // semanas gravadas, não quatro.
  if (active < 3) {
    return `Parecido nas duas semanas em que apareceu. A terceira é que começa a mostrar tendência.`;
  }
  return `Estável nas últimas ${weeks} semanas, sem sobressalto de uma para a outra.`;
}

function format(value: number) {
  return `${value.toFixed(1).replace(".", ",")}×`;
}
