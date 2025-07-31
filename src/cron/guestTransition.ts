import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import UserModel from '@/app/models/User';
import { sendGuestMigrationEmail } from '@/app/lib/emailService';

export async function handleGuestTransitions() {
  const TAG = '[cron guestTransition]';
  await connectToDatabase();
  const now = new Date();
  const upcoming = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const guests = await UserModel.find({ role: 'guest', planExpiresAt: { $ne: null } });

  for (const guest of guests) {
    if (!guest.planExpiresAt) continue;
    if (guest.planExpiresAt <= now) {
      guest.role = 'user';
      guest.agency = null;
      guest.planStatus = 'inactive';
      await guest.save();
      logger.info(`${TAG} guest ${guest._id} migrado para user`);
    } else if (guest.planExpiresAt <= upcoming && guest.email) {
      await sendGuestMigrationEmail(guest.email, guest.planExpiresAt);
      logger.info(`${TAG} aviso de migração enviado para guest ${guest._id}`);
    }
  }
}

export default handleGuestTransitions;

if (process.argv[1]?.endsWith('guestTransition.ts')) {
  handleGuestTransitions()
    .catch(err => {
      logger.error('[cron guestTransition] unhandled error', err);
    });
}
