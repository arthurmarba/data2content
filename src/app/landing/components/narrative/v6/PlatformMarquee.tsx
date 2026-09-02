/* As plataformas de onde a D2C reúne as publis. Correm no sentido oposto ao da
   faixa de criadores e ficam em fundo claro: preto encostando no preto da
   seção seguinte apagaria a fronteira entre as duas. */

const PLATFORMS = ["Squid", "Playnest", "MIS", "BrandLovrs", "Influency.me", "Airfluencers"] as const;

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
