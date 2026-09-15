/** @jest-environment node */
import { getMcpDeepContentAnalysis } from './catalog';
import Metric from '@/app/models/Metric';
import Evidence from '@/app/models/PublishedContentEvidence';
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/Metric', () => ({ __esModule:true, default:{findOne:jest.fn()} }));
jest.mock('@/app/models/PublishedContentEvidence', () => ({ __esModule:true, default:{findOne:jest.fn()} }));
jest.mock('@/app/lib/scripts/intelligenceContext', () => ({}));
jest.mock('@/app/lib/scripts/ai', () => ({}));
jest.mock('@/app/lib/scripts/creatorScriptGenerationV3', () => ({}));
jest.mock('@/app/lib/planner/collabCreatorSuggestionsService', () => ({}));
jest.mock('./creatorMap', () => ({}));
jest.mock('./communityResearch', () => ({}));
it('mostra slides sem inventar retenção nem liberar transcrição sem pedido', async () => {
 const id='69e8f96564be9f1592a5ca6e';
 (Metric.findOne as jest.Mock).mockReturnValue({select:()=>({lean:async()=>({_id:id,type:'CAROUSEL_ALBUM',stats:{retention_rate:0.5,video_duration_seconds:20,ig_reels_avg_watch_time:10000}})})});
 (Evidence.findOne as jest.Mock).mockReturnValue({select:()=>({lean:async()=>({slides:[{position:1,type:'VIDEO',description:'Demonstração',transcript:'fala privada'}],visualCoverage:{expected:1,analyzed:1,complete:true}})})});
 const result=await getMcpDeepContentAnalysis({userId:id,contentId:id});
 expect(result?.metrics).toMatchObject({retentionRate:null,averageWatchTime:null});
 expect(result?.content.durationSeconds).toBeNull();
 expect(result?.visualAndSpeech.slides[0].transcript).toBeNull();
 const authorized=await getMcpDeepContentAnalysis({userId:id,contentId:id,includeTranscript:true});
 expect(authorized?.visualAndSpeech.slides[0].transcript).toBe('fala privada');
});
