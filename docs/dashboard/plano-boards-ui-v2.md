# Plano de Desenvolvimento — Boards UI v2

## Objetivo

Evoluir a experiência dos boards do dashboard para uma linguagem visual única, mais editorial e operacional, reduzindo a sensação de "cards soltos" e aproximando a navegação do modelo de workspace contínuo observado no mockup de referência.

O foco desta etapa é consolidar três superfícies principais:

- ativação e progresso do criador
- campanhas e CRM
- comunidade e descoberta

## North Star

Os boards devem parecer um trilho de trabalho integrado, não uma coleção de widgets independentes.

Ao abrir o dashboard, o usuário precisa entender em poucos segundos:

- em que etapa está
- qual ação deve tomar agora
- qual campanha exige atenção
- onde buscar repertório e inspiração

## Contexto Atual

Hoje a base funcional já existe, mas está distribuída em shells e padrões visuais diferentes:

- `src/app/dashboard/components/Board.tsx`
- `src/app/dashboard/boards/PinnedBoardsHub.tsx`
- `src/app/dashboard/home/minimal/MinimalDashboard.tsx`
- `src/app/dashboard/home/minimal/FlowChecklist.tsx`
- `src/app/dashboard/home/minimal/ProposalsPanel.tsx`
- `src/app/(dashboard)/campaigns/CampaignsBoard.tsx`
- `src/app/dashboard/discover/DiscoverBoard.tsx`
- `src/app/dashboard/components/ThreadsTabs.tsx`

Principais gaps observados:

- excesso de blocos com tratamento de card genérico
- pouca hierarquia entre ação principal, contexto e conteúdo secundário
- board de campanhas com boa base funcional, mas sem pipeline visual claro
- comunidade com conteúdo útil, porém sem presença editorial suficiente
- shell de board ainda simples demais para estados como progresso, detalhe interno e headers mais ricos

## Tese Visual

Workspace editorial-operacional com:

- superfícies claras e calmas
- hierarquia tipográfica forte
- um único acento visual primário
- cabeçalhos sticky e navegação horizontal contínua
- transições curtas entre lista e detalhe

## Princípios de Produto

1. Cada board precisa ter uma responsabilidade principal.
2. A primeira ação deve ser óbvia sem depender de leitura longa.
3. Cards só permanecem quando forem a própria interação.
4. O detalhe de campanhas deve acontecer no board sempre que possível.
5. Mobile não pode perder prioridade de ação nem legibilidade.

## Arquitetura-Alvo

### 1. `BoardShellV2`

Evoluir o shell base para suportar:

- variantes `workspace`, `card` e `compact`
- header com título, subtítulo, progresso, tabs e ações
- área de conteúdo com padding controlado por densidade
- zonas explícitas para `header`, `toolbar`, `content` e `detail`
- sticky header consistente entre home, campaigns e discover

Base de evolução:

- `src/app/dashboard/components/Board.tsx`

### 2. `BoardRailV2`

Refinar a trilha horizontal dos boards para parecer uma superfície contínua:

- larguras mais consistentes
- espaçamento uniforme entre boards
- scroll horizontal com snap suave
- melhor comportamento para 1 board, 2 boards e 3 boards

Base de evolução:

- `src/app/dashboard/boards/PinnedBoardsHub.tsx`

### 3. `BoardTabsV2`

Substituir tabs com aparência utilitária por um padrão mais integrado ao shell:

- estado ativo mais forte
- melhor compactação em mobile
- consistência entre campanhas, comunidade e futuros boards

Base de evolução:

- `src/app/dashboard/components/ThreadsTabs.tsx`

## Escopo por Board

### Board 1 — Ativação e Progresso

Objetivo:

Transformar o checklist atual em uma coluna orientada por etapa, com narrativa mais clara de progresso e ação.

Mudanças planejadas:

