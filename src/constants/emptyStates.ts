export const emptyStates = {
  campaigns: {
    title: "Sem propostas por aqui (ainda)",
    description: "Para responder pela plataforma e negociar com IA, ative o Plano Agência.",
    ctaLabel: "Copiar link do Mídia Kit",
  },
  mediaKit: {
    title: "Crie seu Mídia Kit em 2 minutos",
    description: "Mostre seu valor com dados sempre atualizados antes das marcas perguntarem.",
    ctaLabel: "Começar agora",
  },
  planning: {
    title: "Planejamento faz parte do Plano Agência",
    bullets: [
      "Descoberta de tendências",
      "Planner com IA",
      "Alertas no WhatsApp",
    ],
    ctaLabel: "Desbloquear Plano Agência",
  },
} as const;
export type EmptyStateKey = keyof typeof emptyStates;
