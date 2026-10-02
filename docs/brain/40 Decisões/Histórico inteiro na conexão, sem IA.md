---
tipo: decisão
área: produto
---

# Histórico inteiro na conexão, sem IA

## A regra

Quando um criador conecta o Instagram, a D2C puxa **o histórico da conta** (até
dois anos), não só os últimos 180 dias — mais os 30 dias de novos seguidores anteriores à conexão, que é
tudo o que a Meta guarda.

O histórico antigo entra **só com chamadas ao Instagram**: números e legenda, sem
classificação, sem leitura de cena, sem transcrição. A IA continua lendo só a
janela recente, como antes.

**Limite de dois anos** (`HISTORY_MAX_AGE_DAYS`), decidido no mesmo dia ao
estender para todos os criadores: o banco é o Atlas gratuito (512 MB, 381 em uso).
Os 55 conectados tinham 50 mil posts fora do banco — ~95 MB mesmo enxutos; os de
até dois anos eram 11,8 mil (~22 MB). Post antigo também não guarda os links de
mídia e capa: expiram em dias e eram 63% do documento. Ir além de dois anos pede
banco maior.

## Por que

Decidido pelo Arthur em 02/10/2026, depois da reclamação de um criador (@gringobarbaoficial)
que tinha 175 posts e chegou ao conector com 103. Análise de série longa — o maior
Reel do ano, a curva desde o começo da conta — ficava impossível, e nada na
resposta dizia que faltava.

Chamada ao Instagram não custa dinheiro; leitura de IA custa. Os números antigos
já respondem quase tudo que o criador pergunta sobre o passado; a leitura de cena
só vale para o que ele ainda vai decidir.

## Aplicado em 02/10/2026

Rodado para os 57 conectados pelos workers de produção
(`scripts/enqueueInstagramHistoryAll.ts`, um a cada 2 min): 56 concluídos, 11 mil
posts antigos gravados, carrosséis na base de 1 para ~3 mil, banco de 385 para 408
MB. A única falha (@100amarras) é token bloqueado pelo Facebook até a pessoa entrar
no Facebook — só ela resolve. Ficaram fora de propósito ~40 mil posts com mais de
dois anos. Os carrosséis recentes (entre os 250 mais novos) entram pela
sincronização periódica, já com a correção.

## Onde vive

`src/app/lib/instagram/sync/historyBackfill.ts`, disparado pela conexão em
`/api/worker/refresh-instagram-user` (`motivo: "conexao"`). Para quem conectou
antes: `npm run backfill:instagram-history -- <userId>` (um criador, nesta máquina)
ou `scripts/enqueueInstagramHistoryAll.ts` (todos, nos workers de produção).

## Ligações

[[Instagram e métricas]] · [[Seguidores]] · [[Custo de IA é decisão de arquitetura]]