- destacar a etapa atual com progresso visível
- substituir grade uniforme de passos por fluxo mais guiado
- tratar desbloqueios PRO como parte da jornada, sem quebrar a leitura
- reduzir visual de card em favor de blocos mais integrados

Base atual:

- `src/app/dashboard/home/minimal/FlowChecklist.tsx`
- `src/app/dashboard/home/minimal/MinimalDashboard.tsx`

Saída esperada:

- um board que comunique "etapa atual", "próximo passo" e "atalhos concluídos"

### Board 2 — Campanhas / CRM

Objetivo:

Transformar o board de campanhas em pipeline operacional.

Mudanças planejadas:

- manter tabs `Gestão (CRM)`, `Minhas Publis` e `Calculadora`
- reprojetar a aba CRM para operar em dois níveis
- nível 1: grupos por status e resumo financeiro
- nível 2: detalhe inline da campanha selecionada
- permitir abrir briefing, ativos e resposta sem sair cedo demais do board

Base atual:

- `src/app/(dashboard)/campaigns/CampaignsBoard.tsx`
- `src/app/dashboard/home/minimal/ProposalsPanel.tsx`
- `src/app/(dashboard)/campaigns/CampaignsHub.tsx`

Saída esperada:

- uma experiência com agrupamento por status
- transição lista → detalhe dentro do board
- CTA principal de resposta com IA contextualizado pela proposta selecionada

### Board 3 — Comunidade

Objetivo:

Evoluir o board de comunidade para uma superfície mais curada e visualmente memorável.

Mudanças planejadas:

- dar mais protagonismo à seção editorial principal
- organizar filtros como linguagem de descoberta, não apenas controle
- melhorar presença visual dos conteúdos em ascensão
- equilibrar utilidade e apelo visual

Base atual:

- `src/app/dashboard/discover/DiscoverBoard.tsx`
- `src/app/dashboard/discover/DiscoverContentPage.tsx`

Saída esperada:

- um board com curadoria visível, melhor escaneabilidade e cards de conteúdo menos genéricos

## Fases de Execução

### Fase 0 — Fundação Visual

Entregáveis:

- especificação de tokens visuais para boards
- revisão do `Board.tsx`
- revisão do `PinnedBoardsHub.tsx`
- revisão do `ThreadsTabs.tsx`

Trabalho:

- definir padding, radius, sombras, densidade e estados
- padronizar cabeçalhos sticky
- separar melhor shell e conteúdo interno

Critérios de aceite:

- shell reutilizável por home, campaigns e discover
- nenhuma regressão de scroll vertical ou horizontal
- header actions e pin continuam funcionando

### Fase 1 — Activation Board v2

Entregáveis:

- nova composição do fluxo de ativação
- etapa atual com progresso
- ações prioritárias mais evidentes

Trabalho:

- evoluir `FlowChecklist.tsx`
- ajustar composição em `MinimalDashboard.tsx`
- revisar empty states e gating PRO para o novo layout

Critérios de aceite:

- o usuário entende a próxima ação sem ler todos os passos
- estados `done`, `in_progress` e `todo` continuam claros
- CTA de personalização e CTA PRO mantêm telemetria atual

### Fase 2 — Campaigns Board v2

Entregáveis:

- shell novo para o board de campanhas
- CRM com agrupamento por status
- componentes de linha de campanha mais densos e escaneáveis

Trabalho:

- evoluir `CampaignsBoard.tsx`
- extrair componentes específicos para status group, campaign row e summary strip
- reaproveitar dados do fluxo atual de propostas

Critérios de aceite:

- a proposta prioritária é identificável em até 5 segundos
- o board continua suportando `compactView`
- tabs seguem funcionais em desktop e mobile

### Fase 3 — Campaign Detail Panel

Entregáveis:

- painel ou estado inline para detalhe da campanha selecionada
- seções de briefing, ativos/contrato e resposta
- navegação de retorno simples para a lista

Trabalho:

