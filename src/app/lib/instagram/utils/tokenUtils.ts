// src/app/lib/instagram/utils/tokenUtils.ts

/**
 * Verifica se um erro da API do Facebook/Instagram indica um token inválido ou expirado.
 *
 * @param errorCode - O código de erro numérico da API (error.code).
 * @param errorSubcode - O subcódigo de erro numérico da API (error.error_subcode).
 * @param errorMessage - A mensagem de erro da API (error.message).
 * @returns True se o erro for relacionado a um token inválido/expirado, false caso contrário.
 */
export function isTokenInvalidError(
    errorCode?: number,
    errorSubcode?: number,
    errorMessage?: string
  ): boolean {
    // Código de erro genérico para problemas de token/permissão
    if (errorCode === 190) {
      return true; // Ex: "Invalid OAuth 2.0 Access Token" ou "Error validating access token: Session has expired..."
    }
  
    // Subcódigos específicos de erro de token dentro do código 100 (Erro de parâmetro)
    if (errorCode === 100 && errorSubcode === 33) {
      // "This Page access token belongs to a Page that has been uninstalled" - Indica que o token não é mais válido para a página.
      return true;
    }
  
    // Subcódigos de erro de token mais específicos (OAuthException)
    // Referência: https://developers.facebook.com/docs/graph-api/overview/access-tokens/#errors
    if (
      errorSubcode === 458 || // App not authorized for user in story.
      errorSubcode === 459 || // Session has expired.
      errorSubcode === 460 || // Session key or secret is invalid.
      errorSubcode === 463 || // Session has been invalidated because the user changed their password.
      errorSubcode === 464 || // User has not authorized the application.
      errorSubcode === 467    // Session has been invalidated because the user has logged out.
    ) {
      return true;
    }
  
    // Verificação baseada em mensagens de erro comuns, caso os códigos não sejam suficientes
    if (errorMessage) {
      const lowerMessage = errorMessage.toLowerCase();
      if (
        lowerMessage.includes("token is invalid") ||
        lowerMessage.includes("session has been invalidated") ||
        lowerMessage.includes("access token is invalid") ||
        lowerMessage.includes("error validating access token") || // Comum para tokens expirados
        lowerMessage.includes("the user has not authorized application") || // Permissões revogadas
        lowerMessage.includes("permissions are not available") // Pode indicar problema de token/permissão
      ) {
        return true;
      }
    }
  
    return false;
  }
  
  // Poderiam ser adicionadas outras funções utilitárias relacionadas a tokens aqui, se necessário.
  // Por exemplo, uma função para verificar se um token está prestes a expirar (se a data de expiração for conhecida).
  
  