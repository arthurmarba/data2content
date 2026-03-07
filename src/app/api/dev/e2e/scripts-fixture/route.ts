import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import UserModel from "@/app/models/User";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = (await getServerSession(authOptions)) as any;
  const userId = session?.user?.id;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  await connectToDatabase();

  await UserModel.findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        planStatus: "active",
        proTrialStatus: "active",
      },
      $setOnInsert: {
        _id: userId,
        // Dev/E2E user uses a synthetic email to avoid collisions with any real seeded account.
        email: `${userId}@data2content.test`,
        name:
          typeof session?.user?.name === "string" && session.user.name.trim()
            ? session.user.name.trim()
            : "E2E Test User",
        role: "user",
      },
    },
    { new: false, upsert: true, setDefaultsOnInsert: true }
  ).exec();

  const now = new Date();
  const label = `E2E roteiro ${now.toISOString()}`;
  const instagramMediaId = `e2e-script-${userId}-${now.getTime()}`;

  const metric = await Metric.findOneAndUpdate(
    {
      user: new Types.ObjectId(userId),
      instagramMediaId,
    },
    {
      $setOnInsert: {
        user: new Types.ObjectId(userId),
        instagramMediaId,
        postLink: `https://instagram.com/p/${instagramMediaId}`,
        description: `${label} conteudo publicado para vinculo.`,
        postDate: now,
        type: "REEL",
        format: ["reel"],
        proposal: [],
        context: [],
        tone: [],
        references: [],
        source: "manual",
        classificationStatus: "completed",
        rawData: [],
        stats: {
          total_interactions: 321,
          engagement: 7.89,
        },
        isPubli: false,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  )
    .select("_id description postLink postDate stats.total_interactions stats.engagement")
    .lean()
    .exec();

  return NextResponse.json({
    ok: true,
    content: {
      id: String(metric?._id),
      caption: metric?.description || label,
      postLink: metric?.postLink || null,
      postDate: metric?.postDate ? new Date(metric.postDate).toISOString() : null,
    },
  });
}
