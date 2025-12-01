import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PlanningLockedView from "../PlanningLockedView";
import { hasPlannerAccess } from "../utils";
import WhatsAppUpsellPage from "@/app/dashboard/whatsapp/WhatsAppUpsellPage";

export const dynamic = "force-dynamic";

export default async function PlanningWhatsAppPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!hasPlannerAccess(session.user)) {
    return <PlanningLockedView variant="whatsapp" returnTo="/planning/whatsapp" />;
  }

  // Se o usuário tem acesso, redireciona para o grupo VIP ou exibe o upsell se não houver URL
  const vipUrl = process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL;
  if (vipUrl) {
    redirect(vipUrl);
  }

  // Fallback: se não tiver URL configurada, mostra a página de upsell (ou poderia ser uma página de "Em breve")
  return <WhatsAppUpsellPage />;
}
