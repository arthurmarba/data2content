import {
  renderCreatorProfilePage,
  type MobileStrategicProfilePageProps,
} from "../boards/mobile-strategic-profile/page";

export const dynamic = "force-dynamic";

export default async function CreatorProfilePage(
  props: MobileStrategicProfilePageProps,
) {
  return renderCreatorProfilePage(props, "responsive");
}
