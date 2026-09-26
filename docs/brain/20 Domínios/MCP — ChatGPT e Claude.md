---
tipo: domínio
---

# MCP — a Data2Content dentro de outros chats

## O que é

Uma porta que deixa o ChatGPT e o Claude conversarem com a inteligência da Data2Content: o criador pergunta lá, o dado vem daqui.

## Onde mora

| Peça | Caminho |
| --- | --- |
| Servidor | `src/app/lib/mcp/server.ts` |
| Catálogo de ferramentas | `catalog.ts` |
| Estado da conta | `accountState.ts` |
| Política de conversa | `conversationPolicy.ts` |
| Inteligências | `creatorIntelligence.ts`, `scriptIntelligence.ts`, `collabIntelligence.ts`, `campaignRadar.ts` (`contentIntelligence.ts` e `toolAuthorization.ts` não estão ligados a nenhuma ferramenta) |
| Norte do criador | `creatorNorth.ts` |
| Login (OAuth) | `src/app/lib/mcp/oauth/`, `auth.ts` |
| Permissões | `entitlement.ts`, `toolAuthorization.ts` |
| Administrativo (só leitura) | `adminServer.ts`, `adminCatalog.ts`, `adminAuthorization.ts`, `adminAudit.ts` |
| Análise de toda a base | `adminAnalytics.ts`, `adminCreatorAnalysis.ts` |
| Saldo de seguidores | `followerGrowth.ts` → [[Seguidores]] |
| Qualidade | `qualityEvals.ts` |
| Mapa do creator | `creatorMap.ts` |
| Rotas | `/api/mcp/*` |

## A regra de conversa

`conversationPolicy.ts` **não é detalhe**: é o produto. Ele decide o que o assistente pode dizer, quando pede o Norte, e o que nunca deve fazer — nomeadamente, **nunca vender plano, preço ou upgrade, e nunca mandar pro checkout**. Mexer nessa política é mexer no posicionamento, não no código.

## O mapa alimenta as respostas (desde 06/09/2026)

Por um bom tempo o `MapaSeed` era lido no MCP em **um lugar só** — `collabIntelligence.ts`, para casar parceiros — e nunca para responder ao próprio criador. As respostas no Claude e no ChatGPT saíam de categoria de classificação, sem camada narrativa: duas Data2Content respondendo a mesma pergunta de jeitos diferentes.

Hoje:

- **`get_creator_map`** devolve narrativa, territórios, temas, assets, tom e formatos — mais o **nível de evidência** (`declared` / `one_reading` / `two_readings`), que é o que autoriza tratar a narrativa como firme. Visível a qualquer conta que tenha mapa, mesma regra de `evaluateMapaAccess`.
- **`list_content_ideas`** devolve as pautas já ancoradas em narrativa e território. **Pro apenas** — a recusa aponta o perfil e nunca oferta plano.
- **`get_creator_intelligence_snapshot`** carrega o resumo do mapa e avisa em `coverage` quando ele falta ou a narrativa não está firme.
- O **vocabulário viaja junto com o dado**: sem isso o modelo trata "humor" como território e credencial como asset.

## Atalhos de conversa

Cinco prompts registrados, que aparecem prontos no cliente: `what_to_post`, `is_it_worth_posting`, `weekly_review`, `find_collab`, `script_from_idea`. Nenhum deles fala de plano ou preço — um teste trava isso.

## O inventário de inteligência

`intelligenceContract.ts` é o registro público do que o MCP se compromete a expor. Ele **já esteve completamente defasado**: citava nove ferramentas inexistentes e nenhuma das reais, porque o teste só conferia se a lista estava vazia.

Agora cada camada declara um `status`, e um teste em `server.test.ts` confere nome por nome contra as ferramentas registradas de verdade. Ao renomear ferramenta, o teste quebra — que é o ponto.

## Transcrição e cenas publicadas

`get_content_deep_analysis` junta o registro do Instagram (`Metric`) com a evidência
multimodal privada (`PublishedContentEvidence`). A legenda vem de `Metric.description`;
a transcrição integral, os segmentos temporais, a timeline, a estrutura narrativa e os
sinais visuais vêm da evidência publicada.

A transcrição e as falas de cada cena só saem quando `includeTranscript` é `true`. Sem
essa autorização explícita, a ferramenta informa que a transcrição existe e devolve a
timeline visual, mas omite tanto o texto integral quanto os trechos falados. A cobertura
de `analyze_creator_period` também é calculada por `PublishedContentEvidence` — nunca
por `Metric.text_content`, campo legado que não é preenchido pela integração atual.

