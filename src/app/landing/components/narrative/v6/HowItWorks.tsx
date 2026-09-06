import type { CSSProperties } from "react";

import Image from "next/image";

/* Seção 02 — o mecanismo. O passo 01 (conectar) é um minuto de configuração e
   por isso não ganha o mesmo peso do passo 02, que é o produto.

   O palco é a mesma cena nas duas larguras, em proporções diferentes: quatro
   anotações de cada lado, um fio saindo de cada uma e morrendo num ponto sobre
   o quadro. As posições vivem em variáveis CSS porque cada breakpoint tem as
   suas — no inline style o celular teria de brigar por !important. */

type Annotation = {
  label: string;
  /** Posição no palco do desktop (1312x520), em %. */
  dLeft: string;
  dTop: string;
  /** No celular (390x420) a etiqueta sai de uma das bordas. */
  mSide: "left" | "right";
  mEdge: string;
  mTop: string;
};

const ANNOTATIONS: Annotation[] = [
  { label: "enquadramento", dLeft: "13.72%", dTop: "20.77%", mSide: "left", mEdge: "3.08%", mTop: "7.14%" },
  { label: "gancho", dLeft: "17.15%", dTop: "40%", mSide: "right", mEdge: "76.92%", mTop: "32.86%" },
  { label: "cenário", dLeft: "16.92%", dTop: "59.23%", mSide: "right", mEdge: "76.92%", mTop: "57.86%" },
  { label: "tom de fala", dLeft: "15.47%", dTop: "78.46%", mSide: "left", mEdge: "3.08%", mTop: "87.14%" },
  { label: "objetos de cena", dLeft: "74.85%", dTop: "20.77%", mSide: "right", mEdge: "3.08%", mTop: "7.14%" },
  { label: "assunto", dLeft: "74.85%", dTop: "40%", mSide: "left", mEdge: "76.92%", mTop: "32.86%" },
  { label: "duração", dLeft: "74.85%", dTop: "59.23%", mSide: "left", mEdge: "76.92%", mTop: "57.86%" },
  { label: "retenção", dLeft: "74.85%", dTop: "78.46%", mSide: "right", mEdge: "3.08%", mTop: "87.14%" },
];

/* Um SVG por largura: os fios são diagonais e mudam de ângulo com a proporção
   do palco, então não dá para escalar o mesmo desenho. */
const WIRES_DESKTOP = [
  { x1: 330, y1: 122, x2: 516, y2: 160 },
  { x1: 330, y1: 222, x2: 516, y2: 228 },
  { x1: 330, y1: 322, x2: 516, y2: 300 },
  { x1: 330, y1: 422, x2: 516, y2: 374 },
  { x1: 982, y1: 122, x2: 796, y2: 160 },
  { x1: 982, y1: 222, x2: 796, y2: 228 },
  { x1: 982, y1: 322, x2: 796, y2: 300 },
  { x1: 982, y1: 422, x2: 796, y2: 374 },
];

const WIRES_MOBILE = [
  { x1: 59, y1: 58, x2: 115, y2: 83 },
  { x1: 324, y1: 58, x2: 275, y2: 83 },
  { x1: 93, y1: 150, x2: 100, y2: 168 },
  { x1: 93, y1: 255, x2: 100, y2: 240 },
  { x1: 297, y1: 150, x2: 290, y2: 168 },
  { x1: 297, y1: 255, x2: 290, y2: 240 },
  { x1: 55, y1: 362, x2: 115, y2: 336 },
  { x1: 340, y1: 362, x2: 275, y2: 336 },
];

/* O que a leitura de UM post rende, em multiplicadores: o resultado imediato do
   que a IA acabou de assistir. Em grade de três no desktop, em trilho no
   celular. */
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

function Wires({ variant }: { variant: "desktop" | "mobile" }) {
  const wires = variant === "desktop" ? WIRES_DESKTOP : WIRES_MOBILE;
  const box = variant === "desktop" ? "0 0 1312 520" : "0 0 390 420";
  const radius = variant === "desktop" ? 3 : 2.5;

  return (
    <svg
      className={`d2c-v6-how__wires d2c-v6-how__wires--${variant}`}
      viewBox={box}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g stroke="rgba(245,179,1,.5)" strokeWidth="1" fill="none">
        {wires.map((wire) => (
          <line key={`l${wire.x1}-${wire.y1}`} x1={wire.x1} y1={wire.y1} x2={wire.x2} y2={wire.y2} />
        ))}
      </g>
      <g fill="#f5b301">
        {wires.map((wire) => (
          <circle key={`c${wire.x2}-${wire.y2}`} cx={wire.x2} cy={wire.y2} r={radius} />
        ))}
      </g>
    </svg>
  );
}

export function HowItWorks() {
  return (
    <section
      className="d2c-v6-section d2c-v6-section--dark d2c-v6-how"
      id="como-funciona"
      data-landing-section="how-it-works"
    >
      <div className="d2c-v6-orb d2c-v6-how__orb" aria-hidden="true" />

      <div className="d2c-v6-shell">
        {/* Título e passos lado a lado: o título é a promessa, os passos são a
            leitura, e no desktop cabem na mesma altura de tela. */}
        <div className="d2c-v6-how__intro d2c-v6-reveal">
          <div className="d2c-v6-head">
            <span className="d2c-v6-label">como funciona</span>
            <h2 className="d2c-v6-title">
              Você para de <span className="d2c-v6-mark">adivinhar</span> em duas etapas.
            </h2>
          </div>

          <div className="d2c-v6-steps d2c-v6-steps--two">
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
            </div>
          </div>
        </div>
      </div>

      <div className="d2c-v6-how__stage d2c-v6-reveal">
        <Wires variant="desktop" />
        <Wires variant="mobile" />

        <figure className="d2c-v6-how__frame">
          <Image
            src="/images/landing/v6/hero-creator.webp"
            alt="Criadora gravando um reels dentro de casa, com a xícara de café em quadro"
            fill
            sizes="(max-width: 720px) 50vw, 280px"
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
              className="d2c-v6-how__note"
              data-m-side={annotation.mSide}
              style={
                {
                  "--note-left": annotation.dLeft,
                  "--note-top": annotation.dTop,
                  "--note-m-edge": annotation.mEdge,
                  "--note-m-top": annotation.mTop,
                } as CSSProperties
              }
            >
              {annotation.label}
            </li>
          ))}
        </ul>
      </div>

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