- introduzir estado de seleção no CRM
- criar componentes para detalhe interno
- conectar CTA de resposta assistida por IA ao contexto da campanha

Critérios de aceite:

- lista e detalhe coexistem sem perder contexto
- não há salto abrupto de layout ao abrir uma campanha
- ações principais ficam acessíveis sem trocar de rota

### Fase 4 — Community Board v2

Entregáveis:

- nova composição de descoberta
- filtros refinados
- cards de conteúdo com presença visual melhor

Trabalho:

- evoluir `DiscoverBoard.tsx`
- alinhar visual do board com `BoardShellV2`
- revisar grid e hierarquia da seção principal

Critérios de aceite:

- feed continua rápido e funcional
- filtros mantêm clareza em mobile
- board comunica tendência e repertório com mais força visual

### Fase 5 — Integração na Home

Entregáveis:

- home com boards mais coesos entre si
- harmonização entre fluxo de ativação, campanhas e comunidade

Trabalho:

- ajustar `HomeClientPage.tsx`
- revisar como boards pinados aparecem juntos
- validar proporção visual do trilho completo

Critérios de aceite:

- a home deixa de parecer um mosaico de módulos independentes
- as larguras dos boards convivem bem no rail
- o comportamento de pinagem não sofre regressão

### Fase 6 — QA, Rollout e Telemetria

Entregáveis:

- checklist visual e responsivo
- plano de rollout por flag
- validação de métricas

Trabalho:

- validar eventos atuais e acrescentar novos eventos se necessário
- revisar contraste, foco, sticky areas e scroll
- liberar gradualmente por feature flag

Critérios de aceite:

- sem regressão de acessibilidade
- sem regressão de navegação em mobile
- métricas de uso das ações principais disponíveis após deploy

## Componentes Novos Recomendados

- `BoardShellV2`
- `BoardSection`
- `BoardToolbar`
- `BoardProgressHeader`
- `BoardTabsV2`
- `CampaignStatusGroup`
- `CampaignRow`
- `CampaignDetailPanel`
- `ActivationHeroStep`
- `CommunityTrendCard`

## Regras de Implementação

1. Não duplicar shell visual entre home, campaigns e discover.
2. Extrair primitives antes de estilizar casos específicos.
3. Manter `compactView` como requisito de projeto, não como ajuste tardio.
4. Preservar telemetria já emitida por CTAs existentes.
5. Evitar criar uma dependência rígida entre visual novo e dados novos de backend.

## Dependências de Dados

Este plano deve priorizar reuso do que já existe.

Se surgirem necessidades novas, limitar a expansão a:

- status detalhado da campanha para pipeline
- metadados mínimos para painel de detalhe
- contagens resumidas por estágio

Evitar nesta fase:

- reescrever contratos de API sem necessidade
- atrelar a nova UI a uma grande refatoração de dados

## Telemetria Recomendada

Preservar:

- `dashboard_cta_clicked`
- eventos de cópia do mídia kit
- eventos de paywall já existentes

Adicionar, se necessário:

- `campaign_board_status_opened`
- `campaign_selected`
- `campaign_detail_action_clicked`
- `community_filter_selected`

## Riscos

- introduzir complexidade visual sem resolver prioridade de ação
- exagerar no uso de cards com nova maquiagem visual
- quebrar `compactView` ao otimizar só para desktop
- acoplar demais o board de campanhas a um caso específico de proposta

## Ordem Recomendada de Implementação

1. Fundação visual do shell e tabs
2. Activation Board v2
3. Campaigns Board v2
4. Campaign Detail Panel
5. Community Board v2
6. Integração final na home
7. QA e rollout controlado

## Critérios de Sucesso

- o usuário entende o estado atual do dashboard em menos de 5 segundos
- a campanha prioritária fica evidente sem navegação adicional
- a home passa a parecer um workspace contínuo
- a comunidade ganha valor visual sem perder utilidade
- a experiência mobile mantém legibilidade e prioridade de ação
