import React from "react";
import DashboardShell from "../dashboard/components/DashboardShell";
import { enforceCurrentLegalAcceptance } from "@/lib/auth/enforceCurrentLegalAcceptance";

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  await enforceCurrentLegalAcceptance("/dashboard");
  return <DashboardShell>{children}</DashboardShell>;
}
