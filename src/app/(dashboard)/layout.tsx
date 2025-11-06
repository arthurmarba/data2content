"use client";

import React from "react";
import DashboardShell from "../dashboard/components/DashboardShell";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
