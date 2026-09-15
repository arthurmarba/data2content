---
tipo: domínio
---

# Filas e rotinas — o que roda sem ninguém olhando

## As duas famílias

**Fila (QStash)** — alguém empurra um trabalho e vai embora; o trabalhador executa depois. Endereços em `/api/worker/*`, protegidos pela assinatura do QStash (`QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`).

**Relógio (cron)** — roda em horário marcado. Endereços em `/api/cron/*`, protegidos por `CRON_SECRET`.

A lista completa e sempre atual está em [[Trabalhos em fundo]] (gerada por script).

## Por que isso existe

A Vercel corta requisição longa. Classificar conteúdo, ler vídeo com IA e atualizar Instagram passam do limite. Então a regra é: **se demora, vai pra fila**.

Quando uma tela "fica processando pra sempre", quase sempre o trabalho não chegou ao trabalhador ou morreu lá dentro — não é a tela que está quebrada.

## Agendamento

A retenção de snapshots tem comando próprio `npm run maintenance:mongo-storage`
(simulação por padrão), com execução recorrente local pelo Codex. Não há cron dessa
limpeza publicado na Vercel. Ver [[Histórico diário conserva oito meses e uma referência]].

`src/scripts/scheduleCrons.ts` (`npm run schedule:crons`).

## As rotinas que mexem com dinheiro ou com o criador

- `mature-affiliate-commissions` — libera comissão
- `expire-trials`, `notify-free-month-ending`, `whatsapp-trial` — ciclo de assinatura
- `weekly-report-close` — **grava um retrato que não volta atrás** (ver [[Relatório Semanal]])
- `weekly-mapa-whatsapp`, `weekly-whatsapp-message`, `send-daily-tips` — falam com o criador

Mudança em qualquer uma dessas quatro últimas famílias é visível pra pessoa de fora. Trate como envio, não como código.

## Leitura publicada e manutenção de roteiro

`classify-published-scene` usa `ContentReadingState`: posse temporária por post,
checkpoint da extração, tentativas, motivo e próxima tentativa. A extração paga
é reaproveitada se apenas a persistência falhar. Falta de saldo pausa Gemini por
seis horas; depois um job testa recuperação. A fila não confunde token inválido,
URL expirada, mídia excluída e formato incompatível. Resposta cortada tem teto e
aproveitamento parcial sem segunda chamada; ilegível e carrossel incompleto encerram
a leitura. A fala recuperada não conta como transcrição completa — ver
[[Leitura de cena em loop relida a cada repescagem]] e
[[Raciocínio do Gemini 3 come o maxTokens]].

`refresh-script-evidence` reconcilia métricas e vínculos confirmados e reconstrói
DNA em lotes de até 500 evidências por criador, sem IA. É acionado por novas
evidências, alterações de publicação do roteiro e pelo cron de recuperação.
Se a fila de manutenção falhar, o salvamento continua e o cron é a retaguarda.
Auditoria por padrão é somente leitura; `audit:script-evidence -- --reconcile`
escreve no ambiente configurado e deve ser tratado como operação de banco.

## Ligações

[[10 Mapa do sistema]] · [[Trabalhos em fundo]] · [[Classificação de conteúdo]]


## Encadeamento do Perfil

Classificação concluída aciona `classify-published-scene`, que entrega a evidência
salva a `generate-creator-weekly-report` e `enrich-mapa-instagram`, com agrupamento
de eventos por criador. Falha de publicação na fila não invalida a evidência; o
cron `recover-content-intelligence` é a retaguarda. O lote reserva espaço para
pendências antigas e alterna criadores dentro de cada faixa de idade.

O enriquecimento do Instagram usa posse temporária, checkpoint e revisão de
conteúdo. Mudança apenas de métricas não provoca outra geração do mapa. A
sincronização não espera pela IA de enriquecimento.

## Collabs (setembro de 2026)

`/api/worker/collabs` processa `CollabJob` com assinatura QStash, lease e checkpoint. O cron `recover-content-intelligence` republica pedidos pendentes e conclui falhas esgotadas liberando reservas. `CollabSettings` controla piloto e pausa sem apagar propostas. O aviso de match é um evento criado na mesma transação da confirmação; resposta ambígua do provedor exige revisão, não reenvio automático.

## Upload de vídeo (setembro de 2026)

`VideoAnalysisJob` registra a sessão assinada, dono, estado e resultado. `lib/videoAnalysis/` aceita e recupera trabalhos; `/api/worker/analyze-uploaded-video` executa a análise com assinatura QStash. Há uma análise ativa por criador, resultado por sessão e checkpoint validado da IA. Uma interrupção sem checkpoint não repete automaticamente a chamada paga. `/api/cron/recover-video-analyses`, cadastrado para cada cinco minutos, recupera trabalhos e reconcilia arquivos temporários. Publicar o código não cadastra automaticamente o agendamento: ativá-lo na QStash faz parte da liberação.

