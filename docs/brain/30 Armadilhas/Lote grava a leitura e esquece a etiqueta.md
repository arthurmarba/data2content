---
tipo: armadilha
---

# Lote grava a leitura e esquece a etiqueta

## O sintoma

363 posts apareciam em `content_reading_states` como `batched` desde 18–27/09/2026,
muito depois do prazo de 48 h do lote do Gemini. Parecia fila travada e leitura
perdida.

Não era. Todos os 363 tinham a leitura gravada em `published_content_evidence`, e
o job marcava cada item como `done`. Só a etiqueta nunca saía de `batched`.

## Por que acontecia

`coletarLotes` gravava a leitura (`persistPublishedReading`), marcava o item no job
e seguia. Ninguém chamava o equivalente ao `finishReading` do tempo real. O
seletor de pendentes não relia esses posts porque olha a evidência, não a
etiqueta — então nada era pago duas vezes, mas qualquer contagem pela etiqueta
mentia.

## Como ficou (02/10/2026)

- `completeBatched` em `contentReadingState.ts`, chamado na coleta logo depois de
  gravar a leitura.
- `scripts/corrigirEtiquetasDoLote.ts` acertou os 363, só onde o job dizia `done`
  **e** a evidência existia. Nenhuma leitura nova.

## A regra que fica

Quem tira um item de um estado intermediário tem que pô-lo num estado final, em
todos os caminhos — inclusive no de sucesso. Antes de concluir que uma fila travou,
confira se o trabalho foi feito e só a etiqueta ficou para trás.

Ligações: [[Filas e rotinas]] · [[Crédito do Gemini paralisa a leitura publicada]]
