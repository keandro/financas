/**
 * Cotações mensais (reais por 1 unidade da moeda), guardadas como inteiro × 10000
 * (ex.: 5,4321 → 54321). Mês sem cotação herda a última cotação gravada antes dele.
 */
import { db } from "../db/index.js";

export const MOEDAS_ESTRANGEIRAS = ["USD", "EUR"] as const;
export type MoedaEstrangeira = (typeof MOEDAS_ESTRANGEIRAS)[number];
export type Moeda = "BRL" | MoedaEstrangeira;
export const ESCALA_TAXA = 10_000;

const qNoMes = db.prepare("SELECT taxa FROM cotacoes WHERE moeda = ? AND mes = ?");
const qAnterior = db.prepare("SELECT taxa, mes FROM cotacoes WHERE moeda = ? AND mes < ? ORDER BY mes DESC LIMIT 1");
const upsert = db.prepare(
  "INSERT INTO cotacoes (mes, moeda, taxa) VALUES (?, ?, ?) ON CONFLICT (mes, moeda) DO UPDATE SET taxa = excluded.taxa",
);

export function cotacaoDoMes(moeda: MoedaEstrangeira, mes: string): { taxa: number | null; herdado_de: string | null } {
  const aqui = qNoMes.get(moeda, mes) as { taxa: number } | undefined;
  if (aqui) return { taxa: aqui.taxa, herdado_de: null };
  const ant = qAnterior.get(moeda, mes) as { taxa: number; mes: string } | undefined;
  return { taxa: ant?.taxa ?? null, herdado_de: ant?.mes ?? null };
}

/** Grava a cotação do mês só se for diferente da que já vale (gravada ou herdada). */
export function definirCotacao(moeda: MoedaEstrangeira, mes: string, taxa: number) {
  if (cotacaoDoMes(moeda, mes).taxa !== taxa) upsert.run(mes, moeda, taxa);
}

/** Converte centavos da moeda para centavos de real. null = sem cotação. */
export function paraReais(centavos: number, moeda: Moeda, mes: string): number | null {
  if (moeda === "BRL") return centavos;
  const { taxa } = cotacaoDoMes(moeda, mes);
  return taxa === null ? null : Math.round((centavos * taxa) / ESCALA_TAXA);
}

/** Cotação atual na internet (AwesomeAPI). Lança erro se não conseguir. */
export async function buscarCotacaoAtual(): Promise<Record<MoedaEstrangeira, number>> {
  const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL", {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = (await r.json()) as Record<string, { bid: string }>;
  const taxa = (s: string | undefined) => {
    const n = Math.round(Number(s) * ESCALA_TAXA);
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error("resposta inválida");
    return n;
  };
  return { USD: taxa(d.USDBRL?.bid), EUR: taxa(d.EURBRL?.bid) };
}
