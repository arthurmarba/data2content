# Video Narrative Closed Beta Launch Checklist

Checklist final para liberar a análise narrativa real de vídeo para 3 a 5 creators reais em beta fechado. O público geral permanece bloqueado.

## 1. Envs obrigatórias

- `GEMINI_API_KEY`
- `VIDEO_NARRATIVE_GEMINI_MODEL`
- `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED`
- `VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED`
- `VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`
- `NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`
- `VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED`
- `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED`
- `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED`
- `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS`
- `VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER`
- `VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET`
- `VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT`
- `VIDEO_NARRATIVE_TEMP_STORAGE_REGION`
- `VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID`
- `VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED`

## 2. Flags false por padrão para público geral

- `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_FREE_BETA=false`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA=false`

Free e premium comuns só entram em outro PR, com decisão explícita de rollout.

## 3. Como liberar um creator no beta

1. Confirmar que o creator consegue fazer login.
2. Adicionar o email em `VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS`.
3. Adicionar o mesmo email em `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS`.
4. Confirmar que o limite de uso está abaixo do teto diário/mensal.
5. Confirmar acesso ao Perfil Estratégico mobile.
6. Rodar um smoke com vídeo pequeno antes de enviar o convite.

## 4. Como desativar rapidamente

Use uma das opções abaixo e valide que o endpoint mock continua funcionando:

- desligar `NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`;
- desligar `VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`;
- desligar `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED`;
- remover emails das allowlists;
- desligar `VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED`.

## 5. Smoke test obrigatório

- Env audit retorna `ok=true`.
- Gemini smoke retorna apenas resumo seguro.
- Storage smoke confirma upload, leitura e delete de objeto pequeno.
- Upload real pequeno conclui no browser allowlist.
- `/api/dashboard/mobile-strategic-profile/analyze-real` retorna snapshot atualizado.
- Cleanup é acionado após sucesso.
- Usuário comum recebe bloqueio antes de storage/Gemini.
- Limite atingido bloqueia antes de storage/Gemini.

## 6. Checklist anti-vazamento

- `.env.local` não versionado.
- Vercel envs protegidas.
- R2 token restrito ao bucket.
- R2 token rotacionável.
- Bucket sem acesso público.
- Logs sem raw response.
- Logs sem prompt completo.
- Logs sem signed URL.
- Snapshot sem vídeo, signed URL, `uploadUrl` ou `objectKey`.

## 7. Validação manual mobile

- Perfil antigo permanece visível quando análise falha.
- CTA de tentar novamente aparece quando a falha permite nova tentativa.
- Warning de cleanup não assusta o creator.
- Mídia Kit não muda.
- Comunidade não muda.
- Navegação real não muda.

## 8. Critério de launch candidate

- 3 a 5 creators em allowlist.
- Usage limits ativos.
- Rollback testado.
- Smoke Preview/Production documentado.
- Guardrails anti-vazamento confirmados.
- Endpoint mock preservado como fallback.
