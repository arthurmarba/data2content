import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorStrategicProfileSnapshot from "@/app/models/CreatorStrategicProfileSnapshot";
import type {
  MobileStrategicProfileSnapshotPayload,
  CreatorStrategicProfileSnapshotInput,
} from "./mobileStrategicProfileSnapshotTypes";
import { Types } from "mongoose";

// Regex para validação de segurança
const BASE64_REGEX = /data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,[a-zA-Z0-9+/=]+/i;
const GEMINI_KEY_REGEX = /AIzaSy[A-Za-z0-9-_]{30,40}/;
const OPENAI_KEY_REGEX = /sk-[A-Za-z0-9]{32,}/;
const SIGNED_URL_REGEX = /(signature|expires|token|policy)=[A-Za-z0-9-_%.]+/i;
const VIDEO_EXTENSION_REGEX = /\.(mp4|quicktime|mov|webm|avi|mkv|flv|wmv)/i;

/**
 * Valida a carga útil do snapshot estratégico com regras rígidas de segurança e escopo.
 */
export function validateSnapshotPayload(payload: unknown): MobileStrategicProfileSnapshotPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Carga útil inválida: payload deve ser um objeto");
  }

  const p = payload as Record<string, any>;

  // 1. Validação de schemaVersion
  if (p.schemaVersion !== "mobile_strategic_profile_snapshot_v1") {
    throw new Error("Carga útil inválida: schemaVersion deve ser 'mobile_strategic_profile_snapshot_v1'");
  }

  // 2. Validação básica de tipos
  if (typeof p.profileState !== "string") {
    throw new Error("profileState deve ser uma string");
  }
  if (!Array.isArray(p.unlockedSignals) || !p.unlockedSignals.every((s) => typeof s === "string")) {
    throw new Error("unlockedSignals deve ser uma lista de strings");
  }
  if (!Array.isArray(p.pendingSignals) || !p.pendingSignals.every((s) => typeof s === "string")) {
    throw new Error("pendingSignals deve ser uma lista de strings");
  }
  if (!Array.isArray(p.recurringPatterns) || !p.recurringPatterns.every((s) => typeof s === "string")) {
    throw new Error("recurringPatterns deve ser uma lista de strings");
  }
  if (!Array.isArray(p.opportunities) || !p.opportunities.every((s) => typeof s === "string")) {
    throw new Error("opportunities deve ser uma lista de strings");
  }
  if (typeof p.diagnosisSummary !== "string") {
    throw new Error("diagnosisSummary deve ser uma string");
  }
  if (typeof p.commercialSummary !== "string") {
    throw new Error("commercialSummary deve ser uma string");
  }
  if (typeof p.lastAnalysisSummary !== "string") {
    throw new Error("lastAnalysisSummary deve ser uma string");
  }

  // 3. Bloqueio de transcrições longas
  if (p.lastAnalysisSummary.length > 2000 || p.diagnosisSummary.length > 5000) {
    throw new Error("Carga útil muito longa: limite de transcrição/resumos ultrapassado");
  }

  // 4. Bloqueio de base64 longo e strings excessivamente longas
  const serialized = JSON.stringify(p);
  if (serialized.length > 30000) {
    throw new Error("Carga útil muito grande: excede o limite de tamanho seguro");
  }

  if (BASE64_REGEX.test(serialized) || serialized.includes("base64")) {
    throw new Error("Carga útil insegura: base64 não é permitido no snapshot");
  }

  // 5. Bloqueio de API Keys/Tokens óbvios
  if (GEMINI_KEY_REGEX.test(serialized) || OPENAI_KEY_REGEX.test(serialized)) {
    throw new Error("Carga útil insegura: API key detectada no snapshot");
  }

  // 6. Bloqueio de vídeo/signed URLs
  if (SIGNED_URL_REGEX.test(serialized) || VIDEO_EXTENSION_REGEX.test(serialized)) {
    throw new Error("Carga útil insegura: links assinados ou referências a arquivos de vídeo detectadas");
  }

  return {
    schemaVersion: "mobile_strategic_profile_snapshot_v1",
    profileState: p.profileState,
    unlockedSignals: p.unlockedSignals,
    pendingSignals: p.pendingSignals,
    recurringPatterns: p.recurringPatterns,
    opportunities: p.opportunities,
    diagnosisSummary: p.diagnosisSummary,
    commercialSummary: p.commercialSummary,
    lastAnalysisSummary: p.lastAnalysisSummary,
    extraData: p.extraData,
  };
}

/**
 * Busca o snapshot estratégico ativo de um usuário.
 */
export async function getStrategicProfileSnapshotByUserId(
  userId: string
): Promise<CreatorStrategicProfileSnapshotInput | null> {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new Error("UserId inválido");
  }

  await connectToDatabase();

  const doc = await CreatorStrategicProfileSnapshot.findOne({
    userId: new Types.ObjectId(userId),
    status: "active",
  }).lean();

  if (!doc) return null;

  let parsedSnapshot: MobileStrategicProfileSnapshotPayload;
  try {
    parsedSnapshot = JSON.parse(doc.snapshotJson);
  } catch (err) {
    console.error("Erro ao decodificar snapshotJson:", err);
    return null;
  }

  return {
    userId: doc.userId.toString(),
    status: doc.status,
    accessLevel: doc.accessLevel,
    snapshot: parsedSnapshot,
    source: doc.source,
    lastAnalyzedAt: doc.lastAnalyzedAt,
  };
}

/**
 * Salva ou atualiza (upsert) o snapshot estratégico do usuário.
 */
export async function upsertStrategicProfileSnapshot(
  input: CreatorStrategicProfileSnapshotInput
): Promise<CreatorStrategicProfileSnapshotInput> {
  if (!input.userId || !Types.ObjectId.isValid(input.userId)) {
    throw new Error("UserId inválido");
  }

  // Regra rígida: Rejeita fonte gemini_real neste PR
  if ((input.source as string) === "gemini_real") {
    throw new Error("Origem 'gemini_real' não é permitida nesta fase");
  }

  // Validar a carga útil do snapshot
  const validatedSnapshot = validateSnapshotPayload(input.snapshot);

  await connectToDatabase();

  const updatedDoc = await CreatorStrategicProfileSnapshot.findOneAndUpdate(
    { userId: new Types.ObjectId(input.userId) },
    {
      $set: {
        status: input.status || "active",
        accessLevel: input.accessLevel,
        snapshotJson: JSON.stringify(validatedSnapshot),
        source: input.source,
        lastAnalyzedAt: input.lastAnalyzedAt || new Date(),
      },
    },
    {
      new: true,
      upsert: true,
    }
  );

  return {
    userId: updatedDoc.userId.toString(),
    status: updatedDoc.status,
    accessLevel: updatedDoc.accessLevel,
    snapshot: validatedSnapshot,
    source: updatedDoc.source,
    lastAnalyzedAt: updatedDoc.lastAnalyzedAt,
  };
}
