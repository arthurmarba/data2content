# Video Narrative Endpoint Skeleton Readiness

## Objetivo

Este documento confirma se a fundação atual está pronta para criar um futuro endpoint skeleton admin/dev sem provider real para análise narrativa de vídeo.

Ele mapeia o que já existe, o que o endpoint skeleton poderá usar, o que deve continuar desligado, quais riscos bloqueiam provider real e quais critérios precisam estar verdes antes de criar `route.ts`.

## Escopo

- é checklist, não implementação;
- MM26 era checklist, não implementação;
- em MM27 existe endpoint skeleton interno/admin-dev;
- em MM27 existe `route.ts` skeleton;
- não existe provider real nesta fase;
- não existe chamada Gemini real;
- sem chamada Gemini real;
- não existe upload real;
- sem upload real;
- não existe UI;
- sem UI;
- não existe banco/tabela;
- sem banco/tabela;
- não existe analytics real.
- sem analytics real.

## Princípio Central

Só criar o endpoint skeleton se ele puder nascer bloqueado, observável e incapaz de vazar dados sensíveis.

## Fundação Disponível

A fundação já disponível para uma próxima fase de skeleton inclui:

- `VideoNarrativeAnalysis`;
- `PostCreationVideoSeed`;
- Gemini prompt/schema;
- Gemini provider/factory/composer;
- real run harness;
- readiness audit;
- endpoint contract;
- input source contract;
- consent/retention contract;
- usage/cost contract;
- observability contract;
- real endpoint guards contract;
- guard contracts;
- payload validation;
- input source guards;
- consent/retention guards;
- usage/quota guards;
- observability events;
- safe response builder.

## O Que O Endpoint Skeleton Pode Usar

O futuro endpoint skeleton pode usar:

- `validateVideoNarrativeAnalyzePayload`;
- `validateVideoNarrativeInputSourceForPhase`;
- `validateVideoNarrativeConsentRetentionForPhase`;
- `validateVideoNarrativeUsageQuotaForPhase`;
- `summarizeVideoNarrativeGuardResults`;
- `buildVideoNarrativeObservabilityEvent`;
- `buildBlockedVideoNarrativeSafeResponse`;
- `buildVideoNarrativeSafeResponse`;
- `validateVideoNarrativeSafeResponse`.

## O Que O Endpoint Skeleton Não Deve Fazer Ainda

O endpoint skeleton não deve:

- chamar `runGeminiVideoNarrativeProviderFromEnv`;
- chamar Gemini real;
- aceitar usuário comum;
- aceitar upload real;
- aceitar multipart;
- persistir dados;
- consumir quota real;
- enviar analytics real;
- conectar BoardShell;
- alterar PostCreationFunnelState;
- criar billing/Stripe;
- usar storage real.

## Endpoint Skeleton Futuro

Caminho futuro:

`POST /api/internal/video-narrative/analyze`

MM27 cria esse caminho como skeleton interno/admin-dev. Ele continua sem provider real, sem upload real, sem persistência e sem analytics real.

MM28 evolui o skeleton para `VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE=mock`, permitindo retorno narrativo simulado útil para UX/UI futura. O provider real continua bloqueado e o modo `real` retorna safe response disabled.

## Comportamento Esperado Do Skeleton Futuro

Quando for criado, o endpoint skeleton deve:

- aceitar apenas POST;
- exigir sessão;
- exigir admin/dev;
- exigir flag server-side específica do endpoint skeleton;
- validar payload;
- validar input source para `internal_endpoint`;
- validar consent/retention para `internal_endpoint`;
- validar usage/quota para `internal_endpoint`;
- criar eventos locais em memória/response apenas;
- nunca chamar provider real nesta primeira versão;
- retornar safe response bloqueado ou fallback controlado;
- nunca retornar rawText/base64/API key/vídeo/URL assinada.

## Nova Flag Futura Sugerida

Flag sugerida:

`VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED=true`

Regras:

- server-side;
- não `NEXT_PUBLIC`;
- separada de `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED`;
- endpoint skeleton pode estar ligado sem ligar provider real;
- provider real continua dependente da flag Gemini.

## Status Esperados Do Skeleton

- `disabled`;
- `unauthorized`;
- `forbidden`;
- `invalid_payload`;
- `invalid_source`;
- `consent_missing`;
- `retention_expired`;
- `usage_limited`;
- `ready_without_provider`;
- `blocked`.

## Critérios Para Criar Route.ts Na Próxima Fase

Só criar route.ts se:

- este checklist estiver verde;
- #822 estiver verde;
- endpoint skeleton flag estiver definida;
- rota nascer admin/dev only;
- provider real permanecer desligado;
- response builder for usado;
- não houver `app/api/internal/video-narrative/analyze/route.ts` ainda;
- testes cobrirem bloqueios principais;
- build passar.

## Critérios Que Continuam Bloqueando Provider Real

Provider real continua bloqueado por:

- billing/quota ausente;
- teste real com 3 vídeos curtos ainda não realizado;
- custo/latência real desconhecidos;
- origem real do vídeo ainda não finalizada para produto;
- storage/cleanup real ausentes;
- analytics real ausente;
- limite por usuário ainda sem persistência.

## Decisão Recomendada

MM27 implementa parcialmente a próxima fase: o endpoint skeleton admin/dev existe e nasce bloqueado por flag server-side e pela ausência intencional de provider real.

MM28 permite mock mode interno com análise simulada útil, mas ainda não liga Gemini real.

## Próximas Fases Possíveis

- MM28: reforço dos guards puros do skeleton, se necessário;
- MM29: storage cleanup contract;
- MM30: provider real somente depois de billing/teste manual.
