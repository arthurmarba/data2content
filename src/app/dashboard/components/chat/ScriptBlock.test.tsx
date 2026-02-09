import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScriptBlock } from './ScriptBlock';

const baseScript = [
    '[ROTEIRO]',
    '**Título Sugerido:** Roteiro de teste',
    '**Pauta Estratégica:** orçamento doméstico prático',
    '**Base de Engajamento:** Categorias com melhor engajamento: tutorial + finance',
    '**Confiança da Base:** Média',
    '**Fonte da Inspiração:** Top posts do criador',
    '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
    '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
    '| :--- | :--- | :--- |',
    '| 00-03s | Gancho visual bem direto para abrir o vídeo | Gancho falado com promessa prática e clara |',
    '| 03-20s | Desenvolvimento com exemplo concreto e observável | Explicação em dois passos objetivos e curtos |',
    '| 20-30s | Encerramento com CTA explícito e benefício final | Chamada para salvar e comentar para receber variação |',
    '[/ROTEIRO]',
    '',
    '[LEGENDA]',
    'V1: Legenda principal de teste',
    '',
    'V2: Segunda opção de legenda',
    '',
    'V3: Terceira opção de legenda',
    '[/LEGENDA]',
].join('\n');

describe('ScriptBlock', () => {
    it('exibe apenas 2 ações principais antes de abrir outras melhorias', () => {
        const onSendPrompt = jest.fn();
        render(<ScriptBlock content={baseScript} theme="default" onSendPrompt={onSendPrompt} />);

        expect(screen.getByRole('button', { name: 'Ajustar para meu nicho' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mais específico' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Outras melhorias' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Manter narrativa' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Outras melhorias' }));
        expect(screen.getByRole('button', { name: 'Manter narrativa' })).toBeInTheDocument();
    });

    it('destaca visualmente a última cena (CTA)', () => {
        render(<ScriptBlock content={baseScript} theme="default" onSendPrompt={jest.fn()} />);
        const ctaScene = screen.getByTestId('script-scene-card-3');

        expect(ctaScene.className).toContain('border-emerald');
    });

    it('mantém fallback de conteúdo bruto quando não há parsing de roteiro', () => {
        render(<ScriptBlock content="resposta sem tags e sem estrutura de roteiro" theme="default" />);

        expect(screen.getByText('Conteúdo bruto')).toBeInTheDocument();
        expect(screen.getByText('resposta sem tags e sem estrutura de roteiro')).toBeInTheDocument();
    });

    it('usa card de clarificação com 1 pergunta e 2 botões', () => {
        const onSendPrompt = jest.fn();
        const clarification = [
            '### Falta um detalhe para fechar seu roteiro',
            'Qual tema específico você quer abordar neste roteiro?',
        ].join('\n');

        render(<ScriptBlock content={clarification} theme="default" onSendPrompt={onSendPrompt} />);

        expect(screen.getByText(/Qual tema específico você quer abordar neste roteiro/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Informar tema específico' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pode usar meu nicho atual' })).toBeInTheDocument();
    });
});

