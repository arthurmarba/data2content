// src/app/dashboard/components/types.ts

export interface Filtros {
    periodos?: string[];       // Ex: ["7", "30", "60", "200"]
    conteudo?: string;         // Ex: "reels até 15s"
    // Adicione outros filtros conforme necessário
  }
  
  export interface DashboardPayload {
    visao: string;
    missao: string;
    objetivos: string[];       // Lista de tags ou objetivos
    filtros?: Filtros;
    // Mantemos também os campos antigos, se necessário:
    metrics?: Record<string, number | string>;
    question?: string;
  }
  
  // Interface para o retorno da IA (customData)
  export interface CustomData {
    metrics: Record<string, number | string>;
    recommendations: Record<string, string>;
    summary: string;
    indicators: Indicator[];
  }
  
  export interface Indicator {
    id: string;                // Identificador único para o indicador
    title: string;
    value: number | string;
    description: string;
    // Você pode incluir outras propriedades para configuração gráfica se precisar
  }
  