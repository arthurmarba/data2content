# Plano De Otimizacao Da Taxonomia De Categorias V2.5

## Objetivo
Tornar a classificacao mais inteligente e especifica sem inflar um catalogo unico e confuso.

Plano tecnico correspondente:
- [plano-implementacao-taxonomia-v2-5.md](/Users/arthurmarba/d2c-frontend/docs/plano-implementacao-taxonomia-v2-5.md#L1)

A V2 ja separa melhor `contentIntent`, `narrativeForm` e `contentSignals`. A V2.5 vai um passo alem:
- separar tom emocional de postura/opiniao
- separar sinal comercial de CTA/distribuicao
- capturar o tipo de prova usado no conteudo
- extrair entidades especificas quando houver
- registrar confianca e evidencia da classificacao

## Principio Central
Mais inteligencia nao deve significar "mais categorias planas no mesmo lugar".

A regra correta e:
- poucas dimensoes principais, estaveis e claras
- dimensoes complementares ortogonais
- extracao estruturada para entidades especificas
- metadados de confianca para evitar falso rigor

## Modelo Alvo V2.5

### Camada 1. Dimensoes Centrais

#### `format`
Mantida como esta:
- `reel`
- `photo`
- `carousel`
- `long_video`

#### `contentIntent`
Mantida com foco no objetivo principal do conteudo:
- `announce`
- `teach`
- `inform`
- `entertain`
- `inspire`
- `build_authority`
- `convert`
- `connect`

Decisao:
- nao recomendo expandir demais `contentIntent` agora
- a especificidade extra deve vir das dimensoes complementares abaixo

#### `narrativeForm`
Mantida como estrutura de entrega:
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

Extensoes recomendadas para V2.5:
- `storytime`
- `listicle`
- `myth_busting`
- `demo_walkthrough`

Motivo:
- esses quatro formatos aparecem com frequencia real e hoje ficam espremidos em `tutorial`, `review` ou `inform`

#### `context`
Continua `leaf-only`.

Recomendacao:
- manter a lista atual como base
- so abrir novas folhas em contextos com volume e valor analitico claros

Splits prioritarios para futura revisao:
- `health_wellness` -> `mental_wellbeing`, `physical_health`
- `technology_digital` -> `consumer_tech`, `creator_tools`, `digital_marketing`, `social_platforms`
- `art_culture` -> `film_tv`, `books_literature`, `music_scene`
- `social_causes_religion` -> `social_causes`, `faith_spirituality`
- `fitness_sports` -> `fitness_training`, `sports_competition`

#### `references`
Continua `leaf-only`.

Mantem a taxonomia atual, mas deve passar a conviver com `entityTargets`.

#### `tone`
Deve virar estritamente tom emocional ou atitude de voz.

Categorias recomendadas:
- `humorous`
- `warm`
- `inspirational`
- `neutral`
- `urgent`
- `provocative`

Mudancas-chave:
- `critical` sai de `tone`
- `educational` nao pertence a `tone`
- `promotional` nao pertence a `tone`

#### `contentSignals`
Deve ficar mais enxuta e focada em interacao e distribuicao.

Categorias recomendadas:
- `comment_cta`
- `save_cta`
- `share_cta`
- `link_in_bio_cta`
- `dm_cta`
- `giveaway`
- `trend_participation`
- `collab`

Mudancas-chave:
- `sponsored` sai daqui e vai para `commercialMode`
- `promo_offer` sai daqui e vai para `commercialMode`

### Camada 2. Dimensoes Complementares Novas

#### `stance`
Postura do criador diante do tema, produto ou opiniao.

Categorias:
- `endorsing`
- `questioning`
- `critical`
- `comparative`
- `testimonial`

Exemplos de uso:
- um review positivo: `stance = endorsing`
- uma analise de prós e contras: `stance = comparative`
- um post de desabafo contra uma pratica: `stance = critical`
- um relato de experiencia: `stance = testimonial`

Por que isso importa:
- hoje `critical` fica misturado em `tone`
- um post pode ter tom neutro e postura critica ao mesmo tempo

#### `proofStyle`
Qual e o tipo de prova ou sustentacao que o conteudo usa.

Categorias:
- `demonstration`
- `before_after`
- `case_study`
- `social_proof`
- `personal_story`
- `opinion`
- `myth_busting`
- `list_based`

Exemplos de uso:
- tutorial mostrando tela: `demonstration`
- transformacao fisica ou visual: `before_after`
- resultado de cliente: `case_study`
- print de feedback ou depoimento: `social_proof`
- relato pessoal: `personal_story`
- opiniao pura: `opinion`

Por que isso importa:
- hoje dois posts podem ter o mesmo `contentIntent` e `narrativeForm`, mas performar diferente por causa do tipo de prova

#### `commercialMode`
Mecanica comercial principal quando houver.

Categorias:
- `paid_partnership`
- `affiliate`
- `discount_offer`
- `lead_capture`
- `dm_conversion`
- `product_launch`

Exemplos de uso:
- #publi com marca: `paid_partnership`
- link com comissao: `affiliate`
- cupom ou desconto: `discount_offer`
- promessa de material mediante cadastro: `lead_capture`
- "me chama na DM": `dm_conversion`
- abertura de carrinho ou lancamento: `product_launch`

Por que isso importa:
- hoje `sponsored` e `promo_offer` ainda ficam misturados com CTA
- comercializacao precisa ser uma leitura propria

#### `entityTargets`
Entidades especificas citadas ou alvo do conteudo.

Nao recomendo um enum fechado de valores. Recomendo estrutura.

Modelo sugerido:
```ts
type EntityTarget = {
  type:
    | "brand"
    | "product"
    | "service"
    | "person"
    | "city"
    | "country"
    | "franchise"
    | "platform";
  label: string;
  canonicalId?: string | null;
};
```

Exemplos:
- `[{ type: "brand", label: "Nike" }]`
- `[{ type: "city", label: "Sao Paulo" }]`
- `[{ type: "platform", label: "Instagram" }]`

Por que isso importa:
- `references.city` diz o tipo de referencia
- `entityTargets` diz qual cidade, marca, produto ou franquia apareceu

### Camada 3. Metadados De Classificacao

#### `classificationMeta`
Modelo sugerido:
```ts
type ClassificationMeta = {
  confidence: Partial<Record<
    | "contentIntent"
    | "narrativeForm"
    | "context"
    | "references"
    | "tone"
    | "stance"
    | "proofStyle"
    | "commercialMode",
    number
  >>;
  evidence: Partial<Record<string, string[]>>;
  primary?: string | null;
  secondary?: string | null;
};
```

Objetivo:
- permitir saber se a classificacao foi obvia ou inferida
- guardar trechos que justificam a decisao
- diferenciar sinal principal de secundario

## Exemplo Pratico

Um post de skincare com cupom e antes/depois poderia ficar assim:

- `format = reel`
- `contentIntent = convert`
- `narrativeForm = review`
- `context = beauty_personal_care`
- `references = []`
- `tone = warm`
- `stance = endorsing`
- `proofStyle = before_after`
- `commercialMode = discount_offer`
- `contentSignals = [comment_cta, link_in_bio_cta]`
- `entityTargets = [{ type: "brand", label: "Marca X" }, { type: "product", label: "Serum Y" }]`

Hoje isso provavelmente ficaria reduzido a algo como:
- `proposal = call_to_action` ou `publi_divulgation`

## Ordem Ideal De Decisao Do Classificador
1. Identificar o objetivo principal em `contentIntent`.
2. Identificar a estrutura em `narrativeForm`.
3. Identificar o `context` folha.
4. Identificar `references` folha.
5. Identificar o `tone`.
6. Identificar a `stance`.
7. Identificar o `proofStyle`.
8. Identificar o `commercialMode`, se houver.
9. Extrair `contentSignals`.
10. Extrair `entityTargets`.
11. Registrar `confidence` e `evidence`.

## O Que Eu Mudaria No Worker

### Prompt
O worker deve parar de pedir apenas "quais categorias se aplicam" e passar a responder perguntas mais semanticas:
- qual e o objetivo principal
- qual e a forma narrativa
- qual e o tom
- qual e a postura
- qual e o tipo de prova
- existe mecanica comercial
- quais sinais de CTA/distribuicao existem
- quais entidades especificas aparecem

### Extracao Deterministica
Devem continuar deterministicas:
- `comment_cta`
- `save_cta`
- `share_cta`
- `link_in_bio_cta`
- `dm_cta`
- `giveaway`
- parte de `commercialMode` quando houver padroes claros:
  - `paid_partnership`
  - `discount_offer`
  - `dm_conversion`

### IA Semantica
Devem ficar com a IA:
- `contentIntent`
- `narrativeForm`
- `tone`
- `stance`
- `proofStyle`
- `context`
- `references`
- parte dificil de `entityTargets`

## Impacto No Banco

### Novos campos recomendados
- `stance: string[]`
- `proofStyle: string[]`
- `commercialMode: string[]`
- `entityTargets: EntityTarget[]`
- `classificationMeta: Mixed`

### Ajustes em campos atuais
- `contentSignals` perde `sponsored` e `promo_offer`
- `tone` perde `critical`

### Compatibilidade
- `proposal` continua legado durante a transicao
- `tone` legado pode continuar sendo lido com bridge, mas a escrita nova ja deve usar o escopo correto

## Impacto Na UI

### Discover
- manter filtros principais simples:
  - `format`
  - `contentIntent`
  - `narrativeForm`
  - `context`
- colocar filtros avancados recolhidos:
  - `tone`
  - `stance`
  - `proofStyle`
  - `commercialMode`
  - `contentSignals`

### Mídia Kit e Relatorios
- destaque principal:
  - melhor `contentIntent`
  - melhor `narrativeForm`
  - melhor `context`
- leitura secundaria:
  - `stance` vencedora
  - `proofStyle` mais eficaz
  - `commercialMode` de melhor resposta

### Evitar
- nao mostrar tudo como chip principal
- nao misturar `commercialMode` com `contentSignals`

## Impacto Em Analytics

Novas perguntas que passam a ser respondiveis:
- review converte melhor quando e `endorsing` ou `comparative`?
- `before_after` performa melhor que `demonstration` no mesmo contexto?
- `paid_partnership` derruba ou sustenta performance em determinados contextos?
- `storytime` conecta mais do que `day_in_the_life`?
- posts com `social_proof` tem mais salvamentos que posts de `opinion`?

## Recomendacao De Rollout

### Fase A. Refinar o modelo atual sem quebrar nada
- adicionar `stance`
- adicionar `proofStyle`
- adicionar `commercialMode`
- estreitar `contentSignals`

### Fase B. Adicionar estrutura e metadados
- `entityTargets`
- `classificationMeta.confidence`
- `classificationMeta.evidence`

### Fase C. Reclassificacao e adocao
- backfill deterministico do que for obvio
- reclassificacao assistida do que exigir interpretacao
- adoção progressiva em Discover, rankings, highlights e relatórios

## Prioridade Recomendada
Se eu tivesse que fazer em ordem de impacto:

1. `stance`
2. `proofStyle`
3. `commercialMode`
4. estreitar `contentSignals`
5. `classificationMeta`
6. `entityTargets`

## Veredito
Sim, e possivel deixar a categorizacao muito mais inteligente e especifica.

Mas a forma correta nao e explodir `contentIntent` e `context` em dezenas de ramos. A forma correta e:
- manter o nucleo enxuto
- adicionar camadas ortogonais
- separar semantica editorial, prova, postura e comercializacao
- guardar evidencia e confianca

Essa e a versao que eu recomendaria como V2.5.
