// src/app/dashboard/pro/page.tsx

import ProDashboard from "./prodashboard"; 
// ^ Importamos o componente client-side

export default function ProDashboardRoute() {
  // Este arquivo é a rota de /dashboard/pro, mas não contém lógica de hooks
  // Ele simplesmente renderiza o componente client-side
  return <ProDashboard />;
}
