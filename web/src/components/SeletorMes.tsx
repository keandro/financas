import { useEffect, useMemo, useState } from "react";
import { useMes } from "../contexts/Mes";
import { api } from "../lib/api";
import { mesAtual, nomeMes, somarMeses } from "../lib/mes";

/** ← [dropdown de meses] → ; meses com lançamento aparecem marcados com •. */
export function SeletorMes() {
  const { mes, setMes } = useMes();
  const [comDados, setComDados] = useState<string[]>([]);

  useEffect(() => {
    api.meses().then(setComDados).catch(() => {});
  }, [mes]);

  const opcoes = useMemo(() => {
    const hoje = mesAtual();
    const set = new Set<string>(comDados);
    for (let i = -24; i <= 2; i++) set.add(somarMeses(hoje, i));
    set.add(mes);
    return [...set].sort().reverse();
  }, [comDados, mes]);

  const seta =
    "grid size-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <div className="flex items-center gap-2">
      <button className={seta} onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior">
        ←
      </button>
      <select
        value={mes}
        onChange={(e) => setMes(e.target.value)}
        aria-label="Selecionar mês"
        className="h-9 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {opcoes.map((m) => (
          <option key={m} value={m}>
            {comDados.includes(m) ? "• " : "   "}
            {nomeMes(m)}
          </option>
        ))}
      </select>
      <button className={seta} onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês">
        →
      </button>
    </div>
  );
}
