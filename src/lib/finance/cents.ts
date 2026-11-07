/**
 * Motor Matemático de Centavos e Formatação Financeira Estrita
 * Previne perdas de precisão IEEE-754 mantendo todos os valores em inteiros.
 */

export function toCents(val: number | string): number {
  if (typeof val === 'number') {
    return Math.round(val * 100);
  }
  if (!val) return 0;
  
  // Limpa caracteres de moeda e normaliza
  const cleaned = val
    .toString()
    .replace(/[^\d,-]/g, '')
    .replace(',', '.');
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

export function fromCents(cents: number): number {
  return (cents || 0) / 100;
}

export function formatBRL(cents: number | null | undefined): string {
  const valueInReais = (cents || 0) / 100;
  return valueInReais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(val: number | null | undefined, decimals = 1): string {
  const num = Number(val) || 0;
  return `${num.toFixed(decimals)}%`;
}

export function parseCurrencyInput(input: string): number {
  if (!input) return 0;
  // Exemplo de entrada: "1.250,50" ou "1250,50" ou "1250.50"
  const digitsOnly = input.replace(/\D/g, '');
  if (!digitsOnly) return 0;
  return parseInt(digitsOnly, 10);
}

export interface SplitInput {
  companyId: string;
  percentage: number;
}

export interface SplitResult {
  companyId: string;
  percentage: number;
  cents: number;
}

/**
 * Divide um valor total em centavos entre múltiplas empresas com compensação exata
 * de centavos residuais, garantindo que a soma dos splits seja EXATAMENTE igual ao total.
 */
export function calculateSplits(totalCents: number, splits: SplitInput[]): SplitResult[] {
  if (!splits || splits.length === 0) return [];
  if (splits.length === 1) {
    return [{ companyId: splits[0].companyId, percentage: 100, cents: totalCents }];
  }

  let allocatedCents = 0;
  const results: SplitResult[] = [];

  for (let i = 0; i < splits.length; i++) {
    const isLast = i === splits.length - 1;
    if (isLast) {
      // O último split recebe exatamente a diferença restante
      const remainingCents = totalCents - allocatedCents;
      results.push({
        companyId: splits[i].companyId,
        percentage: splits[i].percentage,
        cents: remainingCents,
      });
    } else {
      const splitCents = Math.round((totalCents * splits[i].percentage) / 100);
      allocatedCents += splitCents;
      results.push({
        companyId: splits[i].companyId,
        percentage: splits[i].percentage,
        cents: splitCents,
      });
    }
  }

  return results;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getCurYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function formatMonthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
