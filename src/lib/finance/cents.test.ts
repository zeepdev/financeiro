import { describe, it, expect } from 'vitest';
import { toCents, fromCents, formatBRL, calculateSplits } from './cents';

describe('Motor Matemático de Centavos', () => {
  it('converte valores em reais para centavos sem perda', () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(1250.99)).toBe(125099);
    expect(toCents('1.250,50')).toBe(125050);
    expect(toCents('0,01')).toBe(1);
    expect(toCents(0)).toBe(0);
  });

  it('converte centavos para reais', () => {
    expect(fromCents(1050)).toBe(10.5);
    expect(fromCents(125099)).toBe(1250.99);
    expect(fromCents(0)).toBe(0);
  });

  it('formata moeda BRL corretamente', () => {
    const formatted = formatBRL(125050);
    expect(formatted).toContain('1.250,50');
  });

  it('calcula splits com compensação exata de centavos residuais (soma 100%)', () => {
    // R$ 100,00 dividido em 3 empresas de 33.33%, 33.33%, 33.34%
    const total = 10000;
    const splits = [
      { companyId: 'c1', percentage: 33.33 },
      { companyId: 'c2', percentage: 33.33 },
      { companyId: 'c3', percentage: 33.34 },
    ];

    const result = calculateSplits(total, splits);
    expect(result).toHaveLength(3);
    const sumCents = result.reduce((acc, s) => acc + s.cents, 0);
    expect(sumCents).toBe(total);
  });

  it('calcula split clássico 60% / 40%', () => {
    const total = 250000; // R$ 2.500,00
    const splits = [
      { companyId: 'athena', percentage: 60 },
      { companyId: 'click', percentage: 40 },
    ];
    const result = calculateSplits(total, splits);
    expect(result[0].cents).toBe(150000); // R$ 1.500,00
    expect(result[1].cents).toBe(100000); // R$ 1.000,00
    expect(result[0].cents + result[1].cents).toBe(total);
  });
});
