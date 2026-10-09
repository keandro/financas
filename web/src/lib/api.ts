import type { Moeda } from "./formato";

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
  /** "outro" = poupança (aplicações etc.), sem cartão */
  tipo: TipoConta;
  moeda: Moeda;
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

export type TipoConta = "banco" | "outro";

export interface BancoEntrada {
  tipo?: TipoConta;
  moeda?: Moeda;
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
  tipo: TipoConta;
  moeda: Moeda;
  valor_centavos: number | null;
  /** mês de onde o saldo foi herdado (null = gravado neste mês) */
  herdado_de: string | null;
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

export interface Movimentacao {
  id: number;
  /** null = dinheiro físico */
  banco_id: number | null;
  data: string;
  descricao: string;
  /** entrada > 0, saída < 0 */
  valor_centavos: number;
}

export interface Lancamento {
  mes: string;
  temDados: boolean;
  dinheiro_fisico: number | null;
  fisico_herdado_de: string | null;
  saldos: SaldoLancamento[];
  faturas: FaturaLancamento[];
  movimentacoes: Movimentacao[];
  /** taxa = reais por 1 unidade × 10000 */
  cotacoes: Record<MoedaEstrangeira, { taxa: number | null; herdado_de: string | null }>;
}

export type MoedaEstrangeira = "USD" | "EUR";

export interface Totais {
  mes: string;
  temDados: boolean;
  dinheiro_fisico: number;
  bancos: number;
  /** conta corrente: físico + bancos */
  disponivel: number;
  devido: number;
  patrimonio: number;
  /** poupança em reais */
  poupanca: number;
  patrimonio_total: number;
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

export interface Variacao {
  valor: number;
  pct: number | null;
}

export interface Resumo extends Totais {
  anterior: Totais;
  variacao: Variacao | null;
  variacao_poupanca: Variacao | null;
  distribuicao: { nome: string; cor: string; valor: number }[];
  distribuicao_poupanca: { nome: string; cor: string; valor: number; moeda: Moeda; valor_original: number }[];
  faturas: FaturaDetalhe[];
  uso_limite: { cartao_id: number; banco_nome: string; cor: string; limite_centavos: number; usado_centavos: number }[];
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
      cotacoes: Partial<Record<MoedaEstrangeira, number>>;
    },
  ) => req<{ ok: true; ajustes: { banco_id: number; nome: string; ajuste_centavos: number }[] }>("PUT", `/lancamentos/${mes}`, dados),

  adicionarMovimentacao: (mes: string, m: Omit<Movimentacao, "id">) =>
    req<{ movimentacao: Movimentacao; valor_conta: number | null }>("POST", `/lancamentos/${mes}/movimentacoes`, m),
  removerMovimentacao: (mes: string, id: number) =>
    req<{ ok: true; valor_conta: number | null }>("DELETE", `/lancamentos/${mes}/movimentacoes/${id}`),

  cotacaoAtual: () => req<Record<MoedaEstrangeira, number>>("GET", "/cotacoes/atual"),
  meses: () => req<string[]>("GET", "/meses"),
  resumo: (mes: string) => req<Resumo>("GET", `/resumo/${mes}`),
  historico: (mes: string, n = 12) => req<Totais[]>("GET", `/historico/${mes}?n=${n}`),
  vencimentos: () => req<FaturaDetalhe[]>("GET", "/vencimentos"),
};
