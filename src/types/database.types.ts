export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TransactionType = 'receita' | 'despesa' | 'transferencia';
export type TransactionStatus = 'pendente' | 'pago' | 'cancelado' | 'atrasado';
export type RecurrenceFrequency = 'mensal' | 'anual' | 'semanal';

export type AccountType =
  | 'corrente'
  | 'poupanca'
  | 'investimento'
  | 'carteira_fisica'
  | 'cartao_credito'
  | 'outros';

export type GrupoDRE =
  | 'receita_bruta_servico'
  | 'receita_bruta_produto'
  | 'deducao_imposto'
  | 'custo_variavel_insumo'
  | 'custo_variavel_comissao'
  | 'despesa_fixa_ocupacao'
  | 'despesa_fixa_pessoal'
  | 'despesa_fixa_tecnologia'
  | 'despesa_fixa_marketing'
  | 'despesa_fixa_financeiro'
  | 'despesa_fixa_outros'
  | 'investimento'
  | 'nao_operacional';

export interface Profile {
  id: string;
  user_id: string;
  nome: string;
  documento?: string | null;
  avatar_url?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Company {
  id: string;
  profile_id: string;
  nome_fantasia: string;
  razao_social?: string | null;
  cnpj?: string | null;
  aliquota_imposto_padrao: number;
  is_personal: boolean;
  cor: string;
  ordem: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Account {
  id: string;
  profile_id: string;
  company_id?: string | null;
  nome: string;
  tipo: AccountType;
  instituicao?: string | null;
  saldo_inicial_centavos: number;
  saldo_atual_centavos?: number;
  cor: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  company?: Company | null;
}

export interface CostCenter {
  id: string;
  profile_id: string;
  company_id?: string | null;
  nome: string;
  ativo: boolean;
  created_at: string;
  deleted_at?: string | null;
}

export interface Counterparty {
  id: string;
  profile_id: string;
  company_id?: string | null;
  nome: string;
  tipo: 'cliente' | 'fornecedor' | 'ambos';
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  chave_pix?: string | null;
  created_at: string;
  deleted_at?: string | null;
}

export interface Category {
  id: string;
  profile_id: string;
  company_id?: string | null;
  parent_id?: string | null;
  nome: string;
  tipo: TransactionType;
  grupo_dre: GrupoDRE;
  cor: string;
  icone: string;
  created_at: string;
  deleted_at?: string | null;
  subcategories?: Category[];
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  company_id: string;
  percentual: number;
  valor_centavos: number;
  created_at: string;
  company?: Company;
}

export interface Transaction {
  id: string;
  profile_id: string;
  company_id?: string | null;
  account_id: string;
  category_id: string;
  cost_center_id?: string | null;
  counterparty_id?: string | null;
  
  tipo: TransactionType;
  descricao: string;
  valor_centavos: number;
  
  data_competencia: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  
  status: TransactionStatus;
  
  is_recorrente: boolean;
  frequencia_recorrencia?: RecurrenceFrequency | null;
  is_variavel: boolean;
  parent_transaction_id?: string | null;
  parcela_atual?: number | null;
  parcela_total?: number | null;
  
  transfer_account_id?: string | null;
  has_splits: boolean;
  tags: string[];
  observacoes?: string | null;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  
  // Joins
  company?: Company | null;
  account?: Account | null;
  category?: Category | null;
  cost_center?: CostCenter | null;
  counterparty?: Counterparty | null;
  splits?: TransactionSplit[];
}

export interface Budget {
  id: string;
  profile_id: string;
  company_id: string;
  category_id: string;
  mes_ano: string;
  teto_centavos: number;
  gasto_real_centavos?: number;
  created_at: string;
  updated_at: string;
  category?: Category;
  company?: Company;
}

export interface DREFechamento {
  id: string;
  profile_id: string;
  company_id?: string | null;
  mes_ano: string;
  regime: 'competencia' | 'caixa';
  dados_dre: Json;
  fechado_por: string;
  fechado_em: string;
  reaberto_em?: string | null;
}

export interface AuditLog {
  id: number;
  user_id?: string | null;
  profile_id: string;
  tabela: string;
  registro_id?: string | null;
  acao: 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'RESTORE';
  dados_anteriores?: Json;
  dados_novos?: Json;
  ip_origem?: string | null;
  created_at: string;
}
