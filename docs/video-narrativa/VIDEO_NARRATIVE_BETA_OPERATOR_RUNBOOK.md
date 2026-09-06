# Video Narrative Beta Operator Runbook

Runbook operacional para Arthur rodar o beta fechado da análise real de vídeo com 3 a 5 creators em ambiente Preview ou Production, sem improviso e sem liberar o público geral.

## 1. Objetivo do beta fechado

Validar se creators reais conseguem usar o fluxo app-first/mobile de análise de vídeo e se o diagnóstico atualizado no Perfil Estratégico é claro, útil e confiável.

O beta mede:

- acesso restrito por allowlist;
- upload temporário;
- análise Gemini real;
- atualização segura do diagnóstico;
- cleanup do vídeo temporário;
- custo e limites de uso;
- qualidade percebida por 3 a 5 creators.

O beta não mede lançamento público, cobrança, Stripe, Mídia Kit, Comunidade, sidebar, BoardShell, DashboardShell, LoginClient ou NextAuth.

## 2. Quem pode participar

Podem participar apenas creators convidados diretamente por Arthur e adicionados às duas allowlists do beta.

Critérios recomendados:

- já conseguem fazer login na Data2Content;
- usam o app em mobile;
- aceitam enviar um vídeo curto e não sensível;
- entendem que o beta é fechado e pode falhar;
- aceitam responder o feedback depois do teste.

Não incluir:

- usuários comuns fora da allowlist;
- creators sem consentimento;
- vídeos sensíveis, privados ou de terceiros sem autorização;
- qualquer usuário que precise de suporte técnico para entender secrets, storage ou Gemini.

## 3. Como adicionar creator na allowlist

1. Confirmar o email exato usado no login da Data2Content.
2. Adicionar esse email em `VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS`.
3. Adicionar o mesmo email em `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS`.
4. Manter `VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED=1`.
5. Manter `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED=1`.
6. Confirmar `VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED=1`.
7. Fazer redeploy ou aguardar o ambiente aplicar as envs.
8. Rodar o smoke test do usuário allowlist antes de convidar o creator.

Use sempre a mesma lista nas duas allowlists. Se o email existe em uma e não existe na outra, o creator pode conseguir iniciar parte do fluxo e falhar antes da análise.

## 4. Como remover creator da allowlist

1. Remover o email de `VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS`.
2. Remover o mesmo email de `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS`.
3. Fazer redeploy ou aguardar o ambiente aplicar as envs.
4. Validar que o usuário removido recebe bloqueio humano antes de storage/Gemini.
5. Conferir se não há objeto temporário pendente do teste anterior no bucket.

Se a remoção for emergencial, desligue também as flags de rollback rápido descritas neste runbook.

## 5. Como configurar Vercel envs

Configure as envs no ambiente alvo sem imprimir valores em terminal, PR, README, issue, log ou screenshot.

### Obrigatórias

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

### Valores esperados para beta fechado

