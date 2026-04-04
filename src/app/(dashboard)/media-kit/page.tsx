import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import MediaKitDashboardPage from "@/app/dashboard/media-kit/page";

export const dynamic = "force-dynamic";

export default async function MediaKitRoutePage() {
  await getServerSession(authOptions);
  return <MediaKitDashboardPage />;
}
