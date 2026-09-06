---
tipo: domínio
---

# Collabs — o encontro entre criadores

## Por que existe

Duas pessoas que dividem território rendem mais juntas. A aba Collabs transforma isso em algo tocável: um baralho de cartas que o criador desliza, guardando o que interessa.

## Onde mora

| Peça | Caminho |
| --- | --- |
| Tela | `src/app/dashboard/collabs/page.tsx` |
| Blocos no computador | `src/app/dashboard/boards/CollabsPinnedBoard.tsx`, `CollabsOverviewBoard.tsx` |
| Match por narrativa | `boards/videoUpload/narrativeCollabMatchingService.ts` |
| Match por pauta | `boards/videoUpload/perPautaCollabMatchingService.ts` |
| Complementaridade | `boards/videoUpload/collabComplementarity.ts` |
| Reciprocidade | `boards/videoUpload/collabReciprocityService.ts` |
| Interesse do criador | `boards/videoUpload/collabInterestService.ts` (+ modelo `CollabInterest`) |
| Cache por pauta | `boards/videoUpload/perPautaCollabCache.ts` (+ modelo `PerPautaCollabCache`) |
| Pelo MCP | `src/app/lib/mcp/collabIntelligence.ts` |
| Rotas | `/api/dashboard/mobile-strategic-profile/collabs/*`, `/api/planner/collab-creators` |
| Modelos | `CollabMatch`, `CollabInterest`, `PerPautaCollabCache` |

## A forma da experiência

É um baralho, não uma lista: **mesa** (as cartas por decidir) e **mochila** (as guardadas). A carta tem frente e verso. Só aparece em "Combinadas" quando os dois lados demonstraram interesse — daí existir o serviço de reciprocidade.

O match não é por semelhança genérica: é **por território comum**, ancorado numa pauta específica, com uma ideia de gravação compartilhada entre os dois. Um match sem pauta é um match vazio.

## Por que existe cache

Calcular match por pauta é caro (envolve IA). O `perPautaCollabCache` guarda o resultado com prazo de validade. Se mudar a lógica de match, lembre que o cache pode estar servindo o resultado velho — ele é a primeira suspeita quando "a mudança não apareceu".

## Pendência conhecida

O modelo de mensagem do WhatsApp para o convite de collab segue em aberto.

## Ligações

[[Seu Mapa]] · [[Pautas e Roteiros]] · [[Boards escondem função]]
