/** Utilitários para meses no formato YYYY-MM. */

export const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function mesValido(mes: unknown): mes is string {
  return typeof mes === "string" && MES_REGEX.test(mes);
}

export function somarMeses(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + delta;
  const ano = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${ano}-${String(mm).padStart(2, "0")}`;
}

export function mesAtual(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** Data de vencimento (YYYY-MM-DD) limitando o dia ao último dia do mês (ex.: 31 → 28/29 em fevereiro). */
export function dataVencimento(mes: string, dia: number): string {
  const [a, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(a, m, 0).getDate();
  return `${mes}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}
