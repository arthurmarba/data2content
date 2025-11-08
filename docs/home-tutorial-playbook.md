# Home Tutorial — Guia rápido para CS/Produto

A nova Home minimalista (flag `home.tutorial_minimal`) mostra dois blocos:

1. **Tutorial de Progresso** – etapas rumo à monetização.
2. **Ferramentas do Criador** – atalhos para os recursos mais usados.

Use este guia para explicar aos criadores o que ver em cada estágio.

## Estados do Tutorial

| Etapa | Quando completa | CTA padrão | Observações |
| --- | --- | --- | --- |
| Conecte seu Instagram | Conta conectada (dashboard/instagram) | “Conectar” | Sem conexão não mostramos as demais ferramentas. |
| Gere seu Mídia Kit | Kit criado (dashboard/media-kit) | “Gerar Mídia Kit” | Ao concluir, CTA secundário “Ver Mídia Kit”. |
| Coloque o link na bio | Há acessos (views últimos 7 dias) ou propostas vindas do kit | “Configurar link” | CTA concluído copia o link atualizado. |
| Ative o PRO | `plan.hasPremiumAccess` verdadeiro | “Ativar PRO” | Se já for PRO, exibimos badge “PRO ativo”. |

Mensagens dinâmicas:
- 0–2 etapas: “Você está a poucos passos…”
- 3/4 etapas: “🚀 Falta pouco…”
- 4/4 etapas: “✅ Parabéns! …”

## Ferramentas & Gating

| Card | Quem vê desbloqueado | Ação Free | Ação PRO |
| --- | --- | --- | --- |
| Campanhas | Todos | Abre `/dashboard/proposals`. | Igual |
| Mídia Kit | Todos | Abre/cria o kit. | Igual |
| Calculadora PRO | Apenas PRO | Free: abre paywall (context `calculator`). | PRO: abre `/dashboard/calculator`. |
| Planner PRO | Apenas PRO | Free: paywall (`planning`). | PRO: abre `/planning/planner`. |
| IA WhatsApp PRO | Apenas PRO | Free: paywall (`whatsapp`). | PRO sem link: abre fluxo de conexão; linkado: abre wa.me. |
| Indique e Ganhe | Todos | `/afiliados`. | Igual |

Regras adicionais:
- Se o Instagram não estiver conectado, os cards aparecem desabilitados com aviso.
- Clique em qualquer CTA bloqueado aciona o modal de assinatura e armazena `context` para facilitar o retorno pós-checkout.

## Como ativar

- A partir de agora a flag vem ligada por padrão em todos os ambientes (fallback em `DEFAULT_FEATURE_FLAGS`).
- Se precisar desativar temporariamente, use `PATCH /api/feature-flags` passando `{ "key": "home.tutorial_minimal", "enabled": false }` (opcionalmente com `env` para um ambiente específico).

## Checklist de QA rápido

1. Usuário totalmente novo → vê apenas tutorial, cards bloqueados.
2. IG conectado e plano Free → 2 etapas concluídas, cards PRO com cadeado.
3. PRO ativo → 4/4 etapas concluídas, todos os atalhos liberados.
4. CTA “Conectar WhatsApp” dispara `open-subscribe-modal` com contexto `whatsapp` se não for PRO.
