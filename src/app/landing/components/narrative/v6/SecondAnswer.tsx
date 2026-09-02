import { Check } from "lucide-react";

/* Seção 04 — a segunda resposta. A publi aparece como ficha de campanha, com o
   espaço da marca e cada requisito marcado como atendido. Os colchetes ficam
   visíveis de propósito: marca e valor são dados reais que entram depois. */

const REQUIREMENTS = [
  "procura quem fala de maternidade",
  "a partir de 100 mil seguidores",
  "um reels com stories de apoio",
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
          <span className="d2c-v6-label">02 · a publi</span>
          <h2 className="d2c-v6-title">
            Qual publi é sua <span className="d2c-v6-answer__soft">nesta semana.</span>
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
                  <span>{requirement}</span>
                  <b>
                    <Check size={13} aria-hidden="true" />
                    você bate
                  </b>
                </li>
              ))}
            </ul>
          </article>

          <p className="d2c-v6-publi__why">
            E aparece pra você porque é justamente sobre isso que o seu público mais responde.
          </p>
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
