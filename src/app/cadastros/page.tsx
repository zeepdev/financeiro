'use client';

import React, { useState } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { formatBRL } from '@/lib/finance/cents';
import { createClient } from '@/lib/supabase/client';
import {
  FolderCog,
  Building2,
  Wallet,
  Tag,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';
import { GrupoDRE } from '@/types/database.types';

export default function CadastrosPage() {
  const {
    activeProfile,
    companies,
    accounts,
    categories,
    costCenters,
    counterparties,
    refetchData,
  } = useFinancial();

  const supabase = createClient();
  const [aba, setAba] = useState<'empresas' | 'contas' | 'categorias' | 'parceiros'>('empresas');

  // Nova Empresa
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [novaEmpresaCor, setNovaEmpresaCor] = useState('#3b82f6');
  const [novaEmpresaAliquota, setNovaEmpresaAliquota] = useState('6.0');

  // Nova Conta
  const [novaContaNome, setNovaContaNome] = useState('');
  const [novaContaTipo, setNovaContaTipo] = useState('corrente');
  const [novaContaInstituicao, setNovaContaInstituicao] = useState('');
  const [novaContaSaldoInicial, setNovaContaSaldoInicial] = useState('0');

  // Nova Categoria
  const [novaCatNome, setNovaCatNome] = useState('');
  const [novaCatTipo, setNovaCatTipo] = useState<'receita' | 'despesa'>('despesa');
  const [novaCatGrupoDRE, setNovaCatGrupoDRE] = useState<GrupoDRE>('despesa_fixa_outros');

  // Cadastrar Empresa
  const handleCriarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !novaEmpresaNome.trim()) return;

    try {
      const { error } = await supabase.from('companies').insert({
        profile_id: activeProfile.id,
        nome_fantasia: novaEmpresaNome.trim(),
        cor: novaEmpresaCor,
        aliquota_imposto_padrao: Number(novaEmpresaAliquota) || 6.0,
        is_personal: false,
      });

      if (error) throw error;
      setNovaEmpresaNome('');
      await refetchData();
    } catch (err: any) {
      alert('Erro ao criar empresa: ' + err.message);
    }
  };

  // Cadastrar Conta Bancária
  const handleCriarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !novaContaNome.trim()) return;

    try {
      const saldoCentavos = Math.round((Number(novaContaSaldoInicial) || 0) * 100);
      const { error } = await supabase.from('accounts').insert({
        profile_id: activeProfile.id,
        nome: novaContaNome.trim(),
        tipo: novaContaTipo,
        instituicao: novaContaInstituicao.trim() || null,
        saldo_inicial_centavos: saldoCentavos,
      });

      if (error) throw error;
      setNovaContaNome('');
      setNovaContaInstituicao('');
      setNovaContaSaldoInicial('0');
      await refetchData();
    } catch (err: any) {
      alert('Erro ao criar conta: ' + err.message);
    }
  };

  // Cadastrar Categoria
  const handleCriarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !novaCatNome.trim()) return;

    try {
      const { error } = await supabase.from('categories').insert({
        profile_id: activeProfile.id,
        nome: novaCatNome.trim(),
        tipo: novaCatTipo,
        grupo_dre: novaCatGrupoDRE,
      });

      if (error) throw error;
      setNovaCatNome('');
      await refetchData();
    } catch (err: any) {
      alert('Erro ao criar categoria: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Cadastros & Configurações
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerenciamento de entidades, contas bancárias, empresas e plano de contas
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md">
        <button
          onClick={() => setAba('empresas')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            aba === 'empresas' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Empresas ({companies.length})
        </button>
        <button
          onClick={() => setAba('contas')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            aba === 'contas' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Contas ({accounts.length})
        </button>
        <button
          onClick={() => setAba('categorias')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            aba === 'categorias' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Categorias ({categories.length})
        </button>
      </div>

      {/* Aba: Empresas */}
      {aba === 'empresas' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCriarEmpresa}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-end gap-3"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nome da Nova Empresa
              </label>
              <input
                type="text"
                required
                value={novaEmpresaNome}
                onChange={(e) => setNovaEmpresaNome(e.target.value)}
                placeholder="Ex: Minha Nova Empresa Ltda"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
              />
            </div>

            <div className="w-28">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Alíquota (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={novaEmpresaAliquota}
                onChange={(e) => setNovaEmpresaAliquota(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-center font-bold"
              />
            </div>

            <div className="w-16">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Cor
              </label>
              <input
                type="color"
                value={novaEmpresaCor}
                onChange={(e) => setNovaEmpresaCor(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer shrink-0"
            >
              + Adicionar
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {companies.map((c) => (
              <div
                key={c.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: c.cor || '#3b82f6' }}
                  />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {c.nome_fantasia}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {c.is_personal ? 'Finanças Pessoais' : `PJ • Imposto: ${c.aliquota_imposto_padrao}%`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aba: Contas Bancárias */}
      {aba === 'contas' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCriarConta}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nome da Conta
              </label>
              <input
                type="text"
                required
                value={novaContaNome}
                onChange={(e) => setNovaContaNome(e.target.value)}
                placeholder="Ex: Nubank Principal"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Tipo
              </label>
              <select
                value={novaContaTipo}
                onChange={(e) => setNovaContaTipo(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
              >
                <option value="corrente">Conta Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="carteira_fisica">Caixa Dinheiro</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="investimento">Investimento</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Saldo Inicial (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={novaContaSaldoInicial}
                onChange={(e) => setNovaContaSaldoInicial(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-bold"
              />
            </div>

            <button
              type="submit"
              className="py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
            >
              + Adicionar Conta
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{a.nome}</h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {a.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{a.instituicao || 'Sem instituição vinculada'}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Saldo Inicial</span>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                    {formatBRL(a.saldo_inicial_centavos)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aba: Categorias */}
      {aba === 'categorias' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCriarCategoria}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nome da Categoria
              </label>
              <input
                type="text"
                required
                value={novaCatNome}
                onChange={(e) => setNovaCatNome(e.target.value)}
                placeholder="Ex: Treinamentos & Cursos"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Natureza
              </label>
              <select
                value={novaCatTipo}
                onChange={(e) => setNovaCatTipo(e.target.value as any)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
              >
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Classificação DRE
              </label>
              <select
                value={novaCatGrupoDRE}
                onChange={(e) => setNovaCatGrupoDRE(e.target.value as any)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
              >
                <option value="despesa_fixa_ocupacao">Despesa Fixa - Ocupação</option>
                <option value="despesa_fixa_pessoal">Despesa Fixa - Pessoal</option>
                <option value="despesa_fixa_tecnologia">Despesa Fixa - Tecnologia</option>
                <option value="despesa_fixa_marketing">Despesa Fixa - Marketing</option>
                <option value="despesa_fixa_financeiro">Despesa Fixa - Financeiro</option>
                <option value="custo_variavel_insumo">Custo Variável - Insumos/CMV</option>
                <option value="custo_variavel_comissao">Custo Variável - Comissões</option>
                <option value="receita_bruta_servico">Receita Bruta - Serviços</option>
                <option value="receita_bruta_produto">Receita Bruta - Produtos</option>
                <option value="despesa_fixa_outros">Outros</option>
              </select>
            </div>

            <button
              type="submit"
              className="py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
            >
              + Adicionar Categoria
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c.cor || '#64748b' }}
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{c.nome}</h4>
                    <span className="text-[10px] text-slate-400 capitalize">{c.grupo_dre}</span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.tipo === 'receita'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                  }`}
                >
                  {c.tipo.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
