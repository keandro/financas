import { Router } from "express";
import { db } from "../db/index.js";
import { ajustarConta, definirConta, saldosDoMes, valorDaConta, type Conta } from "../lib/contas.js";
import { MOEDAS_ESTRANGEIRAS, cotacaoDoMes, definirCotacao } from "../lib/cotacoes.js";
import { HttpError, ehCentavos, exigir } from "../lib/http.js";
import { dataVencimento, mesValido } from "../lib/mes.js";

export const lancamentosRouter = Router();

/**
 * Formulário do mês. Dinheiro físico e saldos vêm gravados no mês ou herdados do último mês gravado
 * (`herdado_de`). Bancos inativos só aparecem se tiverem valor gravado neste mês.
 */
lancamentosRouter.get("/:mes", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");

  const fisico = valorDaConta(null, mes);

  const saldos = saldosDoMes(mes)
    .filter((s) => s.ativo || s.proprio)
    .map((s) => ({
      banco_id: s.banco_id,
      nome: s.nome,
      cor: s.cor,
      ativo: s.ativo,
      tipo: s.tipo,
      moeda: s.moeda,
      valor_centavos: s.valor,
      herdado_de: s.herdado_de,
    }));

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

  const movimentacoes = db
    .prepare(
      "SELECT id, banco_id, data, descricao, valor_centavos FROM movimentacoes_dinheiro WHERE mes = ? ORDER BY data, id",
    )
    .all(mes);

  // "tem dados" = algo gravado NESTE mês (valores herdados não contam)
  const temDados =
    fisico.proprio ||
    saldos.some((s) => s.herdado_de === null && s.valor_centavos !== null) ||
    faturas.some((f) => f.valor_centavos !== null);

  res.json({
    mes,
    temDados,
    dinheiro_fisico: fisico.valor,
    fisico_herdado_de: fisico.herdado_de,
    saldos,
    faturas,
    movimentacoes,
    cotacoes: Object.fromEntries(MOEDAS_ESTRANGEIRAS.map((m) => [m, cotacaoDoMes(m, mes)])),
  });
});

/**
 * Salva o mês. Dinheiro físico e saldos: só grava o que mudou em relação ao valor atual
 * (gravado ou herdado), repassando a diferença aos meses seguintes.
 */
lancamentosRouter.put("/:mes", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");
  const { dinheiro_fisico = null, saldos = [], faturas = [], cotacoes = {} } = req.body ?? {};
  for (const m of MOEDAS_ESTRANGEIRAS) {
    const t = cotacoes?.[m];
    exigir(t == null || (Number.isSafeInteger(t) && t > 0), `Cotação de ${m} inválida`);
  }

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

  /** campo vazio = 0 (se a conta já tinha valor); conta sem histórico e vazia continua sem valor */
  const definirSeInformado = (conta: Conta, valor: number | null) => {
    if (valor === null && valorDaConta(conta, mes).valor === null) return;
    definirConta(conta, mes, valor ?? 0);
  };

  const ajustes = db.transaction(() => {
    for (const m of MOEDAS_ESTRANGEIRAS) if (cotacoes?.[m] != null) definirCotacao(m, mes, cotacoes[m]);
    // campo ausente no corpo = não mexer (só null explícito limpa)
    if (req.body && "dinheiro_fisico" in req.body) definirSeInformado(null, dinheiro_fisico);
    for (const s of saldos) definirSeInformado(s.banco_id, s.valor_centavos);

    // Pagamento de fatura mexe no saldo do banco do cartão (e nos meses seguintes):
    // "desconto" = valor da fatura se paga, senão 0. O saldo recebe (desconto antigo − desconto novo).
    // Marcar paga → debita; desmarcar → devolve; mudar o valor de uma fatura já paga → ajusta a diferença.
    const qFaturaAtual = db.prepare("SELECT valor_centavos, paga FROM faturas WHERE mes = ? AND cartao_id = ?");
    const qBancoDoCartao = db.prepare("SELECT banco_id FROM cartoes WHERE id = ?");
    const upFatura = db.prepare(
      `INSERT INTO faturas (mes, cartao_id, valor_centavos, paga) VALUES (?, ?, ?, ?)
       ON CONFLICT (mes, cartao_id) DO UPDATE SET valor_centavos = excluded.valor_centavos, paga = excluded.paga`,
    );
    const delFatura = db.prepare("DELETE FROM faturas WHERE mes = ? AND cartao_id = ?");
    const ajustePorBanco = new Map<number, number>();

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

    const qNome = db.prepare("SELECT nome FROM bancos WHERE id = ?");
    const lista: { banco_id: number; nome: string; ajuste_centavos: number }[] = [];
    for (const [banco_id, ajuste] of ajustePorBanco) {
      if (ajuste === 0) continue;
      ajustarConta(banco_id, mes, ajuste);
      lista.push({ banco_id, nome: (qNome.get(banco_id) as { nome: string }).nome, ajuste_centavos: ajuste });
    }
    return lista;
  })();

  res.json({ ok: true, ajustes });
});

/**
 * Movimentações (entradas > 0, saídas < 0) do dinheiro físico (banco_id null) ou de um banco.
 * Somam/subtraem do valor do mês na hora — e dos meses seguintes. Remover desfaz.
 */
lancamentosRouter.post("/:mes/movimentacoes", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");
  const { data, descricao = "", valor_centavos, banco_id = null } = req.body ?? {};
  exigir(typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) && data.startsWith(`${mes}-`), "A data deve estar dentro do mês");
  exigir(ehCentavos(valor_centavos) && valor_centavos !== 0, "Informe um valor diferente de zero");
  exigir(typeof descricao === "string" && descricao.length <= 200, "Descrição muito longa");
  if (banco_id !== null) {
    exigir(Number.isInteger(banco_id), "banco_id inválido");
    exigir(db.prepare("SELECT 1 FROM bancos WHERE id = ?").get(banco_id), "Banco não encontrado");
  }

  const id = db.transaction(() => {
    const novoId = Number(
      db
        .prepare("INSERT INTO movimentacoes_dinheiro (mes, banco_id, data, descricao, valor_centavos) VALUES (?, ?, ?, ?, ?)")
        .run(mes, banco_id, data, descricao.trim(), valor_centavos).lastInsertRowid,
    );
    ajustarConta(banco_id, mes, valor_centavos);
    return novoId;
  })();

  res.status(201).json({
    movimentacao: { id, banco_id, data, descricao: descricao.trim(), valor_centavos },
    valor_conta: valorDaConta(banco_id, mes).valor,
  });
});

lancamentosRouter.delete("/:mes/movimentacoes/:id", (req, res) => {
  const { mes } = req.params;
  exigir(mesValido(mes), "Mês inválido (use YYYY-MM)");
  const id = Number(req.params.id);
  const mov = db
    .prepare("SELECT banco_id, valor_centavos FROM movimentacoes_dinheiro WHERE id = ? AND mes = ?")
    .get(id, mes) as { banco_id: number | null; valor_centavos: number } | undefined;
  if (!mov) throw new HttpError(404, "Movimentação não encontrada");

  db.transaction(() => {
    db.prepare("DELETE FROM movimentacoes_dinheiro WHERE id = ?").run(id);
    ajustarConta(mov.banco_id, mes, -mov.valor_centavos);
  })();

  res.json({ ok: true, valor_conta: valorDaConta(mov.banco_id, mes).valor });
});
