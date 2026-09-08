import { NextRequest } from "next/server";
import { radarAdminRequest, readRadarJson } from "@/app/lib/campaignRadar/adminHttp";
import { mutateCandidate } from "@/app/lib/campaignRadar/adminService";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return radarAdminRequest(request, async (actor) => mutateCandidate((await context.params).id, await readRadarJson(request), actor));
}