Na liberação do upload em 08/09/2026, a QStash recusou `deduplicationId` com `:` (HTTP 400). O identificador do upload agora usa SHA-256 hexadecimal da sessão e do minuto. Mock de fila precisa validar esse contrato; aceitar qualquer string esconde trabalho que nunca chega ao trabalhador. O agendamento `video-analysis-recovery` foi ativado em produção na mesma data, isoladamente das rotinas de mensagens.

## Fotos e carrosséis na fila (11/09/2026)

Posts sem legenda já nascem com classificação concluída em `saveMetricData`.
Eles precisam disparar `enqueuePublishedReading` ali: não passam pelo worker de
classificação de texto. A sincronização também recupera posts já classificados;
a fila evita republicar cenas da versão atual quando a evidência está salva.

`findPendingReadingBatch` reserva 20% do lote para fotos/carrosséis antes dos
cortes por idade. A consulta tem uma faixa própria de imagens: reservar apenas
depois do limite de candidatos deixava milhares de Reels esconderem fotos antigas.
O restante conserva a distribuição por idade e criador, sem duplicar posts.

`relatorio:cenas` aceita os quatro formatos de feed e compartilha a renovação de
URLs do Instagram com o worker (`relatorio/publishedMedia.ts`). O `--dry-run`
apenas lista elegíveis: não baixa mídia, não chama IA e não grava evidência.

A revisão é por formato: `cena_mapa_v4` para vídeos e `cena_visual_v1` para fotos e
carrosséis. Seleção, posse temporária, checkpoint e idempotência devem usar a revisão
do formato; mudar a leitura visual não autoriza pagar outra leitura de todos os Reels.
Falhas de item ficam em `ContentReadingState.lastError`, com posição e total.
Uma falha de download ou resposta incompleta nunca publica evidência como completa.

## Controle de chamadas pagas (14/09/2026)

`lib/llm/geminiGovernance.ts` protege leituras publicadas (worker e backfill) e
as chamadas do enriquecimento automático do mapa. `GeminiOperation` registra a
intenção **antes** do envio e a resposta **antes** do parse; concorrência é barrada
pelo `_id` único. A resposta salva pode ser reinterpretada sem outra chamada, desde
que o contexto do mapa e o modelo sejam iguais. O SDK recebe `attempts: 1`.

Timeout, abort ou interrupção sem comprovante deixam o resultado incerto: não há
reenvio automático nem fallback para OpenAI. Uma rejeição HTTP explícita 429/503
espera 30 minutos; saldo espera seis horas; são no máximo três envios por operação.
Não se assume cobrança zero: reservas anteriores de rejeições permanecem alocadas.
O suporte precisa revisar resultados incertos; não apagar operações para liberar fila.
Os registros não têm TTL, pois apagá-los permitiria pagar novamente pelo conteúdo.

A chave do post não inclui versão de prompt nem URL assinada. Isso impede novas
chamadas da mesma operação após troca de prompt. Registros históricos anteriores a
esta proteção não têm comprovante retroativo. O checkpoint de `ContentReadingState`
continua sendo usado para retomar a persistência da evidência.

No mapa, a revisão considera IDs/legendas ordenados e os campos efetivamente
consumidos (assuntos, tons, objetos), sem datas de processamento. Os comprovantes
são por etapa. Comparação shadow não roda neste contexto automático. Outros fluxos
(roteiros sob demanda, collabs, upload) não estão cobertos por este orçamento.

`GeminiBudgetPolicy`, documento `automatic`, ausente ou `enabled: false`: apenas
acompanha. **Arthur definiu R$ 8/dia como referência, preferindo eficiência por análise
a bloqueio de crescimento. Nenhum teto foi ativado nem valor gravado em produção.**
O limite opcional usa `globalDailyMicros` e, se desejado, `creatorDailyMicros`, em
milionésimos de USD, por dia UTC. `rates[modelo]` exige `inputUsdPerMillion` e
`outputUsdPerMillion` revisados: usar a maior tarifa aplicável por modalidade/faixa,
incluindo áudio na entrada e raciocínio na saída. Não inferir tarifa de modelo novo.

Antes da geração, `countTokens` inclui a instrução de sistema; entrada estimada e
teto de saída são reservados juntos em transação Mongo. Falta de tarifa/contagem
bloqueia a chamada quando o orçamento está habilitado. Após resposta, reconcilia
pela contagem retornada; sem contagem, conserva a reserva. Custo é estimativa, não
fatura, e depende da correção das tarifas. Exige Mongo com transações (replica set).

`npm run audit:gemini -- --days=7 --usd-brl=<cotação>` consulta sem alterar dados:
chamadas, tentativas, tokens, leituras completas/parciais/inúteis e custo por leitura
útil quando há tarifas configuradas. Não imprime transcrições nem IDs de criadores.
Não confundir ausência de tarifa/uso com custo zero. Sem execução após o deploy,
ainda não há medição de economia real. A auditoria não envia alertas automaticamente.
