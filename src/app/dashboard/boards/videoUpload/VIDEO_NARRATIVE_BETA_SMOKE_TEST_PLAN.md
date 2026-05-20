# Video Narrative Beta Smoke Test Plan

Roteiro manual para validar o beta fechado da análise real de vídeo em Vercel Preview ou Production antes de convidar creators.

## Regras gerais

- Use vídeo curto, não sensível e sem dados privados.
- Não registre secrets, signed URLs, `objectKey`, raw response ou vídeo em logs, issues, docs ou screenshots.
- Rode primeiro em Preview. Production só depois de Preview passar.
- Execute rollback no fim do teste se o ambiente não deve ficar aberto para creators.
- O endpoint mock `/api/dashboard/mobile-strategic-profile/analyze` deve continuar preservado.

## Preparação

1. Confirmar envs obrigatórias do runbook no ambiente alvo.
2. Confirmar allowlists com o email allowlist e sem o email comum.
3. Confirmar `VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED=1`.
4. Confirmar `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_FREE_BETA=false`.
5. Confirmar `VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA=false`.
6. Confirmar que o bucket temporário é privado.
7. Separar dois logins: um usuário comum e um usuário allowlist.

## Cenário 1 — Usuário comum bloqueado

Objetivo: provar que público geral não acessa o fluxo real.

Passos:

1. Entrar com usuário fora das allowlists.
2. Abrir o Perfil Estratégico.
3. Clicar em `+`.
4. Tentar iniciar análise real.

Resultado esperado:

- usuário recebe mensagem clara de indisponibilidade/beta fechado;
- Gemini não é chamado;
- storage não é chamado;
- nenhuma análise é consumida;
- Perfil antigo permanece visível;
- nenhum detalhe técnico aparece para o usuário.

Reprova se:

- usuário comum consegue iniciar upload real;
- Gemini é chamado;
- storage é chamado;
- aparece stack trace, flag, env ou erro técnico.

## Cenário 2 — Usuário allowlist dentro do limite

Objetivo: provar o fluxo real completo para creator convidado.

Passos:

1. Entrar com usuário allowlist.
2. Abrir o Perfil Estratégico.
3. Clicar em `+`.
4. Selecionar vídeo pequeno.
5. Aceitar consentimento.
6. Fazer upload.
7. Aguardar análise real.
8. Confirmar diagnóstico atualizado no Perfil.
9. Confirmar cleanup.

Resultado esperado:

- upload temporário conclui;
- análise Gemini real conclui;
- diagnóstico aparece em linguagem humana;
- snapshot privado é atualizado sem vídeo, raw response, `objectKey` ou signed URL;
- cleanup remove o objeto temporário;
- uso/limite é registrado conforme a policy;
- Perfil antigo não é perdido se houver warning não impeditivo.

Reprova se:

- upload expõe URL assinada em tela ou log;
- diagnóstico inclui texto bruto do provider;
- snapshot persiste `objectKey`, signed URL, bucket, vídeo ou raw response;
- cleanup não é acionado.

## Cenário 3 — Limite atingido

Objetivo: garantir proteção de custo antes de storage/Gemini.

Passos:

1. Simular usuário allowlist acima do limite diário ou mensal no ambiente de teste.
2. Entrar com esse usuário.
3. Tentar iniciar análise real.

Resultado esperado:

- fluxo bloqueia antes de storage;
- fluxo bloqueia antes de Gemini;
- mensagem humana explica que o limite do período foi atingido;
- nenhuma análise adicional é consumida;
- Perfil antigo permanece preservado.

Reprova se:

- storage é acessado antes do bloqueio;
- Gemini é chamado antes do bloqueio;
- erro técnico aparece para o usuário;
- retry automático cria loop de custo.

## Cenário 4 — Storage falha

Objetivo: validar falha humana e preservação do Perfil quando o storage temporário não está pronto.

Passos:

1. Em Preview, desativar ou invalidar temporariamente a env/flag de storage.
2. Manter o usuário allowlist.
3. Tentar o fluxo com vídeo pequeno.

Resultado esperado:

- fluxo falha com mensagem humana;
- Gemini não é chamado se o vídeo não foi resolvido;
- Perfil antigo permanece preservado;
- nenhum raw stack trace aparece;
- nenhuma signed URL, `objectKey` real ou secret aparece em log de produto;
- se algum objeto tiver sido criado, cleanup é tentado.

Reprova se:

- falha de storage quebra a página;
- Perfil é substituído por diagnóstico vazio;
- usuário vê mensagem técnica;
- objeto temporário fica retido sem warning operacional.

## Cenário 5 — Gemini falha

Objetivo: validar falha segura quando o provider real está indisponível.

Passos:

1. Em Preview, desativar temporariamente `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED` ou usar configuração controlada que force falha do provider.
2. Manter storage e allowlist válidos.
3. Entrar com usuário allowlist.
4. Enviar vídeo pequeno.
5. Iniciar análise real.

Resultado esperado:

- upload pode concluir;
- Gemini falha de forma controlada;
- mensagem humana aparece;
- Perfil antigo permanece preservado;
- cleanup é acionado para o vídeo temporário;
- raw response, prompt completo e stack trace não aparecem para o usuário.

Reprova se:

- falha do provider salva snapshot inválido;
- vídeo fica retido;
- raw response aparece em log de produto ou UI;
- retry automático dispara custo imprevisível.

## Cenário 6 — Rollback

Objetivo: provar desligamento rápido do runtime real.

Passos:

1. Desligar `NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`.
2. Desligar `VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED`.
3. Desligar `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED`.
4. Remover allowlists se o ambiente precisa ficar fechado.
5. Entrar com usuário allowlist.
6. Tentar iniciar análise real.
7. Validar endpoint mock.

Resultado esperado:

- fluxo real não tenta rodar;
- upload real não inicia;
- Gemini não é chamado;
- storage não é chamado;
- mensagem humana aparece;
- endpoint mock permanece funcionando.

Reprova se:

- client ainda tenta upload real;
- endpoint real chama Gemini;
- endpoint mock quebra;
- rollback exige alteração de código.

## Checklist final antes de convidar creators

- [ ] Cenário 1 passou.
- [ ] Cenário 2 passou.
- [ ] Cenário 3 passou.
- [ ] Cenário 4 passou em Preview.
- [ ] Cenário 5 passou em Preview.
- [ ] Cenário 6 passou.
- [ ] Nenhum secret apareceu em log, screenshot ou PR.
- [ ] Nenhum vídeo foi versionado.
- [ ] Nenhum raw response foi salvo.
- [ ] Nenhum signed URL foi persistido.
- [ ] Nenhum `objectKey` foi persistido no snapshot.
- [ ] Cleanup foi validado.
- [ ] Custo estimado foi registrado.
- [ ] Feedback template está pronto para envio.
