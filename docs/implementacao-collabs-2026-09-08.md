# Collabs: implementação local e liberação

Data: 08/09/2026. Referência: [plano completo](plano-melhorias-collabs-2026-09-08.md).

## O que mudou

- **Uma proposta para os dois.** `CollabProposal` conserva ideia, versão, dupla, contribuições e plano. Só dois aceites na mesma proposta confirmam a parceria. O servidor escolhe os participantes a partir de dados próprios; não confia na pessoa ou no texto enviado pelo navegador.
- **Escolhas persistentes.** Decisões são transacionais. Pausa concorrente disputa a mesma revisão dos participantes. Reenvios não substituem parceiro nem multiplicam confirmação. Outra pessoa nunca recebe intenção ou recusa unilateral.
- **Histórico compatível.** Decisões antigas conservam o parceiro original; combinações antigas pedem revisão do plano. A leitura de combinações não depende de haver pautas ativas nem da renovação do plano comercial. O adaptador antigo rejeita novas confirmações sem proposta versionada.
- **Uma experiência.** Página dedicada e aba do Perfil usam `CollabsPinnedBoard` e `useCollabsController`. Revalidam ao retornar, retomam jobs pendentes e preservam dados disponíveis quando uma fonte falha. Novas rodadas aguardam abertura explícita.
- **Participação explícita.** Disponível, pausado e não informado são estados diferentes. Interesse antigo não liga disponibilidade. Modalidades remoto, presencial e ambos respeitam escolha e cidade. Avatar ausente não elimina uma conta apta. O pool percorre candidatos elegíveis antes do corte final.
- **Inteligência com limites.** Contexto de narrativa e territórios precede audiência. Leituras de 28 dias usam o núcleo de evidência do Perfil, incluindo cobertura e fontes. Métricas sem cenas não viram evidência visual forte. A promoção pública para padrão consistente continua desligada. Horários são sugestões de teste.
- **Pautas e dupla.** Há validação de território, direção concreta, plano gravável, entrega do gancho e promessas indevidas, além de comparação de ângulo/gancho com o histórico e composição diversa. Matching exige contribuição dos dois e proposta comum; falha de IA não produz parceiro por coincidência lexical. Recusa limita reapresentação da mesma dupla no mesmo território por 30 dias.
- **Fila e cota.** `CollabJob` usa idempotência, uma execução ativa por usuário/tipo, lease, checkpoint, no máximo três tentativas e recuperação pelo cron. `ContentIdeaQuota` reserva atomicamente e consome uma rodada por entrega válida. Falha libera a reserva. Dezembro renova em janeiro do ano seguinte. Matching tem orçamento diário atômico; admin conserva ausência de limite comercial para ideias.
- **Acervo e teclado.** Salvas permanece visível, tem busca nos itens carregados, paginação e estado publicada. Há desfazer, cancelar interesse, marcar publicada e encerrar parceria confirmada. Diálogos contêm o foco, fecham por Escape e devolvem o foco ao acionador. A altura mínima do baralho evita cards invisíveis em contêineres sem altura fixa.
- **MCP e avisos.** MCP e o adaptador de sugestões antigo leem propostas preparadas, com as mesmas permissões. Confirmar cria eventos de aviso na mesma transação. WhatsApp usa template, consentimento vigente e versão de API configurada; resposta externa ambígua não é reenviada automaticamente. O aplicativo continua sendo o canal básico.

## Validação executada

- Suíte focada: **180 testes aprovados em 16 suítes**, cobrindo Collabs, pautas, evidência, adaptadores e interface.
- 14 testes com **replica set MongoDB descartável**, sem usar a URI de produção: concorrência, replay, versão, propriedade, pausa, privacidade, responsabilidades, expiração, idempotência, cota e falha.
- Referência de **30 cenários automáticos** de integridade editorial e condições de recomendação em `src/app/lib/collabs/quality.test.ts`. Esse conjunto testa filtros; não é avaliação humana de 30 gerações reais.
- `npm run check:scripts-quality`: testes e benchmark existente aprovados.
- TypeScript e ESLint direto; compilação de produção. A integração de lint embutida no Next emite aviso de opções incompatíveis com a versão instalada do ESLint; a execução direta é a verificação de lint desta mudança.
- Navegador em 390×844 e 1440×1000 com **controlador real, sessão e APIs simuladas**: card visível, biblioteca, busca e Escape. Capturas em `output/playwright/collabs-shared-{mobile,desktop,salvas}.png`. Isso não equivale a um teste com duas contas reais em produção.

