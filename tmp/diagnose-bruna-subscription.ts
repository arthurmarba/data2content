import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Metric from "@/app/models/Metric";
import MapaSeed from "@/app/models/MapaSeed";

if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = "error";

async function main() {
  await connectToDatabase();
  const users: any[] = await User.find({
    $or: [
      { name: /bruna.*arruda|arruda.*bruna/i },
      { username: /brunaarruda/i },
      { email: /bruna.*arruda|arruda.*bruna/i },
      { whatsappPhone: /99676\D*0814/ },
    ],
  })
    .select("name email username whatsappPhone accountState mergedIntoUserId planStatus planType planInterval currentPeriodEnd planExpiresAt cancelAtPeriodEnd currency stripeCustomerId stripeSubscriptionId stripePriceId paymentGatewaySubscriptionId proTrialStatus proTrialActivatedAt proTrialExpiresAt isInstagramConnected instagramAccountId instagramAccessToken instagramAccessTokenExpiresAt lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorCode instagramSyncErrorMsg instagramDisconnectCount createdAt updatedAt")
    .lean();

  console.log(`Bruna Arruda: ${users.length} candidato(s)`);
  for (const u of users) {
    const [mapa, total, latest] = await Promise.all([
      MapaSeed.findOne({ userId: u._id }).select("mapa updatedAt").lean() as any,
      Metric.countDocuments({ user: u._id }),
      Metric.findOne({ user: u._id }).sort({ postDate: -1 }).select("postDate instagramMediaId stats").lean() as any,
    ]);
    console.log(JSON.stringify({
      id: String(u._id),
      name: u.name ?? null,
      email: u.email ?? null,
      username: u.username ?? null,
      phoneMatchesAttendee: String(u.whatsappPhone ?? "").replace(/\D/g, "").endsWith("21996760814"),
      accountState: u.accountState ?? null,
      mergedIntoUserId: u.mergedIntoUserId ? String(u.mergedIntoUserId) : null,
      subscription: {
        planStatus: u.planStatus ?? null,
        planType: u.planType ?? null,
        planInterval: u.planInterval ?? null,
        currentPeriodEnd: u.currentPeriodEnd ?? null,
        planExpiresAt: u.planExpiresAt ?? null,
        cancelAtPeriodEnd: Boolean(u.cancelAtPeriodEnd),
        currency: u.currency ?? null,
        stripeCustomerPresent: Boolean(u.stripeCustomerId),
        stripeSubscriptionPresent: Boolean(u.stripeSubscriptionId),
        stripePricePresent: Boolean(u.stripePriceId),
        paymentGatewaySubscriptionPresent: Boolean(u.paymentGatewaySubscriptionId),
        proTrialStatus: u.proTrialStatus ?? null,
        proTrialActivatedAt: u.proTrialActivatedAt ?? null,
        proTrialExpiresAt: u.proTrialExpiresAt ?? null,
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
        disconnectCount: u.instagramDisconnectCount ?? 0,
      },
      content: {
        totalMetrics: total,
        latestPostDate: latest?.postDate ?? null,
        latestPostId: latest?.instagramMediaId ?? null,
        mapPresent: Boolean(mapa),
      },
      createdAt: u.createdAt ?? null,
      updatedAt: u.updatedAt ?? null,
    }, null, 2));
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
