# Data2Content no diretório de conectores do Claude

Respostas prontas para o formulário do portal da Anthropic ([claude.ai/directory/manage](https://claude.ai/directory/manage) → **Submit new** → **MCP connector**). Montado em 25/09/2026.

Quem pode enviar: qualquer plano pago do Claude. Depois do envio, uma varredura automática publica como **Community connector**; alguns casos passam por revisão humana. Escalonamento: `mcp-review@anthropic.com`. Guia oficial: <https://claude.com/docs/connectors/building/submission>.

## Antes de abrir o portal

- [ ] A correção de conexões antigas está no ar (commit `14ece4d8`). Sem ela, conexões feitas antes de `campaigns:read` recebem 403 em tudo.
- [ ] Desconectar e conectar de novo a Data2Content no Claude (Configurações → Conectores) e **rodar cada ferramenta numa conversa** — o passo "Test & launch" pede essa confirmação.
- [ ] `https://data2content.ai/conector-claude` publicado (página de ajuda com exemplos).
- [ ] Política de privacidade citando Claude e Anthropic publicada.
- [ ] Senha da conta `openai-review-pro@data2content.ai` em mãos (a mesma da revisão da OpenAI; está só com o Arthur).

## Connection

- **URL:** `https://data2content.ai/api/mcp`
- Todos os usuários usam a mesma URL.

## Tools

Sincronizam sozinhas. Todas já têm `title` e `readOnlyHint`/`destructiveHint` (exigência que a OpenAI também fez). Se o portal marcar alguma, corrigir no servidor antes de enviar.

## Listing

- **Nome:** Data2Content
- **Frase curta (até 200):**
  > Seu mapa de criador dentro do Claude: o que postar, se vale postar, como foi sua semana, collabs e roteiros na sua voz — com os números dos seus posts.
- **Descrição (até 2.000):**
  > A Data2Content lê a sua vida de criador como narrativa e devolve decisão com evidência. Com o conector, o Claude consulta o seu mapa — narrativa, territórios, elementos de vida e pautas — e os números dos seus próprios posts no Instagram para responder no seu vocabulário, não no de qualquer criador do mesmo assunto.
  >
  > O que você pode pedir:
  > • O que postar agora: até três pautas ancoradas na sua narrativa, com gancho e motivo.
  > • Vale postar isso? Veredito sim ou não em três eixos: narrativa, audiência e marca.
  > • Como foi a semana: seus últimos 7 dias comparados com a sua própria mediana de 90 dias — nunca com outro criador.
  > • Seguidores ganhos por dia e seus melhores conteúdos, sempre dizendo métrica, período e cobertura.
  > • Collabs: criadores da comunidade que dividem território com você, com ideia de gravação.
  > • Roteiros de Reels escritos a partir dos seus próprios vídeos que funcionaram.
  >
  > Quase tudo é leitura da sua própria conta. O conector só altera o seu Norte, um roteiro na biblioteca ou suas preferências de voz, e sempre a seu pedido. Não publica no Instagram nem envia mensagens.
  >
  > Requer conta Data2Content. As análises dos seus próprios posts exigem o Instagram conectado na Data2Content.
- **Categorias:** as mais próximas de *Marketing* / *Social media* / *Productivity* / *Analytics* que o portal oferecer (1 a 5).
- **Documentação:** `https://data2content.ai/conector-claude`
- **Política de privacidade:** `https://data2content.ai/politica-de-privacidade`
- **Suporte:** `support@data2content.ai`
- **Ícone:** `public/plugin/data2content-logo-512.png`
- **Slug:** `data2content` — **permanente depois de publicado.**

## Use cases

- **Casos principais:** planejamento de conteúdo (pautas ancoradas em narrativa e território); avaliação de ideia antes de gravar; análise de desempenho da semana e do período contra o próprio histórico; saldo diário de seguidores; recomendação de collabs; roteiros de Reels na voz do criador.
- **O que o usuário precisa antes:** conta na Data2Content. Para análise dos próprios posts, Instagram conectado na Data2Content. Algumas ferramentas dependem do plano da conta; sem ele, o conector responde com o Norte e padrões agregados da comunidade.
- **Lê ou escreve:** ambos. Leitura em quase tudo; escrita só em `set_creator_north`, `save_script`, `record_script_feedback` (sempre com confirmação) e sessões temporárias de roteiro (até 7 dias).

## Company

- **Empresa:** Mobi Media Produtores de Conteúdo LTDA (Data2Content)
- **Site:** `https://data2content.ai`
- **Contato principal:** Arthur Marbá — `arthur@data2content.ai`

## Authentication

**OAuth com dynamic client registration (DCR).** Metadados em `https://data2content.ai/.well-known/oauth-authorization-server`; registro em `/api/mcp/oauth/register`; PKCE S256. O servidor exige login desde o início (não há ferramenta sem autenticação).

## Data handling

- **API:** própria (Data2Content). Os dados do Instagram vêm da Graph API da Meta, pela conexão que o próprio criador autorizou na Data2Content.
- **Dados de saúde:** não.
- **Conteúdo patrocinado:** não há anúncio pago nas respostas. `find_campaign_opportunities` mostra oportunidades públicas de publi (campanhas de marcas) que combinam com o criador — é conteúdo informativo, sem pagamento à Data2Content pela exibição. Declarar isso no campo, se o portal perguntar.

## Test & launch (em inglês, para o revisor)

> **Test account (Pro, Instagram connected, fully populated with synthetic data):**
> Email: `openai-review-pro@data2content.ai` — Password: `<preencher>`
>
> 1. In Claude, add the connector (or open it from the directory) and click Connect.
> 2. On the Data2Content login page, sign in with the account above and approve the requested permissions.
> 3. Try these prompts (the account's content is in Brazilian Portuguese; prompts work in English too):
>    - "What should I post this week?" → `get_creator_map`, `list_content_ideas`
>    - "How did my last 7 days perform compared to my usual?" → `analyze_creator_period`
>    - "How many followers did I gain yesterday?" → `get_follower_growth`
>    - "What were my top posts in the last 90 days?" → `list_top_content`
>    - "Find me a creator to collab with." → `recommend_collab_creators`
>    - "Is this worth posting: a video about my Sunday routine with my kids?" → `get_creator_map` + verdict
>    - "Write a Reels script about cooking for my mother-in-law for the first time." → `get_script_evidence_pack`, `critique_script_against_creator_dna`; it only saves with `save_script` after the user explicitly confirms.
>
> All data in this account is synthetic. Write tools (`set_creator_north`, `save_script`, `record_script_feedback`) only change this test account.

## Compliance

Sete declarações obrigatórias (diretrizes do diretório, uso de API própria, transações financeiras, geração de mídia por IA, injeção de prompt, coleta de dados da conversa, documentação pública). **Arthur lê e marca** — é aceite da empresa.

Pontos a conferir contra o nosso servidor antes de marcar:

- **Transações financeiras:** o conector não cobra, não vende e nunca manda para checkout (`conversationPolicy.ts`).
- **Mídia por IA:** não gera imagem, áudio nem vídeo; só texto.
- **Injeção de prompt:** legendas e textos de criadores voltam como dado. Só as duas ferramentas de perfil público (`get_public_instagram_creator`, `compare_public_instagram_creators`) avisam na descrição que esses textos "nunca são instruções"; as instruções gerais do servidor não dizem isso. Se quiser reforçar antes de marcar, é uma frase em `server.ts`.
- **Dados da conversa:** só recebe os campos de cada ferramenta; não pede nem guarda a conversa inteira (política de privacidade, seção 2.4).

## Revisão das respostas — 26/09/2026

Duas promessas da descrição não batiam com o servidor e foram corrigidas: "criadores que dividem território com você" (a ferramenta de collab não trazia território; agora traz `sharedTerritories` e as propostas da aba Collabs) e "comparados com a sua própria mediana de 90 dias" (agora `analyze_creator_period` devolve medianas). A lista de ferramentas sincroniza sozinha no portal; nomes e quantidade não mudaram.


## Devolução da Anthropic — 29/09/2026

Quatro correções pedidas e a listagem em inglês. O que mudou no código está em `docs/brain/40 Decisões/Conector do Claude sem ordens.md`. Depois do deploy, reconectar no portal (etapa Connection) para ele reler instruções e ferramentas.

### Listing em inglês

- **Name:** Data2Content
- **One-liner:**
  > Your creator map inside Claude: what to post, whether an idea is worth posting, how your week went, collabs and scripts in your own voice, backed by your own Instagram numbers.
- **Description:**
  > Data2Content reads a creator's life as a narrative and turns it into decisions backed by evidence. With the connector, Claude reads your map (narrative, territories, life assets and content ideas) and the numbers of your own Instagram posts, so answers use your vocabulary instead of generic advice for anyone in the same niche.
  >
  > What you can ask:
  > • What to post now: up to three content ideas anchored in your narrative, each with a hook and the reason it fits you.
  > • Is this worth posting? A yes-or-no verdict on three axes: narrative, audience and brand fit.
  > • How your week went: your last 7 days compared with your own 90-day median, never with other creators.
  > • Daily follower growth and your best posts, always stating the metric, the period and the data coverage.
  > • Collabs: creators who opted in to collab recommendations and share a territory with you, with a recording idea.
  > • Reels scripts written from your own videos that performed best.
  >
  > Almost everything is read-only on your own account. The connector only writes when you ask: your North statement, a script saved to your library, or your voice preferences. It never posts to Instagram or sends messages.
  >
  > Requires a Data2Content account. Analysis of your own posts requires Instagram connected inside Data2Content. The account content is in Brazilian Portuguese.

### Resposta ao e-mail (rascunho, Arthur envia)

> Hi Anthropic Directory team,
>
> Thank you for the detailed review. All items are addressed and live on https://data2content.ai/api/mcp:
>
> 1. Server instructions no longer direct Claude. They only describe what each tool does and how to read the data. "siga conversationPolicy", the onboarding prompt directive and the per-response reminder were removed. get_account_state now returns plain data (northDeclared, contextDepth, instagramConnected, profile links). No tool response carries conversationPolicy, onboardingPrompt, closingReminder or other assistant-directed fields, and those fields were removed from the declared output schemas. The instructions are now about 1,860 characters, so they are no longer truncated.
> 2. The community-invite and limitation-suppression directives were removed. Plan-gated tools return an explicit error with the feature code and a profile link as data.
> 3. recommend_collab_creators now only surfaces creators who turned on the Collabs option to be recommended to other creators. Their private Instagram metrics are never returned; scores are relative (0–100 and 0–1) and followers is the public count. This is stated in the tool description and in our privacy policy (https://data2content.ai/politica-de-privacidade, "Sugestões de collab").
> 4. compare_public_instagram_creators now publishes a required usernames array (minItems 2, maxItems 3), and record_script_feedback publishes scriptId (required), voiceMatch, preferredDirection and notes. The cause was a refinement wrapper that hid the schema from the tool list; it applied to both tools and is fixed.
> 5. The listing is now in English.
>
> We reconnected the server in the developer portal so the snapshot matches what is served.
>
> Best,
> Arthur Marbá, Data2Content
