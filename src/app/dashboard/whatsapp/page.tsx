import { WHATSAPP_ALERTS_VISIBLE } from "@/app/lib/productFeatures";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyWhatsAppRedirect() {
  redirect(WHATSAPP_ALERTS_VISIBLE ? "/dashboard/instagram-connection#whatsapp" : "/dashboard/instagram-connection");
}
