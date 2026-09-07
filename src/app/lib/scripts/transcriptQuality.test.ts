/** @jest-environment node */
import { assessTranscriptQuality } from "./transcriptQuality";
describe("qualidade estrutural da transcrição",()=>{
  const text="Hoje vou mostrar como organizo minha rotina de trabalho.";
  it("texto consistente com segmentos e duração tem integralidade estrutural verificada",()=>{
    expect(assessTranscriptQuality(text,[{startMs:0,endMs:9500,text}],10)).toMatchObject({status:"complete",speakerVerified:false});
  });
  it("segmentos divergentes ou texto cortado não passam como completos",()=>{
    expect(assessTranscriptQuality(text,[{startMs:0,endMs:9500,text:"Outra fala"}],10).status).toBe("unverified");
    expect(assessTranscriptQuality(text,[{startMs:0,endMs:9500,text}],10,true).status).toBe("partial");
    expect(assessTranscriptQuality(text,[],10).status).toBe("unverified");
    expect(assessTranscriptQuality(text,[{startMs:9000,endMs:10000,text}],10).status).toBe("unverified");
    expect(assessTranscriptQuality(text,[{startMs:-100,endMs:9500,text}],10).status).toBe("unverified");
  });
});
