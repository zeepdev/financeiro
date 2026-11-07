import { Transaction, GrupoDRE } from '@/types/database.types';

export interface DREPeriodResult {
  mesAno: string;
  regime: 'competencia' | 'caixa';
  companyId?: string | null;
  
  // 1. Receitas
  receitaServicosCentavos: number;
  receitaProdutosCentavos: number;
  receitaBrutaTotalCentavos: number;
  totalAtendimentos: number;
  ticketMedioCentavos: number;

  // 2. Deduções
  aliquotaImpostoPercent: number;
  deducoesImpostosCentavos: number;
  receitaLiquidaCentavos: number;

  // 3. Custos Variáveis
  custoInsumosCentavos: number;
  comissoesCentavos: number;
  totalCustosVariaveisCentavos: number;

  // 4. Margem de Contribuição
  margemContribuicaoCentavos: number;
  indiceMargemContribuicaoPercent: number;

  // 5. Despesas Fixas Estruturais
  despesasPorGrupoCentavos: {
    ocupacao: number;
    pessoal: number;
    tecnologia: number;
    marketing: number;
    financeiro: number;
    outros: number;
  };
  totalDespesasFixasCentavos: number;

  // 6. Resultado Operacional Líquido (EBITDA)
  lucroLiquidoOperacionalCentavos: number;
  margemLiquidaPercent: number;

  // 7. Ponto de Equilíbrio (Break-Even)
  pontoEquilibrioCentavos: number;
  faturamentoMinimoDiarioCentavos: number;
  atingimentoBreakEvenPercent: number;
  diasUteis: number;
}

export interface AnaliseHorizontalResult {
  deltaReceitaBruta: number;
  deltaReceitaLiquida: number;
  deltaMargemContribuicao: number;
  deltaDespesasFixas: number;
  deltaLucroLiquido: number;
  deltaTicketMedio: number;
}

export interface SimuladorLucroResult {
  faturamentoNecessarioCentavos: number;
  atendimentosNecessarios: number;
  diferencaFaturamentoCentavos: number;
}

/**
 * Filtra e calcula o valor efetivo de uma transação considerando os splits de empresa.
 */
function getEffectiveTransactionCents(t: Transaction, filterCompanyId?: string | null): number {
  if (!filterCompanyId) {
    return t.valor_centavos;
  }
  if (t.has_splits && t.splits && t.splits.length > 0) {
    const split = t.splits.find((s) => s.company_id === filterCompanyId);
    return split ? split.valor_centavos : 0;
  }
  return t.company_id === filterCompanyId ? t.valor_centavos : 0;
}

/**
 * Calcula a DRE completa para um mês de competência ou caixa
 */