**Cuidado ao compactar o banco:** `get_content_deep_analysis` lê diretamente
`transcript` e `scenes`; `analyze_creator_portfolio` calcula cobertura de fala e
cenas dentro de uma agregação MongoDB. Comprimir ou mover esses campos sem um
adaptador para as leituras e sem manter metadados consultáveis pode fazer o Claude
informar ausência de evidência existente ou reduzir incorretamente a cobertura.
Qualquer migração precisa comparar as respostas MCP antes/depois nos mesmos posts.

## Roteiro com evidência própria — implementação de 07/09/2026

Há dois caminhos sobre o mesmo seletor: `get_script_evidence_pack` entrega poucas
referências próprias para o modelo da conversa escrever; `generate_script_draft`
pede escrita ao motor interno. Não executar ambos para o mesmo rascunho. A nova
ferramenta não chama Gemini e não relê vídeos. Requer capacidade privada e scopes
de conteúdo, métricas e inteligência; geração genérica de conta sem capacidade
não consulta o corpus privado.

O ranking usa métricas atuais e declara a regra: engajamento é interações/alcance,
não retenção. Período, formato, IDs próprios e cobertura dos líderes viajam no
recibo. Texto planejado, fala observada e legenda não são intercambiáveis.

`ScriptEvidenceSession` conserva o pacote privado por sete dias para criticar com
o mesmo `clientRequestId` e guardar proveniência em `save_script`. Novo pedido
consulta métricas novamente; o cache da sessão não congela futuras seleções.
`record_script_feedback` guarda somente preferências expressas pelo criador.
A crítica técnica não comprova semelhança de voz: há sinais comparativos e uma
rubrica editorial, cuja melhora exige teste humano. Detalhes e operação em
`docs/script-intelligence-v3.md`; código implementado não significa publicação confirmada.

## Analisar todos os criadores pelo MCP admin — 07/09/2026

O MCP administrativo (`/api/mcp/admin`, outro recurso OAuth, `role=admin`) sabia
abrir **um** criador por vez. Agora sabe olhar a base inteira.

Três consultas fazem o trabalho, em `adminAnalytics.ts` e `adminCreatorAnalysis.ts`:

- `list_creators` percorre a base com cursor por `_id`, não por deslocamento — quem
  entra no cadastro no meio da varredura não empurra ninguém para fora da lista. O
  cursor carrega a impressão digital do filtro: mudou o filtro, o cursor é recusado.
- `analyze_creator_portfolio` roda **uma** agregação que junta `User` com `Metric` e
  com `PublishedContentEvidence`. O `summary` cobre todos os criadores do filtro; só
  as linhas por criador são paginadas. Isso é o contrário do de sempre: normalmente
  paginar significa ver um pedaço, aqui o pedaço é só a lista, o total é real.
- `get_creator_analysis` monta o dossiê de um criador — identidade, mapa, DNA que já
  estava salvo e desempenho contra a janela anterior — sem reconstruir perfil nem
  reler vídeo. Nenhuma das três chama modelo pago.

Duas decisões que valem lembrar:

**Numerador e denominador vêm do mesmo conjunto.** O engajamento agregado só soma
posts que têm interações *e* alcance. Somar todas as interações e dividir pela soma
de todos os alcances misturaria posts diferentes e daria um número que não descreve
post nenhum. O recibo diz quantos posts entraram (`eligiblePosts`).

**Ausente não é zero.** Cada métrica traz `availablePosts` junto de `totalPosts`. Se
nenhum post do período tem alcance, a soma sai `null` — e não zero, que o leitor
entenderia como "publicou e ninguém viu".

Os recibos ainda dizem em voz alta o que os números não são: alcance somado entre
posts não é público único; métrica atual de post antigo não é retrato do passado,
porque continua acumulando; e a "prioridade de atenção" mede lacuna operacional
(desconectado, sem post, vídeo sem fala lida), não qualidade do criador.

Na base real de 07/09/2026: 550 criadores, 501 desconectados, 56 com post nos
últimos 30 dias, 129 de 1.394 vídeos com fala lida. A consolidação inteira leva
cerca de 2 segundos — o `$lookup` por criador é barato porque `Metric` tem índice
`{user, postDate}` e `PublishedContentEvidence` tem `metricId` único.

Confira com `npm run smoke:mcp-admin-portfolio`: ele roda as três consultas no banco
real, sem escrever nada, e falha se um campo privado escapar.

