'use client';

import React from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { addMonths, formatMonthName, getCurYM } from '@/lib/finance/cents';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Building2,
  User,
  LogOut,
  Calendar,
  CloudCheck,
  Briefcase,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Header() {
  const {
    profiles,
    activeProfile,
    setActiveProfile,
    companies,
    activeCompanyId,
    setActiveCompanyId,
    currentYM,
    setCurrentYM,
    openFastModal,
    user,
  } = useFinancial();

  const supabase = createClient();
  const router = useRouter();

  const [hojeYM, setHojeYM] = React.useState('2026-11');

  React.useEffect(() => {
    setHojeYM(getCurYM());
  }, []);

  const handlePrevMonth = () => setCurrentYM(addMonths(currentYM, -1));
  const handleNextMonth = () => setCurrentYM(addMonths(currentYM, 1));
  const handleCurrentMonth = () => setCurrentYM(hojeYM);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 py-2.5 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Esquerda: Perfil e Empresa */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Seletor de Perfil */}
          {profiles.length > 1 ? (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700">
              <User className="w-4 h-4 text-slate-500" />
              <select
                value={activeProfile?.id || ''}
                onChange={(e) => {
                  const p = profiles.find((item) => item.id === e.target.value);
                  if (p) setActiveProfile(p);
                }}
                className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id} className="dark:bg-slate-800">
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span>{activeProfile?.nome || 'Finanças'}</span>
            </div>
          )}

          {/* Seletor de Empresa / Consolidado / Pessoal */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700">
            <Building2 className="w-4 h-4 text-blue-500" />
            <select
              value={activeCompanyId || ''}
              onChange={(e) => setActiveCompanyId(e.target.value || null)}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="dark:bg-slate-800 font-semibold">
                🌐 Todas as Empresas (Consolidado)
              </option>
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="dark:bg-slate-800">
                  {c.is_personal ? '👤 ' : '🏢 '}
                  {c.nome_fantasia}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Centro: Navegador de Período Mês/Ano */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
          <button
            onClick={handlePrevMonth}
            title="Mês anterior"
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-600 dark:text-slate-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 text-xs sm:text-sm font-semibold capitalize min-w-[130px] text-center text-slate-800 dark:text-slate-100">
            {formatMonthName(currentYM)}
          </span>

          <button
            onClick={handleNextMonth}
            title="Próximo mês"
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-600 dark:text-slate-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {currentYM !== hojeYM && (
            <button
              onClick={handleCurrentMonth}
              className="text-[11px] font-bold px-2 py-0.5 ml-1 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 transition-colors"
            >
              Hoje
            </button>
          )}
        </div>

        {/* Direita: Botão Lançamento Rápido + Ações */}
        <div className="flex items-center gap-2">
          {/* Indicador de Nuvem */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-full border border-emerald-200 dark:border-emerald-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Nuvem Conectada</span>
          </div>

          {/* Botão Fast Add (≤ 3 cliques) */}
          <button
            onClick={() => openFastModal('despesa')}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium text-xs sm:text-sm px-3.5 py-1.5 rounded-lg shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
            title="Atalho: tecla 'N'"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Lançar</span>
            <span className="hidden sm:inline-block text-[10px] bg-blue-700/60 px-1 py-0.2 rounded font-mono">
              N
            </span>
          </button>

          {/* Logout */}
          {user && (
            <button
              onClick={handleLogout}
              title="Sair da Conta"
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
