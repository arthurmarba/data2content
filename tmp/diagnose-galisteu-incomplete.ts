import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Metric from "@/app/models/Metric";
import MapaSeed from "@/app/models/MapaSeed";
import AccountInsight from "@/app/models/AccountInsight";

if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = "error";

const targets = [
  { label: "Blu", rx: /blu/i },
  { label: "Debora", rx: /d[eé]bora|deborah/i },
  { label: "Camila Barros", rx: /camila.*barros|barros.*camila/i },
  { label: "Bruna Arruda", rx: /bruna.*arruda|arruda.*bruna/i },
];

async function main() {
  await connectToDatabase();
  const now = new Date("2026-07-16T23:59:59.999Z");
  const since7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  since7.setUTCHours(0, 0, 0, 0);
  const since30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  since30.setUTCHours(0, 0, 0, 0);

  for (const target of targets) {
    const users: any[] = await User.find({
      $or: [
        { name: target.rx },
        { username: target.rx },
        ...(target.label === "Bruna Arruda" ? [{ whatsappPhone: /21996760814/ }] : []),
      ],
    })
      .select(
        "name username accountState mergedIntoUserId isInstagramConnected instagramAccountId instagramAccessToken instagramAccessTokenExpiresAt lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorCode instagramSyncErrorMsg profile_picture_url followers_count media_count createdAt updatedAt whatsappPhone",
      )
      .lean();

    console.log(`\n## ${target.label}: ${users.length} candidato(s)`);
    for (const u of users) {
      const [mapa, metricStats, latest, recent, insight] = await Promise.all([
        MapaSeed.findOne({ userId: u._id }).select("mapa updatedAt editedSections").lean() as any,
        Metric.aggregate([
          { $match: { user: u._id } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              in7: { $sum: { $cond: [{ $and: [{ $gte: ["$postDate", since7] }, { $lte: ["$postDate", now] }] }, 1, 0] } },
              in30: { $sum: { $cond: [{ $and: [{ $gte: ["$postDate", since30] }, { $lte: ["$postDate", now] }] }, 1, 0] } },
              latest: { $max: "$postDate" },
            },
          },
        ]),
        Metric.findOne({ user: u._id })
          .sort({ postDate: -1 })
          .select("postDate instagramMediaId postLink description stats")
          .lean() as any,
        Metric.find({ user: u._id })
          .sort({ postDate: -1 })
          .limit(5)
          .select("postDate instagramMediaId description proposal context tone stats")
          .lean() as any,
        AccountInsight.findOne({ user: u._id }).sort({ recordedAt: -1 }).select("recordedAt accountDetails.username accountDetails.profile_picture_url").lean() as any,
      ]);
      const s = metricStats[0] ?? { total: 0, in7: 0, in30: 0, latest: null };
      console.log(JSON.stringify({
        id: String(u._id),
        name: u.name ?? null,
        username: u.username ?? null,
        accountState: u.accountState ?? null,
        mergedIntoUserId: u.mergedIntoUserId ? String(u.mergedIntoUserId) : null,
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
        metrics: {
          total: s.total,
          in7: s.in7,
          in30: s.in30,
          latest: s.latest ?? null,
          latestPostId: latest?.instagramMediaId ?? null,
          latestDescription: latest?.description?.replace(/\s+/g, " ").slice(0, 100) ?? null,
          recent: recent.map((post: any) => ({
            postDate: post.postDate ?? null,
            postId: post.instagramMediaId ?? null,
            description: post.description?.replace(/\s+/g, " ").slice(0, 180) ?? null,
            proposal: post.proposal ?? [],
            context: post.context ?? [],
            tone: post.tone ?? [],
            stats: {
              saved: post.stats?.saved ?? null,
              shares: post.stats?.shares ?? null,
              comments: post.stats?.comments ?? null,
              total_interactions: post.stats?.total_interactions ?? null,
            },
          })),
        },
        map: mapa ? {
          narrativa: mapa.mapa?.narrativa_central ?? null,
          territorios: mapa.mapa?.territorios ?? [],
          temas: mapa.mapa?.temas ?? [],
          assets: mapa.mapa?.assets ?? [],
          tom: mapa.mapa?.tom ?? null,
          updatedAt: mapa.updatedAt ?? null,
        } : null,
        latestInsight: insight ? {
          recordedAt: insight.recordedAt ?? null,
          username: insight.accountDetails?.username ?? null,
          profilePicturePresent: Boolean(insight.accountDetails?.profile_picture_url),
        } : null,
        updatedAt: u.updatedAt ?? null,
      }, null, 2));
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
