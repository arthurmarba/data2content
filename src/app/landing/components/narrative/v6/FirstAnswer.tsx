import Image from "next/image";

/* Seção 03 — a primeira resposta. A pauta aparece como o artefato que chega
   para o criador, não como frase citada: o tema é tipografia grande e os
   atributos se distribuem ao redor em pesos diferentes, sem a coluna de
   rótulo/valor que fazia isso parecer ficha técnica. */

type Detail = {
  label: string;
  value: string;
  /** O gancho é a fala literal; ganha aspas e peso maior que os demais. */
  quote?: boolean;
};

const DETAILS: Detail[] = [
  { label: "gancho", value: "Eu não dou açúcar pro meu filho", quote: true },
  { label: "cena", value: "sentado, em plano médio" },
  { label: "objeto", value: "com a xícara de café em quadro" },
  { label: "formato", value: "reels de 15 segundos" },
  { label: "abertura", value: "abrindo com pergunta direta" },
  { label: "quando", value: "segunda às 15h" },
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

        <div className="d2c-v6-pauta d2c-v6-reveal">
          <figure className="d2c-v6-pauta__still">
            <Image
              src="/images/landing/v6/pauta-still.jpg"
              alt="Frame da pauta sugerida: criador sentado em casa, em plano médio"
              width={470}
              height={836}
              sizes="(max-width: 860px) 70vw, 320px"
            />
          </figure>

          <div className="d2c-v6-pauta__body">
            <span className="d2c-v6-label">um exemplo de pauta</span>
            <p className="d2c-v6-pauta__theme">criar os filhos</p>

            <ul className="d2c-v6-pauta__details">
              {DETAILS.map((detail) => (
                <li
                  key={detail.label}
                  className={detail.quote ? "d2c-v6-pauta__detail is-quote" : "d2c-v6-pauta__detail"}
                >
                  <small>{detail.label}</small>
                  <span>{detail.quote ? `“${detail.value}”` : detail.value}</span>
                </li>
              ))}
            </ul>

            <p className="d2c-v6-pauta__verdict">
              Seus posts recebem <span className="d2c-v6-mark">mais compartilhamento</span> quando
              você cria conteúdo desse jeito.
            </p>
          </div>
        </div>

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
