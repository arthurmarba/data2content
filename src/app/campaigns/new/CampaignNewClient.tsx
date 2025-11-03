/* eslint-disable react/jsx-no-bind */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { track } from '@/lib/track';

type CampaignNewClientProps = {
  initialContext: {
    originHandle: string | null;
    originSlug: string | null;
    originAffiliate: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
  };
};

const SEGMENT_OPTIONS = [
  'Moda',
  'Beleza',
  'Tech',
  'Lifestyle',
  'Gaming',
  'Educação',
  'Bem-estar',
  'Outros',
];

const currencyOptions = ['BRL', 'USD', 'EUR'];

export default function CampaignNewClient({ initialContext }: CampaignNewClientProps) {
  const searchParams = useSearchParams();
  const [brandName, setBrandName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState<'BRL' | 'USD' | 'EUR'>('BRL');
  const [description, setDescription] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [customSegments, setCustomSegments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const utmSource = initialContext.utmSource ?? searchParams?.get('utm_source') ?? null;
  const utmMedium = initialContext.utmMedium ?? searchParams?.get('utm_medium') ?? null;
  const utmCampaign = initialContext.utmCampaign ?? searchParams?.get('utm_campaign') ?? null;

  const computedSource = useMemo(() => {
    if (initialContext.originSlug) return 'mediaKit';
    if (initialContext.originAffiliate) return 'affiliate';
    return 'direct';
  }, [initialContext.originAffiliate, initialContext.originSlug]);

  useEffect(() => {
    track('campaigns_new_viewed', {
      originSlug: initialContext.originSlug,
      originHandle: initialContext.originHandle,
      utmSource,
      utmMedium,
      utmCampaign,
    });
  }, [initialContext.originHandle, initialContext.originSlug, utmCampaign, utmMedium, utmSource]);

  const toggleSegment = useCallback((segment: string) => {
    setSelectedSegments((prev) => {
      if (prev.includes(segment)) {
        return prev.filter((item) => item !== segment);
      }
      return [...prev, segment];
    });
  }, []);

  const normalizedSegments = useMemo(() => {
    const base = selectedSegments.map((item) => item.trim()).filter(Boolean);
    const custom = customSegments
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const combined = [...base, ...custom];
    return Array.from(new Set(combined));
  }, [customSegments, selectedSegments]);

  const resetForm = useCallback(() => {
    setBrandName('');
    setContactEmail('');
    setContactPhone('');
    setBudget('');
    setDescription('');
    setSelectedSegments([]);
    setCustomSegments('');
    setSuccess(true);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting) return;

      setSubmitting(true);
      setErrorMessage(null);
      setSuccess(false);

      const payload = {
        brandName: brandName.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone.trim() || undefined,
        budget: budget.trim() || undefined,
        currency,
        description: description.trim(),
        segments: normalizedSegments,
        source: computedSource,
        originHandle: initialContext.originHandle ?? undefined,
        originSlug: initialContext.originSlug ?? undefined,
        originAffiliate: initialContext.originAffiliate ?? undefined,
        utmSource: utmSource ?? undefined,
        utmMedium: utmMedium ?? undefined,
        utmCampaign: utmCampaign ?? undefined,
      };

      try {
        const response = await fetch('/api/campaigns/new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error || 'Não foi possível enviar seu briefing agora.');
        }

        track('campaigns_new_submitted', {
          source: computedSource,
          originSlug: initialContext.originSlug,
          segments: normalizedSegments.length,
          hasBudget: Boolean(payload.budget),
        });
        resetForm();
      } catch (error: any) {
        const message = error?.message || 'Erro inesperado. Tente novamente mais tarde.';
        setErrorMessage(message);
        track('campaigns_new_submit_failed', {
          source: computedSource,
          message,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [
      brandName,
      budget,
      computedSource,
      contactEmail,
      contactPhone,
      currency,
      description,
      initialContext.originAffiliate,
      initialContext.originHandle,
      initialContext.originSlug,
      normalizedSegments,
      resetForm,
      submitting,
      utmCampaign,
      utmMedium,
      utmSource,
    ]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF5FF] via-white to-white py-12">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="mb-10 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#6E1F93]">Campanhas D2C</p>
          <h1 className="text-3xl font-bold text-[#1C1C1E] sm:text-4xl">Briefing para vários criadores</h1>
          <p className="mx-auto max-w-2xl text-sm text-gray-600 sm:text-base">
            Conte seus objetivos, orçamento e segmentos de interesse. Nossa inteligência encontra os criadores ideais e nossa equipe retorna em até 1 dia útil.
          </p>
          {initialContext.originHandle ? (
            <p className="text-xs font-medium text-gray-500">
              Você chegou aqui pelo mídia kit de{' '}
              <span className="font-semibold text-[#6E1F93]">
                {initialContext.originHandle.startsWith('@')
                  ? initialContext.originHandle
                  : `@${initialContext.originHandle}`}
              </span>
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 rounded-3xl border border-[#E9DAFF] bg-white p-6 shadow-lg sm:p-10">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="brandName" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Nome da marca*
              </label>
              <input
                id="brandName"
                required
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder="Ex.: Natura"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 shadow-sm focus:border-[#6E1F93] focus:outline-none focus:ring-1 focus:ring-[#6E1F93]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="contactEmail" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                E-mail comercial*
              </label>
              <input
                id="contactEmail"
                type="email"
                required
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="nome@empresa.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 shadow-sm focus:border-[#6E1F93] focus:outline-none focus:ring-1 focus:ring-[#6E1F93]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="contactPhone" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                WhatsApp ou telefone (opcional)
              </label>
              <input
                id="contactPhone"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="+55 11 90000-0000"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 shadow-sm focus:border-[#6E1F93] focus:outline-none focus:ring-1 focus:ring-[#6E1F93]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="budget" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Orçamento total disponível
              </label>
              <div className="flex rounded-xl border border-gray-200 shadow-sm focus-within:border-[#6E1F93] focus-within:ring-1 focus-within:ring-[#6E1F93]">
                <input
                  id="budget"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="Ex.: 25000"
                  className="w-full rounded-l-xl border-r border-gray-200 px-4 py-3 text-sm text-gray-800 focus:outline-none"
                />
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as 'BRL' | 'USD' | 'EUR')}
                  className="rounded-r-xl bg-gray-50 px-3 text-sm font-semibold uppercase text-gray-600 focus:outline-none"
                >
                  {currencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-400">Se estiver em dúvida, você pode deixar esse campo em branco.</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Segmentos de interesse
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {SEGMENT_OPTIONS.map((segment) => (
                <button
                  key={segment}
                  type="button"
                  onClick={() => toggleSegment(segment)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    selectedSegments.includes(segment)
                      ? 'border-[#6E1F93] bg-[#F4ECFF] text-[#4B1870]'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-[#6E1F93]/60'
                  }`}
                >
                  {segment}
                  <span
                    className={`ml-3 flex h-5 w-5 items-center justify-center rounded-full border ${
                      selectedSegments.includes(segment) ? 'border-[#6E1F93] bg-[#6E1F93] text-white' : 'border-gray-300 text-gray-400'
                    }`}
                  >
                    {selectedSegments.includes(segment) ? '✓' : '+'}
                  </span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <label htmlFor="customSegments" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Outros segmentos (separados por vírgula)
              </label>
              <input
                id="customSegments"
                value={customSegments}
                onChange={(event) => setCustomSegments(event.target.value)}
                placeholder="Ex.: Finanças, Food Service"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 shadow-sm focus:border-[#6E1F93] focus:outline-none focus:ring-1 focus:ring-[#6E1F93]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Descrição / briefing da campanha*
            </label>
            <textarea
              id="description"
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              placeholder="Conte o objetivo da campanha, público, principais mensagens, prazos e indicadores de sucesso."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 shadow-sm focus:border-[#6E1F93] focus:outline-none focus:ring-1 focus:ring-[#6E1F93]"
            />
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Briefing enviado com sucesso! Em breve nossa equipe entra em contato com o plano recomendado.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#6E1F93] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#5a1a78] disabled:cursor-not-allowed disabled:bg-[#BFA1DB]"
          >
            {submitting ? 'Enviando briefing...' : 'Enviar briefing para análise inteligente'}
          </button>
          <p className="text-xs text-gray-400">
            Ao enviar, você concorda em ser contatado pela Data2Content. Usamos suas informações apenas para selecionar os melhores criadores.
          </p>
        </form>
      </div>
    </div>
  );
}
