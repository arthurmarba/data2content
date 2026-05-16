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
- inline base64 só para testes pequenos/controlados;
- `videoUri`/File API/storage é preferível para fluxo futuro;
- a decisão detalhada de origem do vídeo fica no contrato `VIDEO_NARRATIVE_INPUT_SOURCE_CONTRACT.md`;
- consentimento e retenção ficam no contrato `VIDEO_NARRATIVE_CONSENT_RETENTION_CONTRACT.md`;
- limites, quota e cooldown ficam no contrato `VIDEO_NARRATIVE_USAGE_LIMITS_COST_CONTRACT.md`;
- métricas, eventos e logs seguros ficam no contrato `VIDEO_NARRATIVE_OBSERVABILITY_CONTRACT.md`;
- não aceitar arquivo multipart neste contrato inicial;
- não aceitar input livre sem limites;
- não aceitar usuário comum.

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
- admin guard server-side estiver definido;
- rate limit/usage limit tiver contrato;
- consentimento/retenção estiverem planejados.

## Próximas Fases Possíveis

- MM14: contrato de origem do vídeo;
- MM15: contrato de consentimento/retenção;
- MM16: contrato de limites/custos;
- MM17: contrato de métricas/observabilidade;
- MM18: endpoint interno real, se billing existir;
- MM19: preview interno com chamada real;
- MM20: integração experimental no board.
