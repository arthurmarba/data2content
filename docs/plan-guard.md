# Guardião da Receita

Middleware centralizado que protege rotas premium (IA, WhatsApp) verificando se o `planStatus` do usuário está **active**.

## Funcionamento
- `guardPremiumRequest` é chamado pelo `middleware.ts` para rotas sensíveis.
- Quando o plano não está ativo, a requisição é bloqueada com status `403` e mensagem padrão.
- Tentativas negadas são registradas com `logger.warn`.
- Métricas de bloqueio são acumuladas em memória e podem ser consultadas em `/api/admin/plan-guard/metrics`.

## Métricas
As métricas expõem o total de acessos bloqueados e o detalhamento por rota, permitindo monitoramento no dashboard de suporte.