As reproduções temporárias que afirmavam o comportamento defeituoso foram desativadas. O código permanente exige o comportamento corrigido.

## Liberação operacional

O dry-run da migração foi executado: zero combinações com expiração indevida, zero parceiros ausentes, 554 contas com participação não informada e dois caches legados. Nenhuma migração de contas, ativação do piloto, chamada editorial de IA em produção ou envio de WhatsApp foi executado nesta implementação. Os comandos abaixo usam `.env.local` e, portanto, podem apontar para o banco real.

1. Publicar código capaz de ler propostas novas e legadas. Manter essa compatibilidade em qualquer recuo.
2. Executar `npm run migrate:collabs -- --dry-run` e revisar as contagens. O script é somente leitura por padrão; com `--apply`, cria índices aditivos e retira expiração indevida de combinações legadas. Não infere consentimento, não gera pautas e não cria aceites.
3. Executar a migração aprovada com `npm run migrate:collabs -- --apply`. A configuração inicial desliga geração; configuração preexistente não é substituída. Cache legado permanece armazenado, mas não alimenta o novo motor.
4. Conferir QStash e o cron existente `recover-content-intelligence`. `/api/worker/collabs` exige assinatura. Não há variável de ambiente nova.
5. Preparar o grupo com `npm run configure:collabs -- --enable --pilot=ID1,ID2` e revisar o dry-run. Acrescentar `--apply` para efetivar. Sem configuração persistida, produção mantém geração desligada.
6. Antes de ampliar, revisar pautas reais pela rubrica do plano: mapa, honestidade, especificidade, gancho/entrega, execução, diversidade e contribuição dos dois. Comparar com a amostra antiga e observar custo e cobertura. Os testes locais não demonstram preferência humana nem aumento de reciprocidade.
7. Para WhatsApp, validar um template aprovado em português com dois parâmetros no corpo (nome da outra pessoa e título da pauta), credenciais e versão da Graph API utilizada pelo aplicativo. Configurar `--approved-template=NOME --api-version=VERSAO_VALIDADA --apply`. Por decisão de 08/09, a funcionalidade está oculta na interface; não ativar os avisos de Collabs nesta liberação.
8. Ampliar explicitamente com `--enable --all-users --apply`. Para recuar: `--pause --apply`; para interromper avisos: `--disable-whatsapp --apply`. Leitura, salvas e histórico continuam acessíveis.

`audit:collabs` agora lê `opportunityBrief.kind`, aplica elegibilidade real e apresenta propostas comuns, exposição aos dois lados e jobs por estado. `CollabProposal.exposed` registra o card efetivamente mostrado; não é contagem de visitas. Resultados de notificação com `delivery_needs_review` exigem conciliação operacional antes de qualquer novo envio.

## Limites a acompanhar no piloto

A deduplicação editorial automática ainda é heurística: sinônimos e histórias muito parecidas precisam da amostra humana. A cobertura recente usa no máximo 200 métricas por leitura. Histórico de propostas é preservado integralmente; se crescer substancialmente, deve ganhar paginação própria para não aumentar o payload inicial. Busca do acervo atua nos itens carregados, com botão para carregar os seguintes. Nenhum filtro automático certifica causalidade ou qualidade editorial por si só.

## Preparação de publicação — 08/09/2026

- Ocultados os alertas e a vinculação do WhatsApp no aplicativo, inclusive acessos antigos e promessas comerciais de alertas. Comunidade e contatos comerciais preservados.
- Migração aditiva aplicada: zero combinações com expiração indevida, zero parceiros ausentes, 554 participações não informadas e um cache legado. Índices das quatro novas coleções criados; consentimentos preservados.
- Fila: credenciais cadastradas em produção e agendamento `content-intelligence-recovery` ativo (`20 */6 * * *`).
- Verificação ampliada: 325 testes aprovados em 37 suítes; os 14 testes de persistência passaram separadamente com MongoDB descartável fora do sandbox (a primeira tentativa local não iniciou o processo a tempo). Total: 339 testes. Build de produção e ESLint direto aprovados após a ocultação.
- Piloto inicial preparado para as três contas administradoras, enquanto o alcance mais amplo aguarda definição.

## Bloqueio externo confirmado

A chamada mínima ao modelo de pautas em 08/09 retornou HTTP 429 com créditos pré-pagos esgotados. Por isso, o piloto das três contas administradoras fica configurado, mas com geração pausada. A avaliação editorial de gerações reais e o teste de entrega de pautas pela fila dependem da reposição de saldo do Gemini. Não houve ampliação para outros usuários nem envio de WhatsApp.
