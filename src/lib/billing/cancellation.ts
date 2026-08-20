import type Stripe from "stripe";

export const CANCELLATION_REASONS = [
  "Preço muito alto",
  "Não uso o suficiente",
  "Falta de funcionalidades",
  "Encontrei outra solução",
  "Dificuldade de uso",
  "Suporte insatisfatório",
  "Muitos erros / Bugs",
  "Mudança de estratégia",
  "Projeto temporário / Sazonal",
  "Outro",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const MIN_CANCELLATION_COMMENT_LENGTH = 10;
export const MAX_CANCELLATION_COMMENT_LENGTH = 500;

const reasonSet = new Set<string>(CANCELLATION_REASONS);

const STRIPE_FEEDBACK_BY_REASON: Record<
  CancellationReason,
  Stripe.SubscriptionUpdateParams.CancellationDetails.Feedback
> = {
  "Preço muito alto": "too_expensive",
  "Não uso o suficiente": "unused",
  "Falta de funcionalidades": "missing_features",
  "Encontrei outra solução": "switched_service",
  "Dificuldade de uso": "too_complex",
  "Suporte insatisfatório": "customer_service",
  "Muitos erros / Bugs": "low_quality",
  "Mudança de estratégia": "other",
  "Projeto temporário / Sazonal": "other",
  Outro: "other",
};

export type ValidCancellationRequest = {
  reasons: CancellationReason[];
  comment: string;
  stripeFeedback: Stripe.SubscriptionUpdateParams.CancellationDetails.Feedback;
};

export type CancellationValidationResult =
  | { ok: true; value: ValidCancellationRequest }
  | { ok: false; message: string };

export function validateCancellationRequest(input: unknown): CancellationValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Informe o motivo e a justificativa do cancelamento." };
  }

  const body = input as { reasons?: unknown; comment?: unknown };
  if (!Array.isArray(body.reasons) || body.reasons.length === 0) {
    return { ok: false, message: "Selecione pelo menos um motivo de cancelamento." };
  }

  const reasons = [...new Set(body.reasons)] as unknown[];
  if (
    reasons.some(
      (reason) => typeof reason !== "string" || !reasonSet.has(reason),
    )
  ) {
    return { ok: false, message: "Um ou mais motivos de cancelamento são inválidos." };
  }

  if (typeof body.comment !== "string") {
    return { ok: false, message: "Escreva uma justificativa para o cancelamento." };
  }

  const comment = body.comment.trim();
  if (comment.length < MIN_CANCELLATION_COMMENT_LENGTH) {
    return {
      ok: false,
      message: `A justificativa deve ter pelo menos ${MIN_CANCELLATION_COMMENT_LENGTH} caracteres.`,
    };
  }
  if (comment.length > MAX_CANCELLATION_COMMENT_LENGTH) {
    return {
      ok: false,
      message: `A justificativa deve ter no máximo ${MAX_CANCELLATION_COMMENT_LENGTH} caracteres.`,
    };
  }

  const typedReasons = reasons as CancellationReason[];
  return {
    ok: true,
    value: {
      reasons: typedReasons,
      comment,
      stripeFeedback: STRIPE_FEEDBACK_BY_REASON[typedReasons[0]!],
    },
  };
}
