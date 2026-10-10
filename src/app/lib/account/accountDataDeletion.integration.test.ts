/** @jest-environment node */
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { deleteContentAnalysisThumbnails } from "@/app/dashboard/boards/videoUpload/contentAnalysisThumbnailStorage";
import {
  REMOVED_ACCOUNT_MARKER,
  REMOVED_CREATOR_LABEL,
  anonymizeCreatorInCommunityReports,
  deleteAccountData,
} from "./accountDataDeletion";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn(async () => undefined) }));
jest.mock("@/app/dashboard/boards/videoUpload/contentAnalysisThumbnailStorage", () => ({
  deleteContentAnalysisThumbnails: jest.fn(async (_userId: string, ids: string[]) => ids.length),
}));
jest.setTimeout(120_000);

// Mongo em memória: o filtro por dono, os filhos e o $pull precisam chegar ao banco de verdade.
describe("dados de uma conta excluída (Mongo em memória)", () => {
  let server: MongoMemoryServer;
  const db = () => mongoose.connection.db!;
  const gone = new Types.ObjectId();
  const other = new Types.ObjectId();
  const goneId = String(gone);

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
  beforeEach(async () => {
    await db().dropDatabase();
    const goneMetric = new Types.ObjectId();
    const otherMetric = new Types.ObjectId();
    const goneThread = new Types.ObjectId();
    await db().collection("metrics").insertMany([{ _id: goneMetric, user: gone }, { _id: otherMetric, user: other }]);
    await db().collection("daily_metric_snapshots").insertMany([
      { metric: goneMetric }, { metric: goneMetric }, { metric: otherMetric },
    ]);
    await db().collection("postreviews").insertMany([{ postId: goneMetric }, { postId: otherMetric }]);
    await db().collection("published_content_evidence").insertMany([
      { metricId: goneMetric, userId: gone }, { metricId: otherMetric, userId: other },
    ]);
    await db().collection("content_reading_states").insertMany([
      { _id: String(goneMetric) }, { _id: `dna:${goneId}` }, { _id: `mapa:instagram:${goneId}` },
      { _id: String(otherMetric) }, { _id: `dna:${other}` },
    ] as never[]);
    await db().collection("threads").insertMany([{ _id: goneThread, userId: gone }, { userId: other }]);
    await db().collection("messages").insertMany([{ threadId: goneThread }, { threadId: new Types.ObjectId() }]);
    await db().collection("accountinsights").insertMany([{ user: gone }, { user: other }]);
    await db().collection("communityinspirations").insertMany([{ originalCreatorId: gone }, { originalCreatorId: other }]);
    await db().collection("brandproposals").insertMany([{ userId: gone }, { userId: other }]);
    await db().collection("collabmatches").insertMany([{ userA: other, userB: gone }, { userA: other, userB: new Types.ObjectId() }]);
    await db().collection("collabproposals").insertMany([{ originUserId: String(other), acceptedBy: [goneId, String(other)] }]);
    await db().collection("contentideaquotas").insertMany([{ _id: "q1", userId: goneId }, { _id: "q2", userId: String(other) }] as never[]);
    await db().collection("geminiusagelogs").insertMany([{ creatorId: goneId, costUsd: 0.01 }, { creatorId: String(other), costUsd: 0.02 }]);
    await db().collection("creatorvideonarrativediagnoses").insertMany([
      { userId: gone, diagnosisId: "d1", thumbnailStatus: "available" },
      { userId: gone, diagnosisId: "d2", thumbnailStatus: "failed" },
      { userId: other, diagnosisId: "d3", thumbnailStatus: "available" },
    ]);
    await db().collection("gemini_batch_jobs").insertMany([
      { name: "lote-1", items: [{ creatorId: goneId, metricId: "m1" }, { creatorId: String(other), metricId: "m2" }] },
    ]);
  });

  it("ensaio conta sem apagar nada", async () => {
    const report = await deleteAccountData(goneId, { dryRun: true });
    expect(report.collections["daily_metric_snapshots.metric"]).toBe(2);
    expect(report.collections["metrics.user"]).toBe(1);
    expect(report.collections["geminiusagelogs.creatorId"]).toBe(1);
    expect(report.files).toBe(1);
    expect(deleteContentAnalysisThumbnails).toHaveBeenCalledWith(goneId, ["d1"], { dryRun: true });
    expect(await db().collection("metrics").countDocuments()).toBe(2);
    expect(await db().collection("daily_metric_snapshots").countDocuments()).toBe(3);
  });

  it("apaga o que é da conta, tira a conta das listas e mantém o custo sem nome", async () => {
    const report = await deleteAccountData(goneId);

    const left = async (name: string) => db().collection(name).find({}).toArray();
    expect(await left("metrics")).toEqual([expect.objectContaining({ user: other })]);
    expect(await db().collection("daily_metric_snapshots").countDocuments()).toBe(1);
    expect(await db().collection("postreviews").countDocuments()).toBe(1);
    expect(await left("published_content_evidence")).toEqual([expect.objectContaining({ userId: other })]);
    // Ficam só o estado do post e o do jeito de criar da outra conta.
    expect(await db().collection("content_reading_states").countDocuments()).toBe(2);
    expect(await db().collection("content_reading_states").countDocuments({ _id: `dna:${other}` } as never)).toBe(1);
    expect(await db().collection("threads").countDocuments()).toBe(1);
    expect(await db().collection("messages").countDocuments()).toBe(1);
    expect(await db().collection("accountinsights").countDocuments({ user: gone })).toBe(0);
    expect(await db().collection("communityinspirations").countDocuments()).toBe(1);
    expect(await db().collection("brandproposals").countDocuments()).toBe(1);
    expect(await db().collection("collabmatches").countDocuments()).toBe(1);
    expect((await left("collabproposals"))[0].acceptedBy).toEqual([String(other)]);
    expect(await left("contentideaquotas")).toEqual([expect.objectContaining({ userId: String(other) })]);
    expect((await left("geminiusagelogs")).map((doc) => doc.creatorId).sort()).toEqual([REMOVED_ACCOUNT_MARKER, String(other)].sort());
    expect((await left("gemini_batch_jobs"))[0].items).toEqual([
      { creatorId: REMOVED_ACCOUNT_MARKER, metricId: "m1" },
      { creatorId: String(other), metricId: "m2" },
    ]);
    expect(report.collections["daily_metric_snapshots.metric"]).toBe(2);
    expect(await db().collection("creatorvideonarrativediagnoses").countDocuments()).toBe(1);
    expect(deleteContentAnalysisThumbnails).toHaveBeenCalledWith(goneId, ["d1"], { dryRun: false });

    // Rodar de novo não acha mais nada para apagar.
    const again = await deleteAccountData(goneId);
    expect(Object.values(again.collections).every((count) => count === 0)).toBe(true);
  });

  it("tira o nome dos relatórios da comunidade e mantém os outros nomes", async () => {
    await db().collection("weekly_territory_reports").insertMany([
      { weekKey: "2026-W39", highlightWinners: ["Simone", "Giselle"], posts: 12 },
      { weekKey: "2026-W40", highlightWinners: ["Giselle"], posts: 9 },
    ]);
    expect(await anonymizeCreatorInCommunityReports("  Simone ")).toBe(1);
    const reports = await db().collection("weekly_territory_reports").find({}).sort({ weekKey: 1 }).toArray();
    expect(reports.map((r) => r.highlightWinners)).toEqual([[REMOVED_CREATOR_LABEL, "Giselle"], ["Giselle"]]);
    expect(reports[0].posts).toBe(12);
    expect(await anonymizeCreatorInCommunityReports("")).toBe(0);
  });

  it("recusa id inválido", async () => {
    await expect(deleteAccountData("nao-e-id")).rejects.toThrow("invalid_user_id");
  });
});
