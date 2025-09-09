# Strategic Report MVP — Phase 0 Decisions

Status: accepted

## Scope

Establish contracts, guardrails, and storage for the strategic report before building the data pipeline and UI.

## Contracts

- Type definitions live in `types/StrategicReport.ts`.
- Default period: 30 days.
- Output sections: meta, summary, keyInsights, scriptSuggestions, correlations, communityInspirations, commercialOpportunities, weeklyPlan, evidence.

## Confidence & Evidence

- Minimum total posts to generate report: 20 (`MIN_POSTS_FOR_REPORT`).
- Minimum per-bucket sample to promote an insight without low-confidence flag: 8 (`MIN_SAMPLE_PER_GROUP`).
- Confidence from sample: `sqrt(n)/8` clamped to `[0,1]`.
- Minimum uplift to highlight: 10 percentage points; smaller effects are shown as minor or omitted.
- All statements in narrative must reference one or more `evidenceRefs` with `n` and `deltaPct` when applicable.

## Caching & Expiration

- Persisted cache collection: `StrategicReport`.
- TTL: 7 days. Documents self-expire via TTL index on `expiresAt`.
- Latest ready-by `(user, periodDays, version)` is the default GET response.

## Versioning

- `STRATEGIC_REPORT_VERSION = 1.0.0`. Any material change to computation bumps version.

## Gating

- Access to GET/POST API is gated by Pro plan (via `planGuard`).

## Acceptance Criteria (Phase 0)

- Type contracts compile and are imported without cycles.
- Constants exported and used by later phases.
- Mongoose model created with TTL index and helper index for retrieval.

## Open Questions

- PDF export is out of Phase 0; to be decided in Phase 5.
- Partial uniqueness for latest ready doc: for MVP, fetch by sort desc on `generatedAt`.

