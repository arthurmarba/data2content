---
tipo: decisão
área: aquisição
status: em vigor desde 26/09/2026
---

# O plugin cria a conta e prova o valor; a venda acontece no site

O objetivo do ChatGPT e do Claude é gerar assinantes, dentro do que cada loja permite. Arthur viu o funil da Runway (conexão → tela de planos → "continuar") e perguntou se dava para copiar. A resposta foi: no Claude sim, com cuidado; no ChatGPT não.

## As regras de cada loja

- **ChatGPT:** as diretrizes de plugins da OpenAI proíbem vender assinatura digital "direta ou indiretamente (por exemplo, por upsell de plano gratuito)". O plugin também não pode mostrar planos nem promover upgrade. Pode dizer que um recurso não está no plano atual e linkar uma página informativa. Plugin só para quem já assina é permitido; vender por dentro dele, não.
- **Claude:** a política do diretório da Anthropic proíbe anúncio e transação financeira em nome do usuário. Não fala em exigir conta paga nem em mostrar planos no login.

## O funil

1. **Conectar é se cadastrar** (Google). A origem fica gravada na conta (`pluginOrigin`).
2. **Valor na conversa:** Norte → narrativa → radar. Ao declarar o Norte, a fila gera as três primeiras pautas (decisão do Arthur: gerar pauta de amostra vale o custo).
3. **O limite vira convite.** Cada limite diz o que ficou de fora, sem vender, e leva o pedido (`intent`) para o site.
4. **Chegada no site** (`/dashboard/plugin`): narrativa, pautas e o que o Pro faz, na ordem do que a pessoa pediu. "Ver planos" abre a janela de assinatura; depois dela, a pessoa volta ao chat de origem.
5. **Fora do chat:** um e-mail por semana com uma pauta ainda não mostrada, até as de amostra acabarem. É comunicação do serviço, sem plano nem preço: a política exige consentimento para marketing, e quem conecta pelo chat não deu esse consentimento. A oferta fica na página de chegada, para onde o e-mail leva.
6. **Só no Claude, e desligado até a aprovação:** a oferta na própria conexão (`MCP_CLAUDE_CONNECT_OFFER_ENABLED`), depois da narrativa e nunca antes dela.

## O que não se faz

- Tela de planos na conexão do ChatGPT.
- Plugin só para assinante: perderia a etapa 2, que é onde a pessoa descobre o valor.
- Preço, plano ou desconto dentro da conversa, nos dois chats. É a mesma regra do `conversationPolicy.ts`.

## Como medir

O uso diário de cada pessoa e os pedidos que chegam às ferramentas estão na seção "Medição de uso do conector" de [[MCP — ChatGPT e Claude]].


`npx tsx --env-file=.env.local scripts/pluginFunnelReport.ts`, só leitura. Contas conectadas antes de 26/09 só aparecem depois de `scripts/backfillPluginOrigin.ts --apply`, que também as coloca na fila do e-mail semanal.

## Ligações

[[MCP — ChatGPT e Claude]] · [[Landing e conversão]] · [[ChatGPT fora da landing]]
