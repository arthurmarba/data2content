import { NextResponse } from 'next/server';
import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';
import { MONTHLY_PRICE } from '@/config/pricing.config';

export async function GET() {
  const activeAgencies = await AgencyModel.countDocuments({ planStatus: 'active' });
  const usersCount = await UserModel.countDocuments({ role: 'user' });
  const guestsCount = await UserModel.countDocuments({ role: 'guest' });
  const activeCreators = await UserModel.countDocuments({ planStatus: 'active', role: { $in: ['user', 'guest'] } });

  const agencyMrr = activeAgencies * Number(process.env.AGENCY_MONTHLY_PRICE || '99');
  const creatorMrr = activeCreators * MONTHLY_PRICE;

  return NextResponse.json({
    activeAgencies,
    creators: { users: usersCount, guests: guestsCount },
    mrr: {
      agencies: agencyMrr,
      creators: creatorMrr,
      total: agencyMrr + creatorMrr,
    },
  });
}
