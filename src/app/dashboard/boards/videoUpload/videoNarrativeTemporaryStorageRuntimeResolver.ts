export type VideoNarrativeTemporaryStorageRuntimeResolverStatus =
  | "ready"
  | "missing_storage_adapter"
  | "missing_signed_download"
  | "provider_not_configured"
  | "unsupported_provider";

export type VideoNarrativeTemporaryStorageRuntimeResolverIssue = {
  code: string;
  message: string;
};

export type VideoNarrativeTemporaryStorageRuntimeResolverResult = {
  ok: boolean;
  status: VideoNarrativeTemporaryStorageRuntimeResolverStatus;
  safeMessage: string;
  issues: VideoNarrativeTemporaryStorageRuntimeResolverIssue[];
};

export type VideoNarrativeTemporaryStorageRuntimeResolverInput = {
  uploadSessionId?: string | null;
  objectKey?: string | null;
  mimeType?: string | null;
};

export function resolveVideoNarrativeTemporaryStorageObject(
  _input: VideoNarrativeTemporaryStorageRuntimeResolverInput
): VideoNarrativeTemporaryStorageRuntimeResolverResult {
  // Atualmente o projeto não possui o SDK da AWS/Cloudflare configurado para gerar
  // links assinados de leitura (signed downloads) ou para buscar o buffer do objeto.
  // Portanto, a auditoria retorna corretamente que o adapter de storage está ausente.
  
  return {
    ok: false,
    status: "missing_storage_adapter",
    safeMessage: "A análise real ainda precisa da conexão temporária de storage para ler o vídeo.",
    issues: [
      {
        code: "storage_sdk_not_implemented",
        message: "O SDK de storage necessário para resolver o objectKey não está configurado."
      }
    ]
  };
}
