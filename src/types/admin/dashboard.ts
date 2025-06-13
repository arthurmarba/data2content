// src/types/admin/dashboard.ts

// Interface para um item de KPI individual
export interface AdminDashboardKpi {
  id: string; // Identificador único para o KPI (ex: 'totalCreators', 'pendingCreators')
  label: string; // Rótulo amigável para exibição (ex: 'Total de Criadores')
  value: number | string; // O valor do KPI (pode ser número ou string formatada)
  unit?: string; // Unidade opcional (ex: 'R$', '%')
  // Poderíamos adicionar mais campos no futuro, como:
  // trend?: 'up' | 'down' | 'neutral';
  // trendValue?: string;
  // linkTo?: string; // Para onde o card do KPI pode levar ao clicar
  // icon?: React.ElementType; // Se quisermos ícones específicos por KPI
}

// Interface para o conjunto de dados de resumo do dashboard admin
// As chaves aqui devem corresponder aos 'id's dos AdminDashboardKpi
export interface AdminDashboardSummaryData {
  totalCreators?: AdminDashboardKpi;
  pendingCreators?: AdminDashboardKpi;
  activeAffiliates?: AdminDashboardKpi;
  // Adicionar mais KPIs conforme necessário
  // Exemplo:
  // totalRedemptionsPending?: AdminDashboardKpi;
  // totalRevenueLast30Days?: AdminDashboardKpi;
}

// Pode-se definir tipos mais específicos se a API retornar os KPIs nomeados diretamente
// Exemplo:
// export interface AdminDashboardKpiSet {
//   totalCreators: number;
//   pendingCreators: number;
//   activeAffiliates: number;
// }
// E então uma função no frontend transformaria isso em AdminDashboardKpi[] se necessário para renderização genérica.
// Por enquanto, AdminDashboardSummaryData com objetos AdminDashboardKpi aninhados oferece boa estrutura.