## Saldo de seguidores por dia — 07/09/2026

`get_follower_growth` (e o gêmeo administrativo `get_creator_follower_growth`)
respondem "quantos seguidores eu ganhei ontem". O número é derivado, não informado
pelo Instagram, e as regras que impedem o modelo de mentir com ele estão em
[[Seguidores]]. `analyze_creator_portfolio` traz o mesmo saldo por criador e da
base inteira.

## Situação do ChatGPT

O plugin depende de aprovação da OpenAI e de um plano caro. Por isso a landing pública fala **só do Claude** até o aplicativo ser aprovado. Ver [[ChatGPT fora da landing]].

## Revisão do plugin — setembro de 2026

O portal guarda um retrato do catálogo em `Scan Tools`; publicar o servidor não atualiza a submissão. A versão 1.0.0 enviada tinha 18 ferramentas, enquanto o servidor passou a 26. Para alterar uma versão em revisão, a orientação oficial é cancelar a revisão e editar/reexaminar o mesmo rascunho. Não criar um segundo plugin por causa da evolução do código.

`get_script_evidence_pack` e `generate_script_draft` podem persistir sessão privada de sete dias: não são somente leitura mesmo sem adicionar roteiro à biblioteca. `find_campaign_opportunities` pode persistir seleção gratuita; `record_script_feedback` substitui preferências expressas e tem hint destrutivo.

Dois erros só apareceram no ensaio com a conta fictícia: `analyze_creator_period` retornava `notApplicable` e `transcriptCoverageCountsOnlyVideos` ausentes do schema declarado; a primeira preferência falhava porque `creatorFeedback` começa nulo. O contrato agora aceita os campos, e feedback usa mesclagem atômica com `$literal`, preservando campos omitidos e textos que começam por `$`.

Preparação, limitações e comandos estão em `docs/chatgpt-plugin-submission.md`. O teste em memória valida serviços e contratos, mas não substitui o fluxo OAuth dentro do ChatGPT.

Ao atualizar o catálogo no portal, confira também `Advanced settings → Default scope override`: a submissão antiga fixava nove scopes e excluía `campaigns:read`, embora o servidor já anunciasse dez. Isso emitia um token sem a permissão exigida pela conexão e o scan recebia 403. Remover o override antigo e refazer o consentimento com a conta fictícia permitiu capturar as 26 ferramentas. Não resolver esse caso afrouxando a autorização do servidor.

`MCP_SUPPORTED_SCOPES` também pode esconder ferramentas existentes: a produção omitia `profile:write`, necessário para `set_creator_north`. A correção de configuração inclui esse scope nos suportados e define `MCP_CONNECTION_SCOPES` explicitamente com as nove permissões anteriores; `campaigns:read` continua acrescentado pelo feature flag. Assim, anunciar a permissão de escrita não a torna requisito de todas as conexões existentes. Alterar o Norte continua exigindo consentimento com `profile:write`. A variável na Vercel só afeta produção após novo deploy.

## Pesquisa externa por @ — implementação local de 09/09/2026

`publicInstagramResearch.ts` consulta Business Discovery da Meta e alimenta
`get_public_instagram_creator` e `compare_public_instagram_creators` no MCP admin.
Usa apenas a conexão Instagram do administrador. Identificadores externos não
são `creator:`; métricas ausentes são `null`; a taxa pública divide por seguidores,
nunca por alcance. Até 50 posts por perfil e três perfis na comparação, sem
garantia de janela comum ou cobertura completa. Não cria usuários nem Metric.

O login atual não pede `pages_read_engagement`, exigida na referência da Meta.
Em 09/09, a autorização existente de Arthur já continha essa permissão e
`instagram_basic`/`instagram_manage_insights`, confirmadas por `/me/permissions`.
Os serviços locais consultaram `nike` e `mkbhd` e compararam ambos com sucesso,
com três posts por perfil; nenhum dos @s estava vinculado ao campo `username`
da base. Não houve escrita nem nova autorização. Isso valida essa conta
consultante; não comprova acesso de outros administradores ou publicação.
Descoberta por filtros tem API oficial própria: Creator Marketplace, com marca
elegível e acesso avançado aprovado; acesso padrão inicial entrega dados de teste.
Essa segunda etapa tem implementação local de homologação, ainda sem
autorização real ou publicação confirmada. Fontes e operação em
`docs/pesquisa-criadores-externos-mcp.md`.

