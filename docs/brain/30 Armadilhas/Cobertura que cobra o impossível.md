---
tipo: armadilha
---

# Cobertura que cobra o impossível

## O sintoma

Um criador que só publica foto aparecia com **0% de cobertura de transcrição** e
um aviso de `transcript_coverage_partial`. O painel administrativo mostrava esse
mesmo criador com zero de tudo na leitura de conteúdo.

Nos dois casos o número estava certo e a leitura estava errada: parecia dado
perdido, quando era dado que não pode existir. Foto não tem áudio.

## A confusão de fundo

"Foi lido" e "tem fala" viraram a mesma pergunta em dois lugares:

- `analyze_creator_period` dividia as transcrições encontradas por **todos** os
  posts do período, foto incluída. O denominador continha itens que jamais
  entrariam no numerador.
- `analyze_creator_portfolio` contava `videos` e `observedTranscripts` filtrando
  `REEL`/`VIDEO`. Foto e carrossel simplesmente não existiam ali — nem para dizer
  que foram lidos, nem para dizer que faltavam.

O efeito prático do segundo é pior que o do primeiro: a leitura visual de foto
existe desde 25/08/2026, roda de verdade, e mesmo assim era invisível no painel.
Trabalho feito que não aparece é indistinguível de trabalho não feito.

## Como ficou (07/09/2026)

**Transcrição só conta vídeo.** O total passa a ser os posts que podem ter fala;
os demais vão para `notApplicable`. Uma conta só de fotos agora lê "0 de 0, 2 não
se aplicam" em vez de "0 de 2". O aviso de cobertura parcial não dispara.

**Leitura visual ganhou par próprio.** O painel traz `photosAndCarousels` e
`photosAndCarouselsVisuallyRead` ao lado de `videos` e `observedTranscripts`, com
o aviso `photo_visual_reading_coverage_partial`. Na base real isso trouxe à tona
"1 de 20 fotos e carrosséis lidos" — um número que antes não existia em lugar
nenhum.

O `$lookup` da evidência agora projeta dois booleanos (`speech` e `visual`) em vez
de filtrar por transcrição. Uma leitura, dois sinais, nenhum texto atravessando a
agregação.

## A regra que fica

Antes de dividir A por B numa cobertura, pergunte se **todo** item de B poderia
estar em A. Se não puder, ele não é lacuna: é outra categoria, e merece a própria
linha. Denominador errado não produz erro — produz um número plausível que manda
consertar o que não está quebrado.

Ligações: [[Card de audiência trava]] · [[Limite de 90 segundos]]
