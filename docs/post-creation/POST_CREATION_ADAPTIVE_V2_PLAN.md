# Board Adaptativo V2 - Status do Rollout

Este documento registra o estado atual da reconstrução do Board Adaptativo V2 após o revert do PR #784.

A V2 foi reintroduzida em camadas pequenas e verificáveis: primeiro lógica pura, depois QA do pipeline, depois uma UI preview isolada e, por fim, um harness interno protegido por flag. Até este momento, nada foi conectado ao fluxo real do produto.

## Resumo da V2

A implementação atual cobre:

- Lógica pura de detecção, perguntas, leitura estratégica e plano.
- QA de pipeline completo: Router -> QuizBuilder -> AnswerKey -> PlanBuilder.
- UI preview isolada, renderizada apenas por props.
- Harness interno em rota própria, protegido por env flag e sessão admin/dev.
- Cenários controlados do pipeline para visualização interna.

A implementação atual não cobre:

- Integração com `PostCreationFunnelBoardShell`.
- Exibição no produto real.
- Persistência de pauta.
- Uso de usuário real.
- Banco de dados.
- OpenAI.
- Input livre.
- Handoff para Planner, Media Kit, marcas, collabs reais ou DNA Narrativo.

## Mapa das Fases

| Fase | Status | Arquivos principais | O que faz |
| --- | --- | --- | --- |
| V2A - Fundação tipada e feature flag isolada | Concluída | `postCreationAdaptiveTypes.ts`, `postCreationAdaptiveFeatureFlag.ts`, `postCreationAdaptiveFeatureFlag.test.ts` | Reintroduz tipos base e controle isolado por flag. |
| V2B - Roteador heurístico de intenção isolado | Concluída | `postCreationAdaptiveRouter.ts`, `postCreationAdaptiveRouter.test.ts` | Detecta intenções como validar pauta, descobrir pauta, formato, marca, collab e comentário para post. |
| V2C - Quiz Builder isolado | Concluída | `postCreationAdaptiveQuizBuilder.ts`, `postCreationAdaptiveQuizBuilder.test.ts` | Gera perguntas determinísticas por modo, com linguagem consultiva e sem UI. |
| V2D - AnswerKey & Recomendações Estratégicas | Concluída | `postCreationAdaptiveAnswerKey.ts`, `postCreationAdaptiveAnswerKey.test.ts` | Avalia respostas e gera leitura consultiva sem score visual. |
| V2E - Strategic Plan Builder puro | Concluída | `postCreationAdaptivePlanBuilder.ts`, `postCreationAdaptivePlanBuilder.test.ts` | Monta plano estratégico, 5W2H, cenas, próximas ações e blocos opcionais de marca/collab. |
| V2F - QA do pipeline invisível | Concluída | `postCreationAdaptivePipeline.test.ts` | Valida o pipeline completo com jornadas obrigatórias e guarda de linguagem. |
| V2G - Evitar collabMatch automático em validate_pauta | Concluída | `postCreationAdaptivePlanBuilder.ts`, `postCreationAdaptivePlanBuilder.test.ts`, `postCreationAdaptivePipeline.test.ts` | Impede que `validate_pauta` gere collab automaticamente apenas por mapKey `collab`. |
| V2H - UI Preview isolada | Concluída | `components/adaptiveV2/AdaptiveV2Preview.tsx`, `AdaptiveV2IntentPreview.tsx`, `AdaptiveV2QuestionPreview.tsx`, `AdaptiveV2AnswerKeyPreview.tsx`, `AdaptiveV2PlanPreview.tsx`, `AdaptiveV2Preview.test.tsx` | Renderiza a experiência adaptativa por props, sem chamar pipeline, fetch, OpenAI, browser APIs ou BoardShell. |
| V2I - Preview Harness isolado com fixture estática | Concluída | `adaptive-v2-preview/page.tsx`, `adaptive-v2-preview/page.test.tsx`, `components/adaptiveV2/adaptiveV2PreviewFixture.ts` | Cria rota interna protegida por flag usando dados fixture. |
| V2J - Preview Harness com cenários controlados do pipeline | Concluída | `components/adaptiveV2/buildAdaptiveV2PreviewScenario.ts`, `adaptive-v2-preview/page.tsx`, `adaptive-v2-preview/page.test.tsx` | Permite visualizar cenários fixos que rodam o pipeline local, sem input livre e sem fluxo real. |

## Harness Interno

Rota:

```text
/dashboard/boards/adaptive-v2-preview
```

Flag necessária:

```text
NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED=1
```

Com a flag desligada, a rota renderiza um estado bloqueado e não monta a preview.
Com a flag ligada, a rota ainda exige sessão interna com `role: "admin"`, `role: "dev"`, `isAdmin` ou `isDev`.

### Cenários disponíveis

```text
/dashboard/boards/adaptive-v2-preview?scenario=validate-pauta
/dashboard/boards/adaptive-v2-preview?scenario=format-guidance
/dashboard/boards/adaptive-v2-preview?scenario=discover-pauta
/dashboard/boards/adaptive-v2-preview?scenario=brand-match
/dashboard/boards/adaptive-v2-preview?scenario=collab-match
/dashboard/boards/adaptive-v2-preview?scenario=comment-to-post
```

Se `scenario` estiver ausente ou inválido, o harness usa `validate-pauta` como padrão.

## Limites Atuais

- A V2 não está conectada ao BoardShell.
- A V2 não aparece no produto real.
- A V2 não salva pauta.
- A V2 não usa usuário real.
- A V2 não acessa banco.
- A V2 não usa OpenAI.
- A V2 não tem input livre.
- A V2 usa cenários controlados no harness.
- A proteção atual combina env flag e sessão admin/dev.
- O harness não adiciona link em menu ou navegação principal.

## Critérios Antes de Conectar no BoardShell

Antes de qualquer integração experimental com o BoardShell:

- Validar visualmente o harness em browser real.
- Revisar linguagem e tom com foco em mentoria consultiva.
- Decidir explicitamente se haverá score visual ou se a V2 seguirá sem score.
- Revisar se a política admin/dev deve ser centralizada com outros acessos internos do produto.
- Definir handoff para fluxo real sem quebrar o legado.
- Definir se e como haverá salvar pauta.
- Criar plano de rollback.
- Manter a feature flag desligada em produção até aprovação.
- Revalidar que não há promessa de performance, linguagem de prova ou termos de jogo.

## Comandos de QA Recomendados

```bash
npm test -- --runInBand src/app/dashboard/boards/adaptive-v2-preview/page.test.tsx
npm test -- --runInBand src/app/dashboard/boards/components/adaptiveV2/AdaptiveV2Preview.test.tsx
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptivePipeline.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptivePlanBuilder.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveAnswerKey.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveQuizBuilder.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveRouter.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveFeatureFlag.test.ts
npm run typecheck
```

## Próximas Fases Sugeridas

- V2L: QA visual manual no harness.
- V2M: Integração experimental no BoardShell atrás da flag.
- V2O: Handoff para plano real ou salvar pauta.
- V2P: Decisão sobre liberar para beta interno.
