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

Desde 07/09/2026, o seletor comum (`scriptEvidenceSelection.ts`) começa pelos
posts com métricas atuais, cruza as transcrições disponíveis e distingue vencedor
de exemplo de voz. `get_script_evidence_pack` permite escrita pelo modelo da
conversa; o fallback textual interno também recebe as mesmas evidências.
Capacidade privada, origem, período e cobertura são parte do contrato.

`ScriptEvidenceSession` é uma revisão privada com validade de sete dias, usada
na crítica e no salvamento. `ScriptEntry.evidenceProvenance` guarda fontes,
métricas e versões do texto; `creatorFeedback` guarda preferências expressas.
Novas leituras e mudanças de vínculo enfileiram `scriptEvidenceMaintenance.ts`;
esse serviço atualiza desempenho/vínculo/DNA sem Gemini. A consulta não reconstrói
DNA na requisição e avisa quando ele estiver defasado.

Qualidade de transcrição é estrutural, não reconhecimento certificado do locutor.
`scriptVoiceReview.ts` compara sinais textuais e oferece rubrica editorial; não
prometer voz aprendida quando só há legenda/roteiro planejado, nem tratar o
benchmark automático como preferência humana demonstrada.

Antes de mexer no prompt, rode o parâmetro de comparação:

```bash
npm run check:scripts-quality
```

Ele roda os testes de qualidade **e** o benchmark. Prompt sem benchmark é chute.

## Criação de post (o funil)

Caminho separado, em `src/app/dashboard/boards/postCreation*`: leva o criador da pauta até o post publicado, com quiz adaptativo (`postCreationAdaptive*`, ligado por `NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED`). Os planos escritos estão ao lado do código, em `POST_CREATION_*_PLAN.md`.

## Ligações

[[Seu Mapa]] · [[Collabs]] · [[Custo de IA é decisão de arquitetura]]
