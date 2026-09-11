---
tipo: domínio
---

# Seu Mapa — a leitura do criador

## Por que existe

É a raiz de quase tudo. Sem mapa não há pauta, não há collab que faça sentido, não há relatório com julgamento. Quando alguma dessas coisas parece quebrada, o mapa costuma ser o culpado de verdade.

## Onde mora

| Peça | Caminho |
| --- | --- |
| O dado guardado | `src/app/models/MapaSeed.ts` |
| A cozinha | `src/app/lib/mapaSeed/` |
| Confirmações do criador | `src/app/models/CreatorMapConfirmations.ts` |
| Bloco no computador | `src/app/dashboard/boards/StrategicMapPinnedBoard.tsx` |
| Rota de onboarding | `src/app/api/onboarding/mapa-seed/` |
| Enriquecimento por vídeo (fila) | `src/app/api/worker/enrich-mapa-video/` |

Dentro de `lib/mapaSeed/`, os arquivos contam a história do processo: `seedMapaSeedFromPurpose` (nasce do propósito declarado) → `enrichMapaWithInstagram` / `enrichMapaWithVideoReadings` (ganha evidência) → `generateLeituraInaugural` (vira texto pro criador) → `coreStabilityLocks` (impede que o núcleo fique mudando a cada leitura nova).

## As camadas

A ordem importa e está descrita em `mapaLayersGuide.ts`:

> asset → território → narrativa → pauta

Ver [[12 Glossário do produto]] pra definição de cada uma. Duas regras que o código guarda:

1. **Narrativa só é firme com duas leituras concordando** ou com confirmação explícita do criador.
2. **Pauta exige narrativa + território.** Audiência sozinha não libera. Ver [[Pauta exige narrativa]].

## A confusão a evitar

Existiram **dois caminhos paralelos** de leitura: a síntese vinda do vídeo enviado e o `MapaSeed` alimentado pelo Instagram. Por um bom tempo o segundo esteve adormecido em produção. Antes de investigar "o mapa não enriquece", descubra qual dos dois caminhos está ligado no ambiente que você está olhando. Ver [[Dois sistemas de mapa]].

## Fontes de evidência

- **Instagram** — `analyzeInstagramPosts.ts`, depende dos posts já classificados.
- **Vídeo enviado** — o criador manda um vídeo de até **90 segundos**; o Gemini lê cena, tom e coerência (`analyzeVideoCoherence.ts`). Limites e armadilhas: [[Limite de 90 segundos]], [[Upload de vídeo dá 403]] e [[Arquivo do Gemini usado antes de ficar ACTIVE]].
- **Declaração de propósito** — a resposta do criador no onboarding, o "Norte".

## Ligações

[[Pautas e Roteiros]] · [[Collabs]] · [[Relatório Semanal]] · [[Cadeia narrativa e pauta]]


## Propostas de revisão do núcleo

`lib/mapaSeed/mapSuggestions.ts` acumula propostas de Instagram e vídeo sem
substituir uma frase já existente. Duas leituras só contam duas vezes quando há
posts novos; um núcleo vazio pode ser preenchido após essa concordância.
`mapConfirmationReproposalService` delega ao mesmo mecanismo, preservando a
confirmação. `mapSuggestionService` aceita/edita em transação com a confirmação e
recusa sugestões cuja revisão ou frase de origem mudou.

O worker `enrich-mapa-instagram` separa enriquecimento da sincronização, reaproveita
cenas e checkpoints e respeita revisão das fontes. O intervalo do mapa segue em
12 horas; a atualização descritiva do Perfil é independente. Os documentos de
mapa usam concorrência otimista; uma gravação antiga não deve substituir edição
mais nova. Falhas ao ler confirmações interrompem o enriquecimento.
