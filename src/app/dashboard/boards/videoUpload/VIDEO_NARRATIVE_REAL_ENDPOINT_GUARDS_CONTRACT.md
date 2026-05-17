# Video Narrative Real Endpoint Guards Contract

## Objetivo

Este documento define a ordem e responsabilidade dos guards obrigatórios antes de implementar o futuro endpoint real/admin de análise narrativa de vídeo.

Ele existe para garantir que o provider real só seja chamado depois que acesso, configuração, payload, origem do vídeo, consentimento, retenção, uso e observabilidade estiverem validados.

## Escopo

- é contrato, não implementação;
- não existe endpoint real nesta fase;
- não existe route.ts nesta fase;
- não existe upload real nesta fase;
- não existe UI nesta fase;
- não existe banco/tabela nesta fase;
- não existe chamada Gemini real nesta fase.

## Princípio Central

O endpoint real só deve chamar o provider depois que acesso, flag, payload, consentimento, origem do vídeo, uso e observabilidade estiverem resolvidos.

## Endpoint Futuro

Caminho futuro, sem criar nesta fase:

```text
POST /api/internal/video-narrative/analyze
```

## Ordem Obrigatória Dos Guards

### 1. Method Guard

- aceitar apenas POST;
- qualquer outro método retorna `method_not_allowed`.

### 2. Session Guard

- exigir sessão autenticada.

### 3. Admin/Dev Guard

- permitir apenas admin/dev;
- usuários comuns bloqueados.

### 4. Feature Flag Guard

- exigir `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED=true`;
- flag server-side;
- nunca `NEXT_PUBLIC` para custo real.

### 5. Content-Type Guard

- exigir JSON;
- bloquear multipart nesta primeira versão.

### 6. Payload Size Guard

- limitar payload;
- inline base64 só pequeno/controlado.

### 7. Payload Schema Guard

- validar id;
- validar creatorQuestion;
- validar videoUri OU inlineVideoBase64 + mimeType;
- validar source;
- validar creatorContext.

MM20 adiciona `validateVideoNarrativeAnalyzePayload` como helper puro para preparar este guard futuro sem criar endpoint, route.ts ou chamada real.

### 8. Input Source Guard

- aceitar sources documentados: gemini_file_api, inline_base64, temporary_storage, gcs, s3, r2, public_url_restricted;
- restringir public_url_restricted;
- bloquear base64 como fluxo principal.

MM21 adiciona `validateVideoNarrativeInputSourceForPhase` e políticas puras por fase para preparar este guard futuro sem criar endpoint, route.ts, upload real ou storage real.

### 9. Mime/Duration/Size Guard

- mimeTypes permitidos;
- duração até 60s no início;
- tamanho até 100MB quando houver storage/upload.

### 10. Consent Guard

- exigir confirmação futura de consentimento antes de beta;
- admin/manual pode ter bypass documentado, mas não para usuário comum.

MM22 adiciona helpers puros para preparar este guard por fase, mantendo bypass apenas para fases internas/admin e exigindo consentimento explícito para beta/produto.

### 11. Retention Guard

- exigir expiresAt quando houver storage temporário;
- não aceitar arquivo expirado.

MM22 adiciona helpers puros para validar `expiresAt`, expiração e limite máximo de retenção por fase, sem criar storage real ou cleanup real.

### 12. Usage/Quota Guard

- verificar limite;
- `usage_limited`;
- `quota_exceeded`;
- `cooldown_active`;
- falhas antes do provider não consomem quota.

MM23 adiciona helpers puros para preparar este guard por fase, incluindo limite mensal, limite diário, cooldown e bypass interno quando permitido, sem billing real ou cobrança.

### 13. Observability Start Hook

- criar requestId;
- marcar startedAt;
- registrar evento conceitual video_narrative_analysis_started;
- logs sem vídeo/base64/API key/rawText.

MM24 adiciona `buildVideoNarrativeObservabilityEvent` para preparar esse hook futuro com payload seguro, requestId, buckets e redação de campos sensíveis, ainda sem analytics real.

### 14. Provider Call

- chamar `runGeminiVideoNarrativeProviderFromEnv`;
- nunca chamar provider se guard anterior falhou.

