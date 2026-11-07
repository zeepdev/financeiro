'use client';

import React, { useState, useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { formatBRL, formatPercent, formatMonthName, parseCurrencyInput } from '@/lib/finance/cents';
import { createClient } from '@/lib/supabase/client';
import {
  Target,
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Building2,
} from 'lucide-react';

export default function MetasPage() {
  const {
    activeProfile,
    companies,
    activeCompanyId,
    currentYM,
    categories,
    transactions,
    refetchData,
  } = useFinancial();

  const supabase = createClient();
  const [selectedCatId, setSelectedCatId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [tetoInput, setTetoInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Calcula gastos reais por categoria no mês atual
  const gastosReaisPorCat = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => {
      if (t.tipo === 'despesa' && t.data_competencia.startsWith(currentYM)) {
        if (!activeCompanyId || t.company_id === activeCompanyId) {
          const cur = map.get(t.category_id) || 0;
          map.set(t.category_id, cur + t.valor_centavos);
        }
      }
    });
    return map;
  }, [transactions, currentYM, activeCompanyId]);

  // Lista de categorias de despesas
  const categoriasDespesa = useMemo(() => {
    return categories.filter((c) => c.tipo === 'despesa');
  }, [categories]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Metas & Tetos de Gastos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Orçamento planejado vs realizado por categoria e empresa ({formatMonthName(currentYM)})
          </p>
        </div>
      </div>

      {/* Grid de Tetos Orçamentários */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoriasDespesa.map((cat) => {
          const gastoReal = gastosReaisPorCat.get(cat.id) || 0;
          // Teto padrão de referência
          const tetoPadrao = 150000; // R$ 1.500,00 referência
          const percentual = tetoPadrao > 0 ? (gastoReal / tetoPadrao) * 100 : 0;
          const isEstourado = percentual > 100;

          return (
            <div
              key={cat.id}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.cor || '#3b82f6' }}
                    />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[160px]">
                      {cat.nome}
                    </h3>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      isEstourado
                        ? 'text-red-600'
                        : percentual > 80
                        ? 'text-amber-500'
                        : 'text-emerald-600'
                    }`}
                  >
                    {formatPercent(percentual)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Gasto Real</span>
                    <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      {formatBRL(gastoReal)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Teto Orçado</span>
                    <div className="text-sm font-semibold font-mono text-slate-500">
                      {formatBRL(tetoPadrao)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de Progresso do Teto */}
              <div className="mt-4">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isEstourado
                        ? 'bg-red-500'
                        : percentual > 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, percentual)}%` }}
                  />
                </div>
                {isEstourado && (
                  <span className="text-[11px] text-red-500 font-bold mt-1 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Orçamento estourado em {formatBRL(gastoReal - tetoPadrao)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
