'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaCheckCircle, FaLock, FaTimes } from 'react-icons/fa';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { buildCheckoutUrl } from '@/app/lib/checkoutRedirect';

type Plan = 'monthly' | 'annual';
type Cur = 'brl' | 'usd';

type ProFeatureItem = {
  title: string;
  description: string;
  linkLabel?: string;
  href?: string;
};

type ProFeatureSection = {
  title: string;
  items: ProFeatureItem[];
};

const PRO_FEATURE_SECTIONS: ProFeatureSection[] = [
  {
    title: 'IA para negociar com marcas',
    items: [
      {
        title: 'Faixa justa + calculadora dinâmica',
        description: 'Valores estratégicos e premium baseados nas suas métricas reais e contexto da campanha.',
      },
      {
        title: 'Respostas prontas em 1 clique',
        description: 'E-mails e mensagens profissionais com variáveis dinâmicas para acelerar o follow-up.',
      },
      {
        title: 'Mentorias semanais do Grupo VIP',
        description: 'Hotseats ao vivo combinando leituras da IA com especialistas humanos para ajustar sua estratégia.',
      },
    ],
  },
  {
    title: 'Planejamento e descoberta desbloqueados',
    items: [
      {
        title: 'Planejamento Agência',
        description:
          'Slots com IA, previsões de alcance e alertas no WhatsApp para executar com foco diariamente.',
        linkLabel: 'Ver planner',
        href: '/dashboard/planning',
      },
      {
        title: 'Descoberta da Comunidade',
        description:
          'Biblioteca viva com benchmarks de creators, ideias e tendências exclusivas da base do Plano Agência.',
        linkLabel: 'Explorar descoberta',
        href: '/dashboard/discover',
      },
    ],
  },
  {
    title: 'Alertas e relatórios proativos',
    items: [
      {
        title: 'Estratégia no WhatsApp',
        description: 'A IA monitora seu Instagram, identifica oportunidades e envia nudges personalizados.',
      },
      {
        title: 'Relatórios semanais automáticos',
        description: 'Entenda sua performance em 30 segundos, sem planilhas — tudo entregue direto no app.',
      },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  prices: {
    monthly: { brl: number; usd: number };
    annual: { brl: number; usd: number };
  };
}

export default function SubscribeModal({ open, onClose, prices }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>('monthly');
  const [currency, setCurrency] = useState<Cur>('brl');
  const [affiliateCode, setAffiliateCode] = useState('');
  const [loadingAction, setLoadingAction] = useState<null | 'subscribe'>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const {
    isLoading: billingStatusLoading,
    hasPremiumAccess,
  } = useBillingStatus();

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number, cur: Cur) =>
    new Intl.NumberFormat(cur === 'brl' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: cur.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value);

  const priceShown = plan === 'monthly' ? prices.monthly[currency] : prices.annual[currency];

  const normalizedCode = affiliateCode.trim().toUpperCase();
  const codeIsValid = normalizedCode === '' || /^[A-Z0-9-]{3,24}$/.test(normalizedCode);

  async function handleStart() {
    if (loadingAction) return;
    setLoadingAction('subscribe');
    setError(null);
    setCodeError(null);
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          currency,
          affiliateCode: normalizedCode || undefined,
        }),
      });
      const body = await res.json();
      if (res.status === 422 || body?.code === 'INVALID_CODE') { setCodeError(body?.message ?? 'Código inválido ou expirado.'); return; }
      if (!res.ok && body?.code === 'SELF_REFERRAL') { setCodeError(body?.message ?? 'Você não pode usar seu próprio código.'); return; }
      if (!res.ok) throw new Error(body?.error || body?.message || 'Falha ao iniciar assinatura');
      if (body?.checkoutUrl) { window.location.href = body.checkoutUrl; return; }
      if (body?.clientSecret) {
        router.push(buildCheckoutUrl(body.clientSecret, body.subscriptionId));
        return;
      }
      throw new Error('Resposta da API inválida. Faltando clientSecret/checkoutUrl.');
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado ao iniciar assinatura.');
    } finally {
      setLoadingAction(null);
    }
  }

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const savingsLabel = useMemo(() => {
    const m = prices.monthly[currency];
    const a = prices.annual[currency];
    if (!m || !a) return null;
    const pct = Math.max(0, 1 - a / (m * 12));
    if (pct < 0.05) return null;
    return `Economize ${Math.round(pct * 100)}%`;
  }, [prices, currency]);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const disabled = !!loadingAction;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-0 pt-[env(safe-area-inset-top)] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-title"
      onClick={onOverlayClick}
    >
      <div
        ref={dialogRef}
        className="relative w-screen h-full max-h-screen sm:w-full sm:h-auto sm:max-w-xl sm:max-h-[90vh] sm:rounded-2xl rounded-none bg-white shadow-2xl flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão fechar (mobile) */}
        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 sm:hidden inline-flex items-center justify-center rounded-full w-10 h-10 bg-white/90 border border-gray-200 text-gray-700 hover:bg-gray-100 shadow-sm"
        >
          <FaTimes />
        </button>
        <div className="p-6 text-center flex-shrink-0"> {/* Adicionado flex-shrink-0 para o header não encolher */}
            <h2 id="subscribe-title" className="text-2xl font-bold text-gray-900">
                Receba Alertas e Oportunidades Diárias no seu WhatsApp
            </h2>
            <p className="text-gray-600 mt-2">
                Ative o Plano Agência e transforme sua IA em um estrategista de conteúdo proativo.
            </p>
            <p className="text-xs text-gray-500 mt-1">
                Agências ficam com 10%–30% de comissão e pedem exclusividade; aqui você paga só a assinatura e mantém 100% das publis.
            </p>
        </div>
        
        <div className="bg-gray-50/70 px-6 py-5 border-y border-gray-200 overflow-y-auto flex-1 min-h-0"> {/* Área rolável principal no mobile */}
            <div className="grid grid-cols-1 gap-5">
                <div className="space-y-5 text-left text-gray-700 text-sm">
                  {PRO_FEATURE_SECTIONS.map((section) => (
                    <div key={section.title} className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">{section.title}</p>
                      <ul className="mt-3 space-y-3">
                        {section.items.map((item) => (
                          <li key={item.title} className="flex items-start gap-3">
                            <FaCheckCircle className="text-green-500 w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div>
                              <p>
                                <strong>{item.title}:</strong> {item.description}
                              </p>
                              {item.linkLabel && item.href ? (
                                <Link
                                  href={item.href}
                                  className="mt-1 inline-flex items-center text-xs font-semibold text-pink-600 hover:text-pink-700"
                                >
                                  {item.linkLabel}
                                  <span aria-hidden className="ml-1">↗</span>
                                </Link>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
                    <div className="inline-flex rounded-xl border border-gray-300 p-1 bg-white" role="group">
                        <button type="button" onClick={() => setPlan('monthly')} aria-pressed={plan === 'monthly'} className={`px-3 py-1.5 text-sm rounded-lg ${plan === 'monthly' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>Mensal</button>
                        <button type="button" onClick={() => setPlan('annual')} aria-pressed={plan === 'annual'} className={`px-3 py-1.5 text-sm rounded-lg ${plan === 'annual' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>
                            Anual
                        </button>
                    </div>
                    {plan === 'annual' && savingsLabel && (
                      <span className="rounded-full bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 border border-green-200">
                        {savingsLabel}
                      </span>
                    )}
                    <div className="inline-flex rounded-xl border border-gray-300 p-1 bg-white" role="group">
                        <button type="button" onClick={() => setCurrency('brl')} aria-pressed={currency === 'brl'} className={`px-3 py-1.5 text-sm rounded-lg ${currency === 'brl' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>BRL</button>
                        <button type="button" onClick={() => setCurrency('usd')} aria-pressed={currency === 'usd'} className={`px-3 py-1.5 text-sm rounded-lg ${currency === 'usd' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>USD</button>
                    </div>
                </div>

                <div className="text-center">
                    <div className="text-3xl font-extrabold tracking-tight">
                        {priceShown > 0 ? formatCurrency(priceShown, currency) : '—'} <span className="text-base font-medium text-gray-500">/{plan === 'monthly' ? 'mês' : 'ano'}</span>
                    </div>
                </div>

                <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="affiliateCode">Cupom / Código de Afiliado (opcional)</label>
                        <input id="affiliateCode" value={affiliateCode} onChange={(e) => setAffiliateCode(e.target.value)} placeholder="Ex.: ABC123" className={`w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ${ codeIsValid ? 'border-gray-300 focus:ring-pink-500' : 'border-red-300 focus:ring-red-500' }`} inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} aria-invalid={!codeIsValid}/>
                        {!codeIsValid && <p className="text-sm text-red-600 mt-1">Use 3–24 caracteres (A–Z, 0–9, -).</p>}
                        {codeError && <p className="text-sm text-red-600 mt-1">{codeError}</p>}
                    </div>

                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                    {hasPremiumAccess && !billingStatusLoading && (
                      <p className="text-xs text-gray-600 text-center">Você já possui um plano ativo.</p>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                        <button onClick={handleStart} disabled={disabled || !codeIsValid || hasPremiumAccess || billingStatusLoading} className="w-full rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-3 text-white font-semibold disabled:opacity-50" aria-busy={loadingAction === 'subscribe'}>
                            {loadingAction === 'subscribe' ? 'Processando…' : 'Ativar meu Plano Agência'}
                        </button>
                    </div>
                    <p className="mt-3 flex items-center justify-center gap-1 text-xs text-gray-500">
                      <FaLock className="h-3 w-3" aria-hidden />
                      Só leitura: não publicamos nada por você e você pode cancelar quando quiser.
                    </p>
                </>
            </div>
        </div>

        <div className="p-4 text-xs text-gray-500 flex items-center justify-center gap-4 flex-shrink-0"> {/* Footer fixo ao fim */}
            <span className="flex items-center gap-1.5"><FaLock /> Pagamento 100% seguro via Stripe.</span>
            <span>•</span>
            <span>Cancele a qualquer momento.</span>
        </div>
      </div>
    </div>
  );
}