export function calcularDRE(
  transactions: Transaction[] = [],
  mesAno: string,
  regime: 'competencia' | 'caixa' = 'competencia',
  companyId?: string | null,
  aliquotaImposto = 0.06
): DREPeriodResult {
  // 1. Filtragem por mês e regime
  const txsMes = transactions.filter((t) => {
    if (t.status === 'cancelado' || t.deleted_at) return false;

    if (regime === 'caixa') {
      if (t.status !== 'pago' || !t.data_pagamento) return false;
      const dataRef = t.data_pagamento.substring(0, 7);
      return dataRef === mesAno;
    } else {
      const dataRef = t.data_competencia ? t.data_competencia.substring(0, 7) : '';
      return dataRef === mesAno;
    }
  });

  let receitaServicos = 0;
  let receitaProdutos = 0;
  let custoInsumos = 0;
  let comissoes = 0;
  let contagemReceitas = 0;

  const despesasPorGrupo = {
    ocupacao: 0,
    pessoal: 0,
    tecnologia: 0,
    marketing: 0,
    financeiro: 0,
    outros: 0,
  };

  txsMes.forEach((t) => {
    const val = getEffectiveTransactionCents(t, companyId);
    if (val <= 0) return;

    const grupo: GrupoDRE = t.category?.grupo_dre || 'despesa_fixa_outros';

    if (t.tipo === 'receita') {
      contagemReceitas++;
      if (grupo === 'receita_bruta_produto') {
        receitaProdutos += val;
      } else {
        receitaServicos += val;
      }
    } else if (t.tipo === 'despesa') {
      switch (grupo) {
        case 'custo_variavel_insumo':
          custoInsumos += val;
          break;
        case 'custo_variavel_comissao':
          comissoes += val;
          break;
        case 'despesa_fixa_ocupacao':
          despesasPorGrupo.ocupacao += val;
          break;
        case 'despesa_fixa_pessoal':
          despesasPorGrupo.pessoal += val;
          break;
        case 'despesa_fixa_tecnologia':
          despesasPorGrupo.tecnologia += val;
          break;
        case 'despesa_fixa_marketing':
          despesasPorGrupo.marketing += val;
          break;
        case 'despesa_fixa_financeiro':
          despesasPorGrupo.financeiro += val;
          break;
        case 'deducao_imposto':
          // Impostos lançados diretamente
          break;
        default:
          despesasPorGrupo.outros += val;
          break;
      }
    }
  });

  const receitaBrutaTotal = receitaServicos + receitaProdutos;
  const ticketMedio = contagemReceitas > 0 ? Math.round(receitaBrutaTotal / contagemReceitas) : 0;

  // Deduções e Impostos Estimados
  const deducoesImpostos = Math.round(receitaBrutaTotal * aliquotaImposto);
  const receitaLiquida = Math.max(0, receitaBrutaTotal - deducoesImpostos);

  // Custos Variáveis
  const totalCustosVariaveis = custoInsumos + comissoes;

  // Margem de Contribuição
  const margemContribuicao = receitaLiquida - totalCustosVariaveis;
  const indiceMargem = receitaLiquida > 0 ? (margemContribuicao / receitaLiquida) * 100 : 0;

  // Despesas Fixas
  const totalDespesasFixas =
    despesasPorGrupo.ocupacao +
    despesasPorGrupo.pessoal +
    despesasPorGrupo.tecnologia +
    despesasPorGrupo.marketing +
    despesasPorGrupo.financeiro +
    despesasPorGrupo.outros;

  // Resultado Operacional Líquido (EBITDA)
  const lucroLiquidoOperacional = margemContribuicao - totalDespesasFixas;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquidoOperacional / receitaLiquida) * 100 : 0;

  // Ponto de Equilíbrio Operacional
  const indiceDecimal = indiceMargem / 100;
  const pontoEquilibrio = indiceDecimal > 0 ? Math.round(totalDespesasFixas / indiceDecimal) : 0;

  const diasUteis = 22;
  const faturamentoMinimoDiario = pontoEquilibrio > 0 ? Math.round(pontoEquilibrio / diasUteis) : 0;
  const atingimentoBreakEven =
    pontoEquilibrio > 0 ? (receitaBrutaTotal / pontoEquilibrio) * 100 : 0;

  return {
    mesAno,
    regime,
    companyId,
    receitaServicosCentavos: receitaServicos,
    receitaProdutosCentavos: receitaProdutos,
    receitaBrutaTotalCentavos: receitaBrutaTotal,
    totalAtendimentos: contagemReceitas,
    ticketMedioCentavos: ticketMedio,
    aliquotaImpostoPercent: aliquotaImposto * 100,
    deducoesImpostosCentavos: deducoesImpostos,
    receitaLiquidaCentavos: receitaLiquida,
    custoInsumosCentavos: custoInsumos,
    comissoesCentavos: comissoes,
    totalCustosVariaveisCentavos: totalCustosVariaveis,
    margemContribuicaoCentavos: margemContribuicao,
    indiceMargemContribuicaoPercent: indiceMargem,
    despesasPorGrupoCentavos: despesasPorGrupo,
    totalDespesasFixasCentavos: totalDespesasFixas,
    lucroLiquidoOperacionalCentavos: lucroLiquidoOperacional,
    margemLiquidaPercent: margemLiquida,
    pontoEquilibrioCentavos: pontoEquilibrio,
    faturamentoMinimoDiarioCentavos: faturamentoMinimoDiario,
    atingimentoBreakEvenPercent: atingimentoBreakEven,
    diasUteis,
  };
}

/**
 * Calcula variação percentual entre dois períodos (Análise Horizontal)
 */
export function calcularAnaliseHorizontal(
  atual: DREPeriodResult,
  anterior: DREPeriodResult
): AnaliseHorizontalResult {
  const calcDelta = (vAtual: number, vAnt: number) => {
    if (!vAnt || vAnt === 0) return vAtual > 0 ? 100 : 0;
    return ((vAtual - vAnt) / Math.abs(vAnt)) * 100;
  };

  return {
    deltaReceitaBruta: calcDelta(atual.receitaBrutaTotalCentavos, anterior.receitaBrutaTotalCentavos),
    deltaReceitaLiquida: calcDelta(atual.receitaLiquidaCentavos, anterior.receitaLiquidaCentavos),
    deltaMargemContribuicao: calcDelta(atual.margemContribuicaoCentavos, anterior.margemContribuicaoCentavos),
    deltaDespesasFixas: calcDelta(atual.totalDespesasFixasCentavos, anterior.totalDespesasFixasCentavos),
    deltaLucroLiquido: calcDelta(atual.lucroLiquidoOperacionalCentavos, anterior.lucroLiquidoOperacionalCentavos),
    deltaTicketMedio: calcDelta(atual.ticketMedioCentavos, anterior.ticketMedioCentavos),
  };
}

/**
 * Simula faturamento e atendimentos necessários para alcançar um lucro líquido desejado em centavos
 */
export function simularLucroDesejado(
  dre: DREPeriodResult,
  lucroDesejadoCentavos: number
): SimuladorLucroResult {
  const indiceDecimal = dre.indiceMargemContribuicaoPercent / 100;
  if (indiceDecimal <= 0) {
    return {
      faturamentoNecessarioCentavos: 0,
      atendimentosNecessarios: 0,
      diferencaFaturamentoCentavos: 0,
    };
  }

  const faturamentoNecessario = Math.round(
    (dre.totalDespesasFixasCentavos + lucroDesejadoCentavos) / indiceDecimal
  );
  const ticket = dre.ticketMedioCentavos > 0 ? dre.ticketMedioCentavos : 50000;
  const atendimentos = Math.ceil(faturamentoNecessario / ticket);
  const diferenca = Math.max(0, faturamentoNecessario - dre.receitaBrutaTotalCentavos);

  return {
    faturamentoNecessarioCentavos: faturamentoNecessario,
    atendimentosNecessarios: atendimentos,
    diferencaFaturamentoCentavos: diferenca,
  };
}
