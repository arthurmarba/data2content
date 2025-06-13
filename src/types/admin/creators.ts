// src/types/admin/creators.ts

// Define os possíveis status de um criador no contexto de admin
export type AdminCreatorStatus = 'pending' | 'approved' | 'rejected' | 'active'; // 'active' pode ser um sinônimo de 'approved' ou um estado pós-aprovação.

// Interface para os itens da lista de criadores na área de administração
export interface AdminCreatorListItem {
  _id: string; // Geralmente o ID do MongoDB como string
  name: string;
  email: string;
  planStatus?: string; // Status do plano (ex: 'Free', 'Pro', 'Trial') - vindo do UserModel
  inferredExpertiseLevel?: string; // Nível de expertise inferido - vindo do UserModel
  profilePictureUrl?: string; // URL da foto de perfil

  totalPostsInPeriod?: number; // Número de posts no período filtrado (se aplicável ao contexto da lista)
  lastActivityDate?: Date | string; // Data da última atividade (post)

  adminStatus: AdminCreatorStatus; // Status de aprovação/gerenciamento pelo admin
  registrationDate: Date | string; // Data de quando o usuário se registrou

  // Outros campos que podem ser úteis para a listagem de admin:
  // totalFollowers?: number;
  // isVerified?: boolean;
}

// Interface para os parâmetros de query da API de listagem de criadores
export interface AdminCreatorListParams {
  page?: number;
  limit?: number;
  search?: string; // Para buscar por nome, email, etc.
  status?: AdminCreatorStatus; // Para filtrar por status de admin
  planStatus?: string; // Para filtrar por status do plano
  sortBy?: keyof AdminCreatorListItem | string; // Campo para ordenação
  sortOrder?: 'asc' | 'desc';
  // Adicionar startDate e endDate se a lista principal de gerenciamento de criadores for filtrável por data
  // Embora as métricas como totalPostsInPeriod possam depender de um filtro de data global do dashboard.
}

// Interface para o payload da API ao atualizar o status de um criador
export interface AdminCreatorUpdateStatusPayload {
  status: AdminCreatorStatus;
  feedback?: string; // Opcional: um motivo ou feedback para a mudança de status
}

// Se houver constantes relacionadas, como opções de filtro, elas podem ser adicionadas aqui também.
// Exemplo:
// export const ADMIN_CREATOR_STATUS_OPTIONS: AdminCreatorStatus[] = ['pending', 'approved', 'rejected', 'active'];
