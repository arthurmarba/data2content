import { Types } from 'mongoose';
import Metric from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { PROFILE_POLICY_VERSION, hasScene, observedSubjects, uniqueMetrics } from '@/app/lib/creatorWeeklyReport/evolution';
import type { CreatorWeeklyReportMetricInput } from '@/app/lib/creatorWeeklyReport/engine';
import type { ContentIdeasCreativeSignals } from '@/app/dashboard/boards/videoUpload/contentIdeaOpportunity';
import { buildCreatorEngagementBaselineFromMetrics } from '@/app/dashboard/boards/videoUpload/creatorEngagementBaselineService';
export function creativeEvidence(metrics: CreatorWeeklyReportMetricInput[], now = new Date()): ContentIdeasCreativeSignals {
  const recent = uniqueMetrics(metrics).filter(metric => new Date(metric.postDate).getTime() >= now.getTime() - 28 * 86400000);
  const read = recent.filter(hasScene);
  const baseline = buildCreatorEngagementBaselineFromMetrics(read as any);
  const subjects = observedSubjects(read, now);
  const readingCoverage = recent.length ? read.length / recent.length : 0;
  return {
    postsAnalyzed: read.length, windowDays: 28, confidence: read.length >= 3 && readingCoverage >= 0.8 ? 'medium' : 'low',
    subject: subjects[0]?.label || null, place: baseline.patterns.place?.label || null,
    object: baseline.patterns.object?.label || null, framing: baseline.patterns.framing?.label || null, tone: baseline.patterns.tone?.label || null,
    openingLines: read.flatMap(metric => typeof metric.sceneElements?.openingLine === "string" ? [metric.sceneElements.openingLine] : []).slice(0, 4),
    screenTitles: read.flatMap(metric => typeof metric.sceneElements?.screenTitle === "string" ? [metric.sceneElements.screenTitle] : []).slice(0, 4),
    evidence: read.slice(0, 12).map(metric => ({ postId: String(metric._id), postLink: metric.postLink || null, publishedAt: new Date(metric.postDate).toISOString() })),
    policyVersion: PROFILE_POLICY_VERSION, readingCoverage,
  };
}
export async function readCreativeEvidence(userId: string) {
  await connectToDatabase();
  const metrics = await Metric.find({ user: new Types.ObjectId(userId), postDate: { $gte: new Date(Date.now() - 28 * 86400000) } }).select('_id instagramMediaId type postDate postLink sceneElements stats').sort({ postDate: -1 }).limit(200).lean();
  return creativeEvidence(metrics as unknown as CreatorWeeklyReportMetricInput[]);
}
