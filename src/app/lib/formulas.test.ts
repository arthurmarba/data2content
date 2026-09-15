import { calcFormulas } from './formulas';
import { rawRetention } from './relatorio/postMetrics';
import { metricPerformance } from './scripts/scriptEvidenceSelection';
it.each(['IMAGE', 'CAROUSEL_ALBUM'])('não atribui retenção nem tempo de vídeo a %s, mesmo com dados antigos', type => {
 const stats = {video_duration_seconds:20,average_video_watch_time_seconds:10,ig_reels_avg_watch_time:10000};
 expect(calcFormulas([stats],type).retention_rate).toBeNull();
 expect(rawRetention(stats,type)).toBeNull();
 expect(metricPerformance({type,stats})).toMatchObject({durationSeconds:null,averageWatchTimeSeconds:null});
});
it('distingue vídeo sem medida de vídeo com retenção zero', () => {
 expect(calcFormulas([{video_duration_seconds:20}], 'VIDEO').retention_rate).toBeNull();
 expect(calcFormulas([{video_duration_seconds:20,average_video_watch_time_seconds:0}], 'REEL').retention_rate).toBe(0);
 expect(calcFormulas([{video_duration_seconds:20,average_video_watch_time_seconds:10}], 'REEL').retention_rate).toBe(0.5);
});
