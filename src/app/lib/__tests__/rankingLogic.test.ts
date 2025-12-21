
import { rankCandidates } from '../ai/answerEngine/ranker';
import { resolvePolicy } from '../ai/answerEngine/policies';
import { CandidatePost, UserBaselines, AnswerEnginePolicy, Thresholds } from '../ai/answerEngine/types';

describe('Strict Double-Gate Ranking Logic (Phase 3)', () => {
    // Mock Base Data
    const mockBaselines: UserBaselines = {
        totalInteractionsP50: 100,
        engagementRateP50: 0.05, // 5%
        perFormat: {},
        sampleSize: 50,
        computedAt: Date.now(),
        windowDays: 90
    };

    // Phase 3 Thresholds
    // Abs Gate: max(P75, Med*1.5, MinAbs) -> Let's assume P75 is 150, Med*1.5 is 150. MinAbs is 30.
    // Quality Gate: max(P60_ER, Med_ER*1.15) -> Let's assume P60 is 0.06, Med*1.15 is 0.0575.
    const mockThresholds: Thresholds = {
        minAbsolute: 30,
        minRelativeInteractions: 125,
        minRelativeEr: 0.0575,
        effectiveInteractions: 150, // Strict Target
        effectiveEr: 0.06, // Strict Quality Target (6%)
        baselineInteractionP50: 100,
        baselineInteractionP75: 150,
        baselineErP50: 0.05,
        baselineErP60: 0.06,
        strictMode: true
    };

    const mockPolicy: AnswerEnginePolicy & { thresholds: Thresholds } = {
        intent: 'top_performance_inspirations',
        requireHighEngagement: true,
        maxPosts: 5,
        windowDays: 90,
        thresholds: mockThresholds
    };

    const createCandidate = (id: string, interactions: number, er: number): CandidatePost => ({
        id,
        stats: {
            total_interactions: interactions,
            engagement_rate_on_reach: er,
            reach: 1000,
            commments: 10,
            shares: 5,
            saves: 5
        }
    } as any);

    it('Scenario A: High Interactions, Low ER (Should Fail)', () => {
        // 200 interactions (> 150), but 3% ER (< 6%)
        const candidate = createCandidate('postA', 200, 0.03);
        const ranked = rankCandidates([candidate], {
            policy: mockPolicy,
            baselines: mockBaselines
        });

        const result = ranked[0];
        expect(result.passesThreshold).toBe(false);
        expect(result.score).toBe(0); // Boost shouldn't save it in strict mode
    });

    it('Scenario B: Low Interactions, High ER (Should Fail)', () => {
        // 140 interactions (< 150), but 10% ER (> 6%)
        const candidate = createCandidate('postB', 140, 0.10);
        const ranked = rankCandidates([candidate], {
            policy: mockPolicy,
            baselines: mockBaselines
        });

        const result = ranked[0];
        expect(result.passesThreshold).toBe(false);
        expect(result.score).toBe(0);
    });

    it('Scenario C: High Interactions, High ER (Should Pass)', () => {
        // 200 interactions (> 150), 8% ER (> 6%)
        const candidate = createCandidate('postC', 200, 0.08);
        const ranked = rankCandidates([candidate], {
            policy: mockPolicy,
            baselines: mockBaselines
        });

        const result = ranked[0];
        expect(result.passesThreshold).toBe(true);
        expect(result.score).toBeGreaterThan(0);
    });

    it('Scenario D: Just on the line (Should Pass)', () => {
        // Exactly 150 interactions, Exactly 6% ER
        const candidate = createCandidate('postD', 150, 0.06);
        const ranked = rankCandidates([candidate], {
            policy: mockPolicy,
            baselines: mockBaselines
        });

        const result = ranked[0];
        expect(result.passesThreshold).toBe(true);
    });
});
