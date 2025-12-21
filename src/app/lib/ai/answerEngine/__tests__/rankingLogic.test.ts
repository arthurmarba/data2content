/**
 * @jest-environment node
 */
import { rankCandidates } from '../ranker';
import { buildThresholds } from '../policies';
import type { AnswerEnginePolicy, CandidatePost, UserBaselines } from '../types';

describe('rankingLogic - Double Gate (Phase 3)', () => {
    const baselines: UserBaselines = {
        totalInteractionsP50: 100,
        totalInteractionsP75: 150,
        totalInteractionsP90: 250,
        engagementRateP50: 0.05,
        engagementRateP60: 0.06,
        perFormat: {},
        sampleSize: 50,
        computedAt: Date.now(),
        windowDays: 90,
    };

    // Rule A (Absolute): max(P75, median * 1.5, minAbs) -> max(150, 150, 80) = 150
    // Rule B (Quality): max(P60_ER, median_ER * 1.15) -> max(0.06, 0.0575) = 0.06
    const thresholds = buildThresholds(baselines, 12000); // followers=12k -> minAbs=80

    const policy: AnswerEnginePolicy & { thresholds: typeof thresholds } = {
        intent: 'top_performance_inspirations',
        requireHighEngagement: true,
        maxPosts: 5,
        windowDays: 90,
        thresholds: {
            ...thresholds,
            strictMode: true
        }
    };

    it('Passes only if it meets BOTH Interaction Gate (A) and ER Quality Gate (B)', () => {
        const candidates: CandidatePost[] = [
            {
                id: 'gold-standard', // Passes A (200 >= 150) and B (0.07 >= 0.06)
                stats: { total_interactions: 200, reach: 2800, engagement_rate_on_reach: 0.07 },
            },
            {
                id: 'high-interactions-low-er', // Passes A (300 >= 150) but Fails B (0.02 < 0.06)
                stats: { total_interactions: 300, reach: 15000, engagement_rate_on_reach: 0.02 },
            },
            {
                id: 'low-interactions-high-er', // Fails A (120 < 150) but Passes B (0.10 > 0.06)
                stats: { total_interactions: 120, reach: 1200, engagement_rate_on_reach: 0.10 },
            },
        ];

        const ranked = rankCandidates(candidates, { policy, baselines });

        expect(ranked.length).toBe(1);
        expect(ranked[0]!.id).toBe('gold-standard');
        expect(ranked[0]!.passesThreshold).toBe(true);
    });

    it('Resets score to 0 if post fails thresholds in strictMode, ensuring boosts dont rescue it', () => {
        const policyWithBoost = {
            ...policy,
            thresholds: { ...policy.thresholds, strictMode: true }
        };

        const candidates: CandidatePost[] = [
            {
                id: 'failed-but-boosted',
                format: ['reel'], // Favored format
                stats: { total_interactions: 10, reach: 100, engagement_rate_on_reach: 0.01 },
            }
        ];

        const ranked = rankCandidates(candidates, {
            policy: policyWithBoost,
            baselines,
            profileSignals: { formatos_preferidos: ['reel'] }
        });

        // In strictMode, it should be filtered out or have score 0
        // Actually our filter removes it: .filter(c => options.policy.thresholds.strictMode ? c.passesThreshold : true)
        expect(ranked.length).toBe(0);
    });

    it('Yields empty results if no posts pass the double gate', () => {
        const candidates: CandidatePost[] = [
            {
                id: 'junk-1',
                stats: { total_interactions: 5, reach: 100, engagement_rate_on_reach: 0.01 },
            },
            {
                id: 'junk-2',
                stats: { total_interactions: 10, reach: 200, engagement_rate_on_reach: 0.01 },
            }
        ];

        const ranked = rankCandidates(candidates, { policy, baselines });
        expect(ranked.length).toBe(0);
    });
});