Arthur descartou fornecedores pagos em 09/09: descoberta externa deve usar
somente a Meta, sem Modash e sem chamadas a modelos pagos para preencher lacunas.
Cidade brasileira e busca visual não são promessas desta entrega. Uma chamada
real de Marketplace com a credencial da Página vinculada a Arthur retornou 403,
exigindo `instagram_creator_marketplace_discovery`; a elegibilidade da marca
ainda não pôde ser confirmada. Arthur confirmou o uso para campanhas e
parcerias, além da pesquisa. Com autorização explícita, o modelo oficial de
login Marketplace foi criado na Meta: configuração `1072604112137914`.
O login geral continua com `1115392310394084`; não substituir seu config ID.
A conexão administrativa dedicada e `search_external_creators` estão
publicadas em `/admin/creator-marketplace`, com `dataMode=test`.
Usam `InstagramMarketplaceConnection`, credencial criptografada vinculada ao
dono, estado OAuth de uso único e limites por administrador. O callback dedicado
foi salvo e confirmado na Meta. Arthur concluiu o consentimento OAuth.

Publicado em 09/09 no commit `c9e7d607`, deploy `dpl_5rKjqpGPprwaxsfLdJ984VM9RsEd`.
A tela abriu com sessão administrativa e iniciou OAuth corretamente. O fluxo
usou somente os ativos próprios de Arthur e Data2Content. A consulta por
“receitas” retornou sete perfis fictícios da Meta (`mocked_username_*`), validando
conexão e busca em modo de teste. Os dados de teste não respeitaram o filtro BR;
não comprovam precisão ou cobertura dos filtros. O modelo pede gestão de empresa
e Página além de descoberta. O painel de App Review ainda mostrava rascunho vazio,
“Não enviado”; consentimento OAuth não equivale a pedido de acesso avançado.
A criação do modelo não concede acesso aos dados. Fonte e limites ficam em
`docs/pesquisa-criadores-externos-mcp.md`.

Conferência autenticada do app Meta em 09/09: `instagram_basic`,
`instagram_manage_insights`, `pages_show_list` e `business_management` têm
acesso avançado. `pages_read_engagement`, `ads_read`,
`instagram_creator_marketplace_discovery` e `pages_manage_metadata` estão no
padrão, sem análise solicitada. O Marketplace mostra empresa e acesso verificados,
mas ainda falta análise do app. Isso não comprova scopes do token consultante.
O MCP oficial da Meta falhou antes do login; acesso pelo painel web funciona.

## Chaves de ambiente

`MCP_ADMIN_ENABLED`, `MCP_CAMPAIGN_RADAR_ENABLED`, `MCP_SUPPORTED_SCOPES`, `MCP_CONNECTION_SCOPES`, `MCP_ADMIN_*`.

## Conferir

```bash
npm run test:mcp            # a suíte
npm run eval:mcp            # qualidade das respostas
npm run typecheck:mcp       # tipos (tsconfig próprio)
npm run smoke:mcp-oauth     # o login
npm run smoke:mcp-admin-portfolio   # a análise de toda a base, no banco real
```

## Ligações

[[Pautas e Roteiros]] · [[Collabs]] · [[ChatGPT fora da landing]]

- 09/09/2026: submissão 1.0.0 reenviada à OpenAI com as 26 ferramentas e o vídeo novo (`public/plugin/data2content-chatgpt-demo-v2.mp4`). `profile:write` já sai no metadata público, então conexão nova de revisor nasce podendo alterar o Norte. O motor interno segue em `local_fallback` por falta de créditos do Gemini.


## Pesquisa por @ também no conector normal — 09/09/2026

As duas consultas públicas também são registradas em `server.ts`, sem requisito
de plano, com scopes `content:read` e `metrics:read`. O proprietário da credencial
é sempre `context.identity.userId`; nunca usar token administrativo como fallback.
As permissões Meta de cada conta continuam obrigatórias. A conexão comum não
pede `pages_read_engagement`; liberar catálogo não significa liberar todas as
contas na Meta. A aprovação avançada será tratada depois desta entrega, por
pedido de Arthur. Não confundir atualização do MCP com atualização/aprovação
da submissão ChatGPT.

## D2C Admin no Codex: servidor local — 19/09/2026

