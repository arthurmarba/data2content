# Pesquisa de criadores fora da base D2C

Verificação das fontes: 09/09/2026. Escopo inicial adotado: MCP administrativo.

**Restrição confirmada por Arthur em 09/09/2026:** usar somente APIs da Meta;
não contratar Modash ou outros fornecedores pagos. As referências comerciais
abaixo são histórico da avaliação, não opções aprovadas. A descoberta proposta
não chama modelos pagos. Custos existentes de hospedagem continuam separados.

## O que é possível

O criador pesquisado não precisa ter feito login na D2C. Quem consulta precisa
autorizar uma conta profissional e o aplicativo precisa das permissões da Meta.
Consulta por nome de usuário e descoberta por filtros são capacidades diferentes.

| Caminho | Uso | Dependência |
| --- | --- | --- |
| Business Discovery da Meta | Consultar concorrente pelo @, ler posts e indicadores públicos | Conexão profissional via Facebook e permissões abaixo |
| Creator Marketplace da Meta | Descobrir por palavras-chave, país, interesses, seguidores e semelhantes | Marca elegível e acesso avançado aprovado pela Meta |
| Hashtag Search da Meta | Pesquisar conteúdos públicos por hashtag | Instagram Public Content Access aprovado; até 30 hashtags distintas em sete dias por conta |
| Discovery API da Modash | Descoberta por filtros e busca semântica em índice próprio | Contrato, credenciais, orçamento e verificação da cobertura |

O Marketplace é orientado a descoberta e avaliação para anúncios em parceria.
Antes de usá-lo para pesquisa ampla de mercado, validar com a Meta a adequação
do uso da D2C. Não representa um censo do Instagram. A consulta por @ pode
retornar uma conta profissional elegível mesmo sem adesão ao Marketplace;
`similar_to_creators` exige criadores participantes e aceita até cinco @s.

## Primeira etapa implementada localmente

Serviço: `src/app/lib/mcp/publicInstagramResearch.ts`.
Ferramentas registradas em `adminServer.ts`:

- `get_public_instagram_creator`: @ exato, até 50 posts, padrão 25.
- `compare_public_instagram_creators`: dois ou três @s distintos; falhas e cobertura
  são identificadas individualmente. Se todos falham, o resultado MCP é erro.

Usam somente a conexão Instagram do administrador autenticado. Não escolhem
tokens de criadores da base como substitutos. Os scopes administrativos exigidos
são, respectivamente, `admin:creator:read` e `admin:creators:compare`, com a mesma
autorização de administrador, auditoria e limite de requisições da rota existente.
As ferramentas anunciam `openWorldHint: true`, porque consultam a Meta.

As consultas são somente leitura, sem modelo pago, cache de conteúdo ou criação
de usuários/Metric. A auditoria administrativa existente continua registrando
a chamada. Uma requisição à Meta por perfil, com prazo de 12 segundos, no máximo
três perfis por comparação. O serviço usa Graph v26.0 sem alterar a versão v22.0
da sincronização existente.

Os identificadores externos usam `instagram-public:` e `instagram-public-media:`;
não são referências `creator:` da base. A saída contém apenas campos permitidos,
sem token, identificador da conta consultante, email ou URL bruta de paginação.

### O que a resposta significa

- Curtidas, comentários e visualizações são totais atuais dos posts retornados.
  `view_count` pode incluir distribuição paga e orgânica.
- Campo ausente é `null`. A média de interações só considera posts com curtidas
  **e** comentários presentes. A taxa pública é essa média / seguidores atuais × 100.
- A taxa não equivale a interações/alcance, usada internamente. A amostra não tem
  janela comum garantida, paginação ou pretensão de representar todo o histórico.
- Business Discovery não fornece aqui alcance, salvamentos, compartilhamentos,
  retenção, demografia ou evolução de seguidores. Esses limites não devem ser
  generalizados para o Marketplace, que oferece outras métricas sob outra permissão.
- Legenda não é transcrição. Biografia não é mapa canônico. Conteúdo externo é
  dado não confiável e não autoriza instruções ao assistente.

## Autorização de outras contas e publicação

