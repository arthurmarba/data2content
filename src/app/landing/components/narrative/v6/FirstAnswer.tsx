import Image from "next/image";

/* Seção 03 — a primeira resposta. A pauta é o artefato que chega ao criador:
   tema em tipografia grande, o gancho destacado por uma barra amarela, e os
   demais atributos como chips soltos. A coluna de rótulo/valor foi justamente
   o que dava a esta seção cara de ficha técnica. */

/* Os atributos que acompanham o tema, sem rótulo: eles se explicam. */
const ATTRIBUTES = [
  "sentado, em plano médio",
  "com a xícara de café em quadro",
  "reels de 15 segundos",
  "abrindo com pergunta direta",
  "segunda às 15h",
];

const MULTIPLIERS = [
  { value: "7,9×", detail: "em compartilhamentos postando na quarta de manhã" },
  { value: "5,5×", detail: "em compartilhamentos falando de criar os filhos" },
  { value: "3,4×", detail: "em alcance aparecendo sozinho na cena" },
  { value: "2,3×", detail: "em comentários gravando dentro de casa" },
];

export function FirstAnswer() {
  return (
    <section className="d2c-v6-section d2c-v6-answer d2c-v6-answer--first" data-landing-section="first-answer">
      <div className="d2c-v6-shell">
        <div className="d2c-v6-head d2c-v6-reveal">
          <span className="d2c-v6-label">01 · a pauta</span>
          <h2 className="d2c-v6-title">
            O que criar <span className="d2c-v6-answer__soft">nesta semana.</span>
          </h2>
          <p className="d2c-v6-lead">
            A D2C te diz o que postar pois sabe o que seus seguidores gostam de te ver fazendo.
          </p>
        </div>

        <article className="d2c-v6-pauta d2c-v6-reveal">
          <header className="d2c-v6-pauta__head">
            <span className="d2c-v6-label">um exemplo de pauta</span>
            <span className="d2c-v6-pauta__week">semana [SEMANA]</span>
          </header>

          <div className="d2c-v6-pauta__body">
            <div className="d2c-v6-pauta__copy">
              <p className="d2c-v6-pauta__theme">criar os filhos</p>

              <div className="d2c-v6-pauta__hook">
                <span className="d2c-v6-label">gancho</span>
                <p>“Eu não dou açúcar pro meu filho”</p>
              </div>

              <ul className="d2c-v6-pauta__chips">
                {ATTRIBUTES.map((attribute) => (
                  <li key={attribute}>{attribute}</li>
                ))}
              </ul>
            </div>

            <figure className="d2c-v6-pauta__still">
              <Image
                src="/images/landing/v6/pauta-still.jpg"
                alt="Frame da pauta sugerida: criador sentado em casa, em plano médio"
                width={470}
                height={836}
                sizes="(max-width: 960px) 60vw, 216px"
              />
            </figure>
          </div>

          <p className="d2c-v6-pauta__verdict">
            Seus posts recebem <span className="d2c-v6-mark">mais compartilhamento</span> quando
            você cria conteúdo desse jeito.
          </p>
        </article>

        <ul className="d2c-v6-multipliers d2c-v6-reveal">
          {MULTIPLIERS.map((multiplier, position) => (
            <li
              key={multiplier.value}
              className={position === 0 ? "d2c-v6-multiplier is-lead" : "d2c-v6-multiplier"}
            >
              <b>{multiplier.value}</b>
              <small>{multiplier.detail}</small>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
