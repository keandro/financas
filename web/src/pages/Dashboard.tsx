import { Link } from "react-router-dom";
import { GraficoDistribuicao, GraficoEvolucao, GraficoFaturas } from "../components/Graficos";
import { SeletorMes } from "../components/SeletorMes";
import { Aviso, Bolinha, Painel } from "../components/ui";
import { UsoLimite } from "../components/UsoLimite";
import { ProximosVencimentos } from "../components/Vencimentos";
import { useMes } from "../contexts/Mes";
import { api } from "../lib/api";
import { formatarBRL, formatarPct } from "../lib/formato";
import { nomeMes, nomeMesCurto, somarMeses } from "../lib/mes";
import { useApi } from "../lib/useApi";

function CardResumo({ titulo, valor, detalhe, destaque }: { titulo: string; valor: string; detalhe?: React.ReactNode; destaque?: string }) {
  return (
    <Painel>
      <p className="text-sm text-slate-500 dark:text-slate-400">{titulo}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${destaque ?? ""}`}>{valor}</p>
      {detalhe && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detalhe}</div>}
    </Painel>
  );
}

export function DashboardPage() {
  const { mes } = useMes();
  const resumo = useApi(() => api.resumo(mes), [mes]);
  const historico = useApi(() => api.historico(mes, 12), [mes]);
  const vencimentos = useApi(api.vencimentos, []);

  // próximos vencimentos: só o mês selecionado e o seguinte
  const proximoMes = somarMeses(mes, 1);
  const todasAbertas = vencimentos.dados ?? [];
  const doPeriodo = todasAbertas.filter((f) => f.mes === mes || f.mes === proximoMes);
  const anterioresEmAberto = todasAbertas.filter((f) => f.mes < mes);

  const r = resumo.dados;
  const erro = resumo.erro ?? historico.erro ?? vencimentos.erro;

  const v = r?.variacao;
  const sobe = v ? v.valor >= 0 : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{nomeMes(mes)}</p>
        </div>
        <SeletorMes />
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {r && !r.temDados && (
        <Aviso>
          Nenhum lançamento neste mês.{" "}
          <Link to="/lancamento" className="font-medium underline">
            Lançar valores
          </Link>
        </Aviso>
      )}

      {r && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CardResumo
            titulo="Total disponível"
            valor={formatarBRL(r.disponivel)}
            detalhe={`Físico ${formatarBRL(r.dinheiro_fisico)} · Bancos ${formatarBRL(r.bancos)}`}
          />
          <CardResumo titulo="Total devido" valor={formatarBRL(r.devido)} destaque={r.devido > 0 ? "text-red-600 dark:text-red-400" : ""} />
          <CardResumo
            titulo="Patrimônio líquido"
            valor={formatarBRL(r.patrimonio)}
            destaque={r.patrimonio < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
          />
          <CardResumo
            titulo="Variação vs mês anterior"
            valor={v ? `${sobe ? "▲ +" : "▼ −"}${formatarBRL(Math.abs(v.valor))}` : "—"}
            destaque={v ? (sobe ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-slate-400"}
            detalhe={v?.pct != null ? formatarPct(v.pct) : undefined}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Painel titulo="Distribuição do dinheiro" className="lg:col-span-3">
          {r && <GraficoDistribuicao dados={r.distribuicao} />}
        </Painel>
        <Painel
          titulo="Próximos vencimentos"
          acao={<span className="text-xs text-slate-500 dark:text-slate-400">{nomeMesCurto(mes)} e {nomeMesCurto(proximoMes)}</span>}
          className="lg:col-span-2"
        >
          {vencimentos.dados && <ProximosVencimentos faturas={doPeriodo} />}
          {anterioresEmAberto.length > 0 && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">
              ⚠ Há {anterioresEmAberto.length} {anterioresEmAberto.length === 1 ? "fatura" : "faturas"} em aberto de meses anteriores (
              {formatarBRL(anterioresEmAberto.reduce((s, f) => s + f.valor_centavos, 0))}).
            </p>
          )}
        </Painel>
      </div>

      <Painel titulo="Evolução — últimos 12 meses">{historico.dados && <GraficoEvolucao historico={historico.dados} />}</Painel>

      <Painel titulo="Fatura por cartão no mês">
        {r && <GraficoFaturas faturas={r.faturas} />}
        {r && r.uso_limite.length > 0 && (
          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">Uso do limite</h3>
            {(() => {
              const usado = r.uso_limite.reduce((s, u) => s + u.usado_centavos, 0);
              const limite = r.uso_limite.reduce((s, u) => s + u.limite_centavos, 0);
              return (
                <div className="mb-5 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold">Todos os cartões</span>
                    <span className="ml-auto font-medium tabular-nums">
                      {formatarBRL(usado)} / {formatarBRL(limite)}
                    </span>
                  </div>
                  <UsoLimite valor={usado} limite={limite} compacto />
                </div>
              );
            })()}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {r.uso_limite.map((u) => (
                <div key={u.cartao_id}>
                  <div className="mb-1.5 flex items-center gap-2 text-sm">
                    <Bolinha cor={u.cor} />
                    <span className="font-medium">{u.banco_nome}</span>
                    <span className="ml-auto text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      {formatarBRL(u.usado_centavos)} / {formatarBRL(u.limite_centavos)}
                    </span>
                  </div>
                  <UsoLimite valor={u.usado_centavos} limite={u.limite_centavos} compacto />
                </div>
              ))}
            </div>
          </div>
        )}
      </Painel>
    </div>
  );
}
