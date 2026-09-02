import Image from "next/image";

/* Seção 02 — o mecanismo. O passo 01 (conectar) é um minuto de configuração e
   por isso não ganha o mesmo peso do passo 02, que é o produto.
   As anotações ancoradas na cena são só as visuais: pôr as nove sobre a mesma
   imagem transformava demonstração em diagrama técnico. As outras cinco ficam
   na linha discreta do passo 02. */

type Annotation = {
  label: string;
  /** Posição do rótulo na moldura, em porcentagem do container da cena. */
  top: string;
  side: "left" | "right";
};

const ANNOTATIONS: Annotation[] = [
  { label: "enquadramento", top: "12%", side: "left" },
  { label: "cenário", top: "38%", side: "right" },
  { label: "objetos de cena", top: "62%", side: "left" },
  { label: "duração", top: "84%", side: "right" },
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
            sizes="(max-width: 860px) 90vw, 420px"
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
              style={{ top: annotation.top }}
            >
              <span className="d2c-v6-how__note-label">{annotation.label}</span>
              <span className="d2c-v6-how__note-line" aria-hidden="true" />
              <span className="d2c-v6-how__note-dot" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
