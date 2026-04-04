import React from "react";
import DashboardShell from "./components/DashboardShell";
import { enforceCurrentLegalAcceptance } from "@/lib/auth/enforceCurrentLegalAcceptance";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await enforceCurrentLegalAcceptance("/dashboard");
  return <DashboardShell>{children}</DashboardShell>;
}
