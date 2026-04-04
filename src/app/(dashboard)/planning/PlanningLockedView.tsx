"use client";

import React, { useEffect } from "react";
import { track } from "@/lib/track";
import PlanningConversionSection from "./components/PlanningConversionSection";

type PlanningLockedVariant = "planner" | "discover" | "whatsapp";

const trackingContextMap: Record<PlanningLockedVariant, "planning" | "discover" | "whatsapp_ai"> = {
  planner: "planning",
  discover: "discover",
  whatsapp: "whatsapp_ai",
};

type PlanningLockedViewProps = {
  variant?: PlanningLockedVariant;
  returnTo?: string;
};

export default function PlanningLockedView({ variant = "planner", returnTo = "/dashboard/planning" }: PlanningLockedViewProps) {
  useEffect(() => {
    track("paywall_viewed", { creator_id: null, context: trackingContextMap[variant], plan: null });
  }, [variant]);

  return (
    <main className="w-full min-h-[80vh] flex items-center justify-center bg-zinc-50/30">
      <div className="w-full max-w-4xl">
        <PlanningConversionSection variant={variant} returnTo={returnTo} />
      </div>
    </main>
  );
}
