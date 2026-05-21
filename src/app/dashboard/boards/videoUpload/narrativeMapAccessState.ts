export type NarrativeMapAccessState =
  | "free_unused"
  | "free_preview_used"
  | "pro_needs_instagram"
  | "pro_instagram_connected"
  | "pro_quota_reached"
  | "payment_pending"
  | "payment_action_needed"
  | "admin";

export type NarrativeMapPostCheckoutIntent = "connect_instagram" | "join_community";

export interface NarrativeMapReadingQuotaSnapshot {
  userId?: string | null;
  monthKey: string;
  usedTotal: number;
  usedThisMonth: number;
  freeTotalLimit: 1;
  proMonthlyLimit: 10;
}

export interface ResolveNarrativeMapAccessStateInput {
  hasPremiumAccess?: boolean | null;
  hasFullReportAccess?: boolean | null;
  needsCheckout?: boolean | null;
  needsPaymentAction?: boolean | null;
  needsBilling?: boolean | null;
  needsPaymentUpdate?: boolean | null;
  nextAction?: string | null;
  isAdmin?: boolean | null;
  instagram?: {
    connected?: boolean | null;
    needsReconnect?: boolean | null;
  } | null;
  readingQuota?: Partial<NarrativeMapReadingQuotaSnapshot> | null;
}

export interface NarrativeMapAccessAction {
  canStartReading: boolean;
  label: string;
  reason:
    | "free_first_reading_available"
    | "free_reading_used"
    | "pro_instagram_pending"
    | "pro_quota_available"
    | "pro_quota_reached"
    | "payment_pending"
    | "payment_action_needed"
    | "admin";
}

function normalizeCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

export function getCurrentNarrativeMapMonthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function createEmptyNarrativeMapReadingQuotaSnapshot(params: {
  userId?: string | null;
  now?: Date;
} = {}): NarrativeMapReadingQuotaSnapshot {
  return {
    userId: params.userId ?? null,
    monthKey: getCurrentNarrativeMapMonthKey(params.now ?? new Date()),
    usedTotal: 0,
    usedThisMonth: 0,
    freeTotalLimit: 1,
    proMonthlyLimit: 10,
  };
}

export function normalizeNarrativeMapReadingQuotaSnapshot(
  quota?: Partial<NarrativeMapReadingQuotaSnapshot> | null,
): NarrativeMapReadingQuotaSnapshot {
  const empty = createEmptyNarrativeMapReadingQuotaSnapshot({ userId: quota?.userId ?? null });
  return {
    ...empty,
    ...quota,
    usedTotal: normalizeCount(quota?.usedTotal),
    usedThisMonth: normalizeCount(quota?.usedThisMonth),
    freeTotalLimit: 1,
    proMonthlyLimit: 10,
  };
}

export function resolveNarrativeMapAccessState(
  input: ResolveNarrativeMapAccessStateInput,
): NarrativeMapAccessState {
  if (input.isAdmin) return "admin";

  if (input.needsCheckout) return "payment_pending";
  if (input.needsPaymentAction || input.needsPaymentUpdate || input.needsBilling) {
    return "payment_action_needed";
  }

  const quota = normalizeNarrativeMapReadingQuotaSnapshot(input.readingQuota);
  const hasPro = Boolean(input.hasPremiumAccess || input.hasFullReportAccess);

  if (!hasPro) {
    return quota.usedTotal >= quota.freeTotalLimit ? "free_preview_used" : "free_unused";
  }

  if (quota.usedThisMonth >= quota.proMonthlyLimit) return "pro_quota_reached";

  const instagramConnected = Boolean(input.instagram?.connected) && !input.instagram?.needsReconnect;
  return instagramConnected ? "pro_instagram_connected" : "pro_needs_instagram";
}

export function getNarrativeMapAccessAction(
  state: NarrativeMapAccessState,
): NarrativeMapAccessAction {
  switch (state) {
    case "free_unused":
      return {
        canStartReading: true,
        label: "Analisar vídeo",
        reason: "free_first_reading_available",
      };
    case "free_preview_used":
      return {
        canStartReading: false,
        label: "Assinar Pro",
        reason: "free_reading_used",
      };
    case "pro_needs_instagram":
      return {
        canStartReading: true,
        label: "Conectar Instagram",
        reason: "pro_instagram_pending",
      };
    case "pro_instagram_connected":
      return {
        canStartReading: true,
        label: "Nova leitura",
        reason: "pro_quota_available",
      };
    case "pro_quota_reached":
      return {
        canStartReading: false,
        label: "Ver Perfil",
        reason: "pro_quota_reached",
      };
    case "payment_pending":
      return {
        canStartReading: false,
        label: "Continuar pagamento",
        reason: "payment_pending",
      };
    case "payment_action_needed":
      return {
        canStartReading: false,
        label: "Atualizar pagamento",
        reason: "payment_action_needed",
      };
    case "admin":
      return {
        canStartReading: true,
        label: "Nova leitura",
        reason: "admin",
      };
  }
}

export function getNarrativeMapAccessStatusText(params: {
  state: NarrativeMapAccessState;
  quota?: Partial<NarrativeMapReadingQuotaSnapshot> | null;
}): string {
  const quota = normalizeNarrativeMapReadingQuotaSnapshot(params.quota);
  switch (params.state) {
    case "free_unused":
      return "1 leitura grátis disponível";
    case "free_preview_used":
      return "Leitura grátis usada";
    case "pro_needs_instagram":
      return "Pro ativo · Instagram pendente";
    case "pro_instagram_connected":
      return `Pro ativo · ${quota.usedThisMonth}/10 leituras`;
    case "pro_quota_reached":
      return "10/10 leituras usadas";
    case "payment_pending":
      return "Pagamento pendente";
    case "payment_action_needed":
      return "Ação de pagamento necessária";
    case "admin":
      return `Admin · ${quota.usedThisMonth}/10 leituras`;
  }
}

export function sanitizeInternalReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return fallback;
}
