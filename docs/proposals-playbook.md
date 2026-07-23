# Media Kit Proposals – Launch Playbook

This note centralises the current feature snapshot, the manual QA path, and the operational steps to watch during rollout.

## 1. Delivered Scope
- Form público no link do Media Kit permite que marcas enviem propostas sem login.
- Registro persistido em `BrandProposal` (status inicial `novo`, IP e user-agent costumizados, timestamps).
- APIs:
  * `POST /api/mediakit/[token]/proposals` – submissão pública com rate limit diário (5/IP).
  * `GET /api/proposals` – lista autenticada para o creator.
  * `PATCH /api/proposals/[id]` – atualiza status (`novo`, `visto`, `aceito`, `rejeitado`).
  * `POST /api/proposals/[id]/analyze` – chama o Mobi para avaliar proposta.
- Notificação automática por e-mail (`proposalReceivedEmail`) enviada ao criador com resumo da proposta e link direto canônico (`/campaigns?proposalId=...&source=email`).
- CRM `/campaigns` acessível pela sidebar e pela home; as rotas antigas em `/dashboard/proposals` redirecionam para o endereço canônico.
- Cada proposta persiste `receivedAt`, `openedAt` e `repliedAt`. Registros antigos continuam compatíveis sem backfill obrigatório.
- Prompt do Mobi agora compara orçamento vs. cálculo recente + ticket médio histórico.
- Formulário público só aparece para visitantes (dono logado não vê) -> prevenção de auto-submissões.
- Logs enviados: `[PROPOSAL_PUBLIC]`, `[PROPOSAL_ANALYSIS]` via `logger` + Sentry.

## 2. QA Manual (Staging)
1. **Envio público**
   - Acesse o Media Kit compartilhável (sem login).
   - Preencha todos os campos; envie.
   - Confirmar toast de sucesso e registro no banco; procurar `[PROPOSAL_PUBLIC]`.
   - Repetir +6 vezes com o mesmo IP → deve retornar 429 (“Limite de propostas atingido”).
   - Validar que o criador recebe o e-mail “Nova proposta recebida no seu Mídia Kit 🎯” com briefing completo e link.
2. **Painel do creator**
   - Logar como dono → `/campaigns`.
   - Ver proposta recém-criada (status `Novo`, orçamento/datas preenchidos).
   - Abrir detalhe → briefing, entregáveis, contato completos.
3. **Ações**
   - Mudar para `Visto`, recarregar → status persiste.
   - Marcar como `Aceito` e depois `Rejeitado` → deve refletir.
   - Testar submissão sem orçamento → página deve exibir e Mobi deve responder sem erro.
4. **IA**
   - Clicar “Analisar com Mobi”.
   - Confirmar resposta com comparação (oferta × valor justo/ ticket médio).
   - Com orçamento vazio → IA deve instruir a sugerir valor, não travar.
5. **Segurança**
   - Criador logado acessando Media Kit público → formulário oculto.
   - `GET /api/proposals` sem login → 401.
   - Submissões duplicadas (mesmos dados em <24h) → rate limit impede spam mais pesado.

> Dica: usar IPs diferentes (VPN/localhost) para validar o rate limit em ambientes sem Redis compartilhado.

## 3. Observabilidade & Operação
- **Logs**: monitorar `[PROPOSAL_PUBLIC]` e `[PROPOSAL_ANALYSIS]` (logger + Sentry). Campos principais: `proposalId`, `userId`, `brandName`, `budget`, IP.
- **E-mail**: `emailService` grava `[emailService] Notificação de proposta recebida` no log; falhas sobem como erro `Sentry`.
- **Rate limit**: chaves Redis prefixadas com `proposal_public:<ip>`. Verificar TTL/contagem ao investigar bloqueios.
- **Banco**: `brandproposals` armazenam IP/UA para auditoria; índices em `userId` e `mediaKitSlug`.
- **Funil**: acompanhar origem de entrada, tempo até abertura e tempo até resposta pelos eventos `campaigns_*`, `proposal_opened` e `email_sent_via_platform`.
- **Compatibilidade**: propostas legadas sem `openedAt` são consideradas não lidas apenas quando ainda estão em `novo`; não executar migração destrutiva para inferir datas históricas.
- **Alertas sugeridos** (pós-go-live, 1ª semana):
  - Contagem diária de propostas > threshold configurado (para detectar spikes ou degradação).
  - Erros 500 em `/proposals/*` > 0.
  - Falhas no endpoint de análise IA (`PROPOSAL_ANALYSIS` com status !=200).
- **Rollback rápido**: desativar formulário público removendo o componente no `MediaKitView` ou feature flaggar a renderização (consultar `isPublicView`).

## 4. Conhecimento para Suporte
- Limite atingido → retornar mensagem orientando tentativa futura (log com IP para revisão manual).
- Status incorreto → `PATCH` reaplica; se falhar, conferir se `proposal.id` pertence ao usuário.
- IA não responde → inspecionar logs, garantir que cálculo/ticket esteja disponível; fallback já retorna texto amigável.
- Submissões suspeitas → filtrar por `originIp` no banco; bloquear via firewall se necessário.

## 5. Backlog Próximo
- **Notificações**: disparar e-mail/toast interno quando uma nova proposta chega.
- **Integração Calculadora**: botão “Comparar com Calculadora de Publi” abrindo o cálculo mais recente.
- **Métricas no dashboard**: cards com totais (novas/aceitas/rejeitadas) alimentados em tempo real.
- **IA avançada**: permitir que o Mobi sugira formatos/escopos com base no briefing.

> Registrar essas ideias como user stories na próxima planning para manter a evolução contínua.
