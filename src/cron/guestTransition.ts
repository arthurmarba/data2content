import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import UserModel from '@/app/models/User';
import { sendGuestMigrationEmail, sendVipInviteEmail } from '@/app/lib/emailService';
import { sendTemplateMessage } from '@/app/lib/whatsappService';
import billingService from '@/services/billingService';

const APP_BASE_URL =
  (process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'https://app.data2content.ai').replace(/\/$/, '');
const TRIAL_CTA_URL = `${APP_BASE_URL}/dashboard/billing`;
const TRIAL_EXPIRE_TEMPLATE = process.env.WHATSAPP_GUEST_TRIAL_TEMPLATE || 'd2c_guest_trial_expired';

export async function handleGuestTransitions() {
  const TAG = '[cron guestTransition]';
  await connectToDatabase();
  const now = new Date();
  const guests = await UserModel.find({ role: 'guest', planExpiresAt: { $ne: null } });

  for (const guest of guests) {
    if (!guest.planExpiresAt) continue;
    if (guest.planExpiresAt <= now) {
      const expiredAt = guest.planExpiresAt;
      guest.role = 'user';
      guest.agency = null;
      guest.planStatus = 'inactive';
      await guest.save();
      try {
        await billingService.updateSubscription(String(guest._id));
      } catch (err) {
        logger.error(`${TAG} erro ao atualizar billing do usuário ${guest._id}`, err);
      }
      logger.info(`${TAG} guest ${guest._id} migrado para user`);

      if (guest.email) {
        await sendGuestMigrationEmail(guest.email, expiredAt);
        await sendVipInviteEmail(guest.email, { name: guest.name });
      }

      if (guest.whatsappVerified && guest.whatsappPhone) {
        try {
          await sendTemplateMessage(guest.whatsappPhone, TRIAL_EXPIRE_TEMPLATE, [
            {
              type: 'body',
              parameters: [{ type: 'text', text: TRIAL_CTA_URL }],
            },
          ]);
        } catch (err) {
          logger.error(`${TAG} falha ao enviar lembrete WhatsApp para ${guest._id}`, err);
        }
      }
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
