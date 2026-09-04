import { Check } from "lucide-react";

/* Seção 04 — a segunda resposta. A publi aparece como ficha de campanha, com o
   espaço da marca e cada requisito marcado como atendido. Os colchetes ficam
   visíveis de propósito: marca e valor são dados reais que entram depois. */

const REQUIREMENTS = [
  "procura quem fala de maternidade",
  "a partir de 10 mil seguidores",
  "um reels com stories de apoio",
];

/* As fontes que a D2C varre, convergindo para o centro. Só aparece no celular
   (ver CSS): no desktop a mesma ideia é contada pela ficha de campanha, que
   continua lá. As posições são as do mockup de 390x300, em porcentagem para
   acompanharem telas mais estreitas. */
const SOURCES = [
  { label: "Squid", left: "17.95%", top: "16.67%" },
  { label: "PlayNest / Play9", left: "80.77%", top: "18.33%" },
  { label: "MIS", left: "14.87%", top: "50%" },
  { label: "Influency.me", left: "82.05%", top: "50%" },
  { label: "AirFluencers", left: "19.23%", top: "83.33%" },
  { label: "99Freelas", left: "80%", top: "82.67%" },
];

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
        <div className="d2c-v6-head d2c-v6-reveal">
          <span className="d2c-v6-label">
            <span className="d2c-v6-label__desktop-prefix">02 · </span>
            a publi
          </span>
          <h2 className="d2c-v6-title">
            Qual publi <span className="d2c-v6-answer__soft">é a sua cara.</span>
          </h2>
          <p className="d2c-v6-lead">
            As marcas abrem campanhas em várias plataformas diferentes. A D2C junta todas num só
            lugar e mostra só as que você tem chance de pegar.
          </p>
        </div>

        <div className="d2c-v6-publi d2c-v6-reveal">
          <article className="d2c-v6-publi__card">
            <header className="d2c-v6-publi__brand">
              <span className="d2c-v6-publi__logo">[MARCA]</span>
              <span className="d2c-v6-publi__origin">
                na Squid
                <b>[VALOR]</b>
              </span>
            </header>

            <span className="d2c-v6-label">o que a campanha pede</span>
            <ul className="d2c-v6-publi__reqs">
              {REQUIREMENTS.map((requirement) => (
                <li key={requirement}>
                  <span className="d2c-v6-publi__check" aria-hidden="true">
                    <Check size={12} />
                  </span>
                  <span>{requirement}</span>
                  <b>
                    <Check size={13} aria-hidden="true" />
                    elegível
                  </b>
                </li>
              ))}
            </ul>
          </article>

          <p className="d2c-v6-publi__why">
            E aparece pra você porque é justamente sobre isso que o seu público mais engaja.
          </p>

          <div className="d2c-v6-publi__constellation">
            <svg viewBox="0 0 390 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <circle cx="195" cy="150" r="112" fill="none" stroke="rgba(255,255,255,.14)" strokeDasharray="3 6" />
              <g stroke="rgba(245,179,1,.45)" strokeWidth="1">
                <line x1="70" y1="50" x2="195" y2="150" />
                <line x1="315" y1="55" x2="195" y2="150" />
                <line x1="58" y1="150" x2="195" y2="150" />
                <line x1="320" y1="150" x2="195" y2="150" />
                <line x1="75" y1="250" x2="195" y2="150" />
                <line x1="312" y1="248" x2="195" y2="150" />
              </g>
            </svg>
            {SOURCES.map((source) => (
              <span
                key={source.label}
                className="d2c-v6-publi__source"
                style={{ left: source.left, top: source.top }}
              >
                {source.label}
              </span>
            ))}
            <span className="d2c-v6-publi__hub" aria-hidden="true">D2C</span>
          </div>
        </div>

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
