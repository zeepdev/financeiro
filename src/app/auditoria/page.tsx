'use client';

import React, { useState } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { ShieldCheck, Download, Database, CheckCircle2, History } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AuditoriaPage() {
  const { activeProfile, companies, accounts, categories, transactions } = useFinancial();
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Backup completo em JSON
  const handleBackupJSON = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      profile: activeProfile,
      companies,
      accounts,
      categories,
      transactions,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_financeiro_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
  };

  // Backup em Excel Multi-Aba
  const handleBackupExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Transações
    const wsTx = XLSX.utils.json_to_sheet(
      transactions.map((t) => ({
        ID: t.id,
        Competencia: t.data_competencia,
        Vencimento: t.data_vencimento,
        Tipo: t.tipo,
        Descricao: t.descricao,
        Empresa: t.company?.nome_fantasia || (t.has_splits ? 'Rateio' : 'Pessoal'),
        Conta: t.account?.nome || '-',
        Categoria: t.category?.nome || '-',
        ValorReais: t.valor_centavos / 100,
        Status: t.status,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsTx, 'Transacoes');

    // 2. Empresas
    const wsComp = XLSX.utils.json_to_sheet(
      companies.map((c) => ({
        ID: c.id,
        NomeFantasia: c.nome_fantasia,
        RazaoSocial: c.razao_social || '-',
        CNPJ: c.cnpj || '-',
        AliquotaImposto: c.aliquota_imposto_padrao,
        Pessoal: c.is_personal,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsComp, 'Empresas');

    // 3. Contas
    const wsAcc = XLSX.utils.json_to_sheet(
      accounts.map((a) => ({
        ID: a.id,
        Nome: a.nome,
        Tipo: a.tipo,
        Instituicao: a.instituicao || '-',
        SaldoInicialReais: a.saldo_inicial_centavos / 100,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsAcc, 'Contas');

    XLSX.writeFile(wb, `backup_financeiro_completo_${new Date().toISOString().substring(0, 10)}.xlsx`);
    setDownloadSuccess(true);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Auditoria, Segurança & Backup
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trilha de auditoria das operações, integridade de dados e exportação de backups
          </p>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Backup gerado e baixado com sucesso no seu dispositivo!</span>
        </div>
      )}

      {/* Caixa de Backup */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Exportação Completa de Dados (Backup)
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
          Exporte uma cópia 100% integral de todas as empresas, perfis, contas bancárias, plano de contas contábil e extrato de lançamentos em formato legível e portável.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleBackupJSON}
            className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Backup (.JSON)</span>
          </button>

          <button
            onClick={handleBackupExcel}
            className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Planilha (.XLSX)</span>
          </button>
        </div>
      </div>

      {/* Trilha de Auditoria */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Políticas de Integridade & RLS Ativas
          </h3>
        </div>
        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Isolamento estrito multi-inquilino via Row Level Security (RLS) no PostgreSQL.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Valores financeiros armazenados em centavos (inteiro bigint) — sem perda por ponto flutuante.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Proteção contra exclusão acidental via soft delete (deleted_at).</span>
          </div>
        </div>
      </div>
    </div>
  );
}