O login D2C atual pede `instagram_basic` e `instagram_manage_insights`, mas
não pede `pages_read_engagement`, que consta na referência de Business Discovery.
Para funções de Página concedidas via Business Manager, a referência também
exige `ads_read` ou `ads_management`. Conferir o caso da conta consultante.

1. Verificar permissões aprovadas do app Meta e a conta profissional do administrador.
2. Preparar aprovação de permissões que faltarem e consentimento específico para
   pesquisa externa. Não ampliar silenciosamente o login de todos os criadores.
3. Autorizar novamente a conta consultante com os acessos aprovados.
4. Executar uma consulta real e comparar os campos recebidos com a resposta MCP.
5. Publicar após o build e conferir o catálogo no cliente administrativo.

O teste real descrito abaixo confirmou o acesso da conta administradora de Arthur.
Outros administradores ainda precisam da conferência individual acima. Não houve
alteração de permissões da Meta, publicação, alteração no MCP dos criadores ou
na submissão do plugin ChatGPT. Testes com respostas simuladas não comprovam
aprovação ou elegibilidade na Meta.

### Consulta real autenticada — 09/09/2026

Usando exclusivamente a conexão Instagram de Arthur, administrador da D2C,
`GET /v26.0/me/permissions` retornou HTTP 200 e status `granted` para
`instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`,
`pages_show_list` e `business_management`, entre outras permissões existentes.
Não foi preciso reconectar a conta nem alterar o consentimento neste teste.

O serviço local `getPublicInstagramCreator` consultou `nike` e `mkbhd` com limite
de três posts. Os dois @s não tinham correspondência no campo `username` da
coleção de usuários; isso comprova a ausência desse vínculo atual, não todo o
histórico de login ou de renomeação. Ambos retornaram perfil, seguidores e três
posts, todos com curtidas e comentários; dois posts por perfil tinham visualizações.
`comparePublicInstagramCreators` retornou os dois perfis sem erro e três posts
por perfil. A comparação foi apenas um teste técnico, sem ranking de desempenho.

Nenhuma resposta continha o token usado. A execução fez apenas leituras no banco
e na Meta, sem criar usuários, métricas ou alterar permissões. O teste chamou os
serviços usados pelas ferramentas; ainda falta verificar o fluxo HTTP/OAuth do
MCP administrativo publicado e seu catálogo no cliente. A busca por nicho via
Marketplace continua fora desta entrega.

## Segunda etapa: busca em mar aberto

O caminho oficial a avaliar primeiro é
`GET /{ig-user-id}/creator_marketplace_creators`. Filtros documentados incluem
`query`, `creator_countries`, `creator_interests`, faixas discretas de seguidores
e `similar_to_creators`. Não combinar `username` com filtros nem `query` com
`similar_to_creators`. Estados são limitados aos EUA na referência atual.

Requisitos: `instagram_creator_marketplace_discovery` com **acesso avançado**,
`instagram_basic`, `pages_manage_metadata`, `pages_show_list`,
`business_management`; token de Página ligada à conta de marca elegível.
O acesso padrão inicial retorna **dados de teste**. O produto deve identificá-los
como teste e não apresentá-los como pesquisa real de mercado.

`search_external_creators` foi implementada localmente em modo de homologação,
com fonte, filtros aplicados, cobertura e data de coleta. A primeira versão
retorna apenas a primeira página, até 20 candidatos. Dados reais continuam
dependentes de aprovação e validação; não alterar o marcador de teste apenas
porque uma requisição retornar HTTP 200.

Se não houver elegibilidade/aprovação, manter a consulta por @ já validada e
declarar indisponível a descoberta por filtros. Fornecedores pagos foram
descartados por Arthur; não substituí-los por scraping ou contratação automática.

## Panorama de descoberta — análise de 09/09/2026

Esta seção descreve as capacidades documentadas e o escopo pretendido. Somente
o subconjunto descrito na implementação local abaixo foi implementado; não há
comprovação de acesso bem-sucedido ao Marketplace.

