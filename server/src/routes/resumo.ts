import { Router } from "express";
import { db } from "../db/index.js";
import { saldosDoMes } from "../lib/contas.js";
import { faturasDoMes, faturasEmAberto, totaisDoMes } from "../lib/calculos.js";
import { exigir } from "../lib/http.js";
import { mesValido, somarMeses } from "../lib/mes.js";

export const resumoRouter = Router();

/** Meses que possuem algum lançamento. */
resumoRouter.get("/meses", (_req, res) => {
  const linhas = db
    .prepare(
      `SELECT mes FROM dinheiro_fisico UNION SELECT mes FROM saldos UNION SELECT mes FROM faturas ORDER BY mes DESC`,
    )
    .all() as { mes: string }[];
  res.json(linhas.map((l) => l.mes));
});

resumoRouter.get("/resumo/:mes", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");

  const atual = totaisDoMes(mes);
  const anterior = totaisDoMes(somarMeses(mes, -1));

  let variacao: { valor: number; pct: number | null } | null = null;
  if (atual.temDados && anterior.temDados) {
    const valor = atual.patrimonio - anterior.patrimonio;
    variacao = { valor, pct: anterior.patrimonio === 0 ? null : (valor / Math.abs(anterior.patrimonio)) * 100 };
  }

  const bancos = saldosDoMes(mes)
    .filter((s) => s.valor !== null)
    .map((s) => ({ nome: s.nome, cor: s.cor, valor: s.valor as number }))
    .sort((a, b) => b.valor - a.valor);

  const distribuicao = [{ nome: "Dinheiro físico", cor: "#10B981", valor: atual.dinheiro_fisico }, ...bancos].filter(
    (d) => d.valor > 0,
  );

  // limite ocupado = faturas não pagas deste mês em diante (inclui parcelas futuras já lançadas)
  const uso_limite = db
    .prepare(
      `SELECT c.id AS cartao_id, b.nome AS banco_nome, b.cor, c.limite_centavos,
              COALESCE(SUM(CASE WHEN f.paga = 0 THEN f.valor_centavos END), 0) AS usado_centavos
       FROM cartoes c
       JOIN bancos b ON b.id = c.banco_id
       LEFT JOIN faturas f ON f.cartao_id = c.id AND f.mes >= ?
       WHERE c.limite_centavos IS NOT NULL AND c.ativo = 1 AND b.ativo = 1
       GROUP BY c.id
       ORDER BY b.nome COLLATE NOCASE`,
    )
    .all(mes);

  res.json({ ...atual, anterior, variacao, distribuicao, faturas: faturasDoMes(mes), uso_limite });
});

/** Evolução dos últimos N meses (padrão 12) terminando em :mes. */
resumoRouter.get("/historico/:mes", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");
  const n = Math.min(Math.max(Number(req.query.n) || 12, 1), 60);
  res.json(Array.from({ length: n }, (_, i) => totaisDoMes(somarMeses(mes, i - n + 1))));
});

/** Todas as faturas não pagas (de qualquer mês), ordenadas por vencimento. */
resumoRouter.get("/vencimentos", (_req, res) => {
  res.json(faturasEmAberto());
});
