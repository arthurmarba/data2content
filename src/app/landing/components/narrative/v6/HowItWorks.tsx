import type { CSSProperties } from "react";

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
  /* Posição no palco do celular (390x420). O lado não acompanha o do desktop:
     lá a coluna manda, aqui o que manda é de que borda a etiqueta sai. */
  mSide: "left" | "right";
  /** Distância da borda `mSide`, em % de 390px. */
  mEdge: string;
  /** Topo no palco do celular, em % de 420px. */
  mTop: string;
};

const ANNOTATIONS: Annotation[] = [
  { label: "gancho", side: "left", top: "5.41%", start: "20.83%", width: "24.31%", mSide: "right", mEdge: "76.92%", mTop: "32.86%" },
  { label: "enquadramento", side: "left", top: "39.32%", start: "20.83%", width: "24.31%", mSide: "left", mEdge: "3.08%", mTop: "7.14%" },
  { label: "cenário", side: "left", top: "74.46%", start: "20.83%", width: "18.75%", mSide: "right", mEdge: "76.92%", mTop: "57.86%" },
  { label: "duração", side: "left", top: "94.05%", start: "18.06%", width: "18.47%", mSide: "left", mEdge: "76.92%", mTop: "57.86%" },
  { label: "assunto", side: "right", top: "25.68%", start: "57.43%", width: "25%", mSide: "left", mEdge: "76.92%", mTop: "32.86%" },
  { label: "tom de fala", side: "right", top: "45.95%", start: "57.43%", width: "27.78%", mSide: "left", mEdge: "3.08%", mTop: "87.14%" },
  { label: "objetos de cena", side: "right", top: "69.05%", start: "57.43%", width: "29.17%", mSide: "right", mEdge: "3.08%", mTop: "7.14%" },
  { label: "retenção", side: "right", top: "90.54%", start: "57.43%", width: "23.61%", mSide: "right", mEdge: "3.08%", mTop: "87.14%" },
];

/* Os fios do palco do celular: cada um sai da etiqueta e morre num ponto sobre
   o quadro. Ficam num SVG porque são diagonais — a linha de um pixel que serve
   ao desktop só sabe ser horizontal. */
const WIRES = [
  { x1: 59, y1: 58, x2: 115, y2: 83 },
  { x1: 324, y1: 58, x2: 275, y2: 83 },
  { x1: 93, y1: 150, x2: 100, y2: 168 },
  { x1: 93, y1: 255, x2: 100, y2: 240 },
  { x1: 297, y1: 150, x2: 290, y2: 168 },
  { x1: 297, y1: 255, x2: 290, y2: 240 },
  { x1: 55, y1: 362, x2: 115, y2: 336 },
  { x1: 340, y1: 362, x2: 275, y2: 336 },
];

const QUIET_SIGNALS = "gancho · assunto · tom de fala · horário e dia · resposta da audiência";

/* O que a leitura de UM post rende, em multiplicadores. No desktop isto vive na
   seção da pauta; no celular aquela seção sai inteira e os números passam a
   fechar esta aqui — é o resultado imediato do que a IA acabou de assistir. */
const READINGS = [
  { title: "quarta de manhã", value: "7,9×", detail: "em compartilhamentos" },
  { title: "falando de criar os filhos", value: "5,5×", detail: "em compartilhamentos" },
  { title: "aparecendo sozinho na cena", value: "3,4×", detail: "em alcance" },
  { title: "gravando dentro de casa", value: "2,3×", detail: "em comentários" },
  { title: "reels de até 20 segundos", value: "4,1×", detail: "em retenção até o fim" },
  { title: "abrindo com pergunta direta", value: "3,7×", detail: "em salvamentos" },
  { title: "falando em primeira pessoa", value: "2,8×", detail: "em respostas nos stories" },
  { title: "domingo à noite", value: "2,6×", detail: "em novos seguidores" },
  { title: "com legenda na tela", value: "1,9×", detail: "em visualizações completas" },
];

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
            Você para de <span className="d2c-v6-mark">adivinhar</span> em duas etapas.
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
        <svg className="d2c-v6-how__wires" viewBox="0 0 390 420" preserveAspectRatio="none" aria-hidden="true">
          <g stroke="rgba(245,179,1,.5)" strokeWidth="1" fill="none">
            {WIRES.map((wire) => (
              <line key={`${wire.x1}-${wire.y1}`} x1={wire.x1} y1={wire.y1} x2={wire.x2} y2={wire.y2} />
            ))}
          </g>
          <g fill="#f5b301">
            {WIRES.map((wire) => (
              <circle key={`${wire.x2}-${wire.y2}`} cx={wire.x2} cy={wire.y2} r="2.5" />
            ))}
          </g>
        </svg>

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
            <b className="d2c-v6-how__tag-when">seg · 15h</b>
          </span>
        </figure>

        <ul className="d2c-v6-how__notes">
          {ANNOTATIONS.map((annotation) => (
            <li
              key={annotation.label}
              className={`d2c-v6-how__note d2c-v6-how__note--${annotation.side}`}
              style={
                {
                  "--note-top": annotation.top,
                  "--note-left": annotation.start,
                  "--note-width": annotation.width,
                  "--note-m-edge": annotation.mEdge,
                  "--note-m-top": annotation.mTop,
                } as CSSProperties
              }
              data-m-side={annotation.mSide}
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

      {/* Só aparece no celular (ver CSS): no desktop estes números são a seção
          da pauta, que continua lá inteira. */}
      <div className="d2c-v6-how__readings d2c-v6-reveal">
        <span className="d2c-v6-label">o que a leitura deste post revelou</span>
        <ul className="d2c-v6-how__readings-rail">
          {READINGS.map((reading) => (
            <li key={reading.title}>
              <b>{reading.title}</b>
              <small>
                <span>{reading.value}</span> {reading.detail}
              </small>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
