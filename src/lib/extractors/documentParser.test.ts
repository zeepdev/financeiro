import { describe, it, expect } from 'vitest';
import {
  extrairValorCentavos,
  normalizarData,
  processFinancialText,
} from './documentParser';

describe('Document Parser & Extractor Tests', () => {
  it('deve extrair valores em centavos corretamente de formatos brasileiros', () => {
    expect(extrairValorCentavos('R$ 150,00')).toBe(15000);
    expect(extrairValorCentavos('1.250,50')).toBe(125050);
    expect(extrairValorCentavos('R$ 0,75')).toBe(75);
    expect(extrairValorCentavos('-R$ 49,90')).toBe(4990);
    expect(extrairValorCentavos('1500.00')).toBe(150000);
  });

  it('deve normalizar datas brasileiras para o formato ISO YYYY-MM-DD', () => {
    expect(normalizarData('07/11/2026')).toBe('2026-11-07');
    expect(normalizarData('15-05-2025')).toBe('2025-05-15');
    expect(normalizarData('10 de outubro de 2026')).toBe('2026-10-10');
  });

  it('deve reconhecer comprovante de PIX com favorecido e banco', () => {
    const rawPixText = `
      Comprovante de Transferência PIX
      Nubank
      Valor: R$ 350,00
      Data: 07/11/2026
      Para: João da Silva
      Chave Pix: joao@email.com
      Autenticação: A89B76C123
    `;

    const result = processFinancialText(rawPixText, 'imagem', 'pix_joao.png', 1024);

    expect(result.sucesso).toBe(true);
    expect(result.transacoes.length).toBe(1);
    expect(result.transacoes[0].valorCentavos).toBe(35000);
    expect(result.transacoes[0].data).toBe('2026-11-07');
    expect(result.metadata?.banco).toBe('NUBANK');
    expect(result.metadata?.pagadorOuFavorecido).toContain('João da Silva');
    expect(result.transacoes[0].tipo).toBe('despesa');
  });

  it('deve reconhecer PIX recebido como receita', () => {
    const rawReceitaText = `
      Comprovante de Transferência Recebida
      Banco Inter
      Valor: R$ 1.800,00
      Data: 05/11/2026
      De: Cliente ABC Serviços
    `;

    const result = processFinancialText(rawReceitaText, 'imagem', 'recibo.jpg', 2048);

    expect(result.sucesso).toBe(true);
    expect(result.transacoes[0].valorCentavos).toBe(180000);
    expect(result.transacoes[0].tipo).toBe('receita');
  });
});
