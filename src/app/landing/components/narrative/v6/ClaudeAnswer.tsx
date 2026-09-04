"use client";

import { useState } from "react";

/* A resposta longa da D2C dentro do Claude — só aparece no celular (ver CSS).
   No desktop a mesma troca é contada pelo balão curto, que continua lá.

   O texto é um exemplo de resposta real: números concretos em vez de [N]. Ele
   nasce dobrado porque a íntegra ocupa mais que uma tela — e o ponto aqui é
   mostrar a densidade da resposta, não obrigar a ler tudo. Quem quiser, abre. */

const FINDINGS = [
  "Seu post mais visto do mês foi uma foto, não um vídeo: a do encontro da D2C, em 21/08, alcançou 3.578 pessoas. Seus vídeos alcançaram 375 em média.",
  "No dia 18/08 você publicou o mesmo vídeo duas vezes. O primeiro alcançou 444 pessoas, o segundo só 117. Repetir no mesmo dia divide a audiência em vez de somar.",
  "Quando você defende uma opinião, alcança mais (776 pessoas). Quando o vídeo é para vender algo, alcança menos (113).",
];

const WORKS_FOR_YOU = [
  { label: "começo", detail: "abrir com uma opinião firme nos 5 primeiros segundos" },
  { label: "duração", detail: "entre 25 e 60 segundos" },
  { label: "cenário", detail: "em casa, falando pra câmera, com legenda na tela" },
  { label: "dia", detail: "sexta, seu melhor dia: 1.189 pessoas em média" },
];

export function ClaudeAnswer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="d2c-v6-claude__long" data-open={open ? "on" : "off"}>
      <div className="d2c-v6-claude__long-bubble">
        <div className="d2c-v6-claude__long-body">
          <p>
            Li seus 6 posts de agosto e comparei com os 19 vídeos do último ano. Três coisas que
            valem saber antes:
          </p>

          <ol className="d2c-v6-claude__findings">
            {FINDINGS.map((finding, position) => (
              <li key={finding}>
                <b>{position + 1}</b>
                <span>{finding}</span>
              </li>
            ))}
          </ol>

          <p>
            Agosto alcançou 31% menos que os dois meses anteriores. A causa não foi o conteúdo:
            você ficou duas semanas sem publicar e concentrou posts no mesmo dia.
          </p>

          <div className="d2c-v6-claude__works">
            <span className="d2c-v6-label">o que funciona pra você</span>
            <ul>
              {WORKS_FOR_YOU.map((item) => (
                <li key={item.label}>
                  <b>{item.label}</b>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          <p>
            Montei setembro com 2 posts por semana: opinião nas sextas (04, 11 e 25), bastidor nas
            terças (08 e 29), uma demonstração no dia 15 e a publi só no dia 22, depois de você já
            ter entregado cinco conteúdos.
          </p>
          <p>
            Três regras pro mês: um post por dia, nunca dois; vídeos de 25 a 60 segundos; e opinião
            sempre na sexta. Só com isso você dobra o alcance de agosto.
          </p>
          <p className="d2c-v6-claude__caveat">
            Uma ressalva: os posts de agosto não têm transcrição, então essa leitura do começo dos
            vídeos vem dos 19 do último ano.
          </p>
          <p>Quer que eu escreva o roteiro do 04/09 no seu ritmo de fala?</p>

          {/* O véu só existe fechado; aberto ele cobriria o fim do texto. */}
          {!open && <span className="d2c-v6-claude__veil" aria-hidden="true" />}
        </div>

        <button
          type="button"
          className="d2c-v6-claude__toggle"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          {open ? "Mostrar menos" : "Ler resposta completa"}
        </button>
      </div>
      <span className="d2c-v6-claude__who">data2content</span>
    </div>
  );
}
