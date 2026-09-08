import { Types } from 'mongoose';
import User from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
export type DiscoveryMode = 'remoto' | 'presencial' | 'ambos';
export interface DiscoveryUser {
  role?: string | null; planStatus?: string | null; currentPeriodEnd?: Date | string | null; cancelAtPeriodEnd?: boolean;
  collabDiscoveryOptIn?: boolean; collabDiscoveryOptInDate?: Date | string | null;
  collabDiscoveryStatus?: string; collabDiscoveryMode?: string; username?: string | null; instagramUsername?: string | null;
  location?: { city?: string | null; state?: string | null; country?: string | null } | null;
}
export const DISCOVERY_FIELDS = 'role planStatus currentPeriodEnd cancelAtPeriodEnd collabDiscoveryOptIn collabDiscoveryOptInDate collabDiscoveryStatus collabDiscoveryMode username instagramUsername location';
export function premium(user: DiscoveryUser | null | undefined, now = new Date()) {
  if (!user) return false;
  if (user.role?.toLowerCase() === 'admin') return true;
  const until = user.currentPeriodEnd ? new Date(user.currentPeriodEnd).getTime() : 0;
  return user.planStatus === 'active' ? !user.cancelAtPeriodEnd || until > now.getTime() : user.planStatus === 'non_renewing' && until > now.getTime();
}
export function discoveryState(user: DiscoveryUser | null | undefined) {
  if (user?.collabDiscoveryStatus === 'paused') return 'paused' as const;
  return user?.collabDiscoveryOptIn === true && Boolean(user.collabDiscoveryOptInDate) ? 'available' as const : 'unknown' as const;
}
export function contactHandle(user: DiscoveryUser | null | undefined) {
  const value = (user?.instagramUsername || user?.username || '').replace(/^@/, '').trim();
  return /^[a-zA-Z0-9._]{1,30}$/.test(value) ? value : null;
}
export function eligible(user: DiscoveryUser | null | undefined, now = new Date()) { return premium(user, now) && discoveryState(user) === 'available' && !!contactHandle(user); }
export const discoveryQuery = () => ({ collabDiscoveryOptIn: true, collabDiscoveryOptInDate: { $ne: null }, collabDiscoveryStatus: { $ne: 'paused' } });
const normalized = (value?: string | null) => (value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
export function compatibleMode(a: DiscoveryUser, b: DiscoveryUser): 'remoto' | 'presencial' | null {
  const am = a.collabDiscoveryMode || 'remoto', bm = b.collabDiscoveryMode || 'remoto';
  if (am !== 'presencial' && bm !== 'presencial') return 'remoto';
  const sameCity = !!normalized(a.location?.city) && normalized(a.location?.city) === normalized(b.location?.city);
  const sameState = !!normalized(a.location?.state) && normalized(a.location?.state) === normalized(b.location?.state);
  return am !== 'remoto' && bm !== 'remoto' && sameCity && sameState ? 'presencial' : null;
}
export async function participantUsers(ids: string[]) {
  await connectToDatabase();
  return User.find({ _id: { $in: ids.filter(Types.ObjectId.isValid) } }).select(`${DISCOVERY_FIELDS} name image providerImage profile_picture_url mediaKitSlug whatsappVerified whatsappPhone whatsappOptOut`).lean();
}
export async function updateDiscovery(userId: string, available: boolean, mode: DiscoveryMode = 'remoto') {
  await connectToDatabase();
  const user = await User.findById(userId).select(DISCOVERY_FIELDS).lean();
  if (available && !eligible({ ...user, collabDiscoveryOptIn: true, collabDiscoveryOptInDate: new Date(), collabDiscoveryStatus: 'available' })) {
    return { ok: false, reason: 'profile_required', message: 'Para aparecer, confira seu acesso Pro e informe seu @ do Instagram no Perfil.' };
  }
  await User.updateOne({ _id: userId }, { $set: { collabDiscoveryOptIn: available, collabDiscoveryOptInDate: new Date(), collabDiscoveryStatus: available ? 'available' : 'paused', collabDiscoveryMode: mode } });
  return { ok: true };
}
