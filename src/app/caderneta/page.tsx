'use client';

import React, { useState, useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { formatBRL, formatMonthName, getCurYM, addMonths } from '@/lib/finance/cents';
import { createClient } from '@/lib/supabase/client';
import {
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  Receipt,
  Download,
  Building2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function CadernetaPage() {
  const {
    activeProfile,
    companies,
    activeCompanyId,
    currentYM,
    setCurrentYM,
    transactions,
    categories,
    openFastModal,
    refetchData,
  } = useFinancial();

  const supabase = createClient();
  const [busca, setBusca] = useState('');
  const [tab, setTab] = useState<'todas' | 'fixas' | 'variaveis'>('todas');

  // Filtra transações do mês e da empresa/perfil
  const transacoesMes = useMemo(() => {
    return transactions.filter((t) => {
      const dataRef = t.data_competencia ? t.data_competencia.substring(0, 7) : '';
      if (dataRef !== currentYM) return false;
      if (activeCompanyId && t.company_id !== activeCompanyId) return false;
      if (busca.trim()) {
        const term = busca.toLowerCase();
        const matchDesc = t.descricao.toLowerCase().includes(term);
        const matchCat = t.category?.nome.toLowerCase().includes(term);
        if (!matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [transactions, currentYM, activeCompanyId, busca]);

  // Separação em Fixas/Recorrentes vs Variáveis Diárias
  const fixas = useMemo(() => transacoesMes.filter((t) => t.is_recorrente || t.parcela_total), [transacoesMes]);
  const variaveis = useMemo(() => transacoesMes.filter((t) => !t.is_recorrente && !t.parcela_total), [transacoesMes]);

  // Totais do Mês
  const totalFixas = useMemo(() => fixas.reduce((acc, t) => acc + t.valor_centavos, 0), [fixas]);
  const totalFixasPagas = useMemo(
    () => fixas.filter((t) => t.status === 'pago').reduce((acc, t) => acc + t.valor_centavos, 0),
    [fixas]
  );
  const totalVariaveis = useMemo(() => variaveis.reduce((acc, t) => acc + t.valor_centavos, 0), [variaveis]);
  const totalGeral = totalFixas + totalVariaveis;

  // Alternância rápida de status PAGO / PENDENTE (1 clique)
  const togglePago = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'pago' ? 'pendente' : 'pago';
    const dataPagamento = nextStatus === 'pago' ? new Date().toISOString() : null;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: nextStatus,
          data_pagamento: dataPagamento,
        })
        .eq('id', id);

      if (error) throw error;
      await refetchData();
    } catch (err: any) {
      alert('Erro ao atualizar status: ' + err.message);
    }
  };

  // Exportar planilha do mês para Excel/CSV
  const exportarExcel = () => {
    const rows = transacoesMes.map((t) => ({
      Data: t.data_competencia,
      Descrição: t.descricao,
      Tipo: t.tipo.toUpperCase(),
      Categoria: t.category?.nome || 'Geral',
      Empresa: t.company?.nome_fantasia || 'Pessoal',
      Valor: t.valor_centavos / 100,
      Status: t.status.toUpperCase(),
      Vencimento: t.data_vencimento,
      Parcela: t.parcela_total ? `${t.parcela_atual}/${t.parcela_total}` : '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Caderneta_${currentYM}`);
    XLSX.writeFile(wb, `caderneta_${currentYM}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Caderneta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Caderneta Financeira
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              Modo Tátil
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerenciamento rápido de contas fixas, parcelamentos e despesas do dia a dia
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportarExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={() => openFastModal('despesa')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Gasto (N)</span>
          </button>
        </div>
      </div>

      {/* Cards de Resumo da Caderneta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card Contas Fixas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>Contas Fixas & Recorrentes</span>
            <span className="text-[11px] text-blue-600 dark:text-blue-400">
              {fixas.filter((t) => t.status === 'pago').length}/{fixas.length} pagas
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatBRL(totalFixas)}
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{
                width: `${totalFixas > 0 ? (totalFixasPagas / totalFixas) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Card Gastos Diários */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>Despesas do Dia a Dia</span>
            <span className="text-[11px] text-slate-400">{variaveis.length} lançamentos</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatBRL(totalVariaveis)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Mercado, feira, gasolina, farmácia</p>
        </div>

        {/* Card Total Comprometido */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>Total Comprometido no Mês</span>
            <span className="text-[11px] text-emerald-600 font-bold">100% calculado</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatBRL(totalGeral)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Competência: {formatMonthName(currentYM)}</p>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-1 px-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, conta ou categoria..."
            className="w-full text-xs sm:text-sm bg-transparent outline-none text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('todas')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              tab === 'todas'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setTab('fixas')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              tab === 'fixas'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Fixas ({fixas.length})
          </button>
          <button
            onClick={() => setTab('variaveis')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              tab === 'variaveis'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Variáveis ({variaveis.length})
          </button>
        </div>
      </div>

      {/* Lista de Contas Fixas & Recorrência */}
      {(tab === 'todas' || tab === 'fixas') && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Contas Fixas & Recorrência Mensal
              </h3>
            </div>
            <span className="text-xs text-slate-400">Marcação tátil em 1 clique</span>
          </div>

          {fixas.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Nenhuma conta fixa cadastrada para este mês.
            </p>
          ) : (
            <div className="space-y-2">
              {fixas.map((item) => {
                const isPago = item.status === 'pago';

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      isPago
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.category?.cor || '#3b82f6' }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold truncate max-w-[200px] sm:max-w-xs ${
                              isPago
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.descricao}
                          </span>
                          {item.parcela_total && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                              {item.parcela_atual}/{item.parcela_total}
                            </span>
                          )}
                          {item.company && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {item.company.nome_fantasia}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>Venc: {item.data_vencimento}</span>
                          <span>•</span>
                          <span>{item.category?.nome || 'Geral'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                          {formatBRL(item.valor_centavos)}
                        </div>
                        <div className="text-[10px] text-slate-400">{item.account?.nome || 'Conta'}</div>
                      </div>

                      {/* Botão Tátil 1 Clique */}
                      <button
                        onClick={() => togglePago(item.id, item.status)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95 ${
                          isPago
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                        }`}
                      >
                        {isPago ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PAGO</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>PENDENTE</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lista de Despesas Variáveis Diárias */}
      {(tab === 'todas' || tab === 'variaveis') && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Despesas do Dia a Dia ({variaveis.length})
            </h3>
            <button
              onClick={() => openFastModal('despesa')}
              className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
            >
              + Adicionar Gasto
            </button>
          </div>

          {variaveis.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Nenhum gasto variável registrado neste período.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {variaveis.map((item) => {
                const isPago = item.status === 'pago';

                return (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.category?.cor || '#64748b' }}
                      />
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {item.descricao}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.data_competencia} • {item.category?.nome || 'Geral'} • {item.company?.nome_fantasia || 'Pessoal'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {formatBRL(item.valor_centavos)}
                      </span>
                      <button
                        onClick={() => togglePago(item.id, item.status)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                          isPago
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        }`}
                      >
                        {isPago ? 'PAGO' : 'PENDENTE'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
