import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CampoMoeda } from "../components/CampoMoeda";
import { MovimentacoesDinheiro } from "../components/MovimentacoesDinheiro";
import { UsoLimite } from "../components/UsoLimite";
import { SeletorMes } from "../components/SeletorMes";
import { Aviso, Botao, Bolinha, Painel } from "../components/ui";
import { useMes } from "../contexts/Mes";
import { api, type Lancamento, type MoedaEstrangeira, type Movimentacao } from "../lib/api";
import { NOME_MOEDA, SIMBOLO, UNIDADE_COTACAO, formatarBRL, formatarData, paraReais, type Moeda } from "../lib/formato";
import { nomeMesCurto } from "../lib/mes";
import { useApi } from "../lib/useApi";

export function LancamentoPage() {
  const { mes } = useMes();
  const { dados: original, setDados: setOriginal, erro, carregando, recarregar } = useApi(() => api.lancamento(mes), [mes]);
  const [form, setForm] = useState<Lancamento | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** conta com o painel de entradas/saídas aberto: "fisico" ou id do banco */
  const [contaAberta, setContaAberta] = useState<number | "fisico" | null>(null);

  // recarregar do servidor reinicia o formulário; atualização local do "original" (movimentação) não
  const atualizacaoLocal = useRef(false);
  useEffect(() => {
    if (atualizacaoLocal.current) atualizacaoLocal.current = false;
    else setForm(original);
  }, [original]);
  useEffect(() => setMsg(null), [mes]);

  const alterado = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);

  // avisa ao fechar a aba com alterações não salvas
  useEffect(() => {
    if (!alterado) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [alterado]);

  // Ajustes que o servidor fará nos saldos ao salvar (fatura marcada/desmarcada como paga).
  // Mesma regra do servidor: desconto = valor se paga; ajuste = desconto antigo − desconto novo.
  const ajustes = useMemo(() => {
    const m = new Map<number, number>();
    if (!form || !original) return m;
    for (const f of form.faturas) {
      const antes = original.faturas.find((o) => o.cartao_id === f.cartao_id);
      const descontoAntes = antes?.paga ? (antes.valor_centavos ?? 0) : 0;
      const descontoDepois = f.paga ? (f.valor_centavos ?? 0) : 0;
      const ajuste = descontoAntes - descontoDepois;
      if (ajuste !== 0) m.set(f.banco_id, (m.get(f.banco_id) ?? 0) + ajuste);
    }
    return m;
  }, [form, original]);

  const totais = useMemo(() => {
    if (!form) return null;
    const somaAjustes = [...ajustes.values()].reduce((s, v) => s + v, 0);
    const emReais = (b: Lancamento["saldos"][number]) =>
      paraReais(b.valor_centavos ?? 0, b.moeda, b.moeda === "BRL" ? null : form.cotacoes[b.moeda].taxa) ?? 0;
    const disponivel =
      (form.dinheiro_fisico ?? 0) + form.saldos.filter((b) => b.tipo === "banco").reduce((s, b) => s + emReais(b), 0) + somaAjustes;
    const poupanca = form.saldos.filter((b) => b.tipo === "outro").reduce((s, b) => s + emReais(b), 0);
    const devido = form.faturas.reduce((s, f) => s + (f.paga ? 0 : (f.valor_centavos ?? 0)), 0);
    return { disponivel, devido, patrimonio: disponivel - devido, poupanca };
  }, [form, ajustes]);

  const [erroCotacao, setErroCotacao] = useState<string | null>(null);
  async function buscarCotacao() {
    if (!form) return;
    setErroCotacao(null);
    try {
      const c = await api.cotacaoAtual();
      setForm({
        ...form,
        cotacoes: Object.fromEntries(Object.entries(c).map(([m, taxa]) => [m, { taxa, herdado_de: null }])) as Lancamento["cotacoes"],
      });
    } catch (e) {
      setErroCotacao((e as Error).message);
    }
  }

  /** Movimentações já foram gravadas no servidor: aplica a variação no form e no "original" (sem perder outras edições). */
  function aplicarMovimentacao(bancoId: number | null, listaDaConta: Movimentacao[], variacao: number) {
    const atualizar = (l: Lancamento | null): Lancamento | null =>
      l && {
        ...l,
        temDados: true,
        movimentacoes: [...l.movimentacoes.filter((m) => m.banco_id !== bancoId), ...listaDaConta],
        ...(bancoId === null
          ? { dinheiro_fisico: (l.dinheiro_fisico ?? 0) + variacao, fisico_herdado_de: null }
          : {
              saldos: l.saldos.map((s) =>
                s.banco_id === bancoId ? { ...s, valor_centavos: (s.valor_centavos ?? 0) + variacao, herdado_de: null } : s,
              ),
            }),
      };
    atualizacaoLocal.current = true;
    setOriginal(atualizar);
    setForm(atualizar);
  }

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    try {
      const r = await api.salvarLancamento(mes, {
        dinheiro_fisico: form.dinheiro_fisico,
        saldos: form.saldos.map(({ banco_id, valor_centavos }) => ({ banco_id, valor_centavos })),
        faturas: form.faturas.map(({ cartao_id, valor_centavos, paga }) => ({ cartao_id, valor_centavos, paga })),
        cotacoes: Object.fromEntries(
          Object.entries(form.cotacoes)
            .filter(([, c]) => c.taxa !== null)
            .map(([m, c]) => [m, c.taxa]),
        ),
      });
      recarregar();
      const detalhes = r.ajustes.map((a) => `${a.nome} ${a.ajuste_centavos > 0 ? "+" : "−"}${formatarBRL(Math.abs(a.ajuste_centavos))}`);
      setMsg({ tipo: "ok", texto: detalhes.length ? `Lançamento salvo! Saldos ajustados: ${detalhes.join(" · ")}` : "Lançamento salvo!" });
    } catch (e) {
      setMsg({ tipo: "erro", texto: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  const rotulo = "text-xs text-slate-500 dark:text-slate-400";

  /** linhas de saldo de um tipo de conta (bancos ou poupança) */
  const contas = (tipo: "banco" | "outro") => {
    if (!form) return null;
    const lista = form.saldos.filter((x) => x.tipo === tipo);
    if (lista.length === 0) return <p className="text-sm text-slate-500">Nenhum banco ativo cadastrado.</p>;
    const moedasUsadas = [...new Set(lista.map((x) => x.moeda))].filter((m): m is MoedaEstrangeira => m !== "BRL");
    return (
      <div className="space-y-5">
        {moedasUsadas.length > 0 && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
            {moedasUsadas.map((m) => (
              <div key={m} className="grid grid-cols-[1fr_minmax(0,11rem)] items-center gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Cotação {NOME_MOEDA[m]} ({UNIDADE_COTACAO(m)})
                  </p>
                  {form.cotacoes[m].herdado_de && <p className="text-xs text-slate-500 dark:text-slate-400">↳ Trazido de {nomeMesCurto(form.cotacoes[m].herdado_de!)}</p>}
                </div>
                <CampoMoeda
                  aria-label={`Cotação ${m}`}
                  casas={4}
                  valor={form.cotacoes[m].taxa}
                  onChange={(v) => setForm({ ...form, cotacoes: { ...form.cotacoes, [m]: { taxa: v, herdado_de: null } } })}
                />
              </div>
            ))}
            <div className="flex items-center justify-end gap-3">
              {erroCotacao && <span className="text-xs text-red-600 dark:text-red-400">{erroCotacao}</span>}
              <button type="button" onClick={buscarCotacao} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                ⟳ Buscar cotação atual
              </button>
            </div>
          </div>
        )}
        {lista.map((s) => (
          <LinhaConta
            key={s.banco_id}
            nome={s.nome}
            cor={s.cor}
            inativo={!s.ativo}
            rotuloCampo={`Saldo ${s.nome}`}
            moeda={s.moeda}
            taxa={s.moeda === "BRL" ? null : form.cotacoes[s.moeda].taxa}
            permitirNegativo
            valor={s.valor_centavos}
            onChange={(v) => setForm({ ...form, saldos: form.saldos.map((x) => (x.banco_id === s.banco_id ? { ...x, valor_centavos: v } : x)) })}
            herdadoDe={s.herdado_de}
            aberta={contaAberta === s.banco_id}
            onAlternar={() => setContaAberta(contaAberta === s.banco_id ? null : s.banco_id)}
            mes={mes}
            bancoId={s.banco_id}
            movimentacoes={form.movimentacoes.filter((m) => m.banco_id === s.banco_id)}
            onMovimentado={(lista, v) => aplicarMovimentacao(s.banco_id, lista, v)}
          >
            {ajustes.has(s.banco_id) && (
              <p className="text-right text-xs text-sky-700 dark:text-sky-300">
                Ao salvar: {ajustes.get(s.banco_id)! > 0 ? "+" : "−"}
                {formatarBRL(Math.abs(ajustes.get(s.banco_id)!))} ({ajustes.get(s.banco_id)! < 0 ? "fatura paga" : "fatura desmarcada"}) →{" "}
                <b className="tabular-nums">{formatarBRL((s.valor_centavos ?? 0) + ajustes.get(s.banco_id)!)}</b>
              </p>
            )}
          </LinhaConta>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Lançamento do mês</h1>
        <SeletorMes />
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando && !form && <p className="text-slate-500">Carregando...</p>}

      {form && (
        <>
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

          {alterado && (
            <div>
              <Botao variante="fantasma" onClick={() => setForm(original)}>
                Desfazer alterações
              </Botao>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Painel titulo="Dinheiro físico">
                <LinhaConta
                  nome="Em espécie"
                  cor="#10B981"
                  rotuloCampo="Dinheiro físico"
                  valor={form.dinheiro_fisico}
                  onChange={(v) => setForm({ ...form, dinheiro_fisico: v })}
                  herdadoDe={form.fisico_herdado_de}
                  aberta={contaAberta === "fisico"}
                  onAlternar={() => setContaAberta(contaAberta === "fisico" ? null : "fisico")}
                  mes={mes}
                  bancoId={null}
                  movimentacoes={form.movimentacoes.filter((m) => m.banco_id === null)}
                  onMovimentado={(lista, v) => aplicarMovimentacao(null, lista, v)}
                />
              </Painel>

              <Painel titulo="Saldos bancários">{contas("banco")}</Painel>

              {form.saldos.some((x) => x.tipo === "outro") && <Painel titulo="Poupança">{contas("outro")}</Painel>}
            </div>

            <Painel titulo="Faturas dos cartões">
              {form.faturas.length === 0 && <p className="text-sm text-slate-500">Nenhum cartão ativo cadastrado.</p>}
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {form.faturas.map((f, i) => (
                  <div key={f.cartao_id} className="grid grid-cols-[1fr_minmax(0,11rem)] items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Bolinha cor={f.cor} />
                        <span className="truncate font-medium">{f.banco_nome}</span>
                      </div>
                      <p className={rotulo}>
                        {f.dia_fechamento ? `Fecha dia ${f.dia_fechamento} · ` : ""}Vence {formatarData(f.vencimento)}
                      </p>
                    </div>
                    <CampoMoeda
                      aria-label={`Fatura ${f.banco_nome}`}
                      valor={f.valor_centavos}
                      onChange={(v) => setForm({ ...form, faturas: form.faturas.map((x, j) => (j === i ? { ...x, valor_centavos: v } : x)) })}
                    />
                    {f.limite_centavos !== null && (
                      <div className="col-span-2">
                        <UsoLimite valor={f.valor_centavos ?? 0} limite={f.limite_centavos} />
                      </div>
                    )}
                    <label className="col-span-2 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-emerald-600"
                        checked={f.paga}
                        onChange={(e) => setForm({ ...form, faturas: form.faturas.map((x, j) => (j === i ? { ...x, paga: e.target.checked } : x)) })}
                      />
                      Paga
                      {(() => {
                        const antes = original?.faturas.find((o) => o.cartao_id === f.cartao_id);
                        if (!antes || antes.paga === f.paga || !f.valor_centavos) return null;
                        return (
                          <span className="text-xs text-sky-700 dark:text-sky-300">
                            ({f.paga ? "desconta" : "devolve"} {formatarBRL(f.valor_centavos)} {f.paga ? "do" : "ao"} saldo do {f.banco_nome} ao salvar)
                          </span>
                        );
                      })()}
                    </label>
                  </div>
                ))}
              </div>
            </Painel>
          </div>

          {/* barra de totais + salvar: fixa embaixo */}
          {totais && (
            <div className="sticky bottom-20 z-10 md:bottom-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>
                    <span className={rotulo}>Disponível </span>
                    <b className="tabular-nums">{formatarBRL(totais.disponivel)}</b>
                  </span>
                  <span>
                    <span className={rotulo}>Devido </span>
                    <b className="text-red-600 tabular-nums dark:text-red-400">{formatarBRL(totais.devido)}</b>
                  </span>
                  <span>
                    <span className={rotulo}>Patrimônio </span>
                    <b className="tabular-nums">{formatarBRL(totais.patrimonio)}</b>
                  </span>
                  {totais.poupanca !== 0 && (
                    <span>
                      <span className={rotulo}>Poupança </span>
                      <b className="text-sky-600 tabular-nums dark:text-sky-400">{formatarBRL(totais.poupanca)}</b>
                    </span>
                  )}
                </div>
                <Botao variante="primario" onClick={salvar} disabled={!alterado || salvando} className="w-full sm:w-auto">
                  {salvando ? "Salvando..." : alterado ? "Salvar" : "Salvo"}
                </Botao>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface LinhaContaProps {
  moeda?: Moeda;
  /** cotação da moeda (× 10000), para mostrar o valor em reais */
  taxa?: number | null;
  nome: string;
  cor: string;
  inativo?: boolean;
  rotuloCampo: string;
  permitirNegativo?: boolean;
  valor: number | null;
  onChange: (v: number | null) => void;
  herdadoDe: string | null;
  aberta: boolean;
  onAlternar: () => void;
  mes: string;
  bancoId: number | null;
  movimentacoes: Movimentacao[];
  onMovimentado: (lista: Movimentacao[], variacao: number) => void;
  children?: ReactNode;
}

/** Uma conta (dinheiro físico ou banco): valor do mês + botão que abre as entradas/saídas. */
function LinhaConta(p: LinhaContaProps) {
  const moeda = p.moeda ?? "BRL";
  const n = p.movimentacoes.length;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_minmax(0,11rem)] items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bolinha cor={p.cor} />
            <span className="truncate font-medium">{p.nome}</span>
            {p.inativo && <span className="text-xs text-slate-500 dark:text-slate-400">(inativo)</span>}
          </div>
        </div>
        <CampoMoeda aria-label={p.rotuloCampo} simbolo={SIMBOLO[moeda]} permitirNegativo={p.permitirNegativo} valor={p.valor} onChange={p.onChange} />
      </div>
      {moeda !== "BRL" && p.valor !== null && (
        <p className="-mt-1 text-right text-xs text-slate-500 tabular-nums dark:text-slate-400">
          {p.taxa ? `≈ ${formatarBRL(paraReais(p.valor, moeda, p.taxa)!)}` : "sem cotação"}
        </p>
      )}
      <div className="-mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">{p.herdadoDe ? `↳ Trazido de ${nomeMesCurto(p.herdadoDe)}` : ""}</span>
        <button
          type="button"
          onClick={p.onAlternar}
          aria-expanded={p.aberta}
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {p.aberta ? "▾" : "▸"} ± Entradas/saídas{n ? ` (${n})` : ""}
        </button>
      </div>
      {p.aberta && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <MovimentacoesDinheiro mes={p.mes} bancoId={p.bancoId} titulo="" moeda={moeda} movimentacoes={p.movimentacoes} onAlterado={p.onMovimentado} />
        </div>
      )}
      {p.children}
    </div>
  );
}
