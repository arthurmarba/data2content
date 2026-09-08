# Radar Data2Content de Oportunidades Públicas - MVP do relatório

> Atualização de 07/09/2026: o escopo histórico de fontes abaixo não é autorização atual de coleta.
> Consulte `radar-coleta-gratuita-operacao.md`. Coletores e auditoria agora bloqueiam fontes não
> revisadas, pagas ou proibidas antes da rede; captura manual e coleta alimentam a revisão administrativa.

## Objetivo

Gerar um PDF periódico com oportunidades para creators encontradas em páginas públicas, revisadas por uma pessoa e acompanhadas do link para a plataforma de origem.

O PDF é uma saída do conjunto estruturado `CampaignRadarBatch`; ele não é a base dos dados. Essa separação permite que o mesmo conjunto seja exposto futuramente pelo plugin e, depois, pela plataforma Data2Content.

## Escopo desta fase

- Fontes públicas, sem login.
- Coleta da Influencer Brasil por sitemap de projetos.
- Coleta dos anúncios públicos da Squid por listagem de campanhas.
- Coleta das chamadas públicas mantidas pela Creator Ads em sua vitrine de links.
- Coleta de landings públicas qualificadas da PlayNest / Play9, distinguindo programa de creators de campanha com prazo e cachê.
- Coleta de projetos UGC publicados no 99Freelas, com filtro para excluir edição, gestão e social media sem atuação do creator.
- Coleta de parcerias públicas de cobertura de eventos quando briefing, benefício e candidatura são verificáveis.
- Extração de prazo, território, formato, requisitos e remuneração quando publicados.
- Revisão humana obrigatória.
- PDF A4 com links clicáveis.
- Validação estrutural e visual antes do envio.

Ficam fora: e-mail, Instagram, WhatsApp, áreas logadas, personalização por creator, ferramenta do plugin e tela dentro da plataforma.

## Registro das fontes rastreadas

| Fonte | Situação no MVP | Motivo |
| --- | --- | --- |
| Influencer Brasil | Coleta automatizada | Projetos, prazos e páginas de candidatura são públicos. |
| Squid | Coleta automatizada | Artigos públicos expõem links diretos para campanhas. |
| Creator Ads | Coleta automatizada parcial | A vitrine pública expõe chamadas específicas; briefing, valor e prazo podem exigir conta. |
| PlayNest / Play9 | Coleta automatizada parcial | Landings públicas de recrutamento podem ser coletadas; missões internas do app ficam fora. |
| Skeepers | Monitorada, sem campanhas emitidas | O cadastro é público, mas as campanhas específicas ficam na área da comunidade e o recorte público encontrado é voltado a Portugal. |
| MIS | Captura manual identificada | Missões e briefings ficam no app e são selecionados por perfil. A edição de 01/09/2026 registra explicitamente esse recorte. |
| Influency.me | Monitorada, candidata a e-mail | A própria plataforma informa que creators ainda não localizam campanhas; o contato ocorre por telefone ou e-mail. |
| Creators LLC | Monitorada, candidata a e-mail | O Job List fica no dashboard. Programas públicos são catalogados separadamente: Druid está com cadastro; Tasty Shorts e AliExperts estão em lista de espera; Cesu Creators e Selvers estão encerrados. |
| Comû Delas | Monitorada, sem campanha pública emitida | Há inscrição pública para casting com plano mensal. O exemplo de UGC a R$ 600 na home não tem marca, prazo ou candidatura própria. |
| Noovid | Monitorada, candidata a e-mail | O cadastro é público, mas as rotas de jobs e tasks redirecionam para login. |
| 99Freelas | Coleta automatizada | A listagem pública expõe projetos UGC, descrição, publicação e prazo. O envio da proposta exige conta. |
| Animextreme | Coleta automatizada | A chamada e o formulário público informam vagas e a permuta para creators. |
| Up!ABC | Coleta automatizada | A parceria de cobertura, as entregas e o formulário são públicos, sem login. |
| Tijuca Geek Festival | Coleta automatizada parcial | Briefing, critérios e benefícios são públicos; o formulário final abre pelo Google. |
| Plataformas e clubes com convite | Fora da coleta automática | Convites privados não são observáveis de forma completa e não devem ser raspados em sessão autenticada. |

Uma chamada sem prazo público recebe estado `uncertain` e precisa de revisão humana antes de aparecer no PDF. Cadastro genérico não é convertido automaticamente em “publi disponível”.

