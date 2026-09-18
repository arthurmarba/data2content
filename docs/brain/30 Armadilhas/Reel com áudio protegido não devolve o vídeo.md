---
tipo: armadilha
custo: 443 reels de 90 dias marcados como ilegíveis, sem causa aparente
---

# Reel com áudio protegido não devolve o vídeo

## O sintoma

Em 18/09/2026, 443 leituras estavam em `ContentReadingState` como
`unsupported · unsupported_media` ("Post sem mídia compatível para leitura visual"),
todas do tipo REEL e todas com a versão `cena_mapa_v4`. Parecia bug da leitura,
porque o post existe, está publicado e aparece normalmente no Instagram.

## A causa

A Graph API responde HTTP 200 com `media_type: VIDEO`, `media_product_type: REELS`,
`thumbnail_url` presente — e **sem `media_url`**. O Instagram omite a URL do arquivo
quando a mídia tem áudio de terceiros (música licenciada) ou foi sinalizada por
direitos autorais. Sem `media_url` não há mp4 para subir ao Gemini, e
`freshPublishedMedia` devolve `mediaUrl: null`; o worker encerra com "sem mídia
compatível", que `classifyReadingFailure` trata como terminal por 30 dias.

Ou seja: a marcação está certa, o post é mesmo ilegível por vídeo. O que engana é o
rótulo — parece falha nossa e é restrição do Instagram.

## O que fazer com eles

- Não vale nova tentativa imediata: a omissão só sai se o criador trocar o áudio.
- Ao dimensionar o custo de um backfill, desconte esses posts: em 18/09 eram 443 de
  1.661 pendentes (27%).
- Se um dia a leitura por miniatura valer a pena, `thumbnail_url` existe — mas perde
  fala e movimento, que é o que alimenta mapa e roteiros.

## Como conferir

Buscar `id,media_type,media_product_type,media_url,thumbnail_url` do
`instagramMediaId` com o token do criador. `temUrl: false` e `temThumb: true` confirmam
o caso.

## Ligações

[[Relatório Semanal]] · [[Crédito do Gemini paralisa a leitura publicada]]
