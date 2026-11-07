'use client';

import React, { useState, useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { formatBRL, formatMonthName } from '@/lib/finance/cents';
import { createClient } from '@/lib/supabase/client';
import {
  ReceiptText,
  Search,
  Filter,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Tag,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function TransacoesPage() {
  const {
    activeProfile,
    companies,
    activeCompanyId,
    currentYM,
    transactions,
    accounts,
    categories,
    openFastModal,
    refetchData,
  } = useFinancial();

  const supabase = createClient();

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroConta, setFiltroConta] = useState<string>('todas');

  const transacoesFiltradas = useMemo(() => {
    return transactions.filter((t) => {
      // Filtro de Mês
      const dataRef = t.data_competencia ? t.data_competencia.substring(0, 7) : '';
      if (dataRef !== currentYM) return false;

      // Filtro de Empresa
      if (activeCompanyId && t.company_id !== activeCompanyId) {
        if (!t.has_splits || !t.splits?.some((s) => s.company_id === activeCompanyId)) {
          return false;
        }
      }

      // Filtro de Tipo
      if (filtroTipo !== 'todos' && t.tipo !== filtroTipo) return false;

      // Filtro de Status
      if (filtroStatus !== 'todos' && t.status !== filtroStatus) return false;

      // Filtro de Conta
      if (filtroConta !== 'todas' && t.account_id !== filtroConta) return false;

      // Filtro de Busca
      if (busca.trim()) {
        const term = busca.toLowerCase();
        const matchDesc = t.descricao.toLowerCase().includes(term);
        const matchCat = t.category?.nome.toLowerCase().includes(term);
        const matchComp = t.company?.nome_fantasia.toLowerCase().includes(term);
        if (!matchDesc && !matchCat && !matchComp) return false;
      }

      return true;
    });
  }, [transactions, currentYM, activeCompanyId, filtroTipo, filtroStatus, filtroConta, busca]);

  // Exclusão com soft delete
  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Deseja realmente remover este lançamento?');
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await refetchData();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  // Alternar status
  const handleToggleStatus = async (id: string, currentStatus: string) => {
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
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  // Exportar Excel
  const handleExport = () => {
    const data = transacoesFiltradas.map((t) => ({
      Competência: t.data_competencia,
      Vencimento: t.data_vencimento,
      Tipo: t.tipo.toUpperCase(),
      Descrição: t.descricao,
      Empresa: t.company?.nome_fantasia || (t.has_splits ? 'Rateada (Splits)' : 'Pessoal'),
      Conta: t.account?.nome || '-',
      Categoria: t.category?.nome || '-',
      GrupoDRE: t.category?.grupo_dre || '-',
      Valor: t.valor_centavos / 100,
      Status: t.status.toUpperCase(),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lancamentos');
    XLSX.writeFile(wb, `extrato_lancamentos_${currentYM}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Lançamentos & Extrato Completo
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Histórico financeiro, filtros avançados e detalhes de rateio
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar XLS</span>
          </button>

          <button
            onClick={() => openFastModal('despesa')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lançamento (N)</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar descrição ou empresa..."
              className="w-full text-xs sm:text-sm bg-transparent outline-none text-slate-900 dark:text-white"
            />
          </div>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="receita">Apenas Receitas</option>
            <option value="despesa">Apenas Despesas</option>
            <option value="transferencia">Apenas Transferências</option>
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
          >
            <option value="todos">Todos os Status</option>
            <option value="pago">Pagas / Realizadas</option>
            <option value="pendente">Pendentes</option>
          </select>

          <select
            value={filtroConta}
            onChange={(e) => setFiltroConta(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
          >
            <option value="todas">Todas as Contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Empresa / Titular</th>
                <th className="py-3 px-4">Categoria (DRE)</th>
                <th className="py-3 px-4">Conta</th>
                <th className="py-3 px-4 text-right">Valor (R$)</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                    Nenhuma transação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                transacoesFiltradas.map((t) => {
                  const isReceita = t.tipo === 'receita';
                  const isPago = t.status === 'pago';

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Status */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(t.id, t.status)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                            isPago
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          }`}
                        >
                          {isPago ? 'PAGO' : 'PENDENTE'}
                        </button>
                      </td>

                      {/* Data */}
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {t.data_competencia}
                      </td>

                      {/* Descrição */}
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{t.descricao}</span>
                          {t.has_splits && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                              <PieChart className="w-3 h-3" />
                              <span>Rateio</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-xs">
                        {t.has_splits ? (
                          <div className="space-y-0.5">
                            {t.splits?.map((s) => (
                              <div key={s.id} className="text-[10px] font-semibold text-purple-600">
                                {s.company?.nome_fantasia}: {s.percentual}%
                              </div>
                            ))}
                          </div>
                        ) : (
                          t.company?.nome_fantasia || 'Pessoal'
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                          {t.category?.nome || 'Geral'}
                        </span>
                      </td>

                      {/* Conta */}
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {t.account?.nome || '-'}
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                        <span className={isReceita ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}>
                          {isReceita ? '+' : '-'} {formatBRL(t.valor_centavos)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                          title="Excluir Lançamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
