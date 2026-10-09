import { Router } from "express";
import { db } from "../db/index.js";
import { ehCentavos, exigir } from "../lib/http.js";
import { dataVencimento, mesValido } from "../lib/mes.js";

export const lancamentosRouter = Router();

/**
 * Formulário do mês: bancos/cartões ativos + inativos que tenham valor nesse mês
 * (para não "sumir" histórico de um banco desativado depois).
 */
lancamentosRouter.get("/:mes", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");

  const fisico = db.prepare("SELECT valor_centavos AS v FROM dinheiro_fisico WHERE mes = ?").get(mes) as
    | { v: number }
    | undefined;

  const saldos = (
    db
      .prepare(
        `SELECT b.id AS banco_id, b.nome, b.cor, b.ativo, s.valor_centavos
         FROM bancos b LEFT JOIN saldos s ON s.banco_id = b.id AND s.mes = ?
         WHERE b.ativo = 1 OR s.valor_centavos IS NOT NULL
         ORDER BY b.nome COLLATE NOCASE`,
      )
      .all(mes) as any[]
  ).map((s) => ({ ...s, ativo: s.ativo === 1 }));

  const faturas = (
    db
      .prepare(
        `SELECT c.id AS cartao_id, b.id AS banco_id, b.nome AS banco_nome, b.cor,
                c.dia_fechamento, c.dia_vencimento, c.limite_centavos, f.valor_centavos, COALESCE(f.paga, 0) AS paga
         FROM cartoes c
         JOIN bancos b ON b.id = c.banco_id
         LEFT JOIN faturas f ON f.cartao_id = c.id AND f.mes = ?
         WHERE (c.ativo = 1 AND b.ativo = 1) OR f.valor_centavos IS NOT NULL
         ORDER BY b.nome COLLATE NOCASE`,
      )
      .all(mes) as any[]
  ).map((f) => ({ ...f, paga: f.paga === 1, vencimento: dataVencimento(mes, f.dia_vencimento) }));

  const temDados = !!fisico || saldos.some((s) => s.valor_centavos != null) || faturas.some((f) => f.valor_centavos != null);

  res.json({ mes, temDados, dinheiro_fisico: fisico?.v ?? null, saldos, faturas });
});

/** Salva o mês inteiro de uma vez (upsert). Valor `null` remove o lançamento. */
lancamentosRouter.put("/:mes", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");
  const { dinheiro_fisico = null, saldos = [], faturas = [] } = req.body ?? {};

  exigir(dinheiro_fisico === null || ehCentavos(dinheiro_fisico), "Dinheiro físico inválido");
  exigir(Array.isArray(saldos) && Array.isArray(faturas), "Formato inválido");
  for (const s of saldos) {
    exigir(Number.isInteger(s?.banco_id), "banco_id inválido");
    exigir(s.valor_centavos === null || ehCentavos(s.valor_centavos), "Saldo inválido");
  }
  for (const f of faturas) {
    exigir(Number.isInteger(f?.cartao_id), "cartao_id inválido");
    exigir(f.valor_centavos === null || (ehCentavos(f.valor_centavos) && f.valor_centavos >= 0), "Fatura inválida");
  }

  db.transaction(() => {
    if (dinheiro_fisico === null) db.prepare("DELETE FROM dinheiro_fisico WHERE mes = ?").run(mes);
    else
      db.prepare(
        "INSERT INTO dinheiro_fisico (mes, valor_centavos) VALUES (?, ?) ON CONFLICT (mes) DO UPDATE SET valor_centavos = excluded.valor_centavos",
      ).run(mes, dinheiro_fisico);

    const upSaldo = db.prepare(
      "INSERT INTO saldos (mes, banco_id, valor_centavos) VALUES (?, ?, ?) ON CONFLICT (mes, banco_id) DO UPDATE SET valor_centavos = excluded.valor_centavos",
    );
    const delSaldo = db.prepare("DELETE FROM saldos WHERE mes = ? AND banco_id = ?");
    for (const s of saldos) {
      if (s.valor_centavos === null) delSaldo.run(mes, s.banco_id);
      else upSaldo.run(mes, s.banco_id, s.valor_centavos);
    }

    const upFatura = db.prepare(
      `INSERT INTO faturas (mes, cartao_id, valor_centavos, paga) VALUES (?, ?, ?, ?)
       ON CONFLICT (mes, cartao_id) DO UPDATE SET valor_centavos = excluded.valor_centavos, paga = excluded.paga`,
    );
    const delFatura = db.prepare("DELETE FROM faturas WHERE mes = ? AND cartao_id = ?");
    for (const f of faturas) {
      if (f.valor_centavos === null) delFatura.run(mes, f.cartao_id);
      else upFatura.run(mes, f.cartao_id, f.valor_centavos, f.paga ? 1 : 0);
    }
  })();

  res.json({ ok: true });
});

/** Marca/desmarca uma fatura como paga (usado na lista de vencimentos). */
lancamentosRouter.patch("/:mes/faturas/:cartaoId", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido");
  const r = db
    .prepare("UPDATE faturas SET paga = ? WHERE mes = ? AND cartao_id = ?")
    .run(req.body?.paga ? 1 : 0, mes, Number(req.params.cartaoId));
  exigir(r.changes === 1, "Fatura não encontrada");
  res.json({ ok: true });
});
