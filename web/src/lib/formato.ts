const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123456 → "R$ 1.234,56" (centavos são inteiros; a divisão é só para exibir). */
export const formatarBRL = (centavos: number) => brl.format(centavos / 100);

/** 123456 → "1.234,56" (sem o símbolo, usado nos campos). */
export const formatarNumero = (centavos: number) => numero.format(centavos / 100);

/** "R$ 12,3 mil" para eixos de gráfico. */
export function formatarCompacto(centavos: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(
    centavos / 100,
  );
}

export function formatarPct(pct: number) {
  return `${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

/** "2026-10-25" → "25/10/2026" */
export function formatarData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Dias entre hoje (data local) e a data ISO. Negativo = já passou. */
export function diasAte(iso: string, hoje = new Date()) {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = Date.UTC(a, m - 1, d);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86_400_000);
}
