# Relatório de performance — Perfil Estratégico Mobile

Data da medição final: 19 de julho de 2026.

## Resultado acumulado

| Indicador | Baseline | Final | Ganho |
| --- | ---: | ---: | ---: |
| First Load JS reportado pelo Next | 349 kB | 244 kB | -105 kB (-30,1%) |
| Payload inicial gzip medido pelo manifest | 295.417 B | 245.192 B | -50.225 B (-17,0%) |
| Render extra do perfil ao abrir menu da conta | 1 ou mais | 0 | eliminado |
| Requisições secundárias próprias no mount elegível | 4 | 0 | adiadas |

O valor exato gzip soma os arquivos JS e CSS associados à rota em
`.next/app-build-manifest.json`. O número do Next é arredondado e usa a apresentação
do próprio relatório de build, por isso os dois indicadores não são diretamente
intercambiáveis.

## Medição de browser final

Mediana de três contextos frios independentes:

| Métrica | Mediana |
| --- | ---: |
| DOMContentLoaded | 244 ms |
| Load event | 252 ms |
| LCP | 280 ms |
| CLS | 0 |
| Long tasks | 0 |
| Recursos | 21 |
| Scripts | 12 |
| Fetch/XHR | 4 |
| Transferência total | 211 KB |

Condições: build de produção local, Chromium headless, viewport/dispositivo iPhone 13,
servidor já iniciado e cache de browser frio a cada rodada. Não houve throttling de CPU
ou rede. Mutações HTTP da página foram bloqueadas pelo probe para não alterar dados da
conta E2E. Portanto, esses números são um benchmark local reprodutível, não uma medição
de campo ou um substituto para Core Web Vitals reais de produção.

## Mudanças que produziram o resultado

1. Providers e CSS globais foram retirados do caminho crítico quando não usados pela rota.
2. Overlays e superfícies secundárias do shell passaram a carregar dinamicamente.
3. O carregamento server-side foi paralelizado e ganhou instrumentação opcional.
4. Seções abaixo da dobra foram extraídas para um chunk adiado de 9.736 B gzip.
5. Dados derivados, callbacks e a árvore principal do perfil foram memoizados.
6. Avatar e thumbnails passaram a solicitar variantes compatíveis com o tamanho exibido.
7. Geração de pautas e sugestões de Collabs passaram a carregar apenas por demanda.
8. Histórico da calculadora e registro de visita foram movidos para depois do primeiro paint.

## Como repetir

Bundle, depois de executar `npm run build`:

```bash
node scripts/measureMobileStrategicProfileBundle.mjs
```

Browser, com o servidor de produção local iniciado e credenciais E2E configuradas:

```bash
E2E_BASE_URL=http://127.0.0.1:3213 \
PERF_ROUTES=/dashboard/boards/mobile-strategic-profile \
PERF_SETTLE_MS=2500 \
PERF_BLOCK_PAGE_WRITES=1 \
PERF_RUNS=3 \
npx tsx tmp/mobile_perf_probe.ts
```

O probe aceita uma lista de rotas separadas por vírgula em `PERF_ROUTES` e cria um novo
contexto de browser para cada rodada de `PERF_RUNS`.

## Guardrails automatizados

- Abertura de overlays não pode mudar as props nem renderizar novamente o perfil pesado.
- Perfil não pode disparar geração, sugestões, calculadora ou registro de visita de forma imediata.
- Geração de pautas deve iniciar ao entrar na aba Collabs.
- Sugestões legadas devem iniciar somente ao abrir o detalhe de Collabs.
- Thumbnails remotas devem usar tamanho de 96 px e lazy loading; data/blob URLs não passam pelo otimizador remoto.

Esses contratos estão cobertos pelas suítes focadas do shell, seções adiadas e thumbnails.
