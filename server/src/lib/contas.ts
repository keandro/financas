/**
 * "Contas" = dinheiro físico (bancoId null) ou o saldo de um banco.
 *
 * Regra de herança: um mês sem valor gravado HERDA o último valor gravado antes dele
 * (bancos inativos não herdam — só valem onde têm valor gravado).
 * Mudar o valor de um mês grava esse mês e repassa a diferença aos meses
 * seguintes que tenham valor gravado próprio; os que herdam acompanham sozinhos.
 */
import { db } from "../db/index.js";

export type Conta = number | null; // null = dinheiro físico

const q = {
  fisicoNoMes: db.prepare("SELECT valor_centavos AS v FROM dinheiro_fisico WHERE mes = ?"),
  fisicoAnterior: db.prepare(
    "SELECT valor_centavos AS v, mes FROM dinheiro_fisico WHERE mes < ? ORDER BY mes DESC LIMIT 1",
  ),
  saldoNoMes: db.prepare("SELECT valor_centavos AS v FROM saldos WHERE banco_id = ? AND mes = ?"),
  saldoAnterior: db.prepare(
    "SELECT valor_centavos AS v, mes FROM saldos WHERE banco_id = ? AND mes < ? ORDER BY mes DESC LIMIT 1",
  ),
  bancoAtivo: db.prepare("SELECT ativo FROM bancos WHERE id = ?"),

  somarFisico: db.prepare(
    `INSERT INTO dinheiro_fisico (mes, valor_centavos) VALUES (?, ?)
     ON CONFLICT (mes) DO UPDATE SET valor_centavos = valor_centavos + excluded.valor_centavos`,
  ),
  propagarFisico: db.prepare("UPDATE dinheiro_fisico SET valor_centavos = valor_centavos + ? WHERE mes > ?"),
  somarSaldo: db.prepare(
    `INSERT INTO saldos (mes, banco_id, valor_centavos) VALUES (?, ?, ?)
     ON CONFLICT (mes, banco_id) DO UPDATE SET valor_centavos = valor_centavos + excluded.valor_centavos`,
  ),
  propagarSaldo: db.prepare("UPDATE saldos SET valor_centavos = valor_centavos + ? WHERE banco_id = ? AND mes > ?"),
};

export interface ValorConta {
  valor: number | null;
  /** true = gravado neste mês; false = herdado (ou sem valor) */
  proprio: boolean;
  /** mês de onde o valor foi herdado */
  herdado_de: string | null;
}

export function valorDaConta(conta: Conta, mes: string): ValorConta {
  if (conta === null) {
    const aqui = q.fisicoNoMes.get(mes) as { v: number } | undefined;
    if (aqui) return { valor: aqui.v, proprio: true, herdado_de: null };
    const ant = q.fisicoAnterior.get(mes) as { v: number; mes: string } | undefined;
    return { valor: ant?.v ?? null, proprio: false, herdado_de: ant?.mes ?? null };
  }
  const aqui = q.saldoNoMes.get(conta, mes) as { v: number } | undefined;
  if (aqui) return { valor: aqui.v, proprio: true, herdado_de: null };
  const banco = q.bancoAtivo.get(conta) as { ativo: number } | undefined;
  if (!banco?.ativo) return { valor: null, proprio: false, herdado_de: null };
  const ant = q.saldoAnterior.get(conta, mes) as { v: number; mes: string } | undefined;
  return { valor: ant?.v ?? null, proprio: false, herdado_de: ant?.mes ?? null };
}

/** Soma `delta` à conta no mês (gravando o mês a partir do valor herdado) e nos meses seguintes já gravados. */
export function ajustarConta(conta: Conta, mes: string, delta: number) {
  if (delta === 0) return;
  const base = valorDaConta(conta, mes);
  // se o mês ainda herda, primeiro grava o valor herdado, depois soma
  if (conta === null) {
    if (!base.proprio) q.somarFisico.run(mes, base.valor ?? 0);
    q.somarFisico.run(mes, delta);
    q.propagarFisico.run(delta, mes);
  } else {
    if (!base.proprio) q.somarSaldo.run(mes, conta, base.valor ?? 0);
    q.somarSaldo.run(mes, conta, delta);
    q.propagarSaldo.run(delta, conta, mes);
  }
}

/** Define o valor absoluto da conta no mês (diferença repassada aos meses seguintes). Sem mudança, nada é gravado. */
export function definirConta(conta: Conta, mes: string, valor: number) {
  const atual = valorDaConta(conta, mes);
  const delta = valor - (atual.valor ?? 0);
  if (delta !== 0) ajustarConta(conta, mes, delta);
  else if (!atual.proprio && atual.valor === null) {
    // conta sem nenhum histórico informada como 0: grava para "começar" a cadeia
    if (conta === null) q.somarFisico.run(mes, 0);
    else q.somarSaldo.run(mes, conta, 0);
  }
}

/** Saldos efetivos (gravados ou herdados) de todos os bancos que tenham valor no mês. */
export function saldosDoMes(mes: string) {
  const bancos = db.prepare("SELECT id, nome, cor, ativo FROM bancos ORDER BY nome COLLATE NOCASE").all() as {
    id: number;
    nome: string;
    cor: string;
    ativo: number;
  }[];
  return bancos.map((b) => ({ banco_id: b.id, nome: b.nome, cor: b.cor, ativo: b.ativo === 1, ...valorDaConta(b.id, mes) }));
}
