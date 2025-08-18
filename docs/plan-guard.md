# Guardião da Receita

Verificação centralizada que protege rotas premium (IA, WhatsApp) garantindo que o `planStatus` do usuário esteja **active**.

## Funcionamento
- Cada rota premium chama `guardPremiumRequest` no início do handler.
- Quando o plano não está ativo, a requisição é bloqueada com status `403` e mensagem padrão.
- Métricas de bloqueio são acumuladas em memória e podem ser consultadas em `/api/admin/plan-guard/metrics`.

## Métricas
As métricas expõem o total de acessos bloqueados e o detalhamento por rota, permitindo monitoramento no dashboard de suporte.

