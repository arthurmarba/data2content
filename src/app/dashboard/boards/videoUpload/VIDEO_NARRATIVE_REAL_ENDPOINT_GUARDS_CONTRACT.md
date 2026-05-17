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

### 8. Input Source Guard

- aceitar sources documentados: gemini_file_api, inline_base64, temporary_storage, gcs, s3, r2, public_url_restricted;
- restringir public_url_restricted;
- bloquear base64 como fluxo principal.

### 9. Mime/Duration/Size Guard

- mimeTypes permitidos;
- duração até 60s no início;
- tamanho até 100MB quando houver storage/upload.

### 10. Consent Guard

- exigir confirmação futura de consentimento antes de beta;
- admin/manual pode ter bypass documentado, mas não para usuário comum.

### 11. Retention Guard

- exigir expiresAt quando houver storage temporário;
- não aceitar arquivo expirado.

### 12. Usage/Quota Guard

- verificar limite;
- `usage_limited`;
- `quota_exceeded`;
- `cooldown_active`;
- falhas antes do provider não consomem quota.

### 13. Observability Start Hook

- criar requestId;
- marcar startedAt;
- registrar evento conceitual video_narrative_analysis_started;
- logs sem vídeo/base64/API key/rawText.

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

### 18. Observability Completion Hook

- registrar completed/failed/fallback/usage;
- medir latencyMs;
- registrar provider status;
- registrar parse ok/fail;
- registrar cost estimate no futuro.

### 19. Safe Response

- retornar ok/status/analysis/seed/primaryAction/issues/hasRawText;
- nunca retornar rawText completo;
- nunca retornar API key;
- nunca retornar base64.

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

## Critérios Antes De Implementar Route.ts

Só criar route.ts depois que:

- billing/quota estiver disponível;
- harness real rodar pelo menos 3 vídeos curtos;
- prompt/schema forem ajustados;
- input source estiver decidido;
- consentimento/retenção estiverem aprovados;
- usage/quota estiverem implementáveis;
- observability hooks estiverem definidos;
- admin/dev guard server-side estiver confirmado.

## Decisão Recomendada Agora

Como ainda não há billing/quota:

- não criar route.ts;
- não criar endpoint;
- manter apenas contrato;
- próximo passo pode ser contrato de storage cleanup ou implementação de guards puros, sem endpoint.

## Próximas Fases Possíveis

- MM19: contratos puros de guard result/status;
- MM20: storage cleanup contract;
- MM21: endpoint real somente depois de billing/teste real;
- MM22: preview interno com endpoint real.
