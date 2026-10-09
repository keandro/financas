import { useEffect, useMemo, useState } from "react";
import { CampoMoeda } from "../components/CampoMoeda";
import { UsoLimite } from "../components/UsoLimite";
import { SeletorMes } from "../components/SeletorMes";
import { Aviso, Botao, Bolinha, Painel } from "../components/ui";
import { useMes } from "../contexts/Mes";
import { api, type Lancamento } from "../lib/api";
import { formatarBRL, formatarData } from "../lib/formato";
import { nomeMes, somarMeses } from "../lib/mes";
import { useApi } from "../lib/useApi";

export function LancamentoPage() {
  const { mes } = useMes();
  const { dados: original, erro, carregando, recarregar } = useApi(() => api.lancamento(mes), [mes]);
  const [form, setForm] = useState<Lancamento | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => setForm(original), [original]);
  useEffect(() => setMsg(null), [mes]);

  const alterado = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);

  // avisa ao fechar a aba com alterações não salvas
  useEffect(() => {
    if (!alterado) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [alterado]);

  const totais = useMemo(() => {
    if (!form) return null;
    const disponivel = (form.dinheiro_fisico ?? 0) + form.saldos.reduce((s, b) => s + (b.valor_centavos ?? 0), 0);
    const devido = form.faturas.reduce((s, f) => s + (f.paga ? 0 : (f.valor_centavos ?? 0)), 0);
    return { disponivel, devido, patrimonio: disponivel - devido };
  }, [form]);

  async function copiarAnterior() {
    if (!form) return;
    const mesAnt = somarMeses(mes, -1);
    try {
      const ant = await api.lancamento(mesAnt);
      if (!ant.temDados) {
        setMsg({ tipo: "info", texto: `Não há lançamentos em ${nomeMes(mesAnt)} para copiar.` });
        return;
      }
      setForm({
        ...form,
        dinheiro_fisico: ant.dinheiro_fisico,
        saldos: form.saldos.map((s) => ({ ...s, valor_centavos: ant.saldos.find((a) => a.banco_id === s.banco_id)?.valor_centavos ?? s.valor_centavos })),
        faturas: form.faturas.map((f) => ({ ...f, valor_centavos: ant.faturas.find((a) => a.cartao_id === f.cartao_id)?.valor_centavos ?? f.valor_centavos, paga: false })),
      });
      setMsg({ tipo: "info", texto: `Valores copiados de ${nomeMes(mesAnt)}. Ajuste o que mudou e clique em Salvar.` });
    } catch (e) {
      setMsg({ tipo: "erro", texto: (e as Error).message });
    }
  }

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    try {
      await api.salvarLancamento(mes, {
        dinheiro_fisico: form.dinheiro_fisico,
        saldos: form.saldos.map(({ banco_id, valor_centavos }) => ({ banco_id, valor_centavos })),
        faturas: form.faturas.map(({ cartao_id, valor_centavos, paga }) => ({ cartao_id, valor_centavos, paga })),
      });
      recarregar();
      setMsg({ tipo: "ok", texto: "Lançamento salvo!" });
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
          {!form.temDados && !alterado && (
            <Aviso>
              {nomeMes(mes)} ainda não tem lançamentos. Use “Copiar mês anterior” para começar com os valores do mês passado.
            </Aviso>
          )}
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

          <div className="flex flex-wrap gap-2">
            <Botao onClick={copiarAnterior}>⧉ Copiar mês anterior</Botao>
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
              </Painel>

              <Painel titulo="Saldos bancários">
                {form.saldos.length === 0 && <p className="text-sm text-slate-500">Nenhum banco ativo cadastrado.</p>}
                <div className="space-y-3">
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
                    </div>
                  ))}
                </div>
                <p className={`mt-3 ${rotulo}`}>Digite “-” para saldo negativo (cheque especial).</p>
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
