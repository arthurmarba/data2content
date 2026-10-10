# Plano: apagar os dados de quem exclui a conta

09/10/2026 · aprovado por Arthur com as quatro recomendações; implementado na branch `claude/conector-apagar-conta`

## O problema, em uma frase

Quando alguém exclui a conta, o app apaga só o cadastro. Posts, números, mapa, roteiros, conversas, mídia kit e propostas de marca continuam no banco para sempre, ligados a um cadastro que não existe mais.

A política de privacidade promete o contrário: "Se você excluir a sua conta, os dados pessoais que não estejam sujeitos a obrigação legal de retenção serão eliminados de forma permanente."

## O tamanho do que ficou para trás

Contado no banco em 09/10, só leitura. O banco tem 602 cadastros. Cerca de 30 contas já foram excluídas e deixaram dado em 37 coleções. O ensaio do comando de limpeza, que junta todas as coleções, achou 48 contas. As maiores:

| O que ficou | Documentos |
| --- | --- |
| Retratos diários dos posts | 8.170 |
| Posts e números de cada post | 1.688 |
| Números da conta do Instagram por dia | 1.608 |
| Visitas ao mídia kit | 1.419 |
| Inspirações publicadas na comunidade | 139 |
| Pautas | 131 |
| Mensagens do chat antigo | 110 |
| Registros de custo do Gemini | 204 |
| Leituras dos vídeos publicados | 96 |
| Mapas, diagnósticos, roteiros, rascunhos, uso do app e o resto | cerca de 350 |

Também ficam fora do banco as capas de análise de vídeo no R2 (`persistent/content-analysis-thumbnails/<código da conta>/`). A chave de acesso não pode listar a pasta: o nome de cada capa sai do id da análise.

## O que proponho

### 1. Apagar junto com a conta

Tudo o que é só dela e de que ninguém mais depende:

- **Instagram e números:** posts e seus retratos diários, números da conta, público, seguidores novos por dia, stories, leituras dos vídeos publicados.
- **Mapa e estratégia:** mapa, confirmações do mapa, diagnósticos, relatórios semanais dela, alertas, planejamento, pautas e cota de pautas.
- **Roteiros:** roteiros, jeito de criar, estilo, resultados, rascunhos e posts gerados por IA.
- **Chat antigo:** conversas e mensagens.
- **Mídia kit e publis:** pacotes, endereço do kit, visitas ao kit, cálculos de publi, propostas de marca recebidas, links compartilhados e links de campanha.
- **Collabs:** interesses, combinações (inclusive as feitas com outra pessoa) e o cache das collabs por pauta.
- **Conector:** já feito na branch `claude/conector-apagar-conta`.
- **R2:** a pasta de capas dela.

### 2. Manter, sem o nome dela

Dado que serve à conta da empresa ou ao grupo, mas não precisa saber quem era:

- **Custo do Gemini:** o registro do gasto fica, sem o código da conta. Serve para fechar a conta do Gemini.
- **Relatórios semanais da comunidade já fechados:** a semana congelada traz os posts de várias criadoras. Proponho trocar o nome e o @ dela por "criador removido" e manter os números da semana, que são da comunidade.

### 3. Manter como está

- **Afiliado e saque:** a exclusão já é bloqueada quando há histórico financeiro, e o suporte anonimiza. Não muda.
- **Assinatura:** cobrança e nota ficam na Stripe por obrigação fiscal.
- **Jornada de anúncio:** a política diz que esses marcos ficam pseudônimos por até 400 dias. Não muda.
- **Registros da equipe** (quem da equipe olhou qual conta pelo MCP administrativo, quem revisou qual post): são da equipe, não da criadora.

### 4. Já some sozinho

Conversa do chat no Redis (2 dias), vídeo enviado para análise (temporário) e sessões de roteiro do conector (7 dias).

## Como fica por dentro

- **Um serviço só** em `src/app/lib/account/` com a lista de cada coleção e o que fazer com ela: apagar, tirar o nome ou manter. A rota de exclusão continua só conferindo e chamando.
- **Fora da requisição.** A conta e o conector saem na hora, na mesma transação de hoje. O resto vai para a fila (`/api/worker/*`), porque uma criadora antiga pode ter dezenas de milhares de retratos diários, e isso não cabe numa transação nem na espera da tela. Se a fila falhar no meio, ela tenta de novo, e apagar duas vezes não estraga nada.
- **Um teste que trava esquecimento.** Ele lê todos os modelos e falha se um campo que aponta para uma conta não estiver na lista. Foi assim que o conector ficou para trás.
- **Limpeza das 30 contas já excluídas:** um comando em `scripts/` que mostra o que apagaria (`--dry-run`, padrão) e só apaga com `--apply`. Rodo o ensaio, te mostro os números e só aplico com o seu ok.

