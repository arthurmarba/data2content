# ChatGPT Ads — aquisição e assinaturas

## Escopo aprovado

Campanha `cmpn_4164b938c3d48198ad1e70aacbc56725`, Brasil, seis anúncios em três grupos (roteiros, ideias e engajamento), destino `https://data2content.ai/` com UTMs. Limite total compartilhado de **R$ 70**, encerramento em 15/09/2026; lance máximo de R$ 1 por clique. Não é orçamento de R$ 70 por anúncio nem promessa de ritmo diário. O limite diário de R$ 10 foi recusado pela plataforma e substituído pelo teto total autorizado.

Mensagem: a D2C assiste aos conteúdos do criador para contextualizar ideias e roteiros. Evitar prometer resultado sempre superior, alcance garantido ou publi contratada. Mais de 20 mil seguidores é indicador interno, não texto do anúncio.

## Como a medição funciona

- Somente a campanha conhecida e visitantes que aceitaram medição entram no funil. Sem consentimento, não há cookie de aquisição nem evento interno novo.
- Cookie `d2c_acquisition`: aleatório, HttpOnly, SameSite Lax, duração de 90 dias. O banco guarda seu hash. Sobrevive ao redirecionamento do Google; a vinculação usa a sessão autenticada, nunca um usuário enviado pelo navegador.
- Primeiro anúncio preservado; último anúncio pago elegível em 30 dias. Recarregar a mesma URL não renova a janela. Uma nova origem identificável pode trocar o último anúncio, não o primeiro.
- As etapas não exigem ordem rígida. Instagram é um estado confirmado no banco, com data da observação, não necessariamente a data histórica de conexão.
- Cadastro novo é separado de login em conta existente. O onboarding é reconciliado pelo servidor, inclusive nos endpoints desktop e mobile.
- Checkout iniciado significa pedido válido de checkout, não aprovação financeira. Falha/abandono não vira assinatura.
- Assinatura iniciada inclui trial e mês com cupom de 100%. Só fatura com valor pago positivo cria o primeiro pagamento. As faturas são deduplicadas por ID, a assinatura por ID de assinatura.
- Webhook do Stripe é a fonte financeira. A atribuição e o identificador do anúncio ficam congelados na assinatura; uma visita orgânica posterior não toma o crédito da renovação.
- Retenção técnica dos registros: 400 dias para acompanhar recorrência. O cookie de navegação continua limitado a 90 dias. Revogação bloqueia novos envios e apaga referências OpenAI dos registros; marcos históricos pseudônimos não são excluídos automaticamente no ato da revogação.

## Privacidade e OpenAI

Esta integração usa **Conversions API pelo servidor**, sem ativar o SDK de navegador de correspondência automática. Assim não varre formulários nem envia nome, e-mail, IP, gravação de tela ou texto das conversas. `opt_out: true` exclui os eventos de futura personalização individual. Sem `oppref`/`obref`, o histórico interno permanece disponível, mas o evento não é encaminhado à OpenAI por falta de identificador de atribuição.

Fonte: `cds_6aa061fe0adc819a97c419d565c451f4`; pixel usado como identificador da fonte no servidor: `8QGHcGji5oYbKN23s61djA`.

Conversões cadastradas: `registration_completed`, `checkout_started`, `subscription_created` e `order_created` (somente primeiro pagamento da assinatura atribuída). Janela de atribuição da conta: 30 dias. A campanha continua com lance por clique; não foi criada campanha duplicada para mudar objetivo.

As credenciais privadas `OPENAI_ADS_API_KEY`, `OPENAI_ADS_PIXEL_ID` e `OPENAI_ADS_CONVERSIONS_API_KEY` ficam em `.env.local` e na Vercel Production. Não definir `NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID` para esta modalidade server-side. O código antigo da integração MCP continua separado; quando há cookie da aquisição, a tela de sucesso não envia uma segunda conversão.

## Relatório

`/admin/acquisition`, com autorização de administrador no servidor. Mostra gasto e cliques da API de anúncios, chegadas consentidas, cadastro, checkout, assinantes e pagantes por anúncio, custo por assinante/pagante e receita bruta BRL (antes de taxas e reembolsos). Filtro de pessoas conhecidas com mais de 20 mil seguidores não reduz o gasto total do anúncio.

Período seleciona a coorte da chegada atribuída. Pagamentos posteriores aparecem na coorte original. Pessoas são únicas por etapa e anúncio; uma pessoa que visita dois anúncios pode aparecer nos dois. O histórico mostra até 100 jornadas recentes e 40 marcos por jornada, sem nomes ou e-mails. “Última etapa observada” não é sinônimo de desistência.

A API de gasto exige horários completos: relatório encerra a consulta na última hora completa e informa esse limite. Ausência/erro na API aparece como indisponível, não como zero. Atualização da consulta é sob demanda, com cache de um minuto. GA4 continua responsável por navegação; banco/Stripe são a referência de assinatura e dinheiro.

## Operação e validação

`/api/cron/acquisition-conversions` recebe assinatura QStash ou CRON_SECRET. Processa até 20 eventos por chamada, com posse temporária, ID fixo para repetição, recuo progressivo e até 12 tentativas. Eventos com mais de sete dias deixam de ser reenviados porque a API não os aceita. Cadastrar apenas o agendamento `acquisition-conversions`, a cada cinco minutos; não executar todos os crons de mensagens para liberar este recurso.

Testes isolados cobrem consentimento, recarga, primeira/última origem, identidade, conta existente, checkout abandonado, mês grátis, pagamento positivo, duplicação, renovação, formato atual da fatura, retry e revogação. A Conversions API aceitou três formatos em `validate_only: true`, sem criar conversões fictícias.

Não escalar com base em um clique ou em zero conversões após apenas R$ 10. O primeiro teste serve para verificar entrega, qualidade das chegadas e passagem pelo funil. Gasto sem impressão/clique pode indicar lance baixo ou falta de contexto elegível; nenhum aumento automático de orçamento está configurado.

### Verificação da implementação

- 64 testes direcionados passaram (oito suítes). Incluem os contratos HTTP de consentimento, identidade, origem e proteção de eventos financeiros.
- `npm run build` concluiu; ESLint executado diretamente nos arquivos novos também passou. O build ainda informa a incompatibilidade preexistente das opções do ESLint integrado ao Next, além de avisos de Sentry/OpenTelemetry.
- Navegador real: cookie ausente antes do aceite, HttpOnly após o aceite, chegada única após recarga, preço registrado, alteração de preferências e recusa com HTTP 204 e remoção do cookie. O registro de teste e seus dois eventos foram removidos após a conferência, sem enviar conversões fictícias à OpenAI.
- Sem autenticação, o relatório redireciona ao login sem incluir os dados e o cron retorna 401. Não foi realizada cobrança real; a confirmação financeira e a vinculação pós-Google foram verificadas nos testes isolados.
- Índices únicos e de expiração das duas coleções foram criados e conferidos no banco. As três variáveis privadas foram cadastradas como segredos em Production.
