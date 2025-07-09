// src/app/components/MainContentWrapper.tsx
"use client";

import { usePathname } from 'next/navigation';
import React from 'react';

const MainContentWrapper = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  // Define a classe da tag <main> dinamicamente.
  // Se estiver na página '/dashboard', não adiciona o padding no topo.
  // Em todas as outras páginas, adiciona o padding para compensar o Header fixo.
  const mainClassName = pathname === '/dashboard' 
    ? 'flex-grow' 
    : 'flex-grow pt-16 md:pt-20';

  return (
    <main className={mainClassName}>
      {children}
    </main>
  );
};

export default MainContentWrapper;