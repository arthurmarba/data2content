import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";
import { getPlanAccessMeta } from "@/utils/planStatus";

export type RecordedMeetingsViewer = {
  id?: string | null;
  role?: string | null;
};

export async function canAccessPremiumContent(
  viewer: RecordedMeetingsViewer | null | undefined,
): Promise<boolean> {
  if (viewer?.role?.trim().toLowerCase() === "admin") return true;

  const userId = viewer?.id?.trim();
  if (!userId) return false;

  await connectToDatabase();
  const user = await UserModel.findById(userId)
    .select("planStatus cancelAtPeriodEnd role")
    .lean<{
      planStatus?: unknown;
      cancelAtPeriodEnd?: boolean | null;
      role?: string | null;
    }>()
    .exec();

  if (user?.role?.trim().toLowerCase() === "admin") return true;
  return getPlanAccessMeta(user?.planStatus, user?.cancelAtPeriodEnd).hasPremiumAccess;
}

export async function canAccessRecordedMeetings(
  viewer: RecordedMeetingsViewer | null | undefined,
): Promise<boolean> {
  return canAccessPremiumContent(viewer);
}
