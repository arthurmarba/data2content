"use client";

import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define a forma dos dados do contexto
interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

// Cria o contexto com um valor padrão
const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Cria um componente provedor
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

// Cria um hook personalizado para usar o contexto do sidebar
export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