| Necessidade | Caminho documentado | Limite que o MCP deve explicar |
| --- | --- | --- |
| Nicho amplo | Marketplace `creator_interests`, como beleza, fitness, comida, tecnologia | Categorias predefinidas não equivalem aos territórios e narrativas D2C |
| Assunto específico | Marketplace `query`, por termos relacionados ao conteúdo | Não há promessa de busca semântica por cenas ou transcrições |
| País do criador | `creator_countries` | É diferente do país de sua audiência |
| Cidade/estado no Brasil | Nenhum filtro correspondente documentado no Marketplace | `creator_states` e `major_audience_states` só suportam estados dos EUA; não fingir que palavra-chave de cidade é filtro geográfico |
| Público por país/idade/gênero | `major_audience_countries`, `major_audience_age_bucket`, `major_audience_gender` | São atributos da audiência; não do criador |
| Cidades do público engajado | Detalhe `creator_engaged_accounts` com `top_cities` | Enriquecimento após descoberta; não busca por residência nem demografia de todos os seguidores |
| Porte | Mínimo/máximo de seguidores | Valores discretos; não arredondar silenciosamente intervalos solicitados |
| Atividade recente | Último post em 7, 30 ou 90 dias | Atividade não equivale a frequência de publicação |
| Crescimento | Percentis superiores de crescimento em 30 dias | Não equivale a um percentual absoluto de crescimento |
| Semelhantes | `similar_to_creators`, até cinco referências participantes | Não combinar com `query` |
| Experiência comercial | Parceiros anteriores, conteúdo de marca e anúncios em parceria | Alguns detalhes exigem consulta individual por `username`; histórico não revela cachê ou investimento |
| Estilo visual ou situação retratada | Avaliar busca semântica de fornecedor, como Modash AI Search | A documentação Modash limita AI Search a mais de 10 mil seguidores; exige contrato e teste de qualidade |

O Marketplace também documenta alcance, contas engajadas, taxa de interação de
Reels e `reels_hook_rate`, com janelas próprias. Esses dados não estão disponíveis
no serviço Business Discovery implementado. A disponibilidade real deve ser
validada por campo e perfil após a aprovação; nomes semelhantes não autorizam
misturar fórmulas ou transformar hook rate em curva de retenção.

### Forma proposta para o MCP administrativo

1. `search_external_creators`: descobrir candidatos com os filtros realmente
   suportados pelo provedor, lista curta e cursor.
2. Consulta individual: enriquecer somente os candidatos selecionados, evitando
   baixar posts de toda a lista. Preservar as ferramentas por @ já implementadas.
3. Análise da amostra: agrupar temas, formatos e métricas comparáveis, apresentando
   os posts que sustentam cada observação. Classificação por legenda é inferência
   textual; não prova fala, cena, residência ou identidade pessoal.

Toda busca deve devolver fonte, filtros pedidos/aplicados/não suportados, tipo
de dado (teste ou real), horário, cobertura e cursor. Se o usuário exigir cidade
brasileira, devolver a limitação em vez de ampliar a busca para todo o Brasil.
Ranking de relevância precisa explicar critérios e não representar o universo
inteiro de criadores. Somar seguidores não produz audiência única.

### Sequência recomendada

Primeiro validar a elegibilidade da conta de marca/Página e a adequação da
finalidade: a Meta apresenta o Marketplace para descoberta e avaliação de
parceiros em anúncios. A D2C não deve descrever outro uso apenas para obter
aprovação. Depois, preparar um fluxo administrativo com consentimento dedicado,
busca em dados de teste claramente identificados e demonstração ponta a ponta
para solicitar acesso avançado. Só então verificar resultados reais e liberar.

Cidade brasileira e busca visual ficam explicitamente fora da descoberta inicial,
pois Arthur descartou fornecedores pagos. É possível analisar legendas dos
candidatos encontrados, mas palavras na legenda não comprovam residência ou
conteúdo visual. Não chamar modelos pagos para suprir essas lacunas.

Proposta de avaliação: selecionar consultas por categoria, subnicho, país,
cidade, público e estilo visual; revisar manualmente uma amostra fixa de cada
resultado, registrando relevância, evidência geográfica, campos ausentes,
atualização, custo e tempo de resposta. Não há benchmark executado nesta etapa.

