# Plano: descoberta e avaliação de criadores para campanhas no MCP admin

08/10/2026. A Meta aprovou o Creator Marketplace (`instagram_creator_marketplace_discovery`). Objetivo:
no Claude, pelo conector D2C Admin, pedir "ache e avalie criadores para a campanha X" e receber uma
busca ampla com todos os filtros da Meta, uma ficha profunda de cada candidato, o histórico de publis
e a comparação dos finalistas — sempre dizendo de onde veio cada número, o período e o que ficou de fora.

**Implementado em 09/10/2026** (PRs #934, #935 e #936), com as recomendações das decisões pendentes: ordem padrão por contas engajadas, e-mail de contato na ficha, etapas 1 e 2 primeiro. Ver "Estado" no fim.

## O que muda para quem usa

Hoje o conector só faz uma busca com alguns filtros e devolve no máximo 20 criadores da primeira
página. Depois do plano, estas perguntas passam a funcionar:

- "Me traga 100 criadoras de maternidade no Brasil, de 10 a 100 mil seguidores, com público feminino
  de 25 a 34 anos, que postaram nos últimos 7 dias, ordenadas por contas engajadas."
- "Ache criadores parecidos com @amamaecegonha_."
- "Quem mais cresceu em fitness nos últimos 30 dias?" / "Quem tem mais experiência com anúncios em
  parceria em moda?"
- "Só quem tem e-mail de contato público e já fez anúncio pago."
- "Ficha completa de @X: alcance e visualizações da semana e do mês, público engajado por cidade,
  idade e gênero, retenção dos Reels, últimos 30 posts com visualizações e compartilhamentos, marcas
  com que trabalhou."
- "Destes 15 finalistas, quem fez publi de concorrente (Shein, Renner) nos últimos 60 dias?"
- "Entre os candidatos, quem está performando acima do próprio normal agora?"
- "Compare @a, @b e @c para esta campanha" e "quais deles já estão na D2C?"

Limites que o conector vai dizer em toda resposta:

- Só aparecem criadores que estão no Marketplace da Meta (contas aptas a parcerias), não o Instagram
  inteiro.
- Não existe busca "quem fez publi para a marca X". O histórico de publis sai da leitura das legendas
  dos candidatos, como no casting da Play9: publi sem marcação na legenda e stories ficam de fora.
- Cidade não é filtro de busca. Só dá para conferir a cidade do público engajado de cada candidato,
  depois da busca.
- Dados de parceria (marcas anteriores) a Meta não entrega para alguns criadores.
- Uso aprovado pela Meta: achar e avaliar criadores para campanhas. O plano se mantém nisso.

## Etapas

Cada etapa é um PR com testes, build e conferência na API real antes de publicar.

### Etapa 1 — Busca ampla

A ferramenta de busca passa a aceitar todos os filtros da Meta e a devolver muito mais gente.

- Filtros novos: parecidos com @ (até 5 referências), tipo de recomendação da Meta (mais relevantes
  para a D2C, melhor desempenho em anúncios, mais experiência com anúncios, parcerias com marcas
  parecidas, interesse em colaborar), crescimento de seguidores (10%, 30% ou 50% que mais cresceram),
  gênero e faixa etária do criador, idioma, conta verificada, tem e-mail público, tem portfólio, já
  fez anúncio pago, até 5 países e 5 categorias, faixa de contas engajadas com mínimo e máximo.
- Até 100 criadores por chamada e continuação pelas páginas seguintes (testado: 50 + 50 sem repetir).
- Ordenação feita por nós sobre o que voltou: contas engajadas, alcance, seguidores, interação nos
  Reels, alcance ÷ seguidores. A ordem da Meta continua disponível ("relevância da Meta").
- Cada criador vem marcado "já está na D2C" quando o @ bate com uma conta da base.
- Regras da Meta aplicadas antes de chamar: palavra-chave não combina com "parecidos com"; busca por
  @ não combina com filtros; tipo de recomendação ignora a palavra-chave (testado) e é lento (~26 s),
  então o conector avisa e não mistura os dois.

### Etapa 2 — Ficha completa do criador

Ferramenta nova, por @, com as partes buscadas em paralelo e cada uma podendo faltar sem derrubar o resto
(com dados reais a Meta recusa pedidos grandes e falha as parcerias de alguns criadores; ver PR #932).

- Perfil: bio, categoria, verificação, selos da Meta, e-mail e portfólio quando públicos.
- Números: seguidores; alcance, contas engajadas, visualizações e interações da semana, dos últimos
  14 dias e do mês (testado); interação e retenção dos Reels em 90 dias.
- Público engajado: principais cidades, idade, gênero, seguidor ou não (testado: cidades e idade).
- Últimos 30 posts com tipo, data, link e, quando a Meta der, visualizações, curtidas, comentários e
  compartilhamentos; conteúdos de marca; anúncios em parceria; marcas anteriores.
- Relação com a D2C: segue/é seguido pela conta da D2C e se já é usuário da D2C.

### Etapa 3 — Histórico de publis

Ferramenta nova: recebe até 15 @s, uma ou mais marcas (opcional) e um período, e devolve as publis
encontradas nas legendas dos últimos 50 posts de cada um, com data, marca, segmento e o trecho da
legenda que justifica. Reaproveita a leitura por @ que já existe (`get_public_instagram_creator`) e os
critérios de `output/play9-casting-publis/criterios.md` (marcação de publi, campanha clara sem
marcação, o que não conta). Também cruza com as marcas anteriores do Marketplace quando vierem.

### Etapa 4 — Avaliação dos finalistas

Ferramenta nova para uma lista curta (até 15 @s): junta ficha resumida, desempenho recente (média de
visualizações dos últimos posts comparada aos seguidores e ao alcance do mês, posts acima do normal
do próprio criador nos últimos 7 dias), publis de concorrentes informados e "já está na D2C", lado a
lado. É a resposta para "quem eu chamo para esta campanha".

### Etapa 5 — Instruções do conector

Atualizar as instruções do MCP admin e as descrições das ferramentas com o caminho de uso (buscar →
ficha → publis → finalistas) e as regras de honestidade: dizer a cobertura (Marketplace, primeira
página ou N páginas), o período de cada número, o que a Meta não entregou e que soma de alcance entre
criadores não é público único. Talvez um atalho de conversa "montar lista para campanha".

## Fora do plano

- Mandar mensagem ou proposta ao criador (exige outra permissão da Meta; o MCP admin não envia nada).
- Salvar listas dentro do Marketplace da Meta (não há API).
- Filtrar por público semelhante a clientes da marca (exige `ads_management`).
- Filtro por estado ou cidade na busca (só existe para os EUA), busca por imagem.
- Abrir a descoberta para marcas de fora conectarem a própria conta: precisa de `pages_manage_metadata`
  aprovada, que é outro pedido à Meta.
- Mostrar tudo isso também na tela `/creator-research`: primeiro o conector; a tela fica para depois.

## Decisões pendentes (Arthur)

1. Ordem padrão da lista: contas engajadas (recomendo) ou relevância da Meta?
2. Devolver o e-mail de contato público na ficha? Recomendo sim, porque serve para a abordagem e é
   o contato que o próprio criador publicou.
3. Ordem das etapas: recomendo 1 e 2 juntas no primeiro PR, depois 3, depois 4 e 5.

## Detalhe técnico

**Onde fica.** Serviço em `src/app/lib/instagram/marketplace.ts` (dividir em `marketplaceSearch.ts`,
`marketplaceCreator.ts` e `marketplacePublis.ts` se crescer); ferramentas em
`src/app/lib/mcp/adminServer.ts`, com escopos já existentes para não pedir reconexão:
`search_external_creators` (v3) em `admin:creators:search`; `get_marketplace_creator` em
`admin:creator:read` + `admin:audience:read` + `admin:metrics:read`; `find_creator_publis` em
`admin:content:read`; `evaluate_campaign_shortlist` em `admin:creators:compare` + `admin:metrics:read`.
Todas somente leitura, auditadas pelo `registerTool` atual.

**Chamadas à Meta (testado em 08/10).**
- `GET /{ig-user-id}/creator_marketplace_creators`, `limit` até 100 (50 com `insights` levou ~13 s;
  sem `insights`, ~2 s por página). Paginação por `paging.cursors.after`.
- Filtros de lista exigem JSON array, inclusive `creator_gender`, `major_audience_gender` e
  `major_audience_age_bucket` (string dá 400).
- Ficha: perfil+`insights` (~4 s), parcerias (`has_brand_partnership_experience`,
  `past_brand_partnership_partners`, 5 a 18 s, falha para alguns), `recent_media.limit(30)` (~2 s sem
  métricas; com `insights.metrics(views,likes,comments,shares)` ~7 s e falha para ~1 em 3), quebras de
  `creator_engaged_accounts` por `top_cities`, `age`, `gender`, `follow_type` (resposta em
  `total_value.breakdowns[0].results`), janelas `this_week`, `last_14_days`, `this_month`.
- `branded_content_media` voltou sem `tagged_brand` nos testes; não usar como fonte de marca.

**Tempo.** A rota do MCP admin tem `maxDuration = 60`. Busca com várias páginas e avaliação em lote
precisam de concorrência limitada (5 por vez), prazo por chamada e resposta parcial declarada quando o
tempo acabar. Limite da Meta: 5.000 chamadas por hora por usuário; manter o `throttle` por ação.

**Cache.** Respostas da Meta em cache curto no Upstash (ex.: 6 h por parâmetros), sem gravar dados de
criadores externos no MongoDB. Upstash já consta como operador no tratamento de dados enviado à Meta.

**"Já está na D2C".** Casar `username` do Marketplace com `User.username` (minúsculas, sem @); devolver
só um sinal e o `creator:<id>` para aprofundar com as ferramentas da base, sem dados pessoais.

**Testes.** Por etapa: esquema de filtros (combinações proibidas, arrays), paginação, falha parcial da
ficha, detecção de publi com legendas de exemplo do casting Play9, limite de tempo com resposta parcial,
escopos no `adminServer.test.ts`. `npm run build` antes de publicar; conferência na API real com a
credencial da Página "Arthur Marbá - D2C".

## Estado — 09/10/2026

No ar no conector D2C Admin: `search_external_creators` (busca ampla), `get_marketplace_creator` (ficha),
`find_creator_publis` (publis e concorrentes) e `evaluate_campaign_shortlist` (finalistas), com as
instruções do conector atualizadas.

Diferenças em relação ao plano, descobertas na API real:

- Páginas de **25**, não 50: com filtros e métricas, 50 por página volta 500 ("reduce the amount of
  data"). Página recusada é tentada uma vez com a metade. 60 criadores levam ~30 s.
- Cidade, idade e gênero do público engajado vêm em **porcentagem** (`dimension_value`, `percentage`);
  seguidor x não seguidor vem em contagem.
- `search_external_creators` era publicada **sem campos** desde #916: esquema com `.refine()` some na
  lista de ferramentas. Corrigido em #935, com teste que impede qualquer ferramenta do MCP admin de sair
  sem campos.
- A ficha e a avaliação não usam cache ainda; cada chamada vai à Meta.

Medido com dados reais: ficha em ~7 s; publis de 3 @s em ~11 s; 5 finalistas em ~9 s.
