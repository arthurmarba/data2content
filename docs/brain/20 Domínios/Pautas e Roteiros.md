---
tipo: domínio
---

# Pautas e Roteiros — o que o criador grava

## Duas coisas diferentes

**Pauta** é o assunto do vídeo. **Roteiro** é o vídeo escrito. São subsistemas separados no código, com donos diferentes.

## Pautas

| Peça | Caminho |
| --- | --- |
| Dado guardado | `src/app/models/CreatorContentIdea.ts` |
| Geração | `src/app/dashboard/boards/videoUpload/contentIdeasGenerationService.ts` |
| Portão de liberação | `contentIdeasReadinessGate.ts` |
| Ancoragem no mapa | `contentIdeaMapAnchors.ts` |
| Anti-repetição | `contentIdeasTitleDedup.ts`, `contentIdeasBatchDiversity.ts` |
| Cota | `contentIdeasGenerationQuota.ts` |

O portão é a parte importante: **não se gera pauta pra quem não tem narrativa e território**. Ver [[Pauta exige narrativa]].

A repetição é o inimigo silencioso — daí existirem três arquivos só pra evitar que a mesma ideia volte com outro nome. A lista do que evitar inclui o que o criador já salvou e o que já publicou.

## Roteiros

| Peça | Caminho |
| --- | --- |
| Motor V3 | `src/app/lib/scripts/creatorScriptGenerationV3.ts` |
| DNA do criador | `creatorScriptDnaV3.ts`, `dnaProfile.ts` (+ modelo `CreatorScriptDnaProfile`) |
| Pacote de evidência | `creatorScriptEvidencePack.ts` |
| Estilo aprendido | `styleTraining.ts`, `styleFeatures.ts`, `styleContext.ts` |
| Medição de qualidade | `benchmark.ts`, `observability.ts`, `performanceTelemetry.ts` |
| Roteiro salvo | `src/app/models/ScriptEntry.ts` |

O V3 é a linha viva — o MCP também já usa ela (`generate_script_draft`, `critique_script_against_creator_dna`).

Antes de mexer no prompt, rode o parâmetro de comparação:

```bash
npm run check:scripts-quality
```

Ele roda os testes de qualidade **e** o benchmark. Prompt sem benchmark é chute.

## Criação de post (o funil)

Caminho separado, em `src/app/dashboard/boards/postCreation*`: leva o criador da pauta até o post publicado, com quiz adaptativo (`postCreationAdaptive*`, ligado por `NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED`). Os planos escritos estão ao lado do código, em `POST_CREATION_*_PLAN.md`.

## Ligações

[[Seu Mapa]] · [[Collabs]] · [[Custo de IA é decisão de arquitetura]]
