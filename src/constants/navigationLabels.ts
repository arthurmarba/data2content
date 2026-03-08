export const navigationLabels = {
  dashboard: {
    menu: "Saguão da Agência",
  },
  campaigns: {
    menu: "Gestão de Publi",
    tooltip: "Suas propostas e análise de perfil para marcas",
  },
  mediaKit: {
    menu: "Mídia Kit",
    tooltip: "Sua vitrine pública para marcas",
  },
  planning: {
    menu: "Seu Diagnóstico (IA)",
    tooltip: "Dados preparados para sua próxima reunião",
  },
  planningDiscover: {
    menu: "Descoberta",
    tooltip: "Referências do mercado preparadas pela IA",
  },
  planningChat: {
    menu: "Central de Suporte (IA)",
    tooltip: "Converse com seu assistente para ajustes rápidos",
  },
  planningCharts: {
    menu: "Análise de Perfil",
    tooltip: "Seus resultados comparados com o mercado",
  },
  planningPlanner: {
    menu: "Planejamento",
    tooltip: "Sugestões da IA para seus próximos posts",
  },
  planningScripts: {
    menu: "Meus Roteiros",
    tooltip: "Traga para a revisão de terças-feiras",
  },
  pro: {
    menu: "Acesso à Consultoria",
    tooltip: "Desbloquear o Acesso VIP",
  },
  affiliates: {
    menu: "Programa de Indicação",
    tooltip: "Convide colegas",
  },
  settings: {
    menu: "Perfil & Ajuda",
    tooltip: "Configurações e suporte",
  },
} as const;

export type NavigationLabelKey = keyof typeof navigationLabels;
