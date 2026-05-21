# MM91 — Closed Beta Activation, Telemetry and Operator Smoke Harness

Status: implementado.

## Objetivo

Preparar o beta fechado do mobile real da Data2Content para operação segura: medir o funil sem vazar dados, validar estados antes de chamar integrações reais e manter o acesso restrito por allowlist/admin-dev.

## Como habilitar usuário allowlist/admin-dev

1. Confirme que a rota mobile está protegida pelas flags já usadas no MM88-MM90.
2. Habilite somente usuários da allowlist ou viewers admin/dev para o fluxo real gated.
3. Não remova os gates de `upload-session`, `analyze-real`, temporary storage ou usage limits.
4. Use o preview interno `/dashboard/boards/mobile-strategic-profile-preview` apenas com `NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED=1` e sessão admin/dev.

## Smoke harness interno

O preview interno mostra o painel `MM91 smoke harness` com links para:

- Free sem leitura;
- Free com leitura usada;
- Pro sem Instagram;
- Pro com Instagram;
- Pro 10/10 leituras;
- pagamento pendente;
- ação de pagamento necessária;
- Comunidade Free;
- Comunidade Pro;
- Mídia Kit disponível;
- Mídia Kit aguardando Instagram;
- endpoint real bloqueado para usuário comum;
- endpoint real com allowlist/admin-dev;
- pós-checkout `connect_instagram`;
- pós-checkout `join_community`.

O harness não chama Gemini, storage, upload real ou endpoint real automaticamente.

## Testes operacionais

### Free 1 leitura

1. Abra o Perfil com usuário Free e sem diagnóstico salvo.
2. Confirme Status Card `Perfil em construção`.
3. Clique `Analisar meu primeiro vídeo`.
4. Conclua uma leitura.
5. Reabra o Perfil e confirme `Leitura grátis usada`.
6. Tente nova leitura e confirme bloqueio antes do upload.

### Pro 10 leituras/mês

1. Abra o Perfil com Plano Pro ativo.
2. Confirme a mensagem `X/10 leituras`.
3. Simule uso perto do limite e confirme `Restam X leituras`.
4. Simule 10 leituras no mês e confirme `10/10 usadas`.
5. Confirme que o upload não abre em 10/10.

### Pro sem Instagram

1. Abra o Perfil Pro sem Instagram.
2. Confirme Status Card `Pro ativo`.
3. Confirme CTA principal `Conectar Instagram`.
4. Confirme CTA secundário `Nova leitura`.
5. Gere uma leitura para validar que Pro sem Instagram não fica bloqueado.

### Pro com Instagram

1. Abra o Perfil Pro com Instagram conectado.
2. Confirme `Nova leitura` como CTA principal.
3. Confirme que Mídia Kit aparece em `Oportunidades`.

### Paywall Perfil

1. Use Free com leitura usada.
2. Clique `Assinar Pro`.
3. Confirme contexto `narrative_map` e `postCheckoutIntent: connect_instagram`.
4. Após checkout aprovado, confirme redirect para conexão de Instagram ou CTA claro de conexão.

### Paywall Comunidade

1. Abra Comunidade com usuário Free.
2. Confirme banner compacto `Consultoria em grupo`.
3. Clique `Assinar e entrar`.
4. Confirme contexto `mentoria` e `postCheckoutIntent: join_community`.
5. Após checkout aprovado, confirme retorno para Comunidade e botão `Entrar`.

### Mídia Kit em Oportunidades

1. Abra aba `Oportunidades`.
2. Com Instagram conectado, confirme ações `Copiar link`, `Ver como marca` e `Abrir Mídia Kit`.
3. Sem Instagram, confirme CTA `Conectar Instagram`.
4. Não altere `MediaKitView` público.

### Comunidade marketplace + banner

1. Abra a rota canônica mobile `/planning/discover`.
2. Confirme que o marketplace/lista/grid de creators continua renderizando.
3. Confirme banner compacto acima da lista.
4. Free vê `Assinar e entrar`.
5. Pro vê `Entrar`, sem pitch longo.

### Endpoint real gated

1. Usuário comum fora da allowlist deve receber bloqueio no fluxo real.
2. Usuário allowlist/admin-dev pode seguir o fluxo real gated.
3. Confirme `usageLimitChecked` e `allowlistGatePassed` no response seguro.
4. Não rode smoke automático chamando Gemini ou storage real.

### Cleanup, leitura salva e snapshot

1. Após análise real concluída, confirme cleanup temporário.
2. Confirme `videoReadingPersistence.attempted=true`.
3. Confirme `videoReadingPersistence.saved=true`.
4. Confirme `synthesisSnapshotWrite.attempted=true`.
5. Confirme `synthesisSnapshotWrite.written=true` ou `skippedReason` seguro.

## Telemetria segura

Eventos mobile usam `mobileNarrativeTelemetry.ts` com whitelist de payload.

Permitido:

- rota interna;
- estado de acesso;
- boolean de Pro;
- boolean de Instagram conectado;
- leituras usadas, limite e restantes;
- opção rápida selecionada;
- tipo/label de ação;
- contexto de paywall;
- `postCheckoutIntent`;
- resultado de gate;
- código de erro seguro;
- modo `mock` ou `real_gated`;
- flags booleanas de allowlist, leitura salva e snapshot escrito.

Proibido:

- `creatorGoal` livre;
- `quickAnswers` livres;
- prompt;
- raw Gemini/model response;
- transcript;
- long transcript;
- vídeo;
- filename;
- headers;
- token;
- signed/upload URL;
- `objectKey`;
- `localPath`;
- `storageProviderPath`;
- diagnóstico completo;
- snapshot completo;
- email/nome do creator.

Para conferir, use os testes de `mobileNarrativeTelemetry` e inspecione os eventos `[track]` em ambiente dev. Se houver dúvida sobre um campo, não envie.

## Falhas operacionais

### Análise falhou

1. Confirme se o erro exibido é amigável.
2. Verifique telemetria `mobile_analysis_failed` com `safeErrorCode`.
3. Confirme que não houve leitura salva quando o diagnóstico não foi gerado.
4. Confirme cleanup temporário.

### Pagamento pendente

1. O Perfil deve mostrar `Continuar pagamento` ou `Atualizar pagamento`.
2. A Comunidade deve mostrar `Continuar pagamento`.
3. Não abra upload antes de resolver pagamento.

### Limite bloqueou

1. Confirme `10/10 usadas`.
2. Confirme texto `Novas leituras liberam no próximo ciclo.`
3. Não ofereça pacote extra ou upgrade de quota.

## Rollback

1. Desligue as flags mobile/real analysis já existentes.
2. Mantenha allowlist/admin-dev ativa.
3. O provider de telemetria é noop-safe quando não há `gtag`.
4. Não reverta billing core, Stripe ou NextAuth.

## Checklist com creators reais da allowlist

Para 2 ou 3 creators reais:

1. Validar Perfil inicial.
2. Validar Free ou Pro correto.
3. Validar Instagram conectado/desconectado.
4. Validar nova leitura com vídeo pequeno.
5. Validar pergunta aberta e contexto rápido.
6. Validar leitura salva.
7. Validar síntese acumulada.
8. Validar Mídia Kit em Oportunidades.
9. Validar Comunidade e Grupo VIP.
10. Conferir telemetria sem dados sensíveis.
