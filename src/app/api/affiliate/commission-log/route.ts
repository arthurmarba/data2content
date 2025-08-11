import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { normCur } from "@/utils/normCur";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
  const curFilter = searchParams.get('currency');
  const statusFilter = searchParams.get('status');

  const user = await User.findById(session.user.id).select('commissionLog');
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  let items = (user.commissionLog || []).slice();
  if (curFilter) {
    const cur = normCur(curFilter);
    items = items.filter(i => (i.currency || '').toLowerCase() === cur);
  }
  if (statusFilter) {
    items = items.filter(i => i.status === statusFilter);
  }

  items.sort((a: any, b: any) => (b.date?.valueOf() || 0) - (a.date?.valueOf() || 0));

  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return NextResponse.json({
    items: paged,
    page,
    limit,
    total,
    hasMore: start + limit < total
  });
}
