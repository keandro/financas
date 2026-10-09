import { Router } from "express";
import { db } from "../db/index.js";
import { HttpError, ehCor, ehDia, exigir } from "../lib/http.js";

export const bancosRouter = Router();

interface CartaoEntrada {
  dia_fechamento: number | null;
  dia_vencimento: number;
  ativo?: boolean;
}

function lerCartao(c: unknown): CartaoEntrada | null | undefined {
  if (c === undefined || c === null) return c;
  const x = c as Record<string, unknown>;
  exigir(ehDia(x.dia_vencimento), "Dia de vencimento deve ser entre 1 e 31");
  exigir(x.dia_fechamento == null || ehDia(x.dia_fechamento), "Dia de fechamento deve ser entre 1 e 31");
  return {
    dia_fechamento: (x.dia_fechamento as number | null | undefined) ?? null,
    dia_vencimento: x.dia_vencimento as number,
    ativo: x.ativo === undefined ? true : !!x.ativo,
  };
}

function listar() {
  const linhas = db
    .prepare(
      `SELECT b.id, b.nome, b.cor, b.ativo, b.criado_em,
              c.id AS cartao_id, c.dia_fechamento, c.dia_vencimento, c.ativo AS cartao_ativo
       FROM bancos b LEFT JOIN cartoes c ON c.banco_id = b.id
       ORDER BY b.ativo DESC, b.nome COLLATE NOCASE`,
    )
    .all() as any[];
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    cor: l.cor,
    ativo: l.ativo === 1,
    criado_em: l.criado_em,
    cartao: l.cartao_id
      ? { id: l.cartao_id, dia_fechamento: l.dia_fechamento, dia_vencimento: l.dia_vencimento, ativo: l.cartao_ativo === 1 }
      : null,
  }));
}

const buscar = (id: number) => listar().find((b) => b.id === id);

/** Cria/atualiza o cartão do banco. `null` desativa o cartão existente (sem apagar o histórico). */
function salvarCartao(bancoId: number, cartao: CartaoEntrada | null) {
  if (cartao === null) {
    db.prepare("UPDATE cartoes SET ativo = 0 WHERE banco_id = ?").run(bancoId);
    return;
  }
  db.prepare(
    `INSERT INTO cartoes (banco_id, dia_fechamento, dia_vencimento, ativo) VALUES (?, ?, ?, ?)
     ON CONFLICT (banco_id) DO UPDATE SET
       dia_fechamento = excluded.dia_fechamento,
       dia_vencimento = excluded.dia_vencimento,
       ativo = excluded.ativo`,
  ).run(bancoId, cartao.dia_fechamento, cartao.dia_vencimento, cartao.ativo ? 1 : 0);
}

bancosRouter.get("/", (_req, res) => {
  res.json(listar());
});

bancosRouter.post("/", (req, res) => {
  const { nome, cor } = req.body ?? {};
  exigir(typeof nome === "string" && nome.trim(), "Nome é obrigatório");
  exigir(ehCor(cor), "Cor inválida (use #RRGGBB)");
  const cartao = lerCartao(req.body.cartao);

  const id = db.transaction(() => {
    const novoId = Number(db.prepare("INSERT INTO bancos (nome, cor) VALUES (?, ?)").run(nome.trim(), cor).lastInsertRowid);
    if (cartao) salvarCartao(novoId, cartao);
    return novoId;
  })();
  res.status(201).json(buscar(id));
});

bancosRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const atual = buscar(id);
  if (!atual) throw new HttpError(404, "Banco não encontrado");

  const { nome = atual.nome, cor = atual.cor, ativo = atual.ativo } = req.body ?? {};
  exigir(typeof nome === "string" && nome.trim(), "Nome é obrigatório");
  exigir(ehCor(cor), "Cor inválida (use #RRGGBB)");
  const cartao = lerCartao(req.body?.cartao);

  db.transaction(() => {
    db.prepare("UPDATE bancos SET nome = ?, cor = ?, ativo = ? WHERE id = ?").run(nome.trim(), cor, ativo ? 1 : 0, id);
    if (cartao !== undefined) salvarCartao(id, cartao);
  })();
  res.json(buscar(id));
});
