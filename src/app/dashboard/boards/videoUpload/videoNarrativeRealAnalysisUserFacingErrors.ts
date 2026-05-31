export type VideoNarrativeRealAnalysisUserFacingErrorCode =
  | "usage_limit_reached"
  | "usage_cooldown_active"
  | "beta_access_required"
  | "storage_not_ready"
  | "storage_object_not_found"
  | "storage_download_failed"
  | "gemini_timeout"
  | "gemini_provider_unavailable"
  | "gemini_invalid_response"
  | "video_evidence_missing"
  | "snapshot_save_failed"
  | "cleanup_warning"
  | "unknown_error";

const USER_FACING_ERROR_MESSAGES: Record<VideoNarrativeRealAnalysisUserFacingErrorCode, string> = {
  usage_limit_reached: "Você atingiu o limite de análises reais do beta por hoje.",
  usage_cooldown_active: "Aguarde um pouco antes de tentar outra análise real.",
  beta_access_required: "A análise real de vídeo ainda está em beta fechado.",
  storage_not_ready: "Não conseguimos preparar o vídeo temporário para análise agora.",
  storage_object_not_found: "Não encontramos o vídeo temporário enviado. Tente enviar novamente.",
  storage_download_failed: "Não conseguimos ler o vídeo temporário agora. Tente novamente em alguns minutos.",
  gemini_timeout: "A análise demorou mais que o esperado. Tente novamente em alguns minutos.",
  gemini_provider_unavailable: "A análise real está temporariamente indisponível.",
  gemini_invalid_response: "Não conseguimos transformar a análise em um diagnóstico válido.",
  video_evidence_missing: "Não conseguimos encontrar evidências suficientes no vídeo. Tente enviar o vídeo novamente ou escolha outro conteúdo.",
  snapshot_save_failed: "A análise foi concluída, mas não conseguimos atualizar seu Perfil Estratégico agora.",
  cleanup_warning: "A análise foi concluída, mas a limpeza temporária ainda precisa ser confirmada.",
  unknown_error: "Não foi possível concluir a análise real agora.",
};

const ISSUE_CODE_MAP: Record<string, VideoNarrativeRealAnalysisUserFacingErrorCode> = {
  beta_limits_disabled: "beta_access_required",
  beta_access_required: "beta_access_required",
  gemini_user_not_allowed: "beta_access_required",
  gemini_allowlist_disabled: "beta_access_required",
  usage_limit_reached: "usage_limit_reached",
  daily_limit_reached: "usage_limit_reached",
  monthly_limit_reached: "usage_limit_reached",
  usage_cooldown_active: "usage_cooldown_active",
  provider_not_configured: "storage_not_ready",
  missing_storage_adapter: "storage_not_ready",
  object_not_found: "storage_object_not_found",
  object_too_large: "storage_not_ready",
  unsupported_mime_type: "storage_not_ready",
  download_failed: "storage_download_failed",
  gemini_provider_disabled: "gemini_provider_unavailable",
  gemini_provider_failed: "gemini_provider_unavailable",
  empty_response: "gemini_invalid_response",
  invalid_json: "gemini_invalid_response",
  missing_object: "gemini_invalid_response",
  missing_required_fields: "gemini_invalid_response",
  invalid_required_string: "gemini_invalid_response",
  invalid_required_array: "gemini_invalid_response",
  gemini_timeout: "gemini_timeout",
  gemini_invalid_response: "gemini_invalid_response",
  provider_invalid_response: "gemini_invalid_response",
  video_evidence_missing: "video_evidence_missing",
  snapshot_upsert_failed: "snapshot_save_failed",
  snapshot_save_failed: "snapshot_save_failed",
  cleanup_warning: "cleanup_warning",
};

export function resolveVideoNarrativeRealAnalysisUserFacingErrorCode(
  code?: string | null,
): VideoNarrativeRealAnalysisUserFacingErrorCode {
  if (!code) return "unknown_error";
  if (code in USER_FACING_ERROR_MESSAGES) return code as VideoNarrativeRealAnalysisUserFacingErrorCode;
  return ISSUE_CODE_MAP[code] ?? "unknown_error";
}

export function getVideoNarrativeRealAnalysisUserFacingMessage(
  code?: string | null,
): string {
  return USER_FACING_ERROR_MESSAGES[resolveVideoNarrativeRealAnalysisUserFacingErrorCode(code)];
}

export function getAllVideoNarrativeRealAnalysisUserFacingMessages(): Record<
  VideoNarrativeRealAnalysisUserFacingErrorCode,
  string
> {
  return { ...USER_FACING_ERROR_MESSAGES };
}
