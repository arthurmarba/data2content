import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Redemption from "@/app/models/Redemption";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { notes } = await req.json();
  await connectToDatabase();
  const red = await Redemption.findById(params.id);
  if (!red) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  red.notes = String(notes ?? "").slice(0, 1000);
  await red.save();
  return NextResponse.json({ ok: true });
}

