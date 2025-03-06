// src/app/dashboard/components/DashboardContext.tsx
"use client";

import React, { createContext, useContext, useState } from "react";

interface CustomData {
  [key: string]: any;
}

interface DashboardContextProps {
  customData: CustomData | null;
  setCustomData: (data: CustomData | null) => void;
  loading: boolean;
  setLoading: (val: boolean) => void;
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [customData, setCustomData] = useState<CustomData | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <DashboardContext.Provider value={{ customData, setCustomData, loading, setLoading }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
