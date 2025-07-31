import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Agency from '@/app/models/Agency';
import { USER_ROLES, PLAN_STATUSES } from '@/types/enums';
import { logger } from '@/app/lib/logger';

const TAG = '[migrateRolesAndPlans]';

async function migrate() {
  await connectToDatabase();
  logger.info(`${TAG} connected to database`);

  await User.updateMany({ role: { $nin: USER_ROLES as any } }, { $set: { role: 'user' } });
  await User.updateMany({ planStatus: { $nin: PLAN_STATUSES as any } }, { $set: { planStatus: 'inactive' } });
  await Agency.updateMany({ planStatus: { $nin: PLAN_STATUSES as any } }, { $set: { planStatus: 'inactive' } });

  logger.info(`${TAG} migration completed`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  logger.error(`${TAG} failed`, err);
  mongoose.disconnect();
});