O plugin pessoal `d2c-admin` usa `scripts/run-mcp-admin-local.sh`, que inicia
`scripts/mcpAdminLocal.ts` por stdio com `.env.local`. A configuração do plugin
passa `--user-id` com a conta de Arthur; o servidor confirma no banco que ela
continua administradora e respeita `MCP_ADMIN_ALLOWED_USER_IDS`, quando definido.
O stdout fica reservado ao protocolo, e os logs vão para stderr. Esse caminho
roda no computador, acessa a base configurada e dispensa OAuth no navegador.
Foi testado com a listagem das 19 ferramentas e uma consulta real de
`get_public_instagram_creator` para @thestevenmellor (20 publicações). Para
uma nova conversa, pedir simplesmente para usar D2C Admin e analisar o @.

O histórico abaixo explica os problemas do antigo caminho remoto OAuth.

Antes dessa mudança, o pacote era instalado localmente, mas o `.mcp.json`
apontava para `https://data2content.ai/api/mcp/admin`. Nesse caminho remoto,
o Codex precisava de OAuth próprio na primeira conexão; login no site ou no
Chrome não autorizava o MCP. Uma consulta direta pelo código local
(`getPublicInstagramCreator` com `.env.local`) não provava que o plugin
estivesse conectado.

O servidor OAuth da Data2Content anuncia os scopes do MCP comum e do Admin
juntos em `/.well-known/oauth-authorization-server`. O Codex, no login sem
parâmetros, pediu a lista inteira, incluindo `profile:write` e `scripts:write`.
Isso não serve para `/api/mcp/admin`: a autorização desse recurso rejeita scopes
do MCP comum. Para autorizar o plugin, iniciar o login com os sete scopes de
leitura administrativa explícitos:

```bash
codex mcp login d2c-admin --scopes admin:creators:search,admin:creator:read,admin:content:read,admin:metrics:read,admin:intelligence:read,admin:audience:read,admin:creators:compare
```

O processo de login precisa continuar aberto até o callback no `127.0.0.1`.
No Terminal integrado ao Codex, `codex` não estava no `PATH` em 19/09 e o
comando nem iniciou. Nesse ambiente, usar o executável completo
`/Applications/ChatGPT.app/Contents/Resources/codex` no lugar de `codex`.
Links antigos expiram; não reutilizar URLs de uma tentativa encerrada. A abertura
automática da página de autorização no Chrome "Arthur Marbá" retornou
`ERR_BLOCKED_BY_CLIENT` em 19/09. Se isso se repetir, usar `--no-browser` com
os mesmos scopes, manter o terminal aberto e abrir o URL gerado manualmente
no perfil correto. Conferir que o consentimento só pede leitura. Depois de
autorizar uma vez, novas conversas podem reutilizar a conexão. Para pesquisa
de um @ externo, a ferramenta é
`get_public_instagram_creator`; `search_external_creators` é só homologação com
dados fictícios do Marketplace e não serve para essa análise.

Outra falha vista no login do Codex em 19/09: após abrir o link com scopes
corretos, o servidor devolveu `redirect_uri não pertence ao cliente`. O Codex
usa porta local variável no callback OAuth, mas `createMcpConsentRequest` exigia
correspondência exata com a URI registrada. A correção permite variar somente
a porta de um callback HTTP loopback com mesmo host, caminho e query, mantendo
comparação exata para qualquer outro endereço.

## Pesquisa de inspirações por assunto — 25/09/2026

`research_inspiration_content` não pode selecionar os posts mais recentes e só
depois filtrar o tema em memória. Com 300 candidatos recentes, a busca por
“marketing” devolvia vazio apesar de haver posts elegíveis dentro dos 180 dias
pedidos. No modo `by_topic`, aplique a pré-seleção por palavras normalizadas nos
campos pesquisáveis antes de `$sort` e `$limit`; aceite as variantes com e sem
acento. O ranking continua sendo feito em memória sobre os candidatos encontrados.

Falhas de ferramenta podem voltar ao cliente como resposta MCP mesmo quando a
requisição HTTP termina com 200. Na investigação, confira `[mcp][tool_call_failed]`;
registre código e nome do erro do Mongo, sem mensagem nem consulta com dados do
creator. Não use apenas o status HTTP para concluir que todas as ferramentas
funcionaram.

## Imagens dentro da resposta — 25/09/2026

`get_creator_images` (MCP administrativo, `creatorImages.ts`) devolve a foto de perfil
e as capas dos posts **como bloco de imagem**, não como link. O Claude trabalha com lista
fechada de domínios e `fbcdn.net` não está nela: link de capa ali é link morto. O servidor
da D2C baixa (só de hosts do Instagram), reduz para 480px e manda os bytes.

- A capa **existe no banco**: `Metric.coverUrl` (e `thumbnailUrl` quando diferente). O
  contrato textual do MCP é que não a expõe — não confundir com "a base não guarda".
