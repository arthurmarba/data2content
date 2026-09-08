---
gerado: automaticamente
atualizado: 2026-09-08
---

> [!warning] Nota gerada por script — não edite à mão.
> Rode `npm run brain` para atualizar. Fonte: `scripts/brain/gerar-inventario.mjs`.

# Modelos do banco

Todo dado persistido é um modelo Mongoose. **84 modelos.**

A coluna *Coleção* só aparece quando o arquivo fixa o nome à mão; nos demais o Mongoose pluraliza o nome do modelo.

| Modelo | Coleção | Arquivo |
| --- | --- | --- |
| **AccountInsight** | `—` | `src/app/models/AccountInsight.ts` |
| **AdDeal** | `—` | `src/app/models/AdDeal.ts` |
| **AffiliateInvoiceIndex** | `—` | `src/app/models/AffiliateInvoiceIndex.ts` |
| **AffiliateInvoiceIndex** | `—` | `src/server/db/models/AffiliateIndexes.ts` |
| **AffiliateMigrationAudit** | `—` | `src/app/models/AffiliateMigrationAudit.ts` |
| **AffiliateRefundProgress** | `—` | `src/app/models/AffiliateRefundProgress.ts` |
| **AffiliateSubscriptionIndex** | `—` | `src/app/models/AffiliateSubscriptionIndex.ts` |
| **Agency** | `—` | `src/app/models/Agency.ts` |
| **AIGeneratedPost** | `—` | `src/app/models/AIGeneratedPost.ts` |
| **Alert** | `—` | `src/app/models/Alert.ts` |
| **BrandNarrativeProfile** | `brandnarrativeprofiles` | `src/app/models/BrandNarrativeProfile.ts` |
| **BrandNarrativeReport** | `brandnarrativereports` | `src/app/models/BrandNarrativeReport.ts` |
| **BrandProposal** | `—` | `src/app/models/BrandProposal.ts` |
| **Campaign** | `—` | `src/app/models/Campaign.ts` |
| **CampaignLink** | `—` | `src/app/models/CampaignLink.ts` |
| **CampaignRadarCandidate** | `campaign_radar_candidates` | `src/app/models/CampaignRadarCandidate.ts` |
| **CampaignRadarOpportunity** | `campaign_radar_opportunities` | `src/app/models/CampaignRadarOpportunity.ts` |
| **CampaignRadarRun** | `campaign_radar_runs` | `src/app/models/CampaignRadarRun.ts` |
| **CampaignRadarWeeklySelection** | `campaign_radar_weekly_selections` | `src/app/models/CampaignRadarWeeklySelection.ts` |
| **CarouselCaseDraft** | `—` | `src/app/models/CarouselCaseDraft.ts` |
| **ChatEvalCase** | `chat_eval_cases` | `src/app/models/ChatEvalCase.ts` |
| **ChatEvalRun** | `chat_eval_runs` | `src/app/models/ChatEvalRun.ts` |
| **ChatMessageFeedback** | `chat_message_feedback` | `src/app/models/ChatMessageFeedback.ts` |
| **ChatMessageLog** | `chat_message_logs` | `src/app/models/ChatMessageLog.ts` |
| **ChatSession** | `chat_sessions` | `src/app/models/ChatSession.ts` |
| **ChatSessionFeedback** | `chat_session_feedback` | `src/app/models/ChatSessionFeedback.ts` |
| **ChatSessionReview** | `chat_session_reviews` | `src/app/models/ChatSessionReview.ts` |
| **CollabInterest** | `—` | `src/app/models/CollabInterest.ts` |
| **CollabMatch** | `collabmatches` | `src/app/models/CollabMatch.ts` |
| **CommunityEvent** | `community_events` | `src/app/models/CommunityEvent.ts` |
| **CommunityInspiration** | `—` | `src/app/models/CommunityInspiration.ts` |
| **ContentReadingState** | `content_reading_states` | `src/app/models/ContentReadingState.ts` |
| **CpmHistory** | `—` | `src/app/models/CpmHistory.ts` |
| **CreatorContentIdea** | `creatorcontentideas` | `src/app/models/CreatorContentIdea.ts` |
| **CreatorMapConfirmations** | `creatormapconfirmations` | `src/app/models/CreatorMapConfirmations.ts` |
| **CreatorScriptDnaProfile** | `creator_script_dna_profiles` | `src/app/models/CreatorScriptDnaProfile.ts` |
| **CreatorStrategicProfileSnapshot** | `creatorstrategicprofilesnapshots` | `src/app/models/CreatorStrategicProfileSnapshot.ts` |
| **CreatorVideoNarrativeDiagnosis** | `creatorvideonarrativediagnoses` | `src/app/models/CreatorVideoNarrativeDiagnosis.ts` |
| **CreatorVideoNarrativeRealAnalysisUsage** | `creator_video_narrative_real_analysis_usage` | `src/app/models/CreatorVideoNarrativeRealAnalysisUsage.ts` |
| **CreatorWeeklyReport** | `creatorweeklyreports` | `src/app/models/CreatorWeeklyReport.ts` |
| **CronLock** | `—` | `src/server/db/models/CronLock.ts` |
| **DailyMetric** | `—` | `src/app/models/DailyMetric.ts` |
| **DailyMetricSnapshot** | `daily_metric_snapshots` | `src/app/models/DailyMetricSnapshot.ts` |
| **FeatureFlag** | `—` | `src/app/models/FeatureFlag.ts` |
| **GeminiShadowComparison** | `geminishadowcomparisons` | `src/app/models/GeminiShadowComparison.ts` |
| **GeminiUsageLog** | `geminiusagelogs` | `src/app/models/GeminiUsageLog.ts` |
| **MapaSeed** | `mapasseed` | `src/app/models/MapaSeed.ts` |
| **McpAdminAuditEvent** | `mcp_admin_audit_events` | `src/app/models/McpAdminAuditEvent.ts` |
| **McpOAuthAuthorizationCode** | `mcp_oauth_authorization_codes` | `src/app/models/McpOAuthAuthorizationCode.ts` |
| **McpOAuthClient** | `mcp_oauth_clients` | `src/app/models/McpOAuthClient.ts` |
| **McpOAuthConsentRequest** | `mcp_oauth_consent_requests` | `src/app/models/McpOAuthConsentRequest.ts` |
| **McpOAuthRefreshToken** | `mcp_oauth_refresh_tokens` | `src/app/models/McpOAuthRefreshToken.ts` |
| **MediaKitAccessLog** | `—` | `src/app/models/MediaKitAccessLog.ts` |
| **MediaKitPackage** | `—` | `src/app/models/MediaKitPackage.ts` |
| **MediaKitPdfCache** | `—` | `src/app/models/MediaKitPdfCache.ts` |
| **MediaKitSlugAlias** | `—` | `src/app/models/MediaKitSlugAlias.ts` |
| **Message** | `—` | `src/app/models/Message.ts` |
| **Metric** | `—` | `src/app/models/Metric.ts` |
| **PerPautaCollabCache** | `—` | `src/app/models/PerPautaCollabCache.ts` |
| **PlannerPlan** | `planner_plans` | `src/app/models/PlannerPlan.ts` |
| **PlannerRecCache** | `—` | `src/app/models/PlannerRecCache.ts` |
| **PlanningRecommendationFeedback** | `planning_recommendation_feedback` | `src/app/models/PlanningRecommendationFeedback.ts` |
| **PostCreationDraft** | `post_creation_drafts` | `src/app/models/PostCreationDraft.ts` |
| **PostCreationFunnelEvent** | `post_creation_funnel_events` | `src/app/models/PostCreationFunnelEvent.ts` |
| **PostReview** | `—` | `src/app/models/PostReview.ts` |
| **PubliCalculation** | `—` | `src/app/models/PubliCalculation.ts` |
| **PublishedContentEvidence** | `published_content_evidence` | `src/app/models/PublishedContentEvidence.ts` |
| **Redemption** | `—` | `src/app/models/Redemption.ts` |
| **ScriptEntry** | `script_entries` | `src/app/models/ScriptEntry.ts` |
| **ScriptEvidenceSession** | `script_evidence_sessions` | `src/app/models/ScriptEvidenceSession.ts` |
| **ScriptOutcomeProfile** | `script_outcome_profiles` | `src/app/models/ScriptOutcomeProfile.ts` |
| **ScriptStyleProfile** | `script_style_profiles` | `src/app/models/ScriptStyleProfile.ts` |
| **SegmentRadar** | `—` | `src/app/models/SegmentRadar.ts` |
| **SharedLink** | `—` | `src/app/models/SharedLink.ts` |
| **StoryMetric** | `—` | `src/app/models/StoryMetric.ts` |
| **StrategicReport** | `—` | `src/app/models/StrategicReport.ts` |
| **Thread** | `—` | `src/app/models/Thread.ts` |
| **UsageEvent** | `usage_events` | `src/app/models/UsageEvent.ts` |
| **User** | `—` | `src/app/models/User.ts` |
| **User** | `—` | `src/server/db/models/User.ts` |
| **UserUsageSnapshot** | `user_usage_snapshots` | `src/app/models/UserUsageSnapshot.ts` |
| **VideoAsset** | `videoassets` | `src/app/models/VideoAsset.ts` |
| **WeeklyReportPrediction** | `weekly_report_predictions` | `src/app/models/WeeklyReportPrediction.ts` |
| **WeeklyTerritoryReport** | `weekly_territory_reports` | `src/app/models/WeeklyTerritoryReport.ts` |
