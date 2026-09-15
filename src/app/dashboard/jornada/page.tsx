import "./jornada.css";
import { renderCreatorProfilePage } from "../boards/mobile-strategic-profile/page";

export const dynamic = "force-dynamic";
export default async function JornadaPage(
  props: Parameters<typeof renderCreatorProfilePage>[0],
) {
  return renderCreatorProfilePage(props, "journey");
}
