# Landing — Fase 2: experiência da reunião

Status: implementada e validada localmente em 19/07/2026.

## Contrato aplicado

- Reunião toda quinta-feira, das 19h às 21h (`America/Sao_Paulo`).
- Toda conta autenticada, gratuita ou Pro, pode assistir sempre.
- O grupo de WhatsApp permanece exclusivo dos assinantes.
- Assinantes que confirmam presença no grupo são analisados naquela edição.
- O calendário aponta para `/reuniao`, sem gravar o link bruto da sala no celular.

## Superfícies entregues

- Página autenticada canônica `/reuniao`.
- Download de calendário em `/api/community/meeting/calendar`.
- CTAs da landing retornam para `/reuniao` depois do login.
- Entrada dedicada na sidebar e na área de Comunidade.
- Confirmação da reunião ao final do onboarding mobile.
- Fallback semanal unificado no resumo do dashboard; removido o cálculo antigo de segunda-feira.

## Fonte do link da sala

Ordem de precedência:

1. `joinUrl` do próximo `CommunityEvent` agendado com `type=mentorship`.
2. Variável de ambiente server-only `WEEKLY_MEETING_JOIN_URL`.
3. Sem uma das duas fontes, a interface mostra “O link da sala será liberado aqui” e não inventa um destino.

Antes do deploy, cadastrar o próximo evento ou configurar `WEEKLY_MEETING_JOIN_URL` na Vercel. A variável não deve usar o prefixo `NEXT_PUBLIC_`.

## Validação executada

- 9 testes unitários direcionados: aprovados.
- `npm run build`: aprovado.
- Navegador sem login: preserva `callbackUrl=/reuniao`.
- Navegador autenticado desktop e iPhone 13: conteúdo, CTA de agenda e regra Pro renderizados; sem overflow, overlay ou erros de página.
- `.ics`: HTTP 200, duração de duas horas e URL interna `/reuniao`.

Avisos já existentes no projeto durante o build: dependência dinâmica do OpenTelemetry e opções antigas do ESLint.

## Fase 2.1 — verdade operacional

Decisões incorporadas em 20/07/2026:

- O relógio nunca transforma a página automaticamente em “ao vivo agora”.
- Quinta-feira, 19h–21h, é apresentada como horário previsto.
- O WhatsApp é o primeiro canal para links, mudanças e cancelamentos.
- Gratuitos entram pela rota rastreável `/api/dashboard/community/free-join`.
- Assinantes são direcionados ao grupo Pro, onde também confirmam presença.
- O calendário usa status `TENTATIVE` e avisa que a previsão pode mudar.
- Uma edição cancelada cadastrada usa status `CANCELLED`, oculta o link da sala e prioriza o comunicado no WhatsApp.
- O onboarding mantém agenda e WhatsApp na mesma tela e abre o WhatsApp sem encerrar a etapa.

## Fase 3 — reunião no Perfil

Decisões incorporadas em 20/07/2026:

- O Perfil passa a exibir um card de reunião em destaque abaixo da calculadora e acima do `Seu Mapa`.
- O card usa a mesma fonte operacional da página `/reuniao`; não calcula estado “ao vivo” no cliente.
- Visitantes recebem o canal gratuito de avisos; assinantes recebem o grupo Pro e a orientação para confirmar presença ali.
- O estado cancelado substitui a data por uma mensagem explícita e mantém o WhatsApp como próxima ação.
- O segundo CTA leva à página canônica `/reuniao`, onde o link vigente e a agenda ficam concentrados.
- Os botões de entrada na comunidade foram removidos do cabeçalho e do fim da rodada de Collabs.
- Alertas de match pelo WhatsApp continuam em Collabs, pois são uma função diferente do acesso ao grupo da reunião.
- A troca entre Perfil e Collabs reinicia a rolagem no topo para evitar uma superfície aparentemente vazia depois de visitar o card.

## Fase 4 — onboarding do visitante

Decisões incorporadas em 20/07/2026:

- A conclusão do onboarding diz explicitamente que o visitante já pode assistir gratuitamente.
- WhatsApp, agenda e acesso à página da reunião ficam juntos e podem ser usados em qualquer ordem.
- Abrir WhatsApp ou salvar a agenda não conclui nem avança automaticamente a etapa.
- A decisão final separa `Quero ser analisado no Pro` de `Entrar gratuitamente no app`.
- A assinatura é apresentada como experiência completa: análise mediante confirmação no grupo, Mapa, pautas, collabs e ferramentas entre reuniões.
- O checkout originado nessa etapa retorna ao Perfil com intenção de entrada na comunidade Pro.
- Estados gratuitos, inclusive depois da prévia, nunca recebem CTA de conexão do Instagram.
- O convite para conectar Instagram continua disponível somente para assinantes/admin após a etapa da reunião.

