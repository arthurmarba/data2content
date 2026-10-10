---
tipo: domínio
---

# Seu Mapa — a leitura do criador

> **Mockup em revisão:** [[Redesenho da jornada e mockup do app]] guarda a retomada do redesenho de setembro de 2026. Preservar o Perfil atual e redistribuir as ferramentas entre quatro abas é trabalho de protótipo; não confundir com mudança já publicada.

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

São **duas direções da mesma cadeia**, e as duas valem. Quem lê só uma acha que a outra
está errada.

**Geração** — como a IA constrói, escrito em `mapaLayersGuide.ts`:

> narrativa → território → **tema** → asset

**Dependência** — o que autoriza o quê, no glossário e no `CLAUDE.md`:

> asset → território → narrativa → pauta

O **tema** é o cruzamento território × narrativa: uma cena quase filmável, não o território
repetido em gerúndio. Ele existe no código e viaja no MCP (`themes`), mas ainda não está no
glossário.

Ver [[12 Glossário do produto]] pra definição de cada camada. E cuidado com duas regras que
parecem uma só — são portões diferentes, em arquivos diferentes:

1. **Liberar pauta** exige narrativa **e** territórios *presentes* — confirmados pelo criador
   **ou** detectados pela síntese. Audiência sozinha não libera. O gate está na V2:
   confirmação explícita enriquece, mas **não é mais portão duro**
   (`contentIdeasReadinessGate.ts`). Ver [[Pauta exige narrativa]].
2. **Narrativa firme** é outro carimbo: `creatorMap.ts` só marca `narrativeIsFirm` quando
   `evidenceLevel === "two_readings"`. Com uma leitura só, é ponto de partida declarado.

## A confusão a evitar

Existiram **dois caminhos paralelos** de leitura: a síntese vinda do vídeo enviado e o `MapaSeed` alimentado pelo Instagram. Por um bom tempo o segundo esteve adormecido em produção. Antes de investigar "o mapa não enriquece", descubra qual dos dois caminhos está ligado no ambiente que você está olhando. Ver [[Dois sistemas de mapa]].

## Fontes de evidência

- **Instagram** — `analyzeInstagramPosts.ts`, depende dos posts já classificados.
- **Vídeo enviado** — o criador manda um vídeo de até **90 segundos**; o Gemini lê cena, tom e coerência (`analyzeVideoCoherence.ts`). Limites e armadilhas: [[Limite de 90 segundos]] e [[Upload de vídeo dá 403]].
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

No enriquecimento automático, as etapas Gemini têm comprovantes duráveis por fonte
em `GeminiOperation`; falha de parse não repete chamada paga. Não há fallback pago
após falha neste contexto. A revisão das leituras usa assuntos, tons e objetos,
sem datas de análise; ver [[Filas e rotinas]] para política de custo e limitações.
