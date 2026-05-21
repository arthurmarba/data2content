# MM89 — Pro Access, Reading Quota, Instagram and Community UX

Status: implementado.

## Produto

- Free tem 1 leitura narrativa gratuita total.
- Pro tem até 10 leituras por mês.
- Instagram é recurso Pro.
- Comunidade continua aberta como marketplace/vitrine de creators da D2C.
- Consultoria em grupo e Grupo VIP são acesso Pro.
- Não há novo plano, pacote extra de leituras ou alteração profunda de Stripe.

## Navegação mobile

- A navegação fixa inferior do mobile tem apenas `Perfil` e `Comunidade`.
- `Nova leitura` não é item de menu global nem botão central.
- A nova leitura fica dentro do Perfil:
  - no balão/status de próximo passo;
  - no estado vazio inicial com `Analisar meu primeiro vídeo`.
- As abas internas do Perfil usam `Mapa | Leituras | Oportunidades` para evitar duplicidade com o menu principal.
- O Perfil usa balão/status sobreposto.
- A Comunidade usa banner compacto inline e não renderiza balão/status sobreposto.

## Estados de acesso

`NarrativeMapAccessState` resolve a próxima ação do Mapa Narrativo:

- `free_unused`: `1 leitura grátis disponível`, CTA `Analisar vídeo`.
- `free_preview_used`: `Leitura grátis usada`, CTA `Assinar Pro`.
- `pro_needs_instagram`: `Pro ativo · Instagram pendente`, CTA `Conectar Instagram`.
- `pro_instagram_connected`: `Pro ativo · X/10 leituras`, CTA `Nova leitura`.
- `pro_quota_reached`: `10/10 leituras usadas`, CTA `Ver Perfil`.
- `payment_pending`: `Pagamento pendente`, CTA `Continuar pagamento`.
- `payment_action_needed`: `Ação de pagamento necessária`, CTA `Atualizar pagamento`.
- `admin`: acesso interno sem bloquear a shell.

A resolução considera premium/full report access, checkout pendente, ação de pagamento, billing necessário, Instagram conectado ou precisando reconexão, leitura grátis usada e leituras usadas no mês.

## Quota

- Free: 1 leitura total.
- Pro: 10 leituras por mês.
- A UI usa sempre `leituras`, não `uploads`.
- Apenas diagnóstico concluído e leitura documentada salva conta quota.
- Upload cancelado não conta.
- Vídeo rejeitado antes da análise não conta.
- Falha antes de gerar diagnóstico não conta.
- Falha de processamento não conta.
- A contagem é calculada por `userId` e mês UTC atual.
- A API de upload-session bloqueia acesso antes de criar sessão de upload.

## Perfil

Free antes da primeira leitura vê:

- headline `Teste sua primeira leitura narrativa`;
- texto `Envie um vídeo e veja como a D2C entende sua fala, cena, intenção e próximo ajuste.`;
- CTA `Analisar meu primeiro vídeo`.

Free depois da primeira leitura mantém a leitura daquele vídeo e vê o card `Transforme essa leitura em um Perfil vivo`, com CTA único `Assinar Pro e conectar Instagram`.

Pro sem Instagram é direcionado para conectar Instagram. Pro com Instagram vê uso mensal, Instagram conectado e CTA principal `Nova leitura`. Pro com quota atingida mantém o Perfil disponível e bloqueia nova leitura até o próximo ciclo.

O Perfil não adiciona CTA secundário `Conhecer Comunidade`, porque Comunidade já está no menu fixo.

## Comunidade

A página Comunidade continua marketplace/lista/grid de creators da D2C. A seção grande de mentoria foi simplificada para um banner compacto inline antes da lista.

Free vê:

- título `Consultoria em grupo da D2C`;
- texto de Pro com Grupo VIP, consultorias, Perfil vivo, 10 leituras por mês e Instagram;
- CTA `Assinar Pro e entrar`.

Pro vê:

- título `Seu acesso à consultoria está liberado`;
- texto direto para entrar no Grupo VIP;
- CTA `Entrar na consultoria`;
- subtexto `via WhatsApp`;
- label de próxima consultoria quando o summary já fornece a informação.

Pagamento pendente vê `Finalize seu Plano Pro` e CTA `Continuar pagamento`.

## Paywall e intent

O fluxo reaproveita `BillingSubscribeModal` e o evento `open-subscribe-modal`.

`postCheckoutIntent` aceita somente:

- `connect_instagram`;
- `join_community`.

Quando o pagamento vem do Perfil, o intent é `connect_instagram`, com retorno interno ao Perfil e conexão de Instagram como próxima etapa. Quando vem da Comunidade, o intent é `join_community`, com retorno interno à Comunidade e acesso ao Grupo VIP.

`returnTo` é sanitizado: precisa começar com `/` e não pode começar com `//`. Redirect externo não é aceito.

## Guardrails

- Sem novo checkout.
- Sem novo plano financeiro.
- Sem pacote extra de leituras.
- Sem nova aba Instagram.
- Sem botão central de nova leitura no menu fixo.
- Sem CTA repetido de nova leitura em múltiplos cards.
- Sem transformação da Comunidade em landing page de mentoria.
- Sem remoção de marketplace/lista/filtros de creators.
- Sem alteração profunda de Stripe, NextAuth, DashboardShell, BoardShell, sidebar ou MediaKitView.
- Sem persistência de vídeo, thumbnail, signed URL, upload URL, objectKey, localPath, storageProviderPath, raw response ou transcrição longa.