- `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED=true`
- `VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED=1`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED=1`
- `NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED=1`
- `VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED=1`
- `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED=true`
- `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED=1`
- `VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER=r2` ou `cloudflare_r2`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED=1`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_FREE_BETA=false`
- `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA=false`

### Rollback rápido

Para desligar o fluxo real:

1. Desligar `NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`.
2. Desligar `VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`.
3. Desligar `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED`.
4. Remover emails de `VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS`.
5. Remover emails de `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS`.

Depois do rollback, validar que o endpoint mock `/api/dashboard/mobile-strategic-profile/analyze` continua preservado.

## 6. Como rodar smoke test antes de convidar alguém

Use `VIDEO_NARRATIVE_BETA_SMOKE_TEST_PLAN.md`.

Ordem mínima antes de qualquer convite:

1. Cenário 1: usuário comum bloqueado.
2. Cenário 2: usuário allowlist dentro do limite.
3. Cenário 3: limite atingido.
4. Cenário 6: rollback.

Só convide creators depois que esses cenários passarem no ambiente alvo.

## 7. Como validar upload real

1. Entrar com usuário allowlist.
2. Abrir o Perfil Estratégico mobile.
3. Clicar em `+`.
4. Selecionar um vídeo pequeno, preferencialmente até 60 segundos.
5. Aceitar o consentimento.
6. Confirmar que o upload conclui sem expor `uploadUrl`, `signedUrl`, `objectKey`, bucket ou token.
7. Confirmar que falha de upload mostra mensagem humana e preserva o Perfil antigo.

O arquivo deve ir direto para o storage temporário. Não deve virar preview, thumbnail, histórico, base64 ou anexo persistido no app.

## 8. Como validar análise Gemini

1. Confirmar que o usuário está nas allowlists.
2. Confirmar que os limites não foram atingidos.
3. Iniciar análise real após upload concluído.
4. Confirmar que a resposta no app é diagnóstico estruturado, não resposta técnica.
5. Confirmar que erro de Gemini mostra mensagem humana.
6. Confirmar que o Perfil antigo fica preservado em caso de falha.
7. Confirmar que logs não contêm prompt completo, raw response, API key, signed URL ou vídeo.

Gemini não pode ser chamado quando allowlist, flag, consentimento, storage ou limite bloquearem a request.

## 9. Como validar snapshot/perfil atualizado

Depois de uma análise bem-sucedida:

- o Perfil Estratégico deve mostrar diagnóstico atualizado;
- o diagnóstico deve ser claro para creator, sem jargão técnico;
- o snapshot não pode conter `objectKey`;
- o snapshot não pode conter `signedUrl` ou `uploadUrl`;
- o snapshot não pode conter raw Gemini response;
- o snapshot não pode conter vídeo, base64, bucket ou secret;
- o Perfil antigo deve voltar intacto quando a análise falhar.

## 10. Como validar cleanup

1. Confirmar que o cleanup é acionado após sucesso.
2. Confirmar que o cleanup é tentado após falha aplicável.
3. Confirmar que o objeto temporário não fica no bucket após o teste.
4. Se cleanup falhar, confirmar que aparece apenas warning seguro para operação.
5. Confirmar que falha de cleanup não salva `objectKey`, signed URL, vídeo ou raw response no snapshot.

Se um objeto temporário ficar retido, pare o beta, delete manualmente no provider, registre o bug e rode rollback.

## 11. Como acompanhar uso/limites

Durante o beta, registre por creator:

- data do teste;
- email do creator;
- tamanho aproximado do vídeo;
- duração aproximada do vídeo;
- análise concluída ou bloqueada;
- erro humano exibido, se houver;
- cleanup ok ou warning;
- custo estimado por análise;
- latência percebida;
- se o creator achou o diagnóstico útil.

Regras:

- limite atingido deve bloquear antes de storage/Gemini;
- falha antes do provider não deve consumir análise;
- retry deve ser manual e controlado;
- custo imprevisível reprova o beta;
- não prometer pacote comercial de análises durante o beta.

## 12. Como desligar tudo em emergência

Use rollback se qualquer item abaixo acontecer:

- usuário comum acessa análise real;
- secret aparece em log;
- vídeo fica salvo indevidamente;
- snapshot contém `objectKey`, signed URL ou raw response;
- custo fica imprevisível;
- erro técnico aparece para creator;
- cleanup falha e deixa objeto retido;
- Gemini quebra com frequência.

Procedimento:

1. Desligar `NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`.
2. Desligar `VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`.
3. Desligar `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED`.
4. Remover as allowlists.
5. Validar usuário comum bloqueado.
6. Validar usuário allowlist bloqueado.
7. Validar endpoint mock preservado.
8. Conferir bucket e apagar objetos temporários pendentes.
9. Registrar o incidente sem colar secrets, URLs assinadas, `objectKey` real ou raw response.

## 13. Como reportar bugs

Para cada bug, registrar:

- ambiente: Preview ou Production;
- data e hora aproximada;
- email do creator, se necessário;
- etapa: login, allowlist, upload, análise, snapshot, cleanup, rollback ou feedback;
- comportamento esperado;
- comportamento observado;
- mensagem humana exibida;
- se Gemini foi chamado ou deveria estar bloqueado;
- se storage foi chamado ou deveria estar bloqueado;
- se Perfil antigo foi preservado;
- se cleanup rodou.

Não incluir:

- API key;
- access key;
- secret key;
- signed URL;
- `objectKey` real;
- raw response Gemini;
- vídeo;
- base64;
- screenshot com token.

## 14. O que não deve ser testado ainda

Não testar nesta etapa:

- público geral;
- rollout free/premium amplo;
- cobrança, Stripe, upgrades ou pacotes extras;
- Mídia Kit real ou `MediaKitView`;
- Comunidade real;
- navegação real/sidebar;
- DashboardShell ou BoardShell;
- `ActivationPendingWidget`;
- `LoginClient`;
- NextAuth;
- histórico de vídeos;
- galeria ou player de vídeos;
- comparação entre vídeos;
- Instagram real;
- brand matching real;
- vídeos longos ou sensíveis.

## Critérios de aprovação do beta

O beta passa se:

- 3 creators completam o fluxo;
- pelo menos 2 creators acham o diagnóstico útil;
- nenhum creator comum acessa o fluxo real;
- nenhum vídeo fica persistido indevidamente;
- cleanup funciona ou warning é seguro;
- custo por análise fica dentro do esperado;
- Perfil antigo fica preservado em erro.

## Critérios de reprovação do beta

O beta reprova se:

- usuário comum acessa real analysis;
- secret aparece em log;
- vídeo fica salvo indevidamente;
- snapshot contém `objectKey`, `signedUrl` ou raw response;
- diagnóstico quebra com frequência;
- erro técnico aparece para usuário;
- custo fica imprevisível.
