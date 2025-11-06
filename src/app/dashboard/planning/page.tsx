import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyPlanningPage() {
  redirect("/planning/planner");
}
