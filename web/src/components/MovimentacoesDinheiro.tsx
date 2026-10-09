import { useState, type FormEvent } from "react";
import { api, type Movimentacao } from "../lib/api";
import { formatarBRL, formatarData } from "../lib/formato";
import { CampoMoeda } from "./CampoMoeda";
import { Botao, inputClasse } from "./ui";

interface Props {
  mes: string;
  /** null = dinheiro físico */
  bancoId: number | null;
  /** movimentações desta conta no mês */
  movimentacoes: Movimentacao[];
  titulo?: string;
  /** chamado após adicionar/remover, com a variação aplicada ao dinheiro físico */
  onAlterado: (lista: Movimentacao[], variacao: number) => void;
}

function dataPadrao(mes: string) {
  const hoje = new Date();
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return iso.startsWith(mes) ? iso : `${mes}-01`;
}

function ultimoDia(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
}

/** Entradas e saídas de uma conta (dinheiro físico ou banco): cada uma já soma/subtrai do valor do mês ao ser adicionada. */
export function MovimentacoesDinheiro({ mes, bancoId, movimentacoes, titulo = "Movimentações do mês", onAlterado }: Props) {
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [valor, setValor] = useState<number | null>(null);
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(() => dataPadrao(mes));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // ao trocar de mês, a data sugerida acompanha
  const [mesDaData, setMesDaData] = useState(mes);
  if (mesDaData !== mes) {
    setMesDaData(mes);
    setData(dataPadrao(mes));
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    if (!valor) return setErro("Informe o valor.");
    setErro(null);
    setOcupado(true);
    try {
      const assinado = tipo === "entrada" ? valor : -valor;
      const r = await api.adicionarMovimentacao(mes, { banco_id: bancoId, data, descricao, valor_centavos: assinado });
      const lista = [...movimentacoes, r.movimentacao].sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
      onAlterado(lista, assinado);
      setValor(null);
      setDescricao("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function remover(m: Movimentacao) {
    setOcupado(true);
    try {
      await api.removerMovimentacao(mes, m.id);
      onAlterado(
        movimentacoes.filter((x) => x.id !== m.id),
        -m.valor_centavos,
      );
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const sufixo = bancoId === null ? "" : ` (banco ${bancoId})`;
  const entradas = movimentacoes.filter((m) => m.valor_centavos > 0).reduce((s, m) => s + m.valor_centavos, 0);
  const saidas = movimentacoes.filter((m) => m.valor_centavos < 0).reduce((s, m) => s - m.valor_centavos, 0);

  const botaoTipo = (t: "entrada" | "saida", rotulo: string, ativo: string) => (
    <button
      type="button"
      onClick={() => setTipo(t)}
      aria-pressed={tipo === t}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        tipo === t ? ativo : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className={titulo ? "mt-5 border-t border-slate-200 pt-4 dark:border-slate-800" : ""}>
      {titulo && <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">{titulo}</h3>}

      <form onSubmit={adicionar} className="space-y-2">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
          {botaoTipo("entrada", "＋ Entrada", "bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300")}
          {botaoTipo("saida", "− Saída", "bg-white text-red-600 shadow-sm dark:bg-slate-800 dark:text-red-400")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CampoMoeda aria-label={`Valor da movimentação${sufixo}`} valor={valor} onChange={setValor} />
          <input
            type="date"
            aria-label={`Data da movimentação${sufixo}`}
            className={inputClasse}
            value={data}
            min={`${mes}-01`}
            max={ultimoDia(mes)}
            onChange={(e) => setData(e.target.value)}
            required
          />
        </div>
        <div className="flex gap-2">
          <input
            className={inputClasse}
            placeholder={tipo === "entrada" ? "Descrição (ex.: recebi do João)" : "Descrição (ex.: almoço)"}
            aria-label={`Descrição da movimentação${sufixo}`}
            value={descricao}
            maxLength={200}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <Botao type="submit" variante="primario" disabled={ocupado || !valor} className="shrink-0">
            Adicionar
          </Botao>
        </div>
        {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
      </form>

      {movimentacoes.length > 0 && (
        <>
          <ul className="mt-4 divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {movimentacoes.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="w-12 shrink-0 text-xs text-slate-500 tabular-nums dark:text-slate-400">{formatarData(m.data).slice(0, 5)}</span>
                <span className="min-w-0 flex-1 truncate">{m.descricao || <span className="text-slate-400">{m.valor_centavos > 0 ? "Entrada" : "Saída"}</span>}</span>
                <span className={`font-medium tabular-nums ${m.valor_centavos > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {m.valor_centavos > 0 ? "+" : "−"}
                  {formatarBRL(Math.abs(m.valor_centavos))}
                </span>
                <button
                  onClick={() => remover(m)}
                  disabled={ocupado}
                  className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-slate-800"
                  aria-label={`Remover ${m.descricao || "movimentação"}`}
                  title="Remover (desfaz o valor no dinheiro físico)"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Entradas <b className="text-emerald-600 dark:text-emerald-400">+{formatarBRL(entradas)}</b> · Saídas{" "}
            <b className="text-red-600 dark:text-red-400">−{formatarBRL(saidas)}</b>
          </p>
        </>
      )}
    </div>
  );
}
