/** @jest-environment node */
import { reviewScriptVoice } from "./scriptVoiceReview";
describe("rubrica de voz ancorada em referências",()=>{
  it("aponta divergência de comprimento de frase com fontes e sem prometer semelhança semântica",()=>{
    const pack:any={winningExemplars:[{contentId:"a",observedTranscriptText:"Oi gente. Vamos começar?",structure:["pergunta"],quality:{}},{contentId:"b",observedTranscriptText:"Olá vocês. Tudo pronto?",structure:["pergunta"],quality:{}}]};
    const result=reviewScriptVoice("Fala: Neste momento apresentaremos uma longa exposição de conceitos e procedimentos administrativos necessários para organizar o planejamento semanal de maneira abrangente.",pack);
    expect(result.status).toBe("requires_editorial_review");
    expect(result.signals.find(s=>s.signal==="wordsPerSentence")).toMatchObject({divergent:true,evidenceContentIds:["a","b"]});
  });
  it("roteiros apenas planejados não estabelecem padrão de fala observada",()=>{
    expect(reviewScriptVoice("Fala: texto",{winningExemplars:[{plannedScriptText:"plano"}]} as any).status).toBe("insufficient");
  });
});
