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
| Inteligências | `creatorIntelligence.ts`, `contentIntelligence.ts`, `scriptIntelligence.ts`, `collabIntelligence.ts`, `campaignRadar.ts` |
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
