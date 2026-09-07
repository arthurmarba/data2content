/** @jest-environment node */
import { buildCreatorScriptEvidencePack, serializeScriptEvidence } from "./creatorScriptEvidencePack";
import Metric from "@/app/models/Metric";
import { connectToDatabase } from "@/app/lib/mongoose";

const mockMetrics = [{ _id:"507f1f77bcf86cd799439012", type:"REEL", postDate:new Date("2026-09-01"), updatedAt:new Date("2026-09-06"), stats:{reach:1000,total_interactions:100} }];
const mockCorpus = [{ metricId:mockMetrics[0]!._id, transcript:{source:"gemini_video",fullText:"A minha rotina começa sempre na cozinha, com café e uma ideia anotada no caderno."}, narrative:{subjects:["rotina"]} }];
const mockQuery = (values: unknown) => {
  const q: any = { sort: jest.fn(()=>q), limit:jest.fn(()=>q), select:jest.fn(()=>q), lean:jest.fn(async()=>values) }; return q;
};
jest.mock("@/app/lib/mongoose",()=>({connectToDatabase:jest.fn(async()=>undefined)}));
jest.mock("@/app/models/Metric",()=>({__esModule:true,default:{find:jest.fn(()=>mockQuery(mockMetrics)),countDocuments:jest.fn(async()=>mockMetrics.length)}}));
jest.mock("@/app/models/PublishedContentEvidence",()=>({__esModule:true,default:{find:jest.fn(()=>mockQuery(mockCorpus))}}));
jest.mock("@/app/models/ScriptEntry",()=>({__esModule:true,default:{find:jest.fn(()=>mockQuery([]))}}));
jest.mock("./creatorScriptDnaV3",()=>({getCreatorScriptDnaV3:jest.fn(async()=>null),sanitizeCreatorScriptDnaForMcp:jest.fn(()=>null)}));
jest.mock("@/app/lib/mcp/creatorMap",()=>({loadMcpCreatorMap:jest.fn(async()=>({hasMap:false,territories:[],assets:[]})),summarizeMcpCreatorMap:(m:any)=>m}));

describe("pacote privado de evidências",()=>{
  const userId="507f1f77bcf86cd799439011";
  beforeEach(()=>{jest.clearAllMocks();jest.useFakeTimers().setSystemTime(new Date("2026-09-07T00:00:00Z"));});
  afterEach(()=>jest.useRealTimers());
  it("nega antes de consultar banco quando a capacidade privada está desligada",async()=>{
    await expect(buildCreatorScriptEvidencePack({userId,prompt:"minha rotina",includePrivateIntelligence:false})).rejects.toThrow("private_creator_evidence_unavailable");
    expect(connectToDatabase).not.toHaveBeenCalled();
  });
  it("aplica conta, período e formato e entrega texto sem duplicação ao escritor",async()=>{
    const pack=await buildCreatorScriptEvidencePack({userId,prompt:"mais engajaram",lookbackDays:30,format:"reel"});
    expect(Metric.find).toHaveBeenCalledWith(expect.objectContaining({user:expect.anything(),postDate:{$gte:new Date("2026-08-08T00:00:00Z"),$lte:new Date("2026-09-07T00:00:00Z")},type:{$in:["REEL","VIDEO"]}}));
    expect(pack.request.goal).toBe("engagement");
    expect(pack.receipt).toMatchObject({selectionStage:"prepared",sentExamples:0,status:"partial",observedTranscriptsUsed:1});
    expect(serializeScriptEvidence(pack).split(mockCorpus[0]!.transcript.fullText).length-1).toBe(1);
  });
  it("recusa referência que não pertence à conta/período sem expandir silenciosamente",async()=>{
    (Metric.find as jest.Mock).mockImplementationOnce(()=>mockQuery([]));
    await expect(buildCreatorScriptEvidencePack({userId,prompt:"minha rotina",ownContentIds:["507f1f77bcf86cd799439099"]})).rejects.toThrow("own_content_unavailable");
  });
  it("aceita uma janela explícita e a mantém no recibo e no pedido", async () => {
    const pack = await buildCreatorScriptEvidencePack({ userId, prompt: "minha rotina", startsAt: "2026-08-01T00:00:00-03:00", endsAt: "2026-09-01T00:00:00-03:00" });
    expect(pack.receipt).toMatchObject({ periodStart: "2026-08-01T03:00:00.000Z", periodEnd: "2026-09-01T03:00:00.000Z" });
    expect(pack.request.endsAt).toBe(pack.receipt.periodEnd);
  });
  it("não aceita janela invertida nem futura", async () => {
    await expect(buildCreatorScriptEvidencePack({ userId, prompt: "minha rotina", startsAt: "2026-09-02", endsAt: "2026-09-01" })).rejects.toThrow("invalid_evidence_period");
    await expect(buildCreatorScriptEvidencePack({ userId, prompt: "minha rotina", endsAt: "2026-10-01" })).rejects.toThrow("invalid_evidence_period");
    expect(connectToDatabase).not.toHaveBeenCalled();
  });
});
