import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/components/providers/QueryProvider';
import { FinancialProvider } from '@/context/FinancialContext';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Financeiro — Gestão Multi-Perfil e Multi-Empresa',
  description: 'Controle financeiro pessoal e empresarial completo com DRE, Fluxo de Caixa e Caderneta Tátil.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <QueryProvider>
          <FinancialProvider>
            <AppShell>{children}</AppShell>
          </FinancialProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
