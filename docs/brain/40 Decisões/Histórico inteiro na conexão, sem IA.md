---
tipo: decisão
área: produto
---

# Histórico inteiro na conexão, sem IA

## A regra

Quando um criador conecta o Instagram, a D2C puxa **a conta inteira**, não só os
últimos 180 dias — mais os 30 dias de novos seguidores anteriores à conexão, que é
tudo o que a Meta guarda.

O histórico antigo entra **só com chamadas ao Instagram**: números e legenda, sem
classificação, sem leitura de cena, sem transcrição. A IA continua lendo só a
janela recente, como antes.

## Por que

Decidido pelo Arthur em 02/10/2026, depois da reclamação de um criador (@gringobarbaoficial)
que tinha 175 posts e chegou ao conector com 103. Análise de série longa — o maior
Reel do ano, a curva desde o começo da conta — ficava impossível, e nada na
resposta dizia que faltava.

Chamada ao Instagram não custa dinheiro; leitura de IA custa. Os números antigos
já respondem quase tudo que o criador pergunta sobre o passado; a leitura de cena
só vale para o que ele ainda vai decidir.

## Onde vive

`src/app/lib/instagram/sync/historyBackfill.ts`, disparado pela conexão em
`/api/worker/refresh-instagram-user` (`motivo: "conexao"`). Para quem conectou
antes: `npm run backfill:instagram-history -- <userId>`.

## Ligações

[[Instagram e métricas]] · [[Seguidores]] · [[Custo de IA é decisão de arquitetura]]
