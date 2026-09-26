/** @jest-environment node */
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import McpToolCallLogModel from "@/app/models/McpToolCallLog";
import McpUsageDailyModel from "@/app/models/McpUsageDaily";
import UserModel from "@/app/models/User";
import { writeMcpToolUsage } from "./usageTracking";
import { buildMcpUsageReport } from "./usageReport";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn(async () => undefined) }));
jest.setTimeout(120_000);

// Mongo efêmero em memória: a conta de sessão e de tempo usa operadores do
// próprio banco ($getField, pipeline com upsert) que um mock não comprova.
describe("medição de uso do conector em Mongo real (memória)", () => {
  let server: MongoMemoryServer;
  const userId = new Types.ObjectId("507f1f77bcf86cd799439011");
  const base = { userId: String(userId), client: "claude" as const, kind: "tool" as const, isError: false, durationMs: 120, accessLevel: "pro" as const };

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri(), { autoIndex: true });
    await Promise.all([McpUsageDailyModel.init(), McpToolCallLogModel.init()]);
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });

  it("conta sessões, tempo estimado e ferramentas por dia de São Paulo", async () => {
    // 10h00, 10h05 e 10h20 em São Paulo (13h UTC): uma conversa; 12h00: outra.
    await writeMcpToolUsage({ ...base, name: "get_creator_map", args: {}, at: new Date("2026-09-26T13:00:00Z") });
    await writeMcpToolUsage({ ...base, name: "list_content_ideas", args: { territory: "Maternidade" }, at: new Date("2026-09-26T13:05:00Z") });
    await writeMcpToolUsage({ ...base, name: "list_content_ideas", args: {}, at: new Date("2026-09-26T13:20:00Z"), isError: true, errorCode: "x", planGate: "pautas" });
    await writeMcpToolUsage({ ...base, kind: "prompt", name: "what_to_post", args: {}, at: new Date("2026-09-26T15:00:00Z") });
    // 23h30 em São Paulo ainda é o mesmo dia, embora já seja 27/09 em UTC.
    await writeMcpToolUsage({ ...base, name: "get_creator_map", args: {}, at: new Date("2026-09-27T02:30:00Z") });

    const day = await McpUsageDailyModel.findOne({ userId, day: "2026-09-26", client: "claude" }).lean();
    expect(day).toMatchObject({
      calls: 5,
      errorCount: 1,
      planGates: 1,
      sessions: 3,
      activeMs: 20 * 60 * 1000,
      tools: { get_creator_map: 2, list_content_ideas: 2, "prompt:what_to_post": 1 },
    });
    expect(day?.firstAt.toISOString()).toBe("2026-09-26T13:00:00.000Z");
    expect(day?.lastAt.toISOString()).toBe("2026-09-27T02:30:00.000Z");
    expect(await McpUsageDailyModel.countDocuments()).toBe(1);
  });

  it("guarda os campos da ferramenta cortados e com prazo de 90 dias", async () => {
    const at = new Date("2026-09-26T18:00:00Z");
    await writeMcpToolUsage({
      ...base,
      name: "critique_script_against_creator_dna",
      args: { content: "roteiro ".repeat(400), prompt: "Roteiro sobre rotina de mãe", accessToken: "nunca" },
      at,
    });
    const log = await McpToolCallLogModel.findOne({ name: "critique_script_against_creator_dna" }).lean();
    expect(String(log?.args.content).length).toBeLessThanOrEqual(500);
    expect(log?.args.prompt).toBe("Roteiro sobre rotina de mãe");
    expect(log?.args).not.toHaveProperty("accessToken");
    expect(log?.expiresAt.toISOString()).toBe("2026-12-25T18:00:00.000Z");

    const indexes = await McpToolCallLogModel.collection.indexes();
    expect(indexes.find((index) => index.name === "mcp_tool_call_logs_ttl")).toMatchObject({ expireAfterSeconds: 0 });
  });

  it("relatório: deixa contas internas de fora, mede quem voltou e mostra os pedidos", async () => {
    const creator = new Types.ObjectId("507f1f77bcf86cd799439021");
    const admin = new Types.ObjectId("507f1f77bcf86cd799439022");
    await UserModel.collection.insertMany([
      { _id: creator, name: "Ana Souza", username: "anasouza", email: "ana@example.test", role: "user", planStatus: "active" },
      { _id: admin, name: "Equipe", email: "time@data2content.ai", role: "admin" },
    ]);
    const call = (userIdValue: Types.ObjectId, name: string, args: Record<string, unknown>, at: string) =>
      writeMcpToolUsage({ ...base, userId: String(userIdValue), name, args, at: new Date(at) });
    await call(creator, "get_creator_map", {}, "2026-09-10T13:00:00Z");
    await call(creator, "get_script_evidence_pack", { prompt: "Roteiro sobre voltar ao trabalho depois da licença" }, "2026-09-20T13:00:00Z");
    await call(creator, "research_inspiration_content", { mode: "by_topic", query: "maternidade real", filters: { formats: ["reel"], tones: [] } }, "2026-09-21T13:10:00Z");
    await call(admin, "get_creator_map", {}, "2026-09-21T14:00:00Z");

    const report = await buildMcpUsageReport({ startDate: "2026-09-15", endDate: "2026-09-21", includeRequests: true });
    expect(report.summary).toMatchObject({ activeCreators: 1, calls: 2, sessions: 2 });
    expect(report.retention).toMatchObject({ activeInPreviousPeriod: 1, returnedFromPreviousPeriod: 1, rate: 1 });
    expect(report.perCreator[0]).toMatchObject({ creatorRef: `creator:${creator}`, username: "anasouza", activeDays: 2 });
    expect(report.requests.map((item) => item.request)).toEqual([
      "query: maternidade real · mode: by_topic · filtros: formats=reel",
      "prompt: Roteiro sobre voltar ao trabalho depois da licença",
    ]);

    const withInternal = await buildMcpUsageReport({ startDate: "2026-09-15", endDate: "2026-09-21", includeInternal: true });
    expect(withInternal.summary.activeCreators).toBe(2);
  });
});

