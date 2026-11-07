'use client';

import React, { useState, useEffect } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { createClient } from '@/lib/supabase/client';
import {
  toCents,
  formatBRL,
  calculateSplits,
  parseCurrencyInput,
} from '@/lib/finance/cents';
import {
  X,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  Calendar,
  Building,
  CreditCard,
  Tag,
  CheckCircle2,
  PieChart,
  Percent,
} from 'lucide-react';
import { TransactionType } from '@/types/database.types';

export default function FastTransactionModal() {
  const {
    isFastModalOpen,
    setIsFastModalOpen,
    fastModalType,
    activeProfile,
    companies,
    activeCompanyId,
    accounts,
    categories,
    costCenters,
    counterparties,
    refetchData,
  } = useFinancial();

  const supabase = createClient();

  const [tipo, setTipo] = useState<TransactionType>(fastModalType || 'despesa');
  const [descricao, setDescricao] = useState('');
  const [valorDisplay, setValorDisplay] = useState('');
  const [valorCentavos, setValorCentavos] = useState(0);

  const [companyId, setCompanyId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [costCenterId, setCostCenterId] = useState<string>('');
  const [counterpartyId, setCounterpartyId] = useState<string>('');

  const [dataCompetencia, setDataCompetencia] = useState('2026-11-01');
  const [dataVencimento, setDataVencimento] = useState('2026-11-01');
  const [isPago, setIsPago] = useState(false);

  // Recorrência e Parcelas
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [isParcelado, setIsParcelado] = useState(false);
  const [parcelaTotal, setParcelaTotal] = useState(1);

  // Rateio (Splits)
  const [hasSplits, setHasSplits] = useState(false);
  const [splits, setSplits] = useState<{ companyId: string; percentage: number }[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sincroniza com abertura do modal
  useEffect(() => {
    if (isFastModalOpen) {
      setTipo(fastModalType || 'despesa');
      setDescricao('');
      setValorDisplay('');
      setValorCentavos(0);
      setIsPago(false);
      setHasSplits(false);
      setErrorMsg('');

      // Auto-seleciona empresa ativa ou primeira disponível
      if (activeCompanyId) {
        setCompanyId(activeCompanyId);
      } else if (companies.length > 0) {
        setCompanyId(companies[0].id);
      }

      // Auto-seleciona primeira conta disponível
      if (accounts.length > 0) {
        setAccountId(accounts[0].id);
      }

      // Prepara splits padrão se houver ao menos 2 empresas PJ
      const pjs = companies.filter((c) => !c.is_personal);
      if (pjs.length >= 2) {
        setSplits([
          { companyId: pjs[0].id, percentage: 60 },
          { companyId: pjs[1].id, percentage: 40 },
        ]);
      } else if (companies.length >= 2) {
        setSplits([
          { companyId: companies[0].id, percentage: 50 },
          { companyId: companies[1].id, percentage: 50 },
        ]);
      }
    }
  }, [isFastModalOpen, fastModalType, activeCompanyId, companies, accounts]);

  // Filtra categorias correspondentes ao tipo
  const filteredCategories = categories.filter((c) => c.tipo === tipo);

  useEffect(() => {
    if (filteredCategories.length > 0 && !categoryId) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, categoryId]);

  if (!isFastModalOpen) return null;

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cents = parseCurrencyInput(raw);
    setValorCentavos(cents);
    setValorDisplay(cents > 0 ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    if (!descricao.trim()) {
      setErrorMsg('Informe uma descrição para o lançamento.');
      return;
    }
    if (valorCentavos <= 0) {
      setErrorMsg('Informe um valor maior que zero.');
      return;
    }
    if (!accountId) {
      setErrorMsg('Selecione uma conta bancária.');
      return;
    }
    if (!categoryId) {
      setErrorMsg('Selecione uma categoria contábil.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const nowIso = new Date().toISOString();
      const statusFinal = isPago ? 'pago' : 'pendente';
      const dataPagamentoFinal = isPago ? nowIso : null;

      // 1. Inserir a transação mestre
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          profile_id: activeProfile.id,
          company_id: hasSplits ? null : companyId || null,
          account_id: accountId,
          category_id: categoryId,
          cost_center_id: costCenterId || null,
          counterparty_id: counterpartyId || null,
          tipo,
          descricao: descricao.trim(),
          valor_centavos: valorCentavos,
          data_competencia: dataCompetencia,
          data_vencimento: dataVencimento,
          data_pagamento: dataPagamentoFinal,
          status: statusFinal,
          is_recorrente: isRecorrente,
          frequencia_recorrencia: isRecorrente ? 'mensal' : null,
          is_variavel: false,
          has_splits: hasSplits,
          parcela_atual: isParcelado ? 1 : null,
          parcela_total: isParcelado ? parcelaTotal : null,
        })
        .select()
        .single();

      if (txErr) throw txErr;

      // 2. Se houver splits (rateio), inserir os registros calculados com centavos exatos
      if (hasSplits && tx) {
        const splitResults = calculateSplits(valorCentavos, splits);
        const splitRows = splitResults.map((s) => ({
          transaction_id: tx.id,
          company_id: s.companyId,
          percentual: s.percentage,
          valor_centavos: s.cents,
        }));

        const { error: splitErr } = await supabase
          .from('transaction_splits')
          .insert(splitRows);

        if (splitErr) throw splitErr;
      }

      await refetchData();
      setIsFastModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar lançamento.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
              Lançamento Rápido
            </h3>
          </div>
          <button
            onClick={() => setIsFastModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
              {errorMsg}
            </div>
          )}

          {/* Abas de Tipo (Despesa, Receita, Transferência) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setTipo('despesa')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                tipo === 'despesa'
                  ? 'bg-red-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Despesa</span>
            </button>

            <button
              type="button"
              onClick={() => setTipo('receita')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                tipo === 'receita'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Receita</span>
            </button>

            <button
              type="button"
              onClick={() => setTipo('transferencia')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                tipo === 'transferencia'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transferir</span>
            </button>
          </div>

          {/* Campo de Valor Principal */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Valor (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                R$
              </span>
              <input
                type="text"
                value={valorDisplay}
                onChange={handleValorChange}
                placeholder="0,00"
                autoFocus
                className="w-full pl-11 pr-4 py-2.5 text-xl font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Descrição
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Fornecedor, Combustível, Aluguel..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
            />
          </div>

          {/* Linha 1: Empresa & Conta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Empresa / Titular
              </label>
              <select
                disabled={hasSplits}
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="dark:bg-slate-800">
                    {c.is_personal ? '👤 ' : '🏢 '}
                    {c.nome_fantasia}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Conta Bancária
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="dark:bg-slate-800">
                    {a.nome} ({a.instituicao || a.tipo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Categoria Contábil */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Categoria (DRE)
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
            >
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id} className="dark:bg-slate-800">
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle de Rateio entre Empresas (Splits) */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Ratear entre Empresas (Split)
                </span>
              </div>
              <input
                type="checkbox"
                checked={hasSplits}
                onChange={(e) => setHasSplits(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
            </div>

            {hasSplits && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-[11px] text-slate-500">
                  Defina os percentuais de rateio (a soma deve ser 100%):
                </div>
                {splits.map((s, idx) => {
                  const comp = companies.find((c) => c.id === s.companyId);
                  const splitCents = Math.round((valorCentavos * s.percentage) / 100);

                  return (
                    <div key={s.companyId} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-28 truncate">
                        {comp?.nome_fantasia || 'Empresa'}
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={s.percentage}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          const next = [...splits];
                          next[idx].percentage = val;
                          if (splits.length === 2) {
                            next[1 - idx].percentage = 100 - val;
                          }
                          setSplits(next);
                        }}
                        className="w-16 px-2 py-1 text-xs text-center font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                      <span className="text-xs font-mono text-slate-500 ml-auto">
                        {formatBRL(splitCents)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Linha 3: Datas & Status Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Vencimento
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 mt-auto">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Pago Imediatamente?
              </span>
              <button
                type="button"
                onClick={() => setIsPago(!isPago)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  isPago
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isPago ? 'PAGO' : 'PENDENTE'}</span>
              </button>
            </div>
          </div>

          {/* Ações */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFastModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
