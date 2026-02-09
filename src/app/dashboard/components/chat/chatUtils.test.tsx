import React from 'react';
import { render, screen } from '@testing-library/react';
import { normalizePlanningMarkdown, renderFormatted } from './chatUtils';

describe('normalizePlanningMarkdown', () => {
    it('repairs dangling bold labels and attaches Dia to plan items', () => {
        const input = [
            '- Reel (Humor)**: roteiro curto',
            'Dia: quinta-feira',
        ].join('\n');

        const output = normalizePlanningMarkdown(input);

        expect(output).toMatchInlineSnapshot(`"- **Reel (Humor):** roteiro curto \u2014 Dia: quinta-feira"`);
    });

    it('does not alter Dia inside blockquotes or code blocks', () => {
        const input = [
            '> Dia: quarta-feira',
            '> detalhe',
            '',
            '```',
            'Dia: sexta-feira',
            '```',
        ].join('\n');

        const output = normalizePlanningMarkdown(input);

        expect(output).toBe(input);
    });

    it('does not attach Dia to title bullets', () => {
        const input = [
            '- **Semana 1:**',
            'Dia: Segunda',
        ].join('\n');

        const output = normalizePlanningMarkdown(input);

        expect(output).toBe(input);
    });

    it('does not repair dangling bold inside inline code', () => {
        const input = 'Use `Reel (Humor)**:` como exemplo.';

        const output = normalizePlanningMarkdown(input);

        expect(output).toBe(input);
    });
});

describe('renderFormatted', () => {
    let useIdSpy: jest.SpyInstance;

    beforeAll(() => {
        jest.useFakeTimers();
        useIdSpy = jest.spyOn(React, 'useId').mockReturnValue('static-id');
    });

    afterAll(() => {
        jest.useRealTimers();
        useIdSpy.mockRestore();
    });

    it('renders headings, lists, tables, and checklists', () => {
        const text = [
            '# Resumo',
            '## Insights',
            '- ponto um',
            '- ponto dois',
            '',
            '1. passo um',
            '2. passo dois',
            '',
            '- [x] feito',
            '- [ ] pendente',
            '',
            '| Coluna | Valor |',
            '| --- | --- |',
            '| A | 1 |',
            '',
            '## Detalhes',
            'Mais contexto aqui.',
        ].join('\n');

        const { container } = render(renderFormatted(text));

        expect(screen.getByRole('heading', { name: 'Resumo' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument();
        expect(container.querySelectorAll('ul').length).toBeGreaterThan(0);
        expect(container.querySelectorAll('ol')).toHaveLength(1);
        expect(container.querySelectorAll('table')).toHaveLength(1);
        expect(screen.getByText(/feito|Conclu/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Pendente/i).length).toBeGreaterThan(0);
        expect(container).toMatchSnapshot();
    });

    it('splits long paragraphs into multiple blocks', () => {
        const sentence = 'This sentence is intentionally verbose to force the paragraph splitter into action.';
        const text = [
            `${sentence} One.`,
            `${sentence} Two.`,
            `${sentence} Three.`,
            `${sentence} Four.`,
            `${sentence} Five.`,
        ].join(' ');

        const { container } = render(renderFormatted(text));
        const paragraphs = container.querySelectorAll('p');

        expect(paragraphs.length).toBeGreaterThan(1);
    });

    it('does not linkify javascript or data URLs', () => {
        const text = [
            'Seguro https://example.com e javascript:alert(1) e data:text/html,oi',
            'JaVaScRiPt:alert(1) e  javascript:alert(1)',
            'java%73cript:alert(1)',
            '[x](javascript:alert(1) "title")',
        ].join('\n');
        const { container } = render(renderFormatted(text));
        const links = container.querySelectorAll('a');

        expect(links).toHaveLength(1);
        expect(links[0]?.getAttribute('href')).toBe('https://example.com');
        expect(container.textContent).toContain('javascript:alert(1)');
        expect(container.textContent).toContain('JaVaScRiPt:alert(1)');
        expect(container.textContent).toContain('data:text/html,oi');
        expect(container.textContent).toContain('java%73cript:alert(1)');
    });

    it('renders fallback actions when suggested actions are missing', () => {
        const text = 'Preciso de um roteiro para um Reels engraçado.';
        render(renderFormatted(text, 'default', { onSendPrompt: jest.fn(), allowSuggestedActions: true }));

        expect(screen.getByRole('button', { name: 'Gerar roteiro completo' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Criar legenda pronta' })).toBeInTheDocument();
    });

    it('renders context-collection actions when script clarification is returned', () => {
        const text = [
            '### Falta um detalhe para fechar seu roteiro',
            '> [!IMPORTANT]',
            '> Qual tema específico você quer abordar neste roteiro?',
            '',
            '[BUTTON: Informar tema específico]',
            '[BUTTON: Pode usar meu nicho atual]',
        ].join('\n');

        render(renderFormatted(text, 'default', { onSendPrompt: jest.fn(), allowSuggestedActions: true }));

        expect(screen.getByRole('button', { name: 'Informar tema específico' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pode usar meu nicho atual' })).toBeInTheDocument();
    });

    it('renders roteiro e legenda no mesmo ScriptBlock', () => {
        const text = [
            '[ROTEIRO]',
            '**Título Sugerido:** Roteiro de teste',
            '**Pauta Estratégica:** orçamento doméstico prático',
            '**Base de Engajamento:** Categorias com melhor engajamento: tutorial + finance',
            '**Confiança da Base:** Média',
            '**Fonte da Inspiração:** Top posts do criador',
            '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
            ':---',
            '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
            '| :--- | :--- | :--- |',
            '| 00-03s | Gancho visual | Gancho falado |',
            '| 03-20s | Desenvolvimento | Explicação prática |',
            '| 20-30s | Encerramento | CTA final |',
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

        render(renderFormatted(text, 'default', { onSendPrompt: jest.fn(), allowSuggestedActions: true }));

        expect(screen.getAllByText('Roteiro').length).toBeGreaterThan(0);
        expect(screen.getByText(/Legenda pronta/i)).toBeInTheDocument();
        expect(screen.getByText('Legenda principal de teste')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'V1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'V2' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'V3' })).toBeInTheDocument();
        expect(screen.getByText(/Evidências \(3\)/i)).toBeInTheDocument();
        expect(screen.getAllByText('Visual').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Fala').length).toBeGreaterThan(0);
        expect(screen.getByText(/Pauta estratégica:/i)).toBeInTheDocument();
        expect(screen.queryByText(':---')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ajustar para meu nicho' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mais específico' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Outras melhorias' })).toBeInTheDocument();
    });
});