## Decisões que são suas

1. **Relatórios da comunidade já fechados:** tirar o nome e manter os números (recomendo), apagar a criadora da semana, ou deixar como está.
2. **Inspirações que ela publicou na comunidade:** apagar (recomendo; outras criadoras deixam de ver o post dela) ou manter sem o nome.
3. **Propostas de marca recebidas por ela:** apagar (recomendo; a marca mandou para ela) ou guardar sem o nome.
4. **As cerca de 30 contas já excluídas:** limpar depois do ensaio (recomendo) ou só daqui para a frente.

## Detalhe técnico

Método: um script carregou os 99 modelos de `src/app/models` e `src/server/db/models` e achou 76 campos em 65 coleções que apontam para `User` (por `ref: "User"` ou por nome). Para cada um, contou as contas que não existem mais em `users`. Um segundo passo cobriu ligações por texto (`creatorId: String`), filhos (`messages` por `threadId`, `daily_metric_snapshots` por `metric`) e coleções sem modelo (`audience_demographic_snapshots`, `instagram_new_followers_days`, `weekly_stats_freezes`, `weekly_territory_reports`).

| Coleção | Campo | Docs de contas excluídas | Proposta |
| --- | --- | --- | --- |
| `daily_metric_snapshots` | `metric` → `metrics.user` | 8.170 | apagar |
| `metrics` | `user` | 1.688 | apagar |
| `accountinsights` | `user` | 1.608 | apagar |
| `mediakitaccesslogs` | `user` | 1.419 | apagar |
| `communityinspirations` | `originalCreatorId` | 139 | decisão 2 |
| `creatorcontentideas` | `userId` | 131 | apagar |
| `messages` | `threadId` → `threads.userId` | 110 | apagar |
| `postreviews` | `postId` → `metrics` | (com o post) | apagar |
| `gemini_operations`, `geminiusagelogs` | `creatorId` (texto) | 204 | tirar o nome |
| `published_content_evidence` | `userId` | 96 | apagar |
| `usage_events` | `userId` | 71 | apagar |
| `post_creation_funnel_events`, `post_creation_drafts` | `userId` | 65 | apagar |
| `publicalculations` | `userId` | 38 | apagar |
| `audience_demographic_snapshots` | `user` | 29 | apagar |
| `alerts`, `aigeneratedposts`, `threads`, `mapasseed`, `creatorvideonarrativediagnoses`, `planner_plans`, `creatorweeklyreports`, `script_entries`, `creatormapconfirmations`, `creatorstrategicprofilesnapshots`, `strategicreports`, `creator_script_dna_profiles`, `script_style_profiles`, `script_outcome_profiles`, `sharedlinks`, `campaignlinks`, `mediakitpackages`, `contentideaquotas` | `user`/`userId` | 2 a 23 cada | apagar |
| `brandproposals` | `userId` | 2 | decisão 3 |
| `weekly_territory_reports.creators`, `weekly_stats_freezes.posts` | embutido | a medir | decisão 1 |
| `mcp_admin_audit_events` | `targetCreatorIds` | 6 | manter (registro da equipe) |
| `script_entries` | `recommendedByAdminId`, `adminAnnotationUpdatedById` | 29 | manter (equipe) |
| `acquisition_journeys`, `acquisition_events` | `userId` | 0 | manter (política: 400 dias, pseudônimo) |
| `redemptions`, `affiliate*` | `userId` | 0 | manter (financeiro) |
| `instagram_new_followers_days`, `storymetrics`, `dailymetrics`, `user_usage_snapshots`, `collab*`, `chat_*`, `mediakitslugaliases`, `plannerreccaches`, `planning_recommendation_feedback`, `creator_research_review_grants`, `instagram_marketplace_connections`, `videoassets`, `addeals`, `perpautacollabcaches` | `user`/`userId`/`owner` | 0 hoje | apagar |
| R2 `persistent/content-analysis-thumbnails/<sha256(userId)[:24]>/` | prefixo | não medido | apagar |

Cuidados:
- `content_reading_states` e `published_content_evidence` também se ligam por `metricId`. A limpeza segue o post, não só o `userId`.
- `collabmatches` tem `userA` e `userB`: apagar a combinação inteira. `collabproposals.acceptedBy` é uma lista: tirar só ela (`$pull`).
- Redis guarda estado e histórico do chat por 2 dias e uso por 7, com expiração. Não precisa de limpeza.
- O teste de esquecimento precisa aceitar a lista do que fica por decisão (equipe, financeiro, anúncio), para não virar ruído.
