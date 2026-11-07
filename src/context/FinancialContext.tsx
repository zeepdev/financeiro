'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Profile,
  Company,
  Account,
  Category,
  CostCenter,
  Counterparty,
  Transaction,
  TransactionType,
} from '@/types/database.types';
import { getCurYM } from '@/lib/finance/cents';

interface FinancialContextType {
  user: any;
  profiles: Profile[];
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile) => void;
  companies: Company[];
  activeCompanyId: string | null; // null = Todas as Empresas (Consolidado)
  setActiveCompanyId: (id: string | null) => void;
  activeCompany: Company | null;
  currentYM: string; // 'YYYY-MM'
  setCurrentYM: (ym: string) => void;
  accounts: Account[];
  categories: Category[];
  costCenters: CostCenter[];
  counterparties: Counterparty[];
  transactions: Transaction[];
  isLoading: boolean;
  refetchData: () => Promise<void>;
  isFastModalOpen: boolean;
  setIsFastModalOpen: (open: boolean) => void;
  fastModalType: TransactionType;
  openFastModal: (type?: TransactionType) => void;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export function FinancialProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [currentYM, setCurrentYM] = useState<string>('2026-11');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Inicializa currentYM no client-side para evitar erro de prerender
  useEffect(() => {
    setCurrentYM(getCurYM());
  }, []);

  // Fast modal state
  const [isFastModalOpen, setIsFastModalOpen] = useState(false);
  const [fastModalType, setFastModalType] = useState<TransactionType>('despesa');

  const openFastModal = (type: TransactionType = 'despesa') => {
    setFastModalType(type);
    setIsFastModalOpen(true);
  };

  // Keyboard shortcut: Press 'n' or 'N' outside inputs to open fast modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'n' || e.key === 'N') &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        openFastModal('despesa');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch initial auth user and profiles
  useEffect(() => {
    async function loadAuthAndProfiles() {
      setIsLoading(true);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      setUser(authUser);

      if (authUser) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .is('deleted_at', null)
          .order('is_default', { ascending: false });

        if (profs && profs.length > 0) {
          setProfiles(profs);
          setActiveProfile(profs[0]);
        }
      }
      setIsLoading(false);
    }

    loadAuthAndProfiles();
  }, []);

  // When activeProfile changes, load its companies, accounts, categories, etc.
  const loadProfileDetails = async () => {
    if (!activeProfile) return;

    // 1. Companies
    const { data: comps } = await supabase
      .from('companies')
      .select('*')
      .eq('profile_id', activeProfile.id)
      .is('deleted_at', null)
      .order('ordem', { ascending: true });
    setCompanies(comps || []);

    // 2. Accounts
    const { data: accs } = await supabase
      .from('accounts')
      .select('*, company:companies(*)')
      .eq('profile_id', activeProfile.id)
      .is('deleted_at', null)
      .order('nome', { ascending: true });
    setAccounts(accs || []);

    // 3. Categories
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('profile_id', activeProfile.id)
      .is('deleted_at', null)
      .order('nome', { ascending: true });
    setCategories(cats || []);

    // 4. Cost Centers
    const { data: ccenters } = await supabase
      .from('cost_centers')
      .select('*')
      .eq('profile_id', activeProfile.id)
      .is('deleted_at', null);
    setCostCenters(ccenters || []);

    // 5. Counterparties
    const { data: cparties } = await supabase
      .from('counterparties')
      .select('*')
      .eq('profile_id', activeProfile.id)
      .is('deleted_at', null)
      .order('nome', { ascending: true });
    setCounterparties(cparties || []);

    // 6. Transactions for current month
    await loadTransactions();
  };

  const loadTransactions = async () => {
    if (!activeProfile) return;

    let query = supabase
      .from('transactions')
      .select(
        `
        *,
        company:companies(*),
        account:accounts(*),
        category:categories(*),
        cost_center:cost_centers(*),
        counterparty:counterparties(*),
        splits:transaction_splits(*, company:companies(*))
      `
      )
      .eq('profile_id', activeProfile.id)
      .is('deleted_at', null)
      .order('data_vencimento', { ascending: true });

    const { data: txs, error } = await query;
    if (!error && txs) {
      setTransactions(txs as Transaction[]);
    }
  };

  useEffect(() => {
    if (activeProfile) {
      loadProfileDetails();
    }
  }, [activeProfile, currentYM]);

  const activeCompany =
    companies.find((c) => c.id === activeCompanyId) || null;

  return (
    <FinancialContext.Provider
      value={{
        user,
        profiles,
        activeProfile,
        setActiveProfile,
        companies,
        activeCompanyId,
        setActiveCompanyId,
        activeCompany,
        currentYM,
        setCurrentYM,
        accounts,
        categories,
        costCenters,
        counterparties,
        transactions,
        isLoading,
        refetchData: loadProfileDetails,
        isFastModalOpen,
        setIsFastModalOpen,
        fastModalType,
        openFastModal,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
}

export function useFinancial() {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial must be used within a FinancialProvider');
  }
  return context;
}
