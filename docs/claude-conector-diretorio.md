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
