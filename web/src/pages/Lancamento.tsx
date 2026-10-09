import { useEffect, useMemo, useRef, useState } from "react";
import { CampoMoeda } from "../components/CampoMoeda";
import { MovimentacoesDinheiro } from "../components/MovimentacoesDinheiro";
import { UsoLimite } from "../components/UsoLimite";
import { SeletorMes } from "../components/SeletorMes";
import { Aviso, Botao, Bolinha, Painel } from "../components/ui";
import { useMes } from "../contexts/Mes";
import { api, type Lancamento, type Movimentacao } from "../lib/api";
import { formatarBRL, formatarData } from "../lib/formato";
import { nomeMes, nomeMesCurto, somarMeses } from "../lib/mes";
import { useApi } from "../lib/useApi";

export function LancamentoPage() {
  const { mes } = useMes();
  const { dados: original, setDados: setOriginal, erro, carregando, recarregar } = useApi(() => api.lancamento(mes), [mes]);
  const [form, setForm] = useState<Lancamento | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [contaAberta, setContaAberta] = useState<number | null>(null);

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
    const disponivel = (form.dinheiro_fisico ?? 0) + form.saldos.reduce((s, b) => s + (b.valor_centavos ?? 0), 0) + somaAjustes;
    const devido = form.faturas.reduce((s, f) => s + (f.paga ? 0 : (f.valor_centavos ?? 0)), 0);
    return { disponivel, devido, patrimonio: disponivel - devido };
  }, [form, ajustes]);

  /** Dinheiro e saldos já passam de um mês para o outro sozinhos; só as faturas podem ser copiadas. */
  async function copiarFaturasAnterior() {
    if (!form) return;
    const mesAnt = somarMeses(mes, -1);
    try {
      const ant = await api.lancamento(mesAnt);
      if (!ant.faturas.some((f) => f.valor_centavos !== null)) {
        setMsg({ tipo: "info", texto: `Não há faturas em ${nomeMes(mesAnt)} para copiar.` });
        return;
      }
      setForm({
        ...form,
        faturas: form.faturas.map((f) => ({ ...f, valor_centavos: ant.faturas.find((a) => a.cartao_id === f.cartao_id)?.valor_centavos ?? f.valor_centavos, paga: false })),
      });
      setMsg({ tipo: "info", texto: `Faturas copiadas de ${nomeMes(mesAnt)}. Ajuste o que mudou e clique em Salvar.` });
    } catch (e) {
      setMsg({ tipo: "erro", texto: (e as Error).message });
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
          {!form.temDados && !alterado && (form.fisico_herdado_de || form.saldos.some((s) => s.herdado_de)) && (
            <Aviso>
              {nomeMes(mes)} começa com o dinheiro e os saldos que você tinha no fim do mês anterior. Lance só o que entrou ou saiu.
            </Aviso>
          )}
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

          <div className="flex flex-wrap gap-2">
            <Botao onClick={copiarFaturasAnterior}>⧉ Copiar faturas do mês anterior</Botao>
            {alterado && (
              <Botao variante="fantasma" onClick={() => setForm(original)}>
                Desfazer alterações
              </Botao>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Painel titulo="Dinheiro físico">
                <CampoMoeda aria-label="Dinheiro físico" valor={form.dinheiro_fisico} onChange={(v) => setForm({ ...form, dinheiro_fisico: v })} />
                <p className={`mt-2 ${rotulo}`}>
                  {form.fisico_herdado_de && `↳ Trazido de ${nomeMesCurto(form.fisico_herdado_de)}. `}
                  As movimentações abaixo somam/subtraem deste valor na hora (e dos meses seguintes).
                </p>
                <MovimentacoesDinheiro
                  mes={mes}
                  bancoId={null}
                  movimentacoes={form.movimentacoes.filter((m) => m.banco_id === null)}
                  onAlterado={(lista, v) => aplicarMovimentacao(null, lista, v)}
                />
              </Painel>

              <Painel titulo="Saldos bancários">
                {form.saldos.length === 0 && <p className="text-sm text-slate-500">Nenhum banco ativo cadastrado.</p>}
                <div className="space-y-4">
                  {form.saldos.map((s, i) => (
                    <div key={s.banco_id} className="grid grid-cols-[1fr_minmax(0,11rem)] items-center gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Bolinha cor={s.cor} />
                        <span className="truncate font-medium">{s.nome}</span>
                        {!s.ativo && <span className={rotulo}>(inativo)</span>}
                      </div>
                      <CampoMoeda
                        aria-label={`Saldo ${s.nome}`}
                        permitirNegativo
                        valor={s.valor_centavos}
                        onChange={(v) => setForm({ ...form, saldos: form.saldos.map((x, j) => (j === i ? { ...x, valor_centavos: v } : x)) })}
                      />
                      <div className="col-span-2 -mt-1 flex flex-wrap items-center justify-between gap-2">
                        <span className={rotulo}>{s.herdado_de ? `↳ Trazido de ${nomeMesCurto(s.herdado_de)}` : ""}</span>
                        <button
                          type="button"
                          onClick={() => setContaAberta(contaAberta === s.banco_id ? null : s.banco_id)}
                          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          {contaAberta === s.banco_id ? "▾" : "▸"} ± Entradas/saídas
                          {(() => {
                            const n = form.movimentacoes.filter((m) => m.banco_id === s.banco_id).length;
                            return n ? ` (${n})` : "";
                          })()}
                        </button>
                      </div>
                      {contaAberta === s.banco_id && (
                        <div className="col-span-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <MovimentacoesDinheiro
                            mes={mes}
                            bancoId={s.banco_id}
                            titulo=""
                            movimentacoes={form.movimentacoes.filter((m) => m.banco_id === s.banco_id)}
                            onAlterado={(lista, v) => aplicarMovimentacao(s.banco_id, lista, v)}
                          />
                        </div>
                      )}
                      {ajustes.has(s.banco_id) && (
                        <p className="col-span-2 -mt-1 text-right text-xs text-sky-700 dark:text-sky-300">
                          Ao salvar: {ajustes.get(s.banco_id)! > 0 ? "+" : "−"}
                          {formatarBRL(Math.abs(ajustes.get(s.banco_id)!))} ({ajustes.get(s.banco_id)! < 0 ? "fatura paga" : "fatura desmarcada"}) →{" "}
                          <b className="tabular-nums">{formatarBRL((s.valor_centavos ?? 0) + ajustes.get(s.banco_id)!)}</b>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className={`mt-3 ${rotulo}`}>
                  Os saldos passam sozinhos para o mês seguinte: use “Entradas/saídas” para lançar o que mudou. Digite “-” para saldo negativo. Ao marcar uma fatura como paga e salvar, o valor é descontado do saldo do banco do
                  cartão. Ao desmarcar, é devolvido. Informe aqui o saldo <b>antes</b> do pagamento.
                </p>
              </Painel>
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
