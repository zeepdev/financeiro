import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sistema Financeiro Multi-Perfil & Multi-Empresa</span>
        </div>
        <div>
          Developed by:{' '}
          <a
            href="https://athenagrowthmarketing.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors"
          >
            Athena Growth Marketing
          </a>
        </div>
      </div>
    </footer>
  );
}
