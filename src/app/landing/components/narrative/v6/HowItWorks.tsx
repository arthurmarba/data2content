import Image from "next/image";

/* Seção 02 — o mecanismo. O passo 01 (conectar) é um minuto de configuração e
   por isso não ganha o mesmo peso do passo 02, que é o produto.

   As oito anotações são as do mockup, nas mesmas posições: quatro à esquerda
   (rótulo → linha → ponto) e quatro à direita (ponto → linha → rótulo), com o
   ponto sempre caindo dentro do quadro. As medidas viram porcentagem de um
   palco de 1440×740 para acompanharem a tela sem perder o alinhamento. */

type Annotation = {
  label: string;
  side: "left" | "right";
  /** Deslocamento vertical no palco, em % de 740px. */
  top: string;
  /** Início horizontal, em % de 1440px. */
  start: string;
  /** Largura do conjunto rótulo+linha+ponto, em % de 1440px. */
  width: string;
};

const ANNOTATIONS: Annotation[] = [
  { label: "gancho", side: "left", top: "5.41%", start: "20.83%", width: "24.31%" },
  { label: "enquadramento", side: "left", top: "39.32%", start: "20.83%", width: "24.31%" },
  { label: "cenário", side: "left", top: "74.46%", start: "20.83%", width: "18.75%" },
  { label: "duração", side: "left", top: "94.05%", start: "18.06%", width: "18.47%" },
  { label: "assunto", side: "right", top: "25.68%", start: "57.43%", width: "25%" },
  { label: "tom de fala", side: "right", top: "45.95%", start: "57.43%", width: "27.78%" },
  { label: "objetos de cena", side: "right", top: "69.05%", start: "57.43%", width: "29.17%" },
  { label: "retenção", side: "right", top: "90.54%", start: "57.43%", width: "23.61%" },
];

const QUIET_SIGNALS = "gancho · assunto · tom de fala · horário e dia · resposta da audiência";

export function HowItWorks() {
  return (
    <section
      className="d2c-v6-section d2c-v6-section--dark d2c-v6-how"
      id="como-funciona"
      data-landing-section="how-it-works"
    >
      <div className="d2c-v6-orb d2c-v6-how__orb" aria-hidden="true" />

      <div className="d2c-v6-shell">
        <div className="d2c-v6-head d2c-v6-reveal">
          <span className="d2c-v6-label">como funciona</span>
          <h2 className="d2c-v6-title">
            Você para de <span className="d2c-v6-mark">adivinhar</span> em dois passos.
          </h2>
        </div>

        <div className="d2c-v6-steps d2c-v6-steps--two d2c-v6-reveal">
          <div className="d2c-v6-step">
            <span className="d2c-v6-step__n">01</span>
            <span className="d2c-v6-step__t">Você conecta o Instagram.</span>
            <span className="d2c-v6-step__d">
              Leva um minuto e é a única coisa que você precisa configurar. A partir daí a D2C
              acompanha tudo o que você publica.
            </span>
          </div>
          <div className="d2c-v6-step">
            <span className="d2c-v6-step__n">02</span>
            <span className="d2c-v6-step__t">A IA assiste cada post.</span>
            <span className="d2c-v6-step__d">
              Ela não olha só curtidas. Ela observa o que você fez em cada vídeo:
            </span>
            <span className="d2c-v6-how__quiet">{QUIET_SIGNALS}</span>
          </div>
        </div>
      </div>

      <div className="d2c-v6-how__stage d2c-v6-reveal">
        <figure className="d2c-v6-how__frame">
          <Image
            src="/images/landing/v6/hero-creator.webp"
            alt="Criadora gravando um reels dentro de casa, com a xícara de café em quadro"
            fill
            sizes="(max-width: 960px) 78vw, 420px"
            className="d2c-v6-how__photo"
          />
          <span className="d2c-v6-how__scrim" aria-hidden="true" />

          <span className="d2c-v6-how__grid" aria-hidden="true">
            <i /><i /><b /><b />
          </span>

          <span className="d2c-v6-how__focus" aria-hidden="true">
            <i /><i /><i /><i />
          </span>

          <span className="d2c-v6-how__progress" aria-hidden="true">
            <i />
          </span>

          {/* Selo de alcance no canto do quadro: reforça que o que está sendo
              lido é um post publicado, não uma ilustração. */}
          <span className="d2c-v6-how__views" aria-hidden="true">
            <i />
            1,2 mil
          </span>

          <span className="d2c-v6-how__tags" aria-hidden="true">
            <b>reels · 0:15</b>
            <b>seg · 15h</b>
          </span>
        </figure>

        <ul className="d2c-v6-how__notes">
          {ANNOTATIONS.map((annotation) => (
            <li
              key={annotation.label}
              className={`d2c-v6-how__note d2c-v6-how__note--${annotation.side}`}
              style={{ top: annotation.top, left: annotation.start, width: annotation.width }}
            >
              {annotation.side === "left" ? (
                <>
                  <span className="d2c-v6-how__note-label">{annotation.label}</span>
                  <span className="d2c-v6-how__note-line" aria-hidden="true" />
                  <span className="d2c-v6-how__note-dot" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span className="d2c-v6-how__note-dot" aria-hidden="true" />
                  <span className="d2c-v6-how__note-line" aria-hidden="true" />
                  <span className="d2c-v6-how__note-label">{annotation.label}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="d2c-v6-shell d2c-v6-how__bridge d2c-v6-reveal">
        Toda semana, você recebe duas respostas.
      </p>
    </section>
  );
}