### 15. Parse/Fallback Handling

- aceitar fallback seguro;
- não retornar rawText completo;
- retornar hasRawText.

### 16. Seed Generation

- `buildPostCreationVideoSeedFromAnalysis`;
- `getPostCreationVideoSeedPrimaryAction`.

### 17. Usage Consumption

- consumir quota apenas se regra de consumo permitir;
- resposta parcial útil pode consumir;
- payload inválido não consome;
- falha antes do provider não consome.

MM23 adiciona `decideVideoNarrativeUsageConsumption` para formalizar os motivos futuros de consumo ou não consumo de quota antes de qualquer endpoint real.

### 18. Observability Completion Hook

- registrar completed/failed/fallback/usage;
- medir latencyMs;
- registrar provider status;
- registrar parse ok/fail;
- registrar cost estimate no futuro.

MM24 também prepara eventos de completion, failure, fallback, seed, usage consumed/not consumed e limit reached sem enviar nada para ferramenta externa.

### 19. Safe Response

- retornar ok/status/analysis/seed/primaryAction/issues/hasRawText;
- nunca retornar rawText completo;
- nunca retornar API key;
- nunca retornar base64.

MM25 adiciona `buildVideoNarrativeSafeResponse`, `buildBlockedVideoNarrativeSafeResponse` e `validateVideoNarrativeSafeResponse` como fundação pura para esta etapa, garantindo que `rawText`, base64, API key, vídeo bruto e URL assinada não saiam no response.

## Payload Futuro

Exemplo conceitual:

```json
{
  "id": "manual-video-narrative-run",
  "creatorQuestion": "Quero saber se vale postar",
  "videoUri": "file-or-storage-uri",
  "inlineVideoBase64": null,
  "mimeType": "video/mp4",
  "source": "gemini_file_api | inline_base64 | temporary_storage | gcs | s3 | r2 | public_url_restricted",
  "creatorContext": {
    "handle": "...",
    "niche": "...",
    "knownNarratives": []
  },
  "consent": {
    "accepted": true,
    "acceptedAt": "future-timestamp"
  }
}
```

## Response Futura

Exemplo conceitual:

```json
{
  "ok": true,
  "status": "ready",
  "analysis": {},
  "seed": {},
  "primaryAction": "transformar em blueprint",
  "issues": [],
  "hasRawText": true,
  "requestId": "video-narrative-request"
}
```

## Status Futuros

- `method_not_allowed`;
- `unauthorized`;
- `forbidden`;
- `disabled`;
- `invalid_content_type`;
- `payload_too_large`;
- `invalid_payload`;
- `invalid_source`;
- `invalid_mime_type`;
- `consent_missing`;
- `retention_expired`;
- `usage_limited`;
- `quota_exceeded`;
- `cooldown_active`;
- `provider_unavailable`;
- `parse_failed`;
- `insufficient_context`;
- `ready`;
- `failed`.

## O Que Não Consome Quota

- método inválido;
- sem sessão;
- sem permissão;
- flag desligada;
- payload inválido;
- vídeo ausente;
- mime inválido;
- consentimento ausente;
- arquivo expirado;
- falha antes de chamar provider.

## O Que Pode Consumir Quota

- provider chamado e retornou `VideoNarrativeAnalysis` útil;
- resposta parcial útil;
- reprocessamento manual explícito;
- nova análise solicitada pelo usuário no beta/produto.

## Observabilidade Mínima Obrigatória

- requestId;
- startedAt;
- completedAt;
- latencyMs;
- provider status;
- schema parse ok/fail;
- fallback used;
- quota consumed;
- usage not consumed reason;
- source;
- mimeType;
- duration bucket;
- size bucket;
- hasUsefulSeed;
- primaryAction.

## Segurança

- não logar API key;
- não logar base64;
- não logar vídeo;
- não logar rawText completo;
- não logar URL assinada com token;
- issues sanitizadas;
- usar server-side only;
- sem `NEXT_PUBLIC` para provider real.

## Relação Com Contratos Existentes

Este contrato complementa:

