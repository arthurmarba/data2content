# Plano De Otimizacao Da Taxonomia De Categorias V2

## Complemento
Existe uma proposta de refinamento semantico posterior em [plano-taxonomia-categorias-v2-5.md](/Users/arthurmarba/d2c-frontend/docs/plano-taxonomia-categorias-v2-5.md#L1), focada em:
- `stance`
- `proofStyle`
- `commercialMode`
- `entityTargets`
- `classificationMeta`

## Objetivo
Levar a classificacao de conteudo de um modelo "funciona tecnicamente" para um modelo "gera leitura estrategica melhor".

O problema estrutural de aliases, ingles/portugues e pai/filho duplicado ja foi tratado na fase canonica. O que resta agora e semantico:

- `proposal` mistura intencao, formato narrativo, sinal comercial e CTA.
- `tone` mistura tom emocional com funcao editorial e estado comercial.
- `context` e `references` ainda carregam categorias-pai que nao deveriam competir com as filhas.
- `general` funciona como fallback fraco e piora a analise quando aparece como categoria "real".

## Principios Da V2
- Salvar apenas IDs canonicos.
- `context` e `references` devem ser `leaf-only`.
- CTA, trend, publi e giveaway nao podem dominar a classificacao principal.
- A classificacao precisa distinguir:
  - o que o post quer fazer
  - como ele faz isso
  - quais sinais acessorios ele carrega
- Valores genericos ou ambiguos devem ir para fallback interno, nao para filtros nobres da UI.

## Modelo Alvo

### Campos Mantidos
- `format`
- `context`
- `references`

### Campos Reestruturados
- `proposal` atual deve ser substituido por:
  - `contentIntent`
  - `narrativeForm`
  - `contentSignals`

- `tone` deve ser reescopado para tom emocional/atitudinal.

### Definicao Dos Novos Campos

#### `contentIntent`
Objetivo principal do conteudo.

Valores recomendados para a primeira versao:
- `announce`
- `teach`
- `inform`
- `entertain`
- `inspire`
- `build_authority`
- `convert`
- `connect`

#### `narrativeForm`
Estrutura pela qual o conteudo executa a ideia.

Valores recomendados para a primeira versao:
- `behind_the_scenes`
- `clip`
- `comparison`
- `day_in_the_life`
- `guest_appearance`
- `news_update`
- `q_and_a`
- `reaction`
- `review`
- `sketch_scene`
- `tutorial`
- `unboxing`

#### `contentSignals`
Sinais acessorios, comerciais ou de distribuicao.

Valores recomendados para a primeira versao:
- `comment_cta`
- `save_cta`
- `share_cta`
- `link_in_bio_cta`
- `dm_cta`
- `sponsored`
- `giveaway`
- `trend_participation`
- `collab`
- `promo_offer`

#### `tone`
Deve refletir tom, nao funcao editorial.

Tom V2 imediato:
- `humorous`
- `inspirational`
- `critical`
- `neutral`

Mapeamentos de saida imediata:
- `educational` sai de `tone`
- `promotional` sai de `tone`

## Matriz De Decisao Por Dimensao

### 1. Format

| Categoria atual | Acao | Destino | Observacao |
| --- | --- | --- | --- |
| `reel` | Manter | `format.reel` | Categoria correta e util. |
| `photo` | Manter | `format.photo` | Categoria correta e util. |
| `carousel` | Manter | `format.carousel` | Categoria correta e util. |
| `long_video` | Manter | `format.long_video` | Categoria correta e util. |

Observacao:
- Historias, lives e cortes curtos so entram aqui se o produto realmente precisar diferenciar esses formatos no funil.

### 2. Proposal Atual

| Categoria atual | Acao recomendada | Campo destino | Valor destino | Observacao estrategica |
| --- | --- | --- | --- | --- |
| `announcement` | Mover | `contentIntent` | `announce` | E intencao principal, nao proposta misturada com CTA. |
| `behind_the_scenes` | Mover | `narrativeForm` | `behind_the_scenes` | E formato narrativo. |
| `call_to_action` | Remover da categoria principal | `contentSignals` | `comment_cta` / `save_cta` / `share_cta` / `link_in_bio_cta` / `dm_cta` | Nao deve definir o angulo editorial do post. |
| `clip` | Mover | `narrativeForm` | `clip` | E estrutura de entrega. |
| `comparison` | Mover | `narrativeForm` | `comparison` | E modo de organizar a informacao. |
| `giveaway` | Remover da categoria principal | `contentSignals` | `giveaway` | E ativacao/promocao, nao intencao editorial rica. |
| `humor_scene` | Dividir | `contentIntent` + `narrativeForm` | `entertain` + `sketch_scene` | Hoje mistura intencao e forma. |
| `lifestyle` | Mover | `narrativeForm` | `day_in_the_life` | Funciona melhor como forma de narrativa pessoal. |
| `message_motivational` | Dividir | `contentIntent` + `tone` | `inspire` + `inspirational` | Hoje esta duplicando intencao e tom. |
| `news` | Mover | `contentIntent` | `inform` | Para noticia propria de marca, pode coexistir com `announce`. |
| `participation` | Dividir | `contentSignals` e opcionalmente `narrativeForm` | `collab` e, quando central, `guest_appearance` | "Participacao" sozinha e vaga demais. |
| `positioning_authority` | Mover | `contentIntent` | `build_authority` | Categoria forte, mas esta no campo errado. |
| `publi_divulgation` | Remover da categoria principal | `contentSignals` | `sponsored` / `promo_offer` | Publicidade e estado comercial, nao proposta editorial. |
| `q&a` | Mover | `narrativeForm` | `q_and_a` | E estrutura de resposta. |
| `react` | Mover | `narrativeForm` | `reaction` | E forma narrativa. |
| `review` | Mover | `narrativeForm` | `review` | Pode coexistir com `contentIntent.convert` quando houver forte viés comercial. |
| `tips` | Dividir | `contentIntent` + `narrativeForm` | `teach` + `tutorial` | "Dicas" hoje condensa intencao e forma. |
| `trend` | Remover da categoria principal | `contentSignals` | `trend_participation` | Viralidade nao deve virar categoria principal do conteudo. |
| `unboxing` | Mover | `narrativeForm` | `unboxing` | E estrutura clara de conteudo. |

Decisao de rollout para `proposal`:
- Fase 1: manter compatibilidade de leitura do campo atual.
- Fase 2: worker passa a preencher `contentIntent`, `narrativeForm` e `contentSignals`.
- Fase 3: `proposal` vira campo legado apenas para leitura/transicao.

### 3. Tone

| Categoria atual | Acao recomendada | Destino | Observacao |
| --- | --- | --- | --- |
| `humorous` | Manter | `tone.humorous` | Categoria valida como tom. |
| `inspirational` | Manter | `tone.inspirational` | Categoria valida como tom. |
| `critical` | Manter | `tone.critical` | Categoria valida como tom. |
| `neutral` | Manter com restricao | `tone.neutral` | Deve funcionar mais como fallback do que como destaque nobre. |
| `educational` | Remover de `tone` | `contentIntent.teach` ou `contentIntent.inform` | Funcao editorial, nao tom. |
| `promotional` | Remover de `tone` | `contentIntent.convert` e/ou `contentSignals.sponsored/promo_offer` | Estado comercial, nao tom emocional. |

### 4. Context

#### Categorias-pai

| Categoria atual | Acao recomendada | Destino | Observacao |
| --- | --- | --- | --- |
| `lifestyle_and_wellbeing` | Descontinuar como valor armazenado | Grupo de navegacao | Nao deve competir com as filhas. |
| `personal_and_professional` | Descontinuar como valor armazenado | Grupo de navegacao | Nao deve competir com as filhas. |
| `hobbies_and_interests` | Descontinuar como valor armazenado | Grupo de navegacao | Nao deve competir com as filhas. |
| `science_and_knowledge` | Descontinuar como valor armazenado | Grupo de navegacao | Nao deve competir com as filhas. |
| `social_and_events` | Descontinuar como valor armazenado | Grupo de navegacao | Nao deve competir com as filhas. |
| `general` | Retirar da UI nobre | Fallback interno / quarentena | Categoria fraca; so deve existir como excecao controlada. |

#### Categorias-folha

| Categoria atual | Acao recomendada | Destino | Observacao |
| --- | --- | --- | --- |
| `fashion_style` | Manter | `context.fashion_style` | Categoria forte e clara. |
| `beauty_personal_care` | Manter | `context.beauty_personal_care` | Categoria forte e clara. |
| `fitness_sports` | Manter | `context.fitness_sports` | Categoria forte; revisar split futuro entre fitness e esporte se volume justificar. |
| `food_culinary` | Manter | `context.food_culinary` | Categoria forte e clara. |
| `health_wellness` | Manter | `context.health_wellness` | Categoria forte e clara. |
| `relationships_family` | Manter | `context.relationships_family` | Alias legado deve continuar compativel, mas so esse ID deve existir. |
| `parenting` | Manter | `context.parenting` | Categoria clara. |
| `career_work` | Manter | `context.career_work` | Categoria clara. |
| `finance` | Manter | `context.finance` | Categoria clara. |
| `personal_development` | Manter | `context.personal_development` | Categoria clara; monitorar sobreposicao com motivacional. |
| `education` | Manter | `context.education` | Categoria clara. |
| `travel_tourism` | Manter | `context.travel_tourism` | Categoria clara. |
| `home_decor_diy` | Manter | `context.home_decor_diy` | Categoria clara. |
| `technology_digital` | Manter com monitoramento | `context.technology_digital` | Categoria ampla; split futuro possivel entre tech e creator digital. |
| `art_culture` | Manter com monitoramento | `context.art_culture` | Categoria ampla, mas ainda util. |
| `gaming` | Manter | `context.gaming` | Categoria clara. |
| `automotive` | Manter | `context.automotive` | Categoria clara. |
| `pets` | Manter | `context.pets` | Categoria clara. |
| `nature_animals` | Manter | `context.nature_animals` | Categoria clara. |
| `science_communication` | Manter | `context.science_communication` | Categoria clara. |
| `history` | Manter | `context.history` | Categoria clara. |
| `curiosities` | Manter | `context.curiosities` | Categoria clara. |
| `events_celebrations` | Manter | `context.events_celebrations` | Categoria clara. |
| `social_causes_religion` | Manter com revisao futura | `context.social_causes_religion` | Candidata a split futuro entre causa social e religiao/fe. |

### 5. References

#### Categorias-pai

| Categoria atual | Acao recomendada | Destino | Observacao |
| --- | --- | --- | --- |
| `pop_culture` | Descontinuar como valor armazenado | Grupo de navegacao | Nao deve competir com referencias especificas. |
| `people_and_groups` | Descontinuar como valor armazenado | Grupo de navegacao | Nao deve competir com referencias especificas. |
| `geography` | Descontinuar como valor armazenado | Grupo de navegacao | Nao deve competir com `city` e `country`. |

#### Categorias-folha

| Categoria atual | Acao recomendada | Destino | Observacao |
| --- | --- | --- | --- |
| `pop_culture_movies_series` | Manter | `references.pop_culture_movies_series` | Categoria clara. |
| `pop_culture_books` | Manter | `references.pop_culture_books` | Categoria clara. |
| `pop_culture_games` | Manter | `references.pop_culture_games` | Categoria clara. |
| `pop_culture_music` | Manter | `references.pop_culture_music` | Categoria clara. |
| `pop_culture_internet` | Manter | `references.pop_culture_internet` | Categoria clara. |
| `regional_stereotypes` | Manter | `references.regional_stereotypes` | Categoria util quando a referencia e um sotaque/arquetipo regional. |
| `professions` | Manter | `references.professions` | Categoria util quando a profissao e referencia, nao tema central. |
| `city` | Manter | `references.city` | Deve ganhar de `geography` sempre que coexistir. |
| `country` | Manter | `references.country` | Deve ganhar de `geography` sempre que coexistir. |

## Regras De Classificacao Mais Inteligentes

### Ordem de decisao do classificador
1. Determinar `contentIntent`.
2. Determinar `narrativeForm`.
3. Determinar `context` folha.
4. Determinar `references` folha.
5. Determinar `tone` apenas se houver tom claro.
6. Extrair `contentSignals`.

### Regras que devem deixar de gerar erro semantico
- "Comenta aqui" nao pode gerar sozinho uma categoria principal.
- "Link na bio" nao pode virar `proposal`.
- Hashtag de trend nao pode empurrar o post para `proposal.trend` se o conteudo real e review, humor ou tutorial.
- Conteudo patrocinado deve carregar sinal comercial sem apagar a essencia editorial.

### Heuristicas deterministicas recomendadas
- Extrair `comment_cta`, `save_cta`, `share_cta`, `link_in_bio_cta` e `dm_cta` por regra textual.
- Extrair `sponsored` por hashtags e marcacoes tipicas (`#ad`, `publi`, `parceria paga`).
- Extrair `trend_participation` por sinais explicitos de meme/challenge/trend.
- Deixar a IA focada no que exige interpretacao semantica real.

## Sequencia De Implementacao

### Fase 1. Congelar a taxonomia V2
Arquivos principais:
- [classification.ts](/Users/arthurmarba/d2c-frontend/src/app/lib/classification.ts)
- [Metric.ts](/Users/arthurmarba/d2c-frontend/src/app/models/Metric.ts)

Entregas:
- definir enums/ids alvo de `contentIntent`, `narrativeForm` e `contentSignals`
- marcar categorias-pai e `general` como nao filtraveis
- preparar compatibilidade de leitura dos valores legados

### Fase 2. Reescrever a escrita da classificacao
Arquivos principais:
- [route.ts](/Users/arthurmarba/d2c-frontend/src/app/api/worker/classify-content/route.ts)
- [reclassifyAll.ts](/Users/arthurmarba/d2c-frontend/scripts/reclassifyAll.ts)

Entregas:
- prompt e schema do worker em V2
- resposta com `intent`, `form`, `signals`, `context`, `references`, `tone`
- extracao deterministica dos sinais
- opcional: `confidence` e `evidence`

### Fase 3. Migracao do legado
Arquivos principais:
- [classificationLegacy.ts](/Users/arthurmarba/d2c-frontend/src/app/lib/classificationLegacy.ts)
- scripts de auditoria e migracao em `/scripts`

Entregas:
- migracao deterministica de `proposal` e `tone`
- quarentena para ambiguos
- reclassificacao assistida apenas do resíduo

### Fase 4. Adocao nas telas e analytics
Areas impactadas:
- Discover
- Planner
- Mídia Kit
- rankings e highlights
- relatorios estrategicos

Entregas:
- filtros novos por `contentIntent` e `narrativeForm`
- `contentSignals` exposto separadamente, nao misturado com categoria principal
- graficos e insights com leitura mais estrategica

### Fase 5. Monitoramento
Entregas:
- auditoria recorrente para categorias fora da taxonomia
- monitor de categorias genericas (`general`, `neutral`, fallbacks)
- relatorio de conflito entre campos

## Criterios De Aceite
- `call_to_action`, `trend`, `giveaway`, `publi_divulgation` e `participation` deixam de aparecer como categoria principal.
- `educational` e `promotional` deixam de existir em `tone`.
- `context` e `references` nao armazenam mais categorias-pai.
- `general` sai dos filtros nobres da interface.
- O classificador novo consegue explicar a diferenca entre:
  - objetivo do post
  - formato narrativo
  - sinal comercial/CTA

## Primeira Entrega Recomendada
Executar primeiro um MVP de alto impacto:

1. Criar `contentSignals`.
2. Tirar `call_to_action`, `trend`, `giveaway`, `publi_divulgation` e `participation` de `proposal`.
3. Tirar `educational` e `promotional` de `tone`.
4. Tornar `context` e `references` estritamente `leaf-only`.

Isso ja melhora muito a estrategia sem exigir a V2 completa de uma vez.
