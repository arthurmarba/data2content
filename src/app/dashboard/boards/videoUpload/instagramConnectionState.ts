// src/app/dashboard/boards/videoUpload/instagramConnectionState.ts
//
// Saúde da conexão com o Instagram para o Perfil.
//
// O booleano `isInstagramConnected` não basta: o token do Instagram vence sozinho
// e a conta continua marcada como conectada. Sem este estado, o relatório
// simplesmente para de atualizar e o criador só descobre semanas depois — por
// isso o campo de próximo passo precisa distinguir "conectado" de "caiu".

export type InstagramConnectionState = "connected" | "expired" | "disconnected";

interface InstagramConnectionInput {
  instagramConnected?: boolean | null;
  isInstagramConnected?: boolean | null;
  instagramAccessToken?: string | null;
  instagramAccessTokenExpiresAt?: Date | string | null;
  instagramSyncErrorMsg?: string | null;
}

function isExpired(value: Date | string | null | undefined): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

export function resolveInstagramConnectionState(
  user: InstagramConnectionInput | null | undefined,
): InstagramConnectionState {
  const connected = Boolean(user?.isInstagramConnected ?? user?.instagramConnected);
  if (!connected) return "disconnected";

  // Token vencido, token ausente ou última sincronização com erro: a conta está
  // ligada no papel mas não entrega dado novo. Para o criador é a mesma coisa.
  if (isExpired(user?.instagramAccessTokenExpiresAt)) return "expired";
  if (user?.instagramAccessToken === null || user?.instagramAccessToken === "") return "expired";
  if (typeof user?.instagramSyncErrorMsg === "string" && user.instagramSyncErrorMsg.trim().length > 0) {
    return "expired";
  }

  return "connected";
}
