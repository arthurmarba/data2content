import { sanitizeTables } from './route';

describe('sanitizeTables', () => {
  it('preserva tabelas markdown completas', () => {
    const markdown = [
      'Introdução',
      '',
      '| Coluna A | Coluna B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '| 3 | 4 |',
      '',
      'Conclusão',
    ].join('\n');

    const result = sanitizeTables(markdown);
    expect(result).toContain('| Coluna A | Coluna B |');
    expect(result).toContain('| 3 | 4 |');
    expect(result).toContain('Conclusão');
  });
});