O registro operacional completo fica em `src/app/lib/campaignRadar/sourceRegistry.ts`. Para verificar se as páginas e os sinais públicos mudaram:

```bash
npm run campaign-radar:audit-sources
```

O comando grava `output/campaign-radar/AAAA-MM-DD/source-audit.json`. Estado `changed` não significa campanha nova: significa que a página deixou de conter algum sinal esperado e precisa de inspeção humana.

A auditoria documental e o modelo de pedido de autorização ficam em
`docs/campaign-radar-source-compliance-audit.md`. Para validar apenas a governança do plugin, sem
rede e sem escrita no banco:

```bash
npm run campaign-radar:audit-plugin-sources
```

## Fluxo operacional

### Persistir o lote para o plugin/MCP

O catálogo consultável pelo MCP é derivado do mesmo lote revisado usado pelo PDF. A importação é
segura por padrão: sem `--apply`, o comando apenas valida o arquivo e mostra quantos registros
seriam públicos, ativos ou restritos.

```bash
npm run campaign-radar:import -- \
  --input=output/campaign-radar/AAAA-MM-DD/reviewed.json
```

Depois de revisar o resumo, a gravação explícita é:

```bash
npm run campaign-radar:import -- \
  --input=output/campaign-radar/AAAA-MM-DD/reviewed.json \
  --apply
```

A ferramenta MCP `find_campaign_opportunities` só é registrada quando
`MCP_CAMPAIGN_RADAR_ENABLED=1`. O padrão é `0`, para que o desenvolvimento e o deploy do backend
não alterem a versão do plugin que está em revisão. Ao ativar o recurso, o servidor acrescenta o
escopo OAuth `campaigns:read` automaticamente.

O texto correspondente nos cards do perfil usa uma flag separada,
`NEXT_PUBLIC_CAMPAIGN_RADAR_ENABLED=1`. As duas flags só devem ser habilitadas juntas, depois do
catálogo estar importado e do teste do MCP passar. Assim, o perfil não promete uma experiência que
ainda não está disponível no ChatGPT.

### Liberação de fontes para o plugin

Uma página ser pública não significa, por si só, que seu conteúdo pode ser redistribuído por um
plugin. O PDF pode continuar usando o fluxo editorial e a revisão humana, mas o MCP opera em modo
fail-closed: uma fonte só recebe `sourceVisibility: publicly_observable` quando o bloco
`pluginDistribution` em `sourceRegistry.ts` contém:

- `status: approved`;
- base documentada (`terms_allow_redistribution`, `written_permission` ou `official_api`);
- referência da evidência;
- data e responsável pela revisão.

Enquanto isso não for preenchido, o dry-run mostrará `publiclyQueryableRecords: 0`. Esse resultado é
esperado e impede a exposição acidental de conteúdo de terceiros durante o desenvolvimento.

### Por que o catálogo do MCP pode estar vazio

Três travas independentes, em ordem. A consulta do MCP (`listPublicCampaignRadarCatalog`) só devolve
um registro quando **todas** passam:

1. **Autorização da fonte** — `pluginDistribution.status: approved` no registro. Em 07/09/2026:
   4 de 47 aprovadas (Up!ABC, Tijuca Geek, Brasil Game Show e Keune), 30 pendentes, 13 bloqueadas.

   Essas quatro entraram com a base `public_open_call`: chamada aberta que a própria organização
   publica para atrair creators, sem proibição identificada na página. **Não é licença** — é decisão
   registrada do responsável, com evidência e data, revogável a qualquer momento (revogar tira do
   MCP inclusive registros já importados). Plataforma cujos termos proíbem coleta ou redistribuição
   — Influencer Brasil, 99Freelas, Workana, Creator Ads, Threads — continua fora, e é onde está o
   volume: 71 das 75 aprovadas da edição de 07/09 seguem restritas.
2. **Estado e validade** — a consulta exige `status: "open"` e uma destas duas: prazo publicado no
   futuro, **ou** nenhum prazo e descoberta dentro da janela de `UNDATED_MAX_AGE_DAYS` (14 dias,
   ajustável por `CAMPAIGN_RADAR_UNDATED_MAX_AGE_DAYS`, teto de 60).

   A maioria das fontes com volume — 99Freelas, Workana, The Insiders, POPline — não publica prazo
   nenhum. Excluí-las seria perder 55 das 73 da edição de 07/09. Para essas, o relógio é a
   **descoberta**, não a última verificação: verificação se renova a cada varredura e nunca deixaria
   a chamada expirar. Passada a janela, a troca de lote desativa o registro (`activeInCatalog:
   false`) na mesma transação que aposenta o lote anterior.

   No card do PDF elas aparecem como "sem prazo · vista em DD/MM", para o creator julgar a idade.
