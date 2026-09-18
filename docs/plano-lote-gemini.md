# Leituras do Gemini em lote (Batch API)

Planejamento em 14/09/2026. Não autoriza deploy nem mudança de horário de rotina por si só.

## Por que

O Gemini cobra **metade do preço** para pedidos entregues em lote, com prazo-alvo de até
24 h. O desconto vale para entrada (vídeo, imagem, áudio) e saída, sem mudar o pedido:
a leitura sai igual, o que as tentativas de encolher a resposta não conseguiram garantir
(ver "O que já foi descartado").

Com a retirada do botão "+" na nova versão da plataforma, nenhuma leitura paga do Gemini
precisa de resposta imediata. O que continua em tempo real é o que o criador espera na
tela: geração e revisão de roteiros, pautas e collabs abertos na hora.

## Onde está o dinheiro (7 dias até 14/09/2026, `geminiusagelogs`)

| Fluxo | Modelo | Chamadas | US$ | Parte | Pode ir para lote? |
| --- | --- | --- | --- | --- | --- |
| `cena` — leitura de vídeo/foto/carrossel publicado | gemini-2.5-flash | 649 | 11,57 | 71% | Sim — fase 1 |
| `llm` — enriquecimento e limpeza do mapa | gemini-3.7-flash | 771 | ~4,06* | 25% | Sim — fase 2 |
| demais (`llm` lite, comunidade, roteiros, instagram) | vários | — | ~0,71 | 4% | Roteiros não; resto não compensa agora |

\* tarifa do 3.7-flash estimada. A semana medida inclui desperdícios já corrigidos
localmente (leitura em loop relida, mapa cortado por raciocínio), então a base vai cair
antes do lote; a economia do lote se aplica ao que sobrar.

Confirmado na documentação: gemini-2.5-flash e gemini-3.7-flash aceitam Batch API; o SDK
instalado (`@google/genai` 2.3.0) tem `ai.batches.create/get/cancel`.

## A restrição que manda no desenho: o fechamento da semana

`weekly-scene-evaluation` roda segunda 00:00 BRT e `weekly-report-close` fecha 01:00 BRT.
`closeWeek → loadWindow` usa `Metric.sceneElements` (assets, tons, assuntos, lugar,
abertura), e o retrato gravado **não se refaz**. Uma leitura presa no lote na hora do
fechamento vira buraco permanente no relatório.

Regra: **lote por padrão, tempo real no prazo.** Todo post elegível vai para lote. Às
18:00 BRT de domingo, o que da semana corrente ainda não voltou do lote segue pelo
caminho atual (tempo real), e posts publicados depois disso continuam indo direto pelo
`weekly-scene-evaluation` de segunda 00:00. Assim, só o fim de domingo paga preço cheio.

## Desenho

### Identidade e cobrança (reaproveita a proteção existente)

- Cada item do lote é a mesma operação de hoje: `GeminiOperation` com `contentKey`
  `published:<metricId>` e tag `cena`. Um post continua pagando uma vez só, esteja no
  lote ou em tempo real.
- Ao incluir no lote: operação em `started` com `batchJobName`; resposta gravada em
  `received` antes do parse, como hoje.
- Tarifas da trava de orçamento ganham a variante de lote (metade), por operação.
- O caminho de tempo real passa a recusar um post cuja operação esteja `started` num lote
  ainda vivo — é o que impede pagar duas vezes no prazo de domingo. Se o prazo exigir, o
  job correspondente é **cancelado antes** da leitura em tempo real.

### Estado da leitura

`ContentReadingState` ganha o estado `batched` (sem posse ativa, `nextAttemptAt` =
envio + 48 h, prazo em que o Google expira o job). A repescagem e o `findPendingReadingBatch`
pulam `batched` até esse prazo.

### Envio (novo cron, a cada 30 min)

1. Seleciona pendentes com `findPendingReadingBatch` (mesma justiça por criador e reserva
   para fotos), fora da janela de prazo.
2. Para cada post: `freshPublishedMedia` (a URL do Instagram expira em horas — o download
   é feito no envio, não na execução do lote), baixa, sobe na Files API com a espera por
   `ACTIVE` e as tentativas que já existem em `uploadVideo`.
3. Monta o JSONL com `key = metricId` e o **mesmo** pedido de `buildPrompt` (system,
   formato, parts, `thinkingBudget: 0`, `maxOutputTokens`, temperatura 0), referenciando os
   arquivos pela URI.
4. Cria o job com `ai.batches.create` e grava `GeminiBatchJob` (nome, modelo, itens,
   enviado em, estado).
