/** @jest-environment node */
import { generateCreatorScriptV3 } from "./creatorScriptGenerationV3";
import { generateScriptFromPrompt } from "./ai";
import type { CreatorScriptEvidencePack } from "./creatorScriptEvidencePack";

jest.mock("./ai",()=>({
  buildGenerateScriptPrompt:()=>"Briefing do roteiro",
  enforceTechnicalScriptContract:(x:any)=>x,
  evaluateTechnicalScriptQuality:()=>({perceivedQuality:0.9}),
  resolveBlueprintDensityProfile:()=>({preferredSceneCount:3,maxSceneCount:6}),
  resolveEditorialAnchorTitle:()=>"Rotina",
  sanitizeScriptIdentityLeakage:(x:any)=>x,
  generateScriptFromPrompt:jest.fn(),
}));
jest.mock("@/app/lib/relatorio/contentReadingState",()=>({claimGeminiAvailability:async()=>false,markGeminiHealthy:jest.fn(),pauseGemini:jest.fn(),classifyReadingFailure:()=>({reason:"temporary_failure"})}));

const originalKey=process.env.GEMINI_API_KEY;
const originalFallback=process.env.LLM_FALLBACK_SCRIPTS;
const pack: CreatorScriptEvidencePack={
  schemaVersion:"creator_script_evidence_pack_v1",generatedAt:new Date().toISOString(),request:{prompt:"rotina",goal:"engagement",targetDurationSeconds:10},dna:null,
  winningExemplars:[{contentId:"video-a",scriptId:null,source:"observed_transcript",fullText:"Referência real para aprender minha voz.",observedTranscriptText:"Referência real para aprender minha voz.",plannedScriptText:null,hook:null,cta:null,structure:["gancho","virada"],subjects:["rotina"],durationSeconds:10,performanceIndex:2,relevance:1}],contrastExemplar:null,
  generationConstraints:{targetDurationSeconds:10,preferredSceneCount:3,creatorFitConfidence:"low",avoidVerbatimCopy:true,audienceGuidance:[],visualGuidance:[]},
  receipt:{profileVersion:"v1",evidenceRecordsConsidered:1,fullExemplarsUsed:1,linkedPlannedScriptsUsed:0,observedTranscriptsUsed:1,demographicsUsed:false,status:"partial",warnings:[],selectedExamples:1},
};
describe("evidência preservada no fallback",()=>{
  beforeEach(()=>{delete process.env.GEMINI_API_KEY;process.env.LLM_FALLBACK_SCRIPTS="true";jest.clearAllMocks();});
  afterAll(()=>{if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;
    if(originalFallback===undefined)delete process.env.LLM_FALLBACK_SCRIPTS;else process.env.LLM_FALLBACK_SCRIPTS=originalFallback;});
  it("envia ao OpenAI o mesmo pacote de fala e estrutura",async()=>{
    (generateScriptFromPrompt as jest.Mock).mockResolvedValue({title:"Rotina",content:"Fala: Separe alguns minutos para organizar suas tarefas e escolha uma prioridade concreta para começar o seu dia.",generationProvider:"openai",generationModel:"modelo-simulado"});
    const result=await generateCreatorScriptV3({userId:"507f1f77bcf86cd799439011",prompt:"rotina",evidencePack:pack});
    expect(generateScriptFromPrompt).toHaveBeenCalledWith(expect.objectContaining({providerOverride:"openai",evidencePrompt:expect.stringContaining("Referência real para aprender minha voz.")}));
    expect(result.evidenceReceipt).toMatchObject({selectionStage:"sent_to_generator",sentExamples:1,observedTranscriptsUsed:1});
    expect(result.model).toBe("modelo-simulado");
  });
  it("rascunho local não declara uso pelo modelo das referências selecionadas",async()=>{
    (generateScriptFromPrompt as jest.Mock).mockResolvedValue({title:"Rotina",content:"Fala: Comece definindo sua prioridade do dia.",generationProvider:"local"});
    const result=await generateCreatorScriptV3({userId:"507f1f77bcf86cd799439011",prompt:"rotina",evidencePack:pack});
    expect(result.evidenceReceipt).toMatchObject({selectionStage:"local_without_evidence",sentExamples:0,selectedExamples:1,observedTranscriptsUsed:0,status:"insufficient"});
  });
});
