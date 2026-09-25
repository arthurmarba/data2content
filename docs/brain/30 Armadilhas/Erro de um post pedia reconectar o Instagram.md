---
tipo: armadilha
custo: 41 de 45 criadores conectados viam "Reconectar Instagram" sem precisar
---

# Erro de um post pedia reconectar o Instagram

## O sintoma

O Perfil (app atual e Jornada) mostrava "Sua leitura parou de atualizar —
Reconectar Instagram" para quase todo assinante, com token válido por meses. Em
15/09/2026, 41 dos 45 conectados estavam nessa situação, todos pelo mesmo erro.

## A causa

`resolveInstagramConnectionState` marcava `expired` sempre que
`User.instagramSyncErrorMsg` tinha qualquer texto. A sincronização gravava ali o
primeiro erro de etapa, e o mais comum era por post:
`fetchMediaInsights - … (#100) The Media Insights API does not support …`. O
Instagram recusa estatísticas de certos tipos de mídia; reconectar não resolve.

## A correção

- `instagramConnectionState.ts`: `isConnectionSyncError` ignora erros de
  estatística de um post e limite de frequência (#4, #17, #32, #613). Token vencido,
  ausente ou erro de sessão continuam contando como queda.
- `dataSyncService.ts`: `fetchMediaInsights` com "does not support" é tratado como
  informação e não é mais gravado em `instagramSyncErrorMsg`.

## Como conferir

Contar usuários com `isInstagramConnected: true`, token válido e
`instagramSyncErrorMsg` preenchido, e classificar a mensagem. Mensagem de erro de
sincronização não é sinônimo de conexão caída.

## Ligações

[[Seu Mapa]] · [[Filas e rotinas]]

## Outra consequência da mesma recusa — 25/09/2026

Em Reels recentes do Ronaldo, a Meta recusou `follows` com `(#100) The Media
Insights API does not support the follows metric for this media product type`.
`graphApiRequest` lançou o erro antes de devolver uma resposta; por isso a
retentativa de `fetchMediaInsights`, que só examinava `response.error`, não rodou.
A sincronização guardou a publicação sem alcance ou visualizações. O resumo de
performance filtrava esses posts e informava 06/09 como `newestPostDate`, embora
houvesse publicação em 24/09 (horário de Brasília).

A leitura agora repete a consulta sem `follows` quando essa recusa específica vem
como exceção. O resumo separa `newestPostDate` (publicação mais recente) de
`newestAnalyzedPostDate` (publicação mais recente com métricas) e informa quantos
posts existiam na janela. Depois de publicar a correção, ressincronizar o criador
para preencher as métricas faltantes; mudar só o texto do MCP não recupera dados.
