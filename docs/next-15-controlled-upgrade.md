# Upgrade controlado — Next.js 15

Data: 19 de julho de 2026.

## Resultado

- Next.js: `13.4.19` → `15.5.20` (Maintenance LTS).
- React/React DOM: `18.2.x` → `18.3.1`.
- ESLint config do Next: `13.4.19` → `15.5.20`.
- Build de produção concluído com 171 páginas geradas.
- TypeScript completo (`tsc --noEmit`) aprovado.
- 29 testes focados de billing, mídia kit e Perfil Estratégico aprovados.

O React 19 ficou deliberadamente fora deste salto. Stripe React 2.9, Framer Motion 10
e React Simple Maps 3 ainda declaram peer dependency até React 18 neste projeto.
Forçar o React 19 tornaria a migração do framework dependente de três upgrades de UI
e de uma nova rodada de validação do checkout, animações e mapas.

## Migrações aplicadas

- `cookies()`, `headers()`, `params` e `searchParams` passaram para as assinaturas
  assíncronas do Next 15 nos pontos afetados.
- Imports dinâmicos com `ssr: false` ganharam limites Client Component explícitos.
- `serverComponentsExternalPackages` foi promovido para `serverExternalPackages`.
- `outputFileTracingIncludes` e a raiz do tracing foram movidos para a configuração
  estável.
- O Jest deixou de importar o polyfill privado removido do Next e passou a usar
  `undici` como implementação pública da Fetch API.

## Impacto no bundle mobile

| Indicador | Next 13 | Next 15 | Variação |
| --- | ---: | ---: | ---: |
| First Load JS da rota | 244 kB | 264 kB | +20 kB (+8,2%) |
| Payload inicial gzip pelo manifest | 245.192 B | 265.236 B | +20.044 B (+8,2%) |

O custo está nos chunks compartilhados do runtime do framework, não em uma reversão
das divisões de código do Perfil Estratégico. Portanto, este upgrade melhora a base de
suporte, segurança e compatibilidade futura, mas não deve ser contabilizado como ganho
de payload. A próxima rodada de performance deve tratar esse acréscimo como novo
baseline e atacar os chunks compartilhados antes de migrar para React 19.

## Validação reproduzível

```bash
npx tsc --noEmit --pretty false
npm run build
node scripts/measureMobileStrategicProfileBundle.mjs
npx jest --watchAll=false --runInBand --runTestsByPath \
  src/app/api/billing/preview/route.test.ts \
  src/app/api/billing/subscribe/route.test.ts \
  'src/app/mediakit/[token]/page.test.ts' \
  src/app/dashboard/boards/components/videoUpload/appPreview/MobileStrategicProfileRealShellClient.test.tsx
```
