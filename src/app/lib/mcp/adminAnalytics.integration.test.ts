/** @jest-environment node */
import mongoose, { Types } from "mongoose";
import User from "@/app/models/User";
import Metric from "@/app/models/Metric";
import Evidence from "@/app/models/PublishedContentEvidence";
import { analyzeMcpAdminPortfolio, listMcpAdminCreators } from "./adminAnalytics";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn(async () => undefined) }));

// Somente Mongo efêmero local. Nunca usa o MONGODB_URI carregado pelo Next.
const uri = process.env.MCP_ADMIN_TEST_MONGO_URI;
const integration = uri ? describe : describe.skip;
integration("agregação administrativa em Mongo isolado", () => {
  const a = new Types.ObjectId("507f1f77bcf86cd799439011"), b = new Types.ObjectId("507f1f77bcf86cd799439012");
  const c = new Types.ObjectId("507f1f77bcf86cd799439013"), admin = new Types.ObjectId("507f1f77bcf86cd799439014");
  beforeAll(async () => {
    if (!uri || !/^mongodb:\/\/127\.0\.0\.1:\d+\/d2c_admin_test(?:\?|$)/.test(uri)) throw new Error("Mongo de teste deve ser efêmero e local.");
    await mongoose.connect(uri, { autoIndex: false });
    await User.collection.insertMany([
      { _id: a, name: "Ana", username: "ana", role: "user", isInstagramConnected: true, instagramAccountId: "ig-a", instagramAccessToken: "SEGREDO" },
      { _id: b, name: "Bia", role: "user", isInstagramConnected: false },
      { _id: c, name: "Caio", role: "guest" }, { _id: admin, name: "Admin", role: "admin" },
    ]);
    const video = new Types.ObjectId(), photo = new Types.ObjectId();
    await Metric.collection.insertMany([
      { _id: video, user: a, postDate: new Date("2026-08-10"), type: "REEL", classificationStatus: "completed", stats: { reach: 100, total_interactions: 0 } },
      { _id: photo, user: a, postDate: new Date("2026-08-11"), type: "IMAGE", stats: { reach: 100, total_interactions: 20 } },
      { user: b, postDate: new Date("2026-08-12"), type: "VIDEO", stats: { reach: 50 } },
      { user: a, postDate: new Date("2026-07-15"), type: "REEL", stats: { reach: 100, total_interactions: 10 } },
      { user: admin, postDate: new Date("2026-08-12"), type: "REEL", stats: { reach: 9999, total_interactions: 9999 } },
    ]);
    await Evidence.collection.insertMany([video, photo].map(metricId => ({ userId: a, metricId,
      transcript: { source: "gemini_video", wordCount: 12, fullText: "TEXTO PRIVADO" }, completeness: { transcript: true } })));
  });
  afterAll(async () => { await mongoose.disconnect(); });

  it("resume todos incluindo sem posts, mas retorna apenas a página pedida", async () => {
    const result = await analyzeMcpAdminPortfolio({ startDate: "2026-08-01", endDate: "2026-08-31", timeZone: "UTC", limit: 1 });
    expect(result.summary).toMatchObject({ totalCreators: 3, creatorsWithPosts: 2, disconnectedCreators: 2, observedTranscripts: 1, videos: 2 });
    expect(result.summary.current.posts).toBe(3);
    expect(result.summary.current.engagement).toMatchObject({ value: 0.1, eligiblePosts: 2 });
    expect(result.summary.current.metrics.total_interactions).toMatchObject({ sum: 20, availablePosts: 2 });
    expect(result.summary.previous.engagement.value).toBe(0.1);
    expect(result.creators).toHaveLength(1);
    expect(result.pagination.nextPage).toBe(2);
    expect(JSON.stringify(result)).not.toMatch(/SEGREDO|TEXTO PRIVADO|instagramAccessToken/);
  });
  it("não perde contas sem dados ao paginar diretório e recusa mudança de filtro", async () => {
    const first = await listMcpAdminCreators({ limit: 2 });
    const second = await listMcpAdminCreators({ limit: 2, cursor: first.pagination.nextCursor! });
    expect(first.pagination.total).toBe(3);
    expect([...first.creators, ...second.creators].map(row => row.id)).toEqual([a,b,c].map(id => `creator:${id}`));
    expect(second.pagination.nextCursor).toBeNull();
    await expect(listMcpAdminCreators({ cursor: first.pagination.nextCursor!, query: "Ana" })).rejects.toThrow("invalid_admin_cursor");
  });
  it("respeita conexão, formato e referências de comparação", async () => {
    const filtered = await analyzeMcpAdminPortfolio({ startDate: "2026-08-01", endDate: "2026-08-31", timeZone: "UTC", connection: "connected", format: "reel" });
    expect(filtered.summary).toMatchObject({ totalCreators: 1, current: { posts: 1, engagement: { value: 0 } } });
    const selected = await analyzeMcpAdminPortfolio({ startDate: "2026-08-01", endDate: "2026-08-31", timeZone: "UTC", population: "all_accounts", creatorIds: [String(admin)] });
    expect(selected.summary.current.metrics.total_interactions.sum).toBe(9999);
  });
});