- `VideoNarrativeInternalEndpointContract`;
- `VideoNarrativeInputSourceContract`;
- `VideoNarrativeConsentRetentionContract`;
- `VideoNarrativeUsageLimitsCostContract`;
- `VideoNarrativeObservabilityContract`;
- Gemini readiness audit;
- `runGeminiVideoNarrativeProviderFromEnv`;
- `VideoNarrativeAnalysis`;
- `PostCreationVideoSeed`.

MM19 adiciona `VideoNarrativeGuardResult`, `VideoNarrativeGuardPipelineSummary` e `VIDEO_NARRATIVE_GUARD_ORDER` como fundação pura para representar essa ordem de guards, ainda sem endpoint real.

MM20 adiciona `VideoNarrativeAnalyzePayload`, `VideoNarrativeNormalizedAnalyzePayload` e `validateVideoNarrativeAnalyzePayload` como fundação pura para o futuro payload_schema guard e parte do input_source guard.

MM21 adiciona `VideoNarrativeInputSourceGuardPolicy`, `VideoNarrativeInputSourcePhase` e `validateVideoNarrativeInputSourceForPhase` como fundação pura específica para o input_source guard.

MM22 adiciona `VideoNarrativeConsentPolicy`, `VideoNarrativeRetentionPolicy` e `validateVideoNarrativeConsentRetentionForPhase` como fundação pura para os guards consent e retention.

MM23 adiciona `VideoNarrativeUsagePolicy`, `VideoNarrativeQuotaGuardResult` e `VideoNarrativeUsageConsumptionDecision` como fundação pura para usage_quota e usage_consumption.

MM24 adiciona `VideoNarrativeObservabilityEventPayload` e helpers de build/validate/redact como fundação pura para os hooks de observabilidade do endpoint futuro.

MM25 adiciona `VideoNarrativeSafeResponse` como fundação pura para o safe_response guard e para o empacotamento final do endpoint futuro.

MM26 adiciona `VIDEO_NARRATIVE_ENDPOINT_SKELETON_READINESS.md` como checklist final antes de qualquer `route.ts`, separando endpoint skeleton admin/dev sem provider real de provider real com Gemini.

MM27 cria `src/app/api/internal/video-narrative/analyze/route.ts` como endpoint skeleton admin/dev. A rota usa guards puros, observabilidade local e safe response, mas bloqueia na etapa `provider` e não chama Gemini real.

MM28 adiciona mock provider como etapa temporária controlada antes do provider real. Quando `VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE=mock`, a rota chama apenas `runVideoNarrativeMockProvider`, gera seed e safe response; quando o modo é `real`, continua bloqueando sem chamar Gemini.

## Critérios Antes De Implementar Route.ts

Só criar route.ts depois que:

- billing/quota estiver disponível;
- harness real rodar pelo menos 3 vídeos curtos;
- prompt/schema forem ajustados;
- input source estiver decidido;
- consentimento/retenção estiverem aprovados;
- usage/quota estiverem implementáveis;
- observability hooks estiverem definidos;
- payload validation contracts estiverem disponíveis para `payload_schema`;
- input/source guard helpers estiverem disponíveis para `input_source`;
- consent/retention guard helpers estiverem disponíveis para `consent` e `retention`;
- usage/quota guard helpers estiverem disponíveis para `usage_quota` e `usage_consumption`;
- observability event contracts estiverem disponíveis para start/completion hooks;
- safe response builder estiver disponível para `safe_response`;
- endpoint skeleton readiness estiver verde;
- admin/dev guard server-side estiver confirmado.

## Decisão Recomendada Agora

Como ainda não há billing/quota:

- não criar route.ts;
- não criar endpoint;
- manter apenas contrato;
- próximo passo pode ser contrato de storage cleanup ou implementação de guards puros, sem endpoint.

## Próximas Fases Possíveis

- MM19: contratos puros de guard result/status;
- MM20: payload validation contracts;
- MM21: input/source guard helpers;
- MM22: consent/retention guard helpers;
- MM23: usage/quota guard helpers;
- MM24: observability event contracts;
- MM25: safe response builder;
- MM26: endpoint skeleton readiness;
- MM27: endpoint skeleton admin/dev sem provider real;
- MM28: storage cleanup contract;
- MM29: endpoint real somente depois de billing/teste real;
- MM30: preview interno com endpoint real.
