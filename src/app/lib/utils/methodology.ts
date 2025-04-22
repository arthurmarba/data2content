// @/app/lib/utils/methodology.ts
// Utilitário central para armazenar as regras da metodologia do consultor

/**
 * Retorna as regras principais da metodologia para injeção nos prompts de IA.
 */
export function getMethodologyFlags(): string {
    return `Regras de Metodologia:
  1. Priorize compartilhamentos e retenção média de Reels para expansão de alcance.
  2. Sugira formatos apenas se mostrados eficientes nos dados do usuário, usando linguagem condicional.
  3. Enfatize qualidade e espaçamento estratégico entre posts (evitar canibalização).`;
  }
  