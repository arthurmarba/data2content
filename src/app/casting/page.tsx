import type { Metadata } from "next";

import CastingPageClient from "./CastingPageClient";
import { fetchCastingCreators } from "@/app/lib/landing/castingService";
import { logger } from "@/app/lib/logger";

export const metadata: Metadata = {
  title: "Casting de creators | Data2Content",
  description:
    "Veja todos os creators assinantes da plataforma e solicite uma campanha com o casting preparado pela D2C.",
};

export default async function CastingPage() {
  const payload = await fetchCastingCreators().catch((error) => {
    logger.error("[casting/page] Failed to load casting creators:", error);
    return { creators: [], total: 0 };
  });

  return <CastingPageClient initialCreators={payload.creators ?? []} initialTotal={payload.total ?? 0} />;
}
