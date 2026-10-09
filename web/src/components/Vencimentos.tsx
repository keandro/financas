import type { FaturaDetalhe } from "../lib/api";
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

/** Faturas não pagas, ordenadas por vencimento. (Marcar como paga só na tela de Lançamento.) */
export function ProximosVencimentos({ faturas }: { faturas: FaturaDetalhe[] }) {
  if (faturas.length === 0) return <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">🎉 Nenhuma fatura em aberto neste período.</p>;

  return (
    <ul className="space-y-2">
      {faturas.map((f) => {
        const s = situacao(diasAte(f.vencimento));
        return (
          <li key={`${f.mes}-${f.cartao_id}`} className={`flex items-center gap-3 rounded-xl border p-3 ${s.classe}`}>
            <Bolinha cor={f.cor} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{f.banco_nome}</p>
              <p className={`text-xs ${s.textoClasse}`}>
                <span aria-hidden>{s.icone}</span> {s.texto} · {formatarData(f.vencimento)}
              </p>
            </div>
            <span className="font-semibold tabular-nums">{formatarBRL(f.valor_centavos)}</span>
          </li>
        );
      })}
    </ul>
  );
}
