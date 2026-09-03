/* Fontes ativas no radar, por coleta pública ou consolidação manual. Correm no
   sentido oposto ao da faixa de criadores e ficam em fundo claro: preto
   encostando no preto da seção seguinte apagaria a fronteira entre as duas. */

const PLATFORMS = [
  "Squid",
  "PlayNest / Play9",
  "MIS",
  "Influency.me",
  "AirFluencers",
  "99Freelas",
  "Tijuca Geek Festival",
] as const;

export function PlatformMarquee() {
  const loop = [...PLATFORMS, ...PLATFORMS, ...PLATFORMS, ...PLATFORMS];

  return (
    <div className="d2c-v6-marquee d2c-v6-marquee--platforms" aria-hidden="true">
      <div className="d2c-v6-marquee__track">
        {loop.map((platform, position) => (
          <span key={`${platform}-${position}`}>{platform}</span>
        ))}
      </div>
    </div>
  );
}
