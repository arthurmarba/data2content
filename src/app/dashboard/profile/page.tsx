import type { MobileStrategicProfilePageProps } from "../boards/mobile-strategic-profile/page";
import { redirectToJourney } from "../jornada/journeyRoute";

export const dynamic = "force-dynamic";

// O Perfil responsivo virou a aba Perfil da Jornada; o endereço antigo segue
// valendo para links de e-mail, MCP, checkout e retorno do Instagram.
export default async function CreatorProfilePage({ searchParams }: MobileStrategicProfilePageProps) {
  return redirectToJourney(searchParams);
}
