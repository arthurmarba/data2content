// src/types/admin/affiliates.ts

// Define os possíveis status de um afiliado no contexto de admin
export type AdminAffiliateStatus = 'pending_approval' | 'active' | 'inactive' | 'suspended';

// Interface para os itens da lista de afiliados na área de administração
export interface AdminAffiliateListItem {
  userId: string; // ID do usuário (foreign key para UserModel)
  name: string;
  email: string;
  profilePictureUrl?: string;

  affiliateCode?: string;
  affiliateStatus: AdminAffiliateStatus;

  registrationDate?: Date | string; // Data de registro do usuário
  affiliateSince?: Date | string; // Data em que se tornou afiliado

  totalInvites?: number; // Número total de usuários convidados/referidos
  totalEarnings?: number; // Ganhos totais acumulados como afiliado
  currentBalance?: number; // Saldo atual disponível para resgate

  // Outros campos que podem ser úteis:
  // lastInviteDate?: Date | string;
  // lastEarningDate?: Date | string;
}

// Interface para os parâmetros de query da API de listagem de afiliados
export interface AdminAffiliateListParams {
  page?: number;
  limit?: number;
  search?: string; // Para buscar por nome, email, ou código de afiliado
  status?: AdminAffiliateStatus; // Para filtrar por status de afiliado
  sortBy?: keyof AdminAffiliateListItem | string; // Campo para ordenação
  sortOrder?: 'asc' | 'desc';
  // Adicionar filtros de data se relevante (ex: 'afiliado desde', 'último ganho')
}

// Interface para o payload da API ao atualizar o status de um afiliado
export interface AdminAffiliateUpdateStatusPayload {
  status: AdminAffiliateStatus;
  reason?: string; // Opcional: um motivo para a mudança de status (ex: suspensão)
}

// Constantes relacionadas a status de afiliados, se necessário
export const ADMIN_AFFILIATE_STATUS_OPTIONS: ReadonlyArray<{ value: AdminAffiliateStatus; label: string }> = [
  { value: 'pending_approval', label: 'Pendente Aprovação' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'suspended', label: 'Suspenso' },
];
