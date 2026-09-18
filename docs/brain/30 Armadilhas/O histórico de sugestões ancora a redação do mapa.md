---
tipo: armadilha
custo: cortar 96% da entrada deixaria a fila de sugestões cheia de quase-duplicatas
---

# O histórico de sugestões ancora a redação do mapa

## O que parecia

O enriquecimento do mapa mandava o documento inteiro do `MapaSeed` dentro do prompt.
Medido em 18/09/2026: 35 mil caracteres por chamada, dos quais **33.736 (96%) eram o
campo `suggestions`** — cada chip já proposto com evidências, revisões e datas. O
prompt não pergunta nada sobre sugestões, e quem as reconcilia é
`reconcileMapSuggestions`, depois da resposta, com o documento do banco. Parecia
entrada paga à toa.

## O que aconteceu ao cortar

Com os mesmos 10 criadores, sem o campo a resposta ficou **7× mais instável**: 113
divergências entre duas execuções contra 15 do prompt cheio, e o tom bateu com o
original em 1 de 10. A quantidade de chips não mudou (326 contra 315) — mudou a
redação. Como `reconcileMapSuggestions` deduplica por texto normalizado, cada
enriquecimento passaria a criar quase-duplicatas na tela do criador.

Ou seja: o histórico não estava só ocupando lugar, estava servindo de **âncora de
redação**.

## O que ficou

Mandar só a âncora — `section`, `value`, `state` (935 caracteres de média) — e dizer
no prompt para repetir palavra por palavra a redação já proposta quando o conceito
for o mesmo. Resultado: ruído 9 (melhor que os 15 de antes), tom igual em 9 de 10,
311 chips contra 315, com 3,3 mil tokens de entrada em vez de 19,4 mil.

## Como repetir a medição

`npx tsx --env-file=.env.local scripts/compareMapaThinking.ts` prepara a amostra dos
checkpoints já pagos (`mapa:instagram:<criador>`) e `--run --output=<pasta>` executa.
Comparar pastas diferentes offline isola o efeito de uma mudança de prompt sem pagar
de novo pela leitura visual.

## Ligações

[[Seu Mapa]] · [[Raciocínio do Gemini 3 come o maxTokens]]
