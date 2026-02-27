import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = (await getServerSession(authOptions)) as any;
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  await connectToDatabase();

  const updated = await UserModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        planStatus: "active",
        proTrialStatus: "active",
      },
    },
    { new: true }
  )
    .select("_id email planStatus proTrialStatus role")
    .lean();

  if (!updated) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: String(updated._id),
      email: updated.email ?? null,
      role: updated.role ?? null,
      planStatus: updated.planStatus ?? null,
      proTrialStatus: updated.proTrialStatus ?? null,
    },
  });
}
