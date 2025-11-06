# Campanhas multi-criadores – Briefing Público

Este documento sintetiza o fluxo recém-lançado para captação de campanhas com múltiplos criadores a partir do Mídia Kit público.

## 1. Escopo entregue
- CTA destacado no Mídia Kit (`🎯 Criar campanha com vários criadores`) levando ao formulário `/campaigns/new`.
- Página pública com formulário inteligente (marca, e-mail, telefone, orçamento, briefing, segmentos).
- Persistência em `Campaign` (status inicial `pending`, rastreio de fonte, UTMs, handle/slug do mídia kit, affiliate code quando disponível e links de referência).
- Endpoint `POST /api/campaigns/new` com rate limit diário (5/IP), normalização de orçamento/segmentos e logging `[CAMPAIGN_PUBLIC]`.
- E-mail imediato para a marca via template `campaignBriefConfirmation` com resumo do briefing.

## 2. Campos salvos
| Campo | Origem | Observações |
| --- | --- | --- |
| `brandName` | formulário | obrigatório |
| `contactEmail` | formulário | obrigatório |
| `contactPhone` | formulário | opcional |
| `budget` / `currency` | formulário | orçamento parseado (`BRL` padrão) |
| `description` | formulário | briefing completo (obrigatório) |
| `segments` | checkboxes + campo livre | array normalizado/sem duplicatas |
| `referenceLinks` | textarea links | até 3 URLs http(s), acesso público |
| `source` | calculado | `mediaKit`, `affiliate` ou `direct` |
| `originAffiliate` | query | `origin_affiliate` quando presente |
| `originCreatorHandle` | query | `origin_handle` (handle do criador) |
| `originMediaKitSlug` | query | `origin_slug` (slug do mídia kit) |
| `utmSource/Medium/Campaign` | query/body | preservados para analytics |
| `originIp` / `userAgent` | request | para auditoria |

## 3. QA sugerido
1. **Envio web**  
   - Acessar `/campaigns/new` com e sem parâmetros de origem.  
   - Preencher briefing completo → esperar mensagem de sucesso e log `[CAMPAIGN_PUBLIC]`.  
   - Verificar registro em `campaigns` (status `pending`, campos `source`/UTM preenchidos).
2. **Rate limit**  
   - Repetir 5 envios com o mesmo IP → 429 na tentativa seguinte.
3. **E-mail**  
   - Confirmar recebimento de “Recebemos seu briefing de campanha ✨” com segmentos + links (quando enviados) + briefing.
4. **UTMs**  
   - Chamar CTA via mídia kit → conferir `utm_*`, `origin_handle` e `origin_slug` persistidos.

## 4. Observabilidade
- Logs `[CAMPAIGN_PUBLIC]` (logger + Sentry) carregam `campaignId`, `source`, `originSlug`, `budget`.
- E-mail de confirmação registra `[emailService] Confirmação de briefing enviada`.  
- Rate limit usa chave Redis `campaign_public:<ip>`.

## 5. Próximos passos
- Pipeline de matchmaking IA consumindo os registros `Campaign`.
- Painel interno para acompanhamento do funil (`pending` → `in_review` → `contacted`).
- Alertas automáticos para falhas 500 ou volume de campanhas acima de baseline.
