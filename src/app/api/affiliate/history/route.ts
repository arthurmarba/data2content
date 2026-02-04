import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Redemption from '@/app/models/Redemption';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const take = clamp(Number(searchParams.get('take')) || 20, 10, 50);
  const currency = searchParams.get('currency')?.toUpperCase() || null;
  const statusFilter = (searchParams.get('status') || '')
    .split(',')
    .filter(Boolean);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : null;
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : null;

  let curDate: Date | null = null;
  let curId: Types.ObjectId | null = null;
  const cursorParam = searchParams.get('cursor');
  if (cursorParam) {
    try {
      const c = JSON.parse(Buffer.from(cursorParam, 'base64').toString('utf8'));
      if (c.createdAt) curDate = new Date(c.createdAt);
      if (c.id) curId = new Types.ObjectId(c.id);
    } catch {
      // ignore invalid cursor
    }
  }

  await connectToDatabase();
  const userId = new Types.ObjectId(session.user.id);

  // commissions stored in User.commissionLog
  const user = await User.findById(userId, 'commissionLog').lean();
  const commissionsRaw: any[] = user?.commissionLog || [];
  let commissionItems = commissionsRaw.map((c) => ({
    id: c._id.toString(),
    kind: 'commission',
    currency: (c.currency || '').toUpperCase(),
    amountCents: c.amountCents,
    status: c.status,
    createdAt: c.createdAt,
    availableAt: c.availableAt ?? null,
    invoiceId: c.invoiceId ?? null,
    subscriptionId: c.subscriptionId ?? null,
    transferId: null,
    reasonCode: c.reasonCode ?? null,
    notes: c.note ?? null,
  }));

  // redemptions
  const match: any = { userId };
  if (currency) match.currency = currency.toLowerCase();
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }
  const redemptions = await Redemption.find(match).lean();
  const redemptionItems = redemptions
    .map((r: any) => {
      if (r.status === 'requested') return null; // ignore solicitações ainda em análise
      let status = r.status === 'paid' ? 'paid' : 'reversed';
      let reasonCode = r.reasonCode || null;
      if (r.status === 'rejected') {
        status = 'reversed';
        reasonCode = r.reasonCode || 'payout_rejected';
      }
      return {
        id: r._id.toString(),
        kind: 'redemption',
        currency: (r.currency || '').toUpperCase(),
        amountCents: r.amountCents,
        status,
        createdAt: r.createdAt,
        availableAt: null,
        invoiceId: null,
        subscriptionId: null,
        transferId: r.transferId ?? null,
        reasonCode,
        notes: r.notes ?? null,
      };
    })
    .filter(Boolean) as any[];

  let items = [...commissionItems, ...redemptionItems];

  if (currency) {
    items = items.filter((i) => i.currency === currency);
  }
  if (from) {
    items = items.filter((i) => new Date(i.createdAt) >= from!);
  }
  if (to) {
    items = items.filter((i) => new Date(i.createdAt) <= to!);
  }
  if (statusFilter.length) {
    items = items.filter((i) => statusFilter.includes(i.status));
  }

  items.sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    if (db !== da) return db - da;
    return b.id.localeCompare(a.id);
  });

  if (curDate && curId) {
    items = items.filter((i) => {
      const d = new Date(i.createdAt).getTime();
      if (d < curDate!.getTime()) return true;
      if (d > curDate!.getTime()) return false;
      return i.id < curId!.toString();
    });
  }

  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  const last = page[page.length - 1];
  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString('base64')
    : null;

  return NextResponse.json(
    { items: page, nextCursor },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
