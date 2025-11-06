# Checklist LGPD — Instrumentação Funil Mídia Kit → Propostas

- [ ] **Consentimento explícito** para cookies/analytics coletado antes de disparar eventos via `track`.
- [ ] **Anonimização de dados sensíveis** de marcas: e-mails de contato ficam no banco operacional, nunca nos eventos (usar hash se houver necessidade futura).
- [ ] **Separação de ambientes**: variáveis `NEXT_PUBLIC_ANALYTICS_ENV` e namespaces distintos evitam mistura de dev/staging com produção.
- [ ] **Direito de exclusão**: `DELETE /api/user/account` remove propostas e registros associados; eventos analíticos permanecem agregados/anônimos.
- [ ] **Controle interno**: property `is_internal` enviada ao provider de analytics permite excluir staff/pessoas em QA dos painéis.
- [ ] **Retenção mínima**: revisar, com o time jurídico, o tempo de guarda de logs de propostas e e-mails enviados (sugestão inicial: 180 dias).
- [ ] **Compartilhamento com terceiros**: documentar (e aprovar) qualquer conector externo usado nas integrações de alertas/dashboards.
- [ ] **Transparência**: atualizar Política de Privacidade com o novo fluxo de propostas (coleta de e-mail comercial, orçamento, entregáveis).
