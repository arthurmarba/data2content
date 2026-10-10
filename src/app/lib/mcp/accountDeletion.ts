import { Types, type ClientSession } from "mongoose";
import McpOAuthAuthorizationCodeModel from "@/app/models/McpOAuthAuthorizationCode";
import McpOAuthConsentRequestModel from "@/app/models/McpOAuthConsentRequest";
import McpOAuthRefreshTokenModel from "@/app/models/McpOAuthRefreshToken";
import McpToolCallLogModel from "@/app/models/McpToolCallLog";
import McpUsageDailyModel from "@/app/models/McpUsageDaily";
import ScriptEvidenceSessionModel from "@/app/models/ScriptEvidenceSession";

export interface McpAccountDeletionResult {
  refreshTokens: number;
  authorizationCodes: number;
  consentRequests: number;
  toolCallLogs: number;
  usageDays: number;
  scriptEvidenceSessions: number;
}

/**
 * Apaga tudo o que o conector guarda de uma conta: as conexões com o Claude e o
 * ChatGPT, os logins pela metade, os registros de uso e as sessões de roteiro.
 *
 * Antes, apagar a conta deixava a conexão viva no banco até expirar e os registros
 * de uso por 90 dias e 12 meses, embora a política de privacidade prometa que eles
 * "são excluídos junto com a sua conta". Chame na mesma transação que apaga o User.
 *
 * Em sequência de propósito: operações paralelas na mesma sessão de transação
 * não são suportadas pelo MongoDB.
 */
export async function deleteMcpDataForUser(
  userId: Types.ObjectId | string,
  session?: ClientSession,
): Promise<McpAccountDeletionResult> {
  const filter = { userId: typeof userId === "string" ? new Types.ObjectId(userId) : userId };
  const options = session ? { session } : {};
  const deleted = (result: { deletedCount?: number }) => result.deletedCount ?? 0;

  const refreshTokens = deleted(await McpOAuthRefreshTokenModel.deleteMany(filter, options));
  const authorizationCodes = deleted(await McpOAuthAuthorizationCodeModel.deleteMany(filter, options));
  const consentRequests = deleted(await McpOAuthConsentRequestModel.deleteMany(filter, options));
  const toolCallLogs = deleted(await McpToolCallLogModel.deleteMany(filter, options));
  const usageDays = deleted(await McpUsageDailyModel.deleteMany(filter, options));
  const scriptEvidenceSessions = deleted(await ScriptEvidenceSessionModel.deleteMany(filter, options));
  return { refreshTokens, authorizationCodes, consentRequests, toolCallLogs, usageDays, scriptEvidenceSessions };
}
