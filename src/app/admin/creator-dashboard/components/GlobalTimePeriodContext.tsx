"use client";
import React, { createContext, useContext } from 'react';

interface GlobalTimePeriodContextValue {
  globalTimePeriod: string;
  setGlobalTimePeriod?: (tp: string) => void;
}

const GlobalTimePeriodContext = createContext<GlobalTimePeriodContextValue | undefined>(undefined);

interface ProviderProps {
  children: React.ReactNode;
  value: GlobalTimePeriodContextValue;
}

export const GlobalTimePeriodProvider: React.FC<ProviderProps> = ({ children, value }) => (
  <GlobalTimePeriodContext.Provider value={value}>{children}</GlobalTimePeriodContext.Provider>
);

export const useGlobalTimePeriod = () => {
  const ctx = useContext(GlobalTimePeriodContext);
  if (!ctx) {
    throw new Error('useGlobalTimePeriod must be used within a GlobalTimePeriodProvider');
  }
  return ctx;
};

export default GlobalTimePeriodContext;