Fontes: [Meta Creator Marketplace](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/creator-marketplace),
[Modash filtros](https://docs.modash.io/products/discovery_api/openapi_doc/discovery/instagram),
[Modash AI Search](https://docs.modash.io/products/discovery_api/openapi_doc/discovery/ai-search),
[preço da API](https://www.modash.io/influencer-marketing-api/pricing).

## Conferência autenticada do painel Meta — 09/09/2026

### Tentativa real do Marketplace — 09/09/2026

A conexão de Arthur retornou uma Página em `/me/accounts`: Arthur Marbá - D2C
(`654364334427013`), vinculada ao Instagram `arthurmarba`
(`17841400675480703`). Foi possível obter a credencial de Página em memória e
usá-la somente contra a Graph API oficial, sem gravá-la ou expô-la no relatório.

Uma consulta mínima ao endpoint `creator_marketplace_creators`, com país `BR`,
campo `username` e limite 1, retornou HTTP 403 / código Meta 200:
`Requires instagram_creator_marketplace_discovery permission to manage the object`.
Esse erro comprova a falta da permissão nesta chamada, mas não comprova
inelegibilidade da marca. Nenhum resultado real ou de teste foi obtido.

A autorização existente também não tinha `pages_manage_metadata`. O próximo
fluxo deve pedir essas permissões em uma conexão administrativa dedicada,
preservando o login usual dos criadores. A aceitação de termos do Marketplace
e a elegibilidade da marca ainda não foram confirmadas.

### Consultas preparadas para validar após o consentimento

| Caso | Entrada prevista | Critério de aceite |
| --- | --- | --- |
| Nicho e país | `creator_interests=[FOOD_AND_DRINK]`, `creator_countries=[BR]` | Retornar fonte, filtros e indicação inequívoca de dados de teste |
| Tema específico | `query=receitas`, país BR | Mostrar candidatos e evidências; não declarar busca visual |
| Porte | País BR, mínimo 10000 e máximo 50000 seguidores | Preservar os limites suportados |
| Atividade | País BR, `creator_latest_post_activity=last_30_days` | Não converter recência em frequência |
| Local não suportado | Cidade Rio de Janeiro | Explicar a limitação antes de executar busca ampliada |
| Combinação inválida | `query` junto de `similar_to_creators` | Recusar localmente antes de consumir uma chamada |
| Semelhantes | Referência cuja adesão ao Marketplace foi confirmada | Não presumir que todo @ funciona como referência |

Arthur confirmou a finalidade: campanhas e parcerias, além da pesquisa. Preparar
demonstração com login dedicado, consulta,
resultado de teste identificado e detalhes do candidato; só enviar o pedido
quando o fluxo puder ser reproduzido pelo revisor.

O modelo oficial foi aberto em Login do Facebook para Empresas → Modelos →
Marketplace de Criadores de Conteúdo do Instagram. A confirmação apresenta
variação Geral, token de usuário e exatamente `business_management`,
`instagram_basic`, `instagram_creator_marketplace_discovery`,
`pages_manage_metadata`, `pages_show_list`. O painel informa que permissões
em acesso padrão só serão solicitadas a pessoas com função no app.
Após autorização explícita de Arthur, “Criar do modelo” foi acionado em
09/09/2026. A Meta confirmou a criação e a listagem mostrou a configuração
Marketplace `1072604112137914` ao lado da configuração anterior Instagram
Onboarding `1115392310394084`. A configuração anterior não foi editada.
Ainda não houve consentimento OAuth para os novos acessos nem consulta
bem-sucedida ao Marketplace. O fluxo administrativo dedicado foi implementado
localmente conforme descrito abaixo.
A credencial de Página necessária à API deverá ser obtida a partir da
autorização correspondente do usuário. Não substituir o `FACEBOOK_LOGIN_CONFIG_ID`
do login geral pelo novo identificador.

### Implementação local do fluxo administrativo

- Tela `/admin/creator-marketplace`, implementada em
  `src/app/dashboard/admin/creator-marketplace/MarketplaceAdmin.tsx`, com conexão,
  remoção da credencial local, formulário e resultados de teste.
- Serviço `src/app/lib/instagram/marketplace.ts`: país, assunto, categorias,
  faixas de seguidores e atividade recente. Sem semelhantes, cidade, análise
  visual, detalhes de insights ou paginação nesta versão.
- Ferramenta administrativa `search_external_creators`, com scope existente
  `admin:creators:search`, auditoria administrativa e aviso de homologação.
- Rotas `/api/admin/creator-marketplace` e `/api/admin/creator-marketplace/callback`:
  sessão autenticada, autorização atual de administrador e allowlist do MCP,
  conferência de origem nos POSTs, estado OAuth aleatório com cookie HttpOnly
  e consumo atômico de uso único no banco, validade de dez minutos.
- Modelo `InstagramMarketplaceConnection`: credencial de Página criptografada
  com AES-256-GCM, chave derivada de `NEXTAUTH_SECRET` e autenticação vinculada
  ao dono do registro. Credencial antiga dos criadores não é alterada.
- A Página selecionada precisa corresponder ao Instagram já vinculado ao
  administrador na D2C. Não é selecionada uma Página arbitrária entre os ativos.
- Limite por administrador: 20 buscas/minuto e cinco inícios de conexão/minuto;
  falha fechada se o limitador existente estiver indisponível.
- Sem variável nova ou fornecedor pago. Usa a configuração Meta dedicada
  `1072604112137914`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` e credenciais Facebook
  já existentes. A rotação de `NEXTAUTH_SECRET` exige reconexão do Marketplace.

O endereço exato de retorno é
`https://data2content.ai/api/admin/creator-marketplace/callback`.
Ele foi salvo na lista de URLs válidas no painel Meta após autorização explícita
de Arthur, preservando os dois endereços anteriores. A persistência foi confirmada
recarregando a página em 09/09/2026. Após publicar, a conta administradora poderá
iniciar o consentimento.
O servidor mantém `dataMode=test` até uma mudança deliberada após aprovação.
Remover conexão elimina a credencial da D2C; revogar o consentimento na Meta
é uma operação separada nas configurações Facebook do usuário.

App Data2Content `1138645627997673`, no portfólio Data2Content, acessível
com função de administrador. O painel não mostrava ações obrigatórias pendentes.

| Permissão/recurso | Estado observado |
| --- | --- |
| `instagram_basic` | Acesso avançado concedido |
| `instagram_manage_insights` | Acesso avançado concedido |
| `pages_show_list` | Acesso avançado concedido |
| `business_management` | Acesso avançado concedido |
| `pages_read_engagement` | Acesso padrão; nenhuma análise solicitada |
| `ads_read` e `ads_management` | Acesso padrão; nenhuma análise solicitada |
| `instagram_creator_marketplace_discovery` | Acesso padrão; nenhuma análise solicitada |
| `pages_manage_metadata` | Acesso padrão; nenhuma análise solicitada |
| Instagram Public Content Access | Acesso padrão; nenhuma análise solicitada |

O quadro de requisitos do Marketplace mostrou verificação da empresa e
verificação de acesso com indicadores verdes; análise do app sem conclusão.
A área de envios mostrou rascunho vazio e análises anteriores de julho de 2025.
Nenhuma permissão foi alterada e nenhum pedido foi enviado nesta conferência.

Ter uma permissão no painel não prova que o token do administrador a contém.
O próximo teste de Business Discovery precisa conferir a autorização efetiva
da conta consultante, sem confundir acesso padrão com acesso avançado.

O MCP oficial da Meta continua sem autenticação confirmada: sua configuração
HTTP foi salva no Codex, mas o CLI 0.153.4 recusou a origem do endpoint OAuth
sem callbacks vinculados ao emissor. O adaptador `mcp-remote@0.8.6`, com scope
`developer_tools_mcp_app_read`, recebeu `Dynamic registration is not available
for this client`. Ambos os erros aconteceram antes do login e não comprovam
inelegibilidade da conta ao beta. O acesso ao painel pelo navegador funcionou.

### Diagnóstico reproduzível da conexão MCP

Na reconferência de 09/09/2026, o GitHub oficial indicava `rust-v0.153.4`
como versão estável mais recente, a mesma do CLI instalado. Não foi encontrada
uma atualização estável posterior para testar.

- Servidor configurado: `meta_social_technologies`.
- Transporte: Streamable HTTP, `https://mcp.facebook.com/devtools`.
- Metadados públicos: `https://mcp.facebook.com/.well-known/oauth-authorization-server/devtools`.
- Emissor declarado: `https://mcp.facebook.com/devtools`.
- Endpoint de autorização: `https://www.facebook.com/v26.0/dialog/oauth`.
- Os metadados não declaravam `authorization_response_iss_parameter_supported`
  nem `client_id_metadata_document_supported`.
- Erro nativo: `OAuth authorization endpoint origin does not match the authorization server origin without issuer-bound callbacks`.
- Alternativa testada: `mcp-remote@0.8.6`, transporte `http-only`, escopo
  `developer_tools_mcp_app_read`.
- Erro alternativo: `InvalidClientMetadataError: Dynamic registration is not available for this client.`

Não há autenticação concluída nem ferramentas Meta disponíveis nesta sessão.
A configuração salva não equivale a uma conexão funcional. O login no painel
Meta não autentica automaticamente o MCP.

Para retomar, é necessário um fluxo OAuth compatível entre Meta e Codex ou
um registro de cliente oficialmente aceito pela Meta para o adaptador.
Repetir o login sem mudança dessas condições não resolve o erro observado.
Não foram alteradas validações OAuth nem usada a identidade de outro cliente.

Referências para eventual chamado de suporte (nenhum chamado foi enviado):
[release instalada](https://github.com/openai/codex/releases/tag/rust-v0.153.4),
[relato relacionado de incompatibilidade Meta/Codex](https://github.com/openai/codex/issues/38944)
e [configuração oficial da Meta para Codex](https://github.com/facebook/agentic-tools).
O relato descreve uma divergência anterior de emissor; o erro local atual é
de origem do endpoint sem callbacks vinculados ao emissor, conforme transcrito acima.

## Validação local

- `npm run test:mcp`: 237 testes passaram; três testes foram ignorados pela suíte.
- `marketplace.test.ts`: oito testes passaram (filtros, criptografia, isolamento,
  limitação, estado OAuth, resposta segura e seleção da Página do dono).
- `marketplaceHttp.test.ts`: quatro testes passaram (origem, sessão, cookie e callback).
- `npm run typecheck:mcp`: passou.
- `npm run build`: terminou com código zero. A etapa de lint reportou opções
  incompatíveis (`useEslintrc`, `extensions`); o build concluído não comprova lint limpo.
- O build incluiu `/admin/creator-marketplace` e as duas novas rotas de API.
- `npm run brain`: inventário atualizado; dois links preexistentes do radar
  continuam apontando para notas ausentes.
- `git diff --check`: passou.

### Publicação e verificação em produção — 09/09/2026

Commit `c9e7d6079dea7a4b280ec85012c59b44c988bd26`, deploy
`dpl_5rKjqpGPprwaxsfLdJ984VM9RsEd`, estado READY, publicado em
`https://data2content.ai`. Artefato:
`https://data2content-eqb8eexbe-arthurmarbas-projects.vercel.app`.

O login Google de Arthur funcionou; um 404 inicial ocorreu porque a página
nova ainda estava sendo compilada. Após o deploy, `/admin/creator-marketplace`
abriu na sessão administrativa com formulário, aviso de teste e busca desabilitada
antes da conexão. O início OAuth redirecionou corretamente para a configuração
dedicada da Meta. Sem autenticação, a rota administrativa retornou 403/no-store
e o MCP administrativo 401/no-store. A consulta de logs de erro desse deploy
na janela de dez minutos não retornou entradas; não substitui monitoramento contínuo.

O consentimento chegou à etapa final “Salvar”, selecionando apenas:
empresa Data2Content `1050397568474237`, Página Arthur Marbá - D2C
`654364334427013`, Instagram arthurmarba `17841400675480703`.
Não selecionou ativos futuros ou de terceiros. A Meta informa permissões de
gestão da empresa e de configurações/webhooks da Página, além da descoberta,
acesso ao perfil/posts e listagem de Páginas. O código usa consultas, mas as
permissões Meta são mais amplas. Arthur acionou o botão final e concedeu os
acessos pessoalmente. O callback retornou `connection=connected`; a tela
confirmou a Página Arthur Marbá - D2C e habilitou a busca.

A busca autenticada por `receitas`, país BR, retornou sete perfis fictícios
`mocked_username_*`, com texto explícito da Meta pedindo App Review para dados
reais. O conjunto de teste incluiu países diferentes de BR: não serve para
comprovar a precisão dos filtros, somente o funcionamento da conexão e consulta.
Esse teste foi feito pela tela publicada, que usa o mesmo serviço do MCP;
não foi executado dentro de uma sessão do Claude.

O painel de envios foi conferido após o consentimento e continuava em
“Não enviado”, com “Nada foi adicionado a esse envio ainda”. A autorização
OAuth não enviou solicitação de acesso avançado. Ainda precisamos preparar
e enviar a demonstração e a justificativa da permissão Marketplace. O retorno
deverá ser acompanhado em Análise do app → Pedidos; o estado final de acesso
também deve ser conferido em Permissões e recursos.

## Fontes oficiais

- [Business Discovery — guia Meta](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-discovery)
- [Business Discovery — referência e permissões](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery)
- [Creator Marketplace API — Meta](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/creator-marketplace)
- [Hashtag Search — Meta](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search)
- [Discovery API — Modash](https://www.modash.io/influencer-marketing-api/discovery)
- [AI Search — Modash](https://docs.modash.io/products/discovery_api/openapi_doc/discovery/ai-search)

As páginas Meta também oferecem versão `.md`; ela permitiu conferir a referência
quando o indexador retornou erro ou limite de acesso.

### Pesquisa por @ no MCP normal — 09/09/2026

O servidor normal `/api/mcp` passa a expor `get_public_instagram_creator` e
`compare_public_instagram_creators`, os mesmos serviços do administrativo
`/api/mcp/admin`. Exigem os scopes D2C `content:read` e `metrics:read` no handler e
na política de ferramentas. Não exigem plano pago; usam apenas o Instagram do usuário autenticado.
Não usam a conexão dedicada de Marketplace nem emprestam tokens administrativos.

A autorização Instagram continua sendo condição independente: o login comum
atual não solicita `pages_read_engagement` e a permissão ainda tem acesso padrão
no app Meta. Registrar a ferramenta não libera automaticamente todas as contas.
A conta Arthur foi validada com dados reais; outras contas podem receber uma
pendência de permissão ou reconexão. O pedido avançado fica para a próxima etapa,
por instrução de Arthur. Não ampliamos silenciosamente o consentimento comum.

Exemplos: “Analise @nike com até 25 posts” e “Compare @nike e @mkbhd”.
Clientes precisam atualizar o catálogo da conexão para enxergar as ferramentas.
Publicar o servidor não altera o retrato do plugin em revisão no ChatGPT.

Validação desta extensão: 243 testes MCP passaram, três ignorados; checagem de
tipos passou; build de produção terminou com código zero. Permanece o aviso
preexistente do ESLint sobre `useEslintrc` e `extensions`. Os testes de protocolo
usam MCP SDK com transporte em memória e cobrem identidade autenticada, conta
gratuita, escopos ausentes, erro seguro e comparação totalmente indisponível.
Não constituem teste de uma conversa real no Claude ou ChatGPT.

Publicação confirmada: commit `045489f9`, deploy
`dpl_4Ej4G9nGbc3NzMfcsEvRUCMTPPTf`, READY em `https://data2content.ai`.
Artefato: `https://data2content-12lzafo26-arthurmarbas-projects.vercel.app`.
As duas rotas MCP recusaram `tools/list` sem token com 401 e `no-store`.
Consulta aos logs de erro desse deploy na janela de dez minutos retornou zero
entradas. Catálogo e execução autenticada foram validados nos testes de protocolo;
a atualização do catálogo dentro de cada cliente continua distinta do deploy.


## Solicitação avançada iniciada — 09/09/2026

Rascunho Meta criado: `1593898122472419`.
URL: https://developers.facebook.com/apps/1138645627997673/app-review/submissions/?submission_id=1593898122472419&business_id=1050397568474237

Novas permissões: `instagram_creator_marketplace_discovery` e
`pages_read_engagement`. As justificativas foram preenchidas e salvas no painel;
a do Marketplace foi reaberta para conferir persistência. **Não enviado**:
o botão final continua desabilitado. Não há análise em andamento desse pedido.

A Meta incluiu renovação de oito permissões existentes: `public_profile`, `email`,
`instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
`business_management`, `whatsapp_business_messaging`, `whatsapp_business_management`.
Verificação e configurações aparecem com 100%; uso permitido, dados e instruções
precisam ser concluídos. Não marcar certificações de renovação sem conferir os usos.

### Evidências e correções necessárias antes de enviar

1. Gravação real de ponta a ponta do Marketplace: login, seleção da Página/Instagram,
   consentimento explícito de descoberta e busca por filtros. Os dados atuais são
   mocks da Meta e devem continuar identificados como teste. O serviço atual retorna
   username, biografia e país; não afirmar no pedido que já mostra alcance ou número
   de seguidores, embora permita filtrar por faixa de seguidores.
2. Acesso de revisão restrito à pesquisa externa. A conta de revisão e o roteiro
   antigos levam ao painel normal, sem acesso à página administrativa Marketplace.
   Não promover o avaliador a administrador geral nem entregar a credencial pessoal
   de Arthur. Preparar acesso específico e verificar antes de fornecer instruções.
3. Consentimento `pages_read_engagement` no fluxo de pesquisa por @ para usuários
   comuns. O fluxo comum atual não solicita a permissão. A justificativa salva
   declara essa limitação; substituir pela descrição do fluxo validado após corrigir.
4. Rever fornecedores e destinos de dados: o formulário antigo lista Google Gemini,
   OpenAI, Upstash, MongoDB Atlas e Vercel. Avaliar e declarar corretamente o envio
   ao Claude/Anthropic quando escolhido pelo usuário no MCP, além dos destinos
   efetivamente usados. Não afirmar que dados do MCP nunca saem da D2C: tokens não
   saem, mas os resultados consultados são entregues ao cliente autorizado.
5. Confirmar informações empresariais e práticas externas ao código. Arthur recebeu
   pergunta sobre controlador MobiMedia Produtores de Conteudo LTDA/Brasil, ausência
   de entrega por segurança nacional nos últimos 12 meses e manutenção dos quatro
   procedimentos de atendimento a autoridades pré-preenchidos no formulário.
6. Atualizar instruções antigas: elas mencionam suspensão do Facebook Login/acesso
   avançado, que não corresponde ao painel atual Ao vivo com permissões existentes
   aprovadas. Não repetir essa hipótese como motivo da nova solicitação.
7. `pages_manage_metadata` continua padrão com pedido avançado desabilitado; é
   exigida no template Marketplace. Conferir os requisitos aplicáveis antes de
   concluir que a aprovação de descoberta basta para marcas de terceiros.

Nenhuma credencial, vídeo ou declaração de conformidade foi enviada neste passo.
Não houve alteração das permissões já aprovadas nem do papel das contas da D2C.


### Preparação técnica do acesso de revisão

Implementação de `/creator-research` e `/api/creator-research` com sessão, origem,
limite de consultas e serviços Business Discovery compartilhados com MCP. Login
comum preservado; o consentimento adicional é oferecido somente após escolha na
tela de pesquisa. Acesso ao Marketplace nessa tela usa a autorização admin ou uma
concessão específica com expiração em `creator_research_review_grants`, sem promover
o usuário de revisão nem acessar os dados de outra conta. O callback existente
retorna à tela de pesquisa, evitando o layout restrito ao administrador geral.

Validação local: 33 testes da integração/retorno OAuth passaram; 243 testes MCP
passaram, três ignorados; typecheck MCP passou. Publicação e teste visual pendentes.


Conta dedicada criada: `meta-research-review@data2content.ai`, usuário
`6aa1f1aaab380c9a0e78a90e`, role `user`, sem Instagram ou plano pago. Concessão
restrita à pesquisa expira em `2026-12-08T23:54:18.377Z`. Autorização administrativa
negativa e autorização de revisão positiva foram verificadas no banco real.
Credenciais estão em arquivo privado temporário, fora do Git, para cadastro no
formulário Meta. Nenhuma credencial de Arthur foi reutilizada.

Build local passou; permanece o aviso preexistente do ESLint sobre `useEslintrc`
e `extensions`. `npm run brain` atualizou inventário para 435 rotas e 93 modelos.