3. **Flags** — `MCP_CAMPAIGN_RADAR_ENABLED` e `NEXT_PUBLIC_CAMPAIGN_RADAR_ENABLED`, nas duas casas
   (`.env.local` e Vercel).

A visibilidade é gravada na importação **e** revalidada na consulta: aprovar uma fonte depois exige
importar o lote de novo. Ligar as flags antes da autorização entrega uma ferramenta que responde
"nada encontrado" e um card de perfil que promete o que não existe — por isso elas continuam
desligadas.

Antes de ligar as flags, o release deve passar também por:

```bash
npm run campaign-radar:audit-plugin-sources -- --require-release-ready
```

O comando exige ao menos uma fonte aprovada e nenhum registro inconsistente. Fonte pendente não
bloqueia mais: o registro também documenta becos sem saída, e o catálogo já filtra tudo que não
está aprovado. Fontes bloqueadas permanecem
fora do catálogo sem impedir o uso das fontes que tiverem autorização válida. `robots.txt` é um
controle técnico de rastreamento e nunca é tratado como licença de redistribuição.

Regras de acesso aplicadas no servidor:

- conta gratuita: uma oportunidade completa por semana, incluindo link da candidatura; a atribuição
  fica persistida em `campaign_radar_weekly_selections` e não muda se o Norte ou o catálogo mudarem;
  a coleção guarda somente uma chave irreversível do usuário e expira automaticamente em 21 dias;
- conta assinante: catálogo público revisado, filtros e links;
- Instagram não é obrigatório para acessar o catálogo completo;
- quando o Instagram está conectado e há evidência suficiente, o ranking também usa sinais
  derivados dos conteúdos analisados, sem devolver métricas ou registros privados;
- capturas de inventário autenticado ou selecionado por perfil, como `mis-manual-capture`, ficam
  classificadas como `restricted` e nunca são consultáveis pelo MCP;
- orçamento total da campanha nunca é apresentado como cachê individual do creator;
- nenhuma resposta estima probabilidade de aceitação;
- a resposta gratuita não informa o tamanho do catálogo e não inclui link de plano ou checkout.

A troca de lote do catálogo ocorre em transação: o novo lote e a desativação do anterior são
confirmados juntos. Antes de abrir a transação, o importador valida o JSON inteiro, datas, HTTPS,
fontes cadastradas, revisões, valores e IDs duplicados.

### Preparar dependências do PDF

```bash
python3 -m pip install -r scripts/campaign-radar/requirements-pdf.txt
```

Em ambientes com Python gerenciado, use o interpretador do próprio ambiente para instalar e executar os comandos abaixo.

### 1. Coletar

```bash
npm run campaign-radar:collect
```

Saída padrão:

```text
output/campaign-radar/AAAA-MM-DD/collected.json
```

Para reproduzir uma data específica:

```bash
npm run campaign-radar:collect -- --now=2026-08-31T18:00:00-03:00
```

### 2. Revisar

Crie um manifesto `review-decisions.json` com uma decisão para cada oportunidade:

```json
{
  "schemaVersion": "campaign_radar_review_v1",
  "reviewedAt": "2026-08-31T21:00:00.000Z",
  "reviewedBy": "nome-do-revisor",
  "decisions": [
    {
      "id": "influencer-brasil:exemplo",
      "status": "approved",
      "notes": "Prazo e cachê conferidos na fonte pública."
    }
  ]
}
```

Aplique as decisões:

```bash
npm run campaign-radar:review -- \
  --input=output/campaign-radar/AAAA-MM-DD/collected.json \
  --decisions=output/campaign-radar/AAAA-MM-DD/review-decisions.json
```

O gerador recusa lotes com qualquer oportunidade ainda pendente.

### 3. Gerar o PDF

```bash
npm run campaign-radar:report -- \
  --input=output/campaign-radar/AAAA-MM-DD/reviewed.json \
  --output=output/pdf/radar-d2c-AAAA-MM-DD.pdf
```

### 4. Validar conteúdo e links

```bash
npm run campaign-radar:validate -- \
  --pdf=output/pdf/radar-d2c-AAAA-MM-DD.pdf \
  --input=output/campaign-radar/AAAA-MM-DD/reviewed.json
```

