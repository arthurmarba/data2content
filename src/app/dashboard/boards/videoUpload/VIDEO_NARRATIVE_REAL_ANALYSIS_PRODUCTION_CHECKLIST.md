# Video Narrative Real Analysis Production Checklist

Este checklist prepara o beta fechado da análise narrativa real de vídeo. Ele não libera usuários comuns e não altera billing real.

## Status MM70

- Runtime real local validado no MM69: env audit, Gemini smoke, storage smoke e E2E controlado passaram.
- MM70 adiciona limites persistentes de uso antes de storage/Gemini.
- O beta continua restrito a allowlist/admin-dev por default.
- Premium e free comuns continuam bloqueados enquanto as flags explícitas de beta não forem ligadas.

## Envs obrigatórias em Vercel

- `GEMINI_API_KEY`
- `VIDEO_NARRATIVE_GEMINI_MODEL`
- `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED`
- `VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`
- `VIDEO_NARRATIVE_GEMINI_SMOKE_ENABLED`
- `VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED`
- `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED`
- `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED`
- `VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER`
- `VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET`
- `VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT`
- `VIDEO_NARRATIVE_TEMP_STORAGE_REGION`
- `VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID`
- `VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY`
- `VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS`
- `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED`

## Envs opcionais/controladas

- `VIDEO_NARRATIVE_GEMINI_ALLOWED_USER_IDS`
- `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_USER_IDS`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_FREE_BETA`
- `VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB`
- `VIDEO_NARRATIVE_GEMINI_TIMEOUT_MS`
- `VIDEO_NARRATIVE_GEMINI_MAX_OUTPUT_TOKENS`

## Flags que devem ficar false/desligadas por default

- `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA=false`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_FREE_BETA=false`

Essas flags só devem mudar em PR separado, com decisão explícita de rollout.

## Flags para beta allowlist

- `VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED=1`
- `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED=1`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED=1`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED=1`
- `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED=true`

## Rollback rápido

Para desligar o runtime real sem afetar o endpoint mock:

- definir `VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED=0`;
- ou definir `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED=false`;
- ou remover a allowlist;
- ou definir `VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED=0`.

Depois do rollback, validar que `/api/dashboard/mobile-strategic-profile/analyze` continua respondendo no modo mock.

## Smoke checklist

- Rodar env audit e confirmar `ok=true` sem imprimir secrets.
- Rodar Gemini smoke e conferir apenas `ok`, `model`, `parserReady`, `timingMs` e issue codes seguros.
- Rodar storage smoke com objeto pequeno e confirmar upload/GetObject/DeleteObject.
- Rodar E2E controlado allowlist: upload temporário, adapter, Gemini, parser, snapshot privado e cleanup.
- Confirmar que usuário comum recebe bloqueio antes de storage/Gemini.
- Confirmar que limite diário bloqueia antes de storage/Gemini.

## R2/S3 checklist

- Bucket privado, sem public development URL para esse fluxo.
- Token scoped ao bucket com Object Read & Write.
- Endpoint S3 API configurado em env.
- Região configurada conforme provider.
- Cleanup real validado com DeleteObject.
- Rotacionar token se algum valor for exposto em tela, log ou arquivo versionado.

## Gemini checklist

- Modelo definido em env.
- Chave presente apenas no ambiente seguro.
- Smoke não imprime prompt completo nem raw response.
- Parser/sanitizer é obrigatório antes de qualquer snapshot.
- Timeout e resposta inválida retornam mensagem humana sem stack trace.

## Cleanup checklist

- Cleanup roda após sucesso e falha.
- Warning de cleanup não invalida snapshot salvo.
- Falha de cleanup não salva `objectKey`, signed URL ou vídeo no snapshot.

## Rotação/revogação de secrets

- Revogar token R2 no Cloudflare se houver exposição.
- Criar novo token scoped ao bucket.
- Atualizar apenas env segura de runtime.
- Nunca registrar valores reais em README, docs, fixtures, testes ou `.env.example`.
- Confirmar que `.env.local` segue ignorado e não tracked.

## Guardrails finais

- Usuários comuns bloqueados.
- Gemini não chamado quando beta/allowlist/limite bloqueia.
- Sem billing real alterado.
- Sem vídeo salvo no banco.
- Sem raw Gemini response salvo.
- Sem signed URL persistida.
- Sem `objectKey` persistido no snapshot.
- Sem SDK de storage em client component.
- Endpoint mock preservado.
- MediaKit, Comunidade, navegação, shells, LoginClient, NextAuth e billing ficam fora do escopo.
