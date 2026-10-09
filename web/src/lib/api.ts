export interface Cartao {
  id: number;
  dia_fechamento: number | null;
  dia_vencimento: number;
  limite_centavos: number | null;
  ativo: boolean;
}

export interface Banco {
  id: number;
  nome: string;
  cor: string;
  ativo: boolean;
  criado_em: string;
  /** quantidade de saldos + faturas lançados (perdidos ao excluir) */
  lancamentos: number;
  cartao: Cartao | null;
}

export interface CartaoEntrada {
  dia_fechamento: number | null;
  dia_vencimento: number;
  limite_centavos: number | null;
  ativo?: boolean;
}

export interface BancoEntrada {
  nome: string;
  cor: string;
  ativo?: boolean;
  cartao?: CartaoEntrada | null;
}

export interface SaldoLancamento {
  banco_id: number;
  nome: string;
  cor: string;
  ativo: boolean;
  valor_centavos: number | null;
}

export interface FaturaLancamento {
  cartao_id: number;
  banco_id: number;
  banco_nome: string;
  cor: string;
  dia_fechamento: number | null;
  dia_vencimento: number;
  limite_centavos: number | null;
  vencimento: string;
  valor_centavos: number | null;
  paga: boolean;
}

export interface Lancamento {
  mes: string;
  temDados: boolean;
  dinheiro_fisico: number | null;
  saldos: SaldoLancamento[];
  faturas: FaturaLancamento[];
}

export interface Totais {
  mes: string;
  temDados: boolean;
  dinheiro_fisico: number;
  bancos: number;
  disponivel: number;
  devido: number;
  patrimonio: number;
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

export interface Resumo extends Totais {
  anterior: Totais;
  variacao: { valor: number; pct: number | null } | null;
  distribuicao: { nome: string; cor: string; valor: number }[];
  faturas: FaturaDetalhe[];
}

async function req<T>(metodo: string, url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`/api${url}`, {
    method: metodo,
    headers: corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro ?? `Erro ${r.status}`);
  return dados as T;
}

export const api = {
  bancos: () => req<Banco[]>("GET", "/bancos"),
  criarBanco: (b: BancoEntrada) => req<Banco>("POST", "/bancos", b),
  atualizarBanco: (id: number, b: Partial<BancoEntrada>) => req<Banco>("PUT", `/bancos/${id}`, b),
  excluirBanco: (id: number) => req<{ ok: true }>("DELETE", `/bancos/${id}`),

  lancamento: (mes: string) => req<Lancamento>("GET", `/lancamentos/${mes}`),
  salvarLancamento: (
    mes: string,
    dados: {
      dinheiro_fisico: number | null;
      saldos: { banco_id: number; valor_centavos: number | null }[];
      faturas: { cartao_id: number; valor_centavos: number | null; paga: boolean }[];
    },
  ) => req<{ ok: true }>("PUT", `/lancamentos/${mes}`, dados),
  marcarPaga: (mes: string, cartaoId: number, paga: boolean) =>
    req<{ ok: true }>("PATCH", `/lancamentos/${mes}/faturas/${cartaoId}`, { paga }),

  meses: () => req<string[]>("GET", "/meses"),
  resumo: (mes: string) => req<Resumo>("GET", `/resumo/${mes}`),
  historico: (mes: string, n = 12) => req<Totais[]>("GET", `/historico/${mes}?n=${n}`),
  vencimentos: () => req<FaturaDetalhe[]>("GET", "/vencimentos"),
};
