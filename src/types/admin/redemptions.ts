// src/types/admin/redemptions.ts

// Define os possíveis status de um pedido de resgate
export type RedemptionStatus =
  | 'pending'       // Solicitação recebida, aguardando aprovação
  | 'approved'      // Solicitação aprovada, aguardando pagamento
  | 'rejected'      // Solicitação rejeitada pelo admin
  | 'processing'    // Pagamento em processamento (ex: enviado para gateway)
  | 'paid'          // Pagamento concluído com sucesso
  | 'failed'        // Pagamento falhou
  | 'cancelled';    // Solicitação cancelada pelo usuário (se aplicável)

// Interface para os itens da lista de resgates na área de administração
export interface AdminRedemptionListItem {
  _id: string; // ID do resgate
  userId: string; // ID do usuário que solicitou (referência ao UserModel)
  userName: string; // Nome do usuário (para exibição fácil)
  userEmail: string; // Email do usuário (para contato/identificação)

  amount: number; // Valor do resgate
  currency: string; // Moeda (ex: 'BRL', 'USD')

  status: RedemptionStatus;

  requestedAt: Date | string; // Data da solicitação
  updatedAt?: Date | string; // Data da última atualização de status

  paymentMethod?: string; // Método de pagamento preferido (ex: 'PIX', 'BankTransfer')
  paymentDetails?: Record<string, any>; // Detalhes específicos do método (ex: chave PIX, dados bancários) - pode ser genérico

  adminNotes?: string; // Notas internas do administrador
}

// Interface para os parâmetros de query da API de listagem de resgates
export interface AdminRedemptionListParams {
  page?: number;
  limit?: number;
  search?: string; // Para buscar por nome/email do usuário, ID do resgate
  status?: RedemptionStatus; // Para filtrar por status do resgate
  userId?: string; // Para filtrar resgates de um usuário específico
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string; // Data de início do período de solicitação
  dateTo?: string;   // Data de fim do período de solicitação
  sortBy?: keyof AdminRedemptionListItem | string; // Campo para ordenação
  sortOrder?: 'asc' | 'desc';
}

// Interface para o payload da API ao atualizar o status de um resgate
export interface AdminRedemptionUpdateStatusPayload {
  status: RedemptionStatus;
  adminNotes?: string; // Notas do admin sobre a mudança de status
  transactionId?: string; // ID da transação de pagamento, se aplicável
  // Outros campos relevantes para a atualização podem ser adicionados
}

// Constantes para as opções de status de resgate, úteis para UIs de filtro
export const REDEMPTION_STATUS_OPTIONS: ReadonlyArray<{ value: RedemptionStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'approved', label: 'Aprovado (Aguardando Pagamento)' },
  { value: 'rejected', label: 'Rejeitado' },
  { value: 'processing', label: 'Processando Pagamento' },
  { value: 'paid', label: 'Pago' },
  { value: 'failed', label: 'Falhou' },
  { value: 'cancelled', label: 'Cancelado' },
];
