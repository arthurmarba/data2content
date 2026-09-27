// A pessoa já conectou a Data2Content ao Claude?
//
// O Perfil precisa saber para escolher o gancho do diagnóstico: quem já tem o
// conector ganha "Continuar no Claude"; quem não tem ganha o passo a passo da
// conexão no mesmo lugar. A fonte é a autorização do conector — um token de
// renovação ativo emitido para um cliente registrado como Claude — e não o uso:
// conectado e ainda sem conversa também conta.

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import McpOAuthClientModel from "@/app/models/McpOAuthClient";
import McpOAuthRefreshTokenModel from "@/app/models/McpOAuthRefreshToken";
import { surfaceFromClientRegistration } from "./clientSurface";

export interface ClaudeConnectionStatus {
  connected: boolean;
}

export async function getClaudeConnectionStatus(
  userId: string,
  now: Date = new Date(),
): Promise<ClaudeConnectionStatus> {
  if (!Types.ObjectId.isValid(userId)) return { connected: false };
  await connectToDatabase();
  const clientIds = await McpOAuthRefreshTokenModel.distinct("clientId", {
    userId: new Types.ObjectId(userId),
    revokedAt: null,
    expiresAt: { $gt: now },
  });
  if (clientIds.length === 0) return { connected: false };
  const registrations = await McpOAuthClientModel.find({ clientId: { $in: clientIds } })
    .select("clientName redirectUris")
    .lean<Array<{ clientName?: string; redirectUris?: string[] }>>();
  return { connected: registrations.some((registration) => surfaceFromClientRegistration(registration) === "claude") };
}
