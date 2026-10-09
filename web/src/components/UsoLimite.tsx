import { formatarBRL } from "../lib/formato";

/** Barra de uso do limite do cartão. Cor + ícone + texto (nunca só cor). */
export function UsoLimite({ valor, limite, compacto }: { valor: number; limite: number; compacto?: boolean }) {
  const pct = limite > 0 ? (valor / limite) * 100 : 0;
  const nivel =
    pct > 100
      ? { barra: "bg-red-500", texto: "text-red-600 dark:text-red-400", icone: "⚠ " }
      : pct >= 80
        ? { barra: "bg-amber-500", texto: "text-amber-600 dark:text-amber-400", icone: "⚠ " }
        : { barra: "bg-emerald-500", texto: "text-slate-500 dark:text-slate-400", icone: "" };
  const pctTexto = pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full rounded-full ${nivel.barra}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className={`text-xs ${nivel.texto}`}>
        {nivel.icone}
        {pctTexto}% do limite
        {!compacto && ` de ${formatarBRL(limite)}`}
        {pct > 100 ? " · acima do limite" : ` · livre ${formatarBRL(limite - valor)}`}
      </p>
    </div>
  );
}
