"use client";

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { setAnalyticsUserProperties } from '@/lib/analytics/userProperties';

const AGENCY_INVITE_KEY = 'agencyInviteCode';
const AGENCY_INVITE_EXPIRATION_DAYS = 7;

export default function ClientHooksWrapper() {
  const searchParams = useSearchParams();
  
  // --- INÍCIO DA CORREÇÃO ---
  // Hooks para a lógica de redirecionamento foram adicionados.
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const analyticsSignatureRef = useRef<string | null>(null);
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
      // páginas permitidas (instagram, billing, etc.)...
      if (
        userPlanStatus === 'inactive' &&
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

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    const signatureParts = [
      session.user.id,
      session.user.planStatus ?? 'unknown',
      session.user.instagramConnected ? 'ig:1' : 'ig:0',
    ];
    const signature = signatureParts.join('|');
    if (analyticsSignatureRef.current === signature) return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/analytics/context', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`analytics_context_fetch_failed_${res.status}`);
        const body = await res.json();
        if (!body?.ok || !body?.data || cancelled) return;
        const {
          plan,
          country,
          niche,
          followersBand,
          hasMediaKit,
          instagramConnected,
          isInternal,
        } = body.data as {
          plan?: string | null;
          country?: string | null;
          niche?: string | null;
          followersBand?: string | null;
          hasMediaKit?: boolean;
          instagramConnected?: boolean;
          isInternal?: boolean;
        };
        setAnalyticsUserProperties({
          plan: plan ?? null,
          country: country ?? null,
          niche: niche ?? null,
          followers_band: followersBand ?? null,
          has_media_kit: hasMediaKit ?? false,
          instagram_connected: instagramConnected ?? false,
          is_internal: isInternal ?? false,
        });
        analyticsSignatureRef.current = signature;
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[ClientHooksWrapper] analytics context fetch failed', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [status, session, session?.user?.id, session?.user?.planStatus, session?.user?.instagramConnected]);


  // Este componente não precisa renderizar nada visualmente,
  // ele apenas encapsula os hooks de cliente.
  return null;
}
