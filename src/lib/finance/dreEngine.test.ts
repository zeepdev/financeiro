import { describe, it, expect } from 'vitest';
import { calcularDRE, calcularAnaliseHorizontal, simularLucroDesejado } from './dreEngine';
import { Transaction } from '@/types/database.types';

describe('Motor Contábil DRE (Base zp-sistema)', () => {
  const sampleTransactions: Transaction[] = [
    {
      id: 'tx-1',
      profile_id: 'p1',
      company_id: 'athena',
      account_id: 'acc1',
      category_id: 'cat-servico',
      tipo: 'receita',
      descricao: 'Serviço de Marketing',
      valor_centavos: 1000000, // R$ 10.000,00
      data_competencia: '2026-11-01',
      data_vencimento: '2026-11-01',
      data_pagamento: '2026-11-01T12:00:00Z',
      status: 'pago',
      is_recorrente: false,
      is_variavel: false,
      has_splits: false,
      tags: [],
      created_at: '2026-11-01T12:00:00Z',
      updated_at: '2026-11-01T12:00:00Z',
      category: {
        id: 'cat-servico',
        profile_id: 'p1',
        nome: 'Serviços',
        tipo: 'receita',
        grupo_dre: 'receita_bruta_servico',
        cor: '#fff',
        icone: 'tag',
        created_at: '',
      },
    },
    {
      id: 'tx-2',
      profile_id: 'p1',
      company_id: 'athena',
      account_id: 'acc1',
      category_id: 'cat-comissao',
      tipo: 'despesa',
      descricao: 'Comissão Especialista',
      valor_centavos: 100000, // R$ 1.000,00
      data_competencia: '2026-11-05',
      data_vencimento: '2026-11-05',
      data_pagamento: '2026-11-05T12:00:00Z',
      status: 'pago',
      is_recorrente: false,
      is_variavel: false,
      has_splits: false,
      tags: [],
      created_at: '',
      updated_at: '',
      category: {
        id: 'cat-comissao',
        profile_id: 'p1',
        nome: 'Comissão',
        tipo: 'despesa',
        grupo_dre: 'custo_variavel_comissao',
        cor: '#fff',
        icone: 'tag',
        created_at: '',
      },
    },
    {
      id: 'tx-3',
      profile_id: 'p1',
      company_id: 'athena',
      account_id: 'acc1',
      category_id: 'cat-aluguel',
      tipo: 'despesa',
      descricao: 'Aluguel Escritório',
      valor_centavos: 200000, // R$ 2.000,00
      data_competencia: '2026-11-10',
      data_vencimento: '2026-11-10',
      data_pagamento: '2026-11-10T12:00:00Z',
      status: 'pago',
      is_recorrente: true,
      is_variavel: false,
      has_splits: false,
      tags: [],
      created_at: '',
      updated_at: '',
      category: {
        id: 'cat-aluguel',
        profile_id: 'p1',
        nome: 'Aluguel',
        tipo: 'despesa',
        grupo_dre: 'despesa_fixa_ocupacao',
        cor: '#fff',
        icone: 'tag',
        created_at: '',
      },
    },
  ];

  it('calcula DRE com impostos de 6%, margem de contribuição e EBITDA', () => {
    const dre = calcularDRE(sampleTransactions, '2026-11', 'competencia', 'athena', 0.06);

    // Receita Bruta = R$ 10.000,00 (1.000.000 centavos)
    expect(dre.receitaBrutaTotalCentavos).toBe(1000000);

    // Imposto 6% = R$ 600,00 (60.000 centavos)
    expect(dre.deducoesImpostosCentavos).toBe(60000);

    // Receita Líquida = 10.000 - 600 = R$ 9.400,00 (940.000 centavos)
    expect(dre.receitaLiquidaCentavos).toBe(940000);

    // Custos Variáveis = Comissão R$ 1.000,00 (100.000 centavos)
    expect(dre.totalCustosVariaveisCentavos).toBe(100000);

    // Margem de Contribuição = 9.400 - 1.000 = R$ 8.400,00 (840.000 centavos)
    expect(dre.margemContribuicaoCentavos).toBe(840000);

    // Despesas Fixas = R$ 2.000,00 (200.000 centavos)
    expect(dre.totalDespesasFixasCentavos).toBe(200000);

    // EBITDA / Lucro Operacional = 8.400 - 2.000 = R$ 6.400,00 (640.000 centavos)
    expect(dre.lucroLiquidoOperacionalCentavos).toBe(640000);
  });

  it('calcula taxa de atingimento e Ponto de Equilíbrio Operacional', () => {
    const dre = calcularDRE(sampleTransactions, '2026-11', 'competencia', 'athena', 0.06);
    expect(dre.pontoEquilibrioCentavos).toBeGreaterThan(0);
    expect(dre.faturamentoMinimoDiarioCentavos).toBe(Math.round(dre.pontoEquilibrioCentavos / 22));
    expect(dre.atingimentoBreakEvenPercent).toBeGreaterThan(100);
  });

  it('respeita splits ao filtrar por empresa', () => {
    const splitTx: Transaction = {
      id: 'tx-split',
      profile_id: 'p1',
      account_id: 'acc1',
      category_id: 'cat-aluguel',
      tipo: 'despesa',
      descricao: 'Coworking Compartilhado',
      valor_centavos: 100000, // R$ 1.000,00 total
      data_competencia: '2026-11-15',
      data_vencimento: '2026-11-15',
      data_pagamento: '2026-11-15T10:00:00Z',
      status: 'pago',
      is_recorrente: false,
      is_variavel: false,
      has_splits: true,
      tags: [],
      created_at: '',
      updated_at: '',
      splits: [
        { id: 's1', transaction_id: 'tx-split', company_id: 'athena', percentual: 60, valor_centavos: 60000, created_at: '' },
        { id: 's2', transaction_id: 'tx-split', company_id: 'click', percentual: 40, valor_centavos: 40000, created_at: '' },
      ],
      category: {
        id: 'cat-aluguel',
        profile_id: 'p1',
        nome: 'Aluguel',
        tipo: 'despesa',
        grupo_dre: 'despesa_fixa_ocupacao',
        cor: '#fff',
        icone: 'tag',
        created_at: '',
      },
    };

    const dreAthena = calcularDRE([splitTx], '2026-11', 'competencia', 'athena', 0);
    expect(dreAthena.totalDespesasFixasCentavos).toBe(60000); // Exatos 60%

    const dreClick = calcularDRE([splitTx], '2026-11', 'competencia', 'click', 0);
    expect(dreClick.totalDespesasFixasCentavos).toBe(40000); // Exatos 40%

    const dreConsolidada = calcularDRE([splitTx], '2026-11', 'competencia', null, 0);
    expect(dreConsolidada.totalDespesasFixasCentavos).toBe(100000); // Total 100%
  });
});
