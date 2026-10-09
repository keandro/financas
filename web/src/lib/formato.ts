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

export type Moeda = "BRL" | "USD" | "EUR";
export const SIMBOLO: Record<Moeda, string> = { BRL: "R$", USD: "US$", EUR: "€" };
export const NOME_MOEDA: Record<Moeda, string> = { BRL: "Real", USD: "Dólar", EUR: "Euro" };

/** 123456 em USD → "US$ 1.234,56" (formato brasileiro com o símbolo da moeda). */
export function formatarMoeda(centavos: number, moeda: Moeda) {
  if (moeda === "BRL") return formatarBRL(centavos);
  return `${centavos < 0 ? "-" : ""}${SIMBOLO[moeda]} ${formatarNumero(Math.abs(centavos))}`;
}

/** Cotação guardada × 10000 → "5,4321" */
export const formatarTaxa = (taxa: number) =>
  (taxa / 10_000).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

/** centavos na moeda → centavos de real (null sem cotação) */
export function paraReais(centavos: number, moeda: Moeda, taxa: number | null | undefined) {
  if (moeda === "BRL") return centavos;
  return taxa ? Math.round((centavos * taxa) / 10_000) : null;
}
