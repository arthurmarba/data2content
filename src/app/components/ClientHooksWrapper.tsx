"use client";

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

const AGENCY_INVITE_KEY = 'agencyInviteCode';
const AGENCY_INVITE_EXPIRATION_DAYS = 7;

export default function ClientHooksWrapper() {
  const searchParams = useSearchParams();
  
  // --- INÍCIO DA CORREÇÃO ---
  // Hooks para a lógica de redirecionamento foram adicionados.
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  // --- FIM DA CORREÇÃO ---

  useEffect(() => {
    // A lógica do typeof window !== 'undefined' garante execução somente no cliente
    if (typeof window !== 'undefined') {
      const invite = searchParams.get('codigo_agencia');
      if (invite && invite.trim() !== '') {
        const expiresAt = Date.now() + AGENCY_INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
        const data = { code: invite.trim(), expiresAt };
        try {
          localStorage.setItem(AGENCY_INVITE_KEY, JSON.stringify(data));
          console.log('[ClientHooksWrapper] Código de agência salvo:', data);
        } catch (error) {
          console.error('[ClientHooksWrapper] Erro ao salvar código de agência no localStorage:', error);
        }
      }
    }
  }, [searchParams]);

  // --- INÍCIO DA CORREÇÃO ---
  // Este bloco de código era a causa do redirecionamento.
  // Ele foi comentado para permitir a navegação de usuários com plano 'inactive',
  // conforme a nova regra de negócio solicitada.
  /*
  useEffect(() => {
    // Espera a sessão ser carregada
    if (status === 'authenticated' && session) {
      const userPlanStatus = session.user?.planStatus;

      // Se o plano do usuário for 'inactive' e ele não estiver em uma das
      // páginas permitidas (onboarding, billing, etc.)...
      if (
        userPlanStatus === 'inactive' &&
        !pathname.startsWith('/dashboard/onboarding') &&
        !pathname.startsWith('/dashboard/instagram') &&
        !pathname.startsWith('/dashboard/billing') &&
        !pathname.startsWith('/auth/complete-signup')
      ) {
        // ...ele é redirecionado para a página para completar o cadastro.
        router.push('/auth/complete-signup');
      }
    }
  }, [status, session, pathname, router]);
  */
  // --- FIM DA CORREÇÃO ---


  // Este componente não precisa renderizar nada visualmente,
  // ele apenas encapsula os hooks de cliente.
  return null;
}
