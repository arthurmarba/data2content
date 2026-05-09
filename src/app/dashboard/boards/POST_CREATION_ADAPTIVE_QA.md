# QA da experiencia adaptativa do Board de Criacao de Post

Este checklist valida a experiencia adaptativa antes de liberar a feature flag para teste interno real.

## Objetivo

Validar que a experiencia adaptativa aparece somente para usuarios autorizados, funciona nos fluxos principais, persiste no draft existente e nao altera o fluxo legado.

## Pre-condicoes

- Rodar localmente com um usuario autenticado.
- Ter acesso a um usuario comum e a um usuario com `role` igual a `admin` ou `dev`.
- Confirmar que `NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED` nao esta definido como `"1"` para testar a flag OFF.
- Abrir o Board de Criacao de Post no dashboard.
- Usar DevTools para inspecionar `localStorage`, Network e chamadas para drafts/eventos.

## Como ativar em ambiente local/dev

### Ativacao global

Defina:

```bash
NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED=1
```

Resultado esperado: a experiencia adaptativa aparece para todos os usuarios.

### Ativacao interna por query

Com usuario `admin` ou `dev`, abrir o board com:

```text
?adaptiveBoard=1
```

Resultado esperado:

- A secao "Nova experiencia estrategica" aparece.
- `localStorage["d2c:postCreationAdaptiveEnabled"]` fica igual a `"1"`.

### Ativacao interna por localStorage

Com usuario `admin` ou `dev`, executar no console:

```js
localStorage.setItem("d2c:postCreationAdaptiveEnabled", "1");
```

Recarregar a pagina.

Resultado esperado: a secao adaptativa aparece.

## Como desativar

Com usuario `admin` ou `dev`, abrir o board com:

```text
?adaptiveBoard=0
```

Resultado esperado:

- A secao adaptativa desaparece.
- `localStorage["d2c:postCreationAdaptiveEnabled"]` e removido.

Tambem e possivel executar:

```js
localStorage.removeItem("d2c:postCreationAdaptiveEnabled");
```

## Cenario A: flag OFF

Passos:

1. Garantir que `NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED` nao e `"1"`.
2. Abrir o board sem `adaptiveBoard=1`.
3. Usar usuario comum.

Esperado:

- A experiencia adaptativa nao aparece.
- O fluxo legado continua igual.
- Nao ha chamadas para `/api/post-creation/adaptive/start` ou `/api/post-creation/adaptive/plan`.

## Cenario B: admin/dev ativa via query

Passos:

1. Entrar como `admin` ou `dev`.
2. Abrir o board com `?adaptiveBoard=1`.

Esperado:

- A secao "Nova experiencia estrategica" aparece.
- `localStorage["d2c:postCreationAdaptiveEnabled"] === "1"`.
- O fluxo legado permanece abaixo/intacto.

## Cenario C: admin/dev desativa via query

Passos:

1. Entrar como `admin` ou `dev`.
2. Abrir com `?adaptiveBoard=0`.

Esperado:

- A secao adaptativa desaparece.
- O override local e removido.
- O fluxo legado segue funcional.

## Cenario D: usuario comum tenta ativar

Passos:

1. Entrar como usuario comum.
2. Abrir com `?adaptiveBoard=1`.
3. Opcionalmente setar `localStorage["d2c:postCreationAdaptiveEnabled"] = "1"`.

Esperado:

- A experiencia adaptativa nao aparece.
- Usuario comum nao consegue ativar via query ou localStorage.

## Cenario E: fluxo validate_pauta

Input:

```text
Quero gravar um POV sobre minha familia fazendo barulho quando tento relaxar
```

Passos:

1. Inserir o input.
2. Clicar em "Transformar em estrategia".
3. Selecionar respostas do quiz.
4. Gerar o plano 5W2H.
5. Clicar em "Usar este plano".

Esperado:

- Detecta modo de validar pauta.
- Mostra quiz.
- Permite selecionar respostas.
- Gera plano 5W2H.
- Mostra botao "Usar este plano".
- Ao usar, vai para blueprint.
- Nao salva no planner.
- Nao gera roteiro automatico.