5. Teto por job: 25 itens ou o tempo da função (300 s). Download + upload por vídeo leva
   segundos; se o envio parar no meio, os itens não incluídos voltam a pendente.

Por que Files API e não vídeo embutido no JSONL: embutido não está documentado para
vídeo, e 25 vídeos em base64 passam de centenas de MB dentro de uma função. O arquivo
dura 48 h — o mesmo prazo em que o job expira —, então o arquivo não morre antes do job.

### Coleta (mesmo cron)

1. `ai.batches.get` nos jobs abertos.
2. `JOB_STATE_SUCCEEDED`: baixa o JSONL de resultado; para cada `key`, grava a resposta na
   operação, faz o parse e chama a mesma persistência do worker (checkpoint → evidência
   publicada → `sceneElements` → filas de manutenção, perfil e mapa).
3. Item com erro: `classifyReadingFailure`, como no tempo real.
4. `FAILED`/`EXPIRED`/`CANCELLED`: itens sem resposta voltam a pendente com uma nova
   tentativa permitida (job sem resultado não gerou saída cobrada; conferir na fatura da
   prova de conceito antes de confiar nisso).
5. Apaga os arquivos da Files API do job ao concluir.

Refatoração necessária: a persistência hoje mora em
`api/worker/classify-published-scene/route.ts` (regra de negócio em rota). Ela vai para um
serviço em `lib/relatorio/`, usado pelo worker, pelo backfill e pela coleta do lote.

## Resultado da prova de conceito (14/09/2026)

- O lote **recusa os modelos 2.5** nesta conta: todo pedido volta com
  `code 5 · Requested entity was not found`, inclusive um pedido só de texto, com o modelo
  gravado corretamente (`models/gemini-2.5-flash`) e listado com `batchGenerateContent`.
  A chamada normal no 2.5-flash segue funcionando. Não se sabe se é definitivo.
- O lote **funciona nos modelos 3**: `gemini-3.7-flash` e `gemini-3.5-flash-lite`
  devolveram texto em ~3 min (texto só; vídeo ainda não testado no lote).
- Com `maxOutputTokens` baixo, os modelos 3 voltam sem texto e sem erro: o raciocínio
  consome o teto (ver `brain/30 Armadilhas/Raciocínio do Gemini 3 come o maxTokens.md`).
- A página oficial de descontinuação não anuncia data de desligamento do 2.5-flash
  (consultada em 14/09/2026); a data de 16/10/2026 circula só em sites de terceiros.
- `usageMetadata` dos itens do lote veio com `serviceTier: "standard"`; a aplicação do
  desconto precisa ser conferida no painel de uso do AI Studio.

Consequência: lote na leitura de cena exige trocar de modelo. Candidatos com lote e
preço igual ou menor: `gemini-3.5-flash-lite` (mesmo preço do 2.5-flash) e
`gemini-3.1-flash-lite` (US$ 0,25/M entrada, US$ 1,50/M saída; metade no lote). A troca
só entra depois de comparação de qualidade contra a oscilação natural do 2.5-flash.

## Tempo real de um lote com vídeo (14–15/09/2026)

Dois lotes de 13 Reels (Files API por URI) levaram **5 h** (gemini-3.5-flash-lite) e
**18,8 h** (gemini-3.1-flash-lite) para concluir. Lotes só de texto voltaram em 1–3 min.
Nenhum item foi lido: os arquivos foram apagados logo após criar o job e todos
voltaram com `code 7 · The caller does not have permission` (sem cobrança).

Consequências para o desenho:
- manter os arquivos da Files API até o job terminar (expiram em 48 h; apagar só na
  coleta);
- o prazo de domingo 18:00 é curto demais: um lote pode passar de 18 h. Antecipar o
  corte para sábado 18:00 (ou tirar do lote os posts da semana corrente a partir de
  sexta) e medir de novo antes de liberar.

## Qualidade dos candidatos (14–15/09/2026, 13 Reels, chamada normal)

Mesmo pedido da produção, `thinkingLevel: LOW`, comparado às duas leituras do
gemini-2.5-flash. Régua = o 2.5-flash contra ele mesmo.

| Medida | 2.5-flash × 2.5-flash | 3.1-flash-lite | 3.5-flash-lite |
| --- | --- | --- | --- |
| Elementos do mapa diferentes | 1 | 5 (2 perdidos, 3 inventados) | 12 (2 perdidos, 10 inventados) |
| Tom igual | 100% | 62% | 46% |
| Assuntos iguais | 85% | 85% | 62% |
| Lugar igual | 85% | 92% | 85% |
| Semelhança da fala | 0,93 | 0,84 | 0,87 |
| Custo por leitura (lote) | ~US$ 0,006 (se o lote aceitasse) | US$ 0,0022 | US$ 0,0025 |

