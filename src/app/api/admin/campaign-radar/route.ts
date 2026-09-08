import { NextRequest } from "next/server";
import { radarAdminRequest, readRadarJson } from "@/app/lib/campaignRadar/adminHttp";
import { createManualCandidate, listCandidates } from "@/app/lib/campaignRadar/adminService";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return radarAdminRequest(request, () => listCandidates(request.nextUrl.searchParams));
}
export async function POST(request: NextRequest) {
  return radarAdminRequest(request, async (actor) => createManualCandidate(await readRadarJson(request), actor));
}
