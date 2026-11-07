'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { formatBRL, formatPercent } from '@/lib/finance/cents';
import { calcularDRE, calcularAnaliseHorizontal } from '@/lib/finance/dreEngine';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  Building2,
  Calendar,
  AlertCircle,
  Plus,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const {
    activeProfile,
    companies,
    activeCompanyId,
    activeCompany,
    currentYM,
    accounts,
    transactions,
    openFastModal,
    refetchData,
  } = useFinancial();

  const supabase = createClient();

  // Calcula DRE do mês atual
  const dreAtual = useMemo(() => {
    return calcularDRE(
      transactions,
      currentYM,
      'competencia',
      activeCompanyId,
      activeCompany?.aliquota_imposto_padrao ? activeCompany.aliquota_imposto_padrao / 100 : 0.06
    );
  }, [transactions, currentYM, activeCompanyId, activeCompany]);

  // Calcula DRE do mês anterior para Análise Horizontal
  const [ano, mes] = currentYM.split('-').map(Number);
  const prevDate = new Date(ano, mes - 2, 1);
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const dreAnterior = useMemo(() => {
    return calcularDRE(
      transactions,
      prevYM,
      'competencia',
      activeCompanyId,
      activeCompany?.aliquota_imposto_padrao ? activeCompany.aliquota_imposto_padrao / 100 : 0.06
    );
  }, [transactions, prevYM, activeCompanyId, activeCompany]);

  const analise = useMemo(() => {
    return calcularAnaliseHorizontal(dreAtual, dreAnterior);
  }, [dreAtual, dreAnterior]);

  // Saldo total das contas bancárias
  const saldoTotalCentavos = useMemo(() => {
    return accounts.reduce((acc, a) => {
      if (activeCompanyId && a.company_id && a.company_id !== activeCompanyId) {
        return acc;
      }
      return acc + (a.saldo_inicial_centavos || 0);
    }, 0);
  }, [accounts, activeCompanyId]);

  const [hojeStr, setHojeStr] = useState('2026-11-07');

  React.useEffect(() => {
    setHojeStr(new Date().toISOString().substring(0, 10));
  }, []);

  // Contas vencendo nos próximos dias ou atrasadas
  const contasAlertas = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.status === 'pendente' &&
        t.data_vencimento <= hojeStr &&
        (!activeCompanyId || t.company_id === activeCompanyId)
    );
  }, [transactions, activeCompanyId, hojeStr]);

  // Top categorias de despesas
  const topCategorias = useMemo(() => {
    const map = new Map<string, { nome: string; cor: string; centavos: number }>();
    transactions.forEach((t) => {
      if (t.tipo === 'despesa' && t.data_competencia.startsWith(currentYM)) {
        const catName = t.category?.nome || 'Outros';
        const cor = t.category?.cor || '#64748b';
        const cur = map.get(catName) || { nome: catName, cor, centavos: 0 };
        cur.centavos += t.valor_centavos;
        map.set(catName, cur);
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.centavos - a.centavos)
      .slice(0, 5);
  }, [transactions, currentYM]);

  // Dados do gráfico comparativo
  const chartData = [
    {
      name: 'Receita Bruta',
      Atual: dreAtual.receitaBrutaTotalCentavos / 100,
      Anterior: dreAnterior.receitaBrutaTotalCentavos / 100,
    },
    {
      name: 'Receita Líquida',
      Atual: dreAtual.receitaLiquidaCentavos / 100,
      Anterior: dreAnterior.receitaLiquidaCentavos / 100,
    },
    {
      name: 'Despesas Fixas',
      Atual: dreAtual.totalDespesasFixasCentavos / 100,
      Anterior: dreAnterior.totalDespesasFixasCentavos / 100,
    },
    {
      name: 'Lucro (EBITDA)',
      Atual: dreAtual.lucroLiquidoOperacionalCentavos / 100,
      Anterior: dreAnterior.lucroLiquidoOperacionalCentavos / 100,
    },
  ];

  // Helper para carregar dados demo se estiver vazio
  const handleSeedDemo = async () => {
    if (!activeProfile) return;
    try {
      await supabase.rpc('seed_demo_transactions', { p_profile_id: activeProfile.id });
      await refetchData();
    } catch (err: any) {
      alert('Erro ao carregar seed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Boas-Vindas ou Seed se estiver vazio */}
      {transactions.length === 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-blue-500/15">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-yellow-300 shrink-0" />
            <div>
              <h3 className="font-bold text-base">Bem-vindo ao Financeiro!</h3>
              <p className="text-xs text-blue-100 mt-0.5">
                Gostaria de carregar lançamentos de demonstração com receitas, despesas e rateios (splits) para testar os relatórios?
              </p>
            </div>
          </div>
          <button
            onClick={handleSeedDemo}
            className="px-4 py-2 bg-white text-blue-700 font-bold text-xs rounded-xl shadow-sm hover:bg-blue-50 transition-all shrink-0 cursor-pointer"
          >
            Carregar Dados de Exemplo
          </button>
        </div>
      )}

      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Dashboard Executivo
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visão gerencial consolidada e desempenho financeiro de{' '}
            <strong className="text-slate-700 dark:text-slate-200">
              {activeCompany ? activeCompany.nome_fantasia : 'Todas as Empresas'}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openFastModal('receita')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+ Receita</span>
          </button>
          <button
            onClick={() => openFastModal('despesa')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold text-xs border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>+ Despesa</span>
          </button>
        </div>
      </div>

      {/* Grid de Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Disponível */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Saldo em Contas
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {formatBRL(saldoTotalCentavos)}
            </div>
            <span className="text-[11px] text-slate-400">
              {accounts.length} contas bancárias ativas
            </span>
          </div>
        </div>

        {/* Card 2: Receita Bruta */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Receita Bruta Total
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatBRL(dreAtual.receitaBrutaTotalCentavos)}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              {analise.deltaReceitaBruta >= 0 ? (
                <span className="text-emerald-600 flex items-center">
                  <ArrowUpRight className="w-3.5 h-3.5" />+{formatPercent(analise.deltaReceitaBruta)}
                </span>
              ) : (
                <span className="text-red-500 flex items-center">
                  <ArrowDownRight className="w-3.5 h-3.5" />{formatPercent(analise.deltaReceitaBruta)}
                </span>
              )}
              <span>vs mês anterior</span>
            </div>
          </div>
        </div>

        {/* Card 3: Margem de Contribuição */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Margem Contribuição
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {formatBRL(dreAtual.margemContribuicaoCentavos)}
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              Índice: <strong className="text-indigo-600">{formatPercent(dreAtual.indiceMargemContribuicaoPercent)}</strong> da Rec. Líquida
            </span>
          </div>
        </div>

        {/* Card 4: Resultado Operacional Líquido */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Lucro Líquido (EBITDA)
            </span>
            <div
              className={`p-2 rounded-xl ${
                dreAtual.lucroLiquidoOperacionalCentavos >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
              }`}
            >
              {dreAtual.lucroLiquidoOperacionalCentavos >= 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="my-3">
            <div
              className={`text-2xl font-black font-mono ${
                dreAtual.lucroLiquidoOperacionalCentavos >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatBRL(dreAtual.lucroLiquidoOperacionalCentavos)}
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              Margem Líquida: <strong>{formatPercent(dreAtual.margemLiquidaPercent)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Seções Centrais: Gráfico Comparativo & Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Comparativo vs Mês Anterior */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Comparativo Gerencial vs Mês Anterior
              </h3>
              <p className="text-[11px] text-slate-400">
                Valores em R$ (Competência {currentYM} vs {prevYM})
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-blue-600">
                <span className="w-3 h-3 rounded-sm bg-blue-600" />
                <span>Mês Atual</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-slate-700" />
                <span>Mês Anterior</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#888888" />
                <YAxis
                  tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  tick={{ fontSize: 11 }}
                  stroke="#888888"
                />
                <Tooltip
                  formatter={(value: any) => [
                    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    '',
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Atual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Categorias & Alertas de Contas */}
        <div className="space-y-6">
          {/* Top Categorias */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-3">
              Maiores Gastos no Mês
            </h3>
            {topCategorias.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhum gasto registrado neste mês.</p>
            ) : (
              <div className="space-y-3">
                {topCategorias.map((cat) => {
                  const perc =
                    dreAtual.totalDespesasFixasCentavos > 0
                      ? (cat.centavos / dreAtual.totalDespesasFixasCentavos) * 100
                      : 0;

                  return (
                    <div key={cat.nome}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                          {cat.nome}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatBRL(cat.centavos)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, perc)}%`,
                            backgroundColor: cat.cor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alertas de Vencimento */}
          {contasAlertas.length > 0 && (
            <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 mb-2 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>{contasAlertas.length} Contas Vencendo / Pendentes</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {contasAlertas.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-[11px]">
                    <span className="truncate max-w-[140px] font-medium">{c.descricao}</span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                      {formatBRL(c.valor_centavos)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
