import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { PlannerSlotModal, type PlannerSlotData, type PlannerSlotModalProps } from './PlannerSlotModal';

jest.mock('@/app/discover/components/DiscoverVideoModal', () => ({
  __esModule: true,
  default: () => null,
}));

const originalFetch = global.fetch;

const baseSlot: PlannerSlotData = {
  slotId: 'slot-1',
  dayOfWeek: 0,
  blockStartHour: 15,
  format: 'reel',
  categories: {
    context: ['personal'],
    proposal: ['authority'],
    reference: ['music'],
    tone: 'inspirational',
  },
  expectedMetrics: { viewsP50: 1500, viewsP90: 4000, sharesP50: 120 },
  title: 'Tema inicial',
  scriptShort: 'Roteiro inicial',
  themes: ['Tema inicial', 'Tema 2'],
  themeKeyword: 'Tema inicial',
  status: 'planned',
};

const makeProps = (overrides?: Partial<PlannerSlotModalProps>): PlannerSlotModalProps => ({
  open: true,
  onClose: jest.fn(),
  userId: 'user-1',
  weekStartISO: '2026-02-23',
  slot: baseSlot,
  onSave: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ posts: [], themes: ['Tema A'] }),
  } as Response);
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('PlannerSlotModal', () => {
  it('abre com pautas recomendadas abertas e blocos secundários fechados', () => {
    render(<PlannerSlotModal {...makeProps()} />);

    expect(screen.getByRole('button', { name: /pautas recomendadas/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /kpis projetados/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /conteúdos que inspiram/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /inspirações da comunidade/i })).toHaveAttribute('aria-expanded', 'false');

    expect(screen.queryByText('Saves / Compart.')).not.toBeInTheDocument();
  });

  it('mantém toggles independentes entre blocos', () => {
    render(<PlannerSlotModal {...makeProps()} />);

    const kpisToggle = screen.getByRole('button', { name: /kpis projetados/i });

    fireEvent.click(kpisToggle);

    expect(kpisToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /conteúdos que inspiram/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /pautas recomendadas/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Saves / Compart.')).toBeInTheDocument();
  });

  it('mantém apenas salvar pauta no rodapé editável', () => {
    render(<PlannerSlotModal {...makeProps()} />);

    const saveButton = screen.getByRole('button', { name: /salvar pauta/i });

    expect(saveButton.className).toContain('from-[#D62E5E]');
    expect(screen.queryByRole('button', { name: /gerar com ia/i })).not.toBeInTheDocument();
  });

  it('ao selecionar pauta recomendada, atualiza título e sinaliza seleção para salvar', () => {
    render(<PlannerSlotModal {...makeProps()} />);

    fireEvent.click(screen.getByRole('button', { name: /tema 2/i }));

    expect(screen.getByDisplayValue('Tema 2')).toBeInTheDocument();
    expect(screen.getByText(/virou o título e está pronta para salvar/i)).toBeInTheDocument();
    expect(screen.getByText(/^Selecionada$/)).toBeInTheDocument();
  });

  it('em readOnly exibe apenas ação de fechar no rodapé', () => {
    render(<PlannerSlotModal {...makeProps({ readOnly: true })} />);

    expect(screen.queryByRole('button', { name: /salvar pauta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /gerar com ia/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^fechar$/i })).toBeInTheDocument();
  });
});
