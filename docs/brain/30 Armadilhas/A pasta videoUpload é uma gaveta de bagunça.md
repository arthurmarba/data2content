---
tipo: armadilha
alcance: orientação — o nome da pasta mente
---

# `boards/videoUpload/` não é só upload de vídeo

## O problema

São **169 arquivos de código** numa pasta cujo nome sugere uma coisa só. Na prática, ela virou o endereço de todo o programa do perfil no celular. Quem procura pelo nome não encontra; quem encontra por acaso não confia.

## O que realmente mora lá

| Assunto | Ordem de grandeza | Exemplos |
| --- | --- | --- |
| Leitura narrativa e vídeo | ~85 arquivos | `videoNarrative*`, `narrativeSource*` |
| Geração de pautas | 14 | `contentIdeasGenerationService`, `contentIdeasReadinessGate` |
| Perfil no celular | 12 | `mobileStrategicProfile*` |
| Collabs | 6 | `narrativeCollabMatchingService`, `perPautaCollabMatchingService` |
| Audiência | 6 | `audienceInsightsService`, `audienceTerritoryLabels` |

Ou seja: se você procura pautas, collabs ou audiência, **procure aqui** — não numa pasta com o nome do assunto, porque ela não existe.

## Por que não foi arrumado

Mover 169 arquivos significa mexer em centenas de referências e produzir uma mudança que ninguém consegue revisar, tudo isso sem entregar nada a quem usa o produto. O custo de encontrar as coisas foi resolvido por esta nota, que é grátis e reversível.

Se algum dia a pasta for dividida, o caminho seguro é por assunto e um de cada vez, com a suíte de testes rodando entre eles.

## O que fazer com código novo

Código novo de collabs, pautas ou audiência **não** precisa ir pra lá só porque os vizinhos estão. Ver as regras de onde colocar coisa nova no `CLAUDE.md`.

## Documentação

Em 06/09/2026, 30 documentos de planejamento saíram dessa pasta para `docs/video-narrativa/`. **Doze ficaram**, porque os testes leem o conteúdo deles — são contrato executável, não planejamento.

## Ligações

[[10 Mapa do sistema]] · [[Collabs]] · [[Pautas e Roteiros]]
