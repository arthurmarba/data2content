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
    menu: "Planejamento",
    tooltip: "Organize seu conteúdo com IA",
  },
  planningDiscover: {
    menu: "Descoberta",
    tooltip: "Monitore formatos e temas em alta",
  },
  planningChat: {
    menu: "Chat IA",
    tooltip: "Peça análises e pautas dentro do Planejamento",
  },
  planningCharts: {
    menu: "Gráficos",
    tooltip: "Visualize interações e benchmarks com IA",
  },
  planningPlanner: {
    menu: "Calendário",
    tooltip: "Monte seu calendário com IA",
  },
  pro: {
    menu: "Plano Agência",
    tooltip: "Desbloquear Plano Agência",
  },
  affiliates: {
    menu: "Ganhe até R$300",
    tooltip: "Comissão por novas assinaturas",
  },
  settings: {
    menu: "Perfil & Ajuda",
    tooltip: "Configurações e suporte",
  },
} as const;

export type NavigationLabelKey = keyof typeof navigationLabels;
