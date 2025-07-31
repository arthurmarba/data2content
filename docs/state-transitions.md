# Cenários de Transição de Estado

Este documento descreve os processos automáticos e manuais quando uma agência ou criador muda de status.

## Agência cancela assinatura
- Os convidados permanecem com acesso até a data em `planExpiresAt`.
- Um job diário (`cron/guestTransition.ts`) verifica convidados:
  - 7 dias antes do vencimento, envia e-mail avisando sobre a migração.
  - Após o vencimento, o convidado é migrado para `role: user`, `planStatus: inactive` e a agência é removida.

## Criador sai da agência
- Endpoint protegido: `PATCH /api/admin/users/[userId]/role`.
- Permite a um administrador alterar `role` e `planStatus` de qualquer usuário.
- Todas as alterações são registradas com `logger.info` para auditoria.
