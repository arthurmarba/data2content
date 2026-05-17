# Video Narrative Internal Endpoint Contract

## Objetivo

Este documento define o contrato de um futuro endpoint interno/admin para testar análise narrativa de vídeo com segurança, antes de expor qualquer experiência para usuário.

## Escopo

- é contrato, não implementação;
- sem endpoint real nesta fase;
- sem UI;
- sem upload real;
- sem `BoardShell`;
- sem `PostCreationFunnelState` real.

## Caminho Futuro Sugerido

Endpoint futuro sugerido:

```text
POST /api/internal/video-narrative/analyze
```

Esse caminho ainda não será criado nesta fase.

## Acesso

- apenas admin/dev;
- sessão obrigatória;
- helper recomendado: `canAccessInternalPreview` ou equivalente server-side;
- flag server-side obrigatória: `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED=true`;
- nunca usar `NEXT_PUBLIC` para habilitar custo real;
- bloquear qualquer usuário comum.

## Payload Futuro

```json
{
  "id": "manual-video-narrative-run",
  "creatorQuestion": "Quero saber se vale postar",
  "videoUri": "file-or-gcs-uri",
  "inlineVideoBase64": null,
  "mimeType": "video/mp4",
  "creatorContext": {
    "handle": "...",
    "niche": "...",
    "knownNarratives": []
  }
}
```

Regras:

- precisa ter `videoUri` ou `inlineVideoBase64` + `mimeType`;
- `creatorQuestion` é recomendado;
- `VideoNarrativeAnalyzePayload` representa o payload bruto futuro;
- `VideoNarrativeNormalizedAnalyzePayload` representa o payload normalizado após validação pura;
- inline base64 só para testes pequenos/controlados;
- `videoUri`/File API/storage é preferível para fluxo futuro;
- a decisão detalhada de origem do vídeo fica no contrato `VIDEO_NARRATIVE_INPUT_SOURCE_CONTRACT.md`;
- consentimento e retenção ficam no contrato `VIDEO_NARRATIVE_CONSENT_RETENTION_CONTRACT.md`;
- limites, quota e cooldown ficam no contrato `VIDEO_NARRATIVE_USAGE_LIMITS_COST_CONTRACT.md`;
- métricas, eventos e logs seguros ficam no contrato `VIDEO_NARRATIVE_OBSERVABILITY_CONTRACT.md`;
- a ordem de guards fica no contrato `VIDEO_NARRATIVE_REAL_ENDPOINT_GUARDS_CONTRACT.md`;
- readiness do endpoint skeleton fica em `VIDEO_NARRATIVE_ENDPOINT_SKELETON_READINESS.md`;
- não aceitar arquivo multipart neste contrato inicial;
- não aceitar input livre sem limites;
- não aceitar usuário comum.

Flag futura sugerida para o skeleton: `VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED`. Ela deve ser server-side, não `NEXT_PUBLIC`, e separada de `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED`.

## Resposta Futura

```json
{
  "ok": true,
  "status": "ready",
  "analysis": {},
  "seed": {},
  "primaryAction": "...",
  "issues": [],
  "hasRawText": true
}
```

Regras:

- nunca retornar `rawText` completo;
- retornar apenas `hasRawText`;
- nunca retornar API key;
- `analysis` deve ser `VideoNarrativeAnalysis`;
- `seed` deve ser `PostCreationVideoSeed`;
- `issues` devem ser sanitizadas;
- fallback deve retornar `ok false` com analysis segura.

MM25 adiciona `VideoNarrativeSafeResponse` e helpers puros para montar essa resposta futura sem retornar `rawText` completo, base64, API key, vídeo bruto ou URL assinada com token.

MM27 cria o skeleton de `POST /api/internal/video-narrative/analyze` protegido por `VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED=true`. A flag é server-side, separada de `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED`, e permite validar guards e safe response sem ligar provider real.

MM28 adiciona `VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE` com valores conceituais `disabled`, `mock` e `real`. Nesta fase a rota suporta `disabled` e `mock`; `real` retorna safe response disabled porque provider Gemini real continua fora de escopo.

MM29 adiciona `VideoNarrativeStrategicDiagnosis` como camada futura depois do mock endpoint e da safe response. Essa camada cruza `VideoNarrativeAnalysis`, `PostCreationVideoSeed`, pergunta do criador, quiz futuro, perfil narrativo futuro e contexto futuro de Instagram sem alterar a rota nesta fase.

MM30 adiciona `buildVideoNarrativeDiagnosisQuiz` como camada futura depois do diagnosis builder. O endpoint/mock pode alimentar diagnóstico e quiz builder no futuro, mas a rota não foi alterada nesta fase.

