# QA — Etapa 5 (Assinatura PRO)

Checklist de verificação manual focado no fluxo Free → PRO, paywalls contextuais e plano de rollback.

## 1. Fluxo Free
- [ ] `/pro` carrega em desktop/mobile com CTA fixo; botão “Ativar PRO” abre modal e dispara `dashboard_cta_clicked`.
- [ ] Proposta (Free) → tentar “Analisar com IA” mostra paywall `context=ai_analysis`, sem exibir análise anterior.
- [ ] Proposta (Free) → tentar enviar resposta abre paywall `context=reply_email`, textarea não carrega sugestão.
- [ ] Calculadora e Planner bloqueados: clique principal dispara paywall correto (`calculator` / `planning`).
- [ ] Tooltips “Disponível no PRO…” visíveis ao focar em botões bloqueados.

## 2. Fluxo PRO (após upgrade)
- [ ] Concluir checkout → redireciona para `/billing/success` → retorna automaticamente ao contexto original (proposta, calculadora ou planner) com foco restaurado.
- [ ] Verificar envio de e-mail “Desbloqueie sua primeira resposta…” e recibo correspondente.
- [ ] Executar sequência: abrir proposta → “Analisar com IA” → “Enviar resposta” em até 3 cliques.
- [ ] Planner e Calculadora carregam dados reais sem paywall.

## 3. Telemetria
- [ ] Validar no console/network `paywall_viewed`, `dashboard_cta_clicked`, `subscription_started`, `subscription_activated` e `email_sent_via_platform`.
- [ ] Testar `pro_pricing_toggled` alternando período/moeda na página `/pro`.

## 4. E-mails Transacionais
- [ ] Sucesso pagamento → mensagens de boas-vindas e recibo.
- [ ] Falha pagamento → e-mail de dunning com link para Billing.
- [ ] Cancelamento → confirmação com data final de acesso.

## 5. Acessibilidade & Responsivo
- [ ] Modal: foco inicial no botão fechar, Tab cíclico e ESC fecha.
- [ ] `/pro` e modal revisados em breakpoints 320px, 768px e ≥1280px sem cortes.

## 6. Rollout & Flags
- [ ] `paywall.modal_enabled` e `planning.group_locked` ativos em staging.
- [ ] Plano de rollout: 10% → 50% → 100% com monitoramento de conversão e erros.
- [ ] Documentar eventual rollback: desativar `paywall.modal_enabled` para redirecionar usuários direto ao Billing.
