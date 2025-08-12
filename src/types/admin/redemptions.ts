// src/types/admin/redemptions.ts

// Define os possíveis status de um pedido de resgate
export type RedemptionStatus =
  | 'requested'
  | 'paid'
  | 'rejected';

// Interface para os itens da lista de resgates na área de administração
export interface AdminRedemptionListItem {
  _id: string;
  user: { _id: string; name?: string; email?: string; profilePictureUrl?: string };
  amountCents: number;
  currency: string;
  status: RedemptionStatus;
  createdAt: Date | string;
  updatedAt?: Date | string;
  notes?: string;
}

// Interface para os parâmetros de query da API de listagem de resgates
export interface AdminRedemptionListParams {
  page?: number;
  limit?: number;
  search?: string; // Para buscar por nome/email do usuário, ID do resgate
  status?: RedemptionStatus | 'all'; // Para filtrar por status do resgate
  userId?: string; // Para filtrar resgates de um usuário específico
  minAmountCents?: number;
  maxAmountCents?: number;
  dateFrom?: string; // Data de início do período de solicitação
  dateTo?: string;   // Data de fim do período de solicitação
  sortBy?: keyof AdminRedemptionListItem | 'createdAt' | 'updatedAt'; // Campo para ordenação
  sortOrder?: 'asc' | 'desc';
}

// Interface para o payload da API ao atualizar o status de um resgate
export interface AdminRedemptionUpdateStatusPayload {
  status: RedemptionStatus;
  notes?: string; // Notas do admin sobre a mudança de status
  transactionId?: string; // ID da transação de pagamento, se aplicável
  // Outros campos relevantes para a atualização podem ser adicionados
}

// Constantes para as opções de status de resgate, úteis para UIs de filtro
export const REDEMPTION_STATUS_OPTIONS: ReadonlyArray<{ value: RedemptionStatus; label: string }> = [
  { value: 'requested', label: 'Em processamento' },
  { value: 'paid', label: 'Pago' },
  { value: 'rejected', label: 'Rejeitado' },
];
