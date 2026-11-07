# 🏛️ Financeiro — Gestão Multi-Perfil & Multi-Empresa

> Sistema web completo de engenharia financeira e gestão empresarial integrada. Desenvolvido para unificar a gestão pessoal (doméstica/caderneta tátil) e corporativa (múltiplas empresas com DRE analítica, rateio de despesas e conciliação bancária).

---

## ⚡ Diferenciais & Conceito

- **Hierarquia Multi-Perfil & Multi-Empresa:**
  - **Perfil:** Titular principal (ex: `Isaque`).
  - **Empresas Integradas:** Empresas vinculadas ao titular (ex: `Athena Growth Marketing`, `Click Aky`) + finanças do titular (`Pessoal`).
  - **Rateio de Despesas (Splits):** Divisão proporcional (ex: 60% Athena / 40% Click Aky) com garantia matemática de soma exata de centavos residuais.
- **Motor Matemático em Centavos (Integer Engine):**
  - Todos os valores monetários são manipulados e persistidos em centavos (`bigint`), eliminando qualquer risco de drift de ponto flutuante IEEE 754.
- **DRE Gerencial Completa (Base `zp-sistema`):**
  - Alternância instantânea com 1 clique entre **Regime de Competência** e **Regime de Caixa**.
  - Visão isolada por Empresa ou **Consolidada pelo Perfil**.
  - Margem de Contribuição, Ponto de Equilíbrio Operacional, Faturamento Mínimo / Dia Útil (22 dias), EBITDA e Análise Horizontal ($\Delta\%$ vs mês anterior) / Vertical.
  - Simulador interativo de metas e lucro líquido desejado.
  - Registro e congelamento de fechamentos mensais de DRE (`dre_fechamentos`).
- **Caderneta Tátil (Base `caderneta`):**
  - Botão de 1 clique `PAGO` $\leftrightarrow$ `PENDENTE`.
  - Tratamento de contas recorrentes de valor variável (energia, água, fatura) sem sobrescrever estimativas futuras.
  - Notação de parcelamento `X de Y`.
  - Lançamento express de despesas diárias em menos de 3 cliques (atalho de teclado: `N`).
- **Segurança & Multi-inquilino:**
  - Row Level Security (RLS) estrito no PostgreSQL isolando dados por `auth.uid()`.
  - Soft delete (`deleted_at`) em todos os registros críticos.
  - Trilha de auditoria e exportação completa em JSON e planilhas Excel (.xlsx).

---

## 🛠️ Stack Tecnológica

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript.
- **Estilização & UI:** Tailwind CSS 4 + Design System Fintech shadcn/ui + Lucide Icons.
- **Estado & Cache:** TanStack Query v5 (React Query) + Context API.
- **Gráficos & Visualizações:** Recharts.
- **Backend & Banco de Dados:** Supabase Cloud (PostgreSQL 17 + Auth + Storage + RLS).
- **Validação & Formulários:** Zod + React Hook Form.
- **Testes Unitários:** Vitest.

---

## 🚀 Como Rodar Localmente

### 1. Clonar o repositório
```bash
git clone https://github.com/zeepdev/financeiro.git
cd financeiro
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Crie o arquivo `.env.local` na raiz com suas credenciais do Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://ytqslwzrziodicsqgvnq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Executar os testes unitários
```bash
npm test
```

### 5. Iniciar em desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:3000` no seu navegador.

---

## 🏛️ Créditos & Autoria

Developed by: [Athena Growth Marketing](https://athenagrowthmarketing.com)
