/** @jest-environment node */
import Session from "@/app/models/ScriptEvidenceSession";
import { readScriptEvidenceSession, scriptProvenanceForSave, scriptTextHash } from "./scriptEvidenceSession";

jest.mock("@/app/lib/mongoose",()=>({connectToDatabase:jest.fn(async()=>undefined)}));
jest.mock("@/app/models/ScriptEvidenceSession",()=>({__esModule:true,default:{findOne:jest.fn()}}));
const userId="507f1f77bcf86cd799439011";
const id="mcp-11111111-1111-4111-8111-111111111111";
describe("origem do roteiro salvo",()=>{
  it("sessão é lida somente na conta autenticada e antes da expiração",async()=>{
    (Session.findOne as jest.Mock).mockReturnValue({lean:async()=>null});
    expect(await readScriptEvidenceSession(userId,id)).toBeNull();
    expect(Session.findOne).toHaveBeenCalledWith(expect.objectContaining({userId:expect.anything(),clientRequestId:id,expiresAt:{$gt:expect.any(Date)}}));
    expect((Session.findOne as jest.Mock).mock.calls.at(-1)[0].userId.toString()).toBe(userId);
    expect(await scriptProvenanceForSave(userId,id,"texto")).toMatchObject({status:"unverified"});
  });
  it("preserva referências e detecta edição sem aceitar recibo inventado pelo cliente",async()=>{
    const pack={request:{goal:"engagement"},receipt:{sentExamples:1},winningExemplars:[{contentId:"a",source:"observed_transcript"}]};
    (Session.findOne as jest.Mock).mockReturnValue({lean:async()=>({packId:"pack-real",mode:"internal",provider:"openai",draftHash:scriptTextHash("original"),draftContent:"original",pack})});
    expect(await scriptProvenanceForSave(userId,id,"aprovado e editado")).toMatchObject({status:"recorded",packId:"pack-real",editedAfterGeneration:true,originalContent:"original",approvedContent:"aprovado e editado",references:[{contentId:"a",source:"observed_transcript"}]});
  });
});
