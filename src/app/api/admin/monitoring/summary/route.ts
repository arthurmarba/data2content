import { NextResponse } from 'next/server';
import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';
import {
  MONTHLY_PRICE,
  ANNUAL_MONTHLY_PRICE,
  AGENCY_GUEST_MONTHLY_PRICE,
  AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
  AGENCY_MONTHLY_PRICE,
} from '@/config/pricing.config';

export async function GET() {
  const activeAgencies = await AgencyModel.countDocuments({ planStatus: 'active' });
  const usersCount = await UserModel.countDocuments({ role: 'user' });
  const guestsCount = await UserModel.countDocuments({ role: 'guest' });

  const activeUsersMonthly = await UserModel.countDocuments({
    planStatus: 'active',
    planType: 'monthly',
    role: 'user',
  });
  const activeUsersAnnual = await UserModel.countDocuments({
    planStatus: 'active',
    planType: 'annual',
    role: 'user',
  });
  const activeGuestsMonthly = await UserModel.countDocuments({
    planStatus: 'active',
    planType: 'monthly',
    role: 'guest',
  });
  const activeGuestsAnnual = await UserModel.countDocuments({
    planStatus: 'active',
    planType: 'annual',
    role: 'guest',
  });

  const agencyMrr = activeAgencies * AGENCY_MONTHLY_PRICE;
  const creatorMrr =
    activeUsersMonthly * MONTHLY_PRICE +
    activeUsersAnnual * ANNUAL_MONTHLY_PRICE +
    activeGuestsMonthly * AGENCY_GUEST_MONTHLY_PRICE +
    activeGuestsAnnual * AGENCY_GUEST_ANNUAL_MONTHLY_PRICE;

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
