"use client";

import React, { createContext, useContext, useState } from "react";

export interface GlobalTimePeriodContextValue {
  timePeriod: string;
  setTimePeriod: (tp: string) => void;
}

const GlobalTimePeriodContext = createContext<GlobalTimePeriodContextValue | undefined>(undefined);

export const GlobalTimePeriodProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [timePeriod, setTimePeriod] = useState<string>("last_90_days");
  return (
    <GlobalTimePeriodContext.Provider value={{ timePeriod, setTimePeriod }}>
      {children}
    </GlobalTimePeriodContext.Provider>
  );
};

export const useGlobalTimePeriod = (): GlobalTimePeriodContextValue => {
  const context = useContext(GlobalTimePeriodContext);
  if (!context) {
    throw new Error("useGlobalTimePeriod must be used within a GlobalTimePeriodProvider");
  }
  return context;
};

export default GlobalTimePeriodContext;