## Cenario F: fluxo discover_pauta

Input:

```text
Nao sei o que postar essa semana
```

Esperado:

- Detecta descobrir pauta.
- Mostra quiz.
- Gera plano.
- Handoff leva para blueprint sem quebrar o legado.

## Cenario G: fluxo brand_match

Input:

```text
Quero atrair marcas de skincare
```

Esperado:

- Detecta match com marca.
- Plano mostra `brandMatch`.
- Proximas acoes incluem ver marcas ou equivalente.
- Limitacao atual: painel real de marcas ainda nao esta acoplado ao plano adaptativo.

## Cenario H: persistencia de draft

Passos:

1. Ativar a experiencia como admin/dev.
2. Iniciar fluxo adaptativo.
3. Responder pelo menos uma pergunta.
4. Aguardar autosave.
5. Recarregar a pagina.
6. Gerar plano.
7. Aguardar autosave.
8. Recarregar novamente.

Esperado:

- Input, perguntas e respostas sao restaurados.
- Depois de gerar plano, o plano tambem e restaurado.
- Drafts legados sem `state.adaptive` continuam abrindo normalmente.

## Cenario I: autosave

Passos:

1. Abrir DevTools > Network.
2. Filtrar por `/api/post-creation/drafts`.
3. Iniciar fluxo adaptativo e responder perguntas.
4. Observar as chamadas.

Esperado:

- Ha autosave apos mudancas reais.
- Nao ha chamadas repetitivas infinitas.
- `updatedAt` do snapshot nao causa loop de assinatura.

## Cenario J: eventos

Passos:

1. Iniciar fluxo.
2. Responder pergunta.
3. Gerar plano.
4. Usar plano.
5. Filtrar Network por `/api/post-creation/events`.

Esperado:

- Eventos fire-and-forget sao enviados para inicio, quiz, resposta, plano gerado e uso do plano.
- Falha de evento nao quebra a experiencia.

## Cenario K: reset

Passos:

1. Iniciar fluxo.
2. Gerar plano.
3. Clicar em "Criar outra estrategia".

Esperado:

- Experiencia adaptativa limpa input, quiz, respostas, plano e handoff.
- Draft nao quebra.
- Fluxo legado permanece funcional.

## Cenario L: build e testes

Rodar:

```bash
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveFeatureFlag.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationDraftAdaptiveState.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveSnapshot.test.ts
npm test -- --runInBand src/app/dashboard/boards/usePostCreationAdaptiveFlow.test.tsx
npm test -- --runInBand src/app/dashboard/boards/components/PostCreationAdaptiveComponents.test.tsx
npm test -- --runInBand src/app/api/post-creation/events/payload.test.ts
npm test -- --runInBand src/app/api/post-creation/adaptive/payload.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveHandoffState.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveLegacyAdapter.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptivePlanBuilder.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveQuizBuilder.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveRouter.test.ts
npm run typecheck
npm run build
```

Esperado:

- Todos os testes passam.
- Typecheck passa.
- Build passa.

## Problemas conhecidos e limitacoes

- O match real com marcas/collabs ainda nao esta acoplado ao plano adaptativo.
- O handoff usa estruturas sinteticas para o fluxo legado, sem `PlannerUISlot` real.
- A experiencia ainda nao deve ser liberada globalmente.
- Eventos adaptativos sao registrados, mas o summary admin pode ainda nao exibir todos os novos eventos de forma dedicada.
- O QA visual completo deve ser feito manualmente em desktop e mobile antes de liberar para usuarios internos.

## Criterios de bloqueio

Bloquear liberacao interna se qualquer item ocorrer:

- Usuario comum consegue ativar a experiencia sem env flag global.
- Flag OFF mostra UI adaptativa para usuario comum.
- Autosave entra em loop.
- Build ou typecheck quebra.
- Handoff nao leva para blueprint.
- Clicar "Usar este plano" salva no planner ou gera roteiro automaticamente.
