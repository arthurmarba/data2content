import type { CSSProperties } from "react";

/* Seção 04 — a segunda resposta. As fontes que a D2C varre convergem para o
   centro: é a seção inteira num desenho só. As posições vêm dos mockups
   (1440x470 no desktop, 390x300 no celular) em porcentagem, para acompanharem
   larguras intermediárias.

   O Tijuca Geek Festival ocupa o topo do desenho, que só existe no desktop — no
   celular não há folga vertical para uma sétima ponta. */
type Source = {
  label: string;
  dLeft: string;
  dTop: string;
  mLeft?: string;
  mTop?: string;
};

const SOURCES: Source[] = [
  { label: "Tijuca Geek Festival", dLeft: "50%", dTop: "12.77%" },
  { label: "Squid", dLeft: "25%", dTop: "22.34%", mLeft: "17.95%", mTop: "16.67%" },
  { label: "PlayNest / Play9", dLeft: "75%", dTop: "22.34%", mLeft: "80.77%", mTop: "18.33%" },
  { label: "MIS", dLeft: "20.83%", dTop: "50%", mLeft: "14.87%", mTop: "50%" },
  { label: "Influency.me", dLeft: "79.17%", dTop: "50%", mLeft: "82.05%", mTop: "50%" },
  { label: "AirFluencers", dLeft: "26.39%", dTop: "80.85%", mLeft: "19.23%", mTop: "83.33%" },
  { label: "99Freelas", dLeft: "73.61%", dTop: "80.85%", mLeft: "80%", mTop: "82.67%" },
];

const RAYS_DESKTOP = [
  [720, 60], [360, 105], [1080, 105], [300, 235], [1140, 235], [380, 380], [1060, 380],
] as const;

const RAYS_MOBILE = [
  [70, 50], [315, 55], [58, 150], [320, 150], [75, 250], [312, 248],
] as const;

const DELIVERY = [
  {
    n: "01",
    title: "No relatório da semana.",
    detail: "Sai no nosso grupo de WhatsApp, junto com a pauta da semana.",
  },
  {
    n: "02",
    title: "Na conversa dentro do Claude.",
    detail:
      "Você pergunta e a D2C responde com as campanhas que combinam com você. É o que vem a seguir.",
  },
];

export function SecondAnswer() {
  return (
    <section
      className="d2c-v6-section d2c-v6-section--slate d2c-v6-answer d2c-v6-answer--second"
      id="publis"
      data-landing-section="second-answer"
    >
      <div className="d2c-v6-orb d2c-v6-answer__orb" aria-hidden="true" />

      <div className="d2c-v6-shell">
        <div className="d2c-v6-head d2c-v6-head--split d2c-v6-reveal">
          <span className="d2c-v6-label">a publi</span>
          <h2 className="d2c-v6-title">
            Qual publi <span className="d2c-v6-answer__soft">é a sua cara.</span>
          </h2>
          <p className="d2c-v6-lead">
            As marcas abrem campanhas em várias plataformas diferentes. A D2C junta todas num só
            lugar e mostra só as que você tem chance de pegar.
          </p>
        </div>
      </div>

      {/* O desenho ocupa a largura cheia da seção, fora do container de texto:
          é ele que carrega o argumento, não uma ilustração de apoio. */}
      <div className="d2c-v6-publi__constellation d2c-v6-reveal">
        <svg
          className="d2c-v6-publi__rays d2c-v6-publi__rays--desktop"
          viewBox="0 0 1440 470"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <circle cx="720" cy="235" r="180" fill="none" stroke="rgba(255,255,255,.12)" strokeDasharray="3 7" />
          <g stroke="rgba(245,179,1,.45)" strokeWidth="1">
            {RAYS_DESKTOP.map(([x, y]) => (
              <line key={`d${x}-${y}`} x1={x} y1={y} x2={720} y2={235} />
            ))}
          </g>
        </svg>

        <svg
          className="d2c-v6-publi__rays d2c-v6-publi__rays--mobile"
          viewBox="0 0 390 300"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <circle cx="195" cy="150" r="112" fill="none" stroke="rgba(255,255,255,.14)" strokeDasharray="3 6" />
          <g stroke="rgba(245,179,1,.45)" strokeWidth="1">
            {RAYS_MOBILE.map(([x, y]) => (
              <line key={`m${x}-${y}`} x1={x} y1={y} x2={195} y2={150} />
            ))}
          </g>
        </svg>

        {SOURCES.map((source) => (
          <span
            key={source.label}
            className="d2c-v6-publi__source"
            data-desktop-only={source.mLeft ? undefined : "on"}
            style={
              {
                "--src-left": source.dLeft,
                "--src-top": source.dTop,
                "--src-m-left": source.mLeft ?? source.dLeft,
                "--src-m-top": source.mTop ?? source.dTop,
              } as CSSProperties
            }
          >
            {source.label}
          </span>
        ))}

        <span className="d2c-v6-publi__hub" aria-hidden="true">D2C</span>
      </div>

      <div className="d2c-v6-shell">
        <div className="d2c-v6-publi__delivery d2c-v6-reveal">
          <span className="d2c-v6-label">como a publi chega até você</span>
          <div className="d2c-v6-steps d2c-v6-steps--two">
            {DELIVERY.map((step) => (
              <div className="d2c-v6-step" key={step.n}>
                <span className="d2c-v6-step__n">{step.n}</span>
                <span className="d2c-v6-step__t">{step.title}</span>
                <span className="d2c-v6-step__d">{step.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
