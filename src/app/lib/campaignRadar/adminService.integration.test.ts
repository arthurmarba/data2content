/** @jest-environment node */
import mongoose from "mongoose";
import Candidate from "@/app/models/CampaignRadarCandidate";
import Catalog from "@/app/models/CampaignRadarOpportunity";
import Run from "@/app/models/CampaignRadarRun";
import { createManualCandidate, ingestCandidate, listCandidates, mutateCandidate } from "./adminService";
import { listPublicCampaignRadarCatalog } from "./repository";
import { sourceRegistryEntry } from "./sourceRegistry";
import { runCampaignRadarCollection } from "./runCollection";
import { collectCampaignRadar } from "./collect";
import { manualOpportunity } from "./intake";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn(async () => mongoose) }));
jest.mock("./collect", () => ({ campaignReportDate: () => "2026-09-07", collectCampaignRadar: jest.fn() }));
const uri = process.env.MCP_ADMIN_TEST_MONGO_URI;
const integration = uri ? describe : describe.skip;
jest.setTimeout(30_000);
integration("Radar com transações em Mongo efêmero", () => {
  const now = new Date("2026-09-07T12:00:00Z");
  const input = { sourceId: "tijuca-geek-public-coverage", title: "Campanha de teste", text: "Campanha para creators de viagem com um Reel.", sourceUrl: "https://example.com/post", applicationUrl: "https://example.com/apply?id=1", applicationDeadline: "2026-09-30", opportunityType: "ugc" };
  const source = sourceRegistryEntry(input.sourceId)!;
  const oldReview = { ...source.pluginDistribution };
  beforeAll(async () => {
    if (!uri || !/^mongodb:\/\/127\.0\.0\.1:\d+\/d2c_admin_test(?:\?|$)/.test(uri)) throw new Error("Teste exige Mongo local efêmero.");
    await mongoose.connect(uri);
    await Promise.all([Candidate.init(), Catalog.init(), Run.init()]);
  });
  afterAll(async () => { source.pluginDistribution = oldReview; await mongoose.disconnect(); });

  it("deduplica, preserva decisões e sinaliza outras chamadas com o mesmo link", async () => {
    const a = await createManualCandidate(input, "admin");
    await createManualCandidate({ ...input, applicationUrl: `${input.applicationUrl}&utm_source=email` }, "admin");
    expect(await Candidate.countDocuments()).toBe(1);
    await mutateCandidate(String(a!._id), { action: "internal", revision: 0, note: "Manter privado." }, "admin", now);
    await ingestCandidate(a!.opportunity, "automatic", "coletor", now);
    expect(await Candidate.findById(a!._id).lean()).toMatchObject({ decision: "internal", revision: 1, sightings: 3 });
    await createManualCandidate({ ...input, title: "Outra oportunidade" }, "admin");
    const listed = await listCandidates(new URLSearchParams({ decision: "all" }));
    expect(listed.items.every((item) => item.possibleDuplicates === 1)).toBe(true);
    await expect(mutateCandidate(String(a!._id), { action: "rejected", revision: 0, note: "Revisão antiga." }, "admin", now)).rejects.toThrow("registro mudou");
  });
  it("publica atomicamente apenas fonte autorizada; edição retira do catálogo", async () => {
    const item = await Candidate.findOne({ "opportunity.title": input.title }).lean();
    const id = String(item!._id);
    await expect(mutateCandidate(id, { action: "approved", revision: 1, note: "Conferida na origem.", verifiedOpen: true }, "admin", now)).rejects.toThrow("distribuição liberada");
    expect(await Catalog.countDocuments()).toBe(0);
    // Permissão somente na memória deste teste. Nenhuma fonte real é liberada.
    source.pluginDistribution = { ...oldReview, status: "approved", authorizationBasis: "written_permission", evidenceReference: "teste-isolado", reviewedAt: "2026-09-07", reviewedBy: "teste" };
    await mutateCandidate(id, { action: "approved", revision: 1, note: "Conferida na origem.", verifiedOpen: true }, "admin", now);
    expect((await listPublicCampaignRadarCatalog({ now })).length).toBe(1);
    source.pluginDistribution = oldReview;
    expect((await listPublicCampaignRadarCatalog({ now })).length).toBe(0);
    await mutateCandidate(id, { action: "edit", revision: 2, input: { ...input, title: "Título revisado" } }, "admin", now);
    expect(await Catalog.findOne().lean()).toMatchObject({ activeInCatalog: false });
    expect(await Candidate.findById(id).lean()).toMatchObject({ decision: "pending", revision: 3 });
  });
  it("executa a coleta apenas uma vez mesmo com duas chamadas simultâneas", async () => {
    (collectCampaignRadar as jest.Mock).mockResolvedValue({ opportunities: [], sources: [] });
    const results = await Promise.all([runCampaignRadarCollection(now), runCampaignRadarCollection(now)]);
    expect(results.filter((result) => result.skipped)).toHaveLength(1);
    expect(collectCampaignRadar).toHaveBeenCalledTimes(1);
    expect(await Run.findOne().lean()).toMatchObject({ status: "completed", apiCost: 0 });
  });

  it("nova observação preserva correções; condições alteradas retiram publicação e exigem revisão", async () => {
    const original = manualOpportunity({ ...input, title: "Mudança de cachê", compensationText: "R$ 500 por vídeo" }, now);
    const item = await ingestCandidate(original, "automatic", "coletor", now);
    const id = String(item!._id);
    await mutateCandidate(id, { action: "edit", revision: 0, input: { ...input, title: original.title,
      text: "Texto corrigido pelo administrador para deixar a chamada mais clara.", compensationText: "R$ 500 por vídeo" } }, "admin", new Date("2026-09-08T12:00:00Z"));
    await ingestCandidate({ ...original, lastVerifiedAt: "2026-09-08T12:00:00Z" }, "automatic", "coletor", now);
    expect(await Candidate.findById(id).lean()).toMatchObject({ revision: 1,
      opportunity: { summary: "Texto corrigido pelo administrador para deixar a chamada mais clara.", discoveredAt: original.discoveredAt },
      originalOpportunity: { summary: original.summary } });
    source.pluginDistribution = { ...oldReview, status: "approved", authorizationBasis: "written_permission", evidenceReference: "teste-isolado", reviewedAt: "2026-09-07", reviewedBy: "teste" };
    try {
      await mutateCandidate(id, { action: "approved", revision: 1, note: "Conferida na origem.", verifiedOpen: true }, "admin", now);
      await ingestCandidate({ ...original, compensation: { ...original.compensation, sourceText: "Somente permuta" } }, "automatic", "coletor", now);
      expect(await Candidate.findById(id).lean()).toMatchObject({ decision: "recheck", revision: 3,
        opportunity: { compensation: { sourceText: "Somente permuta" }, review: { status: "pending" } },
        originalOpportunity: { compensation: { sourceText: "R$ 500 por vídeo" } },
        previousOpportunity: { review: { status: "approved" } } });
      expect(await Catalog.findOne({ opportunityId: `candidate:${id}` }).lean()).toMatchObject({ activeInCatalog: false });
      await expect(mutateCandidate(id, { action: "approved", revision: 2, note: "Revisão antes da mudança.", verifiedOpen: true }, "admin", now)).rejects.toThrow("registro mudou");
    } finally { source.pluginDistribution = oldReview; }
  });

  it("duas capturas simultâneas produzem uma única candidata", async () => {
    const same = { ...input, title: "Captura concorrente" };
    await Promise.all([createManualCandidate(same, "admin"), createManualCandidate(same, "admin")]);
    expect(await Candidate.countDocuments({ "opportunity.title": same.title })).toBe(1);
    expect(await Candidate.findOne({ "opportunity.title": same.title }).lean()).toMatchObject({ sightings: 2, revision: 0 });
  });
});
