'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import FastTransactionModal from '@/components/transactions/FastTransactionModal';
import { useFinancial } from '@/context/FinancialContext';
import {
  parseExcelOrCsv,
  parsePdf,
  parseImageOcr,
  ExtractedTransaction,
  ParseResult,
} from '@/lib/extractors/documentParser';
import {
  uploadComprovanteFile,
  listComprovantes,
  deleteComprovante,
  AttachmentItem,
} from '@/lib/services/comprovantesService';
import { formatBRL } from '@/lib/finance/cents';
import { createClient } from '@/lib/supabase/client';
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  ExternalLink,
  PlusCircle,
  ScanLine,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Download,
} from 'lucide-react';

export default function ComprovantesPage() {
  const {
    activeProfile,
    activeCompanyId,
    companies,
    accounts,
    categories,
    openFastModal,
    refetchData,
  } = useFinancial();

  const [activeTab, setActiveTab] = useState<'leitor' | 'cofre'>('leitor');

  // Estado do Arquivo sendo processado
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processStatusText, setProcessStatusText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Seleções para importação em lote
  const [selectedTxIds, setSelectedTxIds] = useState<Record<string, boolean>>({});
  const [targetCompanyId, setTargetCompanyId] = useState<string>('');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  // Lista de comprovantes no cofre
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [vaultFilter, setVaultFilter] = useState<'todos' | 'pendentes' | 'conciliados'>('todos');
  const [loadingVault, setLoadingVault] = useState(false);

  // Modal de visualização de comprovante (Lightbox)
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializa seleções padrão
  useEffect(() => {
    if (activeCompanyId) {
      setTargetCompanyId(activeCompanyId);
    } else if (companies.length > 0) {
      setTargetCompanyId(companies[0].id);
    }

    if (accounts.length > 0) {
      setTargetAccountId(accounts[0].id);
    }

    if (categories.length > 0) {
      const defaultDespesa = categories.find((c) => c.tipo === 'despesa');
      if (defaultDespesa) setTargetCategoryId(defaultDespesa.id);
    }
  }, [activeCompanyId, companies, accounts, categories]);

  // Carrega lista do cofre
  const loadVault = async () => {
    if (!activeProfile?.id) return;
    setLoadingVault(true);
    const data = await listComprovantes(activeProfile.id, vaultFilter);
    setAttachments(data);
    setLoadingVault(false);
  };

  useEffect(() => {
    loadVault();
  }, [activeProfile?.id, vaultFilter]);

  // Trata upload e aciona o parser correto
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setErrorMsg('');
    setSuccessMsg('');
    setParseResult(null);

    // Cria preview local para imagens
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }

    setIsProcessing(true);
    setProcessProgress(20);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    try {
      let result: ParseResult;

      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        setProcessStatusText('Analisando colunas e linhas da planilha...');
        setProcessProgress(50);
        result = await parseExcelOrCsv(file);
      } else if (ext === 'pdf') {
        setProcessStatusText('Extraindo páginas e texto do PDF...');
        setProcessProgress(50);
        result = await parsePdf(file);
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        result = await parseImageOcr(file, (prog, st) => {
          setProcessProgress(prog);
          setProcessStatusText(st);
        });
      } else {
        throw new Error('Formato não suportado. Envie imagens (.png, .jpg), PDFs ou planilhas (.xlsx, .csv).');
      }

      setProcessProgress(100);
      setParseResult(result);

      if (!result.sucesso) {
        setErrorMsg(result.erro || 'Não foi possível extrair dados financeiros deste documento.');
      } else {
        // Inicializa todas as transações como selecionadas
        const initialSelected: Record<string, boolean> = {};
        result.transacoes.forEach((t) => {
          initialSelected[t.id] = true;
        });
        setSelectedTxIds(initialSelected);

        // Se tiver perfil ativo, já salva automaticamente no Cofre de Comprovantes!
        if (activeProfile?.id) {
          uploadComprovanteFile(file, activeProfile.id, {
            tipoArquivo: result.tipoArquivo,
            transacoesExtraidas: result.transacoes.length,
            totalCentavos: result.metadata?.totalCentavos || 0,
            metadata: result.metadata,
          }).then((res) => {
            if (res.success) {
              loadVault();
            }
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Importar transações selecionadas para o banco de dados
  const handleImportSelected = async () => {
    if (!parseResult || !activeProfile?.id) return;
    if (!targetCompanyId || !targetAccountId || !targetCategoryId) {
      setErrorMsg('Selecione a Empresa, Conta e Categoria para onde as transações devem ir.');
      return;
    }

    const toImport = parseResult.transacoes.filter((t) => selectedTxIds[t.id]);
    if (toImport.length === 0) {
      setErrorMsg('Selecione ao menos um lançamento para importar.');
      return;
    }

    setIsImporting(true);
    setErrorMsg('');
    const supabase = createClient();

    try {
      const records = toImport.map((t) => ({
        profile_id: activeProfile.id,
        company_id: targetCompanyId,
        account_id: targetAccountId,
        category_id: targetCategoryId,
        tipo: t.tipo,
        valor_centavos: t.valorCentavos,
        descricao: t.descricao,
        data_competencia: t.data,
        data_pagamento: t.data,
        status: 'pago',
        tags: [parseResult.tipoArquivo, 'importado_ia'],
      }));

      const { error } = await supabase.from('transactions').insert(records);
      if (error) throw error;

      setSuccessMsg(`${toImport.length} lançamento(s) importado(s) com sucesso para sua conta!`);
      refetchData();
      loadVault();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao importar lançamentos.');
    } finally {
      setIsImporting(false);
    }
  };

  // Deletar comprovante do cofre
  const handleDeleteAttachment = async (att: AttachmentItem) => {
    if (!confirm(`Deseja realmente remover o comprovante "${att.nome_arquivo}"?`)) return;
    const ok = await deleteComprovante(att);
    if (ok) {
      loadVault();
    } else {
      alert('Falha ao remover arquivo.');
    }
  };

  // Contadores para o resumo do topo
  const totalArmazenado = attachments.length;
  const totalPendentes = attachments.filter((a) => !a.transaction_id).length;
  const totalConciliados = attachments.filter((a) => a.transaction_id).length;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header da Página */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Cofre de Documentos & OCR Inteligente
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  IA / OCR
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Envie prints de PIX, comprovantes de pagamento, PDFs de extrato ou planilhas Excel.
                A inteligência extrai valores, datas e salva tudo em um só lugar.
              </p>
            </div>

            {/* Alternador de Abas */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setActiveTab('leitor')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'leitor'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ScanLine className="w-4 h-4" />
                <span>Leitor & Extrator</span>
              </button>
              <button
                onClick={() => setActiveTab('cofre')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'cofre'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                <span>Cofre de Arquivos ({totalArmazenado})</span>
              </button>
            </div>
          </div>

          {/* Cards de Métricas do Cofre */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Total no Cofre
                </p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {totalArmazenado} arquivo(s)
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FolderOpen className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Prints Pendentes
                </p>
                <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {totalPendentes} a conciliar
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Conciliados com Sucesso
                </p>
                <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {totalConciliados} lançamentos
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* ABA 1: LEITOR & EXTRATOR */}
          {activeTab === 'leitor' && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-slate-900/60 rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer group shadow-xs"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf,.xlsx,.xls,.csv"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 group-hover:scale-105 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 transition-transform shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
                  Arraste e solte ou clique para selecionar
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Suporta <strong>Prints / Fotos de Comprovantes</strong> (PIX, maquininha, recibo),{' '}
                  <strong>PDFs de Extrato/Fatura</strong> ou{' '}
                  <strong>Planilhas Excel (.xlsx) / CSV</strong>.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                    PNG / JPG (OCR)
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    <FileText className="w-3.5 h-3.5 text-red-500" />
                    PDF Bancário
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    Excel / CSV
                  </span>
                </div>
              </div>

              {/* Barra de Progresso / Loading */}
              {isProcessing && (
                <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {processStatusText || 'Processando arquivo...'}
                    </span>
                    <span>{processProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${processProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Mensagens de Sucesso / Erro */}
              {errorMsg && (
                <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-2xl text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-2xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Resultado da Extração */}
              {parseResult && parseResult.sucesso && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Prévia do Documento / Imagem */}
                  <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        Documento Original
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
                        {selectedFile?.name}
                      </span>
                    </div>

                    {filePreviewUrl ? (
                      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/80 max-h-[480px] flex items-center justify-center">
                        <img
                          src={filePreviewUrl}
                          alt="Prévia do Comprovante"
                          className="w-full h-auto object-contain max-h-[480px]"
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl p-8 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                        <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {parseResult.tipoArquivo.toUpperCase()} processado com sucesso
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {(parseResult.tamanhoBytes / 1024).toFixed(1)} KB •{' '}
                          {parseResult.transacoes.length} transações identificadas
                        </p>
                      </div>
                    )}

                    {/* Metadados Detectados */}
                    {parseResult.metadata && (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-2">
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                          Dados Detectados pela IA:
                        </p>
                        {parseResult.metadata.banco && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Instituição:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {parseResult.metadata.banco}
                            </span>
                          </div>
                        )}
                        {parseResult.metadata.pagadorOuFavorecido && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Favorecido:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                              {parseResult.metadata.pagadorOuFavorecido}
                            </span>
                          </div>
                        )}
                        {parseResult.metadata.chavePix && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Chave PIX:</span>
                            <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200">
                              {parseResult.metadata.chavePix}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500">Total Detectado:</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {formatBRL(parseResult.metadata.totalCentavos)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lista de Transações Extraídas & Destino */}
                  <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>Lançamentos Extraídos ({parseResult.transacoes.length})</span>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {formatBRL(parseResult.metadata?.totalCentavos || 0)}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Defina o destino das transações e selecione quais deseja registrar.
                      </p>
                    </div>

                    {/* Seleção de Empresa, Conta e Categoria */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Empresa / Titular
                        </label>
                        <select
                          value={targetCompanyId}
                          onChange={(e) => setTargetCompanyId(e.target.value)}
                          className="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 outline-none"
                        >
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.is_personal ? '👤 ' : '🏢 '}
                              {c.nome_fantasia}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Conta Bancária
                        </label>
                        <select
                          value={targetAccountId}
                          onChange={(e) => setTargetAccountId(e.target.value)}
                          className="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 outline-none"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nome} ({formatBRL(a.saldo_inicial_centavos)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Categoria Inicial
                        </label>
                        <select
                          value={targetCategoryId}
                          onChange={(e) => setTargetCategoryId(e.target.value)}
                          className="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 outline-none"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.tipo === 'receita' ? '🟢' : '🔴'} {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Tabela de Lançamentos */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={
                                  parseResult.transacoes.length > 0 &&
                                  parseResult.transacoes.every((t) => selectedTxIds[t.id])
                                }
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const updated: Record<string, boolean> = {};
                                  parseResult.transacoes.forEach((t) => {
                                    updated[t.id] = checked;
                                  });
                                  setSelectedTxIds(updated);
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="p-3">Data</th>
                            <th className="p-3">Descrição / Favorecido</th>
                            <th className="p-3 text-right">Valor (BRL)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {parseResult.transacoes.map((t) => (
                            <tr
                              key={t.id}
                              className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                                selectedTxIds[t.id] ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                              }`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!selectedTxIds[t.id]}
                                  onChange={(e) =>
                                    setSelectedTxIds({
                                      ...selectedTxIds,
                                      [t.id]: e.target.checked,
                                    })
                                  }
                                  className="rounded"
                                />
                              </td>
                              <td className="p-3 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                                {t.data}
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {t.descricao}
                                </div>
                                {t.instituicao && (
                                  <span className="text-[10px] text-slate-400">
                                    {t.instituicao}
                                  </span>
                                )}
                              </td>
                              <td
                                className={`p-3 text-right font-bold whitespace-nowrap ${
                                  t.tipo === 'receita'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {t.tipo === 'receita' ? '+' : '-'} {formatBRL(t.valorCentavos)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-slate-500">
                        {Object.values(selectedTxIds).filter(Boolean).length} de{' '}
                        {parseResult.transacoes.length} selecionados
                      </p>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            if (parseResult.transacoes[0]) {
                              const t = parseResult.transacoes[0];
                              openFastModal(t.tipo);
                            }
                          }}
                          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                        >
                          Editar no Modal
                        </button>

                        <button
                          onClick={handleImportSelected}
                          disabled={isImporting}
                          className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {isImporting
                              ? 'Importando...'
                              : `Importar ${
                                  Object.values(selectedTxIds).filter(Boolean).length
                                } Lançamento(s)`}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: COFRE DE ARQUIVOS */}
          {activeTab === 'cofre' && (
            <div className="space-y-6">
              {/* Filtros do Cofre */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(['todos', 'pendentes', 'conciliados'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setVaultFilter(f)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                        vaultFilter === f
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {f === 'todos'
                        ? 'Todos os Documentos'
                        : f === 'pendentes'
                        ? 'Pendentes de Lançamento'
                        : 'Já Conciliados'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={loadVault}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingVault ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>

              {/* Grid de Arquivos no Cofre */}
              {loadingVault ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                  Carregando arquivos do cofre...
                </div>
              ) : attachments.length === 0 ? (
                <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                  <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                    Nenhum documento encontrado neste filtro
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Envie seus prints de comprovante, notas ou extratos na aba &ldquo;Leitor &amp; Extrator&rdquo;
                    para mantê-los arquivados aqui com segurança.
                  </p>
                  <button
                    onClick={() => setActiveTab('leitor')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer hover:bg-blue-700"
                  >
                    <Upload className="w-4 h-4" />
                    Enviar Primeiro Comprovante
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {attachments.map((att) => {
                    const isImg = att.mime_type?.startsWith('image/');
                    const isPdf = att.mime_type?.includes('pdf') || att.nome_arquivo.endsWith('.pdf');
                    const isXls = att.nome_arquivo.match(/\.(xlsx|xls|csv)$/i);

                    return (
                      <div
                        key={att.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                      >
                        {/* Imagem / Ícone */}
                        <div
                          onClick={() => setPreviewAttachment(att)}
                          className="h-36 bg-slate-100 dark:bg-slate-950 flex items-center justify-center cursor-pointer relative overflow-hidden"
                        >
                          {isImg && att.public_url ? (
                            <img
                              src={att.public_url}
                              alt={att.nome_arquivo}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : isPdf ? (
                            <div className="text-center">
                              <FileText className="w-10 h-10 text-red-500 mx-auto mb-1" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                Documento PDF
                              </span>
                            </div>
                          ) : (
                            <div className="text-center">
                              <FileSpreadsheet className="w-10 h-10 text-emerald-500 mx-auto mb-1" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                Planilha Excel
                              </span>
                            </div>
                          )}

                          {/* Status Badge */}
                          <div className="absolute top-2 right-2">
                            {att.transaction_id ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 shadow-xs">
                                <CheckCircle2 className="w-3 h-3" />
                                Conciliado
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1 shadow-xs">
                                <AlertCircle className="w-3 h-3" />
                                Pendente
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dados do Arquivo */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <h4
                              title={att.nome_arquivo}
                              className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
                            >
                              {att.nome_arquivo}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(att.created_at).toLocaleDateString('pt-BR')} •{' '}
                              {att.tamanho_bytes
                                ? `${(att.tamanho_bytes / 1024).toFixed(0)} KB`
                                : 'Arquivo'}
                            </p>
                          </div>

                          {/* Transação vinculada se houver */}
                          {att.transaction && (
                            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px]">
                              <p className="text-slate-500 font-semibold truncate">
                                Vinculado a:
                              </p>
                              <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                {att.transaction.descricao}
                              </p>
                              <p className="font-bold text-blue-600 dark:text-blue-400">
                                {formatBRL(att.transaction.valor_centavos)}
                              </p>
                            </div>
                          )}

                          {/* Botões do Card */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => setPreviewAttachment(att)}
                              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              Visualizar
                            </button>

                            <button
                              onClick={() => handleDeleteAttachment(att)}
                              title="Excluir comprovante"
                              className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Lightbox / Modal de Prévia em Tela Cheia */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="overflow-hidden">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {previewAttachment.nome_arquivo}
                </h3>
                <p className="text-xs text-slate-500">
                  Enviado em {new Date(previewAttachment.created_at).toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {previewAttachment.public_url && (
                  <a
                    href={previewAttachment.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-500"
                    title="Baixar ou abrir original"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-100 dark:bg-slate-950 rounded-2xl p-4">
              {previewAttachment.public_url &&
              previewAttachment.mime_type?.startsWith('image/') ? (
                <img
                  src={previewAttachment.public_url}
                  alt={previewAttachment.nome_arquivo}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                />
              ) : (
                <div className="text-center py-12 space-y-3">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Prévia integrada indisponível para este formato
                  </p>
                  {previewAttachment.public_url && (
                    <a
                      href={previewAttachment.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                    >
                      <Download className="w-4 h-4" />
                      Baixar Arquivo Completo
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewAttachment(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rápido de Transação */}
      <FastTransactionModal />
    </div>
  );
}
