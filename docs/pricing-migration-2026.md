# Reajuste de preços — Pro (2026)

Dois níveis de preço para o plano Pro:

| Nível | BRL mensal | BRL anual | USD mensal | USD anual |
|---|---|---|---|---|
| **Novos assinantes** (padrão) | R$ 97,00 | R$ 890 | $19.40 | $179 |
| **Assinantes atuais** (grandfather) | R$ 79,90 | R$ 690 | $15.90 | $139 |

- **Novos assinantes** = quem assina após o corte → pagam o preço "new".
- **Assinantes atuais** = quem já tinha assinatura → migrados para o preço "legacy",
  **sem cobrança imediata**; o novo valor vale a partir da **próxima renovação**
  (`proration_behavior: 'none'`, `billing_cycle_anchor: 'unchanged'`).

## Como o preço se propaga no site

- O checkout e a exibição de preço leem a Price do Stripe apontada pelas envs
  `STRIPE_PRICE_MONTHLY_BRL` / `STRIPE_PRICE_ANNUAL_BRL` / `..._USD`
  (`subscribe/route.ts` e `serverBillingPrices.ts`). Trocar a env → o site reflete.
- Textos fixos de preço (landing, SEO JSON-LD, página de billing) foram atualizados
  para R$ 97,00 nesta PR.
- `config/pricing.config.ts` e o fallback USD em `serverBillingPrices.ts` foram
  ajustados para bater com os novos valores (usados só quando as price IDs faltam).

## Runbook de execução (ordem recomendada)

1. **Aviso prévio aos clientes atuais** (reajuste de preço normalmente exige
   comunicação/antecedência). Enviar e-mail informando o novo valor e a data de
   vigência (próxima renovação).
2. **Dry-run** do script (não escreve nada) — confere Product, prices a criar e
   quais assinaturas seriam migradas:
   ```
   npx tsx --env-file=.env.local ./scripts/migrateStripePricing.ts
   ```
3. **Aplicar** — cria as 8 prices e migra as assinaturas atuais:
   ```
   npx tsx --env-file=.env.local ./scripts/migrateStripePricing.ts --apply
   ```
   O script imprime os **price IDs "new"** e o mapeamento das envs.
4. **Atualizar as envs no Vercel** com os price IDs "new" impressos:
   `STRIPE_PRICE_MONTHLY_BRL`, `STRIPE_PRICE_ANNUAL_BRL`,
   `STRIPE_PRICE_MONTHLY_USD`, `STRIPE_PRICE_ANNUAL_USD` → redeploy.
   A partir daqui, **novos** assinantes pagam 97/890 (19.40/179).
5. **Verificar**:
   - Landing/checkout deslogado mostram R$ 97,00 (e 890 no anual).
   - Um assinante atual mostra 79,90/690 (via `/api/admin/billing/debug?q=<email>`).
   - Timeline das subscriptions migradas no Dashboard do Stripe registra o update.

## Idempotência e segurança

- As prices são identificadas por `lookup_key` (`d2c_pro_new_*`, `d2c_pro_legacy_*`),
  então re-executar não duplica.
- A migração **nunca rebaixa** quem já está num preço "new" (novo assinante) e
  **pula** quem já está num "legacy" (já migrado) — pode rodar quantas vezes precisar.
- Só migra assinaturas em `active`, `trialing`, `past_due`, `unpaid`, com item único
  e moeda/intervalo suportados; o resto é pulado e logado para revisão manual.

## Observação sobre acesso

O ambiente do agente não tem acesso de escrita ao Stripe. A criação de prices e a
migração são feitas por **você**, rodando o script acima com a `STRIPE_SECRET_KEY`
do ambiente de produção (ou pelo Dashboard, se preferir criar as prices na mão e
apenas rodar a parte de migração).
