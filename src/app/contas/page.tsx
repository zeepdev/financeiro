'use client';

import React, { useState, useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { formatBRL, formatMonthName } from '@/lib/finance/cents';
import { createClient } from '@/lib/supabase/client';
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from 'lucide-react';

export default function ContasPage() {
  const {
    activeProfile,
    companies,
    activeCompanyId,
    currentYM,
    transactions,
    openFastModal,
    refetchData,
  } = useFinancial();

  const supabase = createClient();
  const [aba, setAba] = useState<'a_pagar' | 'a_receber' | 'atrasadas' | 'liquidadas'>('a_pagar');
  const [hojeIso, setHojeIso] = useState('2026-11-07');

  React.useEffect(() => {
    setHojeIso(new Date().toISOString().substring(0, 10));
  }, []);

  // Filtra transações do perfil e da empresa ativa
  const transacoesFiltradas = useMemo(() => {
    return transactions.filter((t) => {
      if (activeCompanyId && t.company_id !== activeCompanyId) return false;
      return true;
    });
  }, [transactions, activeCompanyId]);

  // Contas a pagar (pendentes de despesa)
  const aPagar = useMemo(
    () => transacoesFiltradas.filter((t) => t.tipo === 'despesa' && t.status === 'pendente'),
    [transacoesFiltradas]
  );

  // Contas a receber (pendentes de receita)
  const aReceber = useMemo(
    () => transacoesFiltradas.filter((t) => t.tipo === 'receita' && t.status === 'pendente'),
    [transacoesFiltradas]
  );

  // Contas atrasadas (vencidas antes de hoje e ainda pendentes)
  const atrasadas = useMemo(
    () => transacoesFiltradas.filter((t) => t.status === 'pendente' && t.data_vencimento < hojeIso),
    [transacoesFiltradas, hojeIso]
  );

  // Contas liquidadas
  const liquidadas = useMemo(
    () => transacoesFiltradas.filter((t) => t.status === 'pago'),
    [transacoesFiltradas]
  );

  // Totais
  const totalAPagar = useMemo(() => aPagar.reduce((acc, t) => acc + t.valor_centavos, 0), [aPagar]);
  const totalAReceber = useMemo(() => aReceber.reduce((acc, t) => acc + t.valor_centavos, 0), [aReceber]);
  const totalAtrasadas = useMemo(() => atrasadas.reduce((acc, t) => acc + t.valor_centavos, 0), [atrasadas]);

  // Marcar como Pago / Baixar
  const handleBaixar = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      await refetchData();
    } catch (err: any) {
      alert('Erro ao baixar conta: ' + err.message);
    }
  };

  const listaAtual = useMemo(() => {
    switch (aba) {
      case 'a_pagar':
        return aPagar;
      case 'a_receber':
        return aReceber;
      case 'atrasadas':
        return atrasadas;
      case 'liquidadas':
        return liquidadas;
      default:
        return aPagar;
    }
  }, [aba, aPagar, aReceber, atrasadas, liquidadas]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Contas a Pagar & Receber
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gestão de vencimentos, alertas de atraso e baixas financeiras
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openFastModal('despesa')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Conta (N)</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span>Total a Pagar Pendente</span>
            <ArrowDownRight className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">
            {formatBRL(totalAPagar)}
          </div>
          <span className="text-[11px] text-slate-400">{aPagar.length} contas pendentes</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span>Total a Receber Previsto</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatBRL(totalAReceber)}
          </div>
          <span className="text-[11px] text-slate-400">{aReceber.length} recebimentos previstos</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span>Contas em Atraso</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatBRL(totalAtrasadas)}
          </div>
          <span className="text-[11px] text-slate-400">{atrasadas.length} contas vencidas</span>
        </div>
      </div>

      {/* Seletor de Abas */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-lg">
        <button
          onClick={() => setAba('a_pagar')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            aba === 'a_pagar'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          A Pagar ({aPagar.length})
        </button>

        <button
          onClick={() => setAba('a_receber')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            aba === 'a_receber'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          A Receber ({aReceber.length})
        </button>

        <button
          onClick={() => setAba('atrasadas')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            aba === 'atrasadas'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Atrasadas ({atrasadas.length})
        </button>

        <button
          onClick={() => setAba('liquidadas')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            aba === 'liquidadas'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Liquidadas
        </button>
      </div>

      {/* Lista de Contas */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Empresa / Titular</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Conta</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Baixa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {listaAtual.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                    Nenhum compromisso nesta categoria.
                  </td>
                </tr>
              ) : (
                listaAtual.map((t) => {
                  const isAtrasado = t.status === 'pendente' && t.data_vencimento < hojeIso;
                  const isPago = t.status === 'pago';

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={isAtrasado ? 'text-red-600 flex items-center gap-1' : ''}>
                          {isAtrasado && <AlertTriangle className="w-3.5 h-3.5" />}
                          {t.data_vencimento}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {t.descricao}
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-xs">
                        {t.company?.nome_fantasia || 'Pessoal'}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {t.category?.nome || 'Geral'}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-500">
                        {t.account?.nome || '-'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                        <span className={t.tipo === 'receita' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}>
                          {formatBRL(t.valor_centavos)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {!isPago ? (
                          <button
                            onClick={() => handleBaixar(t.id)}
                            className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                          >
                            Dar Baixa
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