- URL do Instagram vence. Se a guardada falhar e a conta estiver conectada, pede uma nova
  à Meta (`fetchSingleInstagramMedia` / `profile_picture_url`) **sem gravar** — o MCP
  administrativo é somente leitura. Conta desconectada: devolve
  `url_expired_and_account_disconnected`, nunca inventa imagem.
- Teto de 12 imagens por chamada; os bytes não entram no JSON auditado.

## Plugin do Claude — 25/09/2026

Além de colar o endereço do MCP como conector, o criador pode instalar o plugin
`data2content`. Foi montado em `claude-plugin/` (só no computador do Arthur, fora
do repositório), já no formato de marketplace:
`.claude-plugin/marketplace.json` na raiz da pasta e o plugin em
`plugins/data2content/` (conector em `.mcp.json` apontando para
`https://data2content.ai/api/mcp`, mais seis skills). A skill `data2content` é o
guia — vocabulário, `get_account_state` primeiro, mapa como dicionário, nunca
vender. As outras cinco são os mesmos atalhos registrados como prompts no
`server.ts` (`o-que-postar`, `vale-postar`, `minha-semana`, `achar-collab`,
`roteiro`). **Mudou um prompt no servidor, muda a skill** — não há teste que
amarre os dois.

O plugin não tem login próprio: usa o mesmo OAuth com DCR do conector. Conferir
com `claude plugin validate claude-plugin` e
`claude --plugin-dir claude-plugin/plugins/data2content mcp list` (deve mostrar
"Needs authentication" antes do login).

Distribuir exige um repositório público com o `marketplace.json` na raiz — este
repositório tem o arquivo numa subpasta. O plugin é extra opcional e não foi
publicado.

**O que o Arthur queria era o conector no diretório do Claude**, não o plugin:
a Data2Content aparecendo em Configurações → Conectores para o criador conectar
com um clique. O envio é pelo portal `claude.ai/directory/manage` (qualquer plano
pago pode enviar) e pede página pública de ajuda com exemplos — criada em
`/conector-claude` — e política de privacidade que cite Claude e Anthropic, não
só ChatGPT e OpenAI. Textos do formulário e checklist em
`docs/claude-conector-diretorio.md`. A conta de revisão da OpenAI
(`openai-review-pro@`) serve para o revisor da Anthropic.

**Rasteira vista no teste:** `authenticateMcpRequest` exigia *todos* os scopes de
`getMcpConnectionScopes()` em cada requisição. Conexão feita antes de um scope
novo entrar (ex.: `campaigns:read`) passava a receber 403 em tudo, não só na
ferramenta nova — o conector do próprio Arthur no Claude estava assim em 25/09.

Corrigido em 25/09 com o aval do Arthur: a conexão agora exige só o scope básico
(`getMcpRequiredScope()`, `profile:read`), igual ao MCP admin, e cada ferramenta
cobra o seu via `scopeRequiredResult` — que já existia em todas. Conexão antiga
continua funcionando; só a ferramenta nova pede reconexão. Isso não afrouxa o que
cada ferramenta exige. O anúncio (`WWW-Authenticate` e metadata) continua pedindo
o conjunto completo, então conexão nova nasce com tudo. Testes em
`adminAuthIsolation.test.ts`. Ao criar ferramenta nova, **sempre** ponha o
`hasScope` dela: a entrada não protege mais por você.

## Reenvio à OpenAI — 26/09/2026

A 1.0.0 foi recusada por "login não concluído". A causa está em
[[Login do plugin conclui e a conexão morre]]. A versão reenviada leva 28 ferramentas
(as duas consultas públicas por @ ganharam justificativa), nota ao revisor sobre a
correção e o override de scopes removido de novo. O Claude recebeu a Data2Content
no diretório de conectores em 26/09, com status "Em revisão".

Depois da revisão das respostas (abaixo), a revisão foi cancelada e o mesmo rascunho
reenviado ainda em 26/09: override apagado pela terceira vez, `Scan Tools` com as 28
ferramentas e justificativas, notas novas e as seis declarações marcadas. O portal
mostra a 1.0.0 em **Review**. No consentimento do scan, o portal pediu 10 permissões,
sem `profile:write`: se a conta do revisor não tiver essa permissão, `set_creator_north`
pede reconexão em vez de gravar (ver [[Login do plugin conclui e a conexão morre]]).

## Revisão das respostas — 26/09/2026

