const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function mesAtual(hoje = new Date()) {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function somarMeses(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** "2026-10" → "Outubro de 2026" */
export function nomeMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const nome = NOMES[m - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`;
}

/** "2026-10" → "out/26" */
export function nomeMesCurto(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${CURTOS[m - 1]}/${String(a).slice(2)}`;
}
