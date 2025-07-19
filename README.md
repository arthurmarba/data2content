This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies and run the development server:

```bash
# install dependencies
npm install

# start development server
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

This project uses [Jest](https://jestjs.io/) for its test suite.
Install dependencies if you haven't already and then run:

```bash
npm test
```

## Banco de Dados

Esta aplicação utiliza MongoDB. Configure as variáveis de ambiente `MONGODB_URI` e `MONGODB_DB_NAME` (ou `DB_NAME`) no arquivo `.env.local` apontando para sua instância. Certifique‑se de que o banco especificado exista antes de iniciar o servidor.

### Creators Scatter Plot

Na dashboard administrativa, utilize o componente **CreatorsScatterPlot** para comparar métricas de diferentes criadores em um gráfico de dispersão.
Selecione múltiplos criadores e defina as métricas dos eixos X e Y para gerar o gráfico.

### User Monthly Comparison Chart

O componente **UserMonthlyComparisonChart** exibe a evolução de uma métrica entre os três últimos meses para um criador específico.
Ele consome o endpoint `/api/v1/users/{userId}/charts/monthly-comparison` e permite escolher a métrica a ser comparada (total de posts ou total de interações).

Basta fornecer o `userId` ao componente e ele renderizará um gráfico de colunas com as diferenças mensais.

### Platform Performance Highlights

Na seção **Destaques de Performance da Plataforma** todo o resumo de conteúdo é consolidado em um único bloco. Os cards indicam o melhor e pior formato, além das propostas, tons e referências de maior desempenho. Todas as métricas exibidas representam a **média de interações por post**, acompanhadas do volume de publicações avaliadas. Logo abaixo, a tabela **Ranking de Desempenho por Formato** apresenta os dados completos e oferece acesso a uma análise detalhada.

### Populando o Banco para Desenvolvimento

Os gráficos dependem das coleções **AccountInsight** e **Metric**. Caso seu banco esteja vazio, os componentes exibirão a mensagem "Sem dados no período selecionado". Para experimentar localmente ou em ambiente de teste, insira alguns registros manualmente no MongoDB:

```javascript
use data2content
db.accountinsights.insertOne({
  user: ObjectId("<id do usuário>"),
  instagramAccountId: "123",
  recordedAt: new Date(),
  followersCount: 1000
})

db.metrics.insertOne({
  user: ObjectId("<id do usuário>"),
  postDate: new Date(),
  type: "REEL",
  source: "manual",
  stats: { reach: 500, likes: 70, comments: 5 }
})
```

Crie alguns documentos com datas diferentes para que os gráficos possam calcular tendências e médias.

## API Response Conventions

All endpoints under `src/app/api` return JSON using **camelCase** keys. For example,
the metric history routes (`/api/metricsHistory` and `/api/metrics/[metricId]/daily`)
expose fields like `engagementRate`, `likes` and `comments`. Highlight endpoints
such as `/api/v1/users/{userId}/highlights/performance-summary` also follow this
convention with keys like `topPerformingFormat` and `valueFormatted`.

Front‑end components should rely on camelCase when accessing response data. The
API serialization layer automatically converts snake\_case keys to camelCase via
the `camelizeKeys` utility.

## Video Drill-Down API

The endpoint `/api/v1/users/{userId}/videos/list` returns a paginated list of video posts for a creator. Query parameters allow filtering by `timePeriod`, sorting by any metric, and pagination:

```http
GET /api/v1/users/123/videos/list?timePeriod=last_90_days&sortBy=views&sortOrder=desc&page=1&limit=10
```

Responses include computed `retentionRate` and `averageVideoWatchTimeSeconds` along with pagination details.

### Video Drill-Down in the Dashboard

On the dashboard, clicking any of the video metrics or the **Ver Todos os Vídeos** button opens a table listing all posts for that creator. The table can be sorted by any column and includes pagination controls. Thumbnails and captions link directly to the original Instagram post.

Example:

| Thumbnail & Caption | Views | Likes | Comments |
|---------------------|------:|------:|---------:|
| ![thumb](public/images/default-profile.png) [Primeiro Reels](https://instagram.com/p/abc123) | 10k | 520 | 30 |

### Media Kit Slugs

Media kit links are now created using a slug based on the creator's name.
Admin users can generate or revoke this slug from the creators management page, and
the public URL becomes `/mediakit/<slug>`.

### Community Inspirations

Community inspirations are registered based on total interactions rather than
just the most recent posts. Database-level sorting ensures that only the
highest-engagement items are kept. The cron job selects each user's
top-performing content so the community feed highlights what resonated the most
with their followers.

#### Running the community cron manually

Set `LOG_LEVEL=debug` before invoking the cron route to see additional debug
information, including the MongoDB query parameters and sinceDate whenever a
user has no eligible posts:

```bash
LOG_LEVEL=debug curl -X POST http://localhost:3000/api/cron/populate-community-inspirations
```



## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Documentação

Consulte o diretório `docs` para informações adicionais, incluindo o [plano de expanção dos rankings](docs/ranking-expansion.md) e o [plano de otimização estratégica v4](docs/plano-de-otimizacao-estrategica-v4.md).


## Agency Dashboard

Usuários com papel **agency** podem acessar `/agency/creator-dashboard` para acompanhar apenas os criadores vinculados à sua agência. Crie a conta de agência pelo painel admin e compartilhe o link de convite (`/assinar?codigo_agencia=<inviteCode>`). A assinatura do WhatsApp permanece do usuário mesmo que ele saia da agência.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Instagram Demographics Service

The `src/services/instagramInsightsService.ts` module provides `fetchFollowerDemographics`, which sequentially calls the Instagram Graph API (v23.0) for each demographic breakdown and aggregates the results. A daily cron job (`src/cron/fetchDemographics.ts`) now saves each snapshot to MongoDB while also caching the raw result in Redis under `demographics:<igUserId>` with 24h TTL. The API endpoint `/api/instagram/[userId]/demographics` reads from this cache or fetches fresh data if missing, persisting new snapshots to the database as well.
