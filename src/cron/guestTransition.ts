import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import UserModel from '@/app/models/User';
import { sendGuestMigrationEmail } from '@/app/lib/emailService';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import billingService from '@/services/billingService';

const APP_BASE_URL =
  (process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'https://app.data2content.ai').replace(/\/$/, '');
const TRIAL_CTA_URL = `${APP_BASE_URL}/dashboard/billing`;
const TRIAL_WHATSAPP_MESSAGE =
  'Seu acesso PRO gratuito terminou. Continue com seu estrategista de bolso ativando o plano PRO com 7 dias grátis: ' +
  TRIAL_CTA_URL;

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
      }

      if (guest.whatsappVerified && guest.whatsappPhone) {
        try {
          await sendWhatsAppMessage(guest.whatsappPhone, TRIAL_WHATSAPP_MESSAGE);
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
