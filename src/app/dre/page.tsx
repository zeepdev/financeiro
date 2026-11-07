'use client';

import React, { useState, useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { formatBRL, formatPercent, formatMonthName } from '@/lib/finance/cents';
import {
  calcularDRE,
  calcularAnaliseHorizontal,
  simularLucroDesejado,
} from '@/lib/finance/dreEngine';
import {
  TrendingUp,
  TrendingDown,
  Printer,
  ChevronDown,
  ChevronUp,
  Calculator,
  Lock,
  Calendar,
  Building2,
  DollarSign,
  PieChart,
  Target,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function DREPage() {
  const {
    activeProfile,
    companies,
    activeCompanyId,
    activeCompany,
    currentYM,
    setCurrentYM,
    transactions,
    refetchData,
  } = useFinancial();

  const supabase = createClient();

  const [regime, setRegime] = useState<'competencia' | 'caixa'>('competencia');
  const [expandirSubcontas, setExpandirSubcontas] = useState(true);
  const [aliquotaImposto, setAliquotaImposto] = useState(6.0); // 6% padrão

  // Simulador de Lucro Desejado
  const [lucroDesejadoInput, setLucroDesejadoInput] = useState('10000');

  // DRE do Mês Selecionado
  const dreAtual = useMemo(() => {
    return calcularDRE(
      transactions,
      currentYM,
      regime,
      activeCompanyId,
      aliquotaImposto / 100
    );
  }, [transactions, currentYM, regime, activeCompanyId, aliquotaImposto]);

  // DRE do Mês Anterior para Análise Horizontal
  const [ano, mes] = currentYM.split('-').map(Number);
  const prevDate = new Date(ano, mes - 2, 1);
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const dreAnterior = useMemo(() => {
    return calcularDRE(
      transactions,
      prevYM,
      regime,
      activeCompanyId,
      aliquotaImposto / 100
    );
  }, [transactions, prevYM, regime, activeCompanyId, aliquotaImposto]);

  const analiseHorizontal = useMemo(() => {
    return calcularAnaliseHorizontal(dreAtual, dreAnterior);
  }, [dreAtual, dreAnterior]);

  // Simulação de Lucro
  const simulacao = useMemo(() => {
    const centsDesejado = (Number(lucroDesejadoInput) || 0) * 100;
    return simularLucroDesejado(dreAtual, centsDesejado);
  }, [dreAtual, lucroDesejadoInput]);

  // Congelar / Fechar DRE do Mês
  const handleCongelarDRE = async () => {
    if (!activeProfile) return;
    const confirm = window.confirm(
      `Deseja realmente congelar o fechamento da DRE de ${formatMonthName(currentYM)} no regime de ${regime.toUpperCase()}?`
    );
    if (!confirm) return;

    try {
      const { error } = await supabase.from('dre_fechamentos').upsert({
        profile_id: activeProfile.id,
        company_id: activeCompanyId || null,
        mes_ano: currentYM,
        regime,
        dados_dre: dreAtual as any,
        fechado_por: activeProfile.nome,
        fechado_em: new Date().toISOString(),
      });

      if (error) throw error;
      alert('DRE congelada com sucesso no registro oficial de fechamentos!');
    } catch (err: any) {
      alert('Erro ao congelar DRE: ' + err.message);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da DRE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Demonstração do Resultado do Exercício (DRE)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {regime === 'competencia' ? 'Regime de Competência' : 'Regime de Caixa'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Margem de contribuição, break-even operacional, EBITDA e análise vertical/horizontal
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Regime */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setRegime('competencia')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                regime === 'competencia'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Competência
            </button>
            <button
              onClick={() => setRegime('caixa')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                regime === 'caixa'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Caixa
            </button>
          </div>

          <button
            onClick={handleImprimir}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Relatório</span>
          </button>

          <button
            onClick={handleCongelarDRE}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Congelar Mês</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas Principais da DRE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        {/* Margem de Contribuição */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Margem de Contribuição
          </span>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono my-1">
            {formatBRL(dreAtual.margemContribuicaoCentavos)}
          </div>
          <span className="text-xs text-slate-500">
            Índice: <strong className="text-indigo-600">{formatPercent(dreAtual.indiceMargemContribuicaoPercent)}</strong> da Rec. Líquida
          </span>
        </div>

        {/* Ponto de Equilíbrio Operacional */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Ponto de Equilíbrio (PE)
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono my-1">
            {formatBRL(dreAtual.pontoEquilibrioCentavos)}
          </div>
          <span
            className={`text-xs font-bold ${
              dreAtual.atingimentoBreakEvenPercent >= 100
                ? 'text-emerald-600'
                : 'text-amber-500'
            }`}
          >
            {Math.round(dreAtual.atingimentoBreakEvenPercent)}% coberto no mês
          </span>
        </div>

        {/* Faturamento Mínimo por Dia Útil */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Faturamento Mínimo / Dia
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono my-1">
            {formatBRL(dreAtual.faturamentoMinimoDiarioCentavos)}
          </div>
          <span className="text-xs text-slate-500">Base 22 dias úteis de operação</span>
        </div>

        {/* Lucro Operacional Líquido (EBITDA) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Resultado Líquido (EBITDA)
          </span>
          <div
            className={`text-xl sm:text-2xl font-black font-mono my-1 ${
              dreAtual.lucroLiquidoOperacionalCentavos >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatBRL(dreAtual.lucroLiquidoOperacionalCentavos)}
          </div>
          <span className="text-xs text-slate-500">
            Margem Líquida: <strong>{formatPercent(dreAtual.margemLiquidaPercent)}</strong>
          </span>
        </div>
      </div>

      {/* Painel de Análise Horizontal vs Mês Anterior */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs print:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Análise Horizontal vs Mês Anterior ({prevYM})
            </h3>
          </div>
          <span className="text-xs text-slate-400">Variação Percentual ($\Delta\%$)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="text-[11px] text-slate-500">Receita Bruta:</span>
            <div className="text-base font-bold mt-0.5 font-mono">
              <span
                className={
                  analiseHorizontal.deltaReceitaBruta >= 0 ? 'text-emerald-600' : 'text-red-500'
                }
              >
                {analiseHorizontal.deltaReceitaBruta >= 0 ? '+' : ''}
                {formatPercent(analiseHorizontal.deltaReceitaBruta)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="text-[11px] text-slate-500">Margem Contribuição:</span>
            <div className="text-base font-bold mt-0.5 font-mono">
              <span
                className={
                  analiseHorizontal.deltaMargemContribuicao >= 0 ? 'text-emerald-600' : 'text-red-500'
                }
              >
                {analiseHorizontal.deltaMargemContribuicao >= 0 ? '+' : ''}
                {formatPercent(analiseHorizontal.deltaMargemContribuicao)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="text-[11px] text-slate-500">Despesas Fixas:</span>
            <div className="text-base font-bold mt-0.5 font-mono">
              <span
                className={
                  analiseHorizontal.deltaDespesasFixas <= 0 ? 'text-emerald-600' : 'text-red-500'
                }
              >
                {analiseHorizontal.deltaDespesasFixas >= 0 ? '+' : ''}
                {formatPercent(analiseHorizontal.deltaDespesasFixas)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="text-[11px] text-slate-500">Lucro Líquido:</span>
            <div className="text-base font-bold mt-0.5 font-mono">
              <span
                className={
                  analiseHorizontal.deltaLucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-500'
                }
              >
                {analiseHorizontal.deltaLucroLiquido >= 0 ? '+' : ''}
                {formatPercent(analiseHorizontal.deltaLucroLiquido)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela Estruturada da DRE Vertical (Conforme zp-sistema) */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Demonstração Contábil Detalhada ({currentYM})
            </h3>
            <p className="text-xs text-slate-400">
              Alíquota de imposto estimada configurada em {aliquotaImposto}%
            </p>
          </div>

          <button
            onClick={() => setExpandirSubcontas(!expandirSubcontas)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer print:hidden"
          >
            {expandirSubcontas ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{expandirSubcontas ? 'Recolher Subcontas' : 'Expandir Subcontas'}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-5">Linha da DRE</th>
                <th className="py-3 px-5 text-right">Valor (R$)</th>
                <th className="py-3 px-5 text-right w-28">% Análise Vertical</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* 1. Receita Operacional Bruta */}
              <tr className="bg-slate-100/60 dark:bg-slate-800/60 font-bold text-slate-900 dark:text-white">
                <td className="py-3 px-5">1. RECEITA OPERACIONAL BRUTA</td>
                <td className="py-3 px-5 text-right font-mono text-base">
                  {formatBRL(dreAtual.receitaBrutaTotalCentavos)}
                </td>
                <td className="py-3 px-5 text-right">100.0%</td>
              </tr>
              {expandirSubcontas && (
                <>
                  <tr className="text-slate-600 dark:text-slate-400 text-xs">
                    <td className="py-2 px-8">(+) Faturamento em Prestação de Serviços</td>
                    <td className="py-2 px-5 text-right font-mono">
                      {formatBRL(dreAtual.receitaServicosCentavos)}
                    </td>
                    <td className="py-2 px-5 text-right">
                      {formatPercent(
                        dreAtual.receitaBrutaTotalCentavos > 0
                          ? (dreAtual.receitaServicosCentavos / dreAtual.receitaBrutaTotalCentavos) * 100
                          : 0
                      )}
                    </td>
                  </tr>
                  <tr className="text-slate-600 dark:text-slate-400 text-xs">
                    <td className="py-2 px-8">(+) Faturamento em Vendas / Produtos</td>
                    <td className="py-2 px-5 text-right font-mono">
                      {formatBRL(dreAtual.receitaProdutosCentavos)}
                    </td>
                    <td className="py-2 px-5 text-right">
                      {formatPercent(
                        dreAtual.receitaBrutaTotalCentavos > 0
                          ? (dreAtual.receitaProdutosCentavos / dreAtual.receitaBrutaTotalCentavos) * 100
                          : 0
                      )}
                    </td>
                  </tr>
                </>
              )}

              {/* 2. Deduções da Receita */}
              <tr className="text-red-500 font-medium">
                <td className="py-3 px-5">
                  2. (-) Deduções e Impostos Estimados ({dreAtual.aliquotaImpostoPercent}%)
                </td>
                <td className="py-3 px-5 text-right font-mono">
                  - {formatBRL(dreAtual.deducoesImpostosCentavos)}
                </td>
                <td className="py-3 px-5 text-right text-xs">
                  {formatPercent(dreAtual.aliquotaImpostoPercent)}
                </td>
              </tr>

              {/* 3. Receita Líquida */}
              <tr className="bg-blue-50/50 dark:bg-blue-950/30 font-bold text-blue-700 dark:text-blue-300">
                <td className="py-3 px-5">3. (=) RECEITA OPERACIONAL LÍQUIDA</td>
                <td className="py-3 px-5 text-right font-mono text-base">
                  {formatBRL(dreAtual.receitaLiquidaCentavos)}
                </td>
                <td className="py-3 px-5 text-right">100.0%</td>
              </tr>

              {/* 4. Custos Variáveis */}
              <tr className="text-red-500 font-medium">
                <td className="py-3 px-5">4. (-) Custos Variáveis Diretos Totais</td>
                <td className="py-3 px-5 text-right font-mono">
                  - {formatBRL(dreAtual.totalCustosVariaveisCentavos)}
                </td>
                <td className="py-3 px-5 text-right text-xs">
                  {formatPercent(
                    dreAtual.receitaLiquidaCentavos > 0
                      ? (dreAtual.totalCustosVariaveisCentavos / dreAtual.receitaLiquidaCentavos) * 100
                      : 0
                  )}
                </td>
              </tr>
              {expandirSubcontas && (
                <>
                  <tr className="text-slate-500 text-xs">
                    <td className="py-2 px-8">(-) Custo de Insumos / Mercadorias (CMV)</td>
                    <td className="py-2 px-5 text-right font-mono">
                      - {formatBRL(dreAtual.custoInsumosCentavos)}
                    </td>
                    <td className="py-2 px-5 text-right">-</td>
                  </tr>
                  <tr className="text-slate-500 text-xs">
                    <td className="py-2 px-8">(-) Comissões da Equipe / Terceiros</td>
                    <td className="py-2 px-5 text-right font-mono">
                      - {formatBRL(dreAtual.comissoesCentavos)}
                    </td>
                    <td className="py-2 px-5 text-right">-</td>
                  </tr>
                </>
              )}

              {/* 5. Margem de Contribuição */}
              <tr className="bg-indigo-50/60 dark:bg-indigo-950/40 font-black text-indigo-700 dark:text-indigo-300">
                <td className="py-3 px-5">5. (=) MARGEM DE CONTRIBUIÇÃO BRUTA</td>
                <td className="py-3 px-5 text-right font-mono text-base">
                  {formatBRL(dreAtual.margemContribuicaoCentavos)}
                </td>
                <td className="py-3 px-5 text-right">
                  {formatPercent(dreAtual.indiceMargemContribuicaoPercent)}
                </td>
              </tr>

              {/* 6. Despesas Fixas */}
              <tr className="text-red-500 font-medium">
                <td className="py-3 px-5">6. (-) Despesas Fixas Estruturais Totais</td>
                <td className="py-3 px-5 text-right font-mono">
                  - {formatBRL(dreAtual.totalDespesasFixasCentavos)}
                </td>
                <td className="py-3 px-5 text-right text-xs">
                  {formatPercent(
                    dreAtual.receitaLiquidaCentavos > 0
                      ? (dreAtual.totalDespesasFixasCentavos / dreAtual.receitaLiquidaCentavos) * 100
                      : 0
                  )}
                </td>
              </tr>
              {expandirSubcontas && (
                <>
                  <tr className="text-slate-500 text-xs">
                    <td className="py-2 px-8">(-) Ocupação (Aluguel, Luz, Água, Condomínio)</td>
                    <td className="py-2 px-5 text-right font-mono">
                      - {formatBRL(dreAtual.despesasPorGrupoCentavos.ocupacao)}
                    </td>
                    <td className="py-2 px-5 text-right">-</td>
                  </tr>
                  <tr className="text-slate-500 text-xs">
                    <td className="py-2 px-8">(-) Pessoal (Pró-labore, Salários, Benefícios)</td>
                    <td className="py-2 px-5 text-right font-mono">
                      - {formatBRL(dreAtual.despesasPorGrupoCentavos.pessoal)}
                    </td>
                    <td className="py-2 px-5 text-right">-</td>
                  </tr>
                  <tr className="text-slate-500 text-xs">
                    <td className="py-2 px-8">(-) Tecnologia & Softwares</td>
                    <td className="py-2 px-5 text-right font-mono">
                      - {formatBRL(dreAtual.despesasPorGrupoCentavos.tecnologia)}
                    </td>
                    <td className="py-2 px-5 text-right">-</td>
                  </tr>
                  <tr className="text-slate-500 text-xs">
                    <td className="py-2 px-8">(-) Marketing, Tráfego Pago & Anúncios</td>
                    <td className="py-2 px-5 text-right font-mono">
                      - {formatBRL(dreAtual.despesasPorGrupoCentavos.marketing)}
                    </td>
                    <td className="py-2 px-5 text-right">-</td>
                  </tr>
                  <tr className="text-slate-500 text-xs">
                    <td className="py-2 px-8">(-) Tarifas Bancárias & Maquininhas</td>
                    <td className="py-2 px-5 text-right font-mono">
                      - {formatBRL(dreAtual.despesasPorGrupoCentavos.financeiro)}
                    </td>
                    <td className="py-2 px-5 text-right">-</td>
                  </tr>
                  <tr className="text-slate-500 text-xs">
                    <td className="py-2 px-8">(-) Outras Despesas Operacionais</td>
                    <td className="py-2 px-5 text-right font-mono">
                      - {formatBRL(dreAtual.despesasPorGrupoCentavos.outros)}
                    </td>
                    <td className="py-2 px-5 text-right">-</td>
                  </tr>
                </>
              )}

              {/* 7. Lucro Operacional Líquido */}
              <tr
                className={`font-black text-sm sm:text-base ${
                  dreAtual.lucroLiquidoOperacionalCentavos >= 0
                    ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-red-100/70 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                }`}
              >
                <td className="py-4 px-5">7. (=) RESULTADO OPERACIONAL LÍQUIDO (EBITDA)</td>
                <td className="py-4 px-5 text-right font-mono text-lg">
                  {formatBRL(dreAtual.lucroLiquidoOperacionalCentavos)}
                </td>
                <td className="py-4 px-5 text-right">
                  {formatPercent(dreAtual.margemLiquidaPercent)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulador de Faturamento para Lucro Desejado */}
      <div className="p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl print:hidden">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-base">Simulador de Meta & Lucro Desejado</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Quanto você deseja ter de Lucro Líquido no mês? (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">
                R$
              </span>
              <input
                type="number"
                value={lucroDesejadoInput}
                onChange={(e) => setLucroDesejadoInput(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm font-bold bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Calculado com base na margem de contribuição atual de{' '}
              {formatPercent(dreAtual.indiceMargemContribuicaoPercent)}.
            </p>
          </div>

          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-xs text-slate-400">Faturamento Bruto Necessário:</span>
            <div className="text-xl font-black text-blue-400 font-mono mt-1">
              {formatBRL(simulacao.faturamentoNecessarioCentavos)}
            </div>
            <span className="text-[11px] text-slate-400">
              Diferença para meta: {formatBRL(simulacao.diferencaFaturamentoCentavos)}
            </span>
          </div>

          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-xs text-slate-400">Capacidade / Vendas Necessárias:</span>
            <div className="text-xl font-black text-emerald-400 font-mono mt-1">
              {simulacao.atendimentosNecessarios} atendimentos
            </div>
            <span className="text-[11px] text-slate-400">
              Ticket Médio: {formatBRL(dreAtual.ticketMedioCentavos)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
