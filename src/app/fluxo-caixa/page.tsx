'use client';

import React, { useState, useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { formatBRL, formatMonthName } from '@/lib/finance/cents';
import {
  WalletCards,
  TrendingUp,
  TrendingDown,
  Lock,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function FluxoCaixaPage() {
  const {
    activeProfile,
    companies,
    activeCompanyId,
    currentYM,
    transactions,
    accounts,
  } = useFinancial();

  const [mostrarFechamento, setMostrarFechamento] = useState(false);
  const [saldoFisicoConferido, setSaldoFisicoConferido] = useState('');

  // Agrupamento de entradas e saídas por dia do mês
  const fluxoPorDia = useMemo(() => {
    const diasMap = new Map<
      string,
      { data: string; entradas: number; saidas: number; saldoDia: number; itens: any[] }
    >();

    transactions.forEach((t) => {
      const dataRef = t.data_competencia || '';
      if (!dataRef.startsWith(currentYM)) return;
      if (activeCompanyId && t.company_id !== activeCompanyId) return;

      const dia = diasMap.get(dataRef) || {
        data: dataRef,
        entradas: 0,
        saidas: 0,
        saldoDia: 0,
        itens: [],
      };

      if (t.tipo === 'receita') {
        dia.entradas += t.valor_centavos;
        dia.saldoDia += t.valor_centavos;
      } else if (t.tipo === 'despesa') {
        dia.saidas += t.valor_centavos;
        dia.saldoDia -= t.valor_centavos;
      }
      dia.itens.push(t);
      diasMap.set(dataRef, dia);
    });

    return Array.from(diasMap.values()).sort((a, b) => b.data.localeCompare(a.data));
  }, [transactions, currentYM, activeCompanyId]);

  const totalEntradas = useMemo(
    () => fluxoPorDia.reduce((acc, d) => acc + d.entradas, 0),
    [fluxoPorDia]
  );
  const totalSaidas = useMemo(
    () => fluxoPorDia.reduce((acc, d) => acc + d.saidas, 0),
    [fluxoPorDia]
  );
  const saldoLiquidoPeriodo = totalEntradas - totalSaidas;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Fluxo de Caixa Diário
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Movimentação consolidada por dia e fechamento de caixa
          </p>
        </div>

        <button
          onClick={() => setMostrarFechamento(!mostrarFechamento)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-xl bg-slate-900 dark:bg-slate-800 text-white shadow-sm hover:bg-slate-800 transition-all cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          <span>Fechamento Cego de Caixa</span>
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Entradas (Realizadas)
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono my-1">
            {formatBRL(totalEntradas)}
          </div>
          <span className="text-[11px] text-slate-400">Receitas operacionais do período</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Saídas (Pagas)
          </span>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 font-mono my-1">
            {formatBRL(totalSaidas)}
          </div>
          <span className="text-[11px] text-slate-400">Custos e despesas fixas</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Saldo Líquido do Período
          </span>
          <div
            className={`text-2xl font-black font-mono my-1 ${
              saldoLiquidoPeriodo >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatBRL(saldoLiquidoPeriodo)}
          </div>
          <span className="text-[11px] text-slate-400">Variação líquida de caixa</span>
        </div>
      </div>

      {/* Modal / Card de Fechamento Cego de Caixa */}
      {mostrarFechamento && (
        <div className="p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-base">Conferência e Fechamento Diário</h3>
            </div>
            <span className="text-xs text-slate-400">Auditoria física vs bancária</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Saldo Físico Conferido em Mãos / Carteira (R$)
              </label>
              <input
                type="number"
                value={saldoFisicoConferido}
                onChange={(e) => setSaldoFisicoConferido(e.target.value)}
                placeholder="Ex: 540.00"
                className="w-full px-3.5 py-2 text-sm font-bold bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Digite o valor real contado em caixa sem olhar o saldo do sistema.
              </p>
            </div>

            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 flex flex-col justify-center">
              <span className="text-xs text-slate-400">Status da Auditoria:</span>
              <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Fechamento pronto para homologação</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista Diária do Fluxo de Caixa */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Extrato Diário Consolidado ({formatMonthName(currentYM)})
          </h3>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {fluxoPorDia.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              Nenhuma movimentação de caixa neste mês.
            </p>
          ) : (
            fluxoPorDia.map((dia) => (
              <div key={dia.data} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono font-bold text-xs">
                    {dia.data.split('-')[2]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                      {dia.data}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {dia.itens.length} lançamentos realizados no dia
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs sm:text-sm font-mono font-bold">
                  <div className="text-emerald-600">
                    +{formatBRL(dia.entradas)}
                  </div>
                  <div className="text-red-500">
                    -{formatBRL(dia.saidas)}
                  </div>
                  <div
                    className={`w-28 text-right font-black ${
                      dia.saldoDia >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatBRL(dia.saldoDia)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
