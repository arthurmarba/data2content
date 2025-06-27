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



## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
