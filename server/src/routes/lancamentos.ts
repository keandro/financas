import { Router } from "express";
import { db } from "../db/index.js";
import { HttpError, ehCentavos, exigir } from "../lib/http.js";
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

  const movimentacoes = db
    .prepare("SELECT id, data, descricao, valor_centavos FROM movimentacoes_dinheiro WHERE mes = ? ORDER BY data, id")
    .all(mes);

  res.json({ mes, temDados, dinheiro_fisico: fisico?.v ?? null, saldos, faturas, movimentacoes });
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

  const ajustes = db.transaction(() => {
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

    // Pagamento de fatura mexe no saldo do banco do cartão (mesmo mês):
    // "desconto" = valor da fatura se paga, senão 0. O saldo recebe (desconto antigo − desconto novo).
    // Assim: marcar paga → debita; desmarcar → devolve; mudar o valor de uma fatura já paga → ajusta a diferença.
    const qFaturaAtual = db.prepare(
      `SELECT f.valor_centavos, f.paga FROM faturas f WHERE f.mes = ? AND f.cartao_id = ?`,
    );
    const qBancoDoCartao = db.prepare("SELECT banco_id FROM cartoes WHERE id = ?");
    const ajustePorBanco = new Map<number, number>();

    const upFatura = db.prepare(
      `INSERT INTO faturas (mes, cartao_id, valor_centavos, paga) VALUES (?, ?, ?, ?)
       ON CONFLICT (mes, cartao_id) DO UPDATE SET valor_centavos = excluded.valor_centavos, paga = excluded.paga`,
    );
    const delFatura = db.prepare("DELETE FROM faturas WHERE mes = ? AND cartao_id = ?");
    for (const f of faturas) {
      const antes = qFaturaAtual.get(mes, f.cartao_id) as { valor_centavos: number; paga: number } | undefined;
      const descontoAntes = antes?.paga ? antes.valor_centavos : 0;
      const descontoDepois = f.paga && f.valor_centavos !== null ? f.valor_centavos : 0;
      const ajuste = descontoAntes - descontoDepois;
      if (ajuste !== 0) {
        const banco = qBancoDoCartao.get(f.cartao_id) as { banco_id: number } | undefined;
        exigir(banco, "Cartão não encontrado");
        ajustePorBanco.set(banco.banco_id, (ajustePorBanco.get(banco.banco_id) ?? 0) + ajuste);
      }

      if (f.valor_centavos === null) delFatura.run(mes, f.cartao_id);
      else upFatura.run(mes, f.cartao_id, f.valor_centavos, f.paga ? 1 : 0);
    }

    // aplica os ajustes por cima do saldo informado no formulário (sem saldo no mês, parte de 0)
    const somarSaldo = db.prepare(
      `INSERT INTO saldos (mes, banco_id, valor_centavos) VALUES (?, ?, ?)
       ON CONFLICT (mes, banco_id) DO UPDATE SET valor_centavos = valor_centavos + excluded.valor_centavos`,
    );
    const qNome = db.prepare("SELECT nome FROM bancos WHERE id = ?");
    const lista: { banco_id: number; nome: string; ajuste_centavos: number }[] = [];
    for (const [banco_id, ajuste] of ajustePorBanco) {
      if (ajuste === 0) continue;
      somarSaldo.run(mes, banco_id, ajuste);
      lista.push({ banco_id, nome: (qNome.get(banco_id) as { nome: string }).nome, ajuste_centavos: ajuste });
    }
    return lista;
  })();

  res.json({ ok: true, ajustes });
});

/**
 * Movimentações do dinheiro físico: cada uma soma (entrada) ou subtrai (saída) do
 * dinheiro físico do mês na hora. Remover a movimentação desfaz o efeito.
 */
const somarFisico = db.prepare(
  `INSERT INTO dinheiro_fisico (mes, valor_centavos) VALUES (?, ?)
   ON CONFLICT (mes) DO UPDATE SET valor_centavos = valor_centavos + excluded.valor_centavos`,
);
const lerFisico = (mes: string) =>
  (db.prepare("SELECT valor_centavos AS v FROM dinheiro_fisico WHERE mes = ?").get(mes) as { v: number } | undefined)?.v ?? null;

lancamentosRouter.post("/:mes/movimentacoes", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");
  const { data, descricao = "", valor_centavos } = req.body ?? {};
  exigir(typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) && data.startsWith(`${mes}-`), "A data deve estar dentro do mês");
  exigir(ehCentavos(valor_centavos) && valor_centavos !== 0, "Informe um valor diferente de zero");
  exigir(typeof descricao === "string" && descricao.length <= 200, "Descrição muito longa");

  const id = db.transaction(() => {
    const novoId = Number(
      db
        .prepare("INSERT INTO movimentacoes_dinheiro (mes, data, descricao, valor_centavos) VALUES (?, ?, ?, ?)")
        .run(mes, data, descricao.trim(), valor_centavos).lastInsertRowid,
    );
    somarFisico.run(mes, valor_centavos);
    return novoId;
  })();

  res.status(201).json({
    movimentacao: { id, data, descricao: descricao.trim(), valor_centavos },
    dinheiro_fisico: lerFisico(mes),
  });
});

lancamentosRouter.delete("/:mes/movimentacoes/:id", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");
  const mov = db
    .prepare("SELECT valor_centavos FROM movimentacoes_dinheiro WHERE id = ? AND mes = ?")
    .get(Number(req.params.id), mes) as { valor_centavos: number } | undefined;
  if (!mov) throw new HttpError(404, "Movimentação não encontrada");

  db.transaction(() => {
    db.prepare("DELETE FROM movimentacoes_dinheiro WHERE id = ?").run(Number(req.params.id));
    somarFisico.run(mes, -mov.valor_centavos);
  })();

  res.json({ ok: true, dinheiro_fisico: lerFisico(mes) });
});
