import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Painel({ titulo, acao, children, className = "" }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900/60 ${className}`}>
      {(titulo || acao) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {titulo && <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

type Variante = "primario" | "secundario" | "perigo" | "excluir" | "fantasma";
const estilos: Record<Variante, string> = {
  primario: "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-600/40",
  secundario:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  perigo: "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950",
  excluir: "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-600/40",
  fantasma: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
};

export function Botao({ variante = "secundario", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${estilos[variante]} ${className}`}
    />
  );
}

export function Bolinha({ cor, className = "" }: { cor: string; className?: string }) {
  return <span className={`inline-block size-3 shrink-0 rounded-full ${className}`} style={{ backgroundColor: cor }} />;
}

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "erro" | "ok"; children: ReactNode }) {
  const cores = {
    info: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    erro: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cores[tipo]}`}>{children}</div>;
}

export const inputClasse =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
