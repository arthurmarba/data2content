import Settings from '@/app/models/CollabSettings';
import { connectToDatabase } from '@/app/lib/mongoose';
export async function collabSettings() {
  await connectToDatabase();
  return await Settings.findById('default').lean() ?? { generationEnabled: process.env.NODE_ENV !== 'production', pilotUserIds: [] as string[], whatsappTemplate: null, whatsappApiVersion: null, whatsappTemplateApproved: false, maxMatchingJobsPerDay: 4 };
}
export async function canGenerate(userId: string) {
  const settings = await collabSettings();
  return settings.generationEnabled && (!settings.pilotUserIds.length || settings.pilotUserIds.includes(userId));
}
