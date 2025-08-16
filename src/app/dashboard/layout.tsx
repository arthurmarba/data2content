// src/app/dashboard/layout.tsx (CORRIGIDO)

// Este layout agora só precisa passar os filhos adiante.
// O RootLayout já fornecerá o Header, Footer e o container principal.
export default function DashboardLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      // <<< CORREÇÃO: Removido o espaçamento vertical 'py-12' e 'space-y-12' >>>
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    );
  }