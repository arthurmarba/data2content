export const emptyStates = {
  campaigns: {
    title: "Sem propostas por aqui (ainda)",
    description: "Para responder pela plataforma e negociar com IA, ative o PRO.",
    ctaLabel: "Copiar link do Mídia Kit",
  },
  mediaKit: {
    title: "Crie seu Mídia Kit em 2 minutos",
    description: "Mostre seu valor com dados sempre atualizados antes das marcas perguntarem.",
    ctaLabel: "Começar agora",
  },
  planning: {
    title: "Planejamento é PRO",
    bullets: [
      "Descoberta de tendências",
      "Planner com IA",
      "IA no WhatsApp",
    ],
    ctaLabel: "Desbloquear PRO",
  },
} as const;
export type EmptyStateKey = keyof typeof emptyStates;