## Status Futuros

- `disabled`;
- `missing_api_key`;
- `missing_client`;
- `missing_video`;
- `invalid_payload`;
- `ready`;
- `failed`;
- `insufficient_context`;
- `blocked_unauthorized`;
- `blocked_forbidden`;
- `usage_limited`;
- `quota_exceeded`;
- `cooldown_active`;
- `provider_unavailable`.

## Validações Futuras

- método `POST`;
- `content-type` JSON;
- tamanho máximo de payload;
- `mimeType` permitido;
- duração máxima futura;
- `videoUri` obrigatório ou inline completo;
- `creatorQuestion` com limite de caracteres;
- `creatorContext` limitado;
- sem `rawText` no response;
- sem persistência automática.

## Limites Iniciais Recomendados

- vídeo até 60s;
- tamanho até 100MB quando houver upload real;
- `inlineVideoBase64` apenas para teste pequeno;
- timeout server-side;
- 1 análise por vez;
- beta/admin sem limite comercial ainda;
- futuro plano: 5 análises/mês em beta.

## Segurança E Privacidade

- não salvar vídeo automaticamente;
- não persistir sinais no perfil sem decisão posterior;
- não expor `rawText`;
- não logar API key;
- não logar base64;
- não logar vídeo;
- redigir issues;
- expiração futura do arquivo;
- seguir o contrato de consentimento/retenção antes de endpoint real ou beta;
- consentimento obrigatório antes de beta.

## Custo

- endpoint deve existir só atrás de flag server-side;
- custo real ainda não medido;
- não liberar sem quota/billing conhecido;
- registrar latência/custo futuramente;
- aplicar usage guard, quota e cooldown antes de endpoint real ou beta;
- planejar observability hooks antes de endpoint real;
- feature flag deve permitir desligamento rápido.

## Relação Com Código Atual

- `runGeminiVideoNarrativeProviderFromEnv`;
- `createGeminiVideoNarrativeClient`;
- `parseGeminiVideoNarrativeJson`;
- `VideoNarrativeGuardResult`;
- `VideoNarrativeGuardPipelineSummary`;
- `VideoNarrativeAnalyzePayload`;
- `VideoNarrativeNormalizedAnalyzePayload`;
- `VideoNarrativeSafeResponse`;
- `VideoNarrativeStrategicDiagnosis`;
- `VideoNarrativeDiagnosisCreatorSignal`;
- `VideoNarrativeDiagnosisQuizQuestion`;
- `buildVideoNarrativeDiagnosisQuiz`;
- `VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED`;
- `VideoNarrativeAnalysis`;
- `buildPostCreationVideoSeedFromAnalysis`;
- `getPostCreationVideoSeedPrimaryAction`;
- real run harness atual.

## Critérios Antes De Implementar Endpoint Real

Só implementar depois que:

- houver API key nova e segura;
- houver billing/quota;
- harness manual rodar pelo menos 3 vídeos curtos;
- prompt/schema forem ajustados se necessário;
- decisão de input de vídeo for tomada;
- contrato de consentimento/retenção estiver aprovado como bloqueio antes de endpoint real ou beta;
- contrato de limites/custo estiver aprovado como bloqueio antes de endpoint real ou beta;
- contrato de observabilidade estiver aprovado como bloqueio antes de endpoint real;
- contrato de guards do endpoint real estiver aprovado antes de criar a rota real;
- contratos puros de guard result/status estiverem disponíveis;
- payload validation contracts estiverem disponíveis para `payload_schema` e `input_source`;
- admin guard server-side estiver definido;
- rate limit/usage limit tiver contrato;
- consentimento/retenção estiverem planejados.

## Próximas Fases Possíveis

- MM14: contrato de origem do vídeo;
- MM15: contrato de consentimento/retenção;
- MM16: contrato de limites/custos;
- MM17: contrato de métricas/observabilidade;
- MM18: contrato dos guards do endpoint real;
- MM19: contratos puros de guard result/status;
- MM20: payload validation contracts;
- MM21: input/source guard helpers;
- MM22: consent/retention guard helpers;
- MM23: usage/quota guard helpers;
- MM24: observability event contracts;
- MM25: safe response builder;
- MM26: endpoint skeleton readiness;
- MM27: endpoint skeleton admin/dev sem provider real;
- MM28: endpoint mock mode sem Gemini real;
- MM29: diagnosis and creator learning model;
- MM30: diagnosis-driven quiz builder;
- MM31: endpoint real somente depois de billing/teste real;
- MM32: preview interno com chamada real;
- MM33: integração experimental no board.
