/** @jest-environment node */
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import McpOAuthAuthorizationCodeModel from "@/app/models/McpOAuthAuthorizationCode";
import McpOAuthConsentRequestModel from "@/app/models/McpOAuthConsentRequest";
import McpOAuthRefreshTokenModel from "@/app/models/McpOAuthRefreshToken";
import McpToolCallLogModel from "@/app/models/McpToolCallLog";
import McpUsageDailyModel from "@/app/models/McpUsageDaily";
import ScriptEvidenceSessionModel from "@/app/models/ScriptEvidenceSession";
import { deleteMcpDataForUser } from "./accountDeletion";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn(async () => undefined) }));
jest.setTimeout(120_000);

const MODELS = [
  McpOAuthRefreshTokenModel,
  McpOAuthAuthorizationCodeModel,
  McpOAuthConsentRequestModel,
  McpToolCallLogModel,
  McpUsageDailyModel,
  ScriptEvidenceSessionModel,
] as const;

// Mongo em memória: o que importa é o filtro por dono chegar a cada coleção de verdade.
describe("dados do conector ao apagar a conta (Mongo em memória)", () => {
  let server: MongoMemoryServer;
  const leaving = new Types.ObjectId();
  const staying = new Types.ObjectId();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });

  it("apaga conexões, pedidos pendentes, registros de uso e sessões de roteiro só da conta apagada", async () => {
    // Cada coleção tem um índice único próprio; os campos variam por documento para não colidir.
    let seq = 0;
    const doc = (userId: Types.ObjectId) => {
      seq += 1;
      const id = `doc-${seq}`;
      return { userId, tokenHash: id, codeHash: id, requestHash: id, clientRequestId: id, day: id, client: "claude" };
    };
    for (const model of MODELS) {
      await model.collection.insertMany([doc(leaving), doc(leaving), doc(staying)]);
    }

    const removed = await deleteMcpDataForUser(String(leaving));

    expect(removed).toEqual({
      refreshTokens: 2,
      authorizationCodes: 2,
      consentRequests: 2,
      toolCallLogs: 2,
      usageDays: 2,
      scriptEvidenceSessions: 2,
    });
    for (const model of MODELS) {
      expect(await model.collection.countDocuments({ userId: leaving })).toBe(0);
      expect(await model.collection.countDocuments({ userId: staying })).toBe(1);
    }
  });

  it("não falha para conta que nunca conectou", async () => {
    const removed = await deleteMcpDataForUser(new Types.ObjectId());
    expect(Object.values(removed).every((count) => count === 0)).toBe(true);
  });
});
