// src/app/discover/components/SaveToPlannerButton.tsx
"use client";

import React, { useMemo, useState } from 'react';
import { ALLOWED_BLOCKS } from '@/app/lib/planner/constants';
import { track } from '@/lib/track';

type PostCard = {
  id: string;
  coverUrl?: string | null;
  caption?: string;
  postDate?: string;
  creatorName?: string;
  stats?: { total_interactions?: number; likes?: number; comments?: number; shares?: number; views?: number };
  categories?: { format?: string[]; proposal?: string[]; context?: string[]; tone?: string[]; references?: string[] };
};

const DAYS = [
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
  { id: 7, label: 'Dom' },
];

interface Props { item: PostCard }

export default function SaveToPlannerButton({ item }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState<number>(() => {
    // default: próximo dia útil (Seg..Sex) ou hoje se já tarde
    const today = new Date();
    const jsDow = today.getDay(); // 0=Dom..6=Sab
    // Convertendo para ISO 1..7
    const iso = jsDow === 0 ? 7 : jsDow;
    return iso as number;
  });
  const [blockStartHour, setBlockStartHour] = useState<number>(() => ALLOWED_BLOCKS[0] as number);

  const userTimeZone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
  }, []);

  const format = item.categories?.format?.[0] || 'reel';
  const proposal = item.categories?.proposal?.slice(0, 2) || [];
  const context = item.categories?.context?.slice(0, 2) || [];
  const reference = item.categories?.references?.slice(0, 2) || [];
  const tone = item.categories?.tone?.[0];

  async function onSave() {
    setSaving(true);
    try {
      const body = {
        weekStart: new Date().toISOString(),
        userTimeZone,
        slots: [{
          dayOfWeek,
          blockStartHour,
          format,
          status: 'drafted',
          categories: { context, proposal, reference, ...(tone ? { tone } : {}) },
          title: (item.caption || '').slice(0, 120),
        }],
      };
      const res = await fetch('/api/planner/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (res.status === 401) alert('Faça login para salvar no Planner.');
        else if (res.status === 403) alert('Plano inativo. Assine para salvar no Planner.');
        else alert('Falha ao salvar no Planner.');
        return;
      }
      try { track('discover_save_to_planner', { id: item.id, format, dayOfWeek, blockStartHour }); } catch {}
      setSaved(true);
      setOpen(false);
    } catch (e) {
      alert('Erro inesperado ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">Salvo</span>
        <a
          href="/media-kit"
          onClick={() => { try { track('discover_open_planner', { id: item.id }); } catch {} }}
          className="text-[11px] underline text-pink-600 hover:text-pink-700"
        >
          Editar no Planner
        </a>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="text-[11px] px-2 py-1 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50"
        onClick={() => { setOpen(true); try { track('discover_save_click', { id: item.id }); } catch {} }}
        disabled={saving}
      >
        Salvar
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/40 grid place-items-center" role="dialog" aria-modal>
          <div className="bg-white rounded-lg shadow-lg w-[90vw] max-w-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Salvar no Planner</h3>
              <button className="text-gray-500" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            </div>
            <div className="space-y-3">
              <div className="text-[12px] text-gray-600">Selecione dia e horário:</div>
              <div className="flex gap-1 flex-wrap">
                {DAYS.map(d => (
                  <button
                    key={d.id}
                    className={`px-2 py-1 text-[12px] rounded-full border ${dayOfWeek===d.id ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-700 border-gray-300'}`}
                    onClick={() => setDayOfWeek(d.id)}
                  >{d.label}</button>
                ))}
              </div>
              <div className="flex gap-1 flex-wrap">
                {ALLOWED_BLOCKS.map((h) => (
                  <button
                    key={h}
                    className={`px-2 py-1 text-[12px] rounded-full border ${blockStartHour===h ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-700 border-gray-300'}`}
                    onClick={() => setBlockStartHour(h as number)}
                  >{String(h).padStart(2,'0')}:00</button>
                ))}
              </div>
              <div className="text-[12px] text-gray-500">Formato: {format}</div>
              <button
                type="button"
                className="w-full inline-flex items-center justify-center bg-pink-600 text-white rounded-md py-2 text-sm disabled:opacity-60"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? 'Salvando…' : 'Salvar' }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
