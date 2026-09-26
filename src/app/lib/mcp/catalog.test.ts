/** @jest-environment node */
import { getMcpDeepContentAnalysis, sharedMapTerritories } from './catalog';
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
jest.mock('./collabIntelligence', () => ({}));
jest.mock('./communityResearch', () => ({}));
it('mostra slides sem inventar retenção nem liberar transcrição sem pedido', async () => {
 const id='69e8f96564be9f1592a5ca6e';
 (Metric.findOne as jest.Mock).mockReturnValue({select:()=>({lean:async()=>({_id:id,type:'CAROUSEL_ALBUM',stats:{retention_rate:0.5,video_duration_seconds:20,ig_reels_avg_watch_time:10000}})})});
 (Evidence.findOne as jest.Mock).mockReturnValue({select:()=>({lean:async()=>({slides:[{position:1,type:'VIDEO',description:'Demonstração',transcript:'fala privada'}],visualCoverage:{expected:1,analyzed:1,complete:true}})})});
 const result=await getMcpDeepContentAnalysis({userId:id,contentId:id});
 expect(result?.metrics).toMatchObject({retentionRate:null,averageWatchTimeSeconds:null});
 expect(result?.content.durationSeconds).toBeNull();
 expect(result?.visualAndSpeech.slides[0].transcript).toBeNull();
 const authorized=await getMcpDeepContentAnalysis({userId:id,contentId:id,includeTranscript:true});
 expect(authorized?.visualAndSpeech.slides[0].transcript).toBe('fala privada');
});
it('converte tempo para segundos e não transforma taxa sem denominador em zero', async () => {
 const id='69e8f96564be9f1592a5ca6e';
 (Metric.findOne as jest.Mock).mockReturnValue({select:()=>({lean:async()=>({_id:id,type:'REEL',stats:{reach:0,profile_visits:0,follower_conversion_rate:0,engagement_rate_on_reach:0,propagation_index:0,ig_reels_avg_watch_time:4520,retention_rate:0.35}})})});
 (Evidence.findOne as jest.Mock).mockReturnValue({select:()=>({lean:async()=>null})});
 const result=await getMcpDeepContentAnalysis({userId:id,contentId:id});
 expect(result?.metrics).toMatchObject({averageWatchTimeSeconds:4.5,retentionRate:0.35,followerConversionRate:null,engagementRateOnReach:null,propagationIndex:null});
});
it('só diz que dividem território quando os dois mapas têm o mesmo assunto', () => {
 expect(sharedMapTerritories(['Maternidade', 'Humor de casal', 'IA'], ['maternidade real', 'Receitas'])).toEqual(['Maternidade']);
 expect(sharedMapTerritories(['Paternidade'], ['Gastronomia'])).toEqual([]);
 // Rótulo curto demais casaria com qualquer coisa.
 expect(sharedMapTerritories(['IA'], ['IA para creators'])).toEqual([]);
});