### 5. Renderizar para inspeção visual

```bash
mkdir -p tmp/pdfs/radar-d2c-AAAA-MM-DD
pdftoppm -png output/pdf/radar-d2c-AAAA-MM-DD.pdf tmp/pdfs/radar-d2c-AAAA-MM-DD/page
```

Verifique capa, quebras de página, cards, acentos, rodapés e botões. Um PDF só está pronto para envio depois dessa inspeção.

## Design do relatório

O layout do PDF segue o projeto `Radar de publis.dc.html`, no Claude Design
(`dff5b87a-63a6-429c-8e4b-5349e15c8124`). Implementado em `render_report.py` em 07/09/2026.

O que o desenho define e o gerador respeita:

- capa com a régua de leitura dos valores fixada no rodapé da página, sem caixa;
- cada seção começa em página nova, com título à esquerda e a contagem à direita sobre um filete
  grosso;
- dentro da seção, grupos por mês de prazo — por fonte na seção "Valor a confirmar";
- o card é uma grade de duas colunas: à esquerda identidade (território, formato, onde publicar) e
  compromisso (você entrega, para participar, contexto); à direita, separada por filete, a coluna do
  dinheiro com valor, ressalva, chamada e verificação. O botão rosa saiu: a candidatura é um link de
  texto;
- rodapé com assinatura à esquerda e data da edição à direita, com entreletras.

Duas notas de implementação para quem for mexer: no reportlab a tabela nasce centrada, então todo
bloco usa `hAlign="LEFT"`; e entreletras só existe em objeto de texto do canvas, por isso o rodapé
usa `beginText` em vez de `drawString`.

## Regra financeira

Uma faixa de investimento não deve ser tratada como cachê do creator. O relatório separa:

- cachê individual confirmado;
- remuneração variável ou comissão;
- permuta;
- orçamento total da campanha;
- valor não divulgado.

Somente valores com `basis` igual a `per_creator` ou `per_delivery` e `confirmed: true` são apresentados como cachê confirmado.

No 99Freelas, `Valor Mínimo: R$ 50` é o piso técnico para propostas da plataforma, não o orçamento anunciado pelo cliente. O coletor registra `orçamento aberto` e nunca converte esse número em cachê.

## Regra dos links

- `sourceUrl`: página pública usada como evidência.
- `applicationUrl`: página em que o creator consulta ou inicia a candidatura.
- Quando a plataforma exige autenticação, o card informa `Requer conta na plataforma de origem`.

## Limite da promessa

O relatório cobre oportunidades encontradas nas fontes públicas monitoradas. Não cobre convites privados, campanhas invisíveis fora do perfil selecionado ou todas as plataformas existentes no mercado.

## Regra dos programas e bancos de creators

Programa (`opportunityType: creator_program`) não é publi. Na publi o creator entrega
conteúdo e recebe; no programa ele se inscreve numa lista e **pode** ser convidado depois.
Como o resultado é incerto e quase nunca há valor publicado, o programa tem seção e card
próprios — nunca é misturado às seções de valor.

Diferenças no card:

- No lugar do valor entra **O que você ganha entrando**. Escrever cachê onde não há cachê
  gasta a maior tipografia do card com uma não-informação.
- No lugar do prazo entra **Inscrição aberta** (ou `Inscrição até <data>`, quando a fonte
  publica uma).
- Todo card de programa carrega, de forma estrutural, o aviso
  **"Entrar na lista não garante campanha nem pagamento."** Não é rodapé: é a linha que
  impede o programa de ser lido como a publi de R$ 480 que aparece na mesma edição.
  Quando a própria fonte repete esse aviso nos requisitos, a repetição é removida.
- O botão diz **Fazer minha inscrição**, não "candidatar-se".

O que entra:

- inscrição comprovadamente aberta, com link direto e marca ou plataforma identificada.

O que não entra:

- inscrição encerrada — mesma régua da publi com prazo vencido, sem exceção
  (ex.: "2.026 Convocados", encerrado em 30/04/2026);
- cadastro genérico de plataforma ("crie sua conta na X"). Isso é onboarding, não programa.
  Sem essa linha, a seção vira vitrine de anúncio das plataformas monitoradas.

## Categorias ainda não exibidas

`challenge` é uma terceira natureza: o creator concorre a um prêmio, não recebe cachê.
Não deve ser promovido a publi quando aparecer um vigente — precisa da própria regra,
como a dos programas.
