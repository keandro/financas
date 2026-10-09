import { db } from "../db/index.js";
import { saldosDoMes, valorDaConta } from "./contas.js";
import { dataVencimento } from "./mes.js";

export interface Totais {
  mes: string;
  temDados: boolean;
  dinheiro_fisico: number;
  bancos: number;
  outros: number;
  disponivel: number;
  devido: number;
  patrimonio: number;
}

const qFaturas = db.prepare(
  "SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN paga = 0 THEN valor_centavos END), 0) AS v FROM faturas WHERE mes = ?",
);

export function totaisDoMes(mes: string): Totais {
  // valores gravados ou herdados do mês anterior
  const fisico = valorDaConta(null, mes).valor;
  const saldos = saldosDoMes(mes).filter((s) => s.valor !== null);
  const somar = (tipo: "banco" | "outro") =>
    saldos.filter((s) => s.tipo === tipo).reduce((s, b) => s + (b.valor_brl ?? 0), 0);
  const somaBancos = somar("banco");
  const somaOutros = somar("outro");
  const faturas = qFaturas.get(mes) as { n: number; v: number };

  const dinheiro_fisico = fisico ?? 0;
  const disponivel = dinheiro_fisico + somaBancos + somaOutros;
  return {
    mes,
    temDados: fisico !== null || saldos.length > 0 || faturas.n > 0,
    dinheiro_fisico,
    bancos: somaBancos,
    outros: somaOutros,
    disponivel,
    devido: faturas.v,
    patrimonio: disponivel - faturas.v,
  };
}

export interface FaturaDetalhe {
  mes: string;
  cartao_id: number;
  banco_id: number;
  banco_nome: string;
  cor: string;
  valor_centavos: number;
  limite_centavos: number | null;
  paga: boolean;
  vencimento: string;
}

type LinhaFatura = Omit<FaturaDetalhe, "paga" | "vencimento"> & { paga: number; dia_vencimento: number };

const SQL_FATURAS = `
  SELECT f.mes, f.cartao_id, b.id AS banco_id, b.nome AS banco_nome, b.cor,
         f.valor_centavos, c.limite_centavos, f.paga, c.dia_vencimento
  FROM faturas f
  JOIN cartoes c ON c.id = f.cartao_id
  JOIN bancos  b ON b.id = c.banco_id`;

const qFaturasMes = db.prepare(`${SQL_FATURAS} WHERE f.mes = ? ORDER BY b.nome`);
const qFaturasAbertas = db.prepare(`${SQL_FATURAS} WHERE f.paga = 0 AND f.valor_centavos > 0`);

function detalhar(l: LinhaFatura): FaturaDetalhe {
  const { dia_vencimento, ...resto } = l;
  return { ...resto, paga: l.paga === 1, vencimento: dataVencimento(l.mes, dia_vencimento) };
}

export const faturasDoMes = (mes: string) => (qFaturasMes.all(mes) as LinhaFatura[]).map(detalhar);

export const faturasEmAberto = () =>
  (qFaturasAbertas.all() as LinhaFatura[])
    .map(detalhar)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
