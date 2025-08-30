"use client";

import { useState } from "react";
import SidebarNav from "./components/SidebarNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="w-full bg-transparent">
      <div className="flex gap-0">
        <SidebarNav isCollapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <main
          className={`
            flex-1 min-h-[calc(100vh-64px)]
            transition-all duration-200
            px-4 sm:px-6 lg:px-8 py-4
          `}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
