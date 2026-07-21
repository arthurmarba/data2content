import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Metric from "@/app/models/Metric";
import MapaSeed from "@/app/models/MapaSeed";
import AccountInsight from "@/app/models/AccountInsight";

if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = "error";

async function main() {
  await connectToDatabase();
  const users: any[] = await User.find({
    $or: [
      { name: /bruna.*ramos|ramos.*bruna/i },
      { username: /bruna.*ramos|ramos.*bruna/i },
      { email: /bruna.*ramos|ramos.*bruna/i },
      { whatsappPhone: /99676\D*0814/ },
    ],
  })
    .select("name email username whatsappPhone accountState mergedIntoUserId planStatus planType currentPeriodEnd planExpiresAt proTrialStatus isInstagramConnected instagramAccountId instagramAccessToken instagramAccessTokenExpiresAt lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorCode instagramSyncErrorMsg createdAt updatedAt")
    .lean();

  console.log(`Bruna Ramos: ${users.length} candidato(s)`);
  const de = new Date("2026-07-10T00:00:00.000Z");
  const ate = new Date("2026-07-16T23:59:59.999Z");
  for (const u of users) {
    const [mapa, total, week, latest, insight] = await Promise.all([
      MapaSeed.findOne({ userId: u._id }).select("mapa updatedAt").lean() as any,
      Metric.countDocuments({ user: u._id }),
      Metric.find({ user: u._id, postDate: { $gte: de, $lte: ate } })
        .sort({ postDate: 1 })
        .select("postDate instagramMediaId description proposal context tone stats")
        .lean() as any,
      Metric.find({ user: u._id })
        .sort({ postDate: -1 })
        .limit(6)
        .select("postDate instagramMediaId description proposal context tone stats")
        .lean() as any,
      AccountInsight.findOne({ user: u._id }).sort({ recordedAt: -1 }).select("recordedAt accountDetails.username accountDetails.profile_picture_url accountDetails.followers_count").lean() as any,
    ]);
    const post = (p: any) => ({
      postDate: p.postDate ?? null,
      postId: p.instagramMediaId ?? null,
      description: p.description?.replace(/\s+/g, " ").slice(0, 320) ?? null,
      proposal: p.proposal ?? [],
      context: p.context ?? [],
      tone: p.tone ?? [],
      stats: {
        saved: p.stats?.saved ?? null,
        shares: p.stats?.shares ?? null,
        comments: p.stats?.comments ?? null,
        total_interactions: p.stats?.total_interactions ?? null,
      },
    });
    console.log(JSON.stringify({
      id: String(u._id),
      name: u.name ?? null,
      email: u.email ?? null,
      username: u.username ?? null,
      phoneMatchesAttendee: String(u.whatsappPhone ?? "").replace(/\D/g, "").endsWith("21996760814"),
      subscription: {
        planStatus: u.planStatus ?? null,
        planType: u.planType ?? null,
        currentPeriodEnd: u.currentPeriodEnd ?? null,
        planExpiresAt: u.planExpiresAt ?? null,
        proTrialStatus: u.proTrialStatus ?? null,
      },
      instagram: {
        connected: Boolean(u.isInstagramConnected),
        accountIdPresent: Boolean(u.instagramAccountId),
        tokenPresent: Boolean(u.instagramAccessToken),
        tokenExpiresAt: u.instagramAccessTokenExpiresAt ?? null,
        lastSyncAttempt: u.lastInstagramSyncAttempt ?? null,
        lastSyncSuccess: u.lastInstagramSyncSuccess ?? null,
        syncErrorCode: u.instagramSyncErrorCode ?? null,
        syncErrorMsg: u.instagramSyncErrorMsg ?? null,
      },
      metrics: { total, week: week.map(post), latest: latest.map(post) },
      map: mapa?.mapa ?? null,
      mapUpdatedAt: mapa?.updatedAt ?? null,
      insight: insight ? {
        recordedAt: insight.recordedAt ?? null,
        username: insight.accountDetails?.username ?? null,
        profilePicturePresent: Boolean(insight.accountDetails?.profile_picture_url),
        followers: insight.accountDetails?.followers_count ?? null,
      } : null,
    }, null, 2));
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
