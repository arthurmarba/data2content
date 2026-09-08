import { NextRequest } from "next/server";
import { radarAdminRequest, readRadarJson } from "@/app/lib/campaignRadar/adminHttp";
import { importCandidateBatch } from "@/app/lib/campaignRadar/adminService";
export async function POST(request: NextRequest) {
  return radarAdminRequest(request, async (actor) => importCandidateBatch(await readRadarJson(request), actor));
}
