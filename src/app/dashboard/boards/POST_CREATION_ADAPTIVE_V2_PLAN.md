# Plano de Implementação: Board Adaptativo V2

Este documento descreve a estratégia de reintrodução do Board Adaptativo em etapas modulares, garantindo segurança e estabilidade.

## Fase V2A: Fundação & Feature Flag (Concluída)
- Reintrodução dos tipos base (`postCreationAdaptiveTypes.ts`).
- Implementação da lógica de Feature Flag isolada (`postCreationAdaptiveFeatureFlag.ts`).
- Testes unitários para a Feature Flag.

## Fase V2B: Roteamento de Intenção & Lógica (Concluída)
- Reintroduzir o roteador adaptativo para detecção de intenção (`postCreationAdaptiveRouter.ts`).
- Validar prioridades de intenção via testes unitários.
- Manter a lógica isolada, sem UI, BoardShell, endpoints ou OpenAI.

## Fase V2C: Quiz Builder Isolado (Concluída)
- Reintroduzir a construção de perguntas baseada na intenção (`postCreationAdaptiveQuizBuilder.ts`).
- Validar estrutura, mapKeys e linguagem consultiva via testes unitários.
- Manter a fase sem AnswerKey, score, UI, BoardShell, endpoints ou OpenAI.

## Fase V2D: AnswerKey & Recomendações Estratégicas (Concluída)
- Implementar o mapeamento de respostas estratégicas (`postCreationAdaptiveAnswerKey.ts`).
- Validar recomendações e linguagem consultiva via testes unitários.
- Manter a fase sem UI e sem score visual.

## Fase V2E: Strategic Plan Builder puro (Concluída)
- Criar a camada de construção do plano estratégico (`postCreationAdaptivePlanBuilder.ts`).
- Gerar cenas, 5W2H e próximas ações de forma determinística.
- Validar linguagem consultiva e integridade do plano via testes unitários.

## Fase V2F: Componentes de UI & Handoff
- Reintroduzir o NativeFlow e ScoreCard de forma modular.
- Integrar com o BoardShell através da feature flag.
- Garantir handoff seguro para o fluxo legado.