## Fase 5 — conversão e onboarding Pro

Decisões incorporadas em 20/07/2026:

- O checkout originado no funil da reunião (`postCheckoutIntent=join_community`) deixa de redirecionar em silêncio e passa por uma tela de boas-vindas Pro.
- A ordem dos passos é deliberada: primeiro o grupo de assinantes, onde a presença é confirmada; depois a conexão do Instagram; por último a volta ao app.
- A tela explica que quem confirma presença no grupo é analisado naquela edição e que mudanças e cancelamentos aparecem primeiro ali.
- Guarda-corpo financeiro: `/billing/success` confirma o plano em `/api/plan/status` antes de liberar qualquer passo Pro.
- Quando a Stripe ainda não confirmou o pagamento, nenhuma tela de conexão do Instagram é oferecida; o usuário vê "Estamos confirmando seu pagamento" e segue no app como visitante.
- Indisponibilidade da rota de status não bloqueia quem pagou: só um `status` explicitamente inativo aciona o estado pendente.
- A apresentação do plano passa a citar quinta-feira, 19h–21h, e a análise mediante confirmação no grupo.

Validação: 6 testes da confirmação de checkout, `npm run build` aprovado e inspeção autenticada em iPhone 13 e desktop (grupo antes do Instagram, sem overflow, sem erros de página).

## Fase 6 — canal gratuito de avisos

Decisões incorporadas em 20/07/2026:

- O canal gratuito de avisos tem link canônico próprio em `COMMUNITY_FREE_WHATSAPP_URL`, separado do grupo Pro (`COMMUNITY_WHATSAPP_URL`).
- Operação inicial manual: sem WhatsApp Business API, sem disparo individual, sem template pago e sem fornecedor terceirizado.
- O visitante sempre entra pela rota rastreável `COMMUNITY_FREE_JOIN_ROUTE`, que registra o opt-in antes de redirecionar.
- As três superfícies do funil (`/reuniao`, card do Perfil e onboarding) passam a usar a mesma constante, em vez de repetir a rota em texto.

### Bug corrigido nesta fase

`NextResponse.redirect` exige URL absoluta, mas o destino padrão do caminho gratuito era `/planning/discover`. Em qualquer ambiente sem `NEXT_PUBLIC_COMMUNITY_FREE_URL` configurada, o botão "Receber avisos" quebrava — justamente o único canal operacional do visitante. Agora o padrão é o próprio canal gratuito e valores relativos são resolvidos contra a origem da aplicação.

A rota também deixou de importar o NextAuth no topo do módulo (carregamento sob demanda, mesmo padrão do saque de afiliados), o que a tornou testável.

Validação: 3 testes novos da rota, 17 testes das suítes do funil, `npm run build` aprovado e verificação no servidor local — `/api/dashboard/community/free-join` responde 307 para o canal gratuito.

## Fechamento de lacunas (auditoria do funil)

Revisão de 20/07/2026 encontrou duas entregas previstas nas fases 3 e 5 que não tinham chegado ao código:

- O card do Perfil não oferecia conversão ao visitante. Agora ele tem, abaixo das duas ações, um CTA calmo — "Quer levar seu conteúdo para análise? Conheça o Pro" — que abre o paywall com `postCheckoutIntent=join_community`. O CTA não aparece para assinantes nem em edição cancelada.
- A tela de boas-vindas Pro dependia de uma intenção que só o onboarding definia, então quase ninguém a veria. Agora ela é o destino padrão de `/billing/success`: quando nenhum destino específico da feature reivindica o usuário, o grupo vem primeiro, o Instagram depois. Os redirecionamentos por contexto (calculadora, mídia kit, planner, campanhas) seguem intactos.

Validação: 13 testes das suítes afetadas, `npm run build` aprovado e verificação autenticada em iPhone 13 — boas-vindas Pro sem intenção nenhuma no armazenamento e card do Perfil na posição correta, sem CTA de upgrade para quem já é Pro.

### Pendência de decisão

Quem vem da landing cai direto em `/reuniao`, mas o onboarding (agenda, WhatsApp, escolha de participação) vive no board do Perfil. O visitante que segue exatamente o CTA da landing pode nunca ver essa etapa. Duas saídas: repetir o bloco de agenda/WhatsApp/escolha na primeira visita de `/reuniao`, ou levar o login da landing ao Perfil e terminar o onboarding oferecendo "Ver detalhes da reunião". Recomendação: a primeira.