Uma revisão de código achou respostas que podiam sair erradas no Claude e no ChatGPT. Foi tudo corrigido de uma vez, antes de reenviar às duas lojas:

- **O mapa respeita o card.** `get_creator_map` lê `CreatorMapConfirmations`, como o relatório semanal já fazia. Asset, narrativa, território ou tom recusados saem do dicionário e vão para `rejectedByCreator`. Narrativa confirmada vira firme (`narrativeConfirmedByCreator`), mesmo sem duas leituras. A confirmação vale para a frase que o creator viu: se uma leitura nova trocou a frase, a dimensão volta a pendente.
- **Collab com território de verdade.** `recommend_collab_creators` devolve primeiro as propostas da aba Collabs (`preparedProposals`, via `collabIntelligence.ts`) e marca `sharedTerritories` comparando os dois mapas. Antes, o atalho `find_collab` pedia o território em comum e a ferramenta não trazia nenhum, então o modelo inventava. A resposta também deixou de trazer alcance, salvamentos e compartilhamentos médios de outros creators: são insights privados deles e o contrato já prometia não expor.
- **O radar gratuito olha o assunto.** `build_creator_radar` pré-seleciona posts pelos territórios do mapa (ou pelo Norte). Quando acha menos de três, cai para o panorama geral e diz isso em `panoramaScope`. Antes eram os posts que mais performaram de qualquer tema.
- **"Viral" medido contra a base certa.** A pesquisa de inspirações compara cada post com o histórico de 180 dias do próprio autor, a mesma base de `analyze_inspiration_content`. Antes eram só os posts dele que caíam na amostra, e o mesmo post podia ser "fora da curva" numa ferramenta e "normal" na outra. A pesquisa também não faz mais `$lookup` do usuário inteiro para cada post da comunidade.
- **Unidade e ausência.** O tempo de Reels sai em segundos (`averageWatchTimeSeconds`). A análise de período diz a unidade de cada métrica (`metricUnits`; ali o tempo segue em milissegundos). Taxa sem denominador sai `null`, não 0 (`formulas.ts` grava 0 quando falta alcance ou visita ao perfil).
- **Semana contra trimestre.** `analyze_creator_period` traz `summary` com mediana e total sobre todos os posts do período (a lista de posts continua limitada) e `maturity`: post com menos de 7 dias ainda acumula, e o aviso `recent_posts_still_accumulating` impede de chamar isso de queda.
- **Padrões visuais por mediana.** A diferença contra a base só aparece com pelo menos 3 posts; antes, um viral fazia qualquer objeto dele parecer 3x.
- **Roteiro.** Salvar de novo com o mesmo `clientRequestId` e texto editado atualiza o roteiro (`saveResult`). A crítica com pacote vencido (7 dias) segue com evidência atual e avisa, em vez de falhar. Erros do motor viram mensagem legível, e o rascunho diz qual motor escreveu (`receipt.engine`).
- **Pautas.** As não publicadas vêm primeiro; `total` é o total real. Desde 26/09 a conta gratuita vê as pautas que já existem na conta, como no app (`list_content_ideas`, `search`, `fetch`); o que o plano gratuito não inclui é receber pautas novas toda semana, e a resposta diz isso em `planNote`. Arthur decidiu gerar pautas de amostra para quem vem do plugin.
- **Acabamento.** O lembrete da conta gratuita não duplica mais: a checagem serializava o array e as aspas do JSON interno vinham escapadas, então nunca casava. Ele também não entra em `search`/`fetch`, que devem ter um bloco só. O aviso de publis dizia "no ChatGPT" também no Claude. A recusa da Meta na pesquisa por @ fala com o creator; o detalhe técnico vai à parte. Saída fora do formato declarado agora aparece no log como `[mcp][tool_output_invalid]`, porque o SDK valida depois do log de sucesso.

Pendente, decisão de produto: o ranking antigo de collab considera qualquer creator ativo e conectado, sem pedir opt-in de collab. As propostas da aba Collabs pedem.

`scripts/smokePluginReview.ts` agora compara a lista de ferramentas do servidor com `chatgpt-app-submission.json` (28) e registra mapa, radar, collabs e resumo do período das contas de revisão.

## Origem da conversa e limites de plano — 26/09/2026

O MCP sabe se a conversa vem do Claude ou do ChatGPT (`clientSurface.ts`, pelo registro OAuth do cliente: o Claude volta para `claude.ai`, o ChatGPT para `chatgpt.com`). Os links levam `source=claude` ou `source=chatgpt`. Antes, todo link dizia ChatGPT, e quem vinha do Claude terminava numa tela "volte ao ChatGPT". A volta depois da assinatura e da conexão do Instagram tem rota própria para o Claude (`/dashboard/claude/ready`). O evento de funil do Claude (`claude_funnel_event`) é separado do evento do ChatGPT, porque aquele alimenta o pixel de anúncios da OpenAI.