As comparações dos candidatos aceitam coincidir com qualquer uma das duas leituras
antigas, o que os favorece. Mesmo assim nenhum fica dentro da oscilação natural.

Os modelos 3 leem vídeo a **70 tokens por quadro** por padrão, contra ~258 no 2.5 —
metade da entrada por vídeo (8 mil contra 17 mil tokens). A resolução `high` (280 por
quadro) é configurável por parte do pedido e pode recuperar detalhe visual; tom e fala
dependem do áudio e podem não melhorar com isso.

## Fases

**0. Prova de conceito (custo < R$ 0,20).** Script com 3 vídeos (curto, médio e acima de
14 MB) e 1 carrossel: envio por Files API em JSONL, tempo real até o retorno, formato do
resultado, correspondência por `key`, `usageMetadata` por item e se o preço aparece com
desconto. Comparar as leituras com as já salvas desses posts (mesmo critério da oscilação
natural medida em 14/09: elementos do mapa 97,5% iguais entre duas leituras normais).

**1. Leitura publicada em lote.** Cron de envio/coleta, estado `batched`, operação
vinculada ao job, regra do prazo de domingo, serviço de persistência. Liberação por flag
`GEMINI_BATCH_READINGS` = `off` → `backlog` (só repescagem e posts com mais de 3 dias) →
`on`. Variável entra no `.env.local` e na Vercel no mesmo dia.

**2. Enriquecimento do mapa em lote** (`mapa_instagram`, `mapa_dedup`,
`mapa_instagram_texto`, gemini-3.7-flash). É uma cadeia (o dedup depende do resultado do
enriquecimento) e alimenta o resumo do mapa de segunda 08:00; o prazo de domingo vale
igual. Só depois de a fase 1 estabilizar.

## Medição

- Custo por leitura útil antes e depois, pelas operações (tarifa de lote registrada).
- Tempo até o retorno: mediana e p95 por job. Se o p95 passar de 12 h, antecipar o prazo
  de domingo.
- Parte das leituras da semana que precisou do caminho de prazo (tempo real).
- Cobertura no fechamento: nenhum post elegível sem leitura às 01:00 de segunda.
- Falhas por item e jobs expirados.

Estimativa, a confirmar na fase 0: se ~85% das leituras forem pelo lote, a leitura de
cena custa ~42% menos; com a fase 2, a conta do Gemini cai perto de 40% sobre a base que
sobrar depois das correções de desperdício.

## Riscos

| Risco | Cuidado |
| --- | --- |
| Lote atrasa e deixa o relatório sem leituras | Prazo de domingo 18:00 com tempo real; métrica de cobertura no fechamento |
| Pagar duas vezes (lote + tempo real no prazo) | Mesma operação por post; cancelar o job antes do tempo real |
| Files API reprova arquivo bom | Espera por `ACTIVE` e tentativas de `uploadVideo`; item reprovado volta a pendente |
| Job expira (48 h) | Itens voltam a pendente; conferir cobrança real na fase 0 |
| Função estoura tempo no envio | Teto de 25 itens por job; itens não enviados continuam pendentes |
| Perfil e mapa atualizam mais devagar após postar | Aceito: até ~24 h; nenhuma tela depende de leitura imediata sem o "+" |

## Reversão

`GEMINI_BATCH_READINGS=off` faz o cron parar de enviar; jobs abertos continuam sendo
coletados até o fim. Nada de apagar operações: elas impedem pagar de novo.

## O que já foi descartado (14/09/2026)

- **Fala uma vez só** (`scene_segments_v1`): −0,7% de saída em 15 pares; vídeo longo
  desanda. Mantido em 0%. Ver [plano da etapa 2](plano-eficiencia-gemini-etapa-2.md).
- **JSON sem indentação**: −11% de saída, mas mudou 4 elementos do mapa e perdeu metade de
  uma transcrição em 13 vídeos, contra 1 divergência na releitura do pedido antigo.
  Desfeito.

## Fora deste plano

- Retirada do botão "+" e do fluxo `analyze-uploaded-video` / `VideoAnalysisJob`.
- Repostagem de reels de teste (ver `brain/30 Armadilhas/Reel repostado é lido e contado de novo.md`).
- Troca de modelo ou de resolução de vídeo.
