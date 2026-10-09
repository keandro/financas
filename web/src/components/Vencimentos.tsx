import { useState } from "react";
import { api, type FaturaDetalhe } from "../lib/api";
import { diasAte, formatarBRL, formatarData } from "../lib/formato";
import { Bolinha } from "./ui";

function situacao(dias: number) {
  if (dias < 0)
    return {
      icone: "⚠",
      texto: `Vencida há ${-dias} ${dias === -1 ? "dia" : "dias"}`,
      classe: "border-red-300 bg-red-50 dark:border-red-900/70 dark:bg-red-950/40",
      textoClasse: "text-red-700 dark:text-red-300",
    };
  if (dias <= 7)
    return {
      icone: "⏰",
      texto: dias === 0 ? "Vence hoje" : `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`,
      classe: "border-amber-300 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/30",
      textoClasse: "text-amber-700 dark:text-amber-300",
    };
  return {
    icone: "📅",
    texto: `Em ${dias} dias`,
    classe: "border-slate-200 dark:border-slate-800",
    textoClasse: "text-slate-500 dark:text-slate-400",
  };
}

/** Faturas não pagas de todos os meses, ordenadas por vencimento. */
export function ProximosVencimentos({ faturas, onAlterado }: { faturas: FaturaDetalhe[]; onAlterado: () => void }) {
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (faturas.length === 0) return <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">🎉 Nenhuma fatura em aberto neste período.</p>;

  async function pagar(f: FaturaDetalhe) {
    const chave = `${f.mes}-${f.cartao_id}`;
    setOcupado(chave);
    try {
      await api.marcarPaga(f.mes, f.cartao_id, true);
      onAlterado();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <ul className="space-y-2">
      {faturas.map((f) => {
        const s = situacao(diasAte(f.vencimento));
        const chave = `${f.mes}-${f.cartao_id}`;
        return (
          <li key={chave} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border p-3 ${s.classe}`}>
            <Bolinha cor={f.cor} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{f.banco_nome}</p>
              <p className={`text-xs ${s.textoClasse}`}>
                <span aria-hidden>{s.icone}</span> {s.texto} · {formatarData(f.vencimento)}
              </p>
            </div>
            <span className="font-semibold tabular-nums">{formatarBRL(f.valor_centavos)}</span>
            <button
              onClick={() => pagar(f)}
              disabled={ocupado === chave}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ✓ Paga
            </button>
          </li>
        );
      })}
    </ul>
  );
}
