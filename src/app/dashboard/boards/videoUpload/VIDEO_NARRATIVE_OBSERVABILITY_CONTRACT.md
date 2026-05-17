# Video Narrative Observability Contract

## Objetivo

Este documento define métricas, eventos, logs seguros, indicadores de qualidade e critérios de observabilidade antes de qualquer endpoint real, upload real ou beta.

Ele existe para garantir que custo, latência, falha, fallback e utilidade do resultado sejam mensuráveis antes de expor análise narrativa de vídeo para usuários.

## Escopo

- é contrato, não implementação;
- não existe analytics real nesta fase;
- não existe banco/tabela nesta fase;
- não existe endpoint real nesta fase;
- não existe upload real nesta fase;
- não existe UI nesta fase.

## Princípio Central

Não lançar análise de vídeo sem conseguir medir custo, latência, falha, fallback e utilidade do resultado.

## Métricas Obrigatórias Do Provider

Devem ser medidas futuramente:

- provider status;
- model usado;
- startedAt;
- completedAt;
- latencyMs;
- ok true/false;
- status final;
- issues count;
- rawText presente ou não, apenas como hasRawText;
- schema parse ok/fail;
- fallback usado ou não;
- confidence;
- missing video/input;
- disabled by flag;
- missing api key;
- missing client;
- provider unavailable.

## Métricas Obrigatórias Do Vídeo/Input

Devem ser medidas futuramente:

- source: gemini_file_api, inline_base64, temporary_storage, gcs, s3, r2, public_url_restricted;
- mimeType;
- durationSeconds;
- sizeBytes;
- input type: videoUri ou inlineVideoBase64;
- has creatorQuestion;
- creatorQuestion length;
- creatorContext presence;
- knownNarratives count;
- não logar base64;
- não logar URL sensível se contiver token;
- não logar vídeo.

## Métricas De Custo

Devem ser medidas futuramente:

- estimatedCost;
- costCurrency;
- token/input unit se disponível;
- video duration bucket;
- model;
- quota consumed true/false;
- usage counted reason;
- usage not counted reason;
- quota remaining se disponível;
- cost by user/account/admin;
- custo médio por análise;
- custo p95.

## Métricas De Produto/Qualidade

Devem ser medidas futuramente:

- hasUsefulAnalysis;
- hasUsefulSeed;
- primaryAction;
- blueprint generated;
- followUpQuestions count;
- brandMatch enabled;
- profileSignals count;
- seed initialIdea present;
- conversion to blueprint;
- conversion to script;
- user accepted suggestion;
- user edited generated result;
- user abandoned after analysis.

## Métricas De Falha

Falhas e bloqueios a medir:

- invalid_payload;
- usage_limited;
- quota_exceeded;
- cooldown_active;
- provider_unavailable;
- parse_failed;
- insufficient_context;
- timeout;
- blocked_unauthorized;
- blocked_forbidden;
- consent_missing;
- retention_blocked;
- storage_expired.

## Eventos Futuros Sugeridos

Eventos conceituais, sem implementação nesta fase:

- video_narrative_analysis_requested;
- video_narrative_analysis_started;
- video_narrative_analysis_completed;
- video_narrative_analysis_failed;
- video_narrative_analysis_fallback_used;
- video_narrative_seed_created;
- video_narrative_blueprint_started;
- video_narrative_script_started;
- video_narrative_usage_consumed;
- video_narrative_usage_not_consumed;
- video_narrative_limit_reached.

## Logs Seguros

Logs podem conter:

- requestId;
- userId hash ou id interno, se permitido;
- accountId;
- status;
- provider status;
- model;
- durationSeconds bucket;
- sizeBytes bucket;
- latencyMs;
- issues sanitized;
- timestamps;
- quota consumed true/false.

Logs não podem conter:

- API key;
- base64;
- vídeo bruto;
- rawText completo;
- texto completo do provider;
- URL assinada com token;
- dados sensíveis extraídos do vídeo;
- rosto/voz como atributo biométrico.

O rawText completo não deve ser logado.

## Dashboards Futuros

Painéis futuros:

- dashboard de custo diário;
- dashboard de custo por usuário;
- dashboard de latência média/p95;
- dashboard de taxa de sucesso;
- dashboard de taxa de fallback;
- dashboard de taxa de parse ok;
- dashboard de taxa de limite atingido;
- dashboard de vídeos por source;
- dashboard de análises que viraram blueprint;
- dashboard de análises que viraram roteiro.

## Alertas Futuros

Alertas futuros:

- alerta de custo acima do esperado;
- alerta de spike de falhas;
- alerta de aumento de fallback;
- alerta de parse fail acima de limite;
- alerta de latência p95 alta;
- alerta de quota próxima do limite;
- alerta de uso anormal por usuário;
- alerta de provider indisponível;
- alerta de storage cleanup falhando.

## Relação Com Contratos Existentes

Este contrato complementa:

- `VideoNarrativeUsageLimitsCostContract`;
- `VideoNarrativeConsentRetentionContract`;
- `VideoNarrativeInputSourceContract`;
- `VideoNarrativeInternalEndpointContract`;
- Gemini readiness audit;
- real run harness;
- `VideoNarrativeAnalysis`;
- `PostCreationVideoSeed`.

## Critérios Antes De Endpoint Real

Só implementar endpoint real quando:

- eventos mínimos estiverem definidos;
- logs seguros estiverem definidos;
- start hook com requestId estiver definido;
- completion hook com latencyMs estiver definido;
- métrica de latencyMs estiver planejada;
- métrica de custo estiver planejada;
- usage/quota estiver planejado;
- consentimento/retenção estiverem definidos;
- input source estiver definido;
- fallback estiver monitorável.

O futuro endpoint deve seguir `VIDEO_NARRATIVE_REAL_ENDPOINT_GUARDS_CONTRACT.md` para acionar observability start/completion hook somente depois dos guards corretos.

## Decisão Recomendada Agora

Como ainda não há billing/quota:

- não implementar analytics real;
- não criar tabela;
- não criar banco;
- não conectar provider externo;
- usar este contrato para guiar futuro endpoint;
- quando houver teste real manual, registrar resultados manualmente fora do repo.

## Próximas Fases Possíveis

- MM18: contrato de endpoint real com observability hooks;
- MM19: contrato de storage cleanup observability;
- MM20: contrato de UI beta com estados observáveis;
- MM21: implementação real somente depois de billing/teste real.
