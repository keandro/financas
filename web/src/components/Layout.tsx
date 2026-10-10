import { NavLink, Outlet } from "react-router-dom";
import { useTema } from "../contexts/Tema";

const links = [
  { to: "/", rotulo: "Dashboard", icone: "◧" },
  { to: "/lancamento", rotulo: "Lançamento", icone: "✎" },
  { to: "/bancos", rotulo: "Bancos e cartões", icone: "⌂" },
];

/** Dentro do app Android (Capacitor) o user agent leva "FinancasApp". */
const NO_APP = typeof navigator !== "undefined" && navigator.userAgent.includes("FinancasApp");

export function Layout() {
  const { tema, alternar } = useTema();

  const classeLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white">R$</span>
            <span className="hidden sm:inline">Finanças</span>
          </div>
          <nav className="hidden flex-1 gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={classeLink}>
                {l.rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1 md:hidden" />
          {NO_APP && (
            <a
              href="https://localhost/?config=1"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Trocar servidor"
              title="Trocar servidor"
            >
              ⚙
            </a>
          )}
          <button
            onClick={alternar}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Alternar tema"
          >
            {tema === "escuro" ? "☀ Claro" : "☾ Escuro"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 md:pb-10">
        <Outlet />
      </main>

      {/* navegação inferior no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`
            }
          >
            <span className="text-lg leading-none">{l.icone}</span>
            {l.rotulo.split(" ")[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
