import { NextRequest, NextResponse } from 'next/server';
import { getAgencySession } from '@/lib/getAgencySession';
import UserModel from '@/app/models/User';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getAgencySession(req);
  if (!session?.user?.agencyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const guests = await UserModel.find({ agency: session.user.agencyId, role: 'guest' })
    .select('name email planStatus')
    .lean();

  const formatted = guests.map((g: any) => ({
    id: g._id.toString(),
    name: g.name || '',
    email: g.email,
    planStatus: g.planStatus,
  }));

  return NextResponse.json({ guests: formatted });
}
