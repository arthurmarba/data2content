# Plano de Flags & Microcopy — Sub-entrega 1

## Feature Flags Consideradas

| Flag                         | Ambiente alvo        | Estado na Sub-entrega 1 | Observações |
| --------------------------- | -------------------- | ----------------------- | ----------- |
| `nav.campaigns_focus`       | Staging → Production | **ON**                  | Reordena menu priorizando Campanhas logo após Dashboard. |
| `planning.group_locked`     | Todos                | **OFF**                 | Colapso do grupo PRO ficará para a Sub-entrega 2. |
| `nav.dashboard_minimal`     | Todos                | **OFF**                 | Mantém conteúdo atual até a revisão da Home na Etapa 2. |
| `modules.community_on_home` | Todos                | **ON**                  | Remoção da seção antiga acontecerá na Sub-etapa seguinte. |
| `paywall.modal_enabled`     | Todos                | **ON**                  | Mantém modal global; reuso no gating do Planejamento. |

## Navegação Básica (sem grupo PRO)

| Ordem | Chave de menu      | Label (PT-BR)    | Rota | Tooltips / subtítulo             | Público | Estado Sub-entrega 1 |
| ----- | ------------------ | ---------------- | ---- | -------------------------------- | ------- | -------------------- |
| 1     | `dashboard`        | Dashboard        | `/dashboard` | — | Free/PRO | Ativo |
| 2     | `campaigns`        | Campanhas        | `/campaigns` | “Propostas, Análise com IA e Respostas” | Free/PRO | Ativo |
| 3     | `mediaKit`         | Mídia Kit        | `/media-kit` | “Sua vitrine pública para marcas” | Free/PRO | Ativo |
| 4     | `pro`              | PRO              | `/pro` | “Desbloquear PRO” | Free/PRO | Ativo |
| 5     | `affiliates`       | Indique e Ganhe  | `/affiliates` | “Comissão por novas assinaturas” | Free/PRO | Ativo |
| 6     | `settings`         | Perfil & Ajuda   | `/settings` | “Configurações e suporte” | Free/PRO | Ativo |

Itens PRO colapsáveis (`planning`) serão adicionados apenas na Sub-entrega 2 com o cadeado e persistência por usuário.

## Microcopy Base (arquivo `navigationLabels.ts`)

```ts
export const navigationLabels = {
  dashboard: {
    menu: "Dashboard",
  },
  campaigns: {
    menu: "Campanhas",
    tooltip: "Propostas, Análise com IA e Respostas",
  },
  mediaKit: {
    menu: "Mídia Kit",
    tooltip: "Sua vitrine pública para marcas",
  },
  planning: {
    menu: "Planejamento (PRO)",
    tooltip: "Descoberta, Planner e WhatsApp IA",
  },
  pro: {
    menu: "PRO",
    tooltip: "Desbloquear PRO",
  },
  affiliates: {
    menu: "Indique e Ganhe",
    tooltip: "Comissão por novas assinaturas",
  },
  settings: {
    menu: "Perfil & Ajuda",
    tooltip: "Configurações e suporte",
  },
};
```

> Os textos acima alimentam tanto o menu quanto tooltips/botões contextuais e serão consumidos pelos componentes após a refatoração.
