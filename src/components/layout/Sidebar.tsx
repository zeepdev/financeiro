'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpenCheck,
  ReceiptText,
  CalendarClock,
  TrendingUp,
  WalletCards,
  Target,
  FileSpreadsheet,
  FolderCog,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { useFinancial } from '@/context/FinancialContext';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Caderneta Rápida', href: '/caderneta', icon: BookOpenCheck, badge: 'Tátil' },
  { name: 'Lançamentos', href: '/transacoes', icon: ReceiptText },
  { name: 'Contas a Pagar/Receber', href: '/contas', icon: CalendarClock },
  { name: 'DRE Gerencial', href: '/dre', icon: TrendingUp, highlight: true },
  { name: 'Fluxo de Caixa', href: '/fluxo-caixa', icon: WalletCards },
  { name: 'Metas & Orçamento', href: '/metas', icon: Target },
  { name: 'Conciliação OFX/CSV', href: '/conciliacao', icon: FileSpreadsheet },
  { name: 'Cadastros', href: '/cadastros', icon: FolderCog },
  { name: 'Auditoria & Backup', href: '/auditoria', icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { activeCompany } = useFinancial();

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 min-h-[calc(100vh-57px)]">
      {/* Informações da Empresa Ativa */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm"
            style={{ backgroundColor: activeCompany?.cor || '#3b82f6' }}
          >
            {activeCompany ? (
              activeCompany.is_personal ? '👤' : activeCompany.nome_fantasia.charAt(0).toUpperCase()
            ) : (
              '🌐'
            )}
          </div>
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {activeCompany ? activeCompany.nome_fantasia : 'Visão Consolidada'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {activeCompany
                ? activeCompany.is_personal
                  ? 'Finanças Pessoais'
                  : 'Empresa do Perfil'
                : 'Todas as Empresas'}
            </p>
          </div>
        </div>
      </div>

      {/* Menu Principal */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600'
                  }`}
                />
                <span>{item.name}</span>
              </div>

              {item.badge && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Box de Suporte / DRE Info */}
      <div className="p-3 m-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Regime Híbrido
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Alterne entre Competência e Caixa em 1 clique na tela de DRE.
        </p>
      </div>
    </aside>
  );
}