Cada limite de plano diz o que ficou de fora ("… não está incluída no plano atual desta conta"), sem falar em assinatura, preço ou upgrade: é o que a regra da OpenAI permite. O link leva `intent` (`analise`, `pautas`, `inspiracoes`, `collabs`, `roteiro`) para o site abrir na parte certa. Cada limite batido vira um `UsageEvent` `mcp_plan_gate` (categoria `plugin`) com ferramenta, pedido e origem. É a medida de intenção do funil.

## Funil de assinatura pelo plugin — 26/09/2026

A decisão e as regras de cada loja estão em [[Funil do plugin]]. No código:

- Os links de limite levam a `/dashboard/plugin` (`src/app/lib/plugin/arrival.ts`), a página de chegada com narrativa, pautas e o que o Pro faz. Conta Pro vai direto ao perfil.
- `set_creator_north` pede as três primeiras pautas (`src/app/lib/plugin/firstIdeas.ts`, chave `plugin-first-ideas`, mesma fila e cota do app). A resposta diz isso em `firstIdeas`, sem mudar a lista de ferramentas.
- A oferta na conexão do Claude (`oauth/connectOffer.ts`, página `/mcp/conectado`) só existe com `MCP_CLAUDE_CONNECT_OFFER_ENABLED=1`. O código OAuth só é emitido no clique em "Continuar", e o pedido de consentimento fica aberto 30 minutos. Antes de ligar, testar numa conexão real do Claude.
- O login (`?assistant=`) e a tela de autorização mostram o nome do chat certo; antes diziam "ChatGPT" para quem conectava o Claude, inclusive para o revisor da Anthropic.

## Medição de uso do conector — 26/09/2026

Antes, o único registro de uso era o log da Vercel, que guarda cerca de um dia (em 26/09: 15 chamadas em 24 horas). Agora cada chamada de ferramenta ou atalho, no ChatGPT e no Claude, grava duas coisas sem atrasar a resposta (`usageTracking.ts`):

- **`mcp_usage_daily`**: um documento por pessoa, dia de São Paulo e chat, só com contagens: chamadas, erros, limites batidos, ferramentas, conversas e tempo estimado. Conversa nova é uma chamada depois de mais de 30 minutos de pausa. O tempo é a soma dos intervalos dentro da conversa, então subestima o real e serve para comparar semanas. Apagado em 12 meses.
- **`mcp_tool_call_logs`**: cada chamada com os campos que a ferramenta recebeu (tema, pedido de roteiro, ideia avaliada, período), cortados em 500 caracteres. Apagado em 90 dias. É o mais perto que chegamos da pergunta: a conversa fica no chat, aqui só chega o que o assistente mandou para a ferramenta.

A finalidade e os prazos estão na política de privacidade (26/09). Os dois registros saem junto com a conta em `deleteUserAccountAndAssociatedData`. A conta de sessão usa `$getField` e pipeline com upsert; o teste `usageTracking.integration.test.ts` roda num MongoDB em memória, porque mock não comprova isso.

Para ler: a ferramenta `get_connector_usage` no MCP administrativo (pergunte ao Claude "o que os creators mais pediram esta semana?"), `scripts/mcpUsageReport.ts` e o e-mail de toda segunda para quem estiver em `MCP_USAGE_REPORT_TO`. As rotinas estão no QStash desde 26/09, em UTC: `mcp-usage-weekly` segunda 11:00 (`scd_7vk473ZfTSGHX2tVp4FB5YfxUSdj`) e `plugin-weekly-email` segunda 13:00 (`scd_4ojnCN7ZKcKNqpW6bDSGg9acMPc6`). `MCP_USAGE_REPORT_TO` é arthur@data2content.ai. As 31 contas já conectadas em 26/09 receberam `pluginOrigin` por `scripts/backfillPluginOrigin.ts --apply`; o e-mail semanal do creator começou sem destinatário, porque quase todas são Pro. Contas internas (admin, e-mails da Data2Content, contas de revisão) ficam de fora por padrão. Depois do deploy, confirmar a expiração no banco real com `scripts/mcpUsageReport.ts --check-ttl` (ver [[Expiração declarada não garante limpeza no MongoDB]]).

