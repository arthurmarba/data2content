# O topo do relatório, sem repetição

Ajuste na tela de perfil — seção "Seu relatório".
Data: 18/08/2026 · Complementa `plano-perfil-padroes-na-capa.md`

---

# Parte 1 — Em português simples

## Concordo: o topo diz a mesma coisa várias vezes

São seis repetições empilhadas antes de a pessoa chegar no que interessa:

1. **Dois títulos para a mesma seção.** "Seu relatório" e, logo abaixo, "A semana por dentro". E o cartão de identidade, alguns centímetros acima, já diz "Semana de 4 a 10 de agosto". Três formas de anunciar a mesma coisa antes de dizer qualquer coisa.
2. **A régua explicada três vezes.** "Tudo comparado com a sua mediana dos últimos 90 dias" aparece no topo; depois cada cartão repete ("2,5× o seu normal · 14 posts em 90 dias"); e dentro do cartão aberto ela aparece de novo ("indício é 1 ou 2 posts…").
3. **Dois blocos de três números, quase idênticos na forma**, a poucos centímetros um do outro: os da semana e os do vídeo. O olho não sabe qual é o principal — e o do vídeo, que é o mais interessante, chega depois.
4. **O vocabulário oscila.** "Salvamentos" em cima, "salvos" embaixo. "Compartilhamentos" em cima, "envios" embaixo. "4,8× **acima do** seu normal" no vídeo, "2,5× **o** seu normal" nos cartões.
5. **A frase de abertura aparece duas vezes.** A citação no rodapé do vídeo é exatamente a mesma frase do cartão "Abertura que segura", logo abaixo.
6. **"A semana por dentro" não informa nada.** É rótulo. A frase que vem logo depois — *"rotina vivida rende mais quando a conclusão vem logo na abertura"* — é a manchete de verdade, e está em cinza pequeno, abaixo do rótulo.

## O que proponho

**A frase-resumo vira a manchete.** Some "Seu relatório" e some "A semana por dentro". A leitura da semana ocupa o lugar de destaque, em serifada, como a narrativa lá no topo da tela. É a única linha ali que uma pessoa contaria para outra.

**Os três números da semana viram uma linha discreta**: *"6 posts · 440 salvos · 317 envios"*. Continuam disponíveis, param de disputar. Assim sobra um único bloco de números com peso: o do vídeo da semana, que é o que merece.

**A régua sai do topo.** Ela já vive em cada cartão e dentro da expansão. No topo, vira a nota de rodapé que a seção já tem, junto da cobertura: *"Comparado com a sua mediana de 90 dias · 71 de 84 posts têm leitura visual."*

**A citação sai do vídeo.** Ela é o cartão "Abertura que segura", que fica logo abaixo com o número dela. Repetir tira a força das duas.

**Uma palavra por coisa.** "Salvos" e "envios" em todo lugar; "× o seu normal" em todo lugar.

## O que isso resolve

O topo cai de oito blocos para quatro: manchete → linha de números → vídeo da semana → os padrões. A pessoa lê uma frase e já sabe da semana; se quiser número, ele está logo ali; e chega nos cartões — que são o coração — com metade da rolagem de hoje.

## Trabalho

**Meio dia.** É uma seção só, sem dado novo e sem cálculo novo. Os testes existentes cobrem a seção; ajusto os que citam os textos removidos.

Risco baixo e reversível: nada sai do produto, só muda de lugar ou de peso.

---

# Parte 2 — Para quem for implementar

Tudo em `ReportOverview`, dentro de `CreatorWeeklyProfileExperience.tsx`.

1. Remover o `ds-notebook-label` "Seu relatório" e o `<h2>` "A semana por dentro". O `<h2 id="weekly-report-title">` passa a ser o próprio `report.overview.summary`, em `font-voice` ~1.375rem — mantendo o `aria-labelledby` da seção apontando para ele.
2. `report.overview.numbers` deixa de ser grade de três colunas e vira uma linha única (`·` como separador), em `ds-caption`.
3. Mover "Tudo comparado com a sua mediana dos últimos 90 dias" para o rodapé, fundido com a linha de cobertura.
4. `WeeklyVideoCard`: remover o bloco de `video.openingLine` e trocar `formatIndex` de "× acima do seu normal" para "× o seu normal" (mesma string de `formatPatternIndex`; vale extrair para uma função só).
5. Padronizar rótulos: o motor gera `overview.numbers` com "salvamentos"/"compartilhamentos" — trocar em `engine.ts` para "salvos"/"envios", que é o vocabulário do card do vídeo.
6. O badge "Dados de exemplo" fica uma vez, ao lado da manchete.

Testes a ajustar: `CreatorWeeklyProfileExperience.test.tsx` (procura por "A semana por dentro") e `engine.test.ts` se travar os rótulos dos números.

---

## Estado: aplicado em 18/08/2026

Tudo em `ReportOverview` / `WeeklyVideoCard` (`CreatorWeeklyProfileExperience.tsx`) e nos rótulos de `engine.ts` + `demoReport.ts`.

Uma correção em relação ao plano: a manchete **não** usa serifada — dentro de `.d2c-mobile-app` os `h2` já herdam a Bricolage (display), que é a mesma família dos outros títulos da tela. Serifada teria introduzido uma quinta voz tipográfica sem motivo.

`formatIndex` do vídeo virou alias de `formatPatternIndex`: uma função só para a régua, em vez de duas frases para a mesma conta.

---

## Revisão de voz — 18/08/2026

Todos os textos do relatório são determinísticos (nenhum passa por IA), então a voz é escolha de código.

**A manchete deixou de ser frase de enquadramento e passou a ser a descoberta.** `buildWeekHeadline` elege o padrão de maior multiplicador entre os promovidos e escreve "O que rendeu mais foi gravar em natureza." — **sem o número**, que fica no card logo abaixo: repetir "7,5×" duas vezes em quinze centímetros gasta o efeito. Sem nada promovido, cai para `overview.summary`.

**Regravadas em voz de dica** (`engine.ts`): resumo da semana, as quatro interpretações, os quatro estados vazios, os subtítulos dos detalhes e dos rankings.

| Antes | Depois |
|---|---|
| "Você publicou 6 conteúdos na semana. O relatório compara cada padrão com o seu próprio normal." | "Você postou 6 vezes nesta semana. Veja o que cada escolha rendeu contra o seu próprio normal." |
| "Natureza chegou a 7,5× do seu normal." | "Natureza rendeu 7,5× o seu normal." |
| "Compare resultado e amostra antes de transformar um achado em regra." | "Olhe o resultado e quantos posts tem atrás dele. Um acerto só vale um teste, não uma regra." |
| "Assuntos específicos mostram melhor a demanda do que categorias genéricas." | "Repare no assunto exato, não na categoria: 'maternidade sem idealização' rende diferente de 'maternidade'." |
| "Uma frase é um indício; procure construções que se repetem entre as melhores." | "Não copie a frase: repita o jeito de começar que aparece nas melhores." |
| "A leitura visual ainda não tem cobertura suficiente." | "Seus vídeos ainda não foram lidos o bastante para comparar cena." |
| "Enquadramentos usados nos últimos 90 dias." | "Como a câmera te mostra." |
